// What to pick usually arrives from outside, like a body of a request without that property.
// With nothing to pick, only the mandatory properties are left.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { dynamicPick, dynamicPickPaths } from '../../../../../src/dynamic/pick.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    const available = () => ({ id: tIssue.id, title: tIssue.title })
    const nothing = () => JSON.parse('null')

    test('dynamic-pick-without-picks', async () => {
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select(dynamicPick(available(), nothing(), ['id']))
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where id = ?1"`)
        expect(rows).toEqual(expected)
    })

    test('dynamic-pick-paths-without-picks', async () => {
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select(dynamicPickPaths(available(), nothing(), ['id']))
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where id = ?1"`)
        expect(rows).toEqual(expected)
    })
})
