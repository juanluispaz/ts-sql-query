// Coverage of `INSERT ... SELECT` (subquery-as-source) — `.from(select)`
// path through `_buildInsertFromSelect`. Combined with `.returning(...)`
// it also exercises the `_buildInsertReturning` branch for inserts
// driven by a select (vs. literal `VALUES`).
//
// MySQL has no `RETURNING`; the from-select form still works, so the
// MySQL cell carries the test without the returning clause.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('insert-from-select-with-returning', async () => {
        const expectedMock = [{ id: 100 }, { id: 101 }]
        ctx.mockNext(expectedMock)

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

            const newIds = await ctx.conn.insertInto(tIssue)
                .from(source)
                .returning({ id: tIssue.id })
                .executeInsertMany()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority) output inserted.id as id select @0 as projectId, number as number, title as title, @1 as status, priority as priority from issue where project_id = @2"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                4,
                "draft",
                3,
              ]
            `)
            assertType<Exact<typeof newIds, Array<{ id: number }>>>()

            if (!ctx.realDbEnabled) expect(newIds).toEqual(expectedMock)
            else expect(Array.isArray(newIds)).toBe(true)
        })
    })
})
