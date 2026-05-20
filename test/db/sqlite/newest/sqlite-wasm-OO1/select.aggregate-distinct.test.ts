// Coverage of the `DISTINCT` flavour of aggregate functions —
// `sumDistinct` and `averageDistinct` lights up the `_sumDistinct` and
// `_averageDistinct` paths in the dialect builders (the regular
// `count`/`sum`/`average` and `countDistinct` already have coverage in
// select.aggregation.test.ts).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('sum-distinct-priority', async () => {
        ctx.mockNext({ totalPriority: 6 })

        const row = await ctx.conn.selectFromNoTable()
            .select({
                totalPriority: ctx.conn.sumDistinct(
                    ctx.conn.selectFrom(tIssue).selectOneColumn(tIssue.priority)
                        .forUseAsInlineQueryValue(),
                ),
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select sum(distinct (select priority as result from issue)) as totalPriority"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof row, { totalPriority?: number | undefined }>>()
        if (!ctx.realDbEnabled) expect(row.totalPriority).toBe(6)
    })

    test('avg-distinct-from-aggregation-group-by', async () => {
        // averageDistinct over a regular column projection. The mock
        // primes a deterministic numeric value (real-DB averages depend
        // on engine-specific division semantics — int vs double — and
        // are asserted as "number" only).
        const expectedMock = { avgDistinctPriority: 2 }
        ctx.mockNext(expectedMock)

        const row = await ctx.conn.selectFrom(tIssue)
            .select({
                avgDistinctPriority: ctx.conn.averageDistinct(tIssue.priority),
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select avg(distinct priority) as avgDistinctPriority from issue"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof row, { avgDistinctPriority?: number | undefined }>>()
        if (!ctx.realDbEnabled) expect(row.avgDistinctPriority).toBe(2)
        else expect(typeof row.avgDistinctPriority).toBe('number')
    })
})
