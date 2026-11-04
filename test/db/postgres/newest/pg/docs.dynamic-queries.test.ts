// Documentation snippets for the Dynamic queries page
// (docs/queries/dynamic-queries.md). Demonstrates the `*IfValue` helpers
// (omit a predicate when the value is null/undefined/empty) and
// `dynamicBooleanExpressionUsing` for builder-style composition.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

const byTitleDescending = (a: { title: string }, b: { title: string }) => b.title.localeCompare(a.title)

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:dynamic-queries/easy-dynamic-queries', async () => {
        const expected = [
            { id: 2, name: 'Internal tools tools' },
            { id: 1, name: 'Marketing site mktg-site' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const nameContains = 'te'
        const slugContains = null
        const archivedAtIs = null
        const searchOrderBy = 'name insensitive, archivedAt asc nulls last'

        const searchedProjects = await connection.selectFrom(tProject)
            .where(
                        tProject.name.containsIfValue(nameContains)
                    .or(tProject.slug.containsIfValue(slugContains))
                ).and(
                    tProject.archivedAt.equalsIfValue(archivedAtIs)
                )
            .select({
                id:         tProject.id,
                name:       tProject.name.concat(' ').concat(tProject.slug),
                archivedAt: tProject.archivedAt,
            })
            .orderByFromString(searchOrderBy)
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name || $1 || slug as name, archived_at as "archivedAt" from project where name like ('%' || $2 || '%') order by lower(name || $1 || slug), "archivedAt" asc nulls last"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            " ",
            "te",
          ]
        `)
        assertType<Exact<typeof searchedProjects, Array<{
            id:          number
            name:        string
            archivedAt?: Date
        }>>>()
        expect(searchedProjects).toEqual(expected)
    })

    test('docs:dynamic-queries/only-when', async () => {
        const expected = [
            { title: 'Update hero copy', status: 'open' },
            { title: 'Redesign navbar',  status: 'in_progress', body: 'Use new tokens' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const userProjectId = 1
        const onlyIssuesOfUserProject = true

        const issues = await connection.selectFrom(tIssue)
            .where(tIssue.projectId.equals(userProjectId).onlyWhen(onlyIssuesOfUserProject))
            .select({
                title:  tIssue.title,
                status: tIssue.status,
                body:   tIssue.body,
            })
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select title as title, status as status, body as body from issue where project_id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof issues, Array<{
            title:  string
            status: string
            body?:  string
        }>>>()
        // The query has no order by.
        expect([...issues].sort(byTitleDescending)).toEqual(expected)
    })

    test('docs:dynamic-queries/only-when-false', async () => {
        const expected = [
            { title: 'Update hero copy',   status: 'open' },
            { title: 'Redesign navbar',    status: 'in_progress', body: 'Use new tokens' },
            { title: 'Migrate to ESM',     status: 'open' },
            { title: 'Document /v2/users', status: 'closed', body: 'See ADR-014' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const userProjectId = 1
        const onlyIssuesOfUserProject = false // CHANGED

        const issues = await connection.selectFrom(tIssue)
            .where(tIssue.projectId.equals(userProjectId).onlyWhen(onlyIssuesOfUserProject))
            .select({
                title:  tIssue.title,
                status: tIssue.status,
                body:   tIssue.body,
            })
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select title as title, status as status, body as body from issue"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof issues, Array<{
            title:  string
            status: string
            body?:  string
        }>>>()
        // The query has no order by.
        expect([...issues].sort(byTitleDescending)).toEqual(expected)
    })

    test('docs:dynamic-queries/no-value-boolean', async () => {
        const expected = [
            { id: 1, title: 'Update hero copy' },
            { id: 2, title: 'Redesign navbar' },
            { id: 3, title: 'Migrate to ESM' },
            { id: 4, title: 'Document /v2/users' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const canSeeEveryProject: boolean = true
        const userProjectId = 1

        const issues = await connection.selectFrom(tIssue)
            .where(canSeeEveryProject ? connection.noValueBoolean() : tIssue.projectId.equals(userProjectId))
            .select({
                id:    tIssue.id,
                title: tIssue.title,
            })
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title from issue"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof issues, Array<{
            id:    number
            title: string
        }>>>()
        // The query has no order by.
        expect([...issues].sort((a, b) => a.id - b.id)).toEqual(expected)
    })

    test('docs:dynamic-queries/only-when-or-null', async () => {
        const expected = { id: 2, title: 'Redesign navbar', status: 'in_progress', body: 'Use new tokens' }
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const issueId = 2
        const displayNames = true

        const issueWithRules = await connection.selectFrom(tIssue)
            .where(tIssue.id.equals(issueId))
            .select({
                id:     tIssue.id,
                title:  tIssue.title.onlyWhenOrNull(displayNames),
                status: tIssue.status.onlyWhenOrNull(displayNames),
                body:   tIssue.body,
            })
            .executeSelectOne()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title, status as status, body as body from issue where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof issueWithRules, {
            id:      number
            title?:  string
            status?: string
            body?:   string
        }>>()
        expect(issueWithRules).toEqual(expected)
    })

    test('docs:dynamic-queries/only-when-or-null-false', async () => {
        const expected = { id: 2, body: 'Use new tokens' }
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const issueId = 2
        const displayNames = false // CHANGED

        const issueWithRules = await connection.selectFrom(tIssue)
            .where(tIssue.id.equals(issueId))
            .select({
                id:     tIssue.id,
                title:  tIssue.title.onlyWhenOrNull(displayNames),
                status: tIssue.status.onlyWhenOrNull(displayNames),
                body:   tIssue.body,
            })
            .executeSelectOne()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, null::text as title, null::text as status, body as body from issue where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof issueWithRules, {
            id:      number
            title?:  string
            status?: string
            body?:   string
        }>>()
        expect(issueWithRules).toEqual(expected)
    })

    test('docs-extra:dynamic-queries/ignore-when-as-null', async () => {
        // `ignoreWhenAsNull(cond)` is the opposite of `onlyWhenOrNull`: null when cond is true.
        const expected = { id: 2, title: 'Redesign navbar' }
        ctx.mockNext(expected)
        const connection = ctx.conn

        const hide = true
        const issue = await connection.selectFrom(tIssue)
            .where(tIssue.id.equals(2))
            .select({
                id:    tIssue.id,
                title: tIssue.title,
                body:  tIssue.body.ignoreWhenAsNull(hide),
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title, null::text as body from issue where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof issue, {
            id:    number
            title: string
            body?: string
        }>>()
        expect(issue).toEqual(expected)
    })

    test('docs:dynamic-queries/dynamic-on-and-having', async () => {
        // Without an archive date: two projects of 'Acme Corp', one of 'Globex Ltd'.
        const expected = [{ id: 1, name: 'Acme Corp', projectCount: 2 }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const onlyProjectsNotArchived = true
        const minimumProjects: number | undefined = 2

        const query = connection.selectFrom(tOrganization)
            .innerJoin(tProject).dynamicOn()
            .and(tProject.organizationId.equals(tOrganization.id))
        if (onlyProjectsNotArchived) {
            query.and(tProject.archivedAt.isNull())
        }

        const grouped = query.groupBy(tOrganization.id, tOrganization.name).dynamicHaving()
        if (minimumProjects !== undefined) {
            grouped.and(connection.count(tProject.id).greaterOrEqual(minimumProjects))
        }

        const organizations = await grouped
            .select({
                id:           tOrganization.id,
                name:         tOrganization.name,
                projectCount: connection.count(tProject.id),
            })
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization.id as id, organization.name as name, count(project.id) as "projectCount" from organization inner join project on project.organization_id = organization.id and project.archived_at is null group by organization.id, organization.name having count(project.id) >= $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof organizations, Array<{
            id:           number
            name:         string
            projectCount: number
        }>>>()
        expect(organizations).toEqual(expected)
    })

    test('docs:dynamic-queries/optional-join-with-value', async () => {
        const expected = [
            { title: 'Update hero copy', status: 'open' },
            { title: 'Redesign navbar',  status: 'in_progress', body: 'Use new tokens' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const projectName = 'Marketing site'

        const issues = await connection.selectFrom(tIssue)
            .optionalJoin(tProject).on(tProject.id.equals(tIssue.projectId))
            .where(tProject.name.equalsIfValue(projectName))
            .select({
                title:  tIssue.title,
                status: tIssue.status,
                body:   tIssue.body,
            })
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.title as title, issue.status as status, issue.body as body from issue join project on project.id = issue.project_id where project.name = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Marketing site",
          ]
        `)
        assertType<Exact<typeof issues, Array<{
            title:  string
            status: string
            body?:  string
        }>>>()
        // The query has no order by.
        expect([...issues].sort(byTitleDescending)).toEqual(expected)
    })

    test('docs:dynamic-queries/optional-join', async () => {
        const expected = [
            { title: 'Update hero copy',   status: 'open' },
            { title: 'Redesign navbar',    status: 'in_progress', body: 'Use new tokens' },
            { title: 'Migrate to ESM',     status: 'open' },
            { title: 'Document /v2/users', status: 'closed', body: 'See ADR-014' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const projectName = null // CHANGED

        const issues = await connection.selectFrom(tIssue)
            .optionalJoin(tProject).on(tProject.id.equals(tIssue.projectId))
            .where(tProject.name.equalsIfValue(projectName))
            .select({
                title:  tIssue.title,
                status: tIssue.status,
                body:   tIssue.body,
            })
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select title as title, status as status, body as body from issue"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof issues, Array<{
            title:  string
            status: string
            body?:  string
        }>>>()
        // The query has no order by.
        expect([...issues].sort(byTitleDescending)).toEqual(expected)
    })

    test('docs:dynamic-queries/optional-join-only-when-or-null', async () => {
        const expected = [{ id: 2, title: 'Redesign navbar', status: 'in_progress', body: 'Use new tokens' }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const canSeeProjectInfo = false

        const issueWithOptionalProject = await connection.selectFrom(tIssue)
            .optionalInnerJoin(tProject).on(tProject.id.equals(tIssue.projectId))
            .select({
                id:          tIssue.id,
                title:       tIssue.title,
                status:      tIssue.status,
                body:        tIssue.body,
                projectId:   tProject.id.onlyWhenOrNull(canSeeProjectInfo),
                projectName: tProject.name.onlyWhenOrNull(canSeeProjectInfo),
            })
            .where(tIssue.id.equals(2))
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title, status as status, body as body, null::int4 as "projectId", null::text as "projectName" from issue where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof issueWithOptionalProject, Array<{
            id:           number
            title:        string
            status:       string
            body?:        string
            projectId?:   number
            projectName?: string
        }>>>()
        expect(issueWithOptionalProject).toEqual(expected)
    })

    test('docs:dynamic-queries/optional-join-only-when-or-null-true', async () => {
        const expected = [{
            id:          2,
            title:       'Redesign navbar',
            status:      'in_progress',
            body:        'Use new tokens',
            projectId:   1,
            projectName: 'Marketing site',
        }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const canSeeProjectInfo = true // CHANGED

        const issueWithOptionalProject = await connection.selectFrom(tIssue)
            .optionalInnerJoin(tProject).on(tProject.id.equals(tIssue.projectId))
            .select({
                id:          tIssue.id,
                title:       tIssue.title,
                status:      tIssue.status,
                body:        tIssue.body,
                projectId:   tProject.id.onlyWhenOrNull(canSeeProjectInfo),
                projectName: tProject.name.onlyWhenOrNull(canSeeProjectInfo),
            })
            .where(tIssue.id.equals(2))
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, issue.title as title, issue.status as status, issue.body as body, project.id as "projectId", project.name as "projectName" from issue inner join project on project.id = issue.project_id where issue.id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof issueWithOptionalProject, Array<{
            id:           number
            title:        string
            status:       string
            body?:        string
            projectId?:   number
            projectName?: string
        }>>>()
        expect(issueWithOptionalProject).toEqual(expected)
    })
})
