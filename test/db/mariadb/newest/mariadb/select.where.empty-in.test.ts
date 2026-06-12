// Coverage of `.in([])` / `.notIn([])` short-circuit branches in the
// SQL builders. MariaDB overrides the abstract path so that an empty
// array produces a constant `false` (for `_in`) or `true` (for
// `_notIn`).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('where-in-empty-array', async () => {
        // `in []` short-circuits to a constant false → no rows.
        ctx.mockNext([])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.in([]))
            .select({ id: tIssue.id })
            .executeSelectMany()
        expect(rows).toEqual([])
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where false"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('where-not-in-empty-array', async () => {
        // `not in []` short-circuits to a constant true → all rows.
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.notIn([]))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(rows).toEqual(expected)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where true order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })
})
