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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with project_cte as (select id as pid, id as \`project.id\`, \`name\` as \`project.name\` from project) select pid as pid, \`project.id\` as \`project.id\`, \`project.name\` as \`project.name\` from project_cte order by pid"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with project_org_cte as (select project.id as pid, \`organization\`.id as \`org.id\`, \`organization\`.\`name\` as \`org.name\` from project left join \`organization\` on \`organization\`.id = project.organization_id) select pid as pid, \`org.id\` as \`org.id\`, \`org.name\` as \`org.name\` from project_org_cte order by pid"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with inner_cte as (select project.id as pid, \`organization\`.id as \`org.id\`, \`organization\`.\`name\` as \`org.name\` from project left join \`organization\` on \`organization\`.id = project.organization_id), outer_cte as (select pid as pid, \`org.id\` as \`group.orgId\`, \`org.name\` as \`group.orgName\` from inner_cte) select pid as pid, \`group.orgId\` as \`group.orgId\`, \`group.orgName\` as \`group.orgName\` from outer_cte order by pid"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with opt_cte as (select id as iid, body as \`opt.body\`, assignee_id as \`opt.assigneeId\` from issue) select iid as iid, \`opt.body\` as \`opt.body\`, \`opt.assigneeId\` as \`opt.assigneeId\` from opt_cte order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{
            iid:  number
            opt?: { body: string | undefined; assigneeId: number | undefined }
        }>>>()
        expect(rows).toEqual(expected)
    })


    test('cte-with-nested-object-of-only-optional-columns-rule-4-under-projecting-optional-values-as-nullable', async () => {
        // The rule-4 CTE re-projection above (an all-optional `opt` object read back
        // out of a `forUseInQueryAs(...)` CTE) under
        // `projectingOptionalValuesAsNullable()`: the object becomes `{...} | null`
        // and its leaves flip to `| null`. When every leaf is null the object
        // surfaces as `opt: null` (present-key/null) instead of being dropped — the
        // genuine null-vs-absent distinction the asUndefined sibling cannot show.
        // issue 1: body null, assignee 1 -> { body: null, assigneeId: 1 };
        // issue 3: body null, assignee null -> opt null.
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
            .projectingOptionalValuesAsNullable()
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with opt_cte as (select id as iid, body as \`opt.body\`, assignee_id as \`opt.assigneeId\` from issue) select iid as iid, \`opt.body\` as \`opt.body\`, \`opt.assigneeId\` as \`opt.assigneeId\` from opt_cte order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{
            iid: number
            opt: { body: string | null; assigneeId: number | null } | null
        }>>>()
        expect(rows).toEqual(expected)
        // issue 3's leaves are all null, so the optional `opt` object surfaces as
        // present-`null` under the asNull projector (not dropped).
        expect('opt' in rows[2]!).toBe(true)
        expect(rows[2]!.opt).toBeNull()
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, body as \`opt.body\`, assignee_id as \`opt.assigneeId\` from issue order by iid"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, \`organization\`.id as \`org.id\`, \`organization\`.\`name\` as \`org.name\` from project left join \`organization\` on \`organization\`.id = project.organization_id where project.id = ?"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, priority = id as \`meta.flag\`, assignee_id as \`meta.assigneeId\` from issue where project_id = ? order by iid"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, priority = id as \`meta.flag\`, assignee_id as \`meta.assigneeId\` from issue where id = ?"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, title as \`detail.title\`, body as \`detail.body\` from issue where id = ?"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, body as \`opt.body\`, assignee_id as \`opt.assigneeId\` from issue order by iid"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, project.id as \`proj.id\`, project.\`name\` as \`proj.name\`, project.archived_at as \`proj.archivedAt\` from issue left join project on project.id = issue.project_id where issue.id = ?"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, project.id as \`proj.id\`, project.\`name\` as \`proj.name\`, project.archived_at as \`proj.archivedAt\` from issue left join project on project.id = issue.project_id where issue.id = ?"`)
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


    test('plain-select-rule-2-object-dropped-on-left-join-miss-default-as-undefined', async () => {
        // The default asUndefined projector × a plain select × a rule-2 nested
        // object (both leaves from the SAME left join, both originallyRequired)
        // on a real left-join MISS: the whole object key is DROPPED (absent), not
        // present-undefined. project 3 -> issue 4 (hit); project 4 (Legacy app)
        // has no issue, so its left join misses and the `iss` key is absent.
        const expected = [
            { pid: 3, iss: { id: 4, title: 'Document /v2/users' } },
            { pid: 4 },
        ]
        ctx.mockNext([
            { pid: 3, 'iss.id': 4, 'iss.title': 'Document /v2/users' },
            { pid: 4, 'iss.id': null, 'iss.title': null },
        ])
        const tIssueLeft = tIssue.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.id.in([3, 4]))
            .select({ pid: tProject.id, iss: { id: tIssueLeft.id, title: tIssueLeft.title } })
            .orderBy('pid')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, issue.id as \`iss.id\`, issue.title as \`iss.title\` from project left join issue on issue.project_id = project.id where project.id in (?, ?) order by pid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
            4,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid: number
            iss?: { id: number; title: string }
        }>>>()
        expect(rows).toEqual(expected)
        // The join-miss row DROPS the object key entirely — assert its ABSENCE,
        // not present-as-undefined (which `toEqual` would also accept).
        expect('iss' in rows[1]!).toBe(false)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, id as \`meta.ownId\`, \`status\` as \`meta.gate\` from issue where id = ?"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, id as \`meta.ownId\`, \`status\` as \`meta.gate\` from issue where id = ?"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, body as \`meta.gate\`, \`number\` as \`meta.inner.num\`, priority as \`meta.inner.pri\` from issue where project_id = ? order by iid"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, body as \`meta.gate\`, \`number\` as \`meta.inner.num\`, priority as \`meta.inner.pri\` from issue where project_id = ? order by iid"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, issue.id as \`meta.ownId\`, issue.\`status\` as \`meta.gate\`, project.\`name\` as \`meta.projName\` from issue left join project on project.id = issue.project_id where issue.id = ?"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, issue.id as \`meta.ownId\`, issue.\`status\` as \`meta.gate\`, project.\`name\` as \`meta.projName\` from issue left join project on project.id = issue.project_id where issue.id = ?"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, title as \`detail.title\`, body as \`detail.inner.body\`, assignee_id as \`detail.inner.assigneeId\` from issue where id = ?"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, title as \`detail.title\`, body as \`detail.inner.body\`, assignee_id as \`detail.inner.assigneeId\` from issue where id = ?"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, \`number\` as \`header.num\`, title as \`header.title\` from issue where id = ? union select id as iid, \`number\` as \`header.num\`, title as \`header.title\` from issue where id = ? order by iid"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with proj_cte as (select id as pid, \`name\` as \`info.name\`, slug as \`info.slug\` from project) select issue.id as iid, proj_cte.\`info.name\` as \`proj.name\`, proj_cte.\`info.slug\` as \`proj.slug\` from issue left join proj_cte on proj_cte.pid = issue.project_id where issue.id = ?"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, issue.body as \`opt.body\`, issue.assignee_id as \`opt.assigneeId\` from project left join issue on issue.project_id = project.id where project.id in (?, ?) order by pid"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, issue.body as \`opt.body\`, issue.assignee_id as \`opt.assigneeId\` from project left join issue on issue.project_id = project.id where project.id in (?, ?) order by pid"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, project.id as \`proj.id\`, project.\`name\` as \`proj.inner.name\`, project.slug as \`proj.inner.slug\` from issue left join project on project.id = issue.project_id where issue.id = ?"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, project.id as \`proj.id\`, project.\`name\` as \`proj.inner.name\`, project.slug as \`proj.inner.slug\` from issue left join project on project.id = issue.project_id where issue.id = ?"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, title as \`detail.title\`, \`status\` as \`detail.meta.gate\`, assignee_id as \`detail.meta.assigneeId\` from issue where id = ?"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, title as \`detail.title\`, \`status\` as \`detail.meta.gate\`, assignee_id as \`detail.meta.assigneeId\` from issue where id = ?"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, \`status\` as \`meta.gate\`, body as \`meta.inner.innerGate\`, assignee_id as \`meta.inner.extra\` from issue where project_id = ? order by iid"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, \`status\` as \`meta.gate\`, body as \`meta.inner.innerGate\`, assignee_id as \`meta.inner.extra\` from issue where project_id = ? order by iid"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, issue.\`status\` as \`meta.gate\`, project.\`name\` as \`meta.proj.name\`, project.archived_at as \`meta.proj.arch\` from issue left join project on project.id = issue.project_id where issue.id = ?"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, issue.\`status\` as \`meta.gate\`, project.\`name\` as \`meta.proj.name\`, project.archived_at as \`meta.proj.arch\` from issue left join project on project.id = issue.project_id where issue.id = ?"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, \`status\` as \`meta.gate\`, body as \`meta.inner.body\`, assignee_id as \`meta.inner.assigneeId\` from issue where id in (?, ?) order by iid"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, \`status\` as \`meta.gate\`, body as \`meta.inner.body\`, assignee_id as \`meta.inner.assigneeId\` from issue where id in (?, ?) order by iid"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, project.id as \`proj.id\`, project.slug as \`proj.inner.gate\`, project.archived_at as \`proj.inner.arch\` from issue left join project on project.id = issue.project_id where issue.id = ?"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, project.id as \`proj.id\`, project.slug as \`proj.inner.gate\`, project.archived_at as \`proj.inner.arch\` from issue left join project on project.id = issue.project_id where issue.id = ?"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, project.\`name\` as \`proj.name\`, issue.title as \`proj.inner.title\`, issue.body as \`proj.inner.body\` from issue left join project on project.id = issue.project_id where issue.id = ?"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, project.\`name\` as \`proj.name\`, issue.title as \`proj.inner.title\`, issue.body as \`proj.inner.body\` from issue left join project on project.id = issue.project_id where issue.id = ?"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, project.\`name\` as \`proj.name\`, project.archived_at as \`proj.inner.arch\` from issue left join project on project.id = issue.project_id where issue.id = ?"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, project.\`name\` as \`proj.name\`, project.archived_at as \`proj.inner.arch\` from issue left join project on project.id = issue.project_id where issue.id = ?"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, issue.title as \`detail.title\`, project.\`name\` as \`detail.proj.name\`, project.archived_at as \`detail.proj.arch\` from issue left join project on project.id = issue.project_id where issue.id = ?"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, issue.title as \`detail.title\`, project.\`name\` as \`detail.proj.name\`, project.archived_at as \`detail.proj.arch\` from issue left join project on project.id = issue.project_id where issue.id = ?"`)
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

    test('matrix-rule-4-outer-rule-1-inner-default', async () => {
        // Outer `outer` is rule-4 (all-optional): it is made optional by an optional
        // OWN scalar leaf (`own` = body), so the container is dropped only when EVERY
        // leaf is null. Inner `inner` is rule-1 (its `gate` =
        // status.asRequiredInOptionalObject(); status is a required column, never null,
        // so the inner is always present). The rule-4 outer stays present while its own
        // optional `own` leaf drops on the null-body row. Default asUndefined projector:
        // `outer?`, the inner renders `inner: {...} | undefined`, and the optional
        // `own`/`extra` leaves surface as `| undefined`.
        // issue 1 (project 1): body null → own dropped; status 'open', assignee 1.
        // issue 2 (project 1): body 'Use new tokens'; status 'in_progress', assignee 2.
        const expected = [
            { iid: 1, outer: { inner: { gate: 'open', extra: 1 } } },
            { iid: 2, outer: { own: 'Use new tokens', inner: { gate: 'in_progress', extra: 2 } } },
        ]
        ctx.mockNext([
            { iid: 1, 'outer.own': null,             'outer.inner.gate': 'open',        'outer.inner.extra': 1 },
            { iid: 2, 'outer.own': 'Use new tokens', 'outer.inner.gate': 'in_progress', 'outer.inner.extra': 2 },
        ])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .select({
                iid: tIssue.id,
                outer: {
                    own:   tIssue.body,
                    inner: { gate: tIssue.status.asRequiredInOptionalObject(), extra: tIssue.assigneeId },
                },
            })
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, body as \`outer.own\`, \`status\` as \`outer.inner.gate\`, assignee_id as \`outer.inner.extra\` from issue where project_id = ? order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid:    number
            outer?: { own: string | undefined; inner: { gate: string; extra: number | undefined } | undefined }
        }>>>()
        expect(rows).toEqual(expected)
        // The rule-4 outer stays present on the null-body row (its inner leaves are
        // non-null); only its own optional `own` leaf is dropped under asUndefined.
        expect('own' in rows[0]!.outer!).toBe(false)
    })

    test('matrix-rule-4-outer-rule-1-inner-as-nullable', async () => {
        // The same 4×1 nesting under projectingOptionalValuesAsNullable(): the rule-4
        // outer becomes `{...} | null` (null only when every leaf is null), the inner
        // rule-1 object becomes `{...} | null`, and the optional `own`/`extra` leaves
        // flip to `| null`. The outer is present on both rows (its inner leaves are
        // non-null); the null-body row surfaces `own: null`.
        // issue 1 (project 1): body null → own null; status 'open', assignee 1.
        // issue 2 (project 1): body 'Use new tokens'; status 'in_progress', assignee 2.
        const expected = [
            { iid: 1, outer: { own: null, inner: { gate: 'open', extra: 1 } } },
            { iid: 2, outer: { own: 'Use new tokens', inner: { gate: 'in_progress', extra: 2 } } },
        ]
        ctx.mockNext([
            { iid: 1, 'outer.own': null,             'outer.inner.gate': 'open',        'outer.inner.extra': 1 },
            { iid: 2, 'outer.own': 'Use new tokens', 'outer.inner.gate': 'in_progress', 'outer.inner.extra': 2 },
        ])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .select({
                iid: tIssue.id,
                outer: {
                    own:   tIssue.body,
                    inner: { gate: tIssue.status.asRequiredInOptionalObject(), extra: tIssue.assigneeId },
                },
            })
            .projectingOptionalValuesAsNullable()
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, body as \`outer.own\`, \`status\` as \`outer.inner.gate\`, assignee_id as \`outer.inner.extra\` from issue where project_id = ? order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid:   number
            outer: { own: string | null; inner: { gate: string; extra: number | null } | null } | null
        }>>>()
        expect(rows).toEqual(expected)
        // The rule-4 outer is present (its inner leaves are non-null); the null-body
        // row surfaces its own optional `own` leaf as present-`null` under asNull.
        expect(rows[0]!.outer!.own).toBeNull()
    })

    test('matrix-rule-4-outer-rule-2-inner-default', async () => {
        // Outer `outer` is rule-4 (all-optional), made optional by an optional OWN
        // scalar leaf (`own` = body from the main issue table). Inner `proj` is rule-2
        // (both leaves from the SAME left join, `name` originallyRequired + `arch`
        // optional), so it renders `proj: {...} | undefined` with `name`
        // required-when-present. Default asUndefined projector: `outer?`, `own` is
        // `string | undefined`, the optional `arch` leaf is dropped when null.
        // issue 2 → project 1 (join hits): body 'Use new tokens', name 'Marketing
        // site', archived_at null → arch dropped.
        const expected = { iid: 2, outer: { own: 'Use new tokens', proj: { name: 'Marketing site' } } }
        ctx.mockNext({ iid: 2, 'outer.own': 'Use new tokens', 'outer.proj.name': 'Marketing site', 'outer.proj.arch': null })
        const tProjLeft = tProject.forUseInLeftJoin()
        const row = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tProjLeft).on(tProjLeft.id.equals(tIssue.projectId))
            .where(tIssue.id.equals(2))
            .select({
                iid: tIssue.id,
                outer: {
                    own:  tIssue.body,
                    proj: { name: tProjLeft.name, arch: tProjLeft.archivedAt },
                },
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, issue.body as \`outer.own\`, project.\`name\` as \`outer.proj.name\`, project.archived_at as \`outer.proj.arch\` from issue left join project on project.id = issue.project_id where issue.id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof row, {
            iid:    number
            outer?: { own: string | undefined; proj: { name: string; arch: Date | undefined } | undefined }
        }>>()
        expect(row).toEqual(expected)
        // The inner rule-2 `proj` is present (the join hit); its optional `arch` leaf
        // is absent (null) under the asUndefined projector.
        expect('arch' in row.outer!.proj!).toBe(false)
    })

    test('matrix-rule-4-outer-rule-2-inner-as-nullable', async () => {
        // The same 4×2 nesting under projectingOptionalValuesAsNullable(): the rule-4
        // outer becomes `{...} | null`, the optional own `own` leaf flips to
        // `string | null`, the inner rule-2 `proj` becomes `{...} | null` (null only
        // when the join misses), and its optional `arch` leaf flips to `Date | null`.
        // issue 2 → project 1 (join hits): body 'Use new tokens', name 'Marketing
        // site', archived_at null → arch null.
        const expected = { iid: 2, outer: { own: 'Use new tokens', proj: { name: 'Marketing site', arch: null } } }
        ctx.mockNext({ iid: 2, 'outer.own': 'Use new tokens', 'outer.proj.name': 'Marketing site', 'outer.proj.arch': null })
        const tProjLeft = tProject.forUseInLeftJoin()
        const row = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tProjLeft).on(tProjLeft.id.equals(tIssue.projectId))
            .where(tIssue.id.equals(2))
            .select({
                iid: tIssue.id,
                outer: {
                    own:  tIssue.body,
                    proj: { name: tProjLeft.name, arch: tProjLeft.archivedAt },
                },
            })
            .projectingOptionalValuesAsNullable()
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, issue.body as \`outer.own\`, project.\`name\` as \`outer.proj.name\`, project.archived_at as \`outer.proj.arch\` from issue left join project on project.id = issue.project_id where issue.id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof row, {
            iid:   number
            outer: { own: string | null; proj: { name: string; arch: Date | null } | null } | null
        }>>()
        expect(row).toEqual(expected)
    })


    test('matrix-rule-4-outer-rule-4-inner-default', async () => {
        // A rule-4 (all-optional) OUTER object whose members are an optional OWN
        // scalar (`own` = body) AND a rule-4 (all-optional) INNER object (`inner` =
        // estimated_hours + parent_id, both optional). The outer is
        // dropped only when EVERY leaf — own and both inner leaves — is null; the
        // inner is dropped when both its leaves are null. Default asUndefined:
        // `outer?`, `outer.inner?`, and each optional leaf `| undefined`.
        // estimated_hours and parent_id are NULL for every seeded issue, so `inner`
        // always collapses; the two runtime cases turn on `own` (= body).
        //   issue 2 (project 1): body 'Use new tokens' → outer PRESENT (own non-null),
        //                        inner collapsed → `inner` key ABSENT.
        //   issue 3 (project 2): body null, all inner leaves null → outer collapsed →
        //                        `outer` key ABSENT.
        const expected = [
            { iid: 2, outer: { own: 'Use new tokens' } },
            { iid: 3 },
        ]
        ctx.mockNext([
            { iid: 2, 'outer.own': 'Use new tokens', 'outer.inner.est': null, 'outer.inner.parent': null },
            { iid: 3, 'outer.own': null,             'outer.inner.est': null, 'outer.inner.parent': null },
        ])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.in([2, 3]))
            .select({
                iid: tIssue.id,
                outer: {
                    own:   tIssue.body,
                    inner: { est: tIssue.estimatedHours, parent: tIssue.parentId },
                },
            })
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, body as \`outer.own\`, estimated_hours as \`outer.inner.est\`, parent_id as \`outer.inner.parent\` from issue where id in (?, ?) order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            3,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid:    number
            outer?: { own: string | undefined; inner: { est: number | undefined; parent: number | undefined } | undefined }
        }>>>()
        expect(rows).toEqual(expected)
        // issue 2: outer present (own non-null), inner collapsed → key ABSENT.
        expect('inner' in rows[0]!.outer!).toBe(false)
        // issue 3: every leaf null → outer collapsed → key ABSENT.
        expect('outer' in rows[1]!).toBe(false)
    })

    test('matrix-rule-4-outer-rule-4-inner-as-nullable', async () => {
        // The same nesting under projectingOptionalValuesAsNullable(): the rule-4
        // outer becomes `{...} | null` (null only when every leaf is null), the rule-4
        // inner becomes `{...} | null`, and every optional leaf flips to `| null`.
        //   issue 2 (project 1): body 'Use new tokens' → outer PRESENT, inner all-null
        //                        → `inner: null`.
        //   issue 3 (project 2): every leaf null → `outer: null`.
        const expected = [
            { iid: 2, outer: { own: 'Use new tokens', inner: null } },
            { iid: 3, outer: null },
        ]
        ctx.mockNext([
            { iid: 2, 'outer.own': 'Use new tokens', 'outer.inner.est': null, 'outer.inner.parent': null },
            { iid: 3, 'outer.own': null,             'outer.inner.est': null, 'outer.inner.parent': null },
        ])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.in([2, 3]))
            .select({
                iid: tIssue.id,
                outer: {
                    own:   tIssue.body,
                    inner: { est: tIssue.estimatedHours, parent: tIssue.parentId },
                },
            })
            .projectingOptionalValuesAsNullable()
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, body as \`outer.own\`, estimated_hours as \`outer.inner.est\`, parent_id as \`outer.inner.parent\` from issue where id in (?, ?) order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            3,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid:   number
            outer: { own: string | null; inner: { est: number | null; parent: number | null } | null } | null
        }>>>()
        expect(rows).toEqual(expected)
        // issue 2: outer present (own non-null), inner all-null → present-`null`.
        expect(rows[0]!.outer!.inner).toBeNull()
        // issue 3: every leaf null → outer present-`null`.
        expect(rows[1]!.outer).toBeNull()
    })
    test('sole-optional-inner-own-table-rule-4-object-makes-wrapper-optional-present-default', async () => {
        // A nested object (`wrapper`) whose sole member is an all-optional inner
        // object (no scalar sibling): the container recursively inherits the
        // optionality of its sole optional member, so the outer `wrapper` is optional
        // (`wrapper?`). Both issues carry a non-null body + assignee, so the inner is
        // present on every row and `wrapper` is present.
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, body as \`wrapper.inner.body\`, assignee_id as \`wrapper.inner.assigneeId\` from issue where id in (?, ?) order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            4,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid:      number
            wrapper?: { inner: { body: string | undefined; assigneeId: number | undefined } | undefined }
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('sole-optional-inner-own-table-rule-4-object-makes-wrapper-optional-present-as-nullable', async () => {
        // Under `projectingOptionalValuesAsNullable()`: the container inherits its sole
        // optional member's nullability, so `wrapper` becomes `{...} | null`; the
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, body as \`wrapper.inner.body\`, assignee_id as \`wrapper.inner.assigneeId\` from issue where id in (?, ?) order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            4,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid:     number
            wrapper: { inner: { body: string | null; assigneeId: number | null } | null } | null
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('sole-optional-inner-left-join-rule-2-object-makes-wrapper-optional-present-default', async () => {
        // The left-join case: `wrapper`'s sole member is an inner object whose leaves
        // all come from the same left join (`id`/`number`, originallyRequired). The
        // container inherits its sole optional member's optionality, so the outer
        // `wrapper` is optional (`wrapper?`) and its leaves stay required-when-present.
        // Both projects join to exactly one issue, so the inner is present on every row.
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, issue.id as \`wrapper.inner.iid\`, issue.\`number\` as \`wrapper.inner.num\` from project left join issue on issue.project_id = project.id where project.id in (?, ?) order by pid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            3,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid:      number
            wrapper?: { inner: { iid: number; num: number } | undefined }
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('sole-optional-inner-left-join-rule-2-object-makes-wrapper-optional-present-as-nullable', async () => {
        // Under `projectingOptionalValuesAsNullable()`: the container inherits its sole
        // optional member's nullability, so `wrapper` becomes `{...} | null`; the
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, issue.id as \`wrapper.inner.iid\`, issue.\`number\` as \`wrapper.inner.num\` from project left join issue on issue.project_id = project.id where project.id in (?, ?) order by pid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            3,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid:     number
            wrapper: { inner: { iid: number; num: number } | null } | null
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('sole-optional-inner-own-table-rule-4-collapse-drops-wrapper-and-type-is-optional-default', async () => {
        // When the sole all-optional inner object collapses (every leaf null), the
        // default asUndefined projector DROPS the whole `wrapper` container at
        // runtime. The container recursively inherits the optionality of its sole
        // optional member, so `wrapper` is typed optional (`wrapper?`) — matching
        // the runtime, which omits the key.
        // issue 3: body null, assignee null → inner collapses → wrapper dropped.
        ctx.mockNext({ iid: 3, 'wrapper.inner.body': null, 'wrapper.inner.assigneeId': null })
        const expected = { iid: 3 }
        const row = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(3))
            .select({
                iid:     tIssue.id,
                wrapper: { inner: { body: tIssue.body, assigneeId: tIssue.assigneeId } },
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, body as \`wrapper.inner.body\`, assignee_id as \`wrapper.inner.assigneeId\` from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
          ]
        `)
        assertType<Exact<typeof row, {
            iid:      number
            wrapper?: { inner: { body: string | undefined; assigneeId: number | undefined } | undefined }
        }>>()
        expect(row).toEqual(expected)
        // The optional `wrapper` key is ABSENT at runtime (the sole inner collapsed).
        expect('wrapper' in row).toBe(false)
    })

    test('sole-optional-inner-own-table-rule-4-collapse-nulls-wrapper-and-type-is-nullable-as-nullable', async () => {
        // Under projectingOptionalValuesAsNullable(), the collapsed sole inner makes
        // the projector emit `wrapper: null` at runtime. The container recursively
        // inherits the optionality of its sole optional member, so `wrapper` is typed
        // `{...} | null` — matching the runtime null.
        // issue 3: body null, assignee null → inner collapses → wrapper null.
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, body as \`wrapper.inner.body\`, assignee_id as \`wrapper.inner.assigneeId\` from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
          ]
        `)
        assertType<Exact<typeof row, {
            iid:     number
            wrapper: { inner: { body: string | null; assigneeId: number | null } | null } | null
        }>>()
        expect(row).toEqual(expected)
    })

    test('sole-optional-inner-left-join-rule-2-collapse-drops-wrapper-and-type-is-optional-default', async () => {
        // The left-join case: when the join misses, the sole inner's leaves are all
        // null, the inner collapses, and the default asUndefined projector DROPS the
        // whole `wrapper` container at runtime. The container recursively inherits the
        // optionality of its sole optional member, so `wrapper` is typed optional
        // (`wrapper?`) — matching the runtime.
        // project 4 has no issue → left join misses → wrapper dropped.
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, issue.id as \`wrapper.inner.iid\`, issue.\`number\` as \`wrapper.inner.num\` from project left join issue on issue.project_id = project.id where project.id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            4,
          ]
        `)
        assertType<Exact<typeof row, {
            pid:      number
            wrapper?: { inner: { iid: number; num: number } | undefined }
        }>>()
        expect(row).toEqual(expected)
        // The optional `wrapper` key is ABSENT at runtime (the sole inner collapsed).
        expect('wrapper' in row).toBe(false)
    })

    test('sole-optional-inner-left-join-rule-2-collapse-nulls-wrapper-and-type-is-nullable-as-nullable', async () => {
        // Under projectingOptionalValuesAsNullable(), a missed left join collapses
        // the sole inner and the projector emits `wrapper: null` at runtime. The
        // container recursively inherits the optionality of its sole optional member,
        // so `wrapper` is typed `{...} | null` — matching the runtime null.
        // project 4 has no issue → left join misses → wrapper null.
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, issue.id as \`wrapper.inner.iid\`, issue.\`number\` as \`wrapper.inner.num\` from project left join issue on issue.project_id = project.id where project.id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            4,
          ]
        `)
        assertType<Exact<typeof row, {
            pid:     number
            wrapper: { inner: { iid: number; num: number } | null } | null
        }>>()
        expect(row).toEqual(expected)
    })
    test('sole-optional-inner-rule-1-required-in-optional-object-makes-wrapper-optional-present-default', async () => {
        // `wrapper`'s sole member is a rule-1 inner
        // object made optional by a `requiredInOptionalObject` leaf (`gate`,
        // body.asRequiredInOptionalObject()). The container recursively inherits its
        // sole optional member's optionality, so `wrapper` is typed optional
        // (`wrapper?`). issue 2: body 'Use new tokens' → gate present → wrapper
        // present; assignee 2.
        const expected = { iid: 2, wrapper: { inner: { gate: 'Use new tokens', extra: 2 } } }
        ctx.mockNext({ iid: 2, 'wrapper.inner.gate': 'Use new tokens', 'wrapper.inner.extra': 2 })
        const row = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(2))
            .select({
                iid:     tIssue.id,
                wrapper: { inner: { gate: tIssue.body.asRequiredInOptionalObject(), extra: tIssue.assigneeId } },
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, body as \`wrapper.inner.gate\`, assignee_id as \`wrapper.inner.extra\` from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof row, {
            iid:      number
            wrapper?: { inner: { gate: string; extra: number | undefined } | undefined }
        }>>()
        expect(row).toEqual(expected)
    })

    test('sole-optional-inner-rule-1-required-in-optional-object-makes-wrapper-optional-present-as-nullable', async () => {
        // The rule-1 sole-inner arm under projectingOptionalValuesAsNullable(): the
        // container inherits its sole optional member's nullability, so `wrapper`
        // becomes `{...} | null`; the reqInOptObj `gate` stays required inside, and the
        // plain-optional `extra` flips to `number | null`. issue 2: body present.
        const expected = { iid: 2, wrapper: { inner: { gate: 'Use new tokens', extra: 2 } } }
        ctx.mockNext({ iid: 2, 'wrapper.inner.gate': 'Use new tokens', 'wrapper.inner.extra': 2 })
        const row = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(2))
            .select({
                iid:     tIssue.id,
                wrapper: { inner: { gate: tIssue.body.asRequiredInOptionalObject(), extra: tIssue.assigneeId } },
            })
            .projectingOptionalValuesAsNullable()
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, body as \`wrapper.inner.gate\`, assignee_id as \`wrapper.inner.extra\` from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof row, {
            iid:     number
            wrapper: { inner: { gate: string; extra: number | null } | null } | null
        }>>()
        expect(row).toEqual(expected)
    })

    test('sole-optional-inner-rule-1-collapse-drops-wrapper-default', async () => {
        // When the sole rule-1 inner collapses (its reqInOptObj `gate` is null), the
        // default asUndefined projector DROPS the whole `wrapper` container at runtime,
        // matching the `wrapper?` typing — even though the plain `extra` leaf is
        // non-null, the reqInOptObj `gate` gates the object. issue 1: body null →
        // gate null → inner collapses → wrapper dropped (assignee 1 is lost with it).
        ctx.mockNext({ iid: 1, 'wrapper.inner.gate': null, 'wrapper.inner.extra': 1 })
        const expected = { iid: 1 }
        const row = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                iid:     tIssue.id,
                wrapper: { inner: { gate: tIssue.body.asRequiredInOptionalObject(), extra: tIssue.assigneeId } },
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, body as \`wrapper.inner.gate\`, assignee_id as \`wrapper.inner.extra\` from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            iid:      number
            wrapper?: { inner: { gate: string; extra: number | undefined } | undefined }
        }>>()
        expect(row).toEqual(expected)
        // The optional `wrapper` key is ABSENT at runtime (the sole rule-1 inner collapsed).
        expect('wrapper' in row).toBe(false)
    })

    test('sole-optional-inner-rule-1-collapse-nulls-wrapper-as-nullable', async () => {
        // Under projectingOptionalValuesAsNullable(), the collapsed sole rule-1 inner
        // makes the projector emit `wrapper: null` at runtime, matching the
        // `{...} | null` typing. issue 1: body null → gate null → wrapper null.
        ctx.mockNext({ iid: 1, 'wrapper.inner.gate': null, 'wrapper.inner.extra': 1 })
        const expected = { iid: 1, wrapper: null }
        const row = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                iid:     tIssue.id,
                wrapper: { inner: { gate: tIssue.body.asRequiredInOptionalObject(), extra: tIssue.assigneeId } },
            })
            .projectingOptionalValuesAsNullable()
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, body as \`wrapper.inner.gate\`, assignee_id as \`wrapper.inner.extra\` from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            iid:     number
            wrapper: { inner: { gate: string; extra: number | null } | null } | null
        }>>()
        expect(row).toEqual(expected)
    })

    test('multi-level-sole-optional-chain-makes-all-containers-optional-present-default', async () => {
        // A three-level sole-optional chain `{ a: { b: { c: { body, assigneeId } } } }`
        // where the innermost `c` is a rule-4 all-optional object. The optionality
        // propagates UP two levels: `c` optional → `b` (sole member) optional → `a`
        // (sole member) optional. The outermost `a` is an optional KEY (`a?`); the
        // inner `b`/`c` are required keys whose value is `| undefined`. issue 2: body
        // present → the whole chain is present.
        const expected = { iid: 2, a: { b: { c: { body: 'Use new tokens', assigneeId: 2 } } } }
        ctx.mockNext({ iid: 2, 'a.b.c.body': 'Use new tokens', 'a.b.c.assigneeId': 2 })
        const row = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(2))
            .select({
                iid: tIssue.id,
                a: { b: { c: { body: tIssue.body, assigneeId: tIssue.assigneeId } } },
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, body as \`a.b.c.body\`, assignee_id as \`a.b.c.assigneeId\` from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof row, {
            iid: number
            a?: { b: { c: { body: string | undefined; assigneeId: number | undefined } | undefined } | undefined }
        }>>()
        expect(row).toEqual(expected)
    })

    test('multi-level-sole-optional-chain-makes-all-containers-optional-present-as-nullable', async () => {
        // The same three-level chain under projectingOptionalValuesAsNullable(): every
        // container inherits its sole member's nullability, so `a`/`b`/`c` are each
        // `{...} | null` and the leaves flip to `| null`. issue 2: body present.
        const expected = { iid: 2, a: { b: { c: { body: 'Use new tokens', assigneeId: 2 } } } }
        ctx.mockNext({ iid: 2, 'a.b.c.body': 'Use new tokens', 'a.b.c.assigneeId': 2 })
        const row = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(2))
            .select({
                iid: tIssue.id,
                a: { b: { c: { body: tIssue.body, assigneeId: tIssue.assigneeId } } },
            })
            .projectingOptionalValuesAsNullable()
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, body as \`a.b.c.body\`, assignee_id as \`a.b.c.assigneeId\` from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof row, {
            iid: number
            a: { b: { c: { body: string | null; assigneeId: number | null } | null } | null } | null
        }>>()
        expect(row).toEqual(expected)
    })

    test('multi-level-sole-optional-chain-collapse-drops-outer-default', async () => {
        // When the innermost `c` collapses (every leaf null), the collapse propagates
        // up TWO levels and the default projector drops the whole outer `a` at runtime.
        // issue 3: body null, assignee null → c collapses → b drops → a dropped.
        ctx.mockNext({ iid: 3, 'a.b.c.body': null, 'a.b.c.assigneeId': null })
        const expected = { iid: 3 }
        const row = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(3))
            .select({
                iid: tIssue.id,
                a: { b: { c: { body: tIssue.body, assigneeId: tIssue.assigneeId } } },
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, body as \`a.b.c.body\`, assignee_id as \`a.b.c.assigneeId\` from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
          ]
        `)
        assertType<Exact<typeof row, {
            iid: number
            a?: { b: { c: { body: string | undefined; assigneeId: number | undefined } | undefined } | undefined }
        }>>()
        expect(row).toEqual(expected)
        // The whole outer `a` key is ABSENT at runtime (the collapse propagated up two levels).
        expect('a' in row).toBe(false)
    })

    test('multi-level-sole-optional-chain-collapse-nulls-outer-as-nullable', async () => {
        // Under projectingOptionalValuesAsNullable(), the innermost collapse surfaces
        // `a: null` at runtime (null propagates up two levels), matching the
        // `{...} | null` typing. issue 3: body null, assignee null → a null.
        ctx.mockNext({ iid: 3, 'a.b.c.body': null, 'a.b.c.assigneeId': null })
        const expected = { iid: 3, a: null }
        const row = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(3))
            .select({
                iid: tIssue.id,
                a: { b: { c: { body: tIssue.body, assigneeId: tIssue.assigneeId } } },
            })
            .projectingOptionalValuesAsNullable()
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, body as \`a.b.c.body\`, assignee_id as \`a.b.c.assigneeId\` from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
          ]
        `)
        assertType<Exact<typeof row, {
            iid: number
            a: { b: { c: { body: string | null; assigneeId: number | null } | null } | null } | null
        }>>()
        expect(row).toEqual(expected)
    })

    test('mixed-container-required-object-inner-plus-optional-inner-keeps-container-required-default', async () => {
        // A container holding TWO inner objects: a REQUIRED-object inner (`req`, two
        // required columns) and a rule-1 OPTIONAL inner (`opt`, made optional by a
        // requiredInOptionalObject leaf). With a required inner present, the container
        // stays REQUIRED (the required inner wins over the optional one); only `opt`
        // is demoted to `opt?`. issue 2: title/number present → req present; body
        // present → opt present.
        const expected = { iid: 2, container: { req: { title: 'Redesign navbar', num: 2 }, opt: { gate: 'Use new tokens', extra: 2 } } }
        ctx.mockNext({ iid: 2, 'container.req.title': 'Redesign navbar', 'container.req.num': 2, 'container.opt.gate': 'Use new tokens', 'container.opt.extra': 2 })
        const row = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(2))
            .select({
                iid: tIssue.id,
                container: {
                    req: { title: tIssue.title, num: tIssue.number },
                    opt: { gate: tIssue.body.asRequiredInOptionalObject(), extra: tIssue.assigneeId },
                },
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, title as \`container.req.title\`, \`number\` as \`container.req.num\`, body as \`container.opt.gate\`, assignee_id as \`container.opt.extra\` from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof row, {
            iid:       number
            container: { req: { title: string; num: number }; opt?: { gate: string; extra: number | undefined } }
        }>>()
        expect(row).toEqual(expected)
    })


    test('mixed-container-required-object-inner-plus-optional-inner-keeps-container-required-as-nullable', async () => {
        // A container holding a required inner object (`req`) and an optional inner
        // object (`opt`, made optional by a requiredInOptionalObject leaf). The required
        // inner keeps the container required; under `projectingOptionalValuesAsNullable()`
        // `opt` becomes `{...} | null` (not `opt?`) and its `extra` leaf becomes
        // `number | null`. When the requiredInOptionalObject leaf (`opt.gate`) is null the
        // whole `opt` surfaces as `null` — a present key with a null value, not absent.
        // issue 3: body null → opt is null, req intact.
        const expectedNull = { iid: 3, container: { req: { title: 'Migrate to ESM', num: 1 }, opt: null } }
        ctx.mockNext({ iid: 3, 'container.req.title': 'Migrate to ESM', 'container.req.num': 1, 'container.opt.gate': null, 'container.opt.extra': null })
        const rowNull = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(3))
            .select({
                iid: tIssue.id,
                container: {
                    req: { title: tIssue.title, num: tIssue.number },
                    opt: { gate: tIssue.body.asRequiredInOptionalObject(), extra: tIssue.assigneeId },
                },
            })
            .projectingOptionalValuesAsNullable()
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, title as \`container.req.title\`, \`number\` as \`container.req.num\`, body as \`container.opt.gate\`, assignee_id as \`container.opt.extra\` from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
          ]
        `)
        assertType<Exact<typeof rowNull, {
            iid:       number
            container: { req: { title: string; num: number }; opt: { gate: string; extra: number | null } | null }
        }>>()
        expect(rowNull).toEqual(expectedNull)
        // The container is PRESENT (its required inner keeps it required) and
        // `opt` is `null` — NOT absent — under the asNull projector.
        expect('container' in rowNull).toBe(true)
        expect(rowNull.container.opt).toBeNull()

        // Companion all-non-null row: `opt` is present (the gate leaf is non-null).
        // issue 2: body 'Use new tokens', assignee 2 → opt present.
        const expectedPresent = { iid: 2, container: { req: { title: 'Redesign navbar', num: 2 }, opt: { gate: 'Use new tokens', extra: 2 } } }
        ctx.mockNext({ iid: 2, 'container.req.title': 'Redesign navbar', 'container.req.num': 2, 'container.opt.gate': 'Use new tokens', 'container.opt.extra': 2 })
        const rowPresent = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(2))
            .select({
                iid: tIssue.id,
                container: {
                    req: { title: tIssue.title, num: tIssue.number },
                    opt: { gate: tIssue.body.asRequiredInOptionalObject(), extra: tIssue.assigneeId },
                },
            })
            .projectingOptionalValuesAsNullable()
            .executeSelectOne()
        expect(rowPresent).toEqual(expectedPresent)
        expect(rowPresent.container.opt).not.toBeNull()
    })

    test('multi-level-sole-optional-chain-depth-4-present-default', async () => {
        // A FOUR-level sole-optional chain `{ w: { x: { y: { z: { body, assigneeId } } } } }`
        // whose innermost `z` is a rule-4 all-optional object, which drives the whole
        // tower optional: the outermost `w` is an optional KEY, the inner `x`/`y`/`z`
        // are required keys with `| undefined` value. issue 2: body present → the whole
        // chain is present.
        const expected = { iid: 2, w: { x: { y: { z: { body: 'Use new tokens', assigneeId: 2 } } } } }
        ctx.mockNext({ iid: 2, 'w.x.y.z.body': 'Use new tokens', 'w.x.y.z.assigneeId': 2 })
        const row = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(2))
            .select({
                iid: tIssue.id,
                w: { x: { y: { z: { body: tIssue.body, assigneeId: tIssue.assigneeId } } } },
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, body as \`w.x.y.z.body\`, assignee_id as \`w.x.y.z.assigneeId\` from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof row, {
            iid: number
            w?: { x: { y: { z: { body: string | undefined; assigneeId: number | undefined } | undefined } | undefined } | undefined }
        }>>()
        expect(row).toEqual(expected)
    })

    test('multi-level-sole-optional-chain-depth-4-collapse-drops-outer-default', async () => {
        // The depth-4 collapse: when the innermost `z` collapses (every leaf null), the
        // collapse propagates up THREE levels and the default projector drops the whole
        // outer `w` at runtime. issue 3: body null, assignee null → z → y → x → w dropped.
        ctx.mockNext({ iid: 3, 'w.x.y.z.body': null, 'w.x.y.z.assigneeId': null })
        const expected = { iid: 3 }
        const row = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(3))
            .select({
                iid: tIssue.id,
                w: { x: { y: { z: { body: tIssue.body, assigneeId: tIssue.assigneeId } } } },
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, body as \`w.x.y.z.body\`, assignee_id as \`w.x.y.z.assigneeId\` from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
          ]
        `)
        assertType<Exact<typeof row, {
            iid: number
            w?: { x: { y: { z: { body: string | undefined; assigneeId: number | undefined } | undefined } | undefined } | undefined }
        }>>()
        expect(row).toEqual(expected)
        // The whole outer `w` key is ABSENT at runtime (the collapse propagated up three levels).
        expect('w' in row).toBe(false)
    })

    test('requiredInOptionalObject-leaf-demoted-through-with-view', async () => {
        // `OptionalTypeForWith` maps `requiredInOptionalObject → optional`, so a CTE
        // that projects an `.asRequiredInOptionalObject()` leaf and is re-selected
        // LOSES the gate: the direct form is rule-1 with a required-when-present
        // `gate` (see `rule-1-mixing-required-in-optional-object-with-own-required-leaf`),
        // but through the CTE the `gate` leaf is demoted to `string | undefined`
        // (rule-4, all-optional) — the object is dropped only when EVERY leaf is
        // null. `status` is a required column (never null), so `gate` is always
        // present at runtime; the demotion is the type promise the assertion pins.
        // issue 1: status 'open', assignee 1 → gate 'open', extra 1.
        // issue 3: status 'open', assignee NULL → gate 'open', extra absent.
        const expected = [
            { iid: 1, meta: { gate: 'open', extra: 1 } },
            { iid: 3, meta: { gate: 'open' } },
        ]
        ctx.mockNext([
            { iid: 1, 'meta.gate': 'open', 'meta.extra': 1 },
            { iid: 3, 'meta.gate': 'open', 'meta.extra': null },
        ])
        const metaCte = ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.in([1, 3]))
            .select({
                iid:  tIssue.id,
                meta: { gate: tIssue.status.asRequiredInOptionalObject(), extra: tIssue.assigneeId },
            })
            .forUseInQueryAs('meta_cte')
        const rows = await ctx.conn.selectFrom(metaCte)
            .select({ iid: metaCte.iid, meta: metaCte.meta })
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with meta_cte as (select id as iid, \`status\` as \`meta.gate\`, assignee_id as \`meta.extra\` from issue where id in (?, ?)) select iid as iid, \`meta.gate\` as \`meta.gate\`, \`meta.extra\` as \`meta.extra\` from meta_cte order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            3,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid:   number
            meta?: { gate: string | undefined; extra: number | undefined }
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('requiredInOptionalObject-leaf-demoted-through-with-view-as-nullable', async () => {
        // The with-view demotion above under `projectingOptionalValuesAsNullable()`:
        // the re-projected `meta` object is all-optional (its `gate` was demoted from
        // requiredInOptionalObject to `string | null` by the CTE re-select, `extra`
        // is plain-optional), so the object becomes `{...} | null`. `status` is a
        // required column, so `gate` is always present and the object never fully
        // collapses; the plain-optional `extra` (assignee_id) flips to `number | null`
        // and surfaces as present-`null` on the row whose assignee is null — not
        // absent, the asNull distinction.
        // issue 1: status 'open', assignee 1 -> { gate: 'open', extra: 1 };
        // issue 3: status 'open', assignee NULL -> { gate: 'open', extra: null }.
        ctx.mockNext([
            { iid: 1, 'meta.gate': 'open', 'meta.extra': 1 },
            { iid: 3, 'meta.gate': 'open', 'meta.extra': null },
        ])
        const expected = [
            { iid: 1, meta: { gate: 'open', extra: 1 } },
            { iid: 3, meta: { gate: 'open', extra: null } },
        ]
        const metaCte = ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.in([1, 3]))
            .select({
                iid:  tIssue.id,
                meta: { gate: tIssue.status.asRequiredInOptionalObject(), extra: tIssue.assigneeId },
            })
            .forUseInQueryAs('meta_cte')
        const rows = await ctx.conn.selectFrom(metaCte)
            .select({ iid: metaCte.iid, meta: metaCte.meta })
            .projectingOptionalValuesAsNullable()
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with meta_cte as (select id as iid, \`status\` as \`meta.gate\`, assignee_id as \`meta.extra\` from issue where id in (?, ?)) select iid as iid, \`meta.gate\` as \`meta.gate\`, \`meta.extra\` as \`meta.extra\` from meta_cte order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            3,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid:  number
            meta: { gate: string | null; extra: number | null } | null
        }>>>()
        expect(rows).toEqual(expected)
        // issue 3's `extra` (assignee_id) is null; under the asNull projector it is
        // PRESENT-`null` inside the (present) `meta` object, not absent.
        expect('extra' in rows[1]!.meta!).toBe(true)
        expect(rows[1]!.meta!.extra).toBeNull()
    })

    test('requiredInOptionalObject-leaf-preserved-through-for-use-in-left-join', async () => {
        // The companion composition to the with-view demotion above: a CTE nested
        // object carrying a `requiredInOptionalObject` `gate` — already demoted to
        // `gate: string | undefined` by `OptionalTypeForWith` when the CTE was built
        // (the test above) — is re-consumed via `forUseInLeftJoin()`. The left join
        // keeps the own-required `ownReq` required (NOT demoted) and wraps the whole
        // object as an OPTIONAL KEY (`meta?:`, absent when the join misses) — distinct
        // from the inline optional value the with-view re-select produced.
        // project 2 → issue 3 (status 'open', number 1) → meta present; project 4
        // (Legacy app) has no issue → the join misses → meta absent.
        const expected = [
            { projId: 2, meta: { gate: 'open', ownReq: 1 } },
            { projId: 4 },
        ]
        ctx.mockNext([
            { projId: 2, 'meta.gate': 'open', 'meta.ownReq': 1 },
            { projId: 4, 'meta.gate': null, 'meta.ownReq': null },
        ])
        const issueMetaCte = ctx.conn.selectFrom(tIssue)
            .select({
                pid:  tIssue.projectId,
                meta: { gate: tIssue.status.asRequiredInOptionalObject(), ownReq: tIssue.number },
            })
            .forUseInQueryAs('issue_meta_cte')
        const issueMetaLeft = issueMetaCte.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(issueMetaLeft).on(issueMetaLeft.pid.equals(tProject.id))
            .where(tProject.id.in([2, 4]))
            .select({ projId: tProject.id, meta: issueMetaLeft.meta })
            .orderBy('projId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with issue_meta_cte as (select project_id as pid, \`status\` as \`meta.gate\`, \`number\` as \`meta.ownReq\` from issue) select project.id as projId, issue_meta_cte.\`meta.gate\` as \`meta.gate\`, issue_meta_cte.\`meta.ownReq\` as \`meta.ownReq\` from project left join issue_meta_cte on issue_meta_cte.pid = project.id where project.id in (?, ?) order by projId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            4,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            projId: number
            meta?:  { gate: string | undefined; ownReq: number }
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('requiredInOptionalObject-leaf-preserved-through-for-use-in-left-join-as-nullable', async () => {
        // The forUseInLeftJoin-over-CTE composition above under
        // `projectingOptionalValuesAsNullable()`: all of `meta`'s leaves come from the
        // same left-joined CTE, so the whole object becomes `{...} | null` and
        // surfaces as `meta: null` when the join misses. The own-required `ownReq`
        // stays required inside a present object, while the demoted `gate` leaf is
        // `string | null`. This is the genuine object-collapse-to-null boundary
        // (a missed left join), not just a leaf flip.
        // project 2 -> issue 3 (join hits) -> meta present;
        // project 4 (Legacy app) has no issue -> the join misses -> meta null.
        ctx.mockNext([
            { projId: 2, 'meta.gate': 'open', 'meta.ownReq': 1 },
            { projId: 4, 'meta.gate': null, 'meta.ownReq': null },
        ])
        const expected = [
            { projId: 2, meta: { gate: 'open', ownReq: 1 } },
            { projId: 4, meta: null },
        ]
        const issueMetaCte = ctx.conn.selectFrom(tIssue)
            .select({
                pid:  tIssue.projectId,
                meta: { gate: tIssue.status.asRequiredInOptionalObject(), ownReq: tIssue.number },
            })
            .forUseInQueryAs('issue_meta_cte')
        const issueMetaLeft = issueMetaCte.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(issueMetaLeft).on(issueMetaLeft.pid.equals(tProject.id))
            .where(tProject.id.in([2, 4]))
            .select({ projId: tProject.id, meta: issueMetaLeft.meta })
            .projectingOptionalValuesAsNullable()
            .orderBy('projId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with issue_meta_cte as (select project_id as pid, \`status\` as \`meta.gate\`, \`number\` as \`meta.ownReq\` from issue) select project.id as projId, issue_meta_cte.\`meta.gate\` as \`meta.gate\`, issue_meta_cte.\`meta.ownReq\` as \`meta.ownReq\` from project left join issue_meta_cte on issue_meta_cte.pid = project.id where project.id in (?, ?) order by projId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            4,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            projId: number
            meta:   { gate: string | null; ownReq: number } | null
        }>>>()
        expect(rows).toEqual(expected)
        // project 4 has no issue, so the join misses and the whole `meta` object is
        // PRESENT-`null` under the asNull projector (not absent).
        expect('meta' in rows[1]!).toBe(true)
        expect(rows[1]!.meta).toBeNull()
    })

    test('merge-optional-requiredInOptionalObject-demoted-to-optional-through-operator', async () => {
        // The inverse of `merge-optional-requiredInOptionalObject-is-preserved-through-an-operator`:
        // there the operand was a REQUIRED column (`.equals(tIssue.id)`), so
        // `MergeOptional<requiredInOptionalObject, required> → requiredInOptionalObject`
        // and `flag` stayed required. Here the operand is an OPTIONAL column
        // (`.equals(tIssue.assigneeId)`), so `MergeOptional<requiredInOptionalObject,
        // optional> → optional` and `flag` is DEMOTED to an optional key
        // (`flag?: boolean`), absent when null — while the own-required `ownReq`
        // keeps the object required (rule-3). issue 1: priority 2, assignee 1 →
        // 2=1 → flag false; issue 3: priority 3, assignee NULL → flag absent.
        const expected = [
            { iid: 1, meta: { flag: false, ownReq: 1 } },
            { iid: 3, meta: { ownReq: 1 } },
        ]
        ctx.mockNext([
            { iid: 1, 'meta.flag': false, 'meta.ownReq': 1 },
            { iid: 3, 'meta.flag': null, 'meta.ownReq': 1 },
        ])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.in([1, 3]))
            .select({
                iid: tIssue.id,
                meta: {
                    flag:   tIssue.priority.asRequiredInOptionalObject().equals(tIssue.assigneeId),
                    ownReq: tIssue.number,
                },
            })
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, priority = assignee_id as \`meta.flag\`, \`number\` as \`meta.ownReq\` from issue where id in (?, ?) order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            3,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid:  number
            meta: { flag?: boolean; ownReq: number }
        }>>>()
        expect(rows).toEqual(expected)
        // issue 3's flag is null, so the demoted-to-optional `flag` key is ABSENT
        // at runtime — assert its absence, distinguishing `flag?: boolean` from a
        // present-`undefined`.
        expect('flag' in rows[1]!.meta).toBe(false)
    })

    test('merge-optional-requiredInOptionalObject-demoted-to-optional-through-operator-as-nullable', async () => {
        // The same demote arm under `projectingOptionalValuesAsNullable()`: the
        // demoted `flag` flips to `boolean | null` (present as null, not absent),
        // while the own-required `ownReq` keeps the object required. issue 3:
        // priority 3, assignee NULL → flag null.
        const expected = { iid: 3, meta: { flag: null, ownReq: 1 } }
        ctx.mockNext({ iid: 3, 'meta.flag': null, 'meta.ownReq': 1 })
        const row = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(3))
            .select({
                iid: tIssue.id,
                meta: {
                    flag:   tIssue.priority.asRequiredInOptionalObject().equals(tIssue.assigneeId),
                    ownReq: tIssue.number,
                },
            })
            .projectingOptionalValuesAsNullable()
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, priority = assignee_id as \`meta.flag\`, \`number\` as \`meta.ownReq\` from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
          ]
        `)
        assertType<Exact<typeof row, {
            iid:  number
            meta: { flag: boolean | null; ownReq: number }
        }>>()
        expect(row).toEqual(expected)
    })

    test('rule-1-wrapper-of-sole-rule-1-inner-with-own-required-leaf-default', async () => {
        // A two-level container whose only member is a nested `inner` object made
        // optional by its requiredInOptionalObject `gate` leaf but also carrying a
        // genuinely-required `ownReq` leaf. The optional `inner` keeps `wrapper`
        // optional (an optional inner never forces its container required), so both
        // surface present-key / `| undefined`-valued with `ownReq`
        // required-when-present. When `gate` (body) is null the inner collapses and
        // the whole `wrapper` is dropped.
        // issue 1 (project 1): body null → wrapper dropped; issue 2: body present.
        const expected = [
            { iid: 1 },
            { iid: 2, wrapper: { inner: { gate: 'Use new tokens', ownReq: 2 } } },
        ]
        ctx.mockNext([
            { iid: 1, 'wrapper.inner.gate': null,             'wrapper.inner.ownReq': 1 },
            { iid: 2, 'wrapper.inner.gate': 'Use new tokens', 'wrapper.inner.ownReq': 2 },
        ])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .select({
                iid: tIssue.id,
                wrapper: {
                    inner: {
                        gate:   tIssue.body.asRequiredInOptionalObject(),
                        ownReq: tIssue.number,
                    },
                },
            })
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, body as \`wrapper.inner.gate\`, \`number\` as \`wrapper.inner.ownReq\` from issue where project_id = ? order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid:      number
            wrapper?: { inner: { gate: string; ownReq: number } | undefined }
        }>>>()
        expect(rows).toEqual(expected)
        // issue 1's gate (body) is null, so the inner collapses and the whole
        // optional `wrapper` is dropped — assert its key is ABSENT, not
        // present-as-undefined (which `toEqual` would also accept).
        expect('wrapper' in rows[0]!).toBe(false)
    })

    test('rule-1-wrapper-of-sole-rule-1-inner-with-own-required-leaf-as-nullable', async () => {
        // The wrapper-of-optional-inner shape under
        // `projectingOptionalValuesAsNullable()`: `wrapper` and the nested `inner`
        // each become `{...} | null` and surface as `null` when `gate` (body) is
        // null, while the required `ownReq` stays required inside a present inner.
        // issue 1: body null → wrapper null; issue 2: body present.
        const expected = [
            { iid: 1, wrapper: null },
            { iid: 2, wrapper: { inner: { gate: 'Use new tokens', ownReq: 2 } } },
        ]
        ctx.mockNext([
            { iid: 1, 'wrapper.inner.gate': null,             'wrapper.inner.ownReq': 1 },
            { iid: 2, 'wrapper.inner.gate': 'Use new tokens', 'wrapper.inner.ownReq': 2 },
        ])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .select({
                iid: tIssue.id,
                wrapper: {
                    inner: {
                        gate:   tIssue.body.asRequiredInOptionalObject(),
                        ownReq: tIssue.number,
                    },
                },
            })
            .projectingOptionalValuesAsNullable()
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, body as \`wrapper.inner.gate\`, \`number\` as \`wrapper.inner.ownReq\` from issue where project_id = ? order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid:     number
            wrapper: { inner: { gate: string; ownReq: number } | null } | null
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('rule-2-wrapper-of-sole-rule-2-inner-with-const-required-leaf-default', async () => {
        // A two-level container whose only member is a nested `inner` object whose
        // table leaf (`iid`) comes from a left join — so `inner` is a rule-2
        // optional object (all its table leaves share the same left join) — but
        // which also carries a genuinely-required NoTableOrView `constReq` leaf (a
        // `const(...)`). Rule 2 treats the originallyRequired left-join leaf as the
        // presence signal and IGNORES the no-table const, so when the join misses
        // the whole `inner` is dropped — even though `constReq` still has a value —
        // and `wrapper` (whose sole member is `inner`) is dropped with it.
        // project 3 → issue 4 (join hits); project 4 → no issue (join misses).
        const expected = [
            { pid: 3, wrapper: { inner: { iid: 4, constReq: 1 } } },
            { pid: 4 },
        ]
        ctx.mockNext([
            { pid: 3, 'wrapper.inner.iid': 4,    'wrapper.inner.constReq': 1 },
            { pid: 4, 'wrapper.inner.iid': null, 'wrapper.inner.constReq': 1 },
        ])
        const tIssueLeft = tIssue.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.id.in([3, 4]))
            .select({
                pid: tProject.id,
                wrapper: {
                    inner: {
                        iid:      tIssueLeft.id,
                        constReq: ctx.conn.const(1, 'int'),
                    },
                },
            })
            .orderBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, issue.id as \`wrapper.inner.iid\`, ? as \`wrapper.inner.constReq\` from project left join issue on issue.project_id = project.id where project.id in (?, ?) order by pid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            3,
            4,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid:      number
            wrapper?: { inner: { iid: number; constReq: number } | undefined }
        }>>>()
        expect(rows).toEqual(expected)
        // On the join-miss row the whole rule-2 `inner` is dropped (the const
        // does not keep it), so `wrapper` is absent — assert the key is ABSENT.
        expect('wrapper' in rows[1]!).toBe(false)
    })


    test('nested-object-cte-used-via-for-use-in-left-join-as-nullable', async () => {
        // A CTE projecting a nested object, filtered to project 1, is read back via a
        // left join; the main query reads issues in projects 1 and 2, so issue 3
        // (project 2) misses the CTE left join. Under `projectingOptionalValuesAsNullable()`
        // the read-back nested object becomes `{...} | null`, so the miss surfaces
        // `proj: null` (a present key) rather than an absent key. issue 1 -> project 1
        // (hit); issue 3 -> miss.
        const expected = [
            { iid: 1, proj: { name: 'Marketing site', slug: 'mktg-site' } },
            { iid: 3, proj: null },
        ]
        ctx.mockNext([
            { iid: 1, 'proj.name': 'Marketing site', 'proj.slug': 'mktg-site' },
            { iid: 3, 'proj.name': null, 'proj.slug': null },
        ])
        const projCte = ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ pid: tProject.id, info: { name: tProject.name, slug: tProject.slug } })
            .forUseInQueryAs('proj_cte')
        const projCteLeft = projCte.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tIssue)
            .leftJoin(projCteLeft).on(projCteLeft.pid.equals(tIssue.projectId))
            .where(tIssue.id.in([1, 3]))
            .select({ iid: tIssue.id, proj: projCteLeft.info })
            .projectingOptionalValuesAsNullable()
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with proj_cte as (select id as pid, \`name\` as \`info.name\`, slug as \`info.slug\` from project where id = ?) select issue.id as iid, proj_cte.\`info.name\` as \`proj.name\`, proj_cte.\`info.slug\` as \`proj.slug\` from issue left join proj_cte on proj_cte.pid = issue.project_id where issue.id in (?, ?) order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            1,
            3,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid:  number
            proj: { name: string; slug: string } | null
        }>>>()
        expect(rows).toEqual(expected)
        expect(rows[1]!.proj).toBeNull()
    })

    test('multi-level-sole-optional-chain-depth-4-present-as-nullable', async () => {
        // A four-level sole-optional chain under `projectingOptionalValuesAsNullable()`:
        // the outer `w` becomes a required key with a `| null` value and every inner
        // level's `| undefined` flips to `| null`. issue 2: body present -> the whole
        // chain is present, no nulls.
        const expected = { iid: 2, w: { x: { y: { z: { body: 'Use new tokens', assigneeId: 2 } } } } }
        ctx.mockNext({ iid: 2, 'w.x.y.z.body': 'Use new tokens', 'w.x.y.z.assigneeId': 2 })
        const row = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(2))
            .select({
                iid: tIssue.id,
                w: { x: { y: { z: { body: tIssue.body, assigneeId: tIssue.assigneeId } } } },
            })
            .projectingOptionalValuesAsNullable()
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, body as \`w.x.y.z.body\`, assignee_id as \`w.x.y.z.assigneeId\` from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof row, {
            iid: number
            w: { x: { y: { z: { body: string | null; assigneeId: number | null } | null } | null } | null } | null
        }>>()
        expect(row).toEqual(expected)
    })

    test('multi-level-sole-optional-chain-depth-4-collapse-as-nullable', async () => {
        // A four-level sole-optional chain where the innermost `z` collapses (every leaf
        // null): under `projectingOptionalValuesAsNullable()` the collapse propagates up
        // three levels and the outer `w` surfaces as `null` — a PRESENT key with a null
        // value, not absent. issue 3: body null, assignee null.
        const expected = { iid: 3, w: null }
        ctx.mockNext({ iid: 3, 'w.x.y.z.body': null, 'w.x.y.z.assigneeId': null })
        const row = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(3))
            .select({
                iid: tIssue.id,
                w: { x: { y: { z: { body: tIssue.body, assigneeId: tIssue.assigneeId } } } },
            })
            .projectingOptionalValuesAsNullable()
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, body as \`w.x.y.z.body\`, assignee_id as \`w.x.y.z.assigneeId\` from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
          ]
        `)
        assertType<Exact<typeof row, {
            iid: number
            w: { x: { y: { z: { body: string | null; assigneeId: number | null } | null } | null } | null } | null
        }>>()
        expect(row).toEqual(expected)
        // The outer `w` key is PRESENT with a null value under the asNull projector.
        expect('w' in row).toBe(true)
        expect(row.w).toBeNull()
    })

    test('rule-2-wrapper-of-sole-rule-2-inner-with-const-required-leaf-as-nullable', async () => {
        // A rule-2 wrapper whose sole inner is a rule-2 object mixing a left-join leaf
        // (`iid`) with an always-present const (`constReq`). Under
        // `projectingOptionalValuesAsNullable()` the optional `wrapper`/`inner` objects
        // become `{...} | null`. When the join misses the whole rule-2 `inner` is
        // dropped (the const does not keep it), so `wrapper` surfaces as `null`.
        // project 3 -> issue 4 (join hits); project 4 -> no issue (join misses).
        const expected = [
            { pid: 3, wrapper: { inner: { iid: 4, constReq: 1 } } },
            { pid: 4, wrapper: null },
        ]
        ctx.mockNext([
            { pid: 3, 'wrapper.inner.iid': 4,    'wrapper.inner.constReq': 1 },
            { pid: 4, 'wrapper.inner.iid': null, 'wrapper.inner.constReq': 1 },
        ])
        const tIssueLeft = tIssue.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.id.in([3, 4]))
            .select({
                pid: tProject.id,
                wrapper: {
                    inner: {
                        iid:      tIssueLeft.id,
                        constReq: ctx.conn.const(1, 'int'),
                    },
                },
            })
            .projectingOptionalValuesAsNullable()
            .orderBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, issue.id as \`wrapper.inner.iid\`, ? as \`wrapper.inner.constReq\` from project left join issue on issue.project_id = project.id where project.id in (?, ?) order by pid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            3,
            4,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid:     number
            wrapper: { inner: { iid: number; constReq: number } | null } | null
        }>>>()
        expect(rows).toEqual(expected)
        // On the join-miss row the whole rule-2 `inner` is dropped, so `wrapper`
        // surfaces as `null`.
        expect(rows[1]!.wrapper).toBeNull()
    })

    test('cte-re-projected-rule-2-object-as-nullable-surfaces-null-on-miss', async () => {
        // A CTE builds a rule-2 nested object from a LEFT-JOINED issue (both leaves
        // share the same left join); project 4 has no issue so the CTE join misses for
        // it. Re-selecting the CTE object under `projectingOptionalValuesAsNullable()`
        // surfaces the missed object as `null` (a present key) and its leaves as
        // `| null`. project 3 -> issue 4 (hit); project 4 -> miss.
        const expected = [
            { pid: 3, iss: { id: 4, title: 'Document /v2/users' } },
            { pid: 4, iss: null },
        ]
        ctx.mockNext([
            { pid: 3, 'iss.id': 4, 'iss.title': 'Document /v2/users' },
            { pid: 4, 'iss.id': null, 'iss.title': null },
        ])
        const connection = ctx.conn
        const tIssueLeft = tIssue.forUseInLeftJoin()
        const projectIssueCte = connection.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.id.in([3, 4]))
            .select({ pid: tProject.id, iss: { id: tIssueLeft.id, title: tIssueLeft.title } })
            .forUseInQueryAs('project_issue_cte')
        const rows = await connection.selectFrom(projectIssueCte)
            .select({ pid: projectIssueCte.pid, iss: projectIssueCte.iss })
            .projectingOptionalValuesAsNullable()
            .orderBy('pid')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with project_issue_cte as (select project.id as pid, issue.id as \`iss.id\`, issue.title as \`iss.title\` from project left join issue on issue.project_id = project.id where project.id in (?, ?)) select pid as pid, \`iss.id\` as \`iss.id\`, \`iss.title\` as \`iss.title\` from project_issue_cte order by pid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
            4,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid: number
            iss: { id: number | null; title: string | null } | null
        }>>>()
        expect(rows).toEqual(expected)
        // The join-miss row surfaces the whole re-projected object as null (present key).
        expect(rows[1]!.iss).toBeNull()
    })

    test('cte-re-projected-rule-3-object-with-optional-leaf-as-nullable', async () => {
        // A CTE projects a rule-3 nested `detail` object (a REQUIRED own-table leaf
        // `title` keeps the object required, plus an OPTIONAL `body` leaf). Re-selected
        // under `projectingOptionalValuesAsNullable()` the object stays required (never
        // `| null`) and the optional `body` leaf flips to `| null`. issue 1: body null ->
        // present-null; issue 2: body 'Use new tokens'.
        const expected = [
            { iid: 1, detail: { title: 'Update hero copy', body: null } },
            { iid: 2, detail: { title: 'Redesign navbar', body: 'Use new tokens' } },
        ]
        ctx.mockNext([
            { iid: 1, 'detail.title': 'Update hero copy', 'detail.body': null },
            { iid: 2, 'detail.title': 'Redesign navbar', 'detail.body': 'Use new tokens' },
        ])
        const connection = ctx.conn
        const issueCte = connection.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .select({ iid: tIssue.id, detail: { title: tIssue.title, body: tIssue.body } })
            .forUseInQueryAs('issue_detail_cte')
        const rows = await connection.selectFrom(issueCte)
            .select({ iid: issueCte.iid, detail: issueCte.detail })
            .projectingOptionalValuesAsNullable()
            .orderBy('iid')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"with issue_detail_cte as (select id as iid, title as \`detail.title\`, body as \`detail.body\` from issue where project_id = ?) select iid as iid, \`detail.title\` as \`detail.title\`, \`detail.body\` as \`detail.body\` from issue_detail_cte order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid: number
            detail: { title: string; body: string | null }
        }>>>()
        expect(rows).toEqual(expected)
        // The rule-3 object is present on the null-body row; only `body` is null.
        expect(rows[0]!.detail.body).toBeNull()
    })
    // ── aggregateAsArray carried through a forUseInQueryAs(...) CTE. These pin the
    // shared column-copy (createColumnsFrom / createColumnsFromInnerObject) preserving
    // an aggregate element's own projectingOptionalValuesAsNullable() flag across the
    // CTE re-projection: a null optional leaf stays PRESENT-null with the flag and is
    // DROPPED without it. org 1 owns projects 1,2 (archived_at NULL); org 2 owns
    // projects 3 (NULL), 4 (archived). The aggregate has no inner ORDER BY, so array
    // order is not deterministic on the real engine — value assertions sort by id.

    test('cte-with-top-level-aggregate-as-array-nullable-leaf-carries-projecting-flag', async () => {
        // TOP-LEVEL aggregate with projectingOptionalValuesAsNullable() carried through
        // the CTE (WithViewImpl -> createColumnsFrom): the null `archivedAt` leaf stays
        // PRESENT-null (`archivedAt: Date | null`) after the re-projection.
        const connection = ctx.conn
        const tProjectLeft = tProject.forUseInLeftJoin()
        const archivedDate = new Date('2024-02-01T00:00:00.000Z')
        const orgProjectsCte = connection.selectFrom(tOrganization)
            .leftJoin(tProjectLeft).on(tProjectLeft.organizationId.equals(tOrganization.id))
            .select({
                orgId:    tOrganization.id,
                projects: connection.aggregateAsArray({ id: tProjectLeft.id, name: tProjectLeft.name, archivedAt: tProjectLeft.archivedAt })
                    .projectingOptionalValuesAsNullable(),
            })
            .groupBy('orgId')
            .forUseInQueryAs('org_projects_cte')
        const expected = [
            { orgId: 1, projects: [
                { id: 1, name: 'Marketing site', archivedAt: null },
                { id: 2, name: 'Internal tools', archivedAt: null },
            ] },
            { orgId: 2, projects: [
                { id: 3, name: 'Public API', archivedAt: null },
                { id: 4, name: 'Legacy app', archivedAt: archivedDate },
            ] },
        ]
        ctx.mockNext(expected)
        const rows = await connection.selectFrom(orgProjectsCte)
            .select({ orgId: orgProjectsCte.orgId, projects: orgProjectsCte.projects })
            .orderBy('orgId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with org_projects_cte as (select \`organization\`.id as orgId, json_arrayagg(json_object('id', project.id, 'name', project.\`name\`, 'archivedAt', project.archived_at)) as projects from \`organization\` left join project on project.organization_id = \`organization\`.id group by \`organization\`.id) select orgId as orgId, projects as projects from org_projects_cte order by orgId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{
            orgId:    number
            projects: Array<{ id: number; name: string; archivedAt: Date | null }>
        }>>>()
        const sorted = rows.map(r => ({ ...r, projects: [...r.projects].sort((a, b) => a.id - b.id) }))
        if (!ctx.realDbEnabled) {
            expect(sorted).toEqual(expected)
        } else {
            expect(sorted[0]!.projects).toEqual([
                { id: 1, name: 'Marketing site', archivedAt: null },
                { id: 2, name: 'Internal tools', archivedAt: null },
            ])
            expect(sorted[1]!.projects.find(p => p.id === 3)).toEqual({ id: 3, name: 'Public API', archivedAt: null })
            expect(sorted[1]!.projects.find(p => p.id === 4)!.archivedAt instanceof Date).toBe(true)
        }
        // The null `archivedAt` leaf stays PRESENT-null through the CTE re-projection.
        expect('archivedAt' in sorted[0]!.projects[0]!).toBe(true)
        expect(sorted[0]!.projects[0]!.archivedAt).toBeNull()
    })

    test('cte-with-nested-object-aggregate-as-array-nullable-leaf-carries-projecting-flag', async () => {
        // The SAME nullable aggregate NESTED inside a projection object member (`wrap`)
        // carried through the CTE (createColumnsFromInnerObject): the fix's second line.
        // The null `archivedAt` leaf still stays PRESENT-null one nesting level deeper.
        const connection = ctx.conn
        const tProjectLeft = tProject.forUseInLeftJoin()
        const archivedDate = new Date('2024-02-01T00:00:00.000Z')
        const orgProjectsCte = connection.selectFrom(tOrganization)
            .leftJoin(tProjectLeft).on(tProjectLeft.organizationId.equals(tOrganization.id))
            .select({
                orgId: tOrganization.id,
                wrap:  { projects: connection.aggregateAsArray({ id: tProjectLeft.id, name: tProjectLeft.name, archivedAt: tProjectLeft.archivedAt })
                    .projectingOptionalValuesAsNullable() },
            })
            .groupBy('orgId')
            .forUseInQueryAs('org_projects_cte')
        ctx.mockNext([
            { orgId: 1, 'wrap.projects': [
                { id: 1, name: 'Marketing site', archivedAt: null },
                { id: 2, name: 'Internal tools', archivedAt: null },
            ] },
            { orgId: 2, 'wrap.projects': [
                { id: 3, name: 'Public API', archivedAt: null },
                { id: 4, name: 'Legacy app', archivedAt: archivedDate },
            ] },
        ])
        const expected = [
            { orgId: 1, wrap: { projects: [
                { id: 1, name: 'Marketing site', archivedAt: null },
                { id: 2, name: 'Internal tools', archivedAt: null },
            ] } },
            { orgId: 2, wrap: { projects: [
                { id: 3, name: 'Public API', archivedAt: null },
                { id: 4, name: 'Legacy app', archivedAt: archivedDate },
            ] } },
        ]
        const rows = await connection.selectFrom(orgProjectsCte)
            .select({ orgId: orgProjectsCte.orgId, wrap: orgProjectsCte.wrap })
            .orderBy('orgId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with org_projects_cte as (select \`organization\`.id as orgId, json_arrayagg(json_object('id', project.id, 'name', project.\`name\`, 'archivedAt', project.archived_at)) as \`wrap.projects\` from \`organization\` left join project on project.organization_id = \`organization\`.id group by \`organization\`.id) select orgId as orgId, \`wrap.projects\` as \`wrap.projects\` from org_projects_cte order by orgId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{
            orgId: number
            wrap:  { projects: Array<{ id: number; name: string; archivedAt: Date | null }> }
        }>>>()
        const sorted = rows.map(r => ({ ...r, wrap: { projects: [...r.wrap.projects].sort((a, b) => a.id - b.id) } }))
        if (!ctx.realDbEnabled) {
            expect(sorted).toEqual(expected)
        } else {
            expect(sorted[0]!.wrap.projects).toEqual([
                { id: 1, name: 'Marketing site', archivedAt: null },
                { id: 2, name: 'Internal tools', archivedAt: null },
            ])
            expect(sorted[1]!.wrap.projects.find(p => p.id === 4)!.archivedAt instanceof Date).toBe(true)
        }
        expect('archivedAt' in sorted[0]!.wrap.projects[0]!).toBe(true)
        expect(sorted[0]!.wrap.projects[0]!.archivedAt).toBeNull()
    })

    test('cte-with-top-level-aggregate-as-array-default-projector-drops-null-leaf', async () => {
        // The B-T1a DEFAULT-projector companion (no projectingOptionalValuesAsNullable()):
        // pins the base composition (an aggregate array round-trips through a CTE column
        // at all) independent of the nullable flag. The null `archivedAt` leaf is DROPPED
        // (`archivedAt?: Date`, key absent).
        const connection = ctx.conn
        const tProjectLeft = tProject.forUseInLeftJoin()
        const archivedDate = new Date('2024-02-01T00:00:00.000Z')
        const orgProjectsCte = connection.selectFrom(tOrganization)
            .leftJoin(tProjectLeft).on(tProjectLeft.organizationId.equals(tOrganization.id))
            .select({
                orgId:    tOrganization.id,
                projects: connection.aggregateAsArray({ id: tProjectLeft.id, name: tProjectLeft.name, archivedAt: tProjectLeft.archivedAt }),
            })
            .groupBy('orgId')
            .forUseInQueryAs('org_projects_cte')
        ctx.mockNext([
            { orgId: 1, projects: [
                { id: 1, name: 'Marketing site', archivedAt: null },
                { id: 2, name: 'Internal tools', archivedAt: null },
            ] },
            { orgId: 2, projects: [
                { id: 3, name: 'Public API', archivedAt: null },
                { id: 4, name: 'Legacy app', archivedAt: archivedDate },
            ] },
        ])
        const rows = await connection.selectFrom(orgProjectsCte)
            .select({ orgId: orgProjectsCte.orgId, projects: orgProjectsCte.projects })
            .orderBy('orgId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with org_projects_cte as (select \`organization\`.id as orgId, json_arrayagg(json_object('id', project.id, 'name', project.\`name\`, 'archivedAt', project.archived_at)) as projects from \`organization\` left join project on project.organization_id = \`organization\`.id group by \`organization\`.id) select orgId as orgId, projects as projects from org_projects_cte order by orgId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{
            orgId:    number
            projects: Array<{ id: number; name: string; archivedAt?: Date }>
        }>>>()
        const sorted = rows.map(r => ({ ...r, projects: [...r.projects].sort((a, b) => a.id - b.id) }))
        if (!ctx.realDbEnabled) {
            expect(sorted).toEqual([
                { orgId: 1, projects: [
                    { id: 1, name: 'Marketing site' },
                    { id: 2, name: 'Internal tools' },
                ] },
                { orgId: 2, projects: [
                    { id: 3, name: 'Public API' },
                    { id: 4, name: 'Legacy app', archivedAt: archivedDate },
                ] },
            ])
        } else {
            expect(sorted[0]!.projects).toEqual([
                { id: 1, name: 'Marketing site' },
                { id: 2, name: 'Internal tools' },
            ])
            expect(sorted[1]!.projects.find(p => p.id === 4)!.archivedAt instanceof Date).toBe(true)
        }
        // The null `archivedAt` leaf is DROPPED under the default projector.
        expect('archivedAt' in sorted[0]!.projects[0]!).toBe(false)
    })

    test('cte-with-nested-object-aggregate-as-array-default-projector-drops-null-leaf', async () => {
        // The B-T1b DEFAULT-projector companion: the nested-in-object aggregate carried
        // through the CTE (createColumnsFromInnerObject) under the default projector —
        // the null `archivedAt` leaf is DROPPED one nesting level deeper.
        const connection = ctx.conn
        const tProjectLeft = tProject.forUseInLeftJoin()
        const archivedDate = new Date('2024-02-01T00:00:00.000Z')
        const orgProjectsCte = connection.selectFrom(tOrganization)
            .leftJoin(tProjectLeft).on(tProjectLeft.organizationId.equals(tOrganization.id))
            .select({
                orgId: tOrganization.id,
                wrap:  { projects: connection.aggregateAsArray({ id: tProjectLeft.id, name: tProjectLeft.name, archivedAt: tProjectLeft.archivedAt }) },
            })
            .groupBy('orgId')
            .forUseInQueryAs('org_projects_cte')
        ctx.mockNext([
            { orgId: 1, 'wrap.projects': [
                { id: 1, name: 'Marketing site', archivedAt: null },
                { id: 2, name: 'Internal tools', archivedAt: null },
            ] },
            { orgId: 2, 'wrap.projects': [
                { id: 3, name: 'Public API', archivedAt: null },
                { id: 4, name: 'Legacy app', archivedAt: archivedDate },
            ] },
        ])
        const rows = await connection.selectFrom(orgProjectsCte)
            .select({ orgId: orgProjectsCte.orgId, wrap: orgProjectsCte.wrap })
            .orderBy('orgId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with org_projects_cte as (select \`organization\`.id as orgId, json_arrayagg(json_object('id', project.id, 'name', project.\`name\`, 'archivedAt', project.archived_at)) as \`wrap.projects\` from \`organization\` left join project on project.organization_id = \`organization\`.id group by \`organization\`.id) select orgId as orgId, \`wrap.projects\` as \`wrap.projects\` from org_projects_cte order by orgId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{
            orgId: number
            wrap:  { projects: Array<{ id: number; name: string; archivedAt?: Date }> }
        }>>>()
        const sorted = rows.map(r => ({ ...r, wrap: { projects: [...r.wrap.projects].sort((a, b) => a.id - b.id) } }))
        if (!ctx.realDbEnabled) {
            expect(sorted).toEqual([
                { orgId: 1, wrap: { projects: [
                    { id: 1, name: 'Marketing site' },
                    { id: 2, name: 'Internal tools' },
                ] } },
                { orgId: 2, wrap: { projects: [
                    { id: 3, name: 'Public API' },
                    { id: 4, name: 'Legacy app', archivedAt: archivedDate },
                ] } },
            ])
        } else {
            expect(sorted[0]!.wrap.projects).toEqual([
                { id: 1, name: 'Marketing site' },
                { id: 2, name: 'Internal tools' },
            ])
            expect(sorted[1]!.wrap.projects.find(p => p.id === 4)!.archivedAt instanceof Date).toBe(true)
        }
        expect('archivedAt' in sorted[0]!.wrap.projects[0]!).toBe(false)
    })
})
