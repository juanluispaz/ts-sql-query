// Documentation snippets for the page of the CTE and subqueries (docs/queries/cte-subqueries.md).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tOrganization, tProject, tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:cte-subqueries/subquery-and-dynamic-order-by', async () => {
        // Section "Subquery in a condition" — uses
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as projectId, name as projectName, slug as projectSlug from project where organization_id in (select id as result from organization where name like ('%' || ?1 || '%') escape '\\') order by projectName asc nulls first, projectSlug"`)
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

    test('docs:cte-subqueries/exists', async () => {
        // Section "Subquery checking that rows exist": projects 1, 2 and 3 have issues.
        const expected = [
            { id: 1, name: 'Marketing site' },
            { id: 2, name: 'Internal tools' },
            { id: 3, name: 'Public API' },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const projectsWithIssues = await connection.selectFrom(tProject)
            .where(connection.exists(
                connection.subSelectUsing(tProject)
                    .from(tIssue)
                    .where(tIssue.projectId.equals(tProject.id))
                    .selectOneColumn(tIssue.id),
            ))
            .select({
                id:   tProject.id,
                name: tProject.name,
            })
            .orderBy('id')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name from project where exists(select id as result from issue where project_id = project.id) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof projectsWithIssues, Array<{
            id:   number
            name: string
        }>>>()
        expect(projectsWithIssues).toEqual(expected)
    })

    test('docs:cte-subqueries/same-table-in-the-subquery', async () => {
        // Section "Inline subquery referencing outer query": issues 1 and 2 share a
        // project; issues 3 and 4 are alone in theirs.
        const expected = [
            { id: 1, otherIssuesOfTheProject: 1 },
            { id: 2, otherIssuesOfTheProject: 1 },
            { id: 3, otherIssuesOfTheProject: 0 },
            { id: 4, otherIssuesOfTheProject: 0 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const otherIssue = tIssue.as('otherIssue')

        const issuesWithOthersOfTheProject = await connection.selectFrom(tIssue)
            .select({
                id: tIssue.id,
                otherIssuesOfTheProject: connection
                    .subSelectUsing(tIssue)
                    .from(otherIssue)
                    .where(otherIssue.projectId.equals(tIssue.projectId))
                    .and(otherIssue.id.notEquals(tIssue.id))
                    .selectCountAll()
                    .forUseAsInlineQueryValue(),
            })
            .orderBy('id')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, (select count(*) as result from issue as otherIssue where otherIssue.project_id = issue.project_id and otherIssue.id <> issue.id) as otherIssuesOfTheProject from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof issuesWithOthersOfTheProject, Array<{
            id:                      number
            otherIssuesOfTheProject: number
        }>>>()
        expect(issuesWithOthersOfTheProject).toEqual(expected)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name from project where organization_id = (select id as result from organization where name = ?1) order by id"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, (select count(*) as result from project where organization_id = organization.id) as projectCount from organization order by id"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, (select json_group_array(a_1_.result) from (select distinct name as result from project where organization_id = organization.id) as a_1_) as projectNames from organization"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with projectCountPerOrg as (select organization.id as organizationId, organization.name as organizationName, count(project.id) as projectCount from organization inner join project on project.organization_id = organization.id group by organization.id, organization.name) select organizationId as acmeOrgId, organizationName as acmeOrgName, projectCount as acmeProjectCount from projectCountPerOrg where lower(organizationName) like lower('%' || ?1 || '%') escape '\\'"`)
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

    test('docs:cte-subqueries/with-nested-object', async () => {
        // Section "The columns of the view": a nested object keeps its shape in the view.
        const raw = [
            { id: 1, 'organization.id': 1, 'organization.name': 'Acme Corp' },
            { id: 2, 'organization.id': 1, 'organization.name': 'Acme Corp' },
        ]
        const expected = [
            { id: 1, organization: { id: 1, name: 'Acme Corp' } },
            { id: 2, organization: { id: 1, name: 'Acme Corp' } },
        ]
        ctx.mockNext(raw)
        const connection = ctx.conn

        // doc-start
        const projectWithOrganization = connection.selectFrom(tProject)
            .innerJoin(tOrganization).on(tOrganization.id.equals(tProject.organizationId))
            .select({
                id: tProject.id,
                organization: {
                    id:   tOrganization.id,
                    name: tOrganization.name,
                },
            })
            .forUseInQueryAs('projectWithOrganization')

        const projectsOfAcme = await connection.selectFrom(projectWithOrganization)
            .where(projectWithOrganization.organization.name.contains('Acme'))
            .select({
                id:           projectWithOrganization.id,
                organization: projectWithOrganization.organization,
            })
            .orderBy('id')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with projectWithOrganization as (select project.id as id, organization.id as "organization.id", organization.name as "organization.name" from project inner join organization on organization.id = project.organization_id) select id as id, "organization.id" as "organization.id", "organization.name" as "organization.name" from projectWithOrganization where "organization.name" like ('%' || ?1 || '%') escape '\\' order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Acme",
          ]
        `)
        assertType<Exact<typeof projectsOfAcme, Array<{
            id:           number
            organization: { id: number; name: string }
        }>>>()
        expect(projectsOfAcme).toEqual(expected)
    })

    test('docs:cte-subqueries/with-left-join', async () => {
        // Section "Left join with a view": project 4 has no issues, so the left join
        // gives it no count.
        const expected = [
            { id: 1, name: 'Marketing site', issueCount: 2 },
            { id: 2, name: 'Internal tools', issueCount: 1 },
            { id: 3, name: 'Public API',     issueCount: 1 },
            { id: 4, name: 'Legacy app',     issueCount: 0 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const issueCountPerProject = connection.selectFrom(tIssue)
            .select({
                projectId:  tIssue.projectId,
                issueCount: connection.count(tIssue.id),
            }).groupBy('projectId')
            .forUseInQueryAs('issueCountPerProject')
            .forUseInLeftJoin()

        const projectsWithIssueCount = await connection.selectFrom(tProject)
            .leftJoin(issueCountPerProject).on(issueCountPerProject.projectId.equals(tProject.id))
            .select({
                id:         tProject.id,
                name:       tProject.name,
                issueCount: issueCountPerProject.issueCount.valueWhenNull(0),
            })
            .orderBy('id')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with issueCountPerProject as (select project_id as projectId, count(id) as issueCount from issue group by project_id) select project.id as id, project.name as name, ifnull(issueCountPerProject.issueCount, ?1) as issueCount from project left join issueCountPerProject on issueCountPerProject.projectId = project.id order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0,
          ]
        `)
        assertType<Exact<typeof projectsWithIssueCount, Array<{
            id:         number
            name:       string
            issueCount: number
        }>>>()
        expect(projectsWithIssueCount).toEqual(expected)
    })

    test('docs:cte-subqueries/with-used-twice', async () => {
        // Section "Using a view more than once": each organization has two projects.
        const expected = [
            { projectId: 1, otherProjectId: 2 },
            { projectId: 3, otherProjectId: 4 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const projectOfOrganization = connection.selectFrom(tProject)
            .select({
                id:             tProject.id,
                organizationId: tProject.organizationId,
            })
            .forUseInQueryAs('projectOfOrganization')

        const otherProjectOfOrganization = projectOfOrganization.as('otherProjectOfOrganization')

        const pairsOfProjects = await connection.selectFrom(projectOfOrganization)
            .innerJoin(otherProjectOfOrganization)
                .on(otherProjectOfOrganization.organizationId.equals(projectOfOrganization.organizationId))
                .and(otherProjectOfOrganization.id.greaterThan(projectOfOrganization.id))
            .select({
                projectId:      projectOfOrganization.id,
                otherProjectId: otherProjectOfOrganization.id,
            })
            .orderBy('projectId')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with projectOfOrganization as (select id as id, organization_id as organizationId from project) select projectOfOrganization.id as projectId, otherProjectOfOrganization.id as otherProjectId from projectOfOrganization inner join projectOfOrganization as otherProjectOfOrganization on otherProjectOfOrganization.organizationId = projectOfOrganization.organizationId and otherProjectOfOrganization.id > projectOfOrganization.id order by projectId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof pairsOfProjects, Array<{
            projectId:      number
            otherProjectId: number
        }>>>()
        expect(pairsOfProjects).toEqual(expected)
    })

    test('docs:cte-subqueries/with-reads-another-with', async () => {
        // Section "A view that reads from another view": both organizations have two projects.
        const expected = [{ organizationId: 1 }, { organizationId: 2 }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const projectCountPerOrganization = connection.selectFrom(tProject)
            .select({
                organizationId: tProject.organizationId,
                projectCount:   connection.count(tProject.id),
            }).groupBy('organizationId')
            .forUseInQueryAs('projectCountPerOrganization')

        const bigOrganization = connection.selectFrom(projectCountPerOrganization)
            .where(projectCountPerOrganization.projectCount.greaterOrEqual(2))
            .select({
                organizationId: projectCountPerOrganization.organizationId,
            })
            .forUseInQueryAs('bigOrganization')

        const bigOrganizations = await connection.selectFrom(bigOrganization)
            .select({
                organizationId: bigOrganization.organizationId,
            })
            .orderBy('organizationId')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with projectCountPerOrganization as (select organization_id as organizationId, count(id) as projectCount from project group by organization_id), bigOrganization as (select organizationId as organizationId from projectCountPerOrganization where projectCount >= ?1) select organizationId as organizationId from bigOrganization order by organizationId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof bigOrganizations, Array<{ organizationId: number }>>>()
        expect(bigOrganizations).toEqual(expected)
    })
})
