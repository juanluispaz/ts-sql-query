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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select sum(distinct priority) as totalPriority from issue"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof row, { totalPriority?: number | undefined }>>()
        expect(row.totalPriority).toBe(6)
    })


    test('avg-distinct-from-aggregation-group-by', async () => {
        // averageDistinct over an integer column. The library promotes
        // the result type from `int` → `double` (see
        // [src/connections/AbstractConnection.ts:998](../src/connections/AbstractConnection.ts#L998))
        // so engines that return a fractional `numeric`/`decimal` scalar
        // for `AVG(int)` deserialise without tripping the int parser.
        const expectedMock = { avgDistinctPriority: 2 }
        ctx.mockNext(expectedMock)


        const row = await ctx.conn.selectFrom(tIssue)
            .select({
                avgDistinctPriority: ctx.conn.averageDistinct(tIssue.priority),
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select avg(distinct cast(priority as float)) as avgDistinctPriority from issue"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof row, { avgDistinctPriority?: number | undefined }>>()
        if (!ctx.realDbEnabled) expect(row.avgDistinctPriority).toBe(2)
        else expect(typeof row.avgDistinctPriority).toBe('number')
    })

    test('avg-distinct-int-column-fractional', async () => {
        // Verifies the cross-dialect contract that `average(intCol)` never
        // returns a truncated integer when the operand is an INTEGER column —
        // it always returns the fractional `number` the math says it should.
        // Issues 1 and 2 belong to project 1 with priorities {2, 1}; the
        // average is 1.5 on every supported engine. SQL Server's native
        // `AVG(int)` would truncate the result to 1, so the SqlServerSqlBuilder
        // wraps the operand in `cast(<expr> as float)` (see
        // [src/sqlBuilders/SqlServerSqlBuilder.ts](../../../../../src/sqlBuilders/SqlServerSqlBuilder.ts)
        // `_average`); every other dialect produces the fractional result
        // natively.
        ctx.mockNext({ avgPriority: 1.5 })

        const row = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .select({
                avgPriority: ctx.conn.averageDistinct(tIssue.priority),
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select avg(distinct cast(priority as float)) as avgPriority from issue where project_id = @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { avgPriority?: number | undefined }>>()
        expect(row.avgPriority).toBe(1.5)
    })

})
