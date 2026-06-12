// `executeSelectPage()` always invokes
// [SelectQueryBuilder.__buildSelectCount](../../../../../src/queryBuilders/SelectQueryBuilder.ts#L665-L713)
// to produce the unpaginated count. Two emission shapes:
//
//   - **Fast path** (no `DISTINCT`, no `GROUP BY`): emits a plain
//     `select count(*) from t [where ...]` — already pinned by
//     `docs.select-page.test.ts` `docs:select-page/projects-paginated`.
//   - **CTE-wrap path** (`__distinct || __groupBy.length > 0`):
//     [SelectQueryBuilder.ts:671-694](../../../../../src/queryBuilders/SelectQueryBuilder.ts#L671-L694)
//     copies the SELECT data, drops LIMIT/OFFSET, then wraps the result
//     into a `WithViewImpl` (`result_for_count`) and counts the CTE.
//     This file pins the wrap path for the three triggers it has
//     (`distinct`, `groupBy`, and the combination of both).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('count-after-distinct-wraps-query-in-result-for-count-cte', async () => {
        // `selectDistinctFrom(tIssue)` sets `__distinct = true`, so the
        // count emission goes through the CTE-wrap branch even though
        // there's no GROUP BY. The inner CTE keeps the SELECT columns
        // (no LIMIT / OFFSET) and the outer query is `select count(*) from result_for_count`.
        ctx.mockNext([{ status: 'open' }, { status: 'closed' }])
        ctx.mockNext(3)

        const page = await ctx.conn.selectDistinctFrom(tIssue)
            .select({ status: tIssue.status })
            .orderBy('status')
            .limit(10)
            .offset(0)
            .executeSelectPage()

        expect(ctx.history.length).toBe(2)
        expect(ctx.history[0]!.sql).toMatchInlineSnapshot(`"select distinct \`status\` as \`status\` from issue order by \`status\` limit ? offset ?"`)
        expect(ctx.history[0]!.params).toMatchInlineSnapshot(`
          [
            10,
            0,
          ]
        `)
        expect(ctx.history[1]!.sql).toMatchInlineSnapshot(`"with result_for_count as (select distinct \`status\` as \`status\` from issue order by \`status\`) select count(*) from result_for_count"`)
        expect(ctx.history[1]!.params).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof page, {
            data:  Array<{ status: string }>
            count: number
        }>>()
        expect(page.count).toBe(3)
    })

    test('count-after-group-by-wraps-query-in-result-for-count-cte', async () => {
        // `.groupBy('status')` makes `__groupBy.length > 0`, so the
        // count emission goes through the CTE-wrap branch. The inner
        // CTE keeps the aggregate projection (count(id)) and the outer
        // count(*) totals the number of distinct groups, not rows.
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
        expect(ctx.history[0]!.sql).toMatchInlineSnapshot(`"select \`status\` as \`status\`, count(id) as total from issue group by \`status\` order by \`status\` limit ? offset ?"`)
        expect(ctx.history[0]!.params).toMatchInlineSnapshot(`
          [
            10,
            0,
          ]
        `)
        expect(ctx.history[1]!.sql).toMatchInlineSnapshot(`"with result_for_count as (select \`status\` as \`status\`, count(id) as total from issue group by \`status\` order by \`status\`) select count(*) from result_for_count"`)
        expect(ctx.history[1]!.params).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof page, {
            data:  Array<{ status: string; total: number }>
            count: number
        }>>()
        expect(page.count).toBe(3)
    })

    test('count-after-distinct-and-group-by-still-wraps-in-cte', async () => {
        // Both `__distinct` AND `__groupBy.length > 0` — the wrap
        // happens for either trigger; this pin asserts the
        // combination doesn't double-wrap or otherwise misbehave.
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
        expect(ctx.history[0]!.sql).toMatchInlineSnapshot(`"select distinct \`status\` as \`status\`, priority as priority from issue group by \`status\`, priority order by \`status\` limit ? offset ?"`)
        expect(ctx.history[0]!.params).toMatchInlineSnapshot(`
          [
            10,
            0,
          ]
        `)
        expect(ctx.history[1]!.sql).toMatchInlineSnapshot(`"with result_for_count as (select distinct \`status\` as \`status\`, priority as priority from issue group by \`status\`, priority order by \`status\`) select count(*) from result_for_count"`)
        expect(ctx.history[1]!.params).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof page, {
            data:  Array<{ status: string; priority: number }>
            count: number
        }>>()
        expect(page.count).toBe(4)
    })
})
