// `executeSelectPage()` emits a count query alongside the data query.
// With DISTINCT or GROUP BY it can't use a plain `count(*)`, so it wraps
// the data query (minus LIMIT/OFFSET) in a `result_for_count` CTE and
// counts that. This file pins the wrap path for distinct, groupBy, and
// both together. (The plain `count(*)` fast path is covered by
// docs.select-page.test.ts.)

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
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
        expect(ctx.history[0]!.sql).toMatchInlineSnapshot(`"select distinct status as status from issue order by status limit $1 offset $2"`)
        expect(ctx.history[0]!.params).toMatchInlineSnapshot(`
          [
            10,
            0,
          ]
        `)
        expect(ctx.history[1]!.sql).toMatchInlineSnapshot(`"with result_for_count as (select distinct status as status from issue order by status) select count(*) from result_for_count"`)
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
        expect(ctx.history[0]!.sql).toMatchInlineSnapshot(`"select status as status, count(id) as total from issue group by status order by status limit $1 offset $2"`)
        expect(ctx.history[0]!.params).toMatchInlineSnapshot(`
          [
            10,
            0,
          ]
        `)
        expect(ctx.history[1]!.sql).toMatchInlineSnapshot(`"with result_for_count as (select status as status, count(id) as total from issue group by status order by status) select count(*) from result_for_count"`)
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
        expect(ctx.history[0]!.sql).toMatchInlineSnapshot(`"select distinct status as status, priority as priority from issue group by status, priority order by status limit $1 offset $2"`)
        expect(ctx.history[0]!.params).toMatchInlineSnapshot(`
          [
            10,
            0,
          ]
        `)
        expect(ctx.history[1]!.sql).toMatchInlineSnapshot(`"with result_for_count as (select distinct status as status, priority as priority from issue group by status, priority order by status) select count(*) from result_for_count"`)
        expect(ctx.history[1]!.params).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof page, {
            data:  Array<{ status: string; priority: number }>
            count: number
        }>>()
        // 4 distinct (status, priority) combinations in the seed.
        expect(page.count).toBe(4)
    })
})
