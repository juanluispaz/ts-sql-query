// Coverage of WITH clauses and inline subquery values:
//   - `forUseInQueryAs(name)` → emits `WITH name AS (...)` and exposes
//     the subquery's columns as a view-like object.
//   - `forUseAsInlineQueryValue()` → wraps a one-column select as a
//     scalar value usable inside another query.
//   - `subSelectUsing(...).forUseAsInlineQueryValue()` → same idea but
//     references outer-query tables.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('with-clause/forUseInQueryAs', async () => {
        const connection = ctx.conn

        // Seed: Acme has 2 projects (1, 2), Globex has 2 (3 + archived 4).
        // Both have count 2 > 1, ordered by orgName.
        ctx.mockNext([
            { orgName: 'Acme Corp', projects: 2 },
            { orgName: 'Globex Ltd', projects: 2 },
        ])

        // doc-start
        const projectCountPerOrg = connection.selectFrom(tProject)
            .innerJoin(tOrganization).on(tOrganization.id.equals(tProject.organizationId))
            .select({
                orgId:    tOrganization.id,
                orgName:  tOrganization.name,
                projects: connection.count(tProject.id),
            })
            .groupBy('orgId', 'orgName')
            .forUseInQueryAs('projectCountPerOrg')

        const rows = await connection.selectFrom(projectCountPerOrg)
            .where(projectCountPerOrg.projects.greaterThan(1))
            .select({
                orgName:  projectCountPerOrg.orgName,
                projects: projectCountPerOrg.projects,
            })
            .orderBy('orgName')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with projectCountPerOrg as (select organization.id as orgId, organization.name as orgName, count(project.id) as projects from project inner join organization on organization.id = project.organization_id group by organization.id, organization.name) select orgName as orgName, projects as projects from projectCountPerOrg where projects > ? order by orgName"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            orgName:  string
            projects: number
        }>>>()
        expect(rows).toEqual([
            { orgName: 'Acme Corp', projects: 2 },
            { orgName: 'Globex Ltd', projects: 2 },
        ])
    })

    test('forUseAsInlineQueryValue/scalar', async () => {
        const connection = ctx.conn

        // Seed: Acme Corp is org 1; its projects are 1 (Marketing site)
        // and 2 (Internal tools), ordered by id.
        ctx.mockNext([
            { id: 1, name: 'Marketing site' },
            { id: 2, name: 'Internal tools' },
        ])

        // doc-start
        const acmeId = connection.selectFrom(tOrganization)
            .where(tOrganization.name.equals('Acme Corp'))
            .selectOneColumn(tOrganization.id)
            .forUseAsInlineQueryValue()

        const rows = await connection.selectFrom(tProject)
            .where(tProject.organizationId.equals(acmeId))
            .select({ id: tProject.id, name: tProject.name })
            .orderBy('id')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name from project where organization_id = (select id as result from organization where name = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Acme Corp",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; name: string }>>>()
        expect(rows).toEqual([
            { id: 1, name: 'Marketing site' },
            { id: 2, name: 'Internal tools' },
        ])
    })

    test('subSelectUsing/forUseAsInlineQueryValue/correlated', async () => {
        const connection = ctx.conn

        // Seeded issue counts per project, ordered by id: 1 → 2 issues,
        // 2 → 1, 3 → 1, 4 → 0.
        ctx.mockNext([
            { id: 1, name: 'Marketing site', count: 2 },
            { id: 2, name: 'Internal tools', count: 1 },
            { id: 3, name: 'Public API',     count: 1 },
            { id: 4, name: 'Legacy app',     count: 0 },
        ])

        // doc-start: correlated count of issues per project, inlined.
        const issueCount = connection.subSelectUsing(tProject)
            .from(tIssue)
            .where(tIssue.projectId.equals(tProject.id))
            .selectCountAll()
            .forUseAsInlineQueryValue()

        const rows = await connection.selectFrom(tProject)
            .select({
                id:    tProject.id,
                name:  tProject.name,
                count: issueCount,
            })
            .orderBy('id')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, (select count(*) as result from issue where project_id = project.id) as count from project order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{
            id:    number
            name:  string
            count: number
        }>>>()
        expect(rows).toEqual([
            { id: 1, name: 'Marketing site', count: 2 },
            { id: 2, name: 'Internal tools', count: 1 },
            { id: 3, name: 'Public API',     count: 1 },
            { id: 4, name: 'Legacy app',     count: 0 },
        ])
    })
})
