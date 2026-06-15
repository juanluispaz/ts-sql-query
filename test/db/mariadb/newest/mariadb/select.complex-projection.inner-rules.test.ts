// Coverage of how nested-object properties projected inside a
// `forUseInQueryAs(...)` CTE keep their optional/left-join shape:
//   - required leaves → the inner object is required, leaves optional.
//   - all-left-join leaves → the whole inner object becomes optional
//     (undefined when the join misses), leaves required-when-present.
//   - a two-level CTE chain re-projecting the left-join object.
//   - all-optional leaves → object dropped only when every leaf is null.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('cte-with-nested-object-of-required-columns-applies-rule-3', async () => {
        // The CTE projects a nested object whose two leaves are required
        // columns, so the inner object is required and present on every row.
        const expected = [
            { pid: 1, project: { id: 1, name: 'Marketing site' } },
            { pid: 2, project: { id: 2, name: 'Internal tools' } },
            { pid: 3, project: { id: 3, name: 'Public API' } },
            { pid: 4, project: { id: 4, name: 'Legacy app' } },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const projectCte = connection.selectFrom(tProject)
            .select({
                pid:     tProject.id,
                project: { id: tProject.id, name: tProject.name },
            })
            .forUseInQueryAs('project_cte')

        const rows = await connection.selectFrom(projectCte)
            .select({
                pid:     projectCte.pid,
                project: projectCte.project,
            })
            .orderBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with project_cte as (select id as pid, id as \`project.id\`, name as \`project.name\` from project) select pid as pid, \`project.id\` as \`project.id\`, \`project.name\` as \`project.name\` from project_cte order by pid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{
            pid:     number
            project: { id: number; name: string }
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('cte-with-nested-object-of-only-left-join-columns-applies-rule-2', async () => {
        // The CTE projects a nested object whose two leaves both come from
        // the same left-joined table. The whole `org` group becomes optional:
        // present with its leaves when the join hits, undefined when it misses.
        // Every project has an organization, so the left join never misses:
        // proj 1,2 → org 1 (Acme Corp); proj 3,4 → org 2 (Globex Ltd).
        const expected = [
            { pid: 1, org: { id: 1, name: 'Acme Corp' } },
            { pid: 2, org: { id: 1, name: 'Acme Corp' } },
            { pid: 3, org: { id: 2, name: 'Globex Ltd' } },
            { pid: 4, org: { id: 2, name: 'Globex Ltd' } },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn
        const tOrgLeft = tOrganization.forUseInLeftJoin()

        const projectOrgCte = connection.selectFrom(tProject)
            .leftJoin(tOrgLeft).on(tOrgLeft.id.equals(tProject.organizationId))
            .select({
                pid: tProject.id,
                org: { id: tOrgLeft.id, name: tOrgLeft.name },
            })
            .forUseInQueryAs('project_org_cte')

        const rows = await connection.selectFrom(projectOrgCte)
            .select({
                pid: projectOrgCte.pid,
                org: projectOrgCte.org,
            })
            .orderBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with project_org_cte as (select project.id as pid, organization.id as \`org.id\`, organization.name as \`org.name\` from project left join organization on organization.id = project.organization_id) select pid as pid, \`org.id\` as \`org.id\`, \`org.name\` as \`org.name\` from project_org_cte order by pid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{
            pid: number
            org?: { id: number | undefined; name: string | undefined }
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('cte-of-cte-nested-object-from-left-join-applies-rule-1', async () => {
        // Two-level CTE chain: the inner CTE produces the optional left-join
        // group from the previous test, and the outer CTE re-projects those
        // columns into a new nested object that stays optional.
        // Same join re-projected through a second CTE; every project has an
        // organization (proj 1,2 → org 1; proj 3,4 → org 2).
        const expected = [
            { pid: 1, group: { orgId: 1, orgName: 'Acme Corp' } },
            { pid: 2, group: { orgId: 1, orgName: 'Acme Corp' } },
            { pid: 3, group: { orgId: 2, orgName: 'Globex Ltd' } },
            { pid: 4, group: { orgId: 2, orgName: 'Globex Ltd' } },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn
        const tOrgLeft = tOrganization.forUseInLeftJoin()

        const innerCte = connection.selectFrom(tProject)
            .leftJoin(tOrgLeft).on(tOrgLeft.id.equals(tProject.organizationId))
            .select({
                pid: tProject.id,
                org: { id: tOrgLeft.id, name: tOrgLeft.name },
            })
            .forUseInQueryAs('inner_cte')

        const outerCte = connection.selectFrom(innerCte)
            .select({
                pid:   innerCte.pid,
                group: { orgId: innerCte.org.id, orgName: innerCte.org.name },
            })
            .forUseInQueryAs('outer_cte')

        const rows = await connection.selectFrom(outerCte)
            .select({
                pid:   outerCte.pid,
                group: outerCte.group,
            })
            .orderBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with inner_cte as (select project.id as pid, organization.id as \`org.id\`, organization.name as \`org.name\` from project left join organization on organization.id = project.organization_id), outer_cte as (select pid as pid, \`org.id\` as \`group.orgId\`, \`org.name\` as \`group.orgName\` from inner_cte) select pid as pid, \`group.orgId\` as \`group.orgId\`, \`group.orgName\` as \`group.orgName\` from outer_cte order by pid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{
            pid:    number
            group?: { orgId: number | undefined; orgName: string | undefined }
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('cte-with-nested-object-of-only-optional-columns-applies-rule-4', async () => {
        // A nested object made of two optional columns: the inner object is
        // optional and dropped only when every one of its leaves is null.
        // issue 1: body NULL, assignee 1 → opt present with assigneeId only.
        // issue 2: body 'Use new tokens', assignee 2 → both present.
        // issue 3: body NULL, assignee NULL → both leaves null, opt dropped.
        // issue 4: body 'See ADR-014', assignee 3 → both present.
        const expected = [
            { iid: 1, opt: { assigneeId: 1 } },
            { iid: 2, opt: { body: 'Use new tokens', assigneeId: 2 } },
            { iid: 3 },
            { iid: 4, opt: { body: 'See ADR-014', assigneeId: 3 } },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const optionalsCte = connection.selectFrom(tIssue)
            .select({
                iid: tIssue.id,
                opt: { body: tIssue.body, assigneeId: tIssue.assigneeId },
            })
            .forUseInQueryAs('opt_cte')

        const rows = await connection.selectFrom(optionalsCte)
            .select({
                iid: optionalsCte.iid,
                opt: optionalsCte.opt,
            })
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with opt_cte as (select id as iid, \`body\` as \`opt.body\`, assignee_id as \`opt.assigneeId\` from issue) select iid as iid, \`opt.body\` as \`opt.body\`, \`opt.assigneeId\` as \`opt.assigneeId\` from opt_cte order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{
            iid:  number
            opt?: { body: string | undefined; assigneeId: number | undefined }
        }>>>()
        expect(rows).toEqual(expected)
    })

})
