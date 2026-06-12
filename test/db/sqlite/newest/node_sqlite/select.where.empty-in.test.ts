// Coverage of `.in([])` / `.notIn([])` short-circuit branches in the
// SQL builders. Every dialect overrides the abstract path so that an
// empty array produces a constant `false` (for `_in`) or `true`
// (for `_notIn`) — see `_falseValueForCondition` /
// `_trueValueForCondition` in PostgreSqlSqlBuilder, AbstractMySqlMariaBDSqlBuilder,
// OracleSqlBuilder, SqlServerSqlBuilder and SqliteSqlBuilder. On
// SQLite the constants are emitted as `0` / `1`.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('where-in-empty-array', async () => {
        // Short-circuits to the false constant — matches every other dialect.
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.in([]))
            .select({ id: tIssue.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where 0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('where-not-in-empty-array', async () => {
        // Symmetric to the `in` case: short-circuits to the true constant.
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.notIn([]))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(rows).toEqual(expected)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where 1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })
})
