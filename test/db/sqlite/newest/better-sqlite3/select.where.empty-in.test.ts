// Coverage of `.in([])` / `.notIn([])` short-circuit branches in the
// SQL builders. Most dialects override the abstract path so that an
// empty array produces a constant `false` (for `_in`) or `true`
// (for `_notIn`) — see e.g. `_falseValueForCondition` /
// `_trueValueForCondition` in PostgreSqlSqlBuilder, AbstractMySqlMariaBDSqlBuilder,
// OracleSqlBuilder and SqlServerSqlBuilder. SQLite does NOT override,
// so the abstract path emits a non-portable `id in ()` instead of a
// constant predicate. The `executeSelectMany()` is wrapped in
// try/catch defensively (no current SQLite engine rejects the empty
// list — bun:sqlite 3.51 / sqlite3 npm 3.52 both accept it — but the
// emission is still inconsistent with every other dialect).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('where-in-empty-array', async () => {
        // SQLite emits a non-portable `id in ()` instead of the
        // constant `where false` the other dialects produce. See
        // file header.
        ctx.mockNext([])
        try {
            await ctx.conn.selectFrom(tIssue)
                .where(tIssue.id.in([]))
                .select({ id: tIssue.id })
                .executeSelectMany()
        } catch (e) {
            if (!ctx.realDbEnabled) throw e
        }
        // TODO[BUG] expected `where false` (consistency: other dialects short-circuit empty `in`).
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where id in ()"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('where-not-in-empty-array', async () => {
        // Symmetric to the `in` case: other dialects short-circuit
        // to a constant true predicate.
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)
        try {
            const rows = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.id.notIn([]))
                .select({ id: tIssue.id })
                .orderBy('id')
                .executeSelectMany()
            if (!ctx.realDbEnabled) {
                expect(rows).toEqual(expected)
            }
        } catch (e) {
            if (!ctx.realDbEnabled) throw e
        }
        // TODO[BUG] expected `where true` (consistency: other dialects short-circuit empty `not in`).
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where id not in () order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })
})
