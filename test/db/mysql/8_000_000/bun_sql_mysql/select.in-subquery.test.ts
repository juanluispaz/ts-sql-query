// Coverage of `.in(select)` / `.notIn(select)` — the subquery overload of
// `IN` / `NOT IN`, emitting `col in (select ...)` rather than a placeholder
// list (the `.in([array])` form is covered elsewhere).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('in-subquery', async () => {
        // Published projects are 1 and 3; their issues are 1, 2 (proj 1) and
        // 4 (proj 3). Issue 3 belongs to unpublished proj 2.
        const expected = [{ id: 1 }, { id: 2 }, { id: 4 }]
        ctx.mockNext(expected)

        const publishedProjectIds = ctx.conn.selectFrom(tProject)
            .where(tProject.published.equals(true))
            .selectOneColumn(tProject.id)

        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.projectId.in(publishedProjectIds))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where project_id in (select id as result from project where (published = 't') = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            true,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('not-in-subquery', async () => {
        // Unpublished projects are 2 and 4. Issues NOT in those projects are
        // 1, 2 (proj 1) and 4 (proj 3); issue 3 (proj 2) is excluded.
        const expected = [{ id: 1 }, { id: 2 }, { id: 4 }]
        ctx.mockNext(expected)

        const unpublishedProjectIds = ctx.conn.selectFrom(tProject)
            .where(tProject.published.equals(false))
            .selectOneColumn(tProject.id)

        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.projectId.notIn(unpublishedProjectIds))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where project_id not in (select id as result from project where (published = 't') = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            false,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })
})
