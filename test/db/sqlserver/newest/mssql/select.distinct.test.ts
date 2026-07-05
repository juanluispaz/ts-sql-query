// Coverage of `SELECT DISTINCT` — `selectDistinctFrom(...)` and
// `subSelectDistinctUsing(...)` (a distinct correlated subquery).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tAppUser, tIssue, tIssueWorklog, tOrganization, tProject, tProjectReview } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('select-distinct-from-table', async () => {
        // Distinct issue statuses across the table: open, in_progress, open,
        // closed → three distinct values, ordered alphabetically.
        const expected = [{ status: 'closed' }, { status: 'in_progress' }, { status: 'open' }]
        ctx.mockNext(expected)

        const rows = await ctx.conn.selectDistinctFrom(tIssue)
            .select({ status: tIssue.status })
            .orderBy('status')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select distinct status as status from issue order by status"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ status: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('select-distinct-with-join-and-where', async () => {
        // Distinct organizations with an open issue: open issues 1 and 3
        // belong to projects 1 and 2, both owned by org 1 → just [1].
        const expected = [{ orgId: 1 }]
        ctx.mockNext(expected)

        const rows = await ctx.conn.selectDistinctFrom(tProject)
            .innerJoin(tIssue).on(tIssue.projectId.equals(tProject.id))
            .where(tIssue.status.equals('open'))
            .select({ orgId: tProject.organizationId })
            .orderBy('orgId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select distinct project.organization_id as orgId from project inner join issue on issue.project_id = project.id where issue.status = @0 order by orgId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ orgId: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('subselect-distinct-using-in-correlated-exists', async () => {
        // `subSelectDistinctUsing(...)` builds a correlated `select distinct`
        // subquery; inside `exists(...)` it keeps the projects that have at
        // least one issue. Projects 1/2/3 have issues; project 4 has none.
        const expected = [
            { id: 1, name: 'Marketing site' },
            { id: 2, name: 'Internal tools' },
            { id: 3, name: 'Public API' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const rows = await connection.selectFrom(tProject)
            .where(connection.exists(
                connection.subSelectDistinctUsing(tProject)
                    .from(tIssue)
                    .where(tIssue.projectId.equals(tProject.id))
                    .selectOneColumn(tIssue.status),
            ))
            .select({
                id:   tProject.id,
                name: tProject.name,
            })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name from project where exists(select distinct status as [result] from issue where project_id = project.id) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; name: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('subselect-distinct-using-two-correlated-tables', async () => {
        // The distinct twin of subSelectUsing's arity-2 case: a `select distinct`
        // correlated subquery over TWO outer tables (tOrganization + tProject).
        // count(*) always returns one row, so the distinct scalar is well-formed
        // and the only difference from the non-distinct sibling is the `distinct`
        // keyword the arity-2 overload threads through.
        const expected = [
            { projectId: 1, issueCount: 2 },
            { projectId: 2, issueCount: 1 },
            { projectId: 3, issueCount: 1 },
            { projectId: 4, issueCount: 0 },
        ]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tOrganization)
            .innerJoin(tProject).on(tProject.organizationId.equals(tOrganization.id))
            .select({
                projectId:  tProject.id,
                issueCount: ctx.conn.subSelectDistinctUsing(tOrganization, tProject).from(tIssue)
                    .where(tIssue.projectId.equals(tProject.id)
                        .and(tProject.organizationId.equals(tOrganization.id)))
                    .selectCountAll()
                    .forUseAsInlineQueryValue(),
            })
            .orderBy('projectId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as projectId, (select distinct count(*) as [result] from issue where project_id = project.id and project.organization_id = organization.id) as issueCount from organization inner join project on project.organization_id = organization.id order by projectId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ projectId: number; issueCount: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('subselect-distinct-using-three-correlated-tables', async () => {
        // Arity-3: a `select distinct` correlated subquery over THREE outer
        // tables (tOrganization + tProject + tIssue), counting the worklogs of
        // each joined issue while re-stating the whole org↔project↔issue link.
        const expected = [
            { issueId: 1, worklogCount: 2 },
            { issueId: 2, worklogCount: 1 },
            { issueId: 3, worklogCount: 0 },
            { issueId: 4, worklogCount: 0 },
        ]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tOrganization)
            .innerJoin(tProject).on(tProject.organizationId.equals(tOrganization.id))
            .innerJoin(tIssue).on(tIssue.projectId.equals(tProject.id))
            .select({
                issueId:      tIssue.id,
                worklogCount: ctx.conn.subSelectDistinctUsing(tOrganization, tProject, tIssue).from(tIssueWorklog)
                    .where(tIssueWorklog.issueId.equals(tIssue.id)
                        .and(tIssue.projectId.equals(tProject.id))
                        .and(tProject.organizationId.equals(tOrganization.id)))
                    .selectCountAll()
                    .forUseAsInlineQueryValue(),
            })
            .orderBy('issueId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as issueId, (select distinct count(*) as [result] from issue_worklog where issue_id = issue.id and issue.project_id = project.id and project.organization_id = organization.id) as worklogCount from organization inner join project on project.organization_id = organization.id inner join issue on issue.project_id = project.id order by issueId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ issueId: number; worklogCount: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('subselect-distinct-using-four-correlated-tables', async () => {
        // Arity-4: a `select distinct` correlated subquery over FOUR outer tables
        // (tOrganization + tProject + tIssue + tAppUser). The outer query inner-joins
        // each issue to its assignee (so the assignee-less issue 3 drops out), and
        // the subquery counts the assigned issue's worklogs re-stating all four links.
        const expected = [
            { issueId: 1, assignee: 'Ada Lovelace', worklogCount: 2 },
            { issueId: 2, assignee: 'Grace Hopper', worklogCount: 1 },
            { issueId: 4, assignee: 'Alan Turing',  worklogCount: 0 },
        ]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tOrganization)
            .innerJoin(tProject).on(tProject.organizationId.equals(tOrganization.id))
            .innerJoin(tIssue).on(tIssue.projectId.equals(tProject.id))
            .innerJoin(tAppUser).on(tAppUser.id.equals(tIssue.assigneeId))
            .select({
                issueId:      tIssue.id,
                assignee:     tAppUser.fullName,
                worklogCount: ctx.conn.subSelectDistinctUsing(tOrganization, tProject, tIssue, tAppUser).from(tIssueWorklog)
                    .where(tIssueWorklog.issueId.equals(tIssue.id)
                        .and(tIssue.projectId.equals(tProject.id))
                        .and(tProject.organizationId.equals(tOrganization.id))
                        .and(tAppUser.id.equals(tIssue.assigneeId)))
                    .selectCountAll()
                    .forUseAsInlineQueryValue(),
            })
            .orderBy('issueId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as issueId, app_user.full_name as assignee, (select distinct count(*) as [result] from issue_worklog where issue_id = issue.id and issue.project_id = project.id and project.organization_id = organization.id and app_user.id = issue.assignee_id) as worklogCount from organization inner join project on project.organization_id = organization.id inner join issue on issue.project_id = project.id inner join app_user on app_user.id = issue.assignee_id order by issueId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ issueId: number; assignee: string; worklogCount: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('subselect-distinct-using-five-correlated-tables', async () => {
        // Arity-5: the distinct twin of subSelectUsing's five-correlated-tables
        // test (tOrganization + tProject + tIssue + tAppUser + tIssueWorklog). Each
        // Ti stays its own type parameter, so five different tables are accepted
        // (the arity-5 overload the CD-1 fix corrected). Only the `distinct`
        // keyword distinguishes the emitted subquery from its non-distinct sibling.
        const expected = [
            { worklogId: 1, issueId: 1, orgName: 'Acme Corp', assignee: 'Ada Lovelace', reviewCount: 1 },
            { worklogId: 2, issueId: 2, orgName: 'Acme Corp', assignee: 'Grace Hopper', reviewCount: 1 },
            { worklogId: 3, issueId: 1, orgName: 'Acme Corp', assignee: 'Ada Lovelace', reviewCount: 1 },
        ]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tOrganization)
            .innerJoin(tProject).on(tProject.organizationId.equals(tOrganization.id))
            .innerJoin(tIssue).on(tIssue.projectId.equals(tProject.id))
            .innerJoin(tAppUser).on(tAppUser.id.equals(tIssue.assigneeId))
            .innerJoin(tIssueWorklog).on(tIssueWorklog.issueId.equals(tIssue.id))
            .select({
                worklogId:   tIssueWorklog.id,
                issueId:     tIssue.id,
                orgName:     tOrganization.name,
                assignee:    tAppUser.fullName,
                reviewCount: ctx.conn.subSelectDistinctUsing(tOrganization, tProject, tIssue, tAppUser, tIssueWorklog).from(tProjectReview)
                    .where(tProjectReview.projectId.equals(tProject.id)
                        .and(tProject.organizationId.equals(tOrganization.id))
                        .and(tIssue.assigneeId.equals(tAppUser.id))
                        .and(tIssueWorklog.issueId.equals(tIssue.id)))
                    .selectCountAll()
                    .forUseAsInlineQueryValue(),
            })
            .orderBy('worklogId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue_worklog.id as worklogId, issue.id as issueId, organization.name as orgName, app_user.full_name as assignee, (select distinct count(*) as [result] from project_review where project_id = project.id and project.organization_id = organization.id and issue.assignee_id = app_user.id and issue_worklog.issue_id = issue.id) as reviewCount from organization inner join project on project.organization_id = organization.id inner join issue on issue.project_id = project.id inner join app_user on app_user.id = issue.assignee_id inner join issue_worklog on issue_worklog.issue_id = issue.id order by worklogId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ worklogId: number; issueId: number; orgName: string; assignee: string; reviewCount: number }>>>()
        expect(rows).toEqual(expected)
    })
})
