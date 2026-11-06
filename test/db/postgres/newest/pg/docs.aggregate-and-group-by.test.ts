// Documentation snippets for the Aggregate and group by page (docs/queries/aggregate-and-group-by.md).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { TsSqlError, type TsSqlErrorReason } from '../../../../../src/TsSqlError.js'
import { tAppUser, tIssue, tIssueWorklog, tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:aggregate-and-group-by/group-by-non-aggregated-columns', async () => {
        const expected = [
            { organizationId: 1, organizationName: 'Acme Corp', kind: 'organization', projectCount: 2 },
            { organizationId: 2, organizationName: 'Globex Ltd', kind: 'organization', projectCount: 2 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const projectCountPerOrganization = await connection.selectFrom(tOrganization)
            .innerJoin(tProject).on(tProject.organizationId.equals(tOrganization.id))
            .select({
                organizationId:   tOrganization.id,
                organizationName: tOrganization.name,
                kind:             connection.const('organization', 'string'),
                projectCount:     connection.count(tProject.id),
            })
            .groupByNonAggregatedColumns()
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization.id as "organizationId", organization.name as "organizationName", $1::text as kind, count(project.id) as "projectCount" from organization inner join project on project.organization_id = organization.id group by organization.id, organization.name"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "organization",
          ]
        `)
        assertType<Exact<typeof projectCountPerOrganization, Array<{
            organizationId:   number
            organizationName: string
            kind:             string
            projectCount:     number
        }>>>()
        expect(projectCountPerOrganization.toSorted((a, b) => a.organizationId - b.organizationId)).toEqual(expected)
    })

    test('docs:aggregate-and-group-by/group-by-column-names', async () => {
        const expected = [
            { organizationId: 1, organizationName: 'Acme Corp', projectCount: 2 },
            { organizationId: 2, organizationName: 'Globex Ltd', projectCount: 2 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const projectCountPerOrganization = await connection.selectFrom(tOrganization)
            .innerJoin(tProject).on(tProject.organizationId.equals(tOrganization.id))
            .select({
                organizationId:   tOrganization.id,
                organizationName: tOrganization.name,
                projectCount:     connection.count(tProject.id),
            })
            .groupBy('organizationId', 'organizationName')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization.id as "organizationId", organization.name as "organizationName", count(project.id) as "projectCount" from organization inner join project on project.organization_id = organization.id group by organization.id, organization.name"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof projectCountPerOrganization, Array<{
            organizationId:   number
            organizationName: string
            projectCount:     number
        }>>>()
        expect(projectCountPerOrganization.toSorted((a, b) => a.organizationId - b.organizationId)).toEqual(expected)
    })

    test('docs:aggregate-and-group-by/group-by-column-with-parameter', async () => {
        // Ada and Alan share an initial; Grace is alone.
        const expected = [
            { initial: 'A', userCount: 2 },
            { initial: 'G', userCount: 1 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const userCountPerInitial = await connection.selectFrom(tAppUser)
            .select({
                initial:   tAppUser.fullName.substr(0, 1),
                userCount: connection.count(tAppUser.id),
            })
            .groupBy('initial')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select substr(full_name, $1, $2) as initial, count(id) as "userCount" from app_user group by substr(full_name, $1, $2)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            1,
          ]
        `)
        assertType<Exact<typeof userCountPerInitial, Array<{
            initial:   string
            userCount: number
        }>>>()
        expect(userCountPerInitial.toSorted((a, b) => a.initial.localeCompare(b.initial))).toEqual(expected)
    })

    test('docs:aggregate-and-group-by/column-left-out-of-group-by', async () => {
        // An organization has several projects, so the project name has several values in each group.
        const expected = [
            { organizationId: 1, projectName: 'Marketing site', projectCount: 2 },
            { organizationId: 2, projectName: 'Public API', projectCount: 2 },
        ]
        // The mock has no engine to reject the query, so it hands back the rows.
        ctx.mockNext(expected)
        const connection = ctx.conn
        let rows: Array<{ organizationId: number; projectName: string; projectCount: number }> | undefined
        let rejection: TsSqlErrorReason | undefined

        // doc-start
        const projectCountPerOrganization = connection.selectFrom(tProject)
            .select({
                organizationId: tProject.organizationId,
                projectName:    tProject.name,
                projectCount:   connection.count(tProject.id),
            })
            .groupBy('organizationId')
            .executeSelectMany()
        // doc-end

        try {
            rows = await projectCountPerOrganization
        } catch (e) {
            if (e instanceof TsSqlError) rejection = e.errorReason
        }

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization_id as "organizationId", name as "projectName", count(id) as "projectCount" from project group by organization_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof projectCountPerOrganization, Promise<Array<{
            organizationId: number
            projectName:    string
            projectCount:   number
        }>>>>()
        expect(rejection?.reason).toBe(ctx.realDbEnabled ? 'SQL_INVALID_SQL_STATEMENT' : undefined)
        expect(rows).toEqual(ctx.realDbEnabled ? undefined : expected)
    })

    test('docs:aggregate-and-group-by/choosing-value-with-min', async () => {
        const expected = [
            { organizationId: 1, projectName: 'Internal tools', projectCount: 2 },
            { organizationId: 2, projectName: 'Legacy app', projectCount: 2 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const projectCountPerOrganization = await connection.selectFrom(tProject)
            .select({
                organizationId: tProject.organizationId,
                projectName:    connection.min(tProject.name),
                projectCount:   connection.count(tProject.id),
            })
            .groupBy('organizationId')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization_id as "organizationId", min(name) as "projectName", count(id) as "projectCount" from project group by organization_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof projectCountPerOrganization, Array<{
            organizationId: number
            projectName?:   string
            projectCount:   number
        }>>>()
        expect(projectCountPerOrganization.toSorted((a, b) => a.organizationId - b.organizationId)).toEqual(expected)
    })

    test('docs:aggregate-and-group-by/having-by-select-columns', async () => {
        // Project 1 has two issues; the other projects have fewer.
        const expected = [
            { projectId: 1, projectName: 'Marketing site', issueCount: 2 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const projectsWithSeveralIssues = await connection.selectFrom(tProject)
            .innerJoin(tIssue).on(tIssue.projectId.equals(tProject.id))
            .select({
                projectId:   tProject.id,
                projectName: tProject.name,
                issueCount:  connection.count(tIssue.id),
            })
            .groupByNonAggregatedColumns()
            .having(columns => columns.issueCount.greaterThan(1))
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as "projectId", project.name as "projectName", count(issue.id) as "issueCount" from project inner join issue on issue.project_id = project.id group by project.id, project.name having count(issue.id) > $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof projectsWithSeveralIssues, Array<{
            projectId:   number
            projectName: string
            issueCount:  number
        }>>>()
        expect(projectsWithSeveralIssues).toEqual(expected)
    })

    test('docs:aggregate-and-group-by/any-value', async () => {
        // Every project of a group belongs to the same organization, so its name has a single value.
        const expected = [
            { organizationId: 1, organizationName: 'Acme Corp', projectCount: 2 },
            { organizationId: 2, organizationName: 'Globex Ltd', projectCount: 2 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const projectCountPerOrganization = await connection.selectFrom(tProject)
            .innerJoin(tOrganization).on(tOrganization.id.equals(tProject.organizationId))
            .select({
                organizationId:   tProject.organizationId,
                organizationName: connection.anyValue(tOrganization.name),
                projectCount:     connection.count(tProject.id),
            })
            .groupBy('organizationId')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.organization_id as "organizationId", any_value(organization.name) as "organizationName", count(project.id) as "projectCount" from project inner join organization on organization.id = project.organization_id group by project.organization_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof projectCountPerOrganization, Array<{
            organizationId:    number
            organizationName?: string
            projectCount:      number
        }>>>()
        expect(projectCountPerOrganization.toSorted((a, b) => a.organizationId - b.organizationId)).toEqual(expected)
    })

    test('docs:aggregate-and-group-by/group-by-expressions', async () => {
        const expected = [
            { organizationId: 1, organizationName: 'Acme Corp', projectCount: 2 },
            { organizationId: 2, organizationName: 'Globex Ltd', projectCount: 2 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const projectCountPerOrganization = await connection.selectFrom(tOrganization)
            .innerJoin(tProject).on(tProject.organizationId.equals(tOrganization.id))
            .groupBy(tOrganization.id, tOrganization.name)
            .select({
                organizationId:   tOrganization.id,
                organizationName: tOrganization.name,
                projectCount:     connection.count(tProject.id),
            })
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization.id as "organizationId", organization.name as "organizationName", count(project.id) as "projectCount" from organization inner join project on project.organization_id = organization.id group by organization.id, organization.name"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof projectCountPerOrganization, Array<{
            organizationId:   number
            organizationName: string
            projectCount:     number
        }>>>()
        expect(projectCountPerOrganization.toSorted((a, b) => a.organizationId - b.organizationId)).toEqual(expected)
    })

    test('docs:aggregate-and-group-by/having-before-select', async () => {
        const expected = [
            { projectId: 1, projectName: 'Marketing site', issueCount: 2 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const projectsWithSeveralIssues = await connection.selectFrom(tProject)
            .innerJoin(tIssue).on(tIssue.projectId.equals(tProject.id))
            .groupBy(tProject.id, tProject.name)
            .having(connection.count(tIssue.id).greaterThan(1))
            .select({
                projectId:   tProject.id,
                projectName: tProject.name,
                issueCount:  connection.count(tIssue.id),
            })
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as "projectId", project.name as "projectName", count(issue.id) as "issueCount" from project inner join issue on issue.project_id = project.id group by project.id, project.name having count(issue.id) > $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof projectsWithSeveralIssues, Array<{
            projectId:   number
            projectName: string
            issueCount:  number
        }>>>()
        expect(projectsWithSeveralIssues).toEqual(expected)
    })

    test('docs:aggregate-and-group-by/having-column-not-grouped', async () => {
        // Issue 1 has two worklogs and an assignee; issue 2 has one worklog.
        const expected = [
            { issueId: 1, worklogCount: 2 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const assignedIssuesWithSeveralWorklogs = await connection.selectFrom(tIssue)
            .innerJoin(tIssueWorklog).on(tIssueWorklog.issueId.equals(tIssue.id))
            .groupBy(tIssue.id)
            .having(connection.count(tIssueWorklog.id).greaterThan(1).and(tIssue.assigneeId.isNotNull()))
            .select({
                issueId:      tIssue.id,
                worklogCount: connection.count(tIssueWorklog.id),
            })
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as "issueId", count(issue_worklog.id) as "worklogCount" from issue inner join issue_worklog on issue_worklog.issue_id = issue.id group by issue.id having count(issue_worklog.id) > $1 and issue.assignee_id is not null"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof assignedIssuesWithSeveralWorklogs, Array<{
            issueId:      number
            worklogCount: number
        }>>>()
        expect(assignedIssuesWithSeveralWorklogs).toEqual(expected)
    })

    test('docs:aggregate-and-group-by/having-select-first', async () => {
        const expected = [
            { issueId: 1, assigneeId: 1, worklogCount: 2 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const assignedIssuesWithSeveralWorklogs = await connection.selectFrom(tIssue)
            .innerJoin(tIssueWorklog).on(tIssueWorklog.issueId.equals(tIssue.id))
            .select({
                issueId:      tIssue.id,
                assigneeId:   tIssue.assigneeId,
                worklogCount: connection.count(tIssueWorklog.id),
            })
            .groupByNonAggregatedColumns()
            .having(columns => columns.worklogCount.greaterThan(1).and(columns.assigneeId.isNotNull()))
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as "issueId", issue.assignee_id as "assigneeId", count(issue_worklog.id) as "worklogCount" from issue inner join issue_worklog on issue_worklog.issue_id = issue.id group by issue.id, issue.assignee_id having count(issue_worklog.id) > $1 and issue.assignee_id is not null"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof assignedIssuesWithSeveralWorklogs, Array<{
            issueId:      number
            assigneeId?:  number
            worklogCount: number
        }>>>()
        expect(assignedIssuesWithSeveralWorklogs).toEqual(expected)
    })

    test('docs:aggregate-and-group-by/moving-condition-to-where', async () => {
        const expected = [
            { issueId: 1, worklogCount: 2 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const assignedIssuesWithSeveralWorklogs = await connection.selectFrom(tIssue)
            .innerJoin(tIssueWorklog).on(tIssueWorklog.issueId.equals(tIssue.id))
            .where(tIssue.assigneeId.isNotNull())
            .groupBy(tIssue.id)
            .having(connection.count(tIssueWorklog.id).greaterThan(1))
            .select({
                issueId:      tIssue.id,
                worklogCount: connection.count(tIssueWorklog.id),
            })
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as "issueId", count(issue_worklog.id) as "worklogCount" from issue inner join issue_worklog on issue_worklog.issue_id = issue.id where issue.assignee_id is not null group by issue.id having count(issue_worklog.id) > $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof assignedIssuesWithSeveralWorklogs, Array<{
            issueId:      number
            worklogCount: number
        }>>>()
        expect(assignedIssuesWithSeveralWorklogs).toEqual(expected)
    })

    test('docs:aggregate-and-group-by/adding-column-to-group-by', async () => {
        // Issue 1 has two worklogs; issue 2 has one, and passes because no issue has a parent.
        const expected = [
            { issueId: 1, worklogCount: 2 },
            { issueId: 2, worklogCount: 1 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const issuesToReview = await connection.selectFrom(tIssue)
            .innerJoin(tIssueWorklog).on(tIssueWorklog.issueId.equals(tIssue.id))
            .groupBy(tIssue.id, tIssue.parentId)
            .having(connection.count(tIssueWorklog.id).greaterThan(1).or(tIssue.parentId.isNull()))
            .select({
                issueId:      tIssue.id,
                worklogCount: connection.count(tIssueWorklog.id),
            })
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as "issueId", count(issue_worklog.id) as "worklogCount" from issue inner join issue_worklog on issue_worklog.issue_id = issue.id group by issue.id, issue.parent_id having count(issue_worklog.id) > $1 or issue.parent_id is null"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof issuesToReview, Array<{
            issueId:      number
            worklogCount: number
        }>>>()
        expect(issuesToReview.toSorted((a, b) => a.issueId - b.issueId)).toEqual(expected)
    })

    test('docs:aggregate-and-group-by/parameter-expression-written-again', async () => {
        const expected = [
            { initial: 'A', userCount: 2 },
            { initial: 'G', userCount: 1 },
        ]
        // The mock has no engine to reject the query, so it hands back the rows.
        ctx.mockNext(expected)
        const connection = ctx.conn
        let rows: Array<{ initial: string; userCount: number }> | undefined
        let rejection: TsSqlErrorReason | undefined

        // doc-start
        const userCountPerInitial = connection.selectFrom(tAppUser)
            .groupBy(tAppUser.fullName.substr(0, 1))
            .select({
                initial:   tAppUser.fullName.substr(0, 1),
                userCount: connection.count(tAppUser.id),
            })
            .executeSelectMany()
        // doc-end

        try {
            rows = await userCountPerInitial
        } catch (e) {
            if (e instanceof TsSqlError) rejection = e.errorReason
        }

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select substr(full_name, $1, $2) as initial, count(id) as "userCount" from app_user group by substr(full_name, $3, $4)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            1,
            1,
            1,
          ]
        `)
        assertType<Exact<typeof userCountPerInitial, Promise<Array<{
            initial:   string
            userCount: number
        }>>>>()
        expect(rejection?.reason).toBe(ctx.realDbEnabled ? 'SQL_INVALID_SQL_STATEMENT' : undefined)
        expect(rows).toEqual(ctx.realDbEnabled ? undefined : expected)
    })

    test('docs:aggregate-and-group-by/one-row-per-group', async () => {
        // Issue 1 has the minutes 90 and 30; issue 2 only has a null, so its sum has no value.
        const expected = [
            { issueId: 1, worklogs: 2, totalMinutes: 120 },
            { issueId: 2, worklogs: 1 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const worklogsPerIssue = await connection.selectFrom(tIssueWorklog)
            .select({
                issueId:      tIssueWorklog.issueId,
                worklogs:     connection.countAll(),
                totalMinutes: connection.sum(tIssueWorklog.minutes),
            })
            .groupBy('issueId')
            .orderBy('issueId')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue_id as "issueId", count(*) as worklogs, sum(minutes) as "totalMinutes" from issue_worklog group by issue_id order by "issueId""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof worklogsPerIssue, Array<{
            issueId:       number
            worklogs:      number
            totalMinutes?: number
        }>>>()
        expect(worklogsPerIssue).toEqual(expected)
    })

    test('docs:aggregate-and-group-by/where-and-having', async () => {
        // Issue 3 has no assignee, so project 2 has no group; project 3 only has one issue.
        const expected = [
            { projectId: 1, issues: 2 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const projectsWithSeveralAssignedIssues = await connection.selectFrom(tIssue)
            .where(tIssue.assigneeId.isNotNull())
            .select({
                projectId: tIssue.projectId,
                issues:    connection.countAll(),
            })
            .groupBy('projectId')
            .having(columns => columns.issues.greaterOrEqual(2))
            .orderBy('projectId')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as "projectId", count(*) as issues from issue where assignee_id is not null group by project_id having count(*) >= $1 order by "projectId""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof projectsWithSeveralAssignedIssues, Array<{
            projectId: number
            issues:    number
        }>>>()
        expect(projectsWithSeveralAssignedIssues).toEqual(expected)
    })

    test('docs:aggregate-and-group-by/every-function-with-nulls', async () => {
        // The minutes of the worklogs are 90, null and 30.
        const expected = {
            worklogs:        3,
            withMinutes:     2,
            differentValues: 2,
            total:           120,
            totalDistinct:   120,
            average:         60,
            averageDistinct: 60,
            lowest:          30,
            highest:         90,
        }
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const statistics = await connection.selectFrom(tIssueWorklog)
            .select({
                worklogs:        connection.countAll(),
                withMinutes:     connection.count(tIssueWorklog.minutes),
                differentValues: connection.countDistinct(tIssueWorklog.minutes),
                total:           connection.sum(tIssueWorklog.minutes),
                totalDistinct:   connection.sumDistinct(tIssueWorklog.minutes),
                average:         connection.average(tIssueWorklog.minutes),
                averageDistinct: connection.averageDistinct(tIssueWorklog.minutes),
                lowest:          connection.min(tIssueWorklog.minutes),
                highest:         connection.max(tIssueWorklog.minutes),
            })
            .executeSelectOne()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select count(*) as worklogs, count(minutes) as "withMinutes", count(distinct minutes) as "differentValues", sum(minutes) as total, sum(distinct minutes) as "totalDistinct", avg(minutes::float) as average, avg(distinct minutes::float) as "averageDistinct", min(minutes) as lowest, max(minutes) as highest from issue_worklog"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof statistics, {
            worklogs:         number
            withMinutes:      number
            differentValues:  number
            total?:           number
            totalDistinct?:   number
            average?:         number
            averageDistinct?: number
            lowest?:          number
            highest?:         number
        }>>()
        expect(statistics).toEqual(expected)
    })

    test('docs:aggregate-and-group-by/no-rows-without-group-by', async () => {
        // The row is returned without any issue to aggregate, with the counts in 0 and no other value.
        const expected = { worklogs: 0, withMinutes: 0 }
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const statistics = await connection.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.issueId.equals(999))
            .select({
                worklogs:     connection.countAll(),
                withMinutes:  connection.count(tIssueWorklog.minutes),
                totalMinutes: connection.sum(tIssueWorklog.minutes),
                highest:      connection.max(tIssueWorklog.minutes),
            })
            .executeSelectOne()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select count(*) as worklogs, count(minutes) as "withMinutes", sum(minutes) as "totalMinutes", max(minutes) as highest from issue_worklog where issue_id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            999,
          ]
        `)
        assertType<Exact<typeof statistics, {
            worklogs:      number
            withMinutes:   number
            totalMinutes?: number
            highest?:      number
        }>>()
        expect(statistics).toEqual(expected)
    })

    test('docs:aggregate-and-group-by/no-rows-with-group-by', async () => {
        // No rows means no groups.
        ctx.mockNext([])
        const connection = ctx.conn

        // doc-start
        const worklogsPerIssue = await connection.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.issueId.equals(999))
            .select({
                issueId:  tIssueWorklog.issueId,
                worklogs: connection.countAll(),
            })
            .groupBy('issueId')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue_id as "issueId", count(*) as worklogs from issue_worklog where issue_id = $1 group by issue_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            999,
          ]
        `)
        assertType<Exact<typeof worklogsPerIssue, Array<{
            issueId:  number
            worklogs: number
        }>>>()
        expect(worklogsPerIssue).toEqual([])
    })

    test('docs:aggregate-and-group-by/value-when-null', async () => {
        // Issue 2 only has a null in the minutes, so it gets the 0.
        const expected = [
            { issueId: 1, totalMinutes: 120 },
            { issueId: 2, totalMinutes: 0 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const totalMinutesPerIssue = await connection.selectFrom(tIssueWorklog)
            .select({
                issueId:      tIssueWorklog.issueId,
                totalMinutes: connection.sum(tIssueWorklog.minutes).valueWhenNull(0),
            })
            .groupBy('issueId')
            .orderBy('issueId')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue_id as "issueId", coalesce(sum(minutes), $1) as "totalMinutes" from issue_worklog group by issue_id order by "issueId""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0,
          ]
        `)
        assertType<Exact<typeof totalMinutesPerIssue, Array<{
            issueId:      number
            totalMinutes: number
        }>>>()
        expect(totalMinutesPerIssue).toEqual(expected)
    })

    test('docs:aggregate-and-group-by/count-with-left-join', async () => {
        // Project 4 has no issues: its row has the columns of issue in null, so count of a column of issue is 0.
        const expected = [
            { projectId: 1, issues: 2 },
            { projectId: 2, issues: 1 },
            { projectId: 3, issues: 1 },
            { projectId: 4, issues: 0 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const tIssueOfProject = tIssue.forUseInLeftJoin()

        const issuesOfEachProject = await connection.selectFrom(tProject)
            .leftJoin(tIssueOfProject).on(tIssueOfProject.projectId.equals(tProject.id))
            .select({
                projectId: tProject.id,
                issues:    connection.count(tIssueOfProject.id),
            })
            .groupBy('projectId')
            .orderBy('projectId')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as "projectId", count(issue.id) as issues from project left join issue on issue.project_id = project.id group by project.id order by "projectId""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof issuesOfEachProject, Array<{
            projectId: number
            issues:    number
        }>>>()
        expect(issuesOfEachProject).toEqual(expected)
    })

    test('docs:aggregate-and-group-by/string-concat', async () => {
        // The bodies are null, 'Use new tokens', null and 'See ADR-014': the nulls are ignored.
        ctx.mockNext({ bodies: 'See ADR-014, Use new tokens' })
        const connection = ctx.conn

        // doc-start
        const row = await connection.selectFrom(tIssue)
            .select({
                bodies: connection.stringConcat(tIssue.body, ', '),
            })
            .executeSelectOne()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select string_agg(body, $1) as bodies from issue"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            ", ",
          ]
        `)
        assertType<Exact<typeof row, { bodies?: string }>>()
        expect(row.bodies?.split(', ').toSorted()).toEqual(['See ADR-014', 'Use new tokens'])
    })

    test('docs:aggregate-and-group-by/string-concat-distinct', async () => {
        // The statuses are open, in_progress, open and closed.
        ctx.mockNext('closed,in_progress,open')
        const connection = ctx.conn

        // doc-start
        const differentStatuses = await connection.selectFrom(tIssue)
            .selectOneColumn(connection.stringConcatDistinct(tIssue.status))
            .executeSelectOne()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select string_agg(distinct status, ',') as result from issue"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof differentStatuses, string | null>>()
        expect(differentStatuses?.split(',').toSorted()).toEqual(['closed', 'in_progress', 'open'])
    })

    test('docs:aggregate-and-group-by/group-by-column-not-returned', async () => {
        // The issues of the projects 1, 2 and 3, without returning the project.
        ctx.mockNext([{ issues: 2 }, { issues: 1 }, { issues: 1 }])
        const connection = ctx.conn

        // doc-start
        const issueCounts = await connection.selectFrom(tIssue)
            .groupBy(tIssue.projectId)
            .select({
                issues: connection.countAll(),
            })
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select count(*) as issues from issue group by project_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof issueCounts, Array<{ issues: number }>>>()
        expect(issueCounts.map(row => row.issues).toSorted()).toEqual([1, 1, 2])
    })

    test('docs:aggregate-and-group-by/group-by-column-after-select', async () => {
        ctx.mockNext([{ issues: 2 }, { issues: 1 }, { issues: 1 }])
        const connection = ctx.conn

        // doc-start
        const issueCounts = await connection.selectFrom(tIssue)
            .select({
                issues: connection.countAll(),
            })
            .groupBy(tIssue.projectId)
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select count(*) as issues from issue group by project_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof issueCounts, Array<{ issues: number }>>>()
        expect(issueCounts.map(row => row.issues).toSorted()).toEqual([1, 1, 2])
    })

    test('docs:aggregate-and-group-by/group-by-nested-property', async () => {
        const expected = [
            { project: { id: 1 }, issues: 2 },
            { project: { id: 2 }, issues: 1 },
            { project: { id: 3 }, issues: 1 },
        ]
        ctx.mockNext([
            { 'project.id': 1, issues: 2 },
            { 'project.id': 2, issues: 1 },
            { 'project.id': 3, issues: 1 },
        ])
        const connection = ctx.conn

        // doc-start
        const issuesPerProject = await connection.selectFrom(tIssue)
            .select({
                project: {
                    id: tIssue.projectId,
                },
                issues: connection.countAll(),
            })
            .groupBy('project.id')
            .orderBy('project.id')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as "project.id", count(*) as issues from issue group by project_id order by "project.id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof issuesPerProject, Array<{
            project: { id: number }
            issues:  number
        }>>>()
        expect(issuesPerProject).toEqual(expected)
    })

    test('docs:aggregate-and-group-by/order-by-aggregate-name', async () => {
        const expected = [
            { projectId: 1, issues: 2 },
            { projectId: 2, issues: 1 },
            { projectId: 3, issues: 1 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const projectsByIssues = await connection.selectFrom(tIssue)
            .select({
                projectId: tIssue.projectId,
                issues:    connection.countAll(),
            })
            .groupBy('projectId')
            .orderBy('issues', 'desc')
            .orderBy('projectId')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as "projectId", count(*) as issues from issue group by project_id order by issues desc, "projectId""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof projectsByIssues, Array<{
            projectId: number
            issues:    number
        }>>>()
        expect(projectsByIssues).toEqual(expected)
    })

    test('docs:aggregate-and-group-by/order-by-aggregate-not-returned', async () => {
        const expected = [
            { projectId: 1 },
            { projectId: 2 },
            { projectId: 3 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const projectIdsByIssues = await connection.selectFrom(tIssue)
            .select({
                projectId: tIssue.projectId,
            })
            .groupBy('projectId')
            .orderBy(connection.countAll(), 'desc')
            .orderBy('projectId')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as "projectId" from issue group by project_id order by count(*) desc, "projectId""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof projectIdsByIssues, Array<{ projectId: number }>>>()
        expect(projectIdsByIssues).toEqual(expected)
    })

    test('docs:aggregate-and-group-by/order-by-aggregate-nulls-last', async () => {
        // Issue 2 has no minutes to add, so it goes last.
        const expected = [
            { issueId: 1, totalMinutes: 120 },
            { issueId: 2 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const issuesByMinutes = await connection.selectFrom(tIssueWorklog)
            .select({
                issueId:      tIssueWorklog.issueId,
                totalMinutes: connection.sum(tIssueWorklog.minutes),
            })
            .groupBy('issueId')
            .orderBy('totalMinutes', 'desc nulls last')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue_id as "issueId", sum(minutes) as "totalMinutes" from issue_worklog group by issue_id order by "totalMinutes" desc nulls last"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof issuesByMinutes, Array<{
            issueId:       number
            totalMinutes?: number
        }>>>()
        expect(issuesByMinutes).toEqual(expected)
    })
})
