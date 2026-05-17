// Coverage of `DELETE … USING other-table` (PostgreSQL/SQL Server/
// MariaDB/MySQL syntax). SQLite and Oracle don't support it.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('delete-using-other-table', async () => {
        ctx.mockNext(2)

        await ctx.withRollback(async () => {
            // Delete issues whose project's name contains 'Marketing'.
            const affected = await ctx.conn.deleteFrom(tIssue)
                .using(tProject)
                .where(tIssue.projectId.equals(tProject.id))
                .and(tProject.name.containsInsensitive('Marketing'))
                .executeDelete()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue using project where issue.project_id = project.id and project.name ilike ('%' || $1 || '%')"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Marketing",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (ctx.realDbEnabled) {
                expect(typeof affected).toBe('number')
                // Project 1 = 'Marketing site' → had 2 issues (1, 2)
                expect(affected).toBe(2)
            } else {
                expect(affected).toBe(2)
            }
        })
    })
})
