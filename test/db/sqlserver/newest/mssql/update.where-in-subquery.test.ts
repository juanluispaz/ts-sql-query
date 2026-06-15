// Coverage of `UPDATE ... WHERE col IN (select ...)`. The emitted form,
// including any dialect-specific identifier quoting, is pinned by the
// snapshot below.

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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set status = @0 where project_id in (select id as [result] from project where cast(case when published = 't' then 1 else 0 end as bit) = @1)"`)
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
