// Coverage of `.in(select)` / `.notIn(select)` — the subquery overload of
// `IN` / `NOT IN`, emitting `col in (select ...)` rather than a placeholder
// list (the `.in([array])` form is covered elsewhere).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'
import { sync } from '../../../../../src/extras/sync.js'

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

        const rows = sync(ctx.conn.selectFrom(tIssue)
            .where(tIssue.projectId.in(publishedProjectIds))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where project_id in (select id as result from project where (published = 't') = ?1) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
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

        const rows = sync(ctx.conn.selectFrom(tIssue)
            .where(tIssue.projectId.notIn(unpublishedProjectIds))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where project_id not in (select id as result from project where (published = 't') = ?1) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('in-and-not-in-of-a-subquery-on-an-optional-column-can-be-null', async () => {
        // The assignees are 1, 2, null and 3: an issue id that is none of them has an unknown answer.
        const expected = [
            { id: 1, isAssignee: true, isNotAssignee: false },
            { id: 2, isAssignee: true, isNotAssignee: false },
            { id: 3, isAssignee: true, isNotAssignee: false },
            { id: 4 },
        ]
        ctx.mockNext(expected)

        const assignees = ctx.conn.selectFrom(tIssue).selectOneColumn(tIssue.assigneeId)

        const rows = sync(ctx.conn.selectFrom(tIssue)
            .select({
                id: tIssue.id,
                isAssignee: tIssue.id.in(assignees),
                isNotAssignee: tIssue.id.notIn(assignees),
            })
            .orderBy('id')
            .executeSelectMany())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, id in (select assignee_id as result from issue) as isAssignee, id not in (select assignee_id as result from issue) as isNotAssignee from issue order by id"`)
        assertType<Exact<typeof rows, Array<{ id: number, isAssignee?: boolean, isNotAssignee?: boolean }>>>()
        expect(rows).toEqual(expected)
    })

    test('in-and-not-in-of-a-subquery-on-a-required-column-stay-required', async () => {
        const expected = [{ id: 1, isProject: true, isNotProject: false }]
        ctx.mockNext(expected)

        const projects = ctx.conn.selectFrom(tProject).selectOneColumn(tProject.id)

        const rows = sync(ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                isProject: tIssue.id.in(projects),
                isNotProject: tIssue.id.notIn(projects),
            })
            .executeSelectMany())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, id in (select id as result from project) as isProject, id not in (select id as result from project) as isNotProject from issue where id = ?1"`)
        assertType<Exact<typeof rows, Array<{ id: number, isProject: boolean, isNotProject: boolean }>>>()
        expect(rows).toEqual(expected)
    })
})
