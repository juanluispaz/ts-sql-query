// Coverage of `.in([])` / `.notIn([])` short-circuit branches. On SQL
// Server an empty array produces a constant `(0=1)` (for `in`) or
// `(1=1)` (for `notIn`) predicate, so the query runs unconditionally.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('where-in-empty-array', async () => {
        // SQL Server emits a constant false predicate `(0=1)` for an
        // empty `in (...)`.
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.in([]))
            .select({ id: tIssue.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where (0=1)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
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
        expect(rows).toEqual(expected)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where (1=1) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })
})
