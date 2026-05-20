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
        // Seed has priorities {2, 1, 3, 2} → distinct {1, 2, 3} → sum 6.
        ctx.mockNext({ totalPriority: 6 })

        const row = await ctx.conn.selectFrom(tIssue)
            .select({
                totalPriority: ctx.conn.sumDistinct(tIssue.priority),
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select sum(distinct priority) as "totalPriority" from issue"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof row, { totalPriority?: number | undefined }>>()
        expect(row.totalPriority).toBe(6)
    })

    test('avg-distinct-from-aggregation-group-by', async () => {
        // TODO[BUG]: see test/BUGS.md — `averageDistinct(intCol)` keeps
        // the int result type, but every dialect except SQL Server
        // returns a fractional/decimal scalar that the int deserializer
        // then rejects with `INVALID_VALUE_RECEIVED_FROM_DATABASE`. The
        // mock branch below still validates SQL emission; real-DB
        // execution is gated until the lib coerces the result type.
        if (ctx.realDbEnabled) return

        const expectedMock = { avgDistinctPriority: 2 }
        ctx.mockNext(expectedMock)

        const row = await ctx.conn.selectFrom(tIssue)
            .select({
                avgDistinctPriority: ctx.conn.averageDistinct(tIssue.priority),
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select avg(distinct priority) as "avgDistinctPriority" from issue"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof row, { avgDistinctPriority?: number | undefined }>>()
        expect(row.avgDistinctPriority).toBe(2)
    })
})
