// Drives `RawFragmentImpl.__addWiths`
// by embedding sub-queries that themselves select from a CTE built
// via `.forUseInQueryAs(...)`. The CTE must bubble up through the
// rawFragment's `__params` traversal to the OUTER query's WITH
// clause - otherwise the rendered SQL would reference an
// undeclared CTE name.
//
// All tests use the `beforeColumns` hook so the embedded sub-query
// lands as a valid SQL projection (real DB executes it instead of
// the placeholder living inside a `/* ... */` comment).

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
        ctx.mockNext([{ openCount: 3, id: 1 }, { openCount: 0, id: 2 }])
        const connection = ctx.conn

        const openIssues = connection.selectFrom(tIssue)
            .where(tIssue.status.equals('open'))
            .select({ projectId: tIssue.projectId })
            .forUseInQueryAs('open_issues')

        const openCount = connection.selectFrom(openIssues)
            .selectOneColumn(connection.count(openIssues.projectId))

        const result = await connection.selectFrom(tProject)
            .select({ id: tProject.id })
            .customizeQuery({
                beforeColumns: connection.rawFragment`(${openCount}) as "openCount", `,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with open_issues as (select project_id as projectId from issue where status = :0) select (select count(projectId) as "result" from open_issues) as "openCount",  id as "id" from project"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
    })

    test('rawfragment-with-multiple-ctes-from-embedded-subqueries', async () => {
        // Two independent embedded sub-queries each reference a
        // distinct CTE; both CTEs must show up in the outer `WITH`
        // clause, comma-separated, in the order `__addWiths`
        // visits them.
        ctx.mockNext([{ openCount: 3, closedCount: 1, id: 1 }])
        const connection = ctx.conn

        const openIssues = connection.selectFrom(tIssue)
            .where(tIssue.status.equals('open'))
            .select({ projectId: tIssue.projectId })
            .forUseInQueryAs('open_issues')

        const closedIssues = connection.selectFrom(tIssue)
            .where(tIssue.status.equals('closed'))
            .select({ projectId: tIssue.projectId })
            .forUseInQueryAs('closed_issues')

        const openCount = connection.selectFrom(openIssues)
            .selectOneColumn(connection.count(openIssues.projectId))

        const closedCount = connection.selectFrom(closedIssues)
            .selectOneColumn(connection.count(closedIssues.projectId))

        const result = await connection.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ id: tProject.id })
            .customizeQuery({
                beforeColumns: connection.rawFragment`(${openCount}) as "openCount", (${closedCount}) as "closedCount", `,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with open_issues as (select project_id as projectId from issue where status = :0), closed_issues as (select project_id as projectId from issue where status = :1) select (select count(projectId) as "result" from open_issues) as "openCount", (select count(projectId) as "result" from closed_issues) as "closedCount",  id as "id" from project where id = :2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
            "closed",
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
    })

    test('rawfragment-with-cte-and-outer-with-coexist', async () => {
        // The OUTER query already has its own WITH clause (because
        // it joins a CTE), and the rawFragment contributes another
        // CTE through `__addWiths`. The combined `WITH` should list
        // both, comma-separated, ahead of the outer SELECT.
        ctx.mockNext([{ closedCount: 1, id: 1, openCount: 3 }])
        const connection = ctx.conn

        const openIssues = connection.selectFrom(tIssue)
            .where(tIssue.status.equals('open'))
            .select({ projectId: tIssue.projectId })
            .forUseInQueryAs('open_issues')

        const closedIssues = connection.selectFrom(tIssue)
            .where(tIssue.status.equals('closed'))
            .select({ projectId: tIssue.projectId })
            .forUseInQueryAs('closed_issues')

        const closedCount = connection.selectFrom(closedIssues)
            .selectOneColumn(connection.count(closedIssues.projectId))

        const result = await connection.selectFrom(tProject)
            .innerJoin(openIssues).on(openIssues.projectId.equals(tProject.id))
            .select({
                id:        tProject.id,
                openCount: connection.count(openIssues.projectId),
            })
            .groupBy('id')
            .customizeQuery({
                beforeColumns: connection.rawFragment`(${closedCount}) as "closedCount", `,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with open_issues as (select project_id as projectId from issue where status = :0), closed_issues as (select project_id as projectId from issue where status = :1) select (select count(projectId) as "result" from closed_issues) as "closedCount",  project.id as "id", count(open_issues.projectId) as "openCount" from project inner join open_issues on open_issues.projectId = project.id group by project.id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
            "closed",
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; openCount: number }>>>()
    })
})
