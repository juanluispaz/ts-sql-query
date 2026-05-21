// CTE composition patterns the existing `select.cte.test.ts` does
// not cover:
//
//   - **Chained CTEs**: a second CTE that selects FROM a first CTE,
//     and an outer SELECT that uses the second. The `WITH` clause
//     must list them in topological order (first, then second).
//   - **CTE referenced multiple times**: a single
//     `.forUseInQueryAs(...)` view joined twice in the same outer
//     query under different aliases - the WITH clause must list it
//     once, not twice.
//   - **CTE used inside a WHERE-in-subquery**: the CTE is the
//     source of an `in(...)` filter rather than a direct FROM.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('cte-chained-second-selects-from-first', async () => {
        // `openIssues` is the first CTE. `topPriorityOpenIssues` is
        // a second CTE that selects from `openIssues` - the outer
        // SELECT joins the second. The snapshot pins the topological
        // order in the `WITH` clause.
        ctx.mockNext([{ projectName: 'Marketing site', issueId: 1 }])
        const connection = ctx.conn

        const openIssues = connection.selectFrom(tIssue)
            .where(tIssue.status.equals('open'))
            .select({
                id:        tIssue.id,
                projectId: tIssue.projectId,
                priority:  tIssue.priority,
            })
            .forUseInQueryAs('open_issues')

        const topPriorityOpen = connection.selectFrom(openIssues)
            .where(openIssues.priority.greaterOrEqual(2))
            .select({
                id:        openIssues.id,
                projectId: openIssues.projectId,
            })
            .forUseInQueryAs('top_priority_open')

        const result = await connection.selectFrom(tProject)
            .innerJoin(topPriorityOpen).on(topPriorityOpen.projectId.equals(tProject.id))
            .select({
                projectName: tProject.name,
                issueId:     topPriorityOpen.id,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with open_issues as (select id as id, project_id as projectId, priority as priority from issue where status = $1), top_priority_open as (select id as id, projectId as projectId from open_issues where priority >= $2) select project.name as "projectName", top_priority_open.id as "issueId" from project inner join top_priority_open on top_priority_open.projectId = project.id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
            2,
          ]
        `)
        assertType<Exact<typeof result, Array<{ projectName: string; issueId: number }>>>()
    })

    test('cte-referenced-in-select-projection-and-from-once', async () => {
        // The CTE is used twice in the same outer query: once in
        // `selectFrom(cte)` and once as an inline aggregated
        // sub-select on the same `cte`. The WITH clause must list
        // the CTE exactly once even though `__addWiths` is walked
        // through multiple paths.
        ctx.mockNext([{ id: 1, name: 'Marketing site', totalOpen: 7 }])
        const connection = ctx.conn

        const openIssues = connection.selectFrom(tIssue)
            .where(tIssue.status.equals('open'))
            .select({ projectId: tIssue.projectId })
            .forUseInQueryAs('open_issues')

        const totalOpenAll = connection.selectFrom(openIssues)
            .selectOneColumn(connection.count(openIssues.projectId))

        const result = await connection.selectFrom(tProject)
            .innerJoin(openIssues).on(openIssues.projectId.equals(tProject.id))
            .select({
                id:        tProject.id,
                name:      tProject.name,
                totalOpen: totalOpenAll.forUseAsInlineQueryValue(),
            })
            .groupBy('id', 'name')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with open_issues as (select project_id as projectId from issue where status = $1) select project.id as id, project.name as name, (select count(projectId) as result from open_issues) as "totalOpen" from project inner join open_issues on open_issues.projectId = project.id group by project.id, project.name"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; name: string; totalOpen?: number }>>>()
    })

    test('cte-used-in-where-in-subquery-bubbles-with', async () => {
        // The CTE is consumed by a `notIn(...)` subquery rather than
        // a FROM/JOIN of the outer query. The `WITH` still has to
        // bubble up because the inner select references it.
        ctx.mockNext([{ id: 1, name: 'Marketing site' }, { id: 2, name: 'Internal tools' }])
        const connection = ctx.conn

        const archivedProjects = connection.selectFrom(tProject)
            .where(tProject.archivedAt.isNotNull())
            .select({ id: tProject.id })
            .forUseInQueryAs('archived_projects')

        const result = await connection.selectFrom(tProject)
            .where(tProject.id.notIn(connection.selectFrom(archivedProjects).selectOneColumn(archivedProjects.id)))
            .select({ id: tProject.id, name: tProject.name })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with archived_projects as (select id as id from project where archived_at is not null) select id as id, name as name from project where id not in (select id as result from archived_projects)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number; name: string }>>>()
    })
})
