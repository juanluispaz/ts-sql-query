// Coverage of `.minValue(other)` / `.maxValue(other)` on numeric value
// sources. The API semantic is "constrain to at-least X" / "constrain
// to at-most X":
//   - `.minValue(X)` (floor) → the greater of the two values
//   - `.maxValue(X)` (cap)   → the lesser of the two values
// The exact SQL function this dialect renders is pinned by the snapshot
// below.
//
// No test in the suite calls these operators today, so this file is
// their only coverage.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('minValue-floors-column-with-literal', async () => {
        // Seed priorities (id → priority): 1→2, 2→1, 3→3, 4→2.
        // `.minValue(2)` floors at 2 → 2, 2, 3, 2 (the `1` is bumped up).
        const expected = [
            { id: 1, floored: 2 },
            { id: 2, floored: 2 },
            { id: 3, floored: 3 },
            { id: 4, floored: 2 },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .select({
                id:      tIssue.id,
                floored: tIssue.priority.minValue(2),
            })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, greatest(priority, @0) as floored from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; floored: number }>>>()
        expect(result).toEqual(expected)
    })

    test('maxValue-caps-column-with-literal', async () => {
        // `.maxValue(2)` caps at 2 → 2, 1, 2, 2 (the `3` is pulled down).
        const expected = [
            { id: 1, capped: 2 },
            { id: 2, capped: 1 },
            { id: 3, capped: 2 },
            { id: 4, capped: 2 },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .select({
                id:     tIssue.id,
                capped: tIssue.priority.maxValue(2),
            })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, least(priority, @0) as capped from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; capped: number }>>>()
        expect(result).toEqual(expected)
    })

    test('minValue-column-vs-column', async () => {
        // Both sides come from `tIssue`, no parameter binding — the
        // SqlBuilder routes the second arg through `_appendSql` rather
        // than `_appendValue`. Seeded `(priority, number)` pairs:
        // (2,1), (1,2), (3,1), (2,1). `.minValue(number)` = floor priority
        // at number → max(priority, number) → 2, 2, 3, 2.
        const expected = [
            { id: 1, atLeastNumber: 2 },
            { id: 2, atLeastNumber: 2 },
            { id: 3, atLeastNumber: 3 },
            { id: 4, atLeastNumber: 2 },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .select({
                id:            tIssue.id,
                atLeastNumber: tIssue.priority.minValue(tIssue.number),
            })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, greatest(priority, number) as atLeastNumber from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number; atLeastNumber: number }>>>()
        expect(result).toEqual(expected)
    })

    test('maxValue-on-nullable-column-keeps-optional', async () => {
        // `assigneeId` is `optionalColumn`. The `_minimumBetweenTwoValues`
        // operator inherits the optional flag from the value source —
        // the TS result type retains the `?` on `capped` even when the
        // runtime values are all non-null.
        //
        // NULL handling in least/greatest differs across dialects, so the
        // WHERE clause filters NULL rows before the operator runs to keep
        // the value assertion stable.
        // The optional flag we lock here is structural — it lives in
        // the TS type and does not depend on the runtime rows.
        // Seeded `(id, assignee_id)` after the filter: (1,1), (2,2), (4,3).
        const expected = [
            { id: 1, capped: 1 },
            { id: 2, capped: 2 },
            { id: 4, capped: 3 },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.assigneeId.isNotNull())
            .select({
                id:     tIssue.id,
                capped: tIssue.assigneeId.maxValue(99),
            })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, case when assignee_id is null then null else least(assignee_id, @0) end as capped from issue where assignee_id is not null order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            99,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; capped?: number }>>>()
        expect(result).toEqual(expected)
    })

    test('minValue-maxValue-null-operand-poisons-to-null', async () => {
        // A NULL operand must POISON the result to NULL — the semantics the library's
        // optional type declares (mergeOptional: optional if EITHER operand is optional,
        // the OR rule add/subtract/concat use). assignee_id is NULL for issue 3, so both
        // `.minValue(5)` (floor at 5, the greater) and `.maxValue(5)` (cap at 5, the
        // lesser) must be NULL there — 5/1, 5/2, NULL/NULL, 5/3 across the four rows.
        // This dialect's native least/greatest ignores a NULL operand, so the builder
        // wraps it in a NULL-poisoning CASE (the snapshot) to honour the declared type.
        const expected = [
            { id: 1, floored: 5,         capped: 1 },
            { id: 2, floored: 5,         capped: 2 },
            { id: 3, floored: undefined, capped: undefined },
            { id: 4, floored: 5,         capped: 3 },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .select({
                id:      tIssue.id,
                floored: tIssue.assigneeId.minValue(5),
                capped:  tIssue.assigneeId.maxValue(5),
            })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, case when assignee_id is null then null else greatest(assignee_id, @0) end as floored, case when assignee_id is null then null else least(assignee_id, @1) end as capped from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            5,
            5,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; floored?: number; capped?: number }>>>()
        expect(result).toEqual(expected)
    })
})
