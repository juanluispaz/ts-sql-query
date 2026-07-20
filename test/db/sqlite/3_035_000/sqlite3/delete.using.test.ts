// Coverage of `DELETE … USING other-table`. Runs where the dialect
// supports a `USING` clause on DELETE; commented out elsewhere with a
// NOT-APPLICABLE marker.

import { afterAll, beforeAll, beforeEach, describe } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // NOT-APPLICABLE: SQLite does not support DELETE … USING; the library type-excludes it for sqlite connections.
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

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
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
