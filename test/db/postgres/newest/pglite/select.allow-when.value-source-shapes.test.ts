// `allowWhen` / `disallowWhen` propagation through additional value-source
// shapes that the more focused `select.value-source.allow-when.test.ts`,
// `select.aggregate-as-array.allow-when.test.ts`,
// `select.allow-when.composition.test.ts`,
// `mutation.allow-when.test.ts` and `fragments.propagation.test.ts` don't
// exercise. Each test wraps the gate INSIDE the operation being tested so
// the introspection walker visits the corresponding `__isAllowed` method
// in [src/internal/ValueSourceImpl.ts](../../../../../src/internal/ValueSourceImpl.ts),
// `WithViewImpl`, `CompoundSelectQueryBuilder`, `RawFragmentImpl`, etc.
//
// Background on the introspection walker, the public-API gap that makes
// the [`isQueryAllowed(...)`](../../../../lib/isAllowed.ts) helper
// necessary, and the design contract that `__isAllowed` mirrors `__toSql`,
// see the comment on `AllowWhenValueSource.__toSql` in
// [src/internal/ValueSourceImpl.ts:1689-1717](../../../../../src/internal/ValueSourceImpl.ts#L1689-L1717),
// the entry in [test/LIMITATIONS.md](../../../../LIMITATIONS.md) and
// [test/lib/isAllowed.ts](../../../../lib/isAllowed.ts).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { isQueryAllowed } from '../../../../lib/isAllowed.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('union-all-with-gated-column-in-second-arm-throws', async () => {
        // `selectA.unionAll(selectB)` builds a `CompoundSelectQueryBuilder`.
        // Its `__isAllowed` walks `__firstQuery` and `__secondQuery` (both
        // PlainSelectData). Closed gate inside the second arm propagates
        // up through that walk.
        const connection = ctx.conn
        const query = connection.selectFrom(tIssue)
            .select({ id: tIssue.id })
            .unionAll(
                connection.selectFrom(tIssue)
                    .select({ id: tIssue.id.allowWhen(false, 'union-second-arm gate blocks') }),
            )

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeSelectMany()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('union-second-arm gate blocks')
    })

    test('union-all-with-allowed-arms-passes', async () => {
        // Open gates on both arms; the compound walker returns true.
        // UNION ALL keeps duplicates, so each of the 4 ids appears twice.
        const expected = [{ id: 1 }, { id: 1 }, { id: 2 }, { id: 2 }, { id: 3 }, { id: 3 }, { id: 4 }, { id: 4 }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .select({ id: tIssue.id.allowWhen(true, 'first-arm gate') })
            .unionAll(
                connection.selectFrom(tIssue)
                    .select({ id: tIssue.id.allowWhen(true, 'second-arm gate') }),
            )

        expect(isQueryAllowed(query)).toBe(true)

        const rows = await query.executeSelectMany()

        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        if (!ctx.realDbEnabled) expect(rows).toEqual(expected)
    })

    test('is-null-on-gated-column-fires-on-build-and-introspects-disallowed', async () => {
        // `tCol.allowWhen(false, ...).isNull()` wraps an
        // `AllowWhenValueSource` inside a `SqlOperationIsNullValueSource`.
        // The outer walker hits `SqlOperationIsNullValueSource.__isAllowed`,
        // which delegates to its wrapped value source's `__isAllowed`
        // (the AllowWhen, which returns false).
        const connection = ctx.conn
        const query = connection.selectFrom(tIssue)
            .where(tIssue.body.allowWhen(false, 'is-null gate blocks').isNull())
            .select({ id: tIssue.id })

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeSelectMany()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('is-null gate blocks')
    })

    test('is-null-on-allowed-column-passes-and-introspects-allowed', async () => {
        // Favorable twin — open gate, the SqlOperationIsNullValueSource
        // walker delegates and returns true. Issues 1 and 3 have NULL body.
        const expected = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .where(tIssue.body.allowWhen(true, 'is-null gate').isNull())
            .select({ id: tIssue.id })

        expect(isQueryAllowed(query)).toBe(true)

        const rows = await query.executeSelectMany()

        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        if (!ctx.realDbEnabled) expect(rows).toEqual(expected)
    })

    test('between-on-gated-column-fires-and-introspects-disallowed', async () => {
        // `tCol.allowWhen(false, ...).between(a, b)` is a 2-arg op —
        // `SqlOperation2ValueSource`. The walker delegates to the
        // wrapped value source.
        const connection = ctx.conn
        const query = connection.selectFrom(tIssue)
            .where(tIssue.priority.allowWhen(false, 'between gate blocks').between(1, 3))
            .select({ id: tIssue.id })

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeSelectMany()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('between gate blocks')
    })

    test('between-on-allowed-column-passes', async () => {
        // Open gate — between renders normally, introspection allowed.
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .where(tIssue.priority.allowWhen(true, 'between gate').between(1, 3))
            .select({ id: tIssue.id })

        expect(isQueryAllowed(query)).toBe(true)

        const rows = await query.executeSelectMany()

        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        if (!ctx.realDbEnabled) expect(rows).toEqual(expected)
    })

    test('value-when-null-on-gated-column-fires-and-introspects-disallowed', async () => {
        // `optCol.allowWhen(false, ...).valueWhenNull(fallback)` wraps
        // the gate inside `SqlOperationValueWhenNullValueSource`. The
        // walker delegates.
        const connection = ctx.conn
        const query = connection.selectFrom(tIssue)
            .select({
                bodyOrPlaceholder: tIssue.body
                    .allowWhen(false, 'value-when-null gate blocks')
                    .valueWhenNull(connection.const('(no body)', 'string')),
            })

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeSelectMany()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('value-when-null gate blocks')
    })

    test('value-when-null-on-allowed-column-passes', async () => {
        // Open gate — both sides of `valueWhenNull` walked and allowed.
        const expected = [
            { bodyOrPlaceholder: '(no body)' },
            { bodyOrPlaceholder: '(no body)' },
            { bodyOrPlaceholder: 'See ADR-014' },
            { bodyOrPlaceholder: 'Use new tokens' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .select({
                bodyOrPlaceholder: tIssue.body
                    .allowWhen(true, 'value-when-null gate')
                    .valueWhenNull(connection.const('(no body)', 'string')),
            })
            .orderBy('bodyOrPlaceholder')

        expect(isQueryAllowed(query)).toBe(true)

        const rows = await query.executeSelectMany()

        assertType<Exact<typeof rows, Array<{ bodyOrPlaceholder: string }>>>()
        if (!ctx.realDbEnabled) expect(rows).toEqual(expected)
    })

    test('equals-if-value-with-defined-value-on-gated-column-fires-and-introspects-disallowed', async () => {
        // `equalsIfValue(definedValue)` renders the `=` comparison (the
        // `IfValue` is not dropped because the value is defined). With
        // a closed gate on the LHS, `SqlOperation1ValueSourceIfValueOrNoop`'s
        // `__isAllowed` walks the wrapped LHS and reports disallowed.
        const connection = ctx.conn
        const query = connection.selectFrom(tIssue)
            .where(tIssue.status.allowWhen(false, 'equals-if-value gate blocks').equalsIfValue('open'))
            .select({ id: tIssue.id })

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeSelectMany()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('equals-if-value gate blocks')
    })

    test('equals-if-value-with-defined-value-on-allowed-column-passes', async () => {
        const expected = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .where(tIssue.status.allowWhen(true, 'equals-if-value gate').equalsIfValue('open'))
            .select({ id: tIssue.id })

        expect(isQueryAllowed(query)).toBe(true)

        const rows = await query.executeSelectMany()

        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        if (!ctx.realDbEnabled) expect(rows).toEqual(expected)
    })

    test('in-if-value-with-non-empty-array-on-gated-column-fires-and-introspects-disallowed', async () => {
        // `inIfValue([...non-empty...])` renders an IN comparison.
        // `SqlOperationInValueSourceIfValueOrNoop` walks the LHS
        // (gated) and reports disallowed.
        const connection = ctx.conn
        const query = connection.selectFrom(tIssue)
            .where(tIssue.priority.allowWhen(false, 'in-if-value gate blocks').inIfValue([1, 2, 3]))
            .select({ id: tIssue.id })

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeSelectMany()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('in-if-value gate blocks')
    })

    test('in-if-value-with-non-empty-array-on-allowed-column-passes', async () => {
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .where(tIssue.priority.allowWhen(true, 'in-if-value gate').inIfValue([1, 2, 3]))
            .select({ id: tIssue.id })

        expect(isQueryAllowed(query)).toBe(true)

        const rows = await query.executeSelectMany()

        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        if (!ctx.realDbEnabled) expect(rows).toEqual(expected)
    })

    test('aggregate-sum-on-gated-column-fires-and-introspects-disallowed', async () => {
        // `connection.sum(tCol.allowWhen(false, ...))` builds
        // `AggregateFunctions1ValueSource` wrapping the gated value
        // source. The walker delegates to the wrapped LHS.
        const connection = ctx.conn
        const query = connection.selectFrom(tIssue)
            .selectOneColumn(connection.sum(
                tIssue.priority.allowWhen(false, 'sum gate blocks'),
            ))

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeSelectOne()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('sum gate blocks')
    })

    test('aggregate-sum-on-allowed-column-passes', async () => {
        ctx.mockNext(8)
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .selectOneColumn(connection.sum(
                tIssue.priority.allowWhen(true, 'sum gate'),
            ))

        expect(isQueryAllowed(query)).toBe(true)

        const result = await query.executeSelectOne()

        if (!ctx.realDbEnabled) expect(result).toBe(8)
    })

    test('optional-const-null-allow-when-true-passes', async () => {
        // `connection.optionalConst(null, 'string').allowWhen(true, ...)`
        // wraps a `NullValueSource` (the SqlBuilder picks `_asNullValue`
        // when the optional const is fed `null`) inside an
        // `AllowWhenValueSource`. The walker hits AllowWhen → delegates
        // to NullValueSource.__isAllowed (which now correctly returns
        // `true`).
        ctx.mockNext([{ tag: null }])
        const connection = ctx.conn

        const query = connection.selectFromNoTable()
            .select({
                tag: connection.optionalConst(null, 'string').allowWhen(true, 'const-null gate'),
            })

        expect(isQueryAllowed(query)).toBe(true)

        const rows = await query.executeSelectMany()

        // Optional null projection collapses to absent key in the result
        // shape; assert structurally rather than by exact equality.
        if (!ctx.realDbEnabled) {
            expect(rows).toHaveLength(1)
            expect(rows[0]?.tag).toBeUndefined()
        }
    })

    test('optional-const-null-allow-when-false-throws-and-introspects-disallowed', async () => {
        // Same with closed gate. AllowWhen.__isAllowed sees `!__allowed`
        // and returns false without delegating.
        const connection = ctx.conn
        const query = connection.selectFromNoTable()
            .select({
                tag: connection.optionalConst(null, 'string').allowWhen(false, 'const-null gate blocks'),
            })

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeSelectMany()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('const-null gate blocks')
    })

    test('length-on-gated-column-fires-and-introspects-disallowed', async () => {
        // `tCol.allowWhen(false, ...).length()` builds a
        // `SqlOperation0ValueSource('_length', ...)` wrapping the
        // AllowWhen. The walker delegates from the 0-arg op into the
        // wrapped value source.
        const connection = ctx.conn
        const query = connection.selectFrom(tIssue)
            .select({
                titleLen: tIssue.title.allowWhen(false, 'length gate blocks').length(),
            })

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeSelectMany()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('length gate blocks')
    })

    test('length-on-allowed-column-passes', async () => {
        const expected = [{ titleLen: 16 }, { titleLen: 15 }, { titleLen: 14 }, { titleLen: 18 }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .select({
                titleLen: tIssue.title.allowWhen(true, 'length gate').length(),
            })

        expect(isQueryAllowed(query)).toBe(true)

        const rows = await query.executeSelectMany()

        if (!ctx.realDbEnabled) expect(rows).toEqual(expected)
    })

    test('equals-other-column-with-gated-lhs-fires-and-introspects-disallowed', async () => {
        // `colA.allowWhen(false, ...).equals(colB)` where colB is
        // another required column. Builds `SqlOperation1NotOptionalValueSource`
        // (the not-optional 1-arg variant). The walker delegates into
        // the wrapped LHS (gated) and the RHS (plain column).
        const connection = ctx.conn
        const query = connection.selectFrom(tIssue)
            .where(tIssue.projectId.allowWhen(false, 'equals-col gate blocks').equals(tIssue.id))
            .select({ id: tIssue.id })

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeSelectMany()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('equals-col gate blocks')
    })

    test('equals-other-column-with-allowed-lhs-passes', async () => {
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .where(tIssue.projectId.allowWhen(true, 'equals-col gate').equals(tIssue.id))
            .select({ id: tIssue.id })

        expect(isQueryAllowed(query)).toBe(true)

        const rows = await query.executeSelectMany()

        if (!ctx.realDbEnabled) expect(rows).toEqual(expected)
    })

    test('concat-on-gated-string-fires-and-introspects-disallowed', async () => {
        // `tStr.allowWhen(false, ...).concat(suffix)` builds
        // `SqlOperation1ValueSourceIfValueOrIgnore('_concat', ...)` —
        // the "IgnoreIfNull" 1-arg variant, distinct from the
        // "NoopIfNull" one. The walker delegates into the wrapped LHS.
        const connection = ctx.conn
        const query = connection.selectFrom(tIssue)
            .select({
                label: tIssue.title.allowWhen(false, 'concat gate blocks').concat(' [issue]'),
            })

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeSelectMany()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('concat gate blocks')
    })

    test('concat-on-allowed-string-passes', async () => {
        const expected = [{ label: 'Update hero copy [issue]' }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                label: tIssue.title.allowWhen(true, 'concat gate').concat(' [issue]'),
            })

        expect(isQueryAllowed(query)).toBe(true)

        const rows = await query.executeSelectMany()

        if (!ctx.realDbEnabled) expect(rows).toEqual(expected)
    })

    test('replace-all-on-gated-string-fires-and-introspects-disallowed', async () => {
        // `tStr.allowWhen(false, ...).replaceAll(find, replace)` builds
        // `SqlOperation2ValueSourceIfValueOrIgnore('_replaceAll', ...)` —
        // the "IgnoreIfNull" 2-arg variant. Walker delegates into LHS.
        const connection = ctx.conn
        const query = connection.selectFrom(tIssue)
            .select({
                title: tIssue.title.allowWhen(false, 'replace-all gate blocks').replaceAll('a', 'A'),
            })

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeSelectMany()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('replace-all gate blocks')
    })

    test('string-concat-aggregate-on-gated-column-fires-and-introspects-disallowed', async () => {
        // `connection.stringConcat(separator, tCol.allowWhen(false, ...))`
        // builds `AggregateFunctions1or2ValueSource('_stringConcat', ...)`
        // — the 2-arg aggregate variant (separator + value). Walker
        // delegates into the wrapped value column.
        const connection = ctx.conn
        const query = connection.selectFrom(tIssue)
            .selectOneColumn(connection.stringConcat(
                tIssue.title.allowWhen(false, 'string-concat gate blocks'),
                ', ',
            ))

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeSelectOne()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('string-concat gate blocks')
    })

    test('string-concat-aggregate-on-allowed-column-passes', async () => {
        ctx.mockNext('Update hero copy, Redesign navbar, Migrate to ESM, Document /v2/users')
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .selectOneColumn(connection.stringConcat(
                tIssue.title.allowWhen(true, 'string-concat gate'),
                ', ',
            ))

        expect(isQueryAllowed(query)).toBe(true)

        const result = await query.executeSelectOne()

        if (!ctx.realDbEnabled) expect(result).toBe('Update hero copy, Redesign navbar, Migrate to ESM, Document /v2/users')
    })

    test('only-when-or-null-false-yields-null-value-source-and-walker-allows-it', async () => {
        // `.onlyWhenOrNull(false)` discards the prior chain and returns
        // a fresh `NullValueSource`. There is no `allowWhen` to wrap
        // here because the chain is replaced; the test just confirms
        // the walker visits `NullValueSource.__isAllowed` (which now
        // correctly returns `true` — the literal NULL has nothing
        // gated to render).
        const expected = [{ tag: null }, { tag: null }, { tag: null }, { tag: null }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .select({
                tag: tIssue.title.onlyWhenOrNull(false),
            })

        expect(isQueryAllowed(query)).toBe(true)

        const rows = await query.executeSelectMany()

        if (!ctx.realDbEnabled) {
            expect(rows).toHaveLength(4)
            for (const r of rows) expect(r.tag).toBeUndefined()
        }
    })

    test('equals-if-value-defined-then-true-when-no-value-allow-when-true-passes', async () => {
        // `col.allowWhen(true, ...).equalsIfValue(definedValue).trueWhenNoValue()`
        // — with a defined value the IfValue is NOT dropped, the LHS
        // (gated) is preserved, and the `BooleanValueWhenNoValueValueSource`
        // wrapper carries the fallback only as a safety net. The walker
        // visits the outer wrapper and delegates into the chain.
        const expected = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .where(tIssue.status.allowWhen(true, 'true-when-no-value gate').equalsIfValue('open').trueWhenNoValue())
            .select({ id: tIssue.id })

        expect(isQueryAllowed(query)).toBe(true)

        const rows = await query.executeSelectMany()

        if (!ctx.realDbEnabled) expect(rows).toEqual(expected)
    })

    test('equals-if-value-defined-then-true-when-no-value-allow-when-false-introspects-disallowed', async () => {
        // Same chain, closed gate on the LHS column. Walker visits the
        // outer `BooleanValueWhenNoValueValueSource.__isAllowed` →
        // delegates into IfValue (preserved because value is defined) →
        // AllowWhen (returns false). Build also throws when executed.
        const connection = ctx.conn
        const query = connection.selectFrom(tIssue)
            .where(tIssue.status.allowWhen(false, 'true-when-no-value gate blocks').equalsIfValue('open').trueWhenNoValue())
            .select({ id: tIssue.id })

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeSelectMany()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('true-when-no-value gate blocks')
    })

    test('value-when-no-value-allow-when-true-passes', async () => {
        // `col.allowWhen(true, ...).equalsIfValue(defined).valueWhenNoValue(otherBoolValueSource)`
        // builds `ValueWhenNoValueValueSource`. Walker visits it and
        // delegates into BOTH the wrapped value source AND the fallback
        // (so a closed gate in either side would propagate).
        const expected = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .where(tIssue.status
                .allowWhen(true, 'value-when-no-value gate')
                .equalsIfValue('open')
                .valueWhenNoValue(connection.true()))
            .select({ id: tIssue.id })

        expect(isQueryAllowed(query)).toBe(true)

        const rows = await query.executeSelectMany()

        if (!ctx.realDbEnabled) expect(rows).toEqual(expected)
    })

    test('value-when-no-value-with-gated-fallback-introspects-disallowed', async () => {
        // Twin of the previous test, but the gate is on the FALLBACK
        // side: `valueWhenNoValue(connection.true().allowWhen(false, ...))`.
        // ValueWhenNoValueValueSource.__isAllowed checks both sides,
        // so a closed gate on the fallback alone is enough to report
        // disallowed.
        const connection = ctx.conn
        const query = connection.selectFrom(tIssue)
            .where(tIssue.status
                .equalsIfValue('open')
                .valueWhenNoValue(connection.true().allowWhen(false, 'value-when-no-value fallback gate blocks')))
            .select({ id: tIssue.id })

        expect(isQueryAllowed(query)).toBe(false)
    })

    test('raw-fragment-in-order-by-with-gated-column-fires-and-introspects-disallowed', async () => {
        // `connection.rawFragment\`${gatedCol}\`` returns a
        // `RawFragment` whose `__isAllowed` walks its own template
        // params. `orderBy(rawFragment)` is one of the typed entry
        // points that accepts `IRawFragment`. The
        // `SelectQueryBuilder.__isAllowed` walker iterates the
        // `__orderBy` entries and calls `__isAllowed` on each
        // expression — the helper duck-types both ValueSource and
        // RawFragment.
        const connection = ctx.conn
        const expr = connection.rawFragment`${tIssue.title.allowWhen(false, 'raw-fragment gate blocks')}`
        const query = connection.selectFrom(tIssue)
            .select({ id: tIssue.id })
            .orderBy(expr)

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeSelectMany()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('raw-fragment gate blocks')
    })

    test('raw-fragment-in-order-by-with-allowed-column-passes', async () => {
        // Favorable twin — open gate on the column nested in the
        // rawFragment. Walker visits RawFragmentImpl.__isAllowed and
        // reports allowed; query runs. Ordered by title ascending:
        // 'Document /v2/users'(4), 'Migrate to ESM'(3), 'Redesign navbar'(2),
        // 'Update hero copy'(1).
        const expected = [{ id: 4 }, { id: 3 }, { id: 2 }, { id: 1 }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const expr = connection.rawFragment`${tIssue.title.allowWhen(true, 'raw-fragment gate')}`
        const query = connection.selectFrom(tIssue)
            .select({ id: tIssue.id })
            .orderBy(expr)

        expect(isQueryAllowed(query)).toBe(true)

        const rows = await query.executeSelectMany()

        if (!ctx.realDbEnabled) expect(rows).toEqual(expected)
    })
})
