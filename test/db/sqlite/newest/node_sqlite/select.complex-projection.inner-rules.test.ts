// Coverage of how nested-object properties keep their optional/left-join
// shape when projected through a `forUseInQueryAs(...)` CTE, a compound, or an
// operator:
//   - required leaves → the inner object is required, leaves optional.
//   - all-left-join leaves → the whole inner object becomes optional
//     (undefined when the join misses), leaves required-when-present.
//   - a two-level CTE chain re-projecting the left-join object.
//   - all-optional leaves → object dropped only when every leaf is null.
//   - a nested object recursed through a rule-1 object, a compound, and a
//     left-joined nested-object CTE.

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
        // The nested object is built directly in the select, with no intermediate
        // CTE. Two optional
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
        // Row 3 has every leaf null, so the optional `opt` object is dropped
        // entirely — the key must be ABSENT, not present-as-undefined. `toEqual`
        // alone can't distinguish `{ iid: 3 }` from `{ iid: 3, opt: undefined }`,
        // so assert membership directly.
        expect('opt' in rows[2]!).toBe(false)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, organization.id as "org.id", organization.name as "org.name" from project left join organization on organization.id = project.organization_id where project.id = ?"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, priority = id as "meta.flag", assignee_id as "meta.assigneeId" from issue where project_id = ? order by iid"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, priority = id as "meta.flag", assignee_id as "meta.assigneeId" from issue where id = ?"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, title as "detail.title", body as "detail.body" from issue where id = ?"`)
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
        // Under `projectingOptionalValuesAsNullable()`, an all-optional nested
        // object becomes
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, project.id as "proj.id", project.name as "proj.name", project.archived_at as "proj.archivedAt" from issue left join project on project.id = issue.project_id where issue.id = ?"`)
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

    test('plain-select-rule-2-same-left-join-object-with-optional-leaf-default-as-undefined', async () => {
        // A rule-2 nested object under the default asUndefined projector: all
        // leaves come from the SAME left join with at least one originallyRequired
        // leaf (`id`, `name`), plus a genuinely-optional leaf (`archivedAt`).
        // Rule 2 keeps the originallyRequired leaves required (`id`, `name` — no
        // `| undefined`), while the genuinely-optional `archivedAt` becomes
        // `Date | undefined`; the whole object is optional (`proj?`), dropped only
        // when the join misses (it is never set to null in this mode). Every
        // issue has a project, so the join hits: issue 1 -> project 1 (Marketing
        // site, archived_at NULL), so `proj` is present and the null `archivedAt`
        // leaf is ABSENT at runtime even though the type allows present-undefined.
        const expected = { iid: 1, proj: { id: 1, name: 'Marketing site' } }
        ctx.mockNext({ iid: 1, 'proj.id': 1, 'proj.name': 'Marketing site', 'proj.archivedAt': null })
        const tProjLeft = tProject.forUseInLeftJoin()
        const row = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tProjLeft).on(tProjLeft.id.equals(tIssue.projectId))
            .where(tIssue.id.equals(1))
            .select({
                iid:  tIssue.id,
                proj: { id: tProjLeft.id, name: tProjLeft.name, archivedAt: tProjLeft.archivedAt },
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, project.id as "proj.id", project.name as "proj.name", project.archived_at as "proj.archivedAt" from issue left join project on project.id = issue.project_id where issue.id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            iid:   number
            proj?: { id: number; name: string; archivedAt: Date | undefined }
        }>>()
        expect(row).toEqual(expected)
        // `archivedAt` is null in the seed and optional, so the default
        // asUndefined projector drops the key — assert its ABSENCE, not
        // present-as-undefined (which `toEqual` would also accept).
        expect('archivedAt' in row.proj!).toBe(false)
    })

    test('rule-1-mixing-required-in-optional-object-with-own-required-leaf', async () => {
        // A nested object mixing a `requiredInOptionalObject` leaf (`gate`,
        // status.asRequiredInOptionalObject()) with an OWN-required leaf (`ownId`,
        // a plain required column). The requiredInOptionalObject marker makes the
        // OBJECT optional (`meta?:`), but the own-required `ownId` is NOT demoted —
        // it stays a required `number`.
        const expected = { iid: 1, meta: { ownId: 1, gate: 'open' } }
        ctx.mockNext(expected)
        const row = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                iid: tIssue.id,
                meta: {
                    ownId: tIssue.id,
                    gate:  tIssue.status.asRequiredInOptionalObject(),
                },
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, id as "meta.ownId", status as "meta.gate" from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            iid:   number
            meta?: { ownId: number; gate: string }
        }>>()
        expect(row).toEqual(expected)
    })

    test('rule-1-mixing-required-in-optional-object-with-own-required-leaf-as-nullable', async () => {
        // The same mix under projectingOptionalValuesAsNullable(): the optional
        // object becomes `{...} | null`; both required leaves stay required.
        const expected = { iid: 1, meta: { ownId: 1, gate: 'open' } }
        ctx.mockNext({ iid: 1, 'meta.ownId': 1, 'meta.gate': 'open' })
        const row = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                iid: tIssue.id,
                meta: {
                    ownId: tIssue.id,
                    gate:  tIssue.status.asRequiredInOptionalObject(),
                },
            })
            .projectingOptionalValuesAsNullable()
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, id as "meta.ownId", status as "meta.gate" from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            iid:  number
            meta: { ownId: number; gate: string } | null
        }>>()
        expect(row).toEqual(expected)
    })

    test('rule-1-optional-object-containing-a-nested-required-object', async () => {
        // A rule-1 nested object (made optional by the requiredInOptionalObject
        // `gate` leaf) that itself contains a nested REQUIRED object (`inner`).
        // The recursion keeps `inner` required-when-present: when `gate` (body)
        // is null the whole `meta` object — `inner` included — is dropped;
        // otherwise `meta` is present with its required `inner`.
        // issue 1 (project 1): body null -> meta absent.
        // issue 2 (project 1): body 'Use new tokens' -> meta present.
        const expected = [
            { iid: 1 },
            { iid: 2, meta: { gate: 'Use new tokens', inner: { num: 2, pri: 1 } } },
        ]
        ctx.mockNext([
            { iid: 1, 'meta.gate': null,             'meta.inner.num': 1, 'meta.inner.pri': 2 },
            { iid: 2, 'meta.gate': 'Use new tokens', 'meta.inner.num': 2, 'meta.inner.pri': 1 },
        ])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .select({
                iid: tIssue.id,
                meta: {
                    gate:  tIssue.body.asRequiredInOptionalObject(),
                    inner: { num: tIssue.number, pri: tIssue.priority },
                },
            })
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, body as "meta.gate", number as "meta.inner.num", priority as "meta.inner.pri" from issue where project_id = ? order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid:   number
            meta?: { gate: string; inner: { num: number; pri: number } }
        }>>>()
        expect(rows).toEqual(expected)
        // Row 1's gate (body) is null, so the optional meta object is dropped
        // entirely — assert its key is ABSENT, not present-as-undefined.
        expect('meta' in rows[0]!).toBe(false)
    })

    test('rule-1-optional-object-containing-a-nested-required-object-as-nullable', async () => {
        // Under `projectingOptionalValuesAsNullable()`, a rule-1 OUTER object (`meta`,
        // made optional by its requiredInOptionalObject `gate` leaf) containing a
        // nested REQUIRED `inner` object: `meta` becomes `{...} | null` (surfacing as
        // `null` when `gate` is null), while the nested required `inner` stays
        // required inside it.
        // issue 1 (project 1): body null → meta null.
        // issue 2 (project 1): body 'Use new tokens' → meta present with inner.
        const expected = [
            { iid: 1, meta: null },
            { iid: 2, meta: { gate: 'Use new tokens', inner: { num: 2, pri: 1 } } },
        ]
        ctx.mockNext([
            { iid: 1, 'meta.gate': null,             'meta.inner.num': 1, 'meta.inner.pri': 2 },
            { iid: 2, 'meta.gate': 'Use new tokens', 'meta.inner.num': 2, 'meta.inner.pri': 1 },
        ])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .select({
                iid: tIssue.id,
                meta: {
                    gate:  tIssue.body.asRequiredInOptionalObject(),
                    inner: { num: tIssue.number, pri: tIssue.priority },
                },
            })
            .projectingOptionalValuesAsNullable()
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, body as "meta.gate", number as "meta.inner.num", priority as "meta.inner.pri" from issue where project_id = ? order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid:  number
            meta: { gate: string; inner: { num: number; pri: number } } | null
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('rule-1-three-optionality-kinds-own-required-required-in-optional-and-left-join-default', async () => {
        // Three optionality-kinds coexisting in ONE rule-1 optional object: an
        // OWN-required leaf (`ownId`), a `requiredInOptionalObject` leaf (`gate`,
        // status.asRequiredInOptionalObject() — the marker that makes the object
        // optional), and an originallyRequired LEFT-JOIN leaf (`projName`). The
        // reqInOptObj `gate` stays required inside the optional object, while the
        // originally-required left-join `projName` is DEMOTED to `| undefined` —
        // the demotion divergence between the two "required" kinds, observable in
        // a single object. Issue 1 → project 1, join hits → projName present.
        const expected = { iid: 1, meta: { ownId: 1, gate: 'open', projName: 'Marketing site' } }
        ctx.mockNext({ iid: 1, 'meta.ownId': 1, 'meta.gate': 'open', 'meta.projName': 'Marketing site' })
        const tProjLeft = tProject.forUseInLeftJoin()
        const row = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tProjLeft).on(tProjLeft.id.equals(tIssue.projectId))
            .where(tIssue.id.equals(1))
            .select({
                iid: tIssue.id,
                meta: {
                    ownId:    tIssue.id,
                    gate:     tIssue.status.asRequiredInOptionalObject(),
                    projName: tProjLeft.name,
                },
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, issue.id as "meta.ownId", issue.status as "meta.gate", project.name as "meta.projName" from issue left join project on project.id = issue.project_id where issue.id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            iid:   number
            meta?: { ownId: number; gate: string; projName: string | undefined }
        }>>()
        expect(row).toEqual(expected)
    })

    test('rule-1-three-optionality-kinds-own-required-required-in-optional-and-left-join-as-nullable', async () => {
        // The same three-kind object under projectingOptionalValuesAsNullable():
        // the optional object becomes `{...} | null`, `ownId` + `gate` stay
        // required, and the originally-required left-join `projName` flips to
        // `string | null` (not `| undefined`). Issue 1 → project 1, join hits.
        const expected = { iid: 1, meta: { ownId: 1, gate: 'open', projName: 'Marketing site' } }
        ctx.mockNext({ iid: 1, 'meta.ownId': 1, 'meta.gate': 'open', 'meta.projName': 'Marketing site' })
        const tProjLeft = tProject.forUseInLeftJoin()
        const row = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tProjLeft).on(tProjLeft.id.equals(tIssue.projectId))
            .where(tIssue.id.equals(1))
            .select({
                iid: tIssue.id,
                meta: {
                    ownId:    tIssue.id,
                    gate:     tIssue.status.asRequiredInOptionalObject(),
                    projName: tProjLeft.name,
                },
            })
            .projectingOptionalValuesAsNullable()
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, issue.id as "meta.ownId", issue.status as "meta.gate", project.name as "meta.projName" from issue left join project on project.id = issue.project_id where issue.id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            iid:  number
            meta: { ownId: number; gate: string; projName: string | null } | null
        }>>()
        expect(row).toEqual(expected)
    })

    test('rule-3-required-outer-object-containing-a-rule-4-all-optional-inner-object-default', async () => {
        // A rule-3 REQUIRED outer object (`detail`, kept required by its required
        // leaf `title`) that CONTAINS a rule-4 all-optional INNER object
        // (`inner`, body + assigneeId both optional). The inner container is
        // demoted to `inner?` while the outer `detail` stays required. Issue 2:
        // title present, body 'Use new tokens', assignee 2 → inner present.
        const expected = { iid: 2, detail: { title: 'Redesign navbar', inner: { body: 'Use new tokens', assigneeId: 2 } } }
        ctx.mockNext({ iid: 2, 'detail.title': 'Redesign navbar', 'detail.inner.body': 'Use new tokens', 'detail.inner.assigneeId': 2 })
        const row = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(2))
            .select({
                iid: tIssue.id,
                detail: {
                    title: tIssue.title,
                    inner: { body: tIssue.body, assigneeId: tIssue.assigneeId },
                },
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, title as "detail.title", body as "detail.inner.body", assignee_id as "detail.inner.assigneeId" from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof row, {
            iid:    number
            detail: { title: string; inner?: { body: string | undefined; assigneeId: number | undefined } }
        }>>()
        expect(row).toEqual(expected)
    })

    test('rule-3-required-outer-object-containing-a-rule-4-all-optional-inner-object-as-nullable', async () => {
        // The same outer-required / inner-all-optional nesting under
        // projectingOptionalValuesAsNullable(): the outer `detail` stays required,
        // the inner container becomes `{...} | null` and surfaces as `null` when
        // all its leaves are null. Issue 3: title 'Migrate to ESM', body null,
        // assignee null → inner is null (the genuine null-vs-absent distinction).
        const expected = { iid: 3, detail: { title: 'Migrate to ESM', inner: null } }
        ctx.mockNext({ iid: 3, 'detail.title': 'Migrate to ESM', 'detail.inner.body': null, 'detail.inner.assigneeId': null })
        const row = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(3))
            .select({
                iid: tIssue.id,
                detail: {
                    title: tIssue.title,
                    inner: { body: tIssue.body, assigneeId: tIssue.assigneeId },
                },
            })
            .projectingOptionalValuesAsNullable()
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, title as "detail.title", body as "detail.inner.body", assignee_id as "detail.inner.assigneeId" from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
          ]
        `)
        assertType<Exact<typeof row, {
            iid:    number
            detail: { title: string; inner: { body: string | null; assigneeId: number | null } | null }
        }>>()
        expect(row).toEqual(expected)
    })

    test('compound-union-preserves-a-nested-object', async () => {
        // A compound (UNION) whose two arms both project the same nested
        // `header` object: the compound result re-projects the nested object
        // unchanged (it stays required, leaves required). arm 1 = issue 1,
        // arm 2 = issue 2.
        const expected = [
            { iid: 1, header: { num: 1, title: 'Update hero copy' } },
            { iid: 2, header: { num: 2, title: 'Redesign navbar' } },
        ]
        ctx.mockNext([
            { iid: 1, 'header.num': 1, 'header.title': 'Update hero copy' },
            { iid: 2, 'header.num': 2, 'header.title': 'Redesign navbar' },
        ])
        const rows = await ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(1))
            .select({ iid: tIssue.id, header: { num: tIssue.number, title: tIssue.title } })
            .union(
                ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(2))
                    .select({ iid: tIssue.id, header: { num: tIssue.number, title: tIssue.title } }),
            )
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, number as "header.num", title as "header.title" from issue where id = ? union select id as iid, number as "header.num", title as "header.title" from issue where id = ? order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid:    number
            header: { num: number; title: string }
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('nested-object-cte-used-via-for-use-in-left-join-becomes-optional', async () => {
        // A CTE projecting a nested `info` object, then used as a left-join
        // target via forUseInLeftJoin(): reading the CTE's nested object back
        // makes the whole object optional (absent when the join misses). Every
        // issue has a project, so the join hits: issue 1 -> project 1.
        const expected = [
            { iid: 1, proj: { name: 'Marketing site', slug: 'mktg-site' } },
        ]
        ctx.mockNext([
            { iid: 1, 'proj.name': 'Marketing site', 'proj.slug': 'mktg-site' },
        ])
        const projCte = ctx.conn.selectFrom(tProject)
            .select({ pid: tProject.id, info: { name: tProject.name, slug: tProject.slug } })
            .forUseInQueryAs('proj_cte')
        const projCteLeft = projCte.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tIssue)
            .leftJoin(projCteLeft).on(projCteLeft.pid.equals(tIssue.projectId))
            .where(tIssue.id.equals(1))
            .select({ iid: tIssue.id, proj: projCteLeft.info })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with proj_cte as (select id as pid, name as "info.name", slug as "info.slug" from project) select issue.id as iid, proj_cte."info.name" as "proj.name", proj_cte."info.slug" as "proj.slug" from issue left join proj_cte on proj_cte.pid = issue.project_id where issue.id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid:   number
            proj?: { name: string; slug: string }
        }>>>()
        expect(rows).toEqual(expected)
    })


    test('left-join-object-of-only-optional-columns-applies-rule-4-not-rule-2', async () => {
        // A nested object whose leaves ALL come from the SAME left-joined table
        // AND are ALL genuinely-optional columns (`body` / `assigneeId`): the
        // object is optional and dropped only when every leaf is null (rule 4).
        // project 3 → issue 4 (opt present); project 4 → no issue (left-join miss
        // → opt dropped).
        const expected = [
            { pid: 3, opt: { body: 'See ADR-014', assigneeId: 3 } },
            { pid: 4 },
        ]
        ctx.mockNext([
            { pid: 3, 'opt.body': 'See ADR-014', 'opt.assigneeId': 3 },
            { pid: 4, 'opt.body': null, 'opt.assigneeId': null },
        ])
        const connection = ctx.conn
        const tIssueLeft = tIssue.forUseInLeftJoin()
        const rows = await connection.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.id.in([3, 4]))
            .select({
                pid: tProject.id,
                opt: { body: tIssueLeft.body, assigneeId: tIssueLeft.assigneeId },
            })
            .orderBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, issue.body as "opt.body", issue.assignee_id as "opt.assigneeId" from project left join issue on issue.project_id = project.id where project.id in (?, ?) order by pid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
            4,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid:  number
            opt?: { body: string | undefined; assigneeId: number | undefined }
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('left-join-object-of-only-optional-columns-rule-4-under-projecting-optional-values-as-nullable', async () => {
        // Under `projectingOptionalValuesAsNullable()` the dropped object surfaces
        // as present-`null` rather than absent, and each leaf surfaces as `| null`:
        // project 4's missing issue becomes `opt: null`.
        const expected = [
            { pid: 3, opt: { body: 'See ADR-014', assigneeId: 3 } },
            { pid: 4, opt: null },
        ]
        ctx.mockNext([
            { pid: 3, 'opt.body': 'See ADR-014', 'opt.assigneeId': 3 },
            { pid: 4, 'opt.body': null, 'opt.assigneeId': null },
        ])
        const connection = ctx.conn
        const tIssueLeft = tIssue.forUseInLeftJoin()
        const rows = await connection.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.id.in([3, 4]))
            .select({
                pid: tProject.id,
                opt: { body: tIssueLeft.body, assigneeId: tIssueLeft.assigneeId },
            })
            .projectingOptionalValuesAsNullable()
            .orderBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, issue.body as "opt.body", issue.assignee_id as "opt.assigneeId" from project left join issue on issue.project_id = project.id where project.id in (?, ?) order by pid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
            4,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid:  number
            opt:  { body: string | null; assigneeId: number | null } | null
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('rule-2-same-left-join-outer-object-containing-a-nested-inner-object-default', async () => {
        // A rule-2 OUTER object (`proj`, leaves from the same left join with an
        // originallyRequired `id`) that CONTAINS a nested INNER object (`inner`,
        // also from the same left join). The outer `proj` is optional (`proj?`,
        // dropped when the join misses); the required `id` stays required; and the
        // inner container surfaces as `{...} | undefined` (present-key, value
        // undefined when the join misses). Issue 1 → project 1, the join hits, so
        // `proj` and `inner` are present.
        const expected = { iid: 1, proj: { id: 1, inner: { name: 'Marketing site', slug: 'mktg-site' } } }
        ctx.mockNext({ iid: 1, 'proj.id': 1, 'proj.inner.name': 'Marketing site', 'proj.inner.slug': 'mktg-site' })
        const tProjLeft = tProject.forUseInLeftJoin()
        const row = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tProjLeft).on(tProjLeft.id.equals(tIssue.projectId))
            .where(tIssue.id.equals(1))
            .select({
                iid:  tIssue.id,
                proj: { id: tProjLeft.id, inner: { name: tProjLeft.name, slug: tProjLeft.slug } },
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, project.id as "proj.id", project.name as "proj.inner.name", project.slug as "proj.inner.slug" from issue left join project on project.id = issue.project_id where issue.id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            iid:   number
            proj?: { id: number; inner: { name: string; slug: string } | undefined }
        }>>()
        expect(row).toEqual(expected)
    })

    test('rule-2-same-left-join-outer-object-containing-a-nested-inner-object-as-nullable', async () => {
        // The same rule-2 outer / nested inner under
        // `projectingOptionalValuesAsNullable()`: the outer `proj` becomes
        // `{...} | null`, the required `id` stays required, and the inner container
        // becomes `{...} | null`. Issue 1 → project 1, the join hits.
        const expected = { iid: 1, proj: { id: 1, inner: { name: 'Marketing site', slug: 'mktg-site' } } }
        ctx.mockNext({ iid: 1, 'proj.id': 1, 'proj.inner.name': 'Marketing site', 'proj.inner.slug': 'mktg-site' })
        const tProjLeft = tProject.forUseInLeftJoin()
        const row = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tProjLeft).on(tProjLeft.id.equals(tIssue.projectId))
            .where(tIssue.id.equals(1))
            .select({
                iid:  tIssue.id,
                proj: { id: tProjLeft.id, inner: { name: tProjLeft.name, slug: tProjLeft.slug } },
            })
            .projectingOptionalValuesAsNullable()
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, project.id as "proj.id", project.name as "proj.inner.name", project.slug as "proj.inner.slug" from issue left join project on project.id = issue.project_id where issue.id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            iid:  number
            proj: { id: number; inner: { name: string; slug: string } | null } | null
        }>>()
        expect(row).toEqual(expected)
    })

    test('rule-3-required-outer-object-containing-a-rule-1-required-in-optional-inner-object-default', async () => {
        // A rule-3 REQUIRED OUTER object (`detail`, kept required by its required
        // leaf `title`) that CONTAINS a rule-1 INNER object (`meta`, made optional
        // by its `requiredInOptionalObject` `gate` leaf). The inner object fires
        // its own rule-1 independently of the outer rule: `detail` stays required,
        // `meta`
        // is demoted to `meta?`, its reqInOptObj `gate` stays required inside, and
        // the plain-optional `assigneeId` is `| undefined`. Issue 1: title present,
        // status 'open' → meta present; assignee 1.
        const expected = { iid: 1, detail: { title: 'Update hero copy', meta: { gate: 'open', assigneeId: 1 } } }
        ctx.mockNext({ iid: 1, 'detail.title': 'Update hero copy', 'detail.meta.gate': 'open', 'detail.meta.assigneeId': 1 })
        const row = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                iid: tIssue.id,
                detail: {
                    title: tIssue.title,
                    meta: {
                        gate:       tIssue.status.asRequiredInOptionalObject(),
                        assigneeId: tIssue.assigneeId,
                    },
                },
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, title as "detail.title", status as "detail.meta.gate", assignee_id as "detail.meta.assigneeId" from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            iid:    number
            detail: { title: string; meta?: { gate: string; assigneeId: number | undefined } }
        }>>()
        expect(row).toEqual(expected)
    })

    test('rule-3-required-outer-object-containing-a-rule-1-required-in-optional-inner-object-as-nullable', async () => {
        // The same rule-3-outer / rule-1-inner nesting under
        // `projectingOptionalValuesAsNullable()`: the outer `detail` stays
        // required, the inner rule-1 `meta` becomes `{...} | null`, its reqInOptObj
        // `gate` stays required, and the plain-optional `assigneeId` flips to
        // `number | null`. Issue 1: status 'open' → meta present.
        const expected = { iid: 1, detail: { title: 'Update hero copy', meta: { gate: 'open', assigneeId: 1 } } }
        ctx.mockNext({ iid: 1, 'detail.title': 'Update hero copy', 'detail.meta.gate': 'open', 'detail.meta.assigneeId': 1 })
        const row = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                iid: tIssue.id,
                detail: {
                    title: tIssue.title,
                    meta: {
                        gate:       tIssue.status.asRequiredInOptionalObject(),
                        assigneeId: tIssue.assigneeId,
                    },
                },
            })
            .projectingOptionalValuesAsNullable()
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, title as "detail.title", status as "detail.meta.gate", assignee_id as "detail.meta.assigneeId" from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            iid:    number
            detail: { title: string; meta: { gate: string; assigneeId: number | null } | null }
        }>>()
        expect(row).toEqual(expected)
    })

    test('matrix-rule-1-outer-rule-1-inner-default', async () => {
        // Outer `meta` is rule-1 (its `gate` = status.asRequiredInOptionalObject()
        // is never null, so `meta` is always present); inner `inner` is
        // independently rule-1 (its own `innerGate` = body). The inner renders as
        // `inner: {...} | undefined` inside the optional outer — present when body is
        // non-null, dropped otherwise. issue 1 (project 1): body null → inner
        // dropped; issue 2: body 'Use new tokens' → inner present with extra = 2.
        const expected = [
            { iid: 1, meta: { gate: 'open' } },
            { iid: 2, meta: { gate: 'in_progress', inner: { innerGate: 'Use new tokens', extra: 2 } } },
        ]
        ctx.mockNext([
            { iid: 1, 'meta.gate': 'open',        'meta.inner.innerGate': null,             'meta.inner.extra': 1 },
            { iid: 2, 'meta.gate': 'in_progress', 'meta.inner.innerGate': 'Use new tokens', 'meta.inner.extra': 2 },
        ])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .select({
                iid: tIssue.id,
                meta: {
                    gate:  tIssue.status.asRequiredInOptionalObject(),
                    inner: { innerGate: tIssue.body.asRequiredInOptionalObject(), extra: tIssue.assigneeId },
                },
            })
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, status as "meta.gate", body as "meta.inner.innerGate", assignee_id as "meta.inner.extra" from issue where project_id = ? order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid:   number
            meta?: { gate: string; inner: { innerGate: string; extra: number | undefined } | undefined }
        }>>>()
        expect(rows).toEqual(expected)
        // Row 1: the inner rule-1 object is dropped (its gate is null).
        expect('inner' in rows[0]!.meta!).toBe(false)
    })

    test('matrix-rule-1-outer-rule-1-inner-as-nullable', async () => {
        // The same 1×1 nesting under projectingOptionalValuesAsNullable(): the outer
        // `meta` becomes `{...} | null`, the inner rule-1 object becomes
        // `{...} | null` (null when its gate is null), and the plain-optional `extra`
        // flips to `number | null`. issue 1: body null → inner null; issue 2: inner
        // present.
        const expected = [
            { iid: 1, meta: { gate: 'open', inner: null } },
            { iid: 2, meta: { gate: 'in_progress', inner: { innerGate: 'Use new tokens', extra: 2 } } },
        ]
        ctx.mockNext([
            { iid: 1, 'meta.gate': 'open',        'meta.inner.innerGate': null,             'meta.inner.extra': 1 },
            { iid: 2, 'meta.gate': 'in_progress', 'meta.inner.innerGate': 'Use new tokens', 'meta.inner.extra': 2 },
        ])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .select({
                iid: tIssue.id,
                meta: {
                    gate:  tIssue.status.asRequiredInOptionalObject(),
                    inner: { innerGate: tIssue.body.asRequiredInOptionalObject(), extra: tIssue.assigneeId },
                },
            })
            .projectingOptionalValuesAsNullable()
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, status as "meta.gate", body as "meta.inner.innerGate", assignee_id as "meta.inner.extra" from issue where project_id = ? order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid:  number
            meta: { gate: string; inner: { innerGate: string; extra: number | null } | null } | null
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('matrix-rule-1-outer-rule-2-inner-default', async () => {
        // Outer `meta` is rule-1 (gate = status); inner `proj` is rule-2 (both
        // leaves from the same left join, `name` originallyRequired + `arch`
        // optional). The inner renders as `proj: {...} | undefined` inside the
        // optional outer. issue 1 → project 1 (Marketing site, archived_at null): the
        // join hits so `proj` is present; `arch` is absent (null under asUndefined).
        const expected = { iid: 1, meta: { gate: 'open', proj: { name: 'Marketing site' } } }
        ctx.mockNext({ iid: 1, 'meta.gate': 'open', 'meta.proj.name': 'Marketing site', 'meta.proj.arch': null })
        const tProjLeft = tProject.forUseInLeftJoin()
        const row = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tProjLeft).on(tProjLeft.id.equals(tIssue.projectId))
            .where(tIssue.id.equals(1))
            .select({
                iid: tIssue.id,
                meta: {
                    gate: tIssue.status.asRequiredInOptionalObject(),
                    proj: { name: tProjLeft.name, arch: tProjLeft.archivedAt },
                },
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, issue.status as "meta.gate", project.name as "meta.proj.name", project.archived_at as "meta.proj.arch" from issue left join project on project.id = issue.project_id where issue.id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            iid:   number
            meta?: { gate: string; proj: { name: string; arch: Date | undefined } | undefined }
        }>>()
        expect(row).toEqual(expected)
    })

    test('matrix-rule-1-outer-rule-2-inner-as-nullable', async () => {
        // The same 1×2 nesting under projectingOptionalValuesAsNullable(): outer
        // `meta` becomes `{...} | null`, inner rule-2 `proj` becomes `{...} | null`
        // (null only when the join misses), and the optional `arch` leaf flips to
        // `Date | null`. issue 1 → project 1, join hits, `arch` null.
        const expected = { iid: 1, meta: { gate: 'open', proj: { name: 'Marketing site', arch: null } } }
        ctx.mockNext({ iid: 1, 'meta.gate': 'open', 'meta.proj.name': 'Marketing site', 'meta.proj.arch': null })
        const tProjLeft = tProject.forUseInLeftJoin()
        const row = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tProjLeft).on(tProjLeft.id.equals(tIssue.projectId))
            .where(tIssue.id.equals(1))
            .select({
                iid: tIssue.id,
                meta: {
                    gate: tIssue.status.asRequiredInOptionalObject(),
                    proj: { name: tProjLeft.name, arch: tProjLeft.archivedAt },
                },
            })
            .projectingOptionalValuesAsNullable()
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, issue.status as "meta.gate", project.name as "meta.proj.name", project.archived_at as "meta.proj.arch" from issue left join project on project.id = issue.project_id where issue.id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            iid:  number
            meta: { gate: string; proj: { name: string; arch: Date | null } | null } | null
        }>>()
        expect(row).toEqual(expected)
    })

    test('matrix-rule-1-outer-rule-4-inner-default', async () => {
        // Outer `meta` is rule-1 (gate = status); inner `inner` is rule-4 (all
        // optional leaves, `body` + `assigneeId`). The inner renders as
        // `inner: {...} | undefined`, dropped only when every leaf is null.
        // issue 1: body null, assignee 1 → inner present with assigneeId;
        // issue 3: body null, assignee null → inner dropped.
        const expected = [
            { iid: 1, meta: { gate: 'open', inner: { assigneeId: 1 } } },
            { iid: 3, meta: { gate: 'open' } },
        ]
        ctx.mockNext([
            { iid: 1, 'meta.gate': 'open', 'meta.inner.body': null, 'meta.inner.assigneeId': 1 },
            { iid: 3, 'meta.gate': 'open', 'meta.inner.body': null, 'meta.inner.assigneeId': null },
        ])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.in([1, 3]))
            .select({
                iid: tIssue.id,
                meta: {
                    gate:  tIssue.status.asRequiredInOptionalObject(),
                    inner: { body: tIssue.body, assigneeId: tIssue.assigneeId },
                },
            })
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, status as "meta.gate", body as "meta.inner.body", assignee_id as "meta.inner.assigneeId" from issue where id in (?, ?) order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            3,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid:   number
            meta?: { gate: string; inner: { body: string | undefined; assigneeId: number | undefined } | undefined }
        }>>>()
        expect(rows).toEqual(expected)
        // Row 2 (issue 3): the inner rule-4 object is dropped (every leaf null).
        expect('inner' in rows[1]!.meta!).toBe(false)
    })

    test('matrix-rule-1-outer-rule-4-inner-as-nullable', async () => {
        // The same 1×4 nesting under projectingOptionalValuesAsNullable(): outer
        // `meta` becomes `{...} | null`, inner rule-4 becomes `{...} | null` (null
        // when all leaves null), and each leaf flips to `| null`. issue 1: inner
        // present with `body: null`; issue 3: inner null.
        const expected = [
            { iid: 1, meta: { gate: 'open', inner: { body: null, assigneeId: 1 } } },
            { iid: 3, meta: { gate: 'open', inner: null } },
        ]
        ctx.mockNext([
            { iid: 1, 'meta.gate': 'open', 'meta.inner.body': null, 'meta.inner.assigneeId': 1 },
            { iid: 3, 'meta.gate': 'open', 'meta.inner.body': null, 'meta.inner.assigneeId': null },
        ])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.in([1, 3]))
            .select({
                iid: tIssue.id,
                meta: {
                    gate:  tIssue.status.asRequiredInOptionalObject(),
                    inner: { body: tIssue.body, assigneeId: tIssue.assigneeId },
                },
            })
            .projectingOptionalValuesAsNullable()
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, status as "meta.gate", body as "meta.inner.body", assignee_id as "meta.inner.assigneeId" from issue where id in (?, ?) order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            3,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid:  number
            meta: { gate: string; inner: { body: string | null; assigneeId: number | null } | null } | null
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('matrix-rule-2-outer-rule-1-inner-default', async () => {
        // Outer `proj` is rule-2 (all leaves from the same left join, `id`
        // originallyRequired); inner `inner` is rule-1 (its gate =
        // slug.asRequiredInOptionalObject()). The rule-2 `id` stays required inside
        // the optional `proj`; the inner rule-1 renders as `inner: {...} | undefined`.
        // issue 1 → project 1 (slug 'mktg-site', archived_at null): join hits, inner
        // present (slug non-null), `arch` absent.
        const expected = { iid: 1, proj: { id: 1, inner: { gate: 'mktg-site' } } }
        ctx.mockNext({ iid: 1, 'proj.id': 1, 'proj.inner.gate': 'mktg-site', 'proj.inner.arch': null })
        const tProjLeft = tProject.forUseInLeftJoin()
        const row = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tProjLeft).on(tProjLeft.id.equals(tIssue.projectId))
            .where(tIssue.id.equals(1))
            .select({
                iid: tIssue.id,
                proj: { id: tProjLeft.id, inner: { gate: tProjLeft.slug.asRequiredInOptionalObject(), arch: tProjLeft.archivedAt } },
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, project.id as "proj.id", project.slug as "proj.inner.gate", project.archived_at as "proj.inner.arch" from issue left join project on project.id = issue.project_id where issue.id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            iid:   number
            proj?: { id: number; inner: { gate: string; arch: Date | undefined } | undefined }
        }>>()
        expect(row).toEqual(expected)
    })

    test('matrix-rule-2-outer-rule-1-inner-as-nullable', async () => {
        // The same 2×1 nesting under projectingOptionalValuesAsNullable(): outer
        // rule-2 `proj` becomes `{...} | null`, `id` stays required, inner rule-1
        // becomes `{...} | null`, and `arch` flips to `Date | null`. issue 1 →
        // project 1, join hits, `arch` null.
        const expected = { iid: 1, proj: { id: 1, inner: { gate: 'mktg-site', arch: null } } }
        ctx.mockNext({ iid: 1, 'proj.id': 1, 'proj.inner.gate': 'mktg-site', 'proj.inner.arch': null })
        const tProjLeft = tProject.forUseInLeftJoin()
        const row = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tProjLeft).on(tProjLeft.id.equals(tIssue.projectId))
            .where(tIssue.id.equals(1))
            .select({
                iid: tIssue.id,
                proj: { id: tProjLeft.id, inner: { gate: tProjLeft.slug.asRequiredInOptionalObject(), arch: tProjLeft.archivedAt } },
            })
            .projectingOptionalValuesAsNullable()
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, project.id as "proj.id", project.slug as "proj.inner.gate", project.archived_at as "proj.inner.arch" from issue left join project on project.id = issue.project_id where issue.id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            iid:  number
            proj: { id: number; inner: { gate: string; arch: Date | null } | null } | null
        }>>()
        expect(row).toEqual(expected)
    })

    test('matrix-rule-2-outer-rule-3-inner-default', async () => {
        // Outer `proj` is rule-2 (`name` originallyRequired from the left join);
        // inner `inner` is rule-3 (has an own-table required leaf `title`, so the
        // inner stays REQUIRED even inside the optional `proj`). The inner's optional
        // `body` leaf is demoted to `body?`. issue 1 → project 1 (join hits), title
        // 'Update hero copy', body null → body absent.
        const expected = { iid: 1, proj: { name: 'Marketing site', inner: { title: 'Update hero copy' } } }
        ctx.mockNext({ iid: 1, 'proj.name': 'Marketing site', 'proj.inner.title': 'Update hero copy', 'proj.inner.body': null })
        const tProjLeft = tProject.forUseInLeftJoin()
        const row = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tProjLeft).on(tProjLeft.id.equals(tIssue.projectId))
            .where(tIssue.id.equals(1))
            .select({
                iid: tIssue.id,
                proj: { name: tProjLeft.name, inner: { title: tIssue.title, body: tIssue.body } },
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, project.name as "proj.name", issue.title as "proj.inner.title", issue.body as "proj.inner.body" from issue left join project on project.id = issue.project_id where issue.id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            iid:   number
            proj?: { name: string; inner: { body?: string; title: string } }
        }>>()
        expect(row).toEqual(expected)
        // The inner rule-3 object stays required, but its optional `body` leaf is
        // absent (null in the seed) under the asUndefined projector.
        expect('body' in row.proj!.inner).toBe(false)
    })

    test('matrix-rule-2-outer-rule-3-inner-as-nullable', async () => {
        // The same 2×3 nesting under projectingOptionalValuesAsNullable(): outer
        // rule-2 `proj` becomes `{...} | null`, the inner rule-3 object stays
        // required, and its optional `body` leaf flips to `string | null`. issue 1 →
        // project 1, join hits, body null.
        const expected = { iid: 1, proj: { name: 'Marketing site', inner: { title: 'Update hero copy', body: null } } }
        ctx.mockNext({ iid: 1, 'proj.name': 'Marketing site', 'proj.inner.title': 'Update hero copy', 'proj.inner.body': null })
        const tProjLeft = tProject.forUseInLeftJoin()
        const row = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tProjLeft).on(tProjLeft.id.equals(tIssue.projectId))
            .where(tIssue.id.equals(1))
            .select({
                iid: tIssue.id,
                proj: { name: tProjLeft.name, inner: { title: tIssue.title, body: tIssue.body } },
            })
            .projectingOptionalValuesAsNullable()
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, project.name as "proj.name", issue.title as "proj.inner.title", issue.body as "proj.inner.body" from issue left join project on project.id = issue.project_id where issue.id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            iid:  number
            proj: { name: string; inner: { title: string; body: string | null } } | null
        }>>()
        expect(row).toEqual(expected)
    })

    test('matrix-rule-2-outer-rule-4-inner-default', async () => {
        // Outer `proj` is rule-2 (`name` originallyRequired); inner `inner` is
        // rule-4 (its only leaf, `arch`, is optional). The inner renders as
        // `inner: {...} | undefined`, dropped when its single leaf is null. issue 1 →
        // project 1 (archived_at null): join hits so `proj` is present, but the inner
        // rule-4 object is dropped (its only leaf is null).
        const expected = { iid: 1, proj: { name: 'Marketing site' } }
        ctx.mockNext({ iid: 1, 'proj.name': 'Marketing site', 'proj.inner.arch': null })
        const tProjLeft = tProject.forUseInLeftJoin()
        const row = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tProjLeft).on(tProjLeft.id.equals(tIssue.projectId))
            .where(tIssue.id.equals(1))
            .select({
                iid: tIssue.id,
                proj: { name: tProjLeft.name, inner: { arch: tProjLeft.archivedAt } },
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, project.name as "proj.name", project.archived_at as "proj.inner.arch" from issue left join project on project.id = issue.project_id where issue.id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            iid:   number
            proj?: { name: string; inner: { arch: Date | undefined } | undefined }
        }>>()
        expect(row).toEqual(expected)
        // The inner rule-4 object is dropped (its only leaf is null).
        expect('inner' in row.proj!).toBe(false)
    })

    test('matrix-rule-2-outer-rule-4-inner-as-nullable', async () => {
        // The same 2×4 nesting under projectingOptionalValuesAsNullable(): outer
        // rule-2 `proj` becomes `{...} | null`, the inner rule-4 object becomes
        // `{...} | null` (null when its leaf is null), and `arch` flips to
        // `Date | null`. issue 1 → project 1, join hits, inner null.
        const expected = { iid: 1, proj: { name: 'Marketing site', inner: null } }
        ctx.mockNext({ iid: 1, 'proj.name': 'Marketing site', 'proj.inner.arch': null })
        const tProjLeft = tProject.forUseInLeftJoin()
        const row = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tProjLeft).on(tProjLeft.id.equals(tIssue.projectId))
            .where(tIssue.id.equals(1))
            .select({
                iid: tIssue.id,
                proj: { name: tProjLeft.name, inner: { arch: tProjLeft.archivedAt } },
            })
            .projectingOptionalValuesAsNullable()
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, project.name as "proj.name", project.archived_at as "proj.inner.arch" from issue left join project on project.id = issue.project_id where issue.id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            iid:  number
            proj: { name: string; inner: { arch: Date | null } | null } | null
        }>>()
        expect(row).toEqual(expected)
    })

    test('matrix-rule-3-outer-rule-2-inner-default', async () => {
        // Outer `detail` is rule-3 (own-table required leaf `title`, so `detail`
        // stays REQUIRED); inner `proj` is rule-2 (both leaves from the same left
        // join). The inner renders as `proj?` (optional key, dropped only when the
        // join misses). issue 1 → project 1 (Marketing site, archived_at null): join
        // hits, `proj` present, `arch` absent.
        const expected = { iid: 1, detail: { title: 'Update hero copy', proj: { name: 'Marketing site' } } }
        ctx.mockNext({ iid: 1, 'detail.title': 'Update hero copy', 'detail.proj.name': 'Marketing site', 'detail.proj.arch': null })
        const tProjLeft = tProject.forUseInLeftJoin()
        const row = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tProjLeft).on(tProjLeft.id.equals(tIssue.projectId))
            .where(tIssue.id.equals(1))
            .select({
                iid: tIssue.id,
                detail: { title: tIssue.title, proj: { name: tProjLeft.name, arch: tProjLeft.archivedAt } },
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, issue.title as "detail.title", project.name as "detail.proj.name", project.archived_at as "detail.proj.arch" from issue left join project on project.id = issue.project_id where issue.id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            iid:    number
            detail: { title: string; proj?: { name: string; arch: Date | undefined } }
        }>>()
        expect(row).toEqual(expected)
        // The inner rule-2 `proj` is present (the join hit), but its optional `arch`
        // leaf is absent (null) under the asUndefined projector.
        expect('arch' in row.detail.proj!).toBe(false)
    })

    test('matrix-rule-3-outer-rule-2-inner-as-nullable', async () => {
        // The same 3×2 nesting under projectingOptionalValuesAsNullable(): the outer
        // rule-3 `detail` stays required, the inner rule-2 `proj` becomes
        // `{...} | null` (null only when the join misses), and `arch` flips to
        // `Date | null`. issue 1 → project 1, join hits, `arch` null.
        const expected = { iid: 1, detail: { title: 'Update hero copy', proj: { name: 'Marketing site', arch: null } } }
        ctx.mockNext({ iid: 1, 'detail.title': 'Update hero copy', 'detail.proj.name': 'Marketing site', 'detail.proj.arch': null })
        const tProjLeft = tProject.forUseInLeftJoin()
        const row = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tProjLeft).on(tProjLeft.id.equals(tIssue.projectId))
            .where(tIssue.id.equals(1))
            .select({
                iid: tIssue.id,
                detail: { title: tIssue.title, proj: { name: tProjLeft.name, arch: tProjLeft.archivedAt } },
            })
            .projectingOptionalValuesAsNullable()
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, issue.title as "detail.title", project.name as "detail.proj.name", project.archived_at as "detail.proj.arch" from issue left join project on project.id = issue.project_id where issue.id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            iid:    number
            detail: { title: string; proj: { name: string; arch: Date | null } | null }
        }>>()
        expect(row).toEqual(expected)
    })

    test('sole-optional-inner-own-table-rule-4-object-keeps-wrapper-required-default', async () => {
        // A nested object (`wrapper`) whose sole member is an all-optional inner
        // object (no scalar sibling): the inner container is optional (`inner?`) and
        // the outer `wrapper` is required. Both issues carry a non-null body +
        // assignee, so the inner is present on every row.
        // issue 2 (project 1): body 'Use new tokens', assignee 2.
        // issue 4 (project 3): body 'See ADR-014',    assignee 3.
        ctx.mockNext([
            { iid: 2, 'wrapper.inner.body': 'Use new tokens', 'wrapper.inner.assigneeId': 2 },
            { iid: 4, 'wrapper.inner.body': 'See ADR-014',    'wrapper.inner.assigneeId': 3 },
        ])
        const expected = [
            { iid: 2, wrapper: { inner: { body: 'Use new tokens', assigneeId: 2 } } },
            { iid: 4, wrapper: { inner: { body: 'See ADR-014', assigneeId: 3 } } },
        ]
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.in([2, 4]))
            .select({
                iid:     tIssue.id,
                wrapper: { inner: { body: tIssue.body, assigneeId: tIssue.assigneeId } },
            })
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, body as "wrapper.inner.body", assignee_id as "wrapper.inner.assigneeId" from issue where id in (?, ?) order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            4,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid:     number
            wrapper: { inner?: { body: string | undefined; assigneeId: number | undefined } | undefined }
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('sole-optional-inner-own-table-rule-4-object-keeps-wrapper-required-as-nullable', async () => {
        // Under `projectingOptionalValuesAsNullable()`: `wrapper` stays required, the
        // all-optional inner object becomes `{...} | null`, and its leaves flip to
        // `| null`. Both rows carry a present inner (non-null leaves).
        ctx.mockNext([
            { iid: 2, 'wrapper.inner.body': 'Use new tokens', 'wrapper.inner.assigneeId': 2 },
            { iid: 4, 'wrapper.inner.body': 'See ADR-014',    'wrapper.inner.assigneeId': 3 },
        ])
        const expected = [
            { iid: 2, wrapper: { inner: { body: 'Use new tokens', assigneeId: 2 } } },
            { iid: 4, wrapper: { inner: { body: 'See ADR-014', assigneeId: 3 } } },
        ]
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.in([2, 4]))
            .select({
                iid:     tIssue.id,
                wrapper: { inner: { body: tIssue.body, assigneeId: tIssue.assigneeId } },
            })
            .projectingOptionalValuesAsNullable()
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, body as "wrapper.inner.body", assignee_id as "wrapper.inner.assigneeId" from issue where id in (?, ?) order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            4,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid:     number
            wrapper: { inner: { body: string | null; assigneeId: number | null } | null }
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('sole-optional-inner-left-join-rule-2-object-keeps-wrapper-required-default', async () => {
        // The left-join case: `wrapper`'s sole member is an inner object whose leaves
        // all come from the same left join (`id`/`number`, originallyRequired). The
        // outer `wrapper` is required, the inner container is optional (`inner?`), and
        // its leaves stay required-when-present. Both projects join to exactly one
        // issue, so the inner is present on every row.
        // project 2 → issue 3 (num 1); project 3 → issue 4 (num 1).
        ctx.mockNext([
            { pid: 2, 'wrapper.inner.iid': 3, 'wrapper.inner.num': 1 },
            { pid: 3, 'wrapper.inner.iid': 4, 'wrapper.inner.num': 1 },
        ])
        const expected = [
            { pid: 2, wrapper: { inner: { iid: 3, num: 1 } } },
            { pid: 3, wrapper: { inner: { iid: 4, num: 1 } } },
        ]
        const tIssueLeft = tIssue.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.id.in([2, 3]))
            .select({
                pid:     tProject.id,
                wrapper: { inner: { iid: tIssueLeft.id, num: tIssueLeft.number } },
            })
            .orderBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, issue.id as "wrapper.inner.iid", issue.number as "wrapper.inner.num" from project left join issue on issue.project_id = project.id where project.id in (?, ?) order by pid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            3,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid:     number
            wrapper: { inner?: { iid: number; num: number } | undefined }
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('sole-optional-inner-left-join-rule-2-object-keeps-wrapper-required-as-nullable', async () => {
        // Under `projectingOptionalValuesAsNullable()`: `wrapper` stays required, the
        // left-join inner becomes `{...} | null`, and the originallyRequired leaves
        // stay required inside it. Both projects join.
        ctx.mockNext([
            { pid: 2, 'wrapper.inner.iid': 3, 'wrapper.inner.num': 1 },
            { pid: 3, 'wrapper.inner.iid': 4, 'wrapper.inner.num': 1 },
        ])
        const expected = [
            { pid: 2, wrapper: { inner: { iid: 3, num: 1 } } },
            { pid: 3, wrapper: { inner: { iid: 4, num: 1 } } },
        ]
        const tIssueLeft = tIssue.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.id.in([2, 3]))
            .select({
                pid:     tProject.id,
                wrapper: { inner: { iid: tIssueLeft.id, num: tIssueLeft.number } },
            })
            .projectingOptionalValuesAsNullable()
            .orderBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, issue.id as "wrapper.inner.iid", issue.number as "wrapper.inner.num" from project left join issue on issue.project_id = project.id where project.id in (?, ?) order by pid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            3,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid:     number
            wrapper: { inner: { iid: number; num: number } | null }
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('sole-optional-inner-own-table-rule-4-collapse-drops-wrapper-though-type-requires-it-default', async () => {
        // When the sole all-optional inner object collapses (every leaf null), the
        // default asUndefined projector DROPS the whole `wrapper` container at
        // runtime, yet the type keeps `wrapper` required — so `row.wrapper.inner`
        // is unsound (typed present, absent at runtime).
        // issue 3: body null, assignee null → inner collapses → wrapper dropped.
        // TODO[BUG]: see BUGS.md — a nested object whose sole member is an
        // all-optional inner is typed required, but the container is dropped
        // (default mode) at runtime when that only inner collapses.
        ctx.mockNext({ iid: 3, 'wrapper.inner.body': null, 'wrapper.inner.assigneeId': null })
        const expected = { iid: 3 }
        const row = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(3))
            .select({
                iid:     tIssue.id,
                wrapper: { inner: { body: tIssue.body, assigneeId: tIssue.assigneeId } },
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, body as "wrapper.inner.body", assignee_id as "wrapper.inner.assigneeId" from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
          ]
        `)
        assertType<Exact<typeof row, {
            iid:     number
            wrapper: { inner?: { body: string | undefined; assigneeId: number | undefined } | undefined }
        }>>()
        expect(row).toEqual(expected)
        // The type guarantees `wrapper` is present, but at runtime the key is ABSENT.
        expect('wrapper' in row).toBe(false)
    })

    test('sole-optional-inner-own-table-rule-4-collapse-nulls-wrapper-though-type-requires-it-as-nullable', async () => {
        // Under projectingOptionalValuesAsNullable(), the collapsed sole inner makes
        // the projector emit `wrapper: null` at runtime, yet the type keeps
        // `wrapper` required (no `| null`) — so `row.wrapper` is typed non-null but
        // is null. issue 3: body null, assignee null → inner collapses → wrapper null.
        // TODO[BUG]: see BUGS.md — a nested object whose sole member is an
        // all-optional inner is typed required, but the container is null
        // (as-nullable mode) at runtime when that only inner collapses.
        ctx.mockNext({ iid: 3, 'wrapper.inner.body': null, 'wrapper.inner.assigneeId': null })
        const expected = { iid: 3, wrapper: null }
        const row = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(3))
            .select({
                iid:     tIssue.id,
                wrapper: { inner: { body: tIssue.body, assigneeId: tIssue.assigneeId } },
            })
            .projectingOptionalValuesAsNullable()
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, body as "wrapper.inner.body", assignee_id as "wrapper.inner.assigneeId" from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
          ]
        `)
        assertType<Exact<typeof row, {
            iid:     number
            wrapper: { inner: { body: string | null; assigneeId: number | null } | null }
        }>>()
        expect(row).toEqual(expected)
    })

    test('sole-optional-inner-left-join-rule-2-collapse-drops-wrapper-though-type-requires-it-default', async () => {
        // The left-join case: when the join misses, the sole inner's leaves are all
        // null, the inner collapses, and the default asUndefined projector DROPS the
        // whole `wrapper` container at runtime — yet the type keeps `wrapper`
        // required. project 4 has no issue → left join misses → wrapper dropped.
        // TODO[BUG]: see BUGS.md — a nested object whose sole member is an
        // all-optional inner is typed required, but the container is dropped
        // (default mode) at runtime when that only inner collapses.
        ctx.mockNext({ pid: 4, 'wrapper.inner.iid': null, 'wrapper.inner.num': null })
        const expected = { pid: 4 }
        const tIssueLeft = tIssue.forUseInLeftJoin()
        const row = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.id.equals(4))
            .select({
                pid:     tProject.id,
                wrapper: { inner: { iid: tIssueLeft.id, num: tIssueLeft.number } },
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, issue.id as "wrapper.inner.iid", issue.number as "wrapper.inner.num" from project left join issue on issue.project_id = project.id where project.id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            4,
          ]
        `)
        assertType<Exact<typeof row, {
            pid:     number
            wrapper: { inner?: { iid: number; num: number } | undefined }
        }>>()
        expect(row).toEqual(expected)
        // The type guarantees `wrapper` is present, but at runtime the key is ABSENT.
        expect('wrapper' in row).toBe(false)
    })

    test('sole-optional-inner-left-join-rule-2-collapse-nulls-wrapper-though-type-requires-it-as-nullable', async () => {
        // Under projectingOptionalValuesAsNullable(), a missed left join collapses
        // the sole inner and the projector emits `wrapper: null` at runtime, yet the
        // type keeps `wrapper` required (no `| null`).
        // project 4 has no issue → left join misses → wrapper null.
        // TODO[BUG]: see BUGS.md — a nested object whose sole member is an
        // all-optional inner is typed required, but the container is null
        // (as-nullable mode) at runtime when that only inner collapses.
        ctx.mockNext({ pid: 4, 'wrapper.inner.iid': null, 'wrapper.inner.num': null })
        const expected = { pid: 4, wrapper: null }
        const tIssueLeft = tIssue.forUseInLeftJoin()
        const row = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.id.equals(4))
            .select({
                pid:     tProject.id,
                wrapper: { inner: { iid: tIssueLeft.id, num: tIssueLeft.number } },
            })
            .projectingOptionalValuesAsNullable()
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, issue.id as "wrapper.inner.iid", issue.number as "wrapper.inner.num" from project left join issue on issue.project_id = project.id where project.id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            4,
          ]
        `)
        assertType<Exact<typeof row, {
            pid:     number
            wrapper: { inner: { iid: number; num: number } | null }
        }>>()
        expect(row).toEqual(expected)
    })
})
