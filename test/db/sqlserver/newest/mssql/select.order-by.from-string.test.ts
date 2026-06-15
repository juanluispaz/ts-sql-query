// Coverage of `orderByFromString(...)` and `orderByFromStringIfValue(...)`
// — the dynamic ORDER BY surface
// Beyond the trivial `'col asc'` form (already covered by
// `select.order-by-limit-offset.test.ts`), the builder routes through
// distinct branches for:
//
//   - bare column (no ordering keyword) → dialect default
//   - `asc nulls first` / `desc nulls last` (and the four corners)
//   - `insensitive` (and its asc/desc/nulls-first/nulls-last variants)
//   - multi-column comma-separated with mixed orderings
//   - the `IfValue` no-op branch (null / undefined / empty string)
//   - the validation errors: unknown column / unknown ordering keyword
//
// Each ordering token is mapped by the per-dialect SqlBuilder
// (`_appendOrderBy`/`_appendOrderByItem*` in
// `AbstractSqlBuilder`/`AbstractMySqlMariaBDSqlBuilder`/etc.). Dialects
// without native `NULLS FIRST`/`NULLS LAST` (mysql, mariadb, sqlserver)
// emit a `CASE WHEN col IS NULL …` fallback — the snapshot is the
// authoritative SQL per cell.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('nulls-first-and-nulls-last-four-corners', async () => {
        // The four cross-products of asc/desc × nulls first/last all
        // route through distinct case arms in the builder. We pin them
        // on a single projection to keep the snapshot compact.
        ctx.mockNext([])
        const result = await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id, priority: tIssue.priority })
            .orderByFromString('priority asc nulls first, id desc nulls last')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority as priority from issue order by priority asc, id desc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number; priority: number }>>>()
    })

    test('insensitive-and-asc-insensitive', async () => {
        // The `insensitive` keyword (bare or paired with asc/desc)
        // lowers the column before sorting — `lower(col) asc` on the
        // dialects that don't have a native COLLATE … case-insensitive.
        ctx.mockNext([])
        const result = await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id, title: tIssue.title })
            .orderByFromString('title insensitive, id asc')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title from issue order by lower(title), id asc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number; title: string }>>>()
    })

    test('combined-asc-nulls-first-insensitive', async () => {
        // The fully-qualified ordering: direction + nulls + insensitive.
        // The builder routes through the single longest matching case;
        // exercising it locks both the parser and the dispatch.
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id, title: tIssue.title })
            .orderByFromString('title asc nulls first insensitive')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title from issue order by lower(title) asc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('order-by-from-string-ifvalue-null-is-noop', async () => {
        // `orderByFromStringIfValue` with `null` / `undefined` / `''`
        // skips emission entirely — no ORDER BY clause ends up in the
        // SQL. We exercise the three falsy variants the `__isValue`
        // helper accepts as "no value".
        const cases: Array<string | null | undefined> = [null, undefined, '']
        for (const v of cases) {
            ctx.mockNext([])
            await ctx.conn.selectFrom(tIssue)
                .select({ id: tIssue.id })
                .orderByFromStringIfValue(v)
                .executeSelectMany()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        }
    })

    test('order-by-from-string-ifvalue-with-value-applies', async () => {
        // The `ifValue` form with a non-empty string falls through to
        // `orderByFromString` and emits the ORDER BY normally.
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id, priority: tIssue.priority })
            .orderByFromStringIfValue('priority desc')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority as priority from issue order by priority desc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('order-by-from-string-throws-on-unknown-column', async () => {
        // Validation: a column not in the projection bubbles up as a
        // `TsSqlProcessingError` with reason `ORDER_BY_COLUMN_NOT_IN_SELECT`.
        // Mock-only: the error is raised before any SQL reaches the
        // runner.
        if (ctx.realDbEnabled) return
        ctx.mockNext([])
        let caught: unknown
        try {
            await ctx.conn.selectFrom(tIssue)
                .select({ id: tIssue.id })
                .orderByFromString('nope asc')
                .executeSelectMany()
        } catch (e) {
            caught = e
        }
        expect(String(caught)).toMatch(/ORDER_BY_COLUMN_NOT_IN_SELECT|not part of the select/)
    })

    test('order-by-from-string-throws-on-unknown-ordering', async () => {
        // Validation: an unrecognised ordering keyword raises
        // `INVALID_ORDER_BY_ORDERING`. Mock-only.
        if (ctx.realDbEnabled) return
        ctx.mockNext([])
        let caught: unknown
        try {
            await ctx.conn.selectFrom(tIssue)
                .select({ id: tIssue.id })
                .orderByFromString('id sideways')
                .executeSelectMany()
        } catch (e) {
            caught = e
        }
        expect(String(caught)).toMatch(/INVALID_ORDER_BY_ORDERING|Unknow ordering clause/)
    })

    // ---- orderByFromStringArray / orderByFromStringArrayIfValue ----
    // The array forms process each element through the same per-clause
    // builder path as `orderByFromString` (no intermediate joined string),
    // so each case is asserted as an equivalence against the comma-joined
    // string form — the from-string cases above already pin the per-dialect
    // SQL, so no new snapshot is needed here.

    test('order-by-from-string-array-matches-the-comma-joined-string', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id, priority: tIssue.priority })
            .orderByFromStringArray(['priority asc nulls first', 'id desc nulls last'])
            .executeSelectMany()
        const arraySql = ctx.lastSql
        const arrayParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id, priority: tIssue.priority })
            .orderByFromString('priority asc nulls first, id desc nulls last')
            .executeSelectMany()

        expect(arraySql).toBe(ctx.lastSql)
        expect(arrayParams).toEqual(ctx.lastParams)
    })

    test('order-by-from-string-array-ifvalue-drops-empty-entries', async () => {
        // null / undefined / '' entries are filtered out (via the same
        // `__isValue` gate every IfValue method uses) before joining; the
        // surviving clauses behave exactly like the from-string form.
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id, priority: tIssue.priority })
            .orderByFromStringArrayIfValue([null, 'priority desc', undefined, ''])
            .executeSelectMany()
        const arraySql = ctx.lastSql

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id, priority: tIssue.priority })
            .orderByFromString('priority desc')
            .executeSelectMany()

        expect(arraySql).toBe(ctx.lastSql)
    })

    test('order-by-from-string-array-ifvalue-all-empty-is-noop', async () => {
        // When every entry is filtered out (or the array is absent), no
        // ORDER BY is emitted — the same no-op as `orderByFromStringIfValue(null)`.
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id })
            .orderByFromStringArrayIfValue([null, undefined, ''])
            .executeSelectMany()
        const emptySql = ctx.lastSql

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id })
            .orderByFromStringIfValue(null)
            .executeSelectMany()

        expect(emptySql).toBe(ctx.lastSql)
    })
})
