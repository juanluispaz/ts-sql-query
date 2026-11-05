// Documentation snippets for the Aggregate and group by page (docs/queries/aggregate-and-group-by.md).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tOrganization, tProject, tAppUser, tIssue, tIssueWorklog } from '../../domain/connection.js'
import { ctx } from './setup.js'
import { sync } from '../../../../../src/extras/sync.js'

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
        const projectCountPerOrganization = sync(connection.selectFrom(tOrganization)
            .innerJoin(tProject).on(tProject.organizationId.equals(tOrganization.id))
            .select({
                organizationId:   tOrganization.id,
                organizationName: tOrganization.name,
                kind:             connection.const('organization', 'string'),
                projectCount:     connection.count(tProject.id),
            })
            .groupByNonAggregatedColumns()
            .executeSelectMany())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization.id as organizationId, organization.name as organizationName, ?1 as kind, count(project.id) as projectCount from organization inner join project on project.organization_id = organization.id group by organization.id, organization.name"`)
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
        const projectCountPerOrganization = sync(connection.selectFrom(tOrganization)
            .innerJoin(tProject).on(tProject.organizationId.equals(tOrganization.id))
            .select({
                organizationId:   tOrganization.id,
                organizationName: tOrganization.name,
                projectCount:     connection.count(tProject.id),
            })
            .groupBy('organizationId', 'organizationName')
            .executeSelectMany())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization.id as organizationId, organization.name as organizationName, count(project.id) as projectCount from organization inner join project on project.organization_id = organization.id group by organization.id, organization.name"`)
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
        const userCountPerInitial = sync(connection.selectFrom(tAppUser)
            .select({
                initial:   tAppUser.fullName.substr(0, 1),
                userCount: connection.count(tAppUser.id),
            })
            .groupBy('initial')
            .executeSelectMany())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select substr(full_name, ?1, ?2) as initial, count(id) as userCount from app_user group by substr(full_name, ?1, ?2)"`)
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
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const projectCountPerOrganization = sync(connection.selectFrom(tProject)
            .select({
                organizationId: tProject.organizationId,
                projectName:    tProject.name,
                projectCount:   connection.count(tProject.id),
            })
            .groupBy('organizationId')
            .executeSelectMany())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization_id as organizationId, name as projectName, count(id) as projectCount from project group by organization_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof projectCountPerOrganization, Array<{
            organizationId: number
            projectName:    string
            projectCount:   number
        }>>>()
        // The name comes from any project of the group.
        const sorted = projectCountPerOrganization.toSorted((a, b) => a.organizationId - b.organizationId)
        expect(sorted.map(row => ({ organizationId: row.organizationId, projectCount: row.projectCount }))).toEqual([
            { organizationId: 1, projectCount: 2 },
            { organizationId: 2, projectCount: 2 },
        ])
        expect(['Marketing site', 'Internal tools'].includes(sorted[0]!.projectName)).toBe(true)
        expect(['Public API', 'Legacy app'].includes(sorted[1]!.projectName)).toBe(true)
    })

    test('docs:aggregate-and-group-by/choosing-value-with-min', async () => {
        const expected = [
            { organizationId: 1, projectName: 'Internal tools', projectCount: 2 },
            { organizationId: 2, projectName: 'Legacy app', projectCount: 2 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const projectCountPerOrganization = sync(connection.selectFrom(tProject)
            .select({
                organizationId: tProject.organizationId,
                projectName:    connection.min(tProject.name),
                projectCount:   connection.count(tProject.id),
            })
            .groupBy('organizationId')
            .executeSelectMany())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization_id as organizationId, min(name) as projectName, count(id) as projectCount from project group by organization_id"`)
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
        const projectsWithSeveralIssues = sync(connection.selectFrom(tProject)
            .innerJoin(tIssue).on(tIssue.projectId.equals(tProject.id))
            .select({
                projectId:   tProject.id,
                projectName: tProject.name,
                issueCount:  connection.count(tIssue.id),
            })
            .groupByNonAggregatedColumns()
            .having(columns => columns.issueCount.greaterThan(1))
            .executeSelectMany())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as projectId, project.name as projectName, count(issue.id) as issueCount from project inner join issue on issue.project_id = project.id group by project.id, project.name having count(issue.id) > ?1"`)
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
        const projectCountPerOrganization = sync(connection.selectFrom(tProject)
            .innerJoin(tOrganization).on(tOrganization.id.equals(tProject.organizationId))
            .select({
                organizationId:   tProject.organizationId,
                organizationName: connection.anyValue(tOrganization.name),
                projectCount:     connection.count(tProject.id),
            })
            .groupBy('organizationId')
            .executeSelectMany())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.organization_id as organizationId, organization.name as organizationName, count(project.id) as projectCount from project inner join organization on organization.id = project.organization_id group by project.organization_id"`)
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
        const projectCountPerOrganization = sync(connection.selectFrom(tOrganization)
            .innerJoin(tProject).on(tProject.organizationId.equals(tOrganization.id))
            .groupBy(tOrganization.id, tOrganization.name)
            .select({
                organizationId:   tOrganization.id,
                organizationName: tOrganization.name,
                projectCount:     connection.count(tProject.id),
            })
            .executeSelectMany())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization.id as organizationId, organization.name as organizationName, count(project.id) as projectCount from organization inner join project on project.organization_id = organization.id group by organization.id, organization.name"`)
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
        const projectsWithSeveralIssues = sync(connection.selectFrom(tProject)
            .innerJoin(tIssue).on(tIssue.projectId.equals(tProject.id))
            .groupBy(tProject.id, tProject.name)
            .having(connection.count(tIssue.id).greaterThan(1))
            .select({
                projectId:   tProject.id,
                projectName: tProject.name,
                issueCount:  connection.count(tIssue.id),
            })
            .executeSelectMany())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as projectId, project.name as projectName, count(issue.id) as issueCount from project inner join issue on issue.project_id = project.id group by project.id, project.name having count(issue.id) > ?1"`)
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
        const assignedIssuesWithSeveralWorklogs = sync(connection.selectFrom(tIssue)
            .innerJoin(tIssueWorklog).on(tIssueWorklog.issueId.equals(tIssue.id))
            .groupBy(tIssue.id)
            .having(connection.count(tIssueWorklog.id).greaterThan(1).and(tIssue.assigneeId.isNotNull()))
            .select({
                issueId:      tIssue.id,
                worklogCount: connection.count(tIssueWorklog.id),
            })
            .executeSelectMany())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as issueId, count(issue_worklog.id) as worklogCount from issue inner join issue_worklog on issue_worklog.issue_id = issue.id group by issue.id having count(issue_worklog.id) > ?1 and issue.assignee_id is not null"`)
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
        const assignedIssuesWithSeveralWorklogs = sync(connection.selectFrom(tIssue)
            .innerJoin(tIssueWorklog).on(tIssueWorklog.issueId.equals(tIssue.id))
            .select({
                issueId:      tIssue.id,
                assigneeId:   tIssue.assigneeId,
                worklogCount: connection.count(tIssueWorklog.id),
            })
            .groupByNonAggregatedColumns()
            .having(columns => columns.worklogCount.greaterThan(1).and(columns.assigneeId.isNotNull()))
            .executeSelectMany())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as issueId, issue.assignee_id as assigneeId, count(issue_worklog.id) as worklogCount from issue inner join issue_worklog on issue_worklog.issue_id = issue.id group by issue.id, issue.assignee_id having count(issue_worklog.id) > ?1 and issue.assignee_id is not null"`)
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
        const assignedIssuesWithSeveralWorklogs = sync(connection.selectFrom(tIssue)
            .innerJoin(tIssueWorklog).on(tIssueWorklog.issueId.equals(tIssue.id))
            .where(tIssue.assigneeId.isNotNull())
            .groupBy(tIssue.id)
            .having(connection.count(tIssueWorklog.id).greaterThan(1))
            .select({
                issueId:      tIssue.id,
                worklogCount: connection.count(tIssueWorklog.id),
            })
            .executeSelectMany())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as issueId, count(issue_worklog.id) as worklogCount from issue inner join issue_worklog on issue_worklog.issue_id = issue.id where issue.assignee_id is not null group by issue.id having count(issue_worklog.id) > ?1"`)
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
        const issuesToReview = sync(connection.selectFrom(tIssue)
            .innerJoin(tIssueWorklog).on(tIssueWorklog.issueId.equals(tIssue.id))
            .groupBy(tIssue.id, tIssue.parentId)
            .having(connection.count(tIssueWorklog.id).greaterThan(1).or(tIssue.parentId.isNull()))
            .select({
                issueId:      tIssue.id,
                worklogCount: connection.count(tIssueWorklog.id),
            })
            .executeSelectMany())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as issueId, count(issue_worklog.id) as worklogCount from issue inner join issue_worklog on issue_worklog.issue_id = issue.id group by issue.id, issue.parent_id having count(issue_worklog.id) > ?1 or issue.parent_id is null"`)
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
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const userCountPerInitial = sync(connection.selectFrom(tAppUser)
            .groupBy(tAppUser.fullName.substr(0, 1))
            .select({
                initial:   tAppUser.fullName.substr(0, 1),
                userCount: connection.count(tAppUser.id),
            })
            .executeSelectMany())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select substr(full_name, ?1, ?2) as initial, count(id) as userCount from app_user group by substr(full_name, ?3, ?4)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            1,
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
})
