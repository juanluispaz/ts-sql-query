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
        // Project 3 has exactly one seeded issue (id=4, 'Document /v2/users'),
        // so the from-select clones a single row — a deterministic count the
        // mock matches. The engine-assigned id itself is non-deterministic,
        // so the unconditional assertion checks length + numeric shape.
        const expectedMock = [{ id: 100 }]
        ctx.mockNext(expectedMock)

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

            const newIds = await ctx.conn.insertInto(tIssue)
                .from(source)
                .returning({ id: tIssue.id })
                .executeInsertMany()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority) select ? as projectId, number as number, title as title, ? as status, priority as priority from issue where project_id = ? returning id as id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                4,
                "draft",
                3,
              ]
            `)
            assertType<Exact<typeof newIds, Array<{ id: number }>>>()

            expect(newIds).toHaveLength(1)
            expect(typeof newIds[0]!.id).toBe('number')
        })
    })
})
