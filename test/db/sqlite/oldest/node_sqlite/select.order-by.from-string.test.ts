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
// Each ordering token is mapped by the per-dialect builder. Dialects
// without native `NULLS FIRST`/`NULLS LAST` emit a
// `CASE WHEN col IS NULL …` fallback — the snapshot is the authoritative
// SQL per cell.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'
import { TsSqlError, type TsSqlErrorReason } from '../../../../../src/TsSqlError.js'

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
        // `INVALID_ORDER_BY_ORDERING`.
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

    test('order-by-from-string-bare-column-dialect-default', async () => {
        // A bare column with no ordering keyword routes through the
        // no-explicit-ordering branch — the dialect's default direction,
        // no `asc`/`desc` token appended.
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id })
            .orderByFromString('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(expected)
    })

    test('order-by-from-string-asc-nulls-last-and-desc-nulls-first', async () => {
        // The remaining two of the four asc/desc × nulls corners
        // (`asc nulls last`, `desc nulls first`), each a distinct case arm.
        ctx.mockNext([])
        const result = await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id, priority: tIssue.priority })
            .orderByFromString('priority asc nulls last, id desc nulls first')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority as priority from issue order by priority is null, priority asc, id is not null, id desc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number; priority: number }>>>()
    })

    test('order-by-from-string-asc-insensitive', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id, title: tIssue.title })
            .orderByFromString('title asc insensitive')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title from issue order by lower(title) asc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('order-by-from-string-desc-insensitive', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id, title: tIssue.title })
            .orderByFromString('title desc insensitive')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title from issue order by lower(title) desc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('order-by-from-string-asc-nulls-last-insensitive', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id, title: tIssue.title })
            .orderByFromString('title asc nulls last insensitive')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title from issue order by title is null, lower(title) asc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('order-by-from-string-desc-nulls-first-insensitive', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id, title: tIssue.title })
            .orderByFromString('title desc nulls first insensitive')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title from issue order by title is not null, lower(title) desc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('order-by-from-string-desc-nulls-last-insensitive', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id, title: tIssue.title })
            .orderByFromString('title desc nulls last insensitive')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title from issue order by lower(title) desc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('order-by-from-string-reaches-a-leaf-inside-a-nested-object', async () => {
        // A dotted name orders by a column projected inside a nested object.
        // Priorities: issue 3 → 3, issues 1 and 4 → 2, issue 2 → 1.
        const expected = [
            { id: 3, meta: { priority: 3 } },
            { id: 1, meta: { priority: 2 } },
            { id: 4, meta: { priority: 2 } },
            { id: 2, meta: { priority: 1 } },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id, meta: { priority: tIssue.priority } })
            .orderByFromString('meta.priority desc, id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority as "meta.priority" from issue order by "meta.priority" desc, id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number, meta: { priority: number } }>>>()
        expect(result).toEqual(expected)
    })

    // A depth-3 projection for the rejected names below: `meta` and `meta.sub` are
    // objects, `id` is a leaf.
    function orderByRejection(orderBy: string): TsSqlErrorReason | string {
        try {
            ctx.conn.selectFrom(tIssue)
                .select({ id: tIssue.id, meta: { priority: tIssue.priority, sub: { status: tIssue.status } } })
                .orderByFromString(orderBy)
        } catch (e) {
            return e instanceof TsSqlError ? e.errorReason : `non-TsSqlError: ${String(e)}`
        }
        return '<no throw>'
    }

    test('order-by-from-string-naming-a-nested-object-throws-column-not-in-select', () => {
        expect(orderByRejection('meta desc')).toEqual({ reason: 'ORDER_BY_COLUMN_NOT_IN_SELECT', column: 'meta' })
    })

    test('order-by-from-string-path-continuing-past-a-leaf-throws-column-not-in-select', () => {
        expect(orderByRejection('id.value')).toEqual({ reason: 'ORDER_BY_COLUMN_NOT_IN_SELECT', column: 'id.value' })
    })

    test('order-by-from-string-path-ending-on-a-nested-object-throws-column-not-in-select', () => {
        expect(orderByRejection('meta.sub asc')).toEqual({ reason: 'ORDER_BY_COLUMN_NOT_IN_SELECT', column: 'meta.sub' })
    })
})
