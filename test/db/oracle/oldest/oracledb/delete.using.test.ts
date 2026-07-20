// Coverage of `DELETE … USING other-table`. Runs where the dialect
// supports a `USING` clause on DELETE; commented out elsewhere with a
// NOT-APPLICABLE marker.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

// Every test in this cell is commented out (see the blocks below); these
// sentinels satisfy noUnusedLocals while the imports stay for cross-cell symmetry.
void expect; void test; void assertType; void tIssue; void tProject
export type { Exact }

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // TODO[LIMITATION]: see LIMITATIONS.md — Oracle multi-table UPDATE…FROM / DELETE…USING
    // requires Oracle Database 23ai; earlier Oracle (this cell) rejects the FROM/USING keyword
    // at the parser (ORA-00933). Emission is the same standard form on all versions by design.
    /*
    test('delete-using-other-table', async () => {
        ctx.mockNext(2)

        await ctx.withRollback(async () => {
            // Delete issues whose project's name contains 'Marketing'.
            const affected = await ctx.conn.deleteFrom(tIssue)
                .using(tProject)
                .where(tIssue.projectId.equals(tProject.id))
                .and(tProject.name.containsInsensitive('Marketing'))
                .executeDelete()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue using project where issue.project_id = project.id and lower(project.name) like lower('%' || :0 || '%') escape '\\'"`)
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
    */
})
