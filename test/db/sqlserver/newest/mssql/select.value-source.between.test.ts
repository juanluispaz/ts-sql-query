// Coverage of `.between(lo, hi)` / `.notBetween(lo, hi)` on numeric,
// optional and date value sources — the 3-arg SQL operators that land
// on `AbstractSqlBuilder._between` / `_notBetween`. Both lo/hi sides
// support literal or value-source overloads (4 typed variants each);
// this file exercises the literal-literal, value-value and
// mixed-shape branches so the `_appendValue` vs `_appendSql` routing
// is locked per dialect.
//
// The emitted SQL is uniform across dialects (`<col> between <lo> and
// <hi>`), differing only in identifier quoting and param placeholders.
// No `.between` / `.notBetween` test exists in the suite today, so the
// emitter on every dialect's SqlBuilder is dead code at runtime until
// this file runs.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('between-literal-literal-priority', async () => {
        // Seed priorities (id → priority): 1→2, 2→1, 3→3, 4→2.
        // `.between(2, 3)` matches ids 1, 3, 4.
        const expected = [
            { id: 1, priority: 2 },
            { id: 3, priority: 3 },
            { id: 4, priority: 2 },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.priority.between(2, 3))
            .select({ id: tIssue.id, priority: tIssue.priority })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority as priority from issue where priority between @0 and @1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            3,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; priority: number }>>>()
        expect(result).toEqual(expected)
    })

    test('notBetween-literal-literal-priority', async () => {
        // `.notBetween(2, 3)` matches the rows excluded above: only id=2 (priority=1).
        const expected = [{ id: 2, priority: 1 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.priority.notBetween(2, 3))
            .select({ id: tIssue.id, priority: tIssue.priority })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority as priority from issue where priority not between @0 and @1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            3,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; priority: number }>>>()
        expect(result).toEqual(expected)
    })

    test('between-column-column-no-params', async () => {
        // Both bounds come from `tIssue`, no parameter binding — the
        // SqlBuilder routes each through `_appendSql` rather than
        // `_appendValue`. `priority between number and id`:
        //   id=1: 2 between 1 and 1 → false
        //   id=2: 1 between 2 and 2 → false
        //   id=3: 3 between 1 and 3 → true
        //   id=4: 2 between 1 and 4 → true
        const expected = [
            { id: 3, priority: 3 },
            { id: 4, priority: 2 },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.priority.between(tIssue.number, tIssue.id))
            .select({ id: tIssue.id, priority: tIssue.priority })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority as priority from issue where priority between number and id order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number; priority: number }>>>()
        expect(result).toEqual(expected)
    })

    test('between-mixed-literal-column', async () => {
        // Mixed-shape: literal `lo`, column `hi`. Exercises the
        // overload where the first arg routes through `_appendValue`
        // and the second through `_appendSql`. `priority between 1
        // and number`:
        //   id=1: 2 between 1 and 1 → false
        //   id=2: 1 between 1 and 2 → true
        //   id=3: 3 between 1 and 1 → false
        //   id=4: 2 between 1 and 1 → false
        const expected = [{ id: 2, priority: 1 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.priority.between(1, tIssue.number))
            .select({ id: tIssue.id, priority: tIssue.priority })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority as priority from issue where priority between @0 and number order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; priority: number }>>>()
        expect(result).toEqual(expected)
    })

    test('between-on-nullable-column-keeps-optional', async () => {
        // `assigneeId` is `optionalColumn`. The `_between` operator
        // produces a boolean — NULL on the left in `NULL between …`
        // evaluates to UNKNOWN, which the WHERE clause treats as
        // false. Seeded `(id, assignee_id)`: (1,1), (2,2), (3,null),
        // (4,3). `.between(1, 2)` matches ids 1 and 2 — id=3 (null)
        // is excluded by NULL semantics, id=4 (3) is out of range.
        const expected = [
            { id: 1 },
            { id: 2 },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.assigneeId.between(1, 2))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where assignee_id between @0 and @1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(expected)
    })
})
