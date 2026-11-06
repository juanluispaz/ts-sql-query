// Documentation snippets for the Dynamic queries page
// (docs/queries/dynamic-queries.md). Demonstrates the `*IfValue` helpers
// (omit a predicate when the value is null/undefined/empty) and
// `dynamicBooleanExpressionUsing` for builder-style composition.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tProject, tOrganization } from '../../domain/connection.js'
import { ctx } from './setup.js'
import { TsSqlError } from '../../../../../src/TsSqlError.js'
import { sync } from '../../../../../src/extras/sync.js'

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

        const searchedProjects = sync(connection.selectFrom(tProject)
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
            .executeSelectMany())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name || ?1 || slug as name, archived_at as archivedAt from project where name like ('%' || ?2 || '%') escape '\\' order by lower(name || ?1 || slug), archivedAt asc nulls last"`)
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

        const issues = sync(connection.selectFrom(tIssue)
            .where(tIssue.projectId.equals(userProjectId).onlyWhen(onlyIssuesOfUserProject))
            .select({
                title:  tIssue.title,
                status: tIssue.status,
                body:   tIssue.body,
            })
            .executeSelectMany())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select title as title, status as status, body as body from issue where project_id = ?1"`)
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

        const issues = sync(connection.selectFrom(tIssue)
            .where(tIssue.projectId.equals(userProjectId).onlyWhen(onlyIssuesOfUserProject))
            .select({
                title:  tIssue.title,
                status: tIssue.status,
                body:   tIssue.body,
            })
            .executeSelectMany())
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

        const issues = sync(connection.selectFrom(tIssue)
            .where(canSeeEveryProject ? connection.noValueBoolean() : tIssue.projectId.equals(userProjectId))
            .select({
                id:    tIssue.id,
                title: tIssue.title,
            })
            .executeSelectMany())
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

        const issueWithRules = sync(connection.selectFrom(tIssue)
            .where(tIssue.id.equals(issueId))
            .select({
                id:     tIssue.id,
                title:  tIssue.title.onlyWhenOrNull(displayNames),
                status: tIssue.status.onlyWhenOrNull(displayNames),
                body:   tIssue.body,
            })
            .executeSelectOne())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title, status as status, body as body from issue where id = ?1"`)
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

        const issueWithRules = sync(connection.selectFrom(tIssue)
            .where(tIssue.id.equals(issueId))
            .select({
                id:     tIssue.id,
                title:  tIssue.title.onlyWhenOrNull(displayNames),
                status: tIssue.status.onlyWhenOrNull(displayNames),
                body:   tIssue.body,
            })
            .executeSelectOne())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, null as title, null as status, body as body from issue where id = ?1"`)
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
        const issue = sync(connection.selectFrom(tIssue)
            .where(tIssue.id.equals(2))
            .select({
                id:    tIssue.id,
                title: tIssue.title,
                body:  tIssue.body.ignoreWhenAsNull(hide),
            })
            .executeSelectOne())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title, null as body from issue where id = ?1"`)
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

        const organizations = sync(grouped
            .select({
                id:           tOrganization.id,
                name:         tOrganization.name,
                projectCount: connection.count(tProject.id),
            })
            .executeSelectMany())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization.id as id, organization.name as name, count(project.id) as projectCount from organization inner join project on project.organization_id = organization.id and project.archived_at is null group by organization.id, organization.name having count(project.id) >= ?1"`)
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

        const issues = sync(connection.selectFrom(tIssue)
            .optionalJoin(tProject).on(tProject.id.equals(tIssue.projectId))
            .where(tProject.name.equalsIfValue(projectName))
            .select({
                title:  tIssue.title,
                status: tIssue.status,
                body:   tIssue.body,
            })
            .executeSelectMany())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.title as title, issue.status as status, issue.body as body from issue join project on project.id = issue.project_id where project.name = ?1"`)
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

        const issues = sync(connection.selectFrom(tIssue)
            .optionalJoin(tProject).on(tProject.id.equals(tIssue.projectId))
            .where(tProject.name.equalsIfValue(projectName))
            .select({
                title:  tIssue.title,
                status: tIssue.status,
                body:   tIssue.body,
            })
            .executeSelectMany())
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

        const issueWithOptionalProject = sync(connection.selectFrom(tIssue)
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
            .executeSelectMany())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title, status as status, body as body, null as projectId, null as projectName from issue where id = ?1"`)
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

        const issueWithOptionalProject = sync(connection.selectFrom(tIssue)
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
            .executeSelectMany())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, issue.title as title, issue.status as status, issue.body as body, project.id as projectId, project.name as projectName from issue inner join project on project.id = issue.project_id where issue.id = ?1"`)
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

    test('docs:dynamic-queries/declarative', async () => {
        // Section "Declarative dynamic queries": no value, no where.
        const expected = [
            { id: 1, title: 'Update hero copy' },
            { id: 2, title: 'Redesign navbar' },
            { id: 3, title: 'Migrate to ESM' },
            { id: 4, title: 'Document /v2/users' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const projectId: number | null = null

        const issues = sync(connection.selectFrom(tIssue)
            .where(tIssue.projectId.equalsIfValue(projectId))
            .select({
                id:    tIssue.id,
                title: tIssue.title,
            })
            .orderBy('id')
            .executeSelectMany())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof issues, Array<{
            id:    number
            title: string
        }>>>()
        expect(issues).toEqual(expected)
    })

    test('docs:dynamic-queries/false-when-no-value', async () => {
        // Section "When there is no value": an empty list means no rows, not all of them.
        ctx.mockNext([])
        const connection = ctx.conn

        // doc-start
        const allowedProjectIds: number[] = []

        const issues = sync(connection.selectFrom(tIssue)
            .where(tIssue.projectId.inIfValue(allowedProjectIds).falseWhenNoValue())
            .select({
                id:    tIssue.id,
                title: tIssue.title,
            })
            .executeSelectMany())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title from issue where 0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof issues, Array<{
            id:    number
            title: string
        }>>>()
        expect(issues).toEqual([])
    })

    test('docs:dynamic-queries/value-when-no-value', async () => {
        // Section "When there is no value": the other condition takes its place.
        // Seed: the issues 1 and 3 are open.
        const expected = [
            { id: 1, title: 'Update hero copy' },
            { id: 3, title: 'Migrate to ESM' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const title: string | null = null

        const issues = sync(connection.selectFrom(tIssue)
            .where(
                tIssue.title.equalsIfValue(title)
                    .valueWhenNoValue(tIssue.status.equals('open'))
            )
            .select({
                id:    tIssue.id,
                title: tIssue.title,
            })
            .orderBy('id')
            .executeSelectMany())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title from issue where status = ?1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
          ]
        `)
        assertType<Exact<typeof issues, Array<{
            id:    number
            title: string
        }>>>()
        expect(issues).toEqual(expected)
    })

    test('docs:dynamic-queries/no-value-condition-in-the-select', async () => {
        // Section "When there is no value": with falseWhenNoValue the condition can be selected.
        // Seed: the issues 1 and 2 are of the project 1, the issues 3 and 4 aren't.
        const expected = [
            { id: 1, isInSearchedProject: true },
            { id: 2, isInSearchedProject: true },
            { id: 3, isInSearchedProject: false },
            { id: 4, isInSearchedProject: false },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const searchedProjectId: number | null = 1

        const issues = sync(connection.selectFrom(tIssue)
            .select({
                id:                  tIssue.id,
                isInSearchedProject: tIssue.projectId.equalsIfValue(searchedProjectId).falseWhenNoValue(),
            })
            .orderBy('id')
            .executeSelectMany())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, project_id = ?1 as isInSearchedProject from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof issues, Array<{
            id:                  number
            isInSearchedProject: boolean
        }>>>()
        expect(issues).toEqual(expected)
    })

    test('docs:dynamic-queries/ignore-when', async () => {
        // Section "Ignorable boolean expression": the restriction doesn't apply to an administrator.
        const expected = [
            { id: 1, title: 'Update hero copy' },
            { id: 2, title: 'Redesign navbar' },
            { id: 3, title: 'Migrate to ESM' },
            { id: 4, title: 'Document /v2/users' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const userProjectId = 1
        const userIsAdmin = true

        const issues = sync(connection.selectFrom(tIssue)
            .where(tIssue.projectId.equals(userProjectId).ignoreWhen(userIsAdmin))
            .select({
                id:    tIssue.id,
                title: tIssue.title,
            })
            .orderBy('id')
            .executeSelectMany())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof issues, Array<{
            id:    number
            title: string
        }>>>()
        expect(issues).toEqual(expected)
    })

    test('docs:dynamic-queries/dynamic-where', async () => {
        // Section "Building a condition step by step". Seed: of the project 1, only the issue 2 has a body.
        const expected = [{ id: 2, title: 'Redesign navbar' }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const projectId: number | undefined = 1
        const onlyWithBody = true

        const query = connection.selectFrom(tIssue)
            .dynamicWhere()
        if (projectId !== undefined) {
            query.and(tIssue.projectId.equals(projectId))
        }
        if (onlyWithBody) {
            query.and(tIssue.body.isNotNull())
        }

        const issues = sync(query
            .select({
                id:    tIssue.id,
                title: tIssue.title,
            })
            .executeSelectMany())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title from issue where project_id = ?1 and body is not null"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof issues, Array<{
            id:    number
            title: string
        }>>>()
        expect(issues).toEqual(expected)
    })

    test('docs:dynamic-queries/dynamic-boolean-expression', async () => {
        // Section "Building a condition step by step". Seed: the issue 1 has 'hero' in the title,
        // and the issue 3 belongs to the project 'Internal tools'.
        const expected = [
            { id: 1, title: 'Update hero copy' },
            { id: 3, title: 'Migrate to ESM' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const titleContains: string | null = 'hero'
        const projectName: string | null = 'Internal tools'

        let condition = connection.dynamicBooleanExpressionUsing(tIssue, tProject)
        if (titleContains) {
            condition = condition.and(tIssue.title.contains(titleContains))
        }
        if (projectName) {
            condition = condition.or(tProject.name.equals(projectName))
        }

        const issues = sync(connection.selectFrom(tIssue)
            .innerJoin(tProject).on(tProject.id.equals(tIssue.projectId))
            .where(condition)
            .select({
                id:    tIssue.id,
                title: tIssue.title,
            })
            .orderBy('id')
            .executeSelectMany())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, issue.title as title from issue inner join project on project.id = issue.project_id where issue.title like ('%' || ?1 || '%') escape '\\' or project.name = ?2 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "hero",
            "Internal tools",
          ]
        `)
        assertType<Exact<typeof issues, Array<{
            id:    number
            title: string
        }>>>()
        expect(issues).toEqual(expected)
    })

    test('docs:dynamic-queries/missing-where', async () => {
        // Section "A condition that ends up empty": the rejection arrives through the promise,
        // and nothing reaches the database. The rollback protects the seed if the guard ever goes.
        await ctx.withRollback(async () => {
            const connection = ctx.conn
            let reason: string | undefined

            // doc-start
            const issueId: number | null = null

            try {
                sync(connection.deleteFrom(tIssue)
                    .where(tIssue.id.equalsIfValue(issueId))
                    .executeDelete())
            } catch (e) {
                if (e instanceof TsSqlError && e.errorReason.reason === 'MISSING_WHERE') {
                    // Nothing was deleted, and no query was sent
                    reason = e.errorReason.reason
                }
            }
            // doc-end

            expect(reason).toBe('MISSING_WHERE')
            expect(ctx.lastNoTransactionSql).toBe('')
        })
    })

    test('docs:dynamic-queries/order-by-from-string', async () => {
        // Section "Order by from a string".
        const expected = [
            { id: 3, name: 'Public API',     slug: 'public-api' },
            { id: 1, name: 'Marketing site', slug: 'mktg-site' },
            { id: 4, name: 'Legacy app',     slug: 'legacy' },
            { id: 2, name: 'Internal tools', slug: 'tools' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const orderBy = 'name desc, slug insensitive'

        const projects = sync(connection.selectFrom(tProject)
            .select({
                id:   tProject.id,
                name: tProject.name,
                slug: tProject.slug,
            })
            .orderByFromString(orderBy)
            .executeSelectMany())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, slug as slug from project order by name desc, lower(slug)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof projects, Array<{
            id:   number
            name: string
            slug: string
        }>>>()
        expect(projects).toEqual(expected)
    })

    test('docs:dynamic-queries/order-by-from-string-array-if-value', async () => {
        // Section "The variants": the elements without a value are skipped.
        const expected = [
            { id: 3, name: 'Public API',     slug: 'public-api' },
            { id: 1, name: 'Marketing site', slug: 'mktg-site' },
            { id: 4, name: 'Legacy app',     slug: 'legacy' },
            { id: 2, name: 'Internal tools', slug: 'tools' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const orderBy: Array<string | null | undefined> = ['name desc', null, 'slug insensitive']

        const projects = sync(connection.selectFrom(tProject)
            .select({
                id:   tProject.id,
                name: tProject.name,
                slug: tProject.slug,
            })
            .orderByFromStringArrayIfValue(orderBy)
            .executeSelectMany())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, slug as slug from project order by name desc, lower(slug)"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof projects, Array<{
            id:   number
            name: string
            slug: string
        }>>>()
        expect(projects).toEqual(expected)
    })

    test('docs:dynamic-queries/order-by-from-string-error', async () => {
        // Section "Errors of the order": thrown by the call, while the query is being written.
        const connection = ctx.conn
        let column: string | undefined

        // doc-start
        const orderBy: string = 'name sideways'

        try {
            sync(connection.selectFrom(tProject)
                .select({
                    id:   tProject.id,
                    name: tProject.name,
                })
                .orderByFromString(orderBy)
                .executeSelectMany())
        } catch (e) {
            if (e instanceof TsSqlError && (e.errorReason.reason === 'ORDER_BY_COLUMN_NOT_IN_SELECT' || e.errorReason.reason === 'INVALID_ORDER_BY_ORDERING')) {
                column = e.errorReason.column
            } else {
                throw e
            }
        }
        // doc-end

        expect(column).toBe('name')
        expect(ctx.lastSql).toBe('')
    })

    test('docs:dynamic-queries/limit-and-offset-if-value', async () => {
        // Section "Optional limit and offset". Seed: only the issue 3 has ESM in the title.
        const expected = [
            { id: 3, title: 'Migrate to ESM' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const request: { title?: string, orderBy?: string, limit?: number, offset?: number } = { title: 'ESM', limit: 10 }

        const issues = sync(connection.selectFrom(tIssue)
            .where(tIssue.title.containsIfValue(request.title))
            .select({
                id:    tIssue.id,
                title: tIssue.title,
            })
            .orderByFromStringIfValue(request.orderBy)
            .limitIfValue(request.limit)
            .offsetIfValue(request.offset)
            .executeSelectMany())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title from issue where title like ('%' || ?1 || '%') escape '\\' limit ?2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "ESM",
            10,
          ]
        `)
        assertType<Exact<typeof issues, Array<{
            id:    number
            title: string
        }>>>()
        expect(issues).toEqual(expected)
    })

    test('docs:dynamic-queries/optional-left-join', async () => {
        // Section "Optional joins with a value replaced by null": a left join, written because it's used.
        const expected = [
            { id: 1, name: 'Marketing site', organizationName: 'Acme Corp' },
            { id: 2, name: 'Internal tools', organizationName: 'Acme Corp' },
            { id: 3, name: 'Public API',     organizationName: 'Globex Ltd' },
            { id: 4, name: 'Legacy app',     organizationName: 'Globex Ltd' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const canSeeOrganizationInfo = true
        const tOrganizationForLeftJoin = tOrganization.forUseInLeftJoin()

        const projects = sync(connection.selectFrom(tProject)
            .optionalLeftJoin(tOrganizationForLeftJoin).on(tOrganizationForLeftJoin.id.equals(tProject.organizationId))
            .select({
                id:               tProject.id,
                name:             tProject.name,
                organizationName: tOrganizationForLeftJoin.name.onlyWhenOrNull(canSeeOrganizationInfo),
            })
            .orderBy('id')
            .executeSelectMany())
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as id, project.name as name, organization.name as organizationName from project left join organization on organization.id = project.organization_id order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof projects, Array<{
            id:                number
            name:              string
            organizationName?: string
        }>>>()
        expect(projects).toEqual(expected)
    })
})
