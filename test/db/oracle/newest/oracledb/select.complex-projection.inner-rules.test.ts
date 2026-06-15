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
        // The CTE projects a nested object whose two leaves are
        // `tProject.id` and `tProject.name` — both `required`. Inside
        // `getInnerObjetRuleToApply` (L223-237) the for-each switch
        // hits `case 'required'` for each → `containsRequired = true`,
        // `contaisOriginallyRequired = false`. The final guard at
        // L293 returns Rule 3, and the matching case at L188-192
        // rewrites every leaf to `optional` in the WITH view's typed
        // surface. Selecting the inner-object property from the CTE
        // therefore exposes `{ id?: number, name?: string }`.
        ctx.mockNext([
            { pid: 1, project: { id: 1, name: 'Marketing site' } },
            { pid: 2, project: { id: 2, name: 'Internal tools' } },
            { pid: 3, project: { id: 3, name: 'Public API' } },
            { pid: 4, project: { id: 4, name: 'Legacy app' } },
        ])
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with project_cte as (select id as pid, id as "project.id", name as "project.name" from project) select pid as "pid", "project.id" as "project.id", "project.name" as "project.name" from project_cte order by "pid""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{
            pid:     number
            project: { id: number; name: string }
        }>>>()
        expect(rows).toEqual([
            { pid: 1, project: { id: 1, name: 'Marketing site' } },
            { pid: 2, project: { id: 2, name: 'Internal tools' } },
            { pid: 3, project: { id: 3, name: 'Public API' } },
            { pid: 4, project: { id: 4, name: 'Legacy app' } },
        ])
    })

    test('cte-with-nested-object-of-only-left-join-columns-applies-rule-2', async () => {
        // The CTE projects a nested object whose two leaves come from
        // a `forUseInLeftJoin()` source (`tOrgLeft.id`, `tOrgLeft.name`),
        // so both are `originallyRequired` on the same table. Inside
        // `getInnerObjetRuleToApply`:
        //   - the switch (L223-237) hits `case 'originallyRequired'`
        //     for each → `contaisOriginallyRequired = true`;
        //   - `firstRequiredTables` is populated with the single
        //     left-join table, `alwaysSameRequiredTablesSize` stays
        //     `true`, `onlyOuterJoin` is `true` → returns 2.
        // The matching case at L183-187 stamps every leaf with
        // `requiredInOptionalObject`. Downstream complex projection
        // therefore turns the whole `org` group into `undefined` when
        // any of its leaves comes back null — left-join semantics for
        // an inner group. The TS surface still says `id: number,
        // name: string` because `requiredInOptionalObject` is a marker
        // for "required when the group is present", not for "leaf is
        // optional".
        ctx.mockNext([
            { pid: 1, org: { id: 1, name: 'Acme Corp' } },
            { pid: 2, org: { id: 1, name: 'Acme Corp' } },
            { pid: 3, org: { id: 2, name: 'Globex Ltd' } },
            { pid: 4, org: { id: 2, name: 'Globex Ltd' } },
        ])
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with project_org_cte as (select project.id as pid, "organization".id as "org.id", "organization".name as "org.name" from project left join "organization" on "organization".id = project.organization_id) select pid as "pid", "org.id" as "org.id", "org.name" as "org.name" from project_org_cte order by "pid""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{
            pid: number
            org?: { id: number | undefined; name: string | undefined }
        }>>>()
        expect(rows).toEqual([
            { pid: 1, org: { id: 1, name: 'Acme Corp' } },
            { pid: 2, org: { id: 1, name: 'Acme Corp' } },
            { pid: 3, org: { id: 2, name: 'Globex Ltd' } },
            { pid: 4, org: { id: 2, name: 'Globex Ltd' } },
        ])
    })

    test('cte-of-cte-nested-object-from-left-join-applies-rule-1', async () => {
        // Two-level CTE chain. The INNER CTE (`inner_cte`) runs the
        // Rule-2 case from the previous test, so its `org` group's
        // columns carry `__optionalType === 'requiredInOptionalObject'`
        // on the view's typed surface. The OUTER CTE (`outer_cte`)
        // re-projects those columns inside a new nested object
        // (`group`). Inside `getInnerObjetRuleToApply` the switch at
        // L223-237 hits `case 'requiredInOptionalObject'` for the
        // first leaf and immediately returns 1 (L227-229). The
        // matching case at L178-182 in `createColumnsFromInnerObject`
        // downgrades every `originallyRequired` leaf to `optional`.
        // The outer CTE's `group.orgId` and `group.orgName` are
        // therefore typed as optional in the final projection.
        ctx.mockNext([
            { pid: 1, group: { orgId: 1, orgName: 'Acme Corp' } },
            { pid: 2, group: { orgId: 1, orgName: 'Acme Corp' } },
            { pid: 3, group: { orgId: 2, orgName: 'Globex Ltd' } },
            { pid: 4, group: { orgId: 2, orgName: 'Globex Ltd' } },
        ])
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with inner_cte as (select project.id as pid, "organization".id as "org.id", "organization".name as "org.name" from project left join "organization" on "organization".id = project.organization_id), outer_cte as (select pid as pid, "org.id" as "group.orgId", "org.name" as "group.orgName" from inner_cte) select pid as "pid", "group.orgId" as "group.orgId", "group.orgName" as "group.orgName" from outer_cte order by "pid""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{
            pid:    number
            group?: { orgId: number | undefined; orgName: string | undefined }
        }>>>()
        expect(rows).toEqual([
            { pid: 1, group: { orgId: 1, orgName: 'Acme Corp' } },
            { pid: 2, group: { orgId: 1, orgName: 'Acme Corp' } },
            { pid: 3, group: { orgId: 2, orgName: 'Globex Ltd' } },
            { pid: 4, group: { orgId: 2, orgName: 'Globex Ltd' } },
        ])
    })

    test('cte-with-nested-object-of-only-optional-columns-applies-rule-4', async () => {
        // A nested object made of two `optional` columns reaches Rule 4
        // (`return 4` at L297). Inside `getInnerObjetRuleToApply` the
        // for-each switch (L223-237) hits `default` for each (no flag
        // updated), the `contaisOriginallyRequired` branch is skipped
        // (no originallyRequired column), and the final guard at L293
        // is `false || false` → falls through to `return 4`. The
        // matching `case 4` at L193-198 rewrites every non-required
        // leaf to `optional` (no-op since they were already optional).
        ctx.mockNext([
            { iid: 1, opt: { body: undefined, assigneeId: 1 } },
            { iid: 2, opt: { body: 'Use new tokens', assigneeId: 2 } },
            { iid: 3, opt: { body: undefined, assigneeId: undefined } },
            { iid: 4, opt: { body: 'See ADR-014', assigneeId: 3 } },
        ])
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with opt_cte as (select id as iid, "body" as "opt.body", assignee_id as "opt.assigneeId" from issue) select iid as "iid", "opt.body" as "opt.body", "opt.assigneeId" as "opt.assigneeId" from opt_cte order by "iid""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{
            iid:  number
            opt?: { body: string | undefined; assigneeId: number | undefined }
        }>>>()
        expect(rows).toEqual([
            { iid: 1, opt: { assigneeId: 1 } },
            { iid: 2, opt: { body: 'Use new tokens', assigneeId: 2 } },
            { iid: 3 },
            { iid: 4, opt: { body: 'See ADR-014', assigneeId: 3 } },
        ])
    })

})
