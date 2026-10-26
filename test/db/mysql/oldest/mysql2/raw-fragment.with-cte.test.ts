// Drives `RawFragmentImpl.__addWiths`
// by embedding sub-queries that themselves select from a CTE built
// via `.forUseInQueryAs(...)`. The CTE must bubble up through the
// rawFragment's `__params` traversal to the OUTER query's WITH
// clause - otherwise the rendered SQL would reference an
// undeclared CTE name.
//
// The rawFragment is an `orderBy` item: the sub-query is correlated
// with the outer row, so the order of the result shows the database
// evaluated it against the hoisted CTE.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('rawfragment-with-cte-bubbles-with-clause-to-outer-select', async () => {
        // The embedded sub-query selects from a `.forUseInQueryAs`
        // CTE view. The outer query has no other reference to the
        // view - it discovers it only by walking the rawFragment's
        // params via `__addWiths`. If the forwarder dropped the
        // CTE, the snapshot would render `from open_issues` without
        // a preceding `with open_issues as (...)`.
        // Projects 1 and 2 have one open issue each, 3 and 4 none.
        ctx.mockNext([{ id: 3 }, { id: 4 }, { id: 1 }, { id: 2 }])
        const connection = ctx.conn

        const openIssues = connection.selectFrom(tIssue)
            .where(tIssue.status.equals('open'))
            .select({ projectId: tIssue.projectId })
            .forUseInQueryAs('open_issues')

        const openCount = connection.subSelectUsing(tProject).from(openIssues)
            .where(openIssues.projectId.equals(tProject.id))
            .selectOneColumn(connection.count(openIssues.projectId))

        const result = await connection.selectFrom(tProject)
            .select({ id: tProject.id })
            .orderBy(connection.rawFragment`(${openCount})`)
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project order by (select count(open_issues.projectId) as result from (select project_id as projectId from issue where \`status\` = ?) as open_issues where open_issues.projectId = project.id), id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
          ]
        `)
        expect(result).toEqual([{ id: 3 }, { id: 4 }, { id: 1 }, { id: 2 }])
        assertType<Exact<typeof result, Array<{ id: number }>>>()
    })

    test('rawfragment-with-multiple-ctes-from-embedded-subqueries', async () => {
        // Two independent embedded sub-queries each reference a
        // distinct CTE; both CTEs must show up in the outer `WITH`
        // clause, comma-separated, in the order `__addWiths`
        // visits them.
        // Closed minus open issues: project 3 = 1, projects 1 and 2 = -1.
        ctx.mockNext([{ id: 3 }, { id: 1 }, { id: 2 }])
        const connection = ctx.conn

        const openIssues = connection.selectFrom(tIssue)
            .where(tIssue.status.equals('open'))
            .select({ projectId: tIssue.projectId })
            .forUseInQueryAs('open_issues')

        const closedIssues = connection.selectFrom(tIssue)
            .where(tIssue.status.equals('closed'))
            .select({ projectId: tIssue.projectId })
            .forUseInQueryAs('closed_issues')

        const openCount = connection.subSelectUsing(tProject).from(openIssues)
            .where(openIssues.projectId.equals(tProject.id))
            .selectOneColumn(connection.count(openIssues.projectId))

        const closedCount = connection.subSelectUsing(tProject).from(closedIssues)
            .where(closedIssues.projectId.equals(tProject.id))
            .selectOneColumn(connection.count(closedIssues.projectId))

        const result = await connection.selectFrom(tProject)
            .where(tProject.id.in([1, 2, 3]))
            .select({ id: tProject.id })
            .orderBy(connection.rawFragment`(${closedCount}) - (${openCount})`, 'desc')
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project where id in (?, ?, ?) order by (select count(closed_issues.projectId) as result from (select project_id as projectId from issue where \`status\` = ?) as closed_issues where closed_issues.projectId = project.id) - (select count(open_issues.projectId) as result from (select project_id as projectId from issue where \`status\` = ?) as open_issues where open_issues.projectId = project.id) desc, id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            3,
            "closed",
            "open",
          ]
        `)
        expect(result).toEqual([{ id: 3 }, { id: 1 }, { id: 2 }])
        assertType<Exact<typeof result, Array<{ id: number }>>>()
    })

    test('rawfragment-with-cte-and-outer-with-coexist', async () => {
        // The OUTER query already has its own WITH clause (because
        // it joins a CTE), and the rawFragment contributes another
        // CTE through `__addWiths`. The combined `WITH` should list
        // both, comma-separated, ahead of the outer SELECT.
        // Project 1 has one issue in progress, project 2 none.
        ctx.mockNext([{ id: 2, openCount: 1 }, { id: 1, openCount: 1 }])
        const connection = ctx.conn

        const openIssues = connection.selectFrom(tIssue)
            .where(tIssue.status.equals('open'))
            .select({ projectId: tIssue.projectId })
            .forUseInQueryAs('open_issues')

        const inProgressIssues = connection.selectFrom(tIssue)
            .where(tIssue.status.equals('in_progress'))
            .select({ projectId: tIssue.projectId })
            .forUseInQueryAs('in_progress_issues')

        const inProgressCount = connection.subSelectUsing(tProject).from(inProgressIssues)
            .where(inProgressIssues.projectId.equals(tProject.id))
            .selectOneColumn(connection.count(inProgressIssues.projectId))

        const result = await connection.selectFrom(tProject)
            .innerJoin(openIssues).on(openIssues.projectId.equals(tProject.id))
            .select({
                id:        tProject.id,
                openCount: connection.count(openIssues.projectId),
            })
            .groupBy(tProject.id)
            .orderBy(connection.rawFragment`(${inProgressCount})`)
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as id, count(open_issues.projectId) as openCount from project inner join (select project_id as projectId from issue where \`status\` = ?) as open_issues on open_issues.projectId = project.id group by project.id order by (select count(in_progress_issues.projectId) as result from (select project_id as projectId from issue where \`status\` = ?) as in_progress_issues where in_progress_issues.projectId = project.id), id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
            "in_progress",
          ]
        `)
        expect(result).toEqual([{ id: 2, openCount: 1 }, { id: 1, openCount: 1 }])
        assertType<Exact<typeof result, Array<{ id: number; openCount: number }>>>()
    })
})
