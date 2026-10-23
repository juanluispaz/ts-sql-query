// `HAVING` chains and `dynamicHaving()`:
//   1. `.having(c1).and(c2).or(c3)` — chaining `.and()` / `.or()` on a
//      committed HAVING predicate.
//   2. `.dynamicHaving()` followed by `.and(...)` — builds the HAVING
//      expression incrementally (twin of `dynamicWhere`).
//   3. `.dynamicHaving()` with no `.and(...)` follow-up — the HAVING
//      keyword is elided entirely.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('having-and-then-or-chains-after-initial-having', async () => {
        // `.having(c1).and(c2).or(c3)` composes `(c1 AND c2) OR c3`.
        // Per status group: closed→count 1 (max priority 2), in_progress→1
        // (max 1), open→2 (max 3). (count>0 AND count<10) is true for all
        // three, so every group survives; ordered by status.
        const expected = [
            { status: 'closed',      total: 1 },
            { status: 'in_progress', total: 1 },
            { status: 'open',        total: 2 },
        ]
        ctx.mockNext(expected)

        const result = await ctx.conn.selectFrom(tIssue)
            .select({
                status: tIssue.status,
                total:  ctx.conn.count(tIssue.id),
            })
            .groupBy('status')
            .having(ctx.conn.count(tIssue.id).greaterThan(0))
                .and(ctx.conn.count(tIssue.id).lessThan(10))
                .or(ctx.conn.max(tIssue.priority).equals(3))
            .orderBy('status')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select status as status, count(id) as total from issue group by status having (count(id) > ? and count(id) < ?) or max(priority) = ? order by status"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0,
            10,
            3,
          ]
        `)
        assertType<Exact<typeof result, Array<{ status: string; total: number }>>>()
        expect(result).toEqual(expected)
    })

    test('dynamic-having-then-and-emits-having-clause', async () => {
        // `.dynamicHaving()` opens a HAVING without committing a predicate;
        // the subsequent `.and(cond)` builds it. Only the open status group
        // has count > 1.
        const expected = [{ status: 'open', total: 2 }]
        ctx.mockNext(expected)

        const result = await ctx.conn.selectFrom(tIssue)
            .select({
                status: tIssue.status,
                total:  ctx.conn.count(tIssue.id),
            })
            .groupBy('status')
            .dynamicHaving()
                .and(ctx.conn.count(tIssue.id).greaterThan(1))
            .orderBy('status')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select status as status, count(id) as total from issue group by status having count(id) > ? order by status"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ status: string; total: number }>>>()
        if (!ctx.realDbEnabled) expect(result).toEqual(expected)
        else expect(result).toEqual(expected)
    })

    test('dynamic-having-with-no-conditions-emits-no-having-clause', async () => {
        // `.dynamicHaving()` followed by no `.and(...)` — the HAVING
        // slot stays empty; the builder MUST elide the `HAVING` keyword
        // entirely (twin of `dynamicWhere()` with no condition).
        const expected = [
            { status: 'closed',      total: 1 },
            { status: 'in_progress', total: 1 },
            { status: 'open',        total: 2 },
        ]
        ctx.mockNext(expected)

        const result = await ctx.conn.selectFrom(tIssue)
            .select({
                status: tIssue.status,
                total:  ctx.conn.count(tIssue.id),
            })
            .groupBy('status')
            .dynamicHaving()
            .orderBy('status')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select status as status, count(id) as total from issue group by status order by status"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ status: string; total: number }>>>()
        if (!ctx.realDbEnabled) expect(result).toEqual(expected)
        else expect(result).toEqual(expected)
    })

    test('dynamic-having-then-or-seeds-having-clause', async () => {
        // The `.or(...)` SEEDING arm of `dynamicHaving()`: an empty HAVING opened by
        // `dynamicHaving()` is seeded by the FIRST `.or(cond)` (the `.and(cond)` seeding
        // arm and the no-condition elision are covered above). On an empty predicate the
        // seeding `.or(...)` renders the bare condition. Only the open status group has
        // count > 1.
        const expected = [{ status: 'open', total: 2 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .select({ status: tIssue.status, total: ctx.conn.count(tIssue.id) })
            .groupBy('status')
            .dynamicHaving()
                .or(ctx.conn.count(tIssue.id).greaterThan(1))
            .orderBy('status')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select status as status, count(id) as total from issue group by status having count(id) > ? order by status"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ status: string; total: number }>>>()
        expect(result).toEqual(expected)
    })

    test('group-by-having-then-select-one-column', async () => {
        // `groupBy(vs).having(cond)` chained BEFORE `selectOneColumn(...)` — the form where
        // the select clause comes last. Per status group the count is closed→1, in_progress→1,
        // open→2; `having(count > 1)` keeps only the open group, so the single scalar column
        // (the group count) comes back as [2].
        const expected = [2]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .groupBy(tIssue.status)
            .having(ctx.conn.count(tIssue.id).greaterThan(1))
            .selectOneColumn(ctx.conn.count(tIssue.id))
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select count(id) as result from issue group by status having count(id) > ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<number>>>()
        expect(result).toEqual(expected)
    })

    test('group-by-having-then-select-count-all', async () => {
        // `groupBy(vs).having(cond)` chained BEFORE `selectCountAll()` (select clause last),
        // which projects the per-group `count(*)`. `having(count(id) > 1)` keeps only the open
        // status group (2 issues), so its `count(*)` row is [2].
        const expected = [2]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .groupBy(tIssue.status)
            .having(ctx.conn.count(tIssue.id).greaterThan(1))
            .selectCountAll()
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select count(*) as result from issue group by status having count(id) > ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<number>>>()
        expect(result).toEqual(expected)
    })

    test('having-with-aggregate-arithmetic-expression', async () => {
        // A HAVING predicate built from an aggregate ARITHMETIC EXPRESSION:
        // `having(count(id).multiply(2).greaterThan(6))` — i.e. keep groups
        // whose doubled row count exceeds 6 (count > 3). Grouping the four
        // issues by project gives counts project 1 → 2, project 2 → 1,
        // project 3 → 1; the largest doubled count is 4, so no group survives
        // and the result is empty. This still pins the aggregate-arithmetic
        // emission in HAVING and that the predicate genuinely filters (the
        // empty array is the true answer on a real DB too).
        const expected: Array<{ projectId: number; total: number }> = []
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .select({
                projectId: tIssue.projectId,
                total:     ctx.conn.count(tIssue.id),
            })
            .groupBy('projectId')
            .having(ctx.conn.count(tIssue.id).multiply(2).greaterThan(6))
            .orderBy('projectId')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as projectId, count(id) as total from issue group by project_id having (count(id) * ?) > ? order by projectId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            6,
          ]
        `)
        assertType<Exact<typeof result, Array<{ projectId: number; total: number }>>>()
        expect(result).toEqual(expected)
    })
    test('having-over-sum-average-min-aggregates', async () => {
        // HAVING predicates over `sum` / `average` / `min` (only `count` / `max`
        // are exercised in a HAVING elsewhere). Grouping the four issues by
        // project, the priority stats are project 1 {2,1}: sum 3, avg 1.5,
        // min 1; project 2 {3}: sum 3, avg 3, min 3; project 3 {2}: sum 2,
        // avg 2, min 2. The AND-chained predicate
        // `sum >= 3 AND avg > 1.5 AND min >= 2` is satisfied only by project 2
        // (project 1 fails the avg bound, project 3 fails the sum bound), whose
        // group count is 1.
        const expected = [{ projectId: 2, total: 1 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .select({
                projectId: tIssue.projectId,
                total:     ctx.conn.count(tIssue.id),
            })
            .groupBy('projectId')
            .having(ctx.conn.sum(tIssue.priority).greaterOrEqual(3))
                .and(ctx.conn.average(tIssue.priority).greaterThan(1.5))
                .and(ctx.conn.min(tIssue.priority).greaterOrEqual(2))
            .orderBy('projectId')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as projectId, count(id) as total from issue group by project_id having sum(priority) >= ? and avg(cast(priority as double)) > ? and min(priority) >= ? order by projectId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
            1.5,
            2,
          ]
        `)
        assertType<Exact<typeof result, Array<{ projectId: number; total: number }>>>()
        expect(result).toEqual(expected)
    })
    test('having-over-string-concat-aggregate', async () => {
        // A HAVING predicate over the `stringConcat` aggregate. Grouping the
        // four issues by project, the concatenated statuses are project 1
        // {open, in_progress}, project 2 {open}, project 3 {closed}. The
        // predicate `stringConcat(status).contains('open')` keeps projects 1
        // and 2 and drops project 3 ('closed' has no 'open' substring); the
        // containment test is order-independent, so the engine-defined
        // aggregation order does not affect the result. Group counts are
        // project 1 → 2, project 2 → 1.
        const expected = [
            { projectId: 1, total: 2 },
            { projectId: 2, total: 1 },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .select({
                projectId: tIssue.projectId,
                total:     ctx.conn.count(tIssue.id),
            })
            .groupBy('projectId')
            .having(ctx.conn.stringConcat(tIssue.status).contains('open'))
            .orderBy('projectId')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as projectId, count(id) as total from issue group by project_id having group_concat(status) like concat('%', ?, '%') order by projectId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
          ]
        `)
        assertType<Exact<typeof result, Array<{ projectId: number; total: number }>>>()
        expect(result).toEqual(expected)
    })
})
