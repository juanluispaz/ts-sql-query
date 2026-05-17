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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with projectCountPerOrg as (select \`organization\`.id as orgId, \`organization\`.\`name\` as orgName, count(project.id) as projects from project inner join \`organization\` on \`organization\`.id = project.organization_id group by \`organization\`.id, \`organization\`.\`name\`) select orgName as orgName, projects as projects from projectCountPerOrg where projects > ? order by orgName"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            orgName:  string
            projects: number
        }>>>()
        if (ctx.realDbEnabled) {
            // Seed: Acme has 2 projects, Globex has 2 (1 archived + 1 active)
            expect(rows.length).toBeGreaterThanOrEqual(1)
        }
    })

    test('forUseAsInlineQueryValue/scalar', async () => {
        const connection = ctx.conn

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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, \`name\` as \`name\` from project where organization_id = (select id as result from \`organization\` where \`name\` = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Acme Corp",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; name: string }>>>()
        if (ctx.realDbEnabled) {
            expect(rows.map(r => r.id).sort()).toEqual([1, 2])
        }
    })

    test('subSelectUsing/forUseAsInlineQueryValue/correlated', async () => {
        const connection = ctx.conn

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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, \`name\` as \`name\`, (select count(*) as result from issue where project_id = project.id) as count from project order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{
            id:    number
            name:  string
            count: number
        }>>>()
        if (ctx.realDbEnabled) {
            // Seeded: project 1 → 2 issues, project 2 → 1, project 3 → 1, project 4 → 0
            const byId = new Map(rows.map(r => [r.id, r.count]))
            expect(byId.get(1)).toBe(2)
            expect(byId.get(2)).toBe(1)
            expect(byId.get(3)).toBe(1)
            expect(byId.get(4)).toBe(0)
        }
    })
})
