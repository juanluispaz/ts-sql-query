// Behavioral coverage of aggregation: countAll / count / countDistinct /
// sum / average / min / max, with and without GROUP BY, with HAVING.
//
// sum / average / min / max return `optional` because an empty set
// aggregates to NULL.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('count-star', async () => {
        ctx.mockNext({ total: 4 })
        const result = await ctx.conn.selectFrom(tIssue)
            .select({ total: ctx.conn.countAll() })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select count(*) as total from issue"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, { total: number }>>()
        expect(result.total).toBe(4)
    })

    test('count-distinct-status', async () => {
        ctx.mockNext({ statuses: 3 })
        const result = await ctx.conn.selectFrom(tIssue)
            .select({ statuses: ctx.conn.countDistinct(tIssue.status) })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select count(distinct status) as statuses from issue"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, { statuses: number }>>()
        expect(result.statuses).toBe(3)
    })

    test('sum-priority', async () => {
        ctx.mockNext({ totalPriority: 8 })
        const result = await ctx.conn.selectFrom(tIssue)
            .select({ totalPriority: ctx.conn.sum(tIssue.priority) })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select sum(priority) as totalPriority from issue"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        // sum is optional — empty set aggregates to NULL. The library
        // surfaces this as `key?: T | undefined`, distinct from the plain
        // `key?: T` shape produced for scalar inline subqueries.
        assertType<Exact<typeof result, { totalPriority?: number | undefined }>>()
        expect(result.totalPriority).toBe(8)
    })

    test('min-max-priority', async () => {
        ctx.mockNext({ lo: 1, hi: 3 })
        const result = await ctx.conn.selectFrom(tIssue)
            .select({
                lo: ctx.conn.min(tIssue.priority),
                hi: ctx.conn.max(tIssue.priority),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select min(priority) as lo, max(priority) as hi from issue"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, {
            lo?: number | undefined
            hi?: number | undefined
        }>>()
        expect(result).toEqual({ lo: 1, hi: 3 })
    })

    test('group-by-with-having', async () => {
        const expected = [
            { status: 'open', total: 2 },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .select({
                status: tIssue.status,
                total:  ctx.conn.count(tIssue.id),
            })
            .groupBy('status')
            .having(ctx.conn.count(tIssue.id).greaterThan(1))
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
})
