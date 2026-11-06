// Properties of the values that aren't columns don't count as something to update.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('update-left-only-with-other-properties-sends-no-query', async () => {
        const body = { notAColumn: 'x', title: 'y' }
        const affected = await ctx.conn.update(tIssue)
            .set(body)
            .ignoreIfSet('title')
            .where(tIssue.id.equals(1))
            .executeUpdate()
        expect(affected).toBe(0)
    })

    test('update-with-other-properties-and-a-column-is-sent', async () => {
        const body = { notAColumn: 'x', title: 'y' }
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.update(tIssue)
                .set(body)
                .where(tIssue.id.equals(1))
                .executeUpdate()
            expect(affected).toBe(1)
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set title = @0 where id = @1"`)
        })
    })
})
