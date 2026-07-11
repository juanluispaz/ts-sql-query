// Behavioral coverage of subqueries: scalar subquery in projection,
// IN (subquery), EXISTS, and NOT EXISTS.
//
// Correlated subqueries (the inner query referencing a column from the
// outer table) require `subSelectUsing(outerTable)` so the inner builder
// knows the outer columns are in scope.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tAppUser, tIssue, tIssueWorklog, tOrganization, tProject, tProjectReview } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('scalar-subquery-as-projection', async () => {
        const expected = [
            { id: 1, name: 'Marketing site', issueCount: 2 },
            { id: 2, name: 'Internal tools', issueCount: 1 },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tProject)
            .where(tProject.organizationId.equals(1))
            .select({
                id:         tProject.id,
                name:       tProject.name,
                issueCount: ctx.conn.subSelectUsing(tProject)
                    .from(tIssue)
                    .where(tIssue.projectId.equals(tProject.id))
                    .selectOneColumn(ctx.conn.countAll())
                    .forUseAsInlineQueryValue(),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, (select count(*) as result from issue where project_id = project.id) as "issueCount" from project where organization_id = $1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        // forUseAsInlineQueryValue widens to optional because the scalar
        // subquery is allowed to return no rows.
        assertType<Exact<typeof result, Array<{
            id:          number
            name:        string
            issueCount?: number
        }>>>()
        expect(result).toEqual(expected)
    })

    test('in-subquery', async () => {
        const expected = [
            { id: 1, name: 'Marketing site' },
            { id: 2, name: 'Internal tools' },
            { id: 3, name: 'Public API' },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tProject)
            .where(tProject.id.in(
                ctx.conn.selectFrom(tIssue)
                    .selectOneColumn(tIssue.projectId)
            ))
            .select({ id: tProject.id, name: tProject.name })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name from project where id in (select project_id as result from issue) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{
            id:   number
            name: string
        }>>>()
        expect(result).toEqual(expected)
    })

    test('exists', async () => {
        const expected = [
            { id: 1, name: 'Marketing site' },
            { id: 2, name: 'Internal tools' },
            { id: 3, name: 'Public API' },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tProject)
            .where(ctx.conn.exists(
                ctx.conn.subSelectUsing(tProject)
                    .from(tIssue)
                    .where(tIssue.projectId.equals(tProject.id))
                    .selectOneColumn(tIssue.id)
            ))
            .select({ id: tProject.id, name: tProject.name })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name from project where exists(select id as result from issue where project_id = project.id) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{
            id:   number
            name: string
        }>>>()
        expect(result).toEqual(expected)
    })

    test('not-exists', async () => {
        const expected = [{ id: 4, name: 'Legacy app' }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tProject)
            .where(ctx.conn.notExists(
                ctx.conn.subSelectUsing(tProject)
                    .from(tIssue)
                    .where(tIssue.projectId.equals(tProject.id))
                    .selectOneColumn(tIssue.id)
            ))
            .select({ id: tProject.id, name: tProject.name })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name from project where not exists(select id as result from issue where project_id = project.id) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{
            id:   number
            name: string
        }>>>()
        expect(result).toEqual(expected)
    })

    test('sub-select-using-two-correlated-tables', async () => {
        // subSelectUsing with TWO correlated outer tables (tOrganization +
        // tProject): the subquery counts issues in the joined project, gated by
        // the org↔project link, so it references both correlated tables.
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
                issueCount: ctx.conn.subSelectUsing(tOrganization, tProject).from(tIssue)
                    .where(tIssue.projectId.equals(tProject.id)
                        .and(tProject.organizationId.equals(tOrganization.id)))
                    .selectCountAll()
                    .forUseAsInlineQueryValue(),
            })
            .orderBy('projectId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as "projectId", (select count(*) as result from issue where project_id = project.id and project.organization_id = organization.id) as "issueCount" from organization inner join project on project.organization_id = organization.id order by "projectId""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ projectId: number; issueCount: number }>>>()
        expect(rows).toEqual(expected)
    })


    test('sub-select-using-three-correlated-tables', async () => {
        // subSelectUsing with THREE correlated outer tables (tOrganization +
        // tProject + tIssue): the inline subquery counts each issue's worklogs
        // while re-stating the whole org↔project↔issue link, so it references all
        // three correlated tables. Fills the arity-3 rung of the overload ladder.
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
                worklogCount: ctx.conn.subSelectUsing(tOrganization, tProject, tIssue).from(tIssueWorklog)
                    .where(tIssueWorklog.issueId.equals(tIssue.id)
                        .and(tIssue.projectId.equals(tProject.id))
                        .and(tProject.organizationId.equals(tOrganization.id)))
                    .selectCountAll()
                    .forUseAsInlineQueryValue(),
            })
            .orderBy('issueId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as "issueId", (select count(*) as result from issue_worklog where issue_id = issue.id and issue.project_id = project.id and project.organization_id = organization.id) as "worklogCount" from organization inner join project on project.organization_id = organization.id inner join issue on issue.project_id = project.id order by "issueId""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ issueId: number; worklogCount: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('sub-select-using-four-correlated-tables', async () => {
        // subSelectUsing with FOUR correlated outer tables (tOrganization +
        // tProject + tIssue + tAppUser): the outer query inner-joins each issue to
        // its assignee (dropping the assignee-less issue 3), and the inline
        // subquery counts the assigned issue's worklogs re-stating all four links.
        // Fills the arity-4 rung of the overload ladder.
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
                worklogCount: ctx.conn.subSelectUsing(tOrganization, tProject, tIssue, tAppUser).from(tIssueWorklog)
                    .where(tIssueWorklog.issueId.equals(tIssue.id)
                        .and(tIssue.projectId.equals(tProject.id))
                        .and(tProject.organizationId.equals(tOrganization.id))
                        .and(tAppUser.id.equals(tIssue.assigneeId)))
                    .selectCountAll()
                    .forUseAsInlineQueryValue(),
            })
            .orderBy('issueId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as "issueId", app_user.full_name as assignee, (select count(*) as result from issue_worklog where issue_id = issue.id and issue.project_id = project.id and project.organization_id = organization.id and app_user.id = issue.assignee_id) as "worklogCount" from organization inner join project on project.organization_id = organization.id inner join issue on issue.project_id = project.id inner join app_user on app_user.id = issue.assignee_id order by "issueId""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ issueId: number; assignee: string; worklogCount: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('sub-select-using-five-correlated-tables', async () => {
        // subSelectUsing with FIVE genuinely-distinct correlated outer tables
        // (tOrganization + tProject + tIssue + tAppUser + tIssueWorklog). The
        // outer query joins the whole org↔project↔issue↔assignee↔worklog chain
        // and the inline subquery re-states every link, so it references all
        // five correlated tables at once. Exercises the arity-5 overload — each
        // Ti stays its own type parameter, so five different tables are accepted
        // (a copy-paste typo previously pinned the fifth to the fourth's type).
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
                reviewCount: ctx.conn.subSelectUsing(tOrganization, tProject, tIssue, tAppUser, tIssueWorklog).from(tProjectReview)
                    .where(tProjectReview.projectId.equals(tProject.id)
                        .and(tProject.organizationId.equals(tOrganization.id))
                        .and(tIssue.assigneeId.equals(tAppUser.id))
                        .and(tIssueWorklog.issueId.equals(tIssue.id)))
                    .selectCountAll()
                    .forUseAsInlineQueryValue(),
            })
            .orderBy('worklogId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue_worklog.id as "worklogId", issue.id as "issueId", organization.name as "orgName", app_user.full_name as assignee, (select count(*) as result from project_review where project_id = project.id and project.organization_id = organization.id and issue.assignee_id = app_user.id and issue_worklog.issue_id = issue.id) as "reviewCount" from organization inner join project on project.organization_id = organization.id inner join issue on issue.project_id = project.id inner join app_user on app_user.id = issue.assignee_id inner join issue_worklog on issue_worklog.issue_id = issue.id order by "worklogId""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ worklogId: number; issueId: number; orgName: string; assignee: string; reviewCount: number }>>>()
        expect(rows).toEqual(expected)
    })
    // ---- round-44 F3-SELECT: subSelectUsing / subSelectDistinctUsing with a ForUseInLeftJoin arg
    test('sub-select-using-for-use-in-left-join', async () => {
        // `subSelectUsing(t.forUseInLeftJoin())` correlates the inline subquery to
        // a LEFT-JOINED outer table: the outer query left-joins project onto the
        // organization, and the scalar subquery counts issues whose project_id
        // matches the (nullable) left-joined project's id. org 1 has projects 1 and
        // 2, so the left join yields two rows; project 1 has 2 issues, project 2
        // has 1. The left-joined `projectId` projects as an optional leaf.
        const expected = [
            { orgId: 1, projectId: 1, issueCount: 2 },
            { orgId: 1, projectId: 2, issueCount: 1 },
        ]
        ctx.mockNext(expected)
        const tProjectLeftJoin = tProject.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tOrganization)
            .leftJoin(tProjectLeftJoin).on(tProjectLeftJoin.organizationId.equals(tOrganization.id))
            .where(tOrganization.id.equals(1))
            .select({
                orgId:      tOrganization.id,
                projectId:  tProjectLeftJoin.id,
                issueCount: ctx.conn.subSelectUsing(tProjectLeftJoin).from(tIssue)
                    .where(tIssue.projectId.equals(tProjectLeftJoin.id))
                    .selectCountAll()
                    .forUseAsInlineQueryValue(),
            })
            .orderBy('projectId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization.id as "orgId", project.id as "projectId", (select count(*) as result from issue where project_id = project.id) as "issueCount" from organization left join project on project.organization_id = organization.id where organization.id = $1 order by "projectId""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            orgId:       number
            projectId?:  number
            issueCount:  number
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('sub-select-distinct-using-for-use-in-left-join', async () => {
        // `subSelectDistinctUsing(t.forUseInLeftJoin())` — the DISTINCT sibling of
        // the above, correlated to a LEFT-JOINED outer table. The count aggregate
        // yields a single row regardless of the DISTINCT quantifier, so the value
        // matches the plain correlated count. org 2 has projects 3 and 4; project 3
        // has 1 issue, project 4 has none (count 0).
        const expected = [
            { orgId: 2, projectId: 3, issueCount: 1 },
            { orgId: 2, projectId: 4, issueCount: 0 },
        ]
        ctx.mockNext(expected)
        const tProjectLeftJoin = tProject.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tOrganization)
            .leftJoin(tProjectLeftJoin).on(tProjectLeftJoin.organizationId.equals(tOrganization.id))
            .where(tOrganization.id.equals(2))
            .select({
                orgId:      tOrganization.id,
                projectId:  tProjectLeftJoin.id,
                issueCount: ctx.conn.subSelectDistinctUsing(tProjectLeftJoin).from(tIssue)
                    .where(tIssue.projectId.equals(tProjectLeftJoin.id))
                    .selectCountAll()
                    .forUseAsInlineQueryValue(),
            })
            .orderBy('projectId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization.id as "orgId", project.id as "projectId", (select distinct count(*) as result from issue where project_id = project.id) as "issueCount" from organization left join project on project.organization_id = organization.id where organization.id = $1 order by "projectId""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            orgId:       number
            projectId?:  number
            issueCount:  number
        }>>>()
        expect(rows).toEqual(expected)
    })
})
