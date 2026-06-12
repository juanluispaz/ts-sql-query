// Coverage of `.in([])` / `.notIn([])` short-circuit branches in the
// SQL builders. Most dialects override the abstract path so that an
// empty array produces a constant `false` (for `_in`) or `true`
// (for `_notIn`) — see e.g. `_falseValueForCondition` /
// `_trueValueForCondition` in PostgreSqlSqlBuilder, AbstractMySqlMariaBDSqlBuilder,
// OracleSqlBuilder and SqlServerSqlBuilder. Oracle emits the constant
// predicate, so the query runs and returns the expected rows.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('where-in-empty-array', async () => {
        // Oracle short-circuits an empty `in ([])` to a constant false
        // predicate `(0=1)`, so the query runs and returns no rows.
        const expected: Array<{ id: number }> = []
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.in([]))
            .select({ id: tIssue.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue where (0=1)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(rows).toEqual(expected)
    })

    test('where-not-in-empty-array', async () => {
        // Symmetric to the `in` case: short-circuit to constant true.
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.notIn([]))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue where (1=1) order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(rows).toEqual(expected)
    })
})
