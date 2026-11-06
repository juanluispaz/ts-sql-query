// Documentation snippets for the Building a condition step by step page (docs/dynamic/building-conditions.md).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tAppUser, tIssue, tOrganization, tProject } from '../../domain/connection.js'
import { fromRef, type TableOrViewOf } from '../../../../../src/extras/types.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:building-conditions/complex-dynamic-boolean-expressions', async () => {
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

        let searchedProjectsWhere = connection.dynamicBooleanExpressionUsing(tProject)
        if (nameContains) {
            searchedProjectsWhere = searchedProjectsWhere.and(tProject.name.contains(nameContains))
        }
        if (slugContains) {
            searchedProjectsWhere = searchedProjectsWhere.or(tProject.slug.contains(slugContains))
        }
        if (archivedAtIs) {
            searchedProjectsWhere = searchedProjectsWhere.and(tProject.archivedAt.equals(archivedAtIs))
        }

        const searchedProjects = await connection.selectFrom(tProject)
            .where(searchedProjectsWhere)
            .select({
                id:         tProject.id,
                name:       tProject.name.concat(' ').concat(tProject.slug),
                archivedAt: tProject.archivedAt,
            })
            .orderByFromString(searchOrderBy)
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name + @0 + slug as name, archived_at as archivedAt from project where name like ('%' + @1 + '%') order by lower(name + @0 + slug), iif(project.archived_at is null, 1, 0), archivedAt asc"`)
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

    test('docs:building-conditions/condition-outside-the-query', async () => {
        const expected = [{ id: 1, fullName: 'Ada Lovelace' }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        function nameContains<USER extends TableOrViewOf<typeof tAppUser, 'appUser'>>(userRef: USER, text: string | null | undefined) {
            const appUser = fromRef(tAppUser, userRef)

            return appUser.fullName.containsInsensitiveIfValue(text)
                .or(appUser.email.containsInsensitiveIfValue(text))
        }

        const appUser = tAppUser.as('appUser')

        const users = await connection.selectFrom(appUser)
            .where(nameContains(appUser, 'lovelace'))
            .select({
                id:       appUser.id,
                fullName: appUser.fullName,
            })
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select appUser.id as id, appUser.full_name as fullName from app_user as appUser where lower(appUser.full_name) like lower('%' + @0 + '%') or lower(appUser.email) like lower('%' + @1 + '%')"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "lovelace",
            "lovelace",
          ]
        `)
        assertType<Exact<typeof users, Array<{
            id:       number
            fullName: string
        }>>>()
        expect(users).toEqual(expected)
    })

    test('docs:building-conditions/dynamic-on-and-having', async () => {
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization.id as id, organization.name as name, count(project.id) as projectCount from organization inner join project on project.organization_id = organization.id and project.archived_at is null group by organization.id, organization.name having count(project.id) >= @0"`)
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

    test('docs:building-conditions/dynamic-where', async () => {
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

        const issues = await query
            .select({
                id:    tIssue.id,
                title: tIssue.title,
            })
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title from issue where project_id = @0 and body is not null"`)
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

    test('docs:building-conditions/dynamic-boolean-expression', async () => {
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

        const issues = await connection.selectFrom(tIssue)
            .innerJoin(tProject).on(tProject.id.equals(tIssue.projectId))
            .where(condition)
            .select({
                id:    tIssue.id,
                title: tIssue.title,
            })
            .orderBy('id')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, issue.title as title from issue inner join project on project.id = issue.project_id where issue.title like ('%' + @0 + '%') or project.name = @1 order by id"`)
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
})
