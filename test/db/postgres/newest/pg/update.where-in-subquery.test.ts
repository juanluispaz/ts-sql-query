// Coverage of `UPDATE ... WHERE col IN (select ...)`. Combines the
// update-builder path with the `_inSelect` branch of each dialect's
// SqlBuilder. Several dialects (Oracle, SqlServer) emit identifier
// quoting that differs from the simple in-list case.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('update-where-in-subquery', async () => {
        ctx.mockNext(2)

        await ctx.withRollback(async () => {
            // Close every issue belonging to an unpublished project.
            const unpublishedProjectIds = ctx.conn.selectFrom(tProject)
                .where(tProject.published.equals(false))
                .selectOneColumn(tProject.id)

            const affected = await ctx.conn.update(tIssue)
                .set({ status: 'closed' })
                .where(tIssue.projectId.in(unpublishedProjectIds))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set status = $1 where project_id in (select id as result from project where (published = 't') = $2)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "closed",
                false,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (!ctx.realDbEnabled) expect(affected).toBe(2)
            else expect(typeof affected).toBe('number')
        })
    })
})
