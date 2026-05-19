// Documentation snippets for the SELECT page (docs/queries/select.md).
//
// Tests prefixed `docs:` are scraped by the docs build. Inside each test,
// the code BETWEEN `// doc-start` and `// doc-end` is the snippet that
// appears on the page; SQL + params live in `toMatchInlineSnapshot(...)`
// so the test gates the snippet against drift and the snapshot can be
// refreshed in bulk via `bun test --update-snapshots`.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tAppUser, tIssue, tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:select/joins-and-order-by', async () => {
        const expected = [
            { id: 1, title: 'Update hero copy', projectName: 'Marketing site' },
            { id: 3, title: 'Migrate to ESM',   projectName: 'Internal tools' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const project = tProject.as('proj')
        const openIssues = await connection.selectFrom(tIssue)
            .innerJoin(project).on(tIssue.projectId.equals(project.id))
            .where(tIssue.status.equals('open'))
            .select({
                id:          tIssue.id,
                title:       tIssue.title,
                projectName: project.name,
            })
            .orderBy('id')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, issue.title as title, proj.name as projectName from issue inner join project as proj on issue.project_id = proj.id where issue.status = ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
          ]
        `)
        assertType<Exact<typeof openIssues, Array<{
            id:          number
            title:       string
            projectName: string
        }>>>()
        expect(openIssues).toEqual(expected)
    })

    test('docs:select/ordering-by-not-returned-column', async () => {
        // Section "Select ordering by a not returned column" — pass a
        // column expression (not a result alias) to `orderBy`, optionally
        // with one of the documented OrderByMode strings.
        ctx.mockNext({ id: 1, name: 'Marketing site' })
        const connection = ctx.conn

        // doc-start
        const project = await connection.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({
                id:   tProject.id,
                name: tProject.name,
            })
            .orderBy(tProject.archivedAt, 'desc nulls last')
            .executeSelectOne()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name from project where id = ? order by project.archived_at desc nulls last"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof project, { id: number; name: string }>>()
        expect(project.id).toBe(1)
    })

    test('docs:select/subquery-and-dynamic-order-by', async () => {
        // Section "Select with subquery and dynamic order by" — uses
        // `.in(connection.selectFrom(...).selectOneColumn(...))` as a
        // subquery in WHERE and `orderByFromString` for dynamic ORDER BY.
        ctx.mockNext([
            { projectId: 1, projectName: 'Marketing site', projectSlug: 'mktg-site' },
            { projectId: 2, projectName: 'Internal tools', projectSlug: 'tools' },
        ])
        const connection = ctx.conn

        // doc-start
        const orderBy = 'projectName asc nulls first, projectSlug'

        const projectsInAcme = await connection.selectFrom(tProject)
            .where(tProject.organizationId.in(
                connection.selectFrom(tOrganization)
                    .where(tOrganization.name.contains('Acme'))
                    .selectOneColumn(tOrganization.id),
            )).select({
                projectId:   tProject.id,
                projectName: tProject.name,
                projectSlug: tProject.slug,
            }).orderByFromString(orderBy)
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as projectId, name as projectName, slug as projectSlug from project where organization_id in (select id as result from organization where name like ('%' || ? || '%') escape '\\') order by projectName asc nulls first, projectSlug"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Acme",
          ]
        `)
        assertType<Exact<typeof projectsInAcme, Array<{
            projectId:   number
            projectName: string
            projectSlug: string
        }>>>()
        expect(projectsInAcme.length).toBeGreaterThan(0)
    })

    test('docs:select/aggregate-and-group-by', async () => {
        // Section "Select with aggregate functions and group by" — count
        // children of a parent grouped by parent columns.
        const expected = [
            { organizationId: 1, organizationName: 'Acme Corp', projectCount: 2 },
            { organizationId: 2, organizationName: 'Globex Ltd',    projectCount: 2 },
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
            .orderBy('organizationId')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization.id as organizationId, organization.name as organizationName, count(project.id) as projectCount from organization inner join project on project.organization_id = organization.id group by organization.id, organization.name order by organizationId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof projectCountPerOrganization, Array<{
            organizationId:   number
            organizationName: string
            projectCount:     number
        }>>>()
        expect(projectCountPerOrganization).toEqual(expected)
    })

    test('docs:select/left-join', async () => {
        // Section "Select with left join" — create a left-join view with
        // `forUseInLeftJoinAs` so columns become optional in the result.
        // The seed has no issue with a non-null parentId so every row
        // comes back with `parentTitle` absent (the structural promise
        // of a left join — the column is `?` in the result type).
        const expected = [
            { id: 1, title: 'Update hero copy' },
            { id: 2, title: 'Redesign navbar' },
            { id: 3, title: 'Migrate to ESM' },
            { id: 4, title: 'Document /v2/users' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const parent = tIssue.forUseInLeftJoinAs('parent')

        const issuesWithParentTitle = await connection.selectFrom(tIssue)
            .leftJoin(parent).on(tIssue.parentId.equals(parent.id))
            .select({
                id:          tIssue.id,
                title:       tIssue.title,
                parentTitle: parent.title,
            }).orderBy('id')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, issue.title as title, parent.title as parentTitle from issue left join issue as parent on issue.parent_id = parent.id order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        // parentTitle is optional because parent is a left-join view.
        assertType<Exact<typeof issuesWithParentTitle, Array<{
            id:           number
            title:        string
            parentTitle?: string
        }>>>()
        expect(issuesWithParentTitle).toEqual(expected)
    })

    test('docs:select/left-join-complex-projections', async () => {
        // Section "Select with left join and complex projections" — the
        // optional fields are nested inside a sub-object. With no parent
        // rows in the seed every result row omits the `parent` key.
        const expected = [
            { id: 1, title: 'Update hero copy' },
            { id: 2, title: 'Redesign navbar' },
            { id: 3, title: 'Migrate to ESM' },
            { id: 4, title: 'Document /v2/users' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const parent = tIssue.forUseInLeftJoinAs('parent')

        const issuesWithParent = await connection.selectFrom(tIssue)
            .leftJoin(parent).on(tIssue.parentId.equals(parent.id))
            .select({
                id:    tIssue.id,
                title: tIssue.title,
                parent: {
                    id:    parent.id,
                    title: parent.title,
                },
            }).orderBy('id')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, issue.title as title, parent.id as "parent.id", parent.title as "parent.title" from issue left join issue as parent on issue.parent_id = parent.id order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof issuesWithParent, Array<{
            id:      number
            title:   string
            parent?: { id: number; title: string }
        }>>>()
        expect(issuesWithParent).toEqual(expected)
    })

    test('docs:select/compound-operator', async () => {
        // Section "Select with a compound operator (union, intersect,
        // except)" — `unionAll` glues two compatible selects into one.
        // Real seed: 2 organizations + 4 projects = 6 rows.
        const expected = [
            { id: 1, name: 'Acme Corp',         kind: 'organization' as const },
            { id: 2, name: 'Globex Ltd',        kind: 'organization' as const },
            { id: 1, name: 'Marketing site',    kind: 'project'      as const },
            { id: 2, name: 'Internal tools',    kind: 'project'      as const },
            { id: 3, name: 'Public API',        kind: 'project'      as const },
            { id: 4, name: 'Legacy app',        kind: 'project'      as const },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const allNamed = await connection.selectFrom(tOrganization)
            .select({
                id:   tOrganization.id,
                name: tOrganization.name,
                kind: connection.const<'organization' | 'project'>('organization', 'enum', 'orgOrProject'),
            }).unionAll(
                connection.selectFrom(tProject)
                .select({
                    id:   tProject.id,
                    name: tProject.name,
                    kind: connection.const<'organization' | 'project'>('project', 'enum', 'orgOrProject'),
                }),
            ).executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, ? as kind from organization union all select id as id, name as name, ? as kind from project"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "organization",
            "project",
          ]
        `)
        assertType<Exact<typeof allNamed, Array<{
            id:   number
            name: string
            kind: 'organization' | 'project'
        }>>>()
        expect(allNamed).toEqual(expected)
    })

    test('docs:select/with-clause', async () => {
        // Section "Using a select as a view in another select query (SQL
        // with clause)" — `forUseInQueryAs` returns a view-like
        // representation that emits a top-level WITH clause.
        const expected = [
            { acmeOrgId: 1, acmeOrgName: 'Acme Corp', acmeProjectCount: 2 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const projectCountPerOrgWith = connection.selectFrom(tOrganization)
            .innerJoin(tProject).on(tProject.organizationId.equals(tOrganization.id))
            .select({
                organizationId:   tOrganization.id,
                organizationName: tOrganization.name,
                projectCount:     connection.count(tProject.id),
            }).groupBy('organizationId', 'organizationName')
            .forUseInQueryAs('projectCountPerOrg')

        const acmeOrganizations = await connection.selectFrom(projectCountPerOrgWith)
            .where(projectCountPerOrgWith.organizationName.containsInsensitive('Acme'))
            .select({
                acmeOrgId:        projectCountPerOrgWith.organizationId,
                acmeOrgName:      projectCountPerOrgWith.organizationName,
                acmeProjectCount: projectCountPerOrgWith.projectCount,
            })
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with projectCountPerOrg as (select organization.id as organizationId, organization.name as organizationName, count(project.id) as projectCount from organization inner join project on project.organization_id = organization.id group by organization.id, organization.name) select organizationId as acmeOrgId, organizationName as acmeOrgName, projectCount as acmeProjectCount from projectCountPerOrg where lower(organizationName) like lower('%' || ? || '%') escape '\\'"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Acme",
          ]
        `)
        assertType<Exact<typeof acmeOrganizations, Array<{
            acmeOrgId:        number
            acmeOrgName:      string
            acmeProjectCount: number
        }>>>()
        expect(acmeOrganizations).toEqual(expected)
    })

    test('docs:select/count-all', async () => {
        // Section "Select count all" — `selectCountAll()` is the shortcut
        // for `selectOneColumn(connection.countAll())`. Result is a plain
        // int (non-nullable).
        ctx.mockNext(2)
        const connection = ctx.conn

        // doc-start
        const organizationId = 1
        const numberOfProjects = await connection.selectFrom(tProject)
            .where(tProject.organizationId.equals(organizationId))
            .selectCountAll()
            .executeSelectOne()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select count(*) as result from project where organization_id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof numberOfProjects, number>>()
        expect(numberOfProjects).toBe(2)
    })

    test('docs:select/inline-subquery-as-value', async () => {
        // Section "Inline subquery as value" — `.forUseAsInlineQueryValue()`
        // promotes a single-column select into a value usable in another
        // query.
        const expected = [
            { id: 1, name: 'Marketing site' },
            { id: 2, name: 'Internal tools' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const acmeOrgId = connection.selectFrom(tOrganization)
            .where(tOrganization.name.equals('Acme Corp'))
            .selectOneColumn(tOrganization.id)
            .forUseAsInlineQueryValue()

        const acmeProjects = await connection.selectFrom(tProject)
            .where(tProject.organizationId.equals(acmeOrgId))
            .select({
                id:   tProject.id,
                name: tProject.name,
            })
            .orderBy('id')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name from project where organization_id = (select id as result from organization where name = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Acme Corp",
          ]
        `)
        assertType<Exact<typeof acmeProjects, Array<{ id: number; name: string }>>>()
        expect(acmeProjects).toEqual(expected)
    })

    test('docs:select/inline-subquery-referencing-outer', async () => {
        // Section "Inline subquery referencing outer query" — `subSelectUsing`
        // takes the outer tables and produces a correlated subquery, then
        // `forUseAsInlineQueryValue` exposes the resulting scalar.
        const expected = [
            { id: 1, name: 'Acme Corp', projectCount: 2 },
            { id: 2, name: 'Globex Ltd',    projectCount: 2 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const projectCount = connection
            .subSelectUsing(tOrganization)
            .from(tProject)
            .where(tProject.organizationId.equals(tOrganization.id))
            .selectCountAll()
            .forUseAsInlineQueryValue()

        const organizationsWithProjectCount = await connection.selectFrom(tOrganization)
            .select({
                id:           tOrganization.id,
                name:         tOrganization.name,
                projectCount: projectCount,
            }).orderBy('id')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, (select count(*) as result from project where organization_id = organization.id) as projectCount from organization order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof organizationsWithProjectCount, Array<{
            id:           number
            name:         string
            projectCount: number
        }>>>()
        expect(organizationsWithProjectCount).toEqual(expected)
    })

    test('docs-extra:select/clauses-order-where-after-groupby', async () => {
        // Section "Select clauses order" lists a number of legal clause
        // orderings. The default (logical) and the "alternative" variants
        // all parse — exercise one alternative (WHERE after GROUP BY) to
        // lock the contract in.
        // Real seed: projects 1,2 (org 1, not archived), 3 (org 2, not
        // archived). Project 4 is archived. After WHERE archivedAt IS
        // NULL + GROUP BY org → [{org:1, count:2}, {org:2, count:1}].
        const expected = [
            { organizationId: 1, projectCount: 2 },
            { organizationId: 2, projectCount: 1 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const result = await connection.selectFrom(tProject)
            .groupBy(tProject.organizationId)
            .having(connection.count(tProject.id).greaterThan(0))
            .where(tProject.archivedAt.isNull())
            .select({
                organizationId: tProject.organizationId,
                projectCount:   connection.count(tProject.id),
            })
            .orderBy('organizationId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization_id as organizationId, count(id) as projectCount from project where archived_at is null group by organization_id having count(id) > ? order by organizationId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0,
          ]
        `)
        assertType<Exact<typeof result, Array<{
            organizationId: number
            projectCount:   number
        }>>>()
        expect(result).toEqual(expected)
    })

    test('docs-extra:select/find-by-email', async () => {
        // Page-derived: a baseline `selectFrom(...).where(...).select({...}).executeSelectOne()`
        // demonstrating an indexed single-row fetch.
        const expected = {
            id: 1,
            email: 'ada@acme.test',
            fullName: 'Ada Lovelace',
        }
        ctx.mockNext(expected)
        const connection = ctx.conn

        const user = await connection.selectFrom(tAppUser)
            .where(tAppUser.email.equals('ada@acme.test'))
            .select({
                id:       tAppUser.id,
                email:    tAppUser.email,
                fullName: tAppUser.fullName,
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, email as email, full_name as fullName from app_user where email = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "ada@acme.test",
          ]
        `)
        assertType<Exact<typeof user, {
            id:       number
            email:    string
            fullName: string
        }>>()
        expect(user).toEqual(expected)
    })

    test('docs-extra:select/aliased-table', async () => {
        // Page-derived: aliasing a table with `.as('alias')` to keep
        // subsequent column references namespaced by the alias.
        const expected = [{ id: 1, fullName: 'Ada Lovelace' }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const u = tAppUser.as('u')
        const onlyAda = await connection.selectFrom(u)
            .where(u.email.startsWith('ada@'))
            .select({
                id:       u.id,
                fullName: u.fullName,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select "u".id as id, "u".full_name as fullName from app_user as "u" where "u".email like (? || '%') escape '\\'"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "ada@",
          ]
        `)
        assertType<Exact<typeof onlyAda, Array<{
            id:       number
            fullName: string
        }>>>()
        expect(onlyAda).toEqual(expected)
    })
})
