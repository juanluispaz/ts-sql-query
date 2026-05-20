// Coverage of `INSERT ... SELECT` (subquery-as-source) — `.from(select)`
// path through `_buildInsertFromSelect`. MySQL has no `RETURNING`, so
// this cell drops the returning clause and asserts the affected-row
// count instead. The other dialects carry the returning variant.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('insert-from-select-with-returning', async () => {
        ctx.mockNext(2)

        await ctx.withRollback(async () => {
            // Clone every issue on project 1 as a draft copy on project 2.
            const source = ctx.conn.selectFrom(tIssue)
                .where(tIssue.projectId.equals(3))
                .select({
                    projectId: ctx.conn.const(4, 'int'),
                    number:    tIssue.number,
                    title:     tIssue.title,
                    status:    ctx.conn.const('draft', 'string'),
                    priority:  tIssue.priority,
                })

            const affected = await ctx.conn.insertInto(tIssue)
                .from(source)
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, \`number\`, title, \`status\`, priority) select ? as projectId, \`number\` as \`number\`, title as title, ? as \`status\`, priority as priority from issue where project_id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                4,
                "draft",
                3,
              ]
            `)
            assertType<Exact<typeof affected, number>>()

            if (!ctx.realDbEnabled) expect(affected).toBe(2)
            else expect(typeof affected).toBe('number')
        })
    })
})
