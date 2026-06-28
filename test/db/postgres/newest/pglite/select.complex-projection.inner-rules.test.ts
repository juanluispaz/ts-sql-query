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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with project_cte as (select id as pid, id as "project.id", name as "project.name" from project) select pid as pid, "project.id" as "project.id", "project.name" as "project.name" from project_cte order by pid"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with project_org_cte as (select project.id as pid, organization.id as "org.id", organization.name as "org.name" from project left join organization on organization.id = project.organization_id) select pid as pid, "org.id" as "org.id", "org.name" as "org.name" from project_org_cte order by pid"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with inner_cte as (select project.id as pid, organization.id as "org.id", organization.name as "org.name" from project left join organization on organization.id = project.organization_id), outer_cte as (select pid as pid, "org.id" as "group.orgId", "org.name" as "group.orgName" from inner_cte) select pid as pid, "group.orgId" as "group.orgId", "group.orgName" as "group.orgName" from outer_cte order by pid"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with opt_cte as (select id as iid, body as "opt.body", assignee_id as "opt.assigneeId" from issue) select iid as iid, "opt.body" as "opt.body", "opt.assigneeId" as "opt.assigneeId" from opt_cte order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{
            iid:  number
            opt?: { body: string | undefined; assigneeId: number | undefined }
        }>>>()
        expect(rows).toEqual(expected)
    })


    test('plain-select-nested-object-of-only-optional-columns-applies-rule-4', async () => {
        // The inline sibling of the CTE rule-4 test above: the nested object is
        // built directly in the select, with no intermediate CTE. Two optional
        // columns -> the inner object is optional and dropped only when every
        // one of its leaves is null; it is never set to null. Pins the
        // documented `opt?: { ... }` shape (no `| null`) for the plain-select
        // path -- the projectingOptionalValuesAsNullable() mode below is what
        // turns an absent nested object into `null` instead.
        ctx.mockNext([
            { iid: 1, 'opt.body': null,             'opt.assigneeId': 1 },
            { iid: 2, 'opt.body': 'Use new tokens', 'opt.assigneeId': 2 },
            { iid: 3, 'opt.body': null,             'opt.assigneeId': null },
            { iid: 4, 'opt.body': 'See ADR-014',    'opt.assigneeId': 3 },
        ])
        const expected = [
            { iid: 1, opt: { assigneeId: 1 } },
            { iid: 2, opt: { body: 'Use new tokens', assigneeId: 2 } },
            { iid: 3 },
            { iid: 4, opt: { body: 'See ADR-014', assigneeId: 3 } },
        ]

        const rows = await ctx.conn.selectFrom(tIssue)
            .select({
                iid: tIssue.id,
                opt: { body: tIssue.body, assigneeId: tIssue.assigneeId },
            })
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, body as "opt.body", assignee_id as "opt.assigneeId" from issue order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{
            iid:  number
            opt?: { body: string | undefined; assigneeId: number | undefined }
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('projecting-optional-values-as-nullable-on-plain-select-makes-left-join-object-nullable', async () => {
        // `projectingOptionalValuesAsNullable()` on a plain (non-aggregate)
        // select projects a left-joined nested object as `{...} | null` instead
        // of the default `org?: {...}`. Project 1 → organization 1 ('Acme
        // Corp'), so the join hits and `org` is present;
        // the `| null` arm is the type promise the assertion pins.
        const expected = { pid: 1, org: { id: 1, name: 'Acme Corp' } }
        ctx.mockNext(expected)
        const tOrgLeft = tOrganization.forUseInLeftJoin()
        const row = await ctx.conn.selectFrom(tProject)
            .leftJoin(tOrgLeft).on(tOrgLeft.id.equals(tProject.organizationId))
            .where(tProject.id.equals(1))
            .select({ pid: tProject.id, org: { id: tOrgLeft.id, name: tOrgLeft.name } })
            .projectingOptionalValuesAsNullable()
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, organization.id as "org.id", organization.name as "org.name" from project left join organization on organization.id = project.organization_id where project.id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { pid: number; org: { id: number; name: string } | null }>>()
        expect(row).toEqual(expected)
    })

    test('merge-optional-requiredInOptionalObject-is-preserved-through-an-operator', async () => {
        // `requiredInOptionalObject` is a middle row of the MergeOptional
        // lattice that is only reachable through an OPERATOR here.
        // `priority.asRequiredInOptionalObject()` carries that state; the
        // `.equals(id)` operator (against a required operand) merges to
        // `requiredInOptionalObject` again, so the `flag` leaf stays "required
        // when the optional `meta` object is present" — distinct from the
        // optional `assigneeId` sibling that surfaces as `| undefined`. issues
        // 1,2 (project 1): flag = (priority == id) is false for both;
        // assigneeId is 1 and 2.
        const expected = [
            { iid: 1, meta: { flag: false, assigneeId: 1 } },
            { iid: 2, meta: { flag: false, assigneeId: 2 } },
        ]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .select({
                iid: tIssue.id,
                meta: {
                    flag:       tIssue.priority.asRequiredInOptionalObject().equals(tIssue.id),
                    assigneeId: tIssue.assigneeId,
                },
            })
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, priority = id as "meta.flag", assignee_id as "meta.assigneeId" from issue where project_id = $1 order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        // `flag` stays REQUIRED inside the optional `meta` object (the operator
        // preserved requiredInOptionalObject), whereas the plain-optional
        // `assigneeId` sibling surfaces as `| undefined`.
        assertType<Exact<typeof rows, Array<{
            iid:   number
            meta?: { flag: boolean; assigneeId: number | undefined }
        }>>>()
        expect(rows).toEqual(expected)
    })
    test('rule-1-nested-object-under-projecting-optional-values-as-nullable', async () => {
        // `projectingOptionalValuesAsNullable()` over a requiredInOptionalObject
        // nested object: the nested object becomes `{...} | null`, the
        // requiredInOptionalObject `flag` stays required inside it, and the
        // plain-optional `assigneeId` surfaces as `number | null` (not
        // `| undefined`). Issue 1: priority 2, id 1 -> flag false; assignee 1.
        const expected = { iid: 1, meta: { flag: false, assigneeId: 1 } }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                iid: tIssue.id,
                meta: {
                    flag:       tIssue.priority.asRequiredInOptionalObject().equals(tIssue.id),
                    assigneeId: tIssue.assigneeId,
                },
            })
            .projectingOptionalValuesAsNullable()
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, priority = id as "meta.flag", assignee_id as "meta.assigneeId" from issue where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            iid:  number
            meta: { flag: boolean; assigneeId: number | null } | null
        }>>()
        expect(row).toEqual(expected)
    })

    test('rule-3-required-inner-object-with-optional-leaf-under-projecting-optional-values-as-nullable', async () => {
        // Rule-3 under `projectingOptionalValuesAsNullable()`: a REQUIRED inner
        // object (it carries a required leaf, `title`, so the object is always
        // present — never nullable) whose OPTIONAL leaf (`body`) flips to
        // `| null` (present as null, not absent). Issue 1: title 'Update hero
        // copy', body NULL -> body is `null`.
        const expected = { iid: 1, detail: { title: 'Update hero copy', body: null } }
        ctx.mockNext({ iid: 1, 'detail.title': 'Update hero copy', 'detail.body': null })
        const row = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                iid:    tIssue.id,
                detail: { title: tIssue.title, body: tIssue.body },
            })
            .projectingOptionalValuesAsNullable()
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, title as "detail.title", body as "detail.body" from issue where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            iid:    number
            detail: { title: string; body: string | null }
        }>>()
        expect(row).toEqual(expected)
    })

    test('plain-select-rule-4-optional-object-under-projecting-optional-values-as-nullable-surfaces-null', async () => {
        // The `projectingOptionalValuesAsNullable()` twin of the rule-4
        // plain-select test above: an all-optional nested object becomes
        // `{ ... } | null`. When EVERY leaf is null the object surfaces as
        // `opt: null` at RUNTIME (the default asUndefined mode drops the key
        // instead); the present rows carry their own `| null` leaves. This is
        // the genuine null-vs-undefined value distinction the asUndefined
        // sibling cannot stand in for.
        // issue 1: body NULL, assignee 1 -> { body: null, assigneeId: 1 }.
        // issue 3: body NULL, assignee NULL -> opt is null.
        ctx.mockNext([
            { iid: 1, 'opt.body': null,             'opt.assigneeId': 1 },
            { iid: 2, 'opt.body': 'Use new tokens', 'opt.assigneeId': 2 },
            { iid: 3, 'opt.body': null,             'opt.assigneeId': null },
            { iid: 4, 'opt.body': 'See ADR-014',    'opt.assigneeId': 3 },
        ])
        const expected = [
            { iid: 1, opt: { body: null, assigneeId: 1 } },
            { iid: 2, opt: { body: 'Use new tokens', assigneeId: 2 } },
            { iid: 3, opt: null },
            { iid: 4, opt: { body: 'See ADR-014', assigneeId: 3 } },
        ]

        const rows = await ctx.conn.selectFrom(tIssue)
            .select({
                iid: tIssue.id,
                opt: { body: tIssue.body, assigneeId: tIssue.assigneeId },
            })
            .projectingOptionalValuesAsNullable()
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, body as "opt.body", assignee_id as "opt.assigneeId" from issue order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{
            iid: number
            opt:  { body: string | null; assigneeId: number | null } | null
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('plain-select-rule-2-same-left-join-object-with-optional-leaf-under-projecting-optional-values-as-nullable', async () => {
        // Rule-2 (all leaves from the SAME left join, at least one
        // originallyRequired) under `projectingOptionalValuesAsNullable()`, with
        // an OPTIONAL leaf mixed in. The originallyRequired leaves (`id`, `name`)
        // are treated as required-when-present, the genuinely-optional `archivedAt`
        // leaf flips to `Date | null`, and the whole object is `{...} | null`
        // (null only when the join misses). The aggregate projector pins this
        // arm; this is its plain-select `assertType<Exact>` twin. Every issue has
        // a project, so the left join hits: issue 1 -> project 1 (Marketing site,
        // archived_at NULL), so the object is present and `archivedAt` is null.
        const expected = { iid: 1, proj: { id: 1, name: 'Marketing site', archivedAt: null } }
        ctx.mockNext({ iid: 1, 'proj.id': 1, 'proj.name': 'Marketing site', 'proj.archivedAt': null })
        const tProjLeft = tProject.forUseInLeftJoin()
        const row = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tProjLeft).on(tProjLeft.id.equals(tIssue.projectId))
            .where(tIssue.id.equals(1))
            .select({
                iid:  tIssue.id,
                proj: { id: tProjLeft.id, name: tProjLeft.name, archivedAt: tProjLeft.archivedAt },
            })
            .projectingOptionalValuesAsNullable()
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, project.id as "proj.id", project.name as "proj.name", project.archived_at as "proj.archivedAt" from issue left join project on project.id = issue.project_id where issue.id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            iid:  number
            proj: { id: number; name: string; archivedAt: Date | null } | null
        }>>()
        expect(row).toEqual(expected)
    })

})
