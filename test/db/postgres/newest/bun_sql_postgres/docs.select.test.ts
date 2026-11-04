// Documentation snippets for the SELECT page (docs/queries/select.md).

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
            { id: 1, name: 'Marketing site', slug: 'mktg-site', organizationName: 'Acme Corp' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const name = 'market'
        const slug = null

        const organization = tOrganization.as('org')
        const projectsWithOrganizationName = await connection.selectFrom(tProject)
            .innerJoin(organization).on(tProject.organizationId.equals(organization.id))
            .where(tProject.name.startsWithInsensitive(name))
                .and(tProject.slug.startsWithInsensitiveIfValue(slug))
            .select({
                id:               tProject.id,
                name:             tProject.name,
                slug:             tProject.slug,
                archivedAt:       tProject.archivedAt,
                organizationName: organization.name,
            })
            .orderBy('name', 'insensitive')
            .orderBy('slug', 'asc insensitive')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as id, project.name as name, project.slug as slug, project.archived_at as "archivedAt", org.name as "organizationName" from project inner join organization as org on project.organization_id = org.id where project.name ilike ($1 || '%') order by lower(project.name), lower(project.slug) asc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "market",
          ]
        `)
        assertType<Exact<typeof projectsWithOrganizationName, Array<{
            id:               number
            name:             string
            slug:             string
            archivedAt?:      Date
            organizationName: string
        }>>>()
        expect(projectsWithOrganizationName).toEqual(expected)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name from project where id = $1 order by project.archived_at desc nulls last"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "projectId", name as "projectName", slug as "projectSlug" from project where organization_id in (select id as result from organization where name like ('%' || $1 || '%')) order by "projectName" asc nulls first, "projectSlug""`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, issue.title as title, parent.title as "parentTitle" from issue left join issue as parent on issue.parent_id = parent.id order by id"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, $1 as kind from organization union all select id as id, name as name, $2 as kind from project"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with projectCountPerOrg as (select organization.id as organizationId, organization.name as organizationName, count(project.id) as projectCount from organization inner join project on project.organization_id = organization.id group by organization.id, organization.name) select organizationId as "acmeOrgId", organizationName as "acmeOrgName", projectCount as "acmeProjectCount" from projectCountPerOrg where organizationName ilike ('%' || $1 || '%')"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select count(*) as result from project where organization_id = $1"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name from project where organization_id = (select id as result from organization where name = $1) order by id"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, (select count(*) as result from project where organization_id = organization.id) as "projectCount" from organization order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof organizationsWithProjectCount, Array<{
            id:           number
            name:         string
            projectCount: number
        }>>>()
        expect(organizationsWithProjectCount).toEqual(expected)
    })

    test('docs:select/inline-subquery-distinct', async () => {
        ctx.mockNext([
            { id: 1, name: 'Acme Corp',  projectNames: JSON.stringify(['Marketing site', 'Internal tools']) },
            { id: 2, name: 'Globex Ltd', projectNames: JSON.stringify(['Public API', 'Legacy app']) },
        ])
        const connection = ctx.conn

        // doc-start
        const namesOfTheProjects = connection
            .subSelectDistinctUsing(tOrganization)
            .from(tProject)
            .where(tProject.organizationId.equals(tOrganization.id))
            .selectOneColumn(tProject.name)
            .forUseAsInlineAggregatedArrayValue()

        const organizationsWithTheNamesOfTheirProjects = await connection.selectFrom(tOrganization)
            .select({
                id:           tOrganization.id,
                name:         tOrganization.name,
                projectNames: namesOfTheProjects,
            })
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, ((select json_agg(a_1_.result) from (select distinct name as result from project where organization_id = organization.id) as a_1_))::text as "projectNames" from organization"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof organizationsWithTheNamesOfTheirProjects, Array<{
            id:           number
            name:         string
            projectNames: string[]
        }>>>()
        // Neither the rows nor the aggregated array have an order by.
        const sorted = organizationsWithTheNamesOfTheirProjects
            .map((row) => ({ ...row, projectNames: [...row.projectNames].sort() }))
            .sort((a, b) => a.id - b.id)
        expect(sorted).toEqual([
            { id: 1, name: 'Acme Corp',  projectNames: ['Internal tools', 'Marketing site'] },
            { id: 2, name: 'Globex Ltd', projectNames: ['Legacy app', 'Public API'] },
        ])
    })

    test('docs:select/select-without-table', async () => {
        const expected = { users: 3, organizations: 2 }
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const counts = await connection.selectFromNoTable()
            .select({
                users:         connection.selectFrom(tAppUser).selectCountAll().forUseAsInlineQueryValue(),
                organizations: connection.selectFrom(tOrganization).selectCountAll().forUseAsInlineQueryValue(),
            })
            .executeSelectOne()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (select count(*) as result from app_user) as users, (select count(*) as result from organization) as organizations"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof counts, {
            users:         number
            organizations: number
        }>>()
        expect(counts).toEqual(expected)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization_id as "organizationId", count(id) as "projectCount" from project where archived_at is null group by organization_id having count(id) > $1 order by "organizationId""`)
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

    test('docs-extra:select/clauses-where-after-select', async () => {
        // Section "Select clauses order" — alternative ordering where
        // WHERE comes AFTER select(): from/groupBy/having/select/where.
        const expected = [
            { organizationId: 1, projectCount: 2 },
            { organizationId: 2, projectCount: 1 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const result = await connection.selectFrom(tProject)
            .groupBy(tProject.organizationId)
            .having(connection.count(tProject.id).greaterThan(0))
            .select({
                organizationId: tProject.organizationId,
                projectCount:   connection.count(tProject.id),
            })
            .where(tProject.archivedAt.isNull())
            .orderBy('organizationId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization_id as "organizationId", count(id) as "projectCount" from project where archived_at is null group by organization_id having count(id) > $1 order by "organizationId""`)
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

    test('docs-extra:select/clauses-where-after-orderby', async () => {
        // Section "Select clauses order" — WHERE may come AFTER orderBy():
        // from/groupBy/having/select/orderBy/where/limit/offset.
        const expected = [
            { organizationId: 1, projectCount: 2 },
            { organizationId: 2, projectCount: 1 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const result = await connection.selectFrom(tProject)
            .groupBy(tProject.organizationId)
            .having(connection.count(tProject.id).greaterThan(0))
            .select({
                organizationId: tProject.organizationId,
                projectCount:   connection.count(tProject.id),
            })
            .orderBy('organizationId')
            .where(tProject.archivedAt.isNull())
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization_id as "organizationId", count(id) as "projectCount" from project where archived_at is null group by organization_id having count(id) > $1 order by "organizationId""`)
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

    test('docs-extra:select/clauses-select-before-where', async () => {
        // Section "Select clauses order" — the "Alternative order 1" branch
        // allows select() before where(): from/select/where/groupBy/having.
        const expected = [
            { organizationId: 1, projectCount: 2 },
            { organizationId: 2, projectCount: 1 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const result = await connection.selectFrom(tProject)
            .select({
                organizationId: tProject.organizationId,
                projectCount:   connection.count(tProject.id),
            })
            .where(tProject.archivedAt.isNull())
            .groupBy('organizationId')
            .having(connection.count(tProject.id).greaterThan(0))
            .orderBy('organizationId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization_id as "organizationId", count(id) as "projectCount" from project where archived_at is null group by organization_id having count(id) > $1 order by "organizationId""`)
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

    test('docs-extra:select/clauses-where-after-customize-query', async () => {
        // Section "Select clauses order": where as the last clause, with group by and having first.
        const expected = [
            { organizationId: 1, projectCount: 2 },
            { organizationId: 2, projectCount: 1 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const result = await connection.selectFrom(tProject)
            .groupBy(tProject.organizationId)
            .having(connection.count(tProject.id).greaterThan(0))
            .select({
                organizationId: tProject.organizationId,
                projectCount:   connection.count(tProject.id),
            })
            .orderBy('organizationId')
            .limit(10)
            .offset(0)
            .customizeQuery({
                afterQuery: connection.rawFragment`/* trailing comment */`,
            })
            .where(tProject.archivedAt.isNull())
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization_id as "organizationId", count(id) as "projectCount" from project where archived_at is null group by organization_id having count(id) > $1 order by "organizationId" limit $2 offset $3 /* trailing comment */"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0,
            10,
            0,
          ]
        `)
        assertType<Exact<typeof result, Array<{
            organizationId: number
            projectCount:   number
        }>>>()
        expect(result).toEqual(expected)
    })

    test('docs-extra:select/clauses-select-first-where-after-having', async () => {
        // Section "Select clauses order": select first, where after having.
        const expected = [
            { organizationId: 1, projectCount: 2 },
            { organizationId: 2, projectCount: 1 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const result = await connection.selectFrom(tProject)
            .select({
                organizationId: tProject.organizationId,
                projectCount:   connection.count(tProject.id),
            })
            .groupBy('organizationId')
            .having(connection.count(tProject.id).greaterThan(0))
            .where(tProject.archivedAt.isNull())
            .orderBy('organizationId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization_id as "organizationId", count(id) as "projectCount" from project where archived_at is null group by organization_id having count(id) > $1 order by "organizationId""`)
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

    test('docs-extra:select/clauses-select-first-where-after-order-by', async () => {
        // Section "Select clauses order": select first, where after order by.
        const expected = [
            { organizationId: 1, projectCount: 2 },
            { organizationId: 2, projectCount: 1 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const result = await connection.selectFrom(tProject)
            .select({
                organizationId: tProject.organizationId,
                projectCount:   connection.count(tProject.id),
            })
            .groupBy('organizationId')
            .having(connection.count(tProject.id).greaterThan(0))
            .orderBy('organizationId')
            .where(tProject.archivedAt.isNull())
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization_id as "organizationId", count(id) as "projectCount" from project where archived_at is null group by organization_id having count(id) > $1 order by "organizationId""`)
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

    test('docs-extra:select/clauses-select-first-where-after-offset', async () => {
        // Section "Select clauses order": select first, where after limit and offset.
        const expected = [
            { organizationId: 1, projectCount: 2 },
            { organizationId: 2, projectCount: 1 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const result = await connection.selectFrom(tProject)
            .select({
                organizationId: tProject.organizationId,
                projectCount:   connection.count(tProject.id),
            })
            .groupBy('organizationId')
            .having(connection.count(tProject.id).greaterThan(0))
            .orderBy('organizationId')
            .limit(10)
            .offset(0)
            .where(tProject.archivedAt.isNull())
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization_id as "organizationId", count(id) as "projectCount" from project where archived_at is null group by organization_id having count(id) > $1 order by "organizationId" limit $2 offset $3"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0,
            10,
            0,
          ]
        `)
        assertType<Exact<typeof result, Array<{
            organizationId: number
            projectCount:   number
        }>>>()
        expect(result).toEqual(expected)
    })

    test('docs-extra:select/clauses-select-first-where-after-customize-query', async () => {
        // Section "Select clauses order": select first, where as the last clause.
        const expected = [
            { organizationId: 1, projectCount: 2 },
            { organizationId: 2, projectCount: 1 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const result = await connection.selectFrom(tProject)
            .select({
                organizationId: tProject.organizationId,
                projectCount:   connection.count(tProject.id),
            })
            .groupBy('organizationId')
            .having(connection.count(tProject.id).greaterThan(0))
            .orderBy('organizationId')
            .limit(10)
            .offset(0)
            .customizeQuery({
                afterQuery: connection.rawFragment`/* trailing comment */`,
            })
            .where(tProject.archivedAt.isNull())
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization_id as "organizationId", count(id) as "projectCount" from project where archived_at is null group by organization_id having count(id) > $1 order by "organizationId" limit $2 offset $3 /* trailing comment */"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0,
            10,
            0,
          ]
        `)
        assertType<Exact<typeof result, Array<{
            organizationId: number
            projectCount:   number
        }>>>()
        expect(result).toEqual(expected)
    })

    // NOT-APPLICABLE: `.startWith` / `.connectBy` are typed `never` on this connection; the hierarchical query clauses exist only on Oracle.
    /*
    test('docs-extra:select/clauses-oracle-select-first-where-after-ordering-siblings', async () => {
        // Section "Select clauses order", Oracle variants: select first, then
        // start with + connect by, with where after ordering siblings only.
        // No issue has a parent in the seed, so every issue is a root and the
        // where keeps those with priority above 1.
        const expected = [{ id: 1 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const result = await connection.selectFrom(tIssue)
            .select({
                id: tIssue.id,
            })
            .startWith(tIssue.parentId.isNull())
            .connectBy((prior) => prior(tIssue.id).equals(tIssue.parentId))
            .orderBy('id')
            .orderingSiblingsOnly()
            .where(tIssue.priority.greaterThan(1))
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(expected)
    })
    */

})
