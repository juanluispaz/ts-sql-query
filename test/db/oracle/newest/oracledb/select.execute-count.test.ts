// `executeSelectPage()` emits a count query alongside the data query.
// With DISTINCT or GROUP BY it can't use a plain `count(*)`, so it wraps
// the data query (minus LIMIT/OFFSET) in a `result_for_count` CTE and
// counts that. This file pins the wrap path for distinct, groupBy, and
// both together, plus the JOINed fast path that takes the else-branch and
// stays unwrapped. (The join-free `count(*)` fast path is covered by
// docs.select-page.test.ts.)

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('count-after-distinct-wraps-query-in-result-for-count-cte', async () => {
        // DISTINCT triggers the CTE-wrap even without GROUP BY.
        ctx.mockNext([{ status: 'open' }, { status: 'closed' }])
        ctx.mockNext(3)

        const page = await ctx.conn.selectDistinctFrom(tIssue)
            .select({ status: tIssue.status })
            .orderBy('status')
            .limit(10)
            .offset(0)
            .executeSelectPage()

        expect(ctx.history.length).toBe(2)
        expect(ctx.history[0]!.sql).toMatchInlineSnapshot(`"select distinct status as "status" from issue order by "status" offset :0 rows fetch next :1 rows only"`)
        expect(ctx.history[0]!.params).toMatchInlineSnapshot(`
          [
            0,
            10,
          ]
        `)
        expect(ctx.history[1]!.sql).toMatchInlineSnapshot(`"with result_for_count as (select distinct status as status from issue) select count(*) from result_for_count"`)
        expect(ctx.history[1]!.params).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof page, {
            data:  Array<{ status: string }>
            count: number
        }>>()
        // 3 distinct statuses in the seed: open, in_progress, closed.
        expect(page.count).toBe(3)
    })

    test('count-after-group-by-wraps-query-in-result-for-count-cte', async () => {
        // GROUP BY triggers the CTE-wrap; the outer count(*) totals the
        // groups, not the rows.
        ctx.mockNext([
            { status: 'open',   total: 3 },
            { status: 'closed', total: 4 },
        ])
        ctx.mockNext(3)

        const page = await ctx.conn.selectFrom(tIssue)
            .select({
                status: tIssue.status,
                total:  ctx.conn.count(tIssue.id),
            })
            .groupBy('status')
            .orderBy('status')
            .limit(10)
            .offset(0)
            .executeSelectPage()

        expect(ctx.history.length).toBe(2)
        expect(ctx.history[0]!.sql).toMatchInlineSnapshot(`"select status as "status", count(id) as "total" from issue group by status order by "status" offset :0 rows fetch next :1 rows only"`)
        expect(ctx.history[0]!.params).toMatchInlineSnapshot(`
          [
            0,
            10,
          ]
        `)
        expect(ctx.history[1]!.sql).toMatchInlineSnapshot(`"with result_for_count as (select status as status, count(id) as total from issue group by status) select count(*) from result_for_count"`)
        expect(ctx.history[1]!.params).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof page, {
            data:  Array<{ status: string; total: number }>
            count: number
        }>>()
        // 3 status groups: open, in_progress, closed.
        expect(page.count).toBe(3)
    })

    test('count-after-distinct-and-group-by-still-wraps-in-cte', async () => {
        // DISTINCT and GROUP BY together still wrap once.
        ctx.mockNext([
            { status: 'open',   priority: 1 },
            { status: 'closed', priority: 2 },
        ])
        ctx.mockNext(4)

        const page = await ctx.conn.selectDistinctFrom(tIssue)
            .select({
                status:   tIssue.status,
                priority: tIssue.priority,
            })
            .groupBy('status', 'priority')
            .orderBy('status')
            .limit(10)
            .offset(0)
            .executeSelectPage()

        expect(ctx.history.length).toBe(2)
        expect(ctx.history[0]!.sql).toMatchInlineSnapshot(`"select distinct status as "status", priority as "priority" from issue group by status, priority order by "status" offset :0 rows fetch next :1 rows only"`)
        expect(ctx.history[0]!.params).toMatchInlineSnapshot(`
          [
            0,
            10,
          ]
        `)
        expect(ctx.history[1]!.sql).toMatchInlineSnapshot(`"with result_for_count as (select distinct status as status, priority as priority from issue group by status, priority) select count(*) from result_for_count"`)
        expect(ctx.history[1]!.params).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof page, {
            data:  Array<{ status: string; priority: number }>
            count: number
        }>>()
        // 4 distinct (status, priority) combinations in the seed.
        expect(page.count).toBe(4)
    })

    test('count-over-inner-join-uses-unwrapped-fast-path', async () => {
        // Without DISTINCT / GROUP BY / customization the count takes the
        // fast path: no `result_for_count` wrap, a plain `count(*)` over the
        // same FROM. The JOIN and the WHERE are RETAINED (they select which
        // rows are counted); only the paging is dropped. Ordering is by
        // `title` — unique in the seed — so the page rows are deterministic.
        ctx.mockNext([
            { id: 3, title: 'Document /v2/users' },
            { id: 2, title: 'Migrate to ESM' },
            { id: 1, title: 'Redesign navbar' },
            { id: 1, title: 'Update hero copy' },
        ])
        ctx.mockNext(4)

        const page = await ctx.conn.selectFrom(tProject)
            .innerJoin(tIssue).on(tIssue.projectId.equals(tProject.id))
            .where(tProject.id.greaterThan(0))
            .select({
                id:    tProject.id,
                title: tIssue.title,
            })
            .orderBy('title')
            .limit(10)
            .offset(0)
            .executeSelectPage()

        expect(ctx.history.length).toBe(2)
        expect(ctx.history[0]!.sql).toMatchInlineSnapshot(`"select project.id as "id", issue.title as "title" from project inner join issue on issue.project_id = project.id where project.id > :0 order by "title" offset :1 rows fetch next :2 rows only"`)
        expect(ctx.history[0]!.params).toMatchInlineSnapshot(`
          [
            0,
            0,
            10,
          ]
        `)
        expect(ctx.history[1]!.sql).toMatchInlineSnapshot(`"select count(*) from project inner join issue on issue.project_id = project.id where project.id > :0"`)
        expect(ctx.history[1]!.params).toMatchInlineSnapshot(`
          [
            0,
          ]
        `)
        assertType<Exact<typeof page, {
            data:  Array<{ id: number; title: string }>
            count: number
        }>>()
        // The inner join drops project 4 (no issues) and keeps one row per
        // issue: 4 issues over projects 1, 1, 2, 3.
        expect(page.count).toBe(4)
        expect(page.data.map((r) => r.title)).toEqual([
            'Document /v2/users',
            'Migrate to ESM',
            'Redesign navbar',
            'Update hero copy',
        ])
    })

    test('count-over-left-join-counts-unmatched-rows', async () => {
        // Same unwrapped fast path as the inner-join sibling, but a LEFT join
        // keeps project 4 (which has no issues) as a single NULL-extended row,
        // so the count is 5 rather than 4 — the count follows the join
        // semantics of the data query rather than counting the FROM table.
        ctx.mockNext([
            { id: 3, title: 'Document /v2/users' },
            { id: 4 },
            { id: 2, title: 'Migrate to ESM' },
            { id: 1, title: 'Redesign navbar' },
            { id: 1, title: 'Update hero copy' },
        ])
        ctx.mockNext(5)

        // The joined table must be marked `forUseInLeftJoin()` for its leaves
        // to carry the join's own nullability.
        const issueLJ = tIssue.forUseInLeftJoin()

        const page = await ctx.conn.selectFrom(tProject)
            .leftJoin(issueLJ).on(issueLJ.projectId.equals(tProject.id))
            .where(tProject.id.greaterThan(0))
            .select({
                id:    tProject.id,
                title: issueLJ.title,
            })
            .orderBy('title')
            .limit(10)
            .offset(0)
            .executeSelectPage()

        expect(ctx.history.length).toBe(2)
        expect(ctx.history[0]!.sql).toMatchInlineSnapshot(`"select project.id as "id", issue.title as "title" from project left join issue on issue.project_id = project.id where project.id > :0 order by "title" offset :1 rows fetch next :2 rows only"`)
        expect(ctx.history[0]!.params).toMatchInlineSnapshot(`
          [
            0,
            0,
            10,
          ]
        `)
        expect(ctx.history[1]!.sql).toMatchInlineSnapshot(`"select count(*) from project left join issue on issue.project_id = project.id where project.id > :0"`)
        expect(ctx.history[1]!.params).toMatchInlineSnapshot(`
          [
            0,
          ]
        `)
        assertType<Exact<typeof page, {
            data:  Array<{ id: number; title?: string }>
            count: number
        }>>()
        expect(page.count).toBe(5)
        // Project 4 contributes a row whose `title` leaf is absent.
        expect(page.data.filter((r) => r.title === undefined)).toEqual([{ id: 4 }])
    })
})
