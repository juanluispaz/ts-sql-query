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
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
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
        // walker delegates and returns true.
        const expected = [{ id: 3 }]
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
            { bodyOrPlaceholder: 'Use new tokens' },
            { bodyOrPlaceholder: '(no body)' },
            { bodyOrPlaceholder: 'See ADR-014' },
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
        const expected = [{ id: 1 }, { id: 2 }, { id: 4 }]
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
})
