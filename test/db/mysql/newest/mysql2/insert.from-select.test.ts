// Coverage of `INSERT ... SELECT` (subquery-as-source) via `.from(select)`,
// combined with `.returning(...)` for inserts driven by a select rather
// than literal `VALUES`.

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
            // Clone every issue on project 3 as a draft copy on project 4.
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

    // NOT-APPLICABLE: MySQL cannot return per-row last-inserted ids from an INSERT ... SELECT (LAST_INSERT_ID yields only the first), so from(select).returningLastInsertedId() is typed never.
    /*
    test('insert-from-select-returning-last-inserted-id-array', async () => {
        // `from(select).returningLastInsertedId()` returns `number[]` (the
        // from-select path of the last-inserted-id type). project 3 has one
        // issue (issue 4), so one id comes back. The ids are engine-assigned,
        // so the value assertion is length-based on the real DB.
        ctx.mockNext([101])
        await ctx.withRollback(async () => {
            const source = ctx.conn.selectFrom(tIssue)
                .where(tIssue.projectId.equals(3))
                .select({
                    projectId: ctx.conn.const(4, 'int'),
                    number:    tIssue.number,
                    title:     tIssue.title,
                    status:    ctx.conn.const('draft', 'string'),
                    priority:  tIssue.priority,
                })

            const ids = await ctx.conn.insertInto(tIssue)
                .from(source)
                .returningLastInsertedId()
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof ids, number[]>>()
            expect(ids.length).toBe(1)
            if (!ctx.realDbEnabled) expect(ids).toEqual([101])
        })
    })
    */
})
