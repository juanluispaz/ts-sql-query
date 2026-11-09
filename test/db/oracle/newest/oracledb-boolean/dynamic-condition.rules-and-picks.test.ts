// A rule of a filter that ends with no conditions, and a group of properties picked as a whole.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { dynamicPick } from '../../../../../src/dynamic/pick.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    const available = () => ({ id: tIssue.id, title: tIssue.title })

    test('a-rule-with-no-conditions-adds-nothing', async () => {
        const rules = {
            withTitle: (rule: { title?: string }) => {
                let result = ctx.conn.dynamicBooleanExpressionUsing(tIssue)
                if (rule.title) {
                    result = result.and(tIssue.title.contains(rule.title))
                }
                return result
            },
        }
        ctx.mockNext([{ id: 1 }])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor(available(), rules).withValues(JSON.parse('{"withTitle":{}}')))
            .and(tIssue.id.equals(1))
            .select({ id: tIssue.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id" from issue where id = :0"`)
        expect(rows).toEqual([{ id: 1 }])
    })

    test('a-group-can-be-picked-with-true', async () => {
        const fields = { id: tIssue.id, content: { title: tIssue.title, status: tIssue.status } }
        ctx.mockNext([{ id: 1, 'content.title': 'x', 'content.status': 'open' }])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select(dynamicPick(fields, { content: true }, ['id']))
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", title as "content.title", status as "content.status" from issue where id = :0"`)
        expect(rows.length).toBe(1)
    })
})
