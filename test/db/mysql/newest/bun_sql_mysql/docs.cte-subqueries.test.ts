// Documentation snippets for the page of the CTE and subqueries (docs/queries/cte-subqueries.md).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:cte-subqueries/subquery-and-dynamic-order-by', async () => {
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as projectId, \`name\` as projectName, slug as projectSlug from project where organization_id in (select id as result from \`organization\` where \`name\` like concat('%', ?, '%')) order by projectName asc, projectSlug"`)
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

    test('docs:cte-subqueries/inline-subquery-as-value', async () => {
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, \`name\` as \`name\` from project where organization_id = (select id as result from \`organization\` where \`name\` = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Acme Corp",
          ]
        `)
        assertType<Exact<typeof acmeProjects, Array<{ id: number; name: string }>>>()
        expect(acmeProjects).toEqual(expected)
    })

    test('docs:cte-subqueries/inline-subquery-referencing-outer', async () => {
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, \`name\` as \`name\`, (select count(*) as result from project where organization_id = \`organization\`.id) as projectCount from \`organization\` order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof organizationsWithProjectCount, Array<{
            id:           number
            name:         string
            projectCount: number
        }>>>()
        expect(organizationsWithProjectCount).toEqual(expected)
    })

    test('docs:cte-subqueries/inline-subquery-distinct', async () => {
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, \`name\` as \`name\`, cast((select json_arrayagg(a_1_.result) from (select distinct \`name\` as result from project where organization_id = \`organization\`.id) as a_1_) as char) as projectNames from \`organization\`"`)
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

    test('docs:cte-subqueries/with-clause', async () => {
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with projectCountPerOrg as (select \`organization\`.id as organizationId, \`organization\`.\`name\` as organizationName, count(project.id) as projectCount from \`organization\` inner join project on project.organization_id = \`organization\`.id group by \`organization\`.id, \`organization\`.\`name\`) select organizationId as acmeOrgId, organizationName as acmeOrgName, projectCount as acmeProjectCount from projectCountPerOrg where lower(organizationName) like concat('%', lower(?), '%')"`)
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
})
