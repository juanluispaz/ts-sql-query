// `aggregateAsArray({ title, body })` over tIssue (no join) builds an array whose
// element objects have a required `title` leaf and an optional `body` leaf. By
// default a null optional leaf is dropped from the element (`body?: string`);
// `projectingOptionalValuesAsNullable()` keeps it as `body: string | null`
// (present-null).
//
// Project 1 has issue 1 (body NULL) and issue 2 (body 'Use new tokens'). JSON
// aggregate order is not guaranteed, so the array is sorted by title before
// comparing. Mocks are primed with the RAW aggregated rows.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tAppUser, tIssue, tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('element-top-rule-3-own-table-optional-leaf-default-drops-null', async () => {
        // Default projector: a null optional `body` leaf is dropped from the element.
        // Issue 1's body is NULL → absent; issue 2's 'Use new tokens' survives.
        ctx.mockNext([{ pid: 1, issues: [
            { title: 'Update hero copy', body: null },
            { title: 'Redesign navbar',  body: 'Use new tokens' },
        ] }])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .select({
                pid:    tIssue.projectId,
                issues: ctx.conn.aggregateAsArray({ title: tIssue.title, body: tIssue.body }),
            })
            .groupBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as pid, json_arrayagg(json_object('title', title, 'body', \`body\`)) as issues from issue where project_id = ? group by project_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid:    number
            issues: Array<{ title: string; body?: string }>
        }>>>()
        const sorted = rows.map(r => ({ ...r, issues: [...r.issues].sort((a, b) => a.title.localeCompare(b.title)) }))
        expect(sorted).toEqual([{ pid: 1, issues: [
            { title: 'Redesign navbar', body: 'Use new tokens' },
            { title: 'Update hero copy' },
        ] }])
        // Issue 1's null body is ABSENT under the default projector.
        const issue1 = rows[0]!.issues.find(i => i.title === 'Update hero copy')!
        expect('body' in issue1).toBe(false)
    })

    test('element-containing-a-nested-rule-1-required-in-optional-object-default', async () => {
        // An aggregate element that CONTAINS a nested rule-1 object: `meta` is
        // made optional by its `requiredInOptionalObject` leaf (`gate`,
        // status.asRequiredInOptionalObject()); the reqInOptObj `gate` stays
        // required inside it, the plain-optional `assigneeId` is `?`. Project 1:
        // issue 1 (status 'open', assignee 1), issue 2 (status 'in_progress',
        // assignee 2) — both statuses present, so `meta` is present for both.
        ctx.mockNext([{ pid: 1, issues: [
            { title: 'Update hero copy', meta: { gate: 'open', assigneeId: 1 } },
            { title: 'Redesign navbar',  meta: { gate: 'in_progress', assigneeId: 2 } },
        ] }])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .select({
                pid:    tIssue.projectId,
                issues: ctx.conn.aggregateAsArray({
                    title: tIssue.title,
                    meta: {
                        gate:       tIssue.status.asRequiredInOptionalObject(),
                        assigneeId: tIssue.assigneeId,
                    },
                }),
            })
            .groupBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as pid, json_arrayagg(json_object('title', title, 'meta.gate', status, 'meta.assigneeId', assignee_id)) as issues from issue where project_id = ? group by project_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid:    number
            issues: Array<{ title: string; meta?: { gate: string; assigneeId: number | undefined } }>
        }>>>()
        const sorted = rows.map(r => ({ ...r, issues: [...r.issues].sort((a, b) => a.title.localeCompare(b.title)) }))
        expect(sorted).toEqual([{ pid: 1, issues: [
            { title: 'Redesign navbar', meta: { gate: 'in_progress', assigneeId: 2 } },
            { title: 'Update hero copy', meta: { gate: 'open', assigneeId: 1 } },
        ] }])
    })

    test('element-containing-a-nested-rule-1-required-in-optional-object-as-nullable', async () => {
        // The same nested rule-1 element under projectingOptionalValuesAsNullable():
        // the inner `meta` object becomes `{...} | null`, `gate` stays required,
        // the plain-optional `assigneeId` flips to `number | null`. Both project-1
        // issues have a status, so `meta` is present for both.
        ctx.mockNext([{ pid: 1, issues: [
            { title: 'Update hero copy', meta: { gate: 'open', assigneeId: 1 } },
            { title: 'Redesign navbar',  meta: { gate: 'in_progress', assigneeId: 2 } },
        ] }])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .select({
                pid:    tIssue.projectId,
                issues: ctx.conn.aggregateAsArray({
                    title: tIssue.title,
                    meta: {
                        gate:       tIssue.status.asRequiredInOptionalObject(),
                        assigneeId: tIssue.assigneeId,
                    },
                }).projectingOptionalValuesAsNullable(),
            })
            .groupBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as pid, json_arrayagg(json_object('title', title, 'meta.gate', status, 'meta.assigneeId', assignee_id)) as issues from issue where project_id = ? group by project_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid:    number
            issues: Array<{ title: string; meta: { gate: string; assigneeId: number | null } | null }>
        }>>>()
        const sorted = rows.map(r => ({ ...r, issues: [...r.issues].sort((a, b) => a.title.localeCompare(b.title)) }))
        expect(sorted).toEqual([{ pid: 1, issues: [
            { title: 'Redesign navbar', meta: { gate: 'in_progress', assigneeId: 2 } },
            { title: 'Update hero copy', meta: { gate: 'open', assigneeId: 1 } },
        ] }])
    })

    test('element-top-rule-3-own-table-optional-leaf-as-nullable-surfaces-null', async () => {
        // `projectingOptionalValuesAsNullable()` on the aggregate makes the optional
        // `body` leaf surface as `string | null` (present-null) instead of absent.
        // Issue 1's null body is present as null.
        ctx.mockNext([{ pid: 1, issues: [
            { title: 'Update hero copy', body: null },
            { title: 'Redesign navbar',  body: 'Use new tokens' },
        ] }])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .select({
                pid:    tIssue.projectId,
                issues: ctx.conn.aggregateAsArray({ title: tIssue.title, body: tIssue.body })
                    .projectingOptionalValuesAsNullable(),
            })
            .groupBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as pid, json_arrayagg(json_object('title', title, 'body', \`body\`)) as issues from issue where project_id = ? group by project_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid:    number
            issues: Array<{ title: string; body: string | null }>
        }>>>()
        const sorted = rows.map(r => ({ ...r, issues: [...r.issues].sort((a, b) => a.title.localeCompare(b.title)) }))
        expect(sorted).toEqual([{ pid: 1, issues: [
            { title: 'Redesign navbar', body: 'Use new tokens' },
            { title: 'Update hero copy', body: null },
        ] }])
        // Issue 1's null body is PRESENT-NULL under the nullable projector.
        const issue1 = rows[0]!.issues.find(i => i.title === 'Update hero copy')!
        expect('body' in issue1).toBe(true)
    })

    test('element-containing-a-left-joined-inner-object-rule-2-default', async () => {
        // An aggregate element that CONTAINS a nested object whose leaves come from
        // a LEFT-JOINED table (rule 2): `proj` has an originallyRequired leaf
        // (`id`, `name`) so it stays required-when-present, and its genuinely-optional
        // `archivedAt` leaf is `Date | undefined`; the whole `proj` object is optional
        // (dropped only when the join misses). Both project-1 issues join to project 1
        // (Marketing site, archived_at NULL) — so `proj` is present and its null
        // `archivedAt` is dropped under the default projector.
        const tProjLeft = tProject.forUseInLeftJoin()
        ctx.mockNext([{ grp: 1, items: [
            { iid: 1, proj: { id: 1, name: 'Marketing site', archivedAt: null } },
            { iid: 2, proj: { id: 1, name: 'Marketing site', archivedAt: null } },
        ] }])
        const rows = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tProjLeft).on(tProjLeft.id.equals(tIssue.projectId))
            .where(tIssue.projectId.equals(1))
            .select({
                grp:   tIssue.projectId,
                items: ctx.conn.aggregateAsArray({
                    iid:  tIssue.id,
                    proj: { id: tProjLeft.id, name: tProjLeft.name, archivedAt: tProjLeft.archivedAt },
                }),
            })
            .groupBy('grp')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.project_id as grp, json_arrayagg(json_object('iid', issue.id, 'proj.id', project.id, 'proj.name', project.name, 'proj.archivedAt', project.archived_at)) as items from issue left join project on project.id = issue.project_id where issue.project_id = ? group by issue.project_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            grp:   number
            items: Array<{ iid: number; proj?: { id: number; name: string; archivedAt: Date | undefined } }>
        }>>>()
        const sorted = rows.map(r => ({ ...r, items: [...r.items].sort((a, b) => a.iid - b.iid) }))
        expect(sorted).toEqual([{ grp: 1, items: [
            { iid: 1, proj: { id: 1, name: 'Marketing site' } },
            { iid: 2, proj: { id: 1, name: 'Marketing site' } },
        ] }])
        // `archivedAt` is null in the seed, so the default projector drops it.
        const first = sorted[0]!.items[0]!
        expect('archivedAt' in first.proj!).toBe(false)
    })

    test('element-containing-a-left-joined-inner-object-rule-2-as-nullable', async () => {
        // The same rule-2 left-joined inner object under
        // `projectingOptionalValuesAsNullable()`: the whole `proj` object becomes
        // `{...} | null` (null only when the join misses) and its optional
        // `archivedAt` leaf flips to `Date | null` (present as null, not dropped).
        // Both project-1 issues join to project 1 (archived_at NULL).
        const tProjLeft = tProject.forUseInLeftJoin()
        ctx.mockNext([{ grp: 1, items: [
            { iid: 1, proj: { id: 1, name: 'Marketing site', archivedAt: null } },
            { iid: 2, proj: { id: 1, name: 'Marketing site', archivedAt: null } },
        ] }])
        const rows = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tProjLeft).on(tProjLeft.id.equals(tIssue.projectId))
            .where(tIssue.projectId.equals(1))
            .select({
                grp:   tIssue.projectId,
                items: ctx.conn.aggregateAsArray({
                    iid:  tIssue.id,
                    proj: { id: tProjLeft.id, name: tProjLeft.name, archivedAt: tProjLeft.archivedAt },
                }).projectingOptionalValuesAsNullable(),
            })
            .groupBy('grp')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.project_id as grp, json_arrayagg(json_object('iid', issue.id, 'proj.id', project.id, 'proj.name', project.name, 'proj.archivedAt', project.archived_at)) as items from issue left join project on project.id = issue.project_id where issue.project_id = ? group by issue.project_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            grp:   number
            items: Array<{ iid: number; proj: { id: number; name: string; archivedAt: Date | null } | null }>
        }>>>()
        const sorted = rows.map(r => ({ ...r, items: [...r.items].sort((a, b) => a.iid - b.iid) }))
        expect(sorted).toEqual([{ grp: 1, items: [
            { iid: 1, proj: { id: 1, name: 'Marketing site', archivedAt: null } },
            { iid: 2, proj: { id: 1, name: 'Marketing site', archivedAt: null } },
        ] }])
    })

    test('element-containing-rule-1-object-with-originally-required-left-join-sibling-default', async () => {
        // An aggregate element containing a rule-1 nested `meta` object (made
        // optional by its `requiredInOptionalObject` `gate` leaf) that mixes an
        // OWN-required leaf (`ownId`), the reqInOptObj `gate` and an
        // originallyRequired LEFT-JOIN leaf (`projName`). The reqInOptObj `gate`
        // STAYS required inside the optional object, while the originally-required
        // left-join `projName` is DEMOTED to `| undefined`. Project 1's issues 1, 2
        // both join project 1 (Marketing site) and both carry a status, so `meta`
        // is present for both.
        ctx.mockNext([{ grp: 1, items: [
            { iid: 1, meta: { ownId: 1, gate: 'open', projName: 'Marketing site' } },
            { iid: 2, meta: { ownId: 2, gate: 'in_progress', projName: 'Marketing site' } },
        ] }])
        const tProjLeft = tProject.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tProjLeft).on(tProjLeft.id.equals(tIssue.projectId))
            .where(tIssue.projectId.equals(1))
            .select({
                grp:   tIssue.projectId,
                items: ctx.conn.aggregateAsArray({
                    iid:  tIssue.id,
                    meta: {
                        ownId:    tIssue.id,
                        gate:     tIssue.status.asRequiredInOptionalObject(),
                        projName: tProjLeft.name,
                    },
                }),
            })
            .groupBy('grp')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.project_id as grp, json_arrayagg(json_object('iid', issue.id, 'meta.ownId', issue.id, 'meta.gate', issue.status, 'meta.projName', project.name)) as items from issue left join project on project.id = issue.project_id where issue.project_id = ? group by issue.project_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            grp:   number
            items: Array<{ iid: number; meta?: { ownId: number; gate: string; projName: string | undefined } }>
        }>>>()
        const sorted = rows.map(r => ({ ...r, items: [...r.items].sort((a, b) => a.iid - b.iid) }))
        expect(sorted).toEqual([{ grp: 1, items: [
            { iid: 1, meta: { ownId: 1, gate: 'open', projName: 'Marketing site' } },
            { iid: 2, meta: { ownId: 2, gate: 'in_progress', projName: 'Marketing site' } },
        ] }])
    })

    test('element-containing-rule-1-object-with-originally-required-left-join-sibling-as-nullable', async () => {
        // The same three-kind rule-1 element under
        // `projectingOptionalValuesAsNullable()`: the optional `meta` object
        // becomes `{...} | null`, `ownId` + `gate` stay required, and the
        // originally-required left-join `projName` flips to `string | null` (not
        // `| undefined`). Project 1's issues 1, 2 both join project 1.
        ctx.mockNext([{ grp: 1, items: [
            { iid: 1, meta: { ownId: 1, gate: 'open', projName: 'Marketing site' } },
            { iid: 2, meta: { ownId: 2, gate: 'in_progress', projName: 'Marketing site' } },
        ] }])
        const tProjLeft = tProject.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tProjLeft).on(tProjLeft.id.equals(tIssue.projectId))
            .where(tIssue.projectId.equals(1))
            .select({
                grp:   tIssue.projectId,
                items: ctx.conn.aggregateAsArray({
                    iid:  tIssue.id,
                    meta: {
                        ownId:    tIssue.id,
                        gate:     tIssue.status.asRequiredInOptionalObject(),
                        projName: tProjLeft.name,
                    },
                }).projectingOptionalValuesAsNullable(),
            })
            .groupBy('grp')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.project_id as grp, json_arrayagg(json_object('iid', issue.id, 'meta.ownId', issue.id, 'meta.gate', issue.status, 'meta.projName', project.name)) as items from issue left join project on project.id = issue.project_id where issue.project_id = ? group by issue.project_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            grp:   number
            items: Array<{ iid: number; meta: { ownId: number; gate: string; projName: string | null } | null }>
        }>>>()
        const sorted = rows.map(r => ({ ...r, items: [...r.items].sort((a, b) => a.iid - b.iid) }))
        expect(sorted).toEqual([{ grp: 1, items: [
            { iid: 1, meta: { ownId: 1, gate: 'open', projName: 'Marketing site' } },
            { iid: 2, meta: { ownId: 2, gate: 'in_progress', projName: 'Marketing site' } },
        ] }])
    })

    test('element-containing-left-join-all-optional-object-applies-rule-4-default', async () => {
        // An aggregate element containing a nested `opt` object whose leaves ALL
        // come from the SAME left-joined table AND are ALL
        // genuinely-optional (`body`, `assigneeId`) — no originallyRequired leaf,
        // so rule 2 is DISCARDED and rule 4 applies: `opt` is optional and dropped
        // only when every leaf is null. Grouping org 2's projects (3, 4): project 3
        // joins issue 4 (opt present), project 4 has no issue (left-join miss → opt
        // dropped).
        ctx.mockNext([{ orgId: 2, items: [
            { pid: 3, opt: { body: 'See ADR-014', assigneeId: 3 } },
            { pid: 4, opt: { body: null, assigneeId: null } },
        ] }])
        const tIssueLeft = tIssue.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.organizationId.equals(2))
            .select({
                orgId: tProject.organizationId,
                items: ctx.conn.aggregateAsArray({
                    pid: tProject.id,
                    opt: { body: tIssueLeft.body, assigneeId: tIssueLeft.assigneeId },
                }),
            })
            .groupBy('orgId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.organization_id as orgId, json_arrayagg(json_object('pid', project.id, 'opt.body', issue.\`body\`, 'opt.assigneeId', issue.assignee_id)) as items from project left join issue on issue.project_id = project.id where project.organization_id = ? group by project.organization_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            orgId: number
            items: Array<{ pid: number; opt?: { body: string | undefined; assigneeId: number | undefined } }>
        }>>>()
        const sorted = rows.map(r => ({ ...r, items: [...r.items].sort((a, b) => a.pid - b.pid) }))
        expect(sorted).toEqual([{ orgId: 2, items: [
            { pid: 3, opt: { body: 'See ADR-014', assigneeId: 3 } },
            { pid: 4 },
        ] }])
        // Project 4's join misses → every `opt` leaf is null → rule 4 drops the
        // object entirely (key ABSENT, not present-undefined).
        const proj4 = sorted[0]!.items.find(i => i.pid === 4)!
        expect('opt' in proj4).toBe(false)
    })

    test('element-containing-left-join-all-optional-object-applies-rule-4-as-nullable', async () => {
        // The same rule-4 all-optional left-join element under
        // `projectingOptionalValuesAsNullable()`: the dropped `opt` object surfaces
        // as present-`null` and each leaf flips to `| null`. Project 4's missing
        // issue becomes `opt: null`.
        ctx.mockNext([{ orgId: 2, items: [
            { pid: 3, opt: { body: 'See ADR-014', assigneeId: 3 } },
            { pid: 4, opt: { body: null, assigneeId: null } },
        ] }])
        const tIssueLeft = tIssue.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.organizationId.equals(2))
            .select({
                orgId: tProject.organizationId,
                items: ctx.conn.aggregateAsArray({
                    pid: tProject.id,
                    opt: { body: tIssueLeft.body, assigneeId: tIssueLeft.assigneeId },
                }).projectingOptionalValuesAsNullable(),
            })
            .groupBy('orgId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.organization_id as orgId, json_arrayagg(json_object('pid', project.id, 'opt.body', issue.\`body\`, 'opt.assigneeId', issue.assignee_id)) as items from project left join issue on issue.project_id = project.id where project.organization_id = ? group by project.organization_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            orgId: number
            items: Array<{ pid: number; opt: { body: string | null; assigneeId: number | null } | null }>
        }>>>()
        const sorted = rows.map(r => ({ ...r, items: [...r.items].sort((a, b) => a.pid - b.pid) }))
        expect(sorted).toEqual([{ orgId: 2, items: [
            { pid: 3, opt: { body: 'See ADR-014', assigneeId: 3 } },
            { pid: 4, opt: null },
        ] }])
    })

    test('element-top-rule-1-required-in-optional-object-gate-null-drops-whole-element', async () => {
        // The reqInOptObj gate at the ELEMENT TOP (not nested inside `meta`): `ref`
        // is `body.asRequiredInOptionalObject()`, so an element whose `ref` gate is
        // NULL is dropped from the array entirely — the tail arm of the existing
        // never-null-gate rule-1 test. Org 1's issues 1, 2, 3 aggregate; issues 1 and
        // 3 have a null body → their whole elements (including `assigneeId`) are
        // omitted, leaving only issue 2. Type: `ref` is required (the gate),
        // `assigneeId` optional.
        ctx.mockNext([{ orgId: 1, items: [
            { ref: null,             assigneeId: 1 },
            { ref: 'Use new tokens', assigneeId: 2 },
            { ref: null,             assigneeId: null },
        ] }])
        const rows = await ctx.conn.selectFrom(tProject)
            .innerJoin(tIssue).on(tIssue.projectId.equals(tProject.id))
            .where(tProject.organizationId.equals(1))
            .select({
                orgId: tProject.organizationId,
                items: ctx.conn.aggregateAsArray({
                    ref:        tIssue.body.asRequiredInOptionalObject(),
                    assigneeId: tIssue.assigneeId,
                }),
            })
            .groupBy('orgId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.organization_id as orgId, json_arrayagg(json_object('ref', issue.\`body\`, 'assigneeId', issue.assignee_id)) as items from project inner join issue on issue.project_id = project.id where project.organization_id = ? group by project.organization_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            orgId: number
            items: Array<{ ref: string; assigneeId?: number }>
        }>>>()
        const sorted = rows.map(r => ({ ...r, items: [...r.items].sort((a, b) => a.ref.localeCompare(b.ref)) }))
        expect(sorted).toEqual([{ orgId: 1, items: [
            { ref: 'Use new tokens', assigneeId: 2 },
        ] }])
        // Both null-gate elements (issues 1 and 3) are omitted → only one survives.
        expect(rows[0]!.items.length).toBe(1)
    })

    test('element-top-rule-1-required-in-optional-object-gate-null-drops-whole-element-as-nullable', async () => {
        // The `projectingOptionalValuesAsNullable()` twin of the default rule-1
        // top-element test above. The reqInOptObj gate at the ELEMENT TOP (`ref` is
        // `body.asRequiredInOptionalObject()`) still DROPS an element whose gate is
        // NULL — the nullable projector flips optional LEAVES to present-`| null`
        // but does NOT surface a null-gated element as `{ ref: null }`. `ref` stays
        // required (it is the gate), `assigneeId` flips `number | null`, and the
        // element itself is NOT `| null`. Rule-2 (line ~769) and rule-4 (line ~614)
        // have this asNullable twin; rule-1 did not. Org 1's issues 1, 2, 3
        // aggregate; issues 1 and 3 have a null body → dropped, leaving only issue 2.
        ctx.mockNext([{ orgId: 1, items: [
            { ref: null,             assigneeId: 1 },
            { ref: 'Use new tokens', assigneeId: 2 },
            { ref: null,             assigneeId: null },
        ] }])
        const rows = await ctx.conn.selectFrom(tProject)
            .innerJoin(tIssue).on(tIssue.projectId.equals(tProject.id))
            .where(tProject.organizationId.equals(1))
            .select({
                orgId: tProject.organizationId,
                items: ctx.conn.aggregateAsArray({
                    ref:        tIssue.body.asRequiredInOptionalObject(),
                    assigneeId: tIssue.assigneeId,
                }).projectingOptionalValuesAsNullable(),
            })
            .groupBy('orgId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.organization_id as orgId, json_arrayagg(json_object('ref', issue.\`body\`, 'assigneeId', issue.assignee_id)) as items from project inner join issue on issue.project_id = project.id where project.organization_id = ? group by project.organization_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            orgId: number
            items: Array<{ ref: string; assigneeId: number | null }>
        }>>>()
        const sorted = rows.map(r => ({ ...r, items: [...r.items].sort((a, b) => a.ref.localeCompare(b.ref)) }))
        expect(sorted).toEqual([{ orgId: 1, items: [
            { ref: 'Use new tokens', assigneeId: 2 },
        ] }])
        // Even under the nullable projector both null-gate elements DROP (they are
        // not surfaced as `{ ref: null }`) → only one survives.
        expect(rows[0]!.items.length).toBe(1)
    })

    test('element-containing-sole-optional-inner-object-collapses-on-aggregate-path-default', async () => {
        // The aggregate-path twin of the 143fe3b2 sole-optional-inner fix: an element
        // whose `wrapper` has a SOLE member (`inner`, an all-optional object). The
        // container recursively inherits its sole member's optionality, so `wrapper`
        // is `wrapper?` and collapses (absent) when the inner's every leaf is null.
        // Org 1's issues aggregate: issue 1 (body null, assignee 1) → inner present
        // with only assigneeId; issue 2 → inner fully present; issue 3 (body +
        // assignee null) → inner collapses → wrapper dropped.
        ctx.mockNext([{ orgId: 1, items: [
            { iid: 1, wrapper: { inner: { body: null,             assigneeId: 1 } } },
            { iid: 2, wrapper: { inner: { body: 'Use new tokens', assigneeId: 2 } } },
            { iid: 3, wrapper: { inner: { body: null,             assigneeId: null } } },
        ] }])
        const rows = await ctx.conn.selectFrom(tProject)
            .innerJoin(tIssue).on(tIssue.projectId.equals(tProject.id))
            .where(tProject.organizationId.equals(1))
            .select({
                orgId: tProject.organizationId,
                items: ctx.conn.aggregateAsArray({
                    iid:     tIssue.id,
                    wrapper: { inner: { body: tIssue.body, assigneeId: tIssue.assigneeId } },
                }),
            })
            .groupBy('orgId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.organization_id as orgId, json_arrayagg(json_object('iid', issue.id, 'wrapper.inner.body', issue.\`body\`, 'wrapper.inner.assigneeId', issue.assignee_id)) as items from project inner join issue on issue.project_id = project.id where project.organization_id = ? group by project.organization_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            orgId: number
            items: Array<{ iid: number; wrapper?: { inner: { body: string | undefined; assigneeId: number | undefined } | undefined } }>
        }>>>()
        const sorted = rows.map(r => ({ ...r, items: [...r.items].sort((a, b) => a.iid - b.iid) }))
        expect(sorted).toEqual([{ orgId: 1, items: [
            { iid: 1, wrapper: { inner: { assigneeId: 1 } } },
            { iid: 2, wrapper: { inner: { body: 'Use new tokens', assigneeId: 2 } } },
            { iid: 3 },
        ] }])
        // issue 3's inner collapsed → `wrapper` is ABSENT (present-undefined would fail).
        const issue3 = sorted[0]!.items.find(i => i.iid === 3)!
        expect('wrapper' in issue3).toBe(false)
    })

    test('element-containing-sole-optional-inner-object-collapses-on-aggregate-path-as-nullable', async () => {
        // The same sole-optional-inner aggregate element under
        // `projectingOptionalValuesAsNullable()`: `wrapper` becomes `{...} | null`,
        // the inner `{...} | null`, and its leaves flip to `| null`. Issue 3's
        // all-null inner collapses the whole `wrapper` to null (not absent) — the
        // nullable mirror of the default drop above.
        ctx.mockNext([{ orgId: 1, items: [
            { iid: 1, wrapper: { inner: { body: null,             assigneeId: 1 } } },
            { iid: 2, wrapper: { inner: { body: 'Use new tokens', assigneeId: 2 } } },
            { iid: 3, wrapper: { inner: { body: null,             assigneeId: null } } },
        ] }])
        const rows = await ctx.conn.selectFrom(tProject)
            .innerJoin(tIssue).on(tIssue.projectId.equals(tProject.id))
            .where(tProject.organizationId.equals(1))
            .select({
                orgId: tProject.organizationId,
                items: ctx.conn.aggregateAsArray({
                    iid:     tIssue.id,
                    wrapper: { inner: { body: tIssue.body, assigneeId: tIssue.assigneeId } },
                }).projectingOptionalValuesAsNullable(),
            })
            .groupBy('orgId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.organization_id as orgId, json_arrayagg(json_object('iid', issue.id, 'wrapper.inner.body', issue.\`body\`, 'wrapper.inner.assigneeId', issue.assignee_id)) as items from project inner join issue on issue.project_id = project.id where project.organization_id = ? group by project.organization_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            orgId: number
            items: Array<{ iid: number; wrapper: { inner: { body: string | null; assigneeId: number | null } | null } | null }>
        }>>>()
        const sorted = rows.map(r => ({ ...r, items: [...r.items].sort((a, b) => a.iid - b.iid) }))
        expect(sorted).toEqual([{ orgId: 1, items: [
            { iid: 1, wrapper: { inner: { body: null, assigneeId: 1 } } },
            { iid: 2, wrapper: { inner: { body: 'Use new tokens', assigneeId: 2 } } },
            { iid: 3, wrapper: null },
        ] }])
    })

    test('element-top-pure-rule-4-all-optional-element-drops-when-all-null-default', async () => {
        // An aggregate element whose EVERY leaf is optional (`body`, `assigneeId`). A row where
        // all leaves are null drops the WHOLE element from the array. Org 2 groups project 3
        // (left-joins issue 4 → element present) and project 4 (left-join miss → every leaf null →
        // element dropped).
        const tIssueLeft = tIssue.forUseInLeftJoin()
        ctx.mockNext([{ orgId: 2, items: [
            { body: 'See ADR-014', assigneeId: 3 },
            { body: null, assigneeId: null },
        ] }])
        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.organizationId.equals(2))
            .select({
                orgId: tProject.organizationId,
                items: ctx.conn.aggregateAsArray({ body: tIssueLeft.body, assigneeId: tIssueLeft.assigneeId }),
            })
            .groupBy('orgId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.organization_id as orgId, json_arrayagg(json_object('body', issue.\`body\`, 'assigneeId', issue.assignee_id)) as items from project left join issue on issue.project_id = project.id where project.organization_id = ? group by project.organization_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            orgId: number
            items: Array<{ body?: string | undefined; assigneeId?: number | undefined }>
        }>>>()
        expect(rows).toEqual([{ orgId: 2, items: [{ body: 'See ADR-014', assigneeId: 3 }] }])
        // The all-null element is dropped entirely — the array has one element, not two.
        expect(rows[0]!.items.length).toBe(1)
    })
    test('element-top-pure-rule-4-all-optional-element-drops-when-all-null-as-nullable', async () => {
        // The same all-optional element under `projectingOptionalValuesAsNullable()`: the all-null
        // element is STILL dropped (the nullable projector does not surface it as a present
        // `{ body: null, assigneeId: null }`). Same org-2 grouping; project 4's missed element is
        // gone, not present.
        const tIssueLeft = tIssue.forUseInLeftJoin()
        ctx.mockNext([{ orgId: 2, items: [
            { body: 'See ADR-014', assigneeId: 3 },
            { body: null, assigneeId: null },
        ] }])
        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.organizationId.equals(2))
            .select({
                orgId: tProject.organizationId,
                items: ctx.conn.aggregateAsArray({ body: tIssueLeft.body, assigneeId: tIssueLeft.assigneeId })
                    .projectingOptionalValuesAsNullable(),
            })
            .groupBy('orgId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.organization_id as orgId, json_arrayagg(json_object('body', issue.\`body\`, 'assigneeId', issue.assignee_id)) as items from project left join issue on issue.project_id = project.id where project.organization_id = ? group by project.organization_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            orgId: number
            items: Array<{ body: string | null; assigneeId: number | null }>
        }>>>()
        expect(rows).toEqual([{ orgId: 2, items: [{ body: 'See ADR-014', assigneeId: 3 }] }])
        // Even under the nullable projector the all-null element is dropped, not kept as null.
        expect(rows[0]!.items.length).toBe(1)
    })
    test('element-containing-rule-2-left-join-object-realizes-a-miss-default', async () => {
        // A nested object (`iss`) whose leaves come from a left-joined table, mixing
        // originally-required (`id`, `title`) with optional (`body`): it is optional and dropped
        // when the join misses. Org 2 groups project 3 (joins issue 4 → iss present) and project 4
        // (no issue, left-join miss → iss dropped). The element keeps a required `pid`, so only the
        // nested `iss` disappears.
        const tIssueLeft = tIssue.forUseInLeftJoin()
        ctx.mockNext([{ orgId: 2, items: [
            { pid: 3, iss: { id: 4, title: 'Document /v2/users', body: 'See ADR-014' } },
            { pid: 4, iss: { id: null, title: null, body: null } },
        ] }])
        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.organizationId.equals(2))
            .select({
                orgId: tProject.organizationId,
                items: ctx.conn.aggregateAsArray({
                    pid: tProject.id,
                    iss: { id: tIssueLeft.id, title: tIssueLeft.title, body: tIssueLeft.body },
                }),
            })
            .groupBy('orgId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.organization_id as orgId, json_arrayagg(json_object('pid', project.id, 'iss.id', issue.id, 'iss.title', issue.title, 'iss.body', issue.\`body\`)) as items from project left join issue on issue.project_id = project.id where project.organization_id = ? group by project.organization_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            orgId: number
            items: Array<{ pid: number; iss?: { id: number; title: string; body: string | undefined } }>
        }>>>()
        const sorted = rows.map(r => ({ ...r, items: [...r.items].sort((a, b) => a.pid - b.pid) }))
        expect(sorted).toEqual([{ orgId: 2, items: [
            { pid: 3, iss: { id: 4, title: 'Document /v2/users', body: 'See ADR-014' } },
            { pid: 4 },
        ] }])
        // Project 4's join missed → the whole `iss` object is absent (present-undefined would fail).
        const proj4 = sorted[0]!.items.find(i => i.pid === 4)!
        expect('iss' in proj4).toBe(false)
    })
    test('element-containing-rule-2-left-join-object-realizes-a-miss-as-nullable', async () => {
        // The same left-join object under `projectingOptionalValuesAsNullable()`: the missed `iss`
        // surfaces as present-`null` and its optional `body` leaf becomes `string | null`. Same
        // org-2 grouping; project 4's missed `iss` is `null`.
        const tIssueLeft = tIssue.forUseInLeftJoin()
        ctx.mockNext([{ orgId: 2, items: [
            { pid: 3, iss: { id: 4, title: 'Document /v2/users', body: 'See ADR-014' } },
            { pid: 4, iss: { id: null, title: null, body: null } },
        ] }])
        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.organizationId.equals(2))
            .select({
                orgId: tProject.organizationId,
                items: ctx.conn.aggregateAsArray({
                    pid: tProject.id,
                    iss: { id: tIssueLeft.id, title: tIssueLeft.title, body: tIssueLeft.body },
                }).projectingOptionalValuesAsNullable(),
            })
            .groupBy('orgId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.organization_id as orgId, json_arrayagg(json_object('pid', project.id, 'iss.id', issue.id, 'iss.title', issue.title, 'iss.body', issue.\`body\`)) as items from project left join issue on issue.project_id = project.id where project.organization_id = ? group by project.organization_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            orgId: number
            items: Array<{ pid: number; iss: { id: number; title: string; body: string | null } | null }>
        }>>>()
        const sorted = rows.map(r => ({ ...r, items: [...r.items].sort((a, b) => a.pid - b.pid) }))
        expect(sorted).toEqual([{ orgId: 2, items: [
            { pid: 3, iss: { id: 4, title: 'Document /v2/users', body: 'See ADR-014' } },
            { pid: 4, iss: null },
        ] }])
    })

    test('element-top-rule-2-all-left-join-element-drops-on-miss-default', async () => {
        // An aggregate element whose EVERY leaf comes from the left-joined table, mixing
        // originally-required (`id`, `title`) with optional (`body`). When the join
        // MISSES, every leaf is null and the WHOLE element is dropped. Org 2 groups
        // project 3 (left-joins issue 4 → element present) and project 4 (left-join
        // miss → element dropped).
        const tIssueLeft = tIssue.forUseInLeftJoin()
        ctx.mockNext([{ orgId: 2, items: [
            { id: 4, title: 'Document /v2/users', body: 'See ADR-014' },
            { id: null, title: null, body: null },
        ] }])
        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.organizationId.equals(2))
            .select({
                orgId: tProject.organizationId,
                items: ctx.conn.aggregateAsArray({ id: tIssueLeft.id, title: tIssueLeft.title, body: tIssueLeft.body }),
            })
            .groupBy('orgId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.organization_id as orgId, json_arrayagg(json_object('id', issue.id, 'title', issue.title, 'body', issue.\`body\`)) as items from project left join issue on issue.project_id = project.id where project.organization_id = ? group by project.organization_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            orgId: number
            items: Array<{ id: number; title: string; body?: string }>
        }>>>()
        expect(rows).toEqual([{ orgId: 2, items: [{ id: 4, title: 'Document /v2/users', body: 'See ADR-014' }] }])
        // The all-null (missed) element is dropped entirely — one element, not two.
        expect(rows[0]!.items.length).toBe(1)
    })

    test('element-top-rule-2-all-left-join-element-drops-on-miss-as-nullable', async () => {
        // Under `projectingOptionalValuesAsNullable()` a missed element is STILL dropped
        // (not surfaced); the originally-required leaves stay `id: number` / `title: string`
        // and the optional `body` becomes `string | null`.
        const tIssueLeft = tIssue.forUseInLeftJoin()
        ctx.mockNext([{ orgId: 2, items: [
            { id: 4, title: 'Document /v2/users', body: 'See ADR-014' },
            { id: null, title: null, body: null },
        ] }])
        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.organizationId.equals(2))
            .select({
                orgId: tProject.organizationId,
                items: ctx.conn.aggregateAsArray({ id: tIssueLeft.id, title: tIssueLeft.title, body: tIssueLeft.body })
                    .projectingOptionalValuesAsNullable(),
            })
            .groupBy('orgId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.organization_id as orgId, json_arrayagg(json_object('id', issue.id, 'title', issue.title, 'body', issue.\`body\`)) as items from project left join issue on issue.project_id = project.id where project.organization_id = ? group by project.organization_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            orgId: number
            items: Array<{ id: number; title: string; body: string | null }>
        }>>>()
        expect(rows).toEqual([{ orgId: 2, items: [{ id: 4, title: 'Document /v2/users', body: 'See ADR-014' }] }])
        expect(rows[0]!.items.length).toBe(1)
    })

    test('inline-element-own-table-optional-leaf-default-drops-null', async () => {
        // The `forUseAsInlineAggregatedArrayValue()` sibling of the default
        // `aggregateAsArray` case above: a null optional `body` leaf is dropped
        // from the inlined element (`body?: string`). Project 1 has issue 1
        // (body NULL → absent) and issue 2 ('Use new tokens' → survives).
        ctx.mockNext({ pid: 1, issues: [
            { title: 'Update hero copy', body: null },
            { title: 'Redesign navbar',  body: 'Use new tokens' },
        ] })
        const issues = ctx.conn.subSelectUsing(tProject).from(tIssue)
            .where(tIssue.projectId.equals(tProject.id))
            .select({ title: tIssue.title, body: tIssue.body })
            .forUseAsInlineAggregatedArrayValue()
        const row = await ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ pid: tProject.id, issues })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as pid, (select json_arrayagg(json_object('title', title, 'body', \`body\`)) from issue where project_id = project.id) as issues from project where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            pid:    number
            issues: Array<{ title: string; body?: string }>
        }>>()
        const sorted = [...row.issues].sort((a, b) => a.title.localeCompare(b.title))
        expect(sorted).toEqual([
            { title: 'Redesign navbar', body: 'Use new tokens' },
            { title: 'Update hero copy' },
        ])
        // Issue 1's null body is ABSENT under the default projector.
        const issue1 = row.issues.find(i => i.title === 'Update hero copy')!
        expect('body' in issue1).toBe(false)
    })

    test('inline-element-own-table-optional-leaf-as-nullable-surfaces-null', async () => {
        // Regression: `projectingOptionalValuesAsNullable()` called on the
        // inlined select makes the optional `body` leaf surface present-as-null
        // in each array element (`body: string | null`) instead of being
        // dropped — the type now matches the runtime, which honours the flag
        // for the inline aggregated array just like
        // `aggregateAsArray(...).projectingOptionalValuesAsNullable()`.
        ctx.mockNext({ pid: 1, issues: [
            { title: 'Update hero copy', body: null },
            { title: 'Redesign navbar',  body: 'Use new tokens' },
        ] })
        const issues = ctx.conn.subSelectUsing(tProject).from(tIssue)
            .where(tIssue.projectId.equals(tProject.id))
            .select({ title: tIssue.title, body: tIssue.body })
            .projectingOptionalValuesAsNullable()
            .forUseAsInlineAggregatedArrayValue()
        const row = await ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ pid: tProject.id, issues })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as pid, (select json_arrayagg(json_object('title', title, 'body', \`body\`)) from issue where project_id = project.id) as issues from project where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            pid:    number
            issues: Array<{ title: string; body: string | null }>
        }>>()
        const sorted = [...row.issues].sort((a, b) => a.title.localeCompare(b.title))
        expect(sorted).toEqual([
            { title: 'Redesign navbar', body: 'Use new tokens' },
            { title: 'Update hero copy', body: null },
        ])
        // Issue 1's null body is PRESENT as null under projectingOptionalValuesAsNullable().
        const issue1 = row.issues.find(i => i.title === 'Update hero copy')!
        expect('body' in issue1).toBe(true)
        expect(issue1.body).toBe(null)
    })
    test('inline-element-rule-1-gate-leaf-at-top-default-keeps-element-drops-gate', async () => {
        // Rule-1 at the inline ELEMENT TOP: `ref` is a requiredInOptionalObject gate
        // (issue.body), `assigneeId` an optional leaf. The inline aggregate runtime is
        // NON-DROPPING (`__transformRootObject`): unlike `aggregateAsArray` — which
        // drops the whole element when the rule-1 gate is null — the element is KEPT
        // and the null `ref` is ABSENT under the default projector. Project 1: issue 1
        // (body NULL → gate miss, element kept, ref absent) and issue 2 (body present).
        ctx.mockNext({ pid: 1, issues: [
            { ref: null, assigneeId: 1 },
            { ref: 'Use new tokens', assigneeId: 2 },
        ] })
        const issues = ctx.conn.subSelectUsing(tProject).from(tIssue)
            .where(tIssue.projectId.equals(tProject.id))
            .select({ ref: tIssue.body.asRequiredInOptionalObject(), assigneeId: tIssue.assigneeId })
            .forUseAsInlineAggregatedArrayValue()
        const row = await ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ pid: tProject.id, issues })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as pid, (select json_arrayagg(json_object('ref', \`body\`, 'assigneeId', assignee_id)) from issue where project_id = project.id) as issues from project where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            pid:    number
            issues: Array<{ ref?: string | undefined; assigneeId?: number | undefined }>
        }>>()
        const sorted = [...row.issues].sort((a, b) => a.assigneeId! - b.assigneeId!)
        expect(sorted).toEqual([
            { assigneeId: 1 },
            { ref: 'Use new tokens', assigneeId: 2 },
        ])
        // The rule-1 gate-null element is KEPT (inline root is non-dropping), `ref` ABSENT.
        expect('ref' in sorted[0]!).toBe(false)
    })

    test('inline-element-rule-1-gate-leaf-at-top-as-nullable-surfaces-null', async () => {
        // Same rule-1 element top under `projectingOptionalValuesAsNullable()`: the
        // non-dropping inline runtime keeps the gate-null element and writes the gate
        // present-as-null. The plain nullable projector types the requiredInOptionalObject
        // `ref` leaf as `string | null` (NOT non-null `T` — that would be the dropping
        // `aggregateAsArray` shape), so the type matches the present-null runtime.
        ctx.mockNext({ pid: 1, issues: [
            { ref: null, assigneeId: 1 },
            { ref: 'Use new tokens', assigneeId: 2 },
        ] })
        const issues = ctx.conn.subSelectUsing(tProject).from(tIssue)
            .where(tIssue.projectId.equals(tProject.id))
            .select({ ref: tIssue.body.asRequiredInOptionalObject(), assigneeId: tIssue.assigneeId })
            .projectingOptionalValuesAsNullable()
            .forUseAsInlineAggregatedArrayValue()
        const row = await ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ pid: tProject.id, issues })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as pid, (select json_arrayagg(json_object('ref', \`body\`, 'assigneeId', assignee_id)) from issue where project_id = project.id) as issues from project where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            pid:    number
            issues: Array<{ ref: string | null; assigneeId: number | null }>
        }>>()
        const sorted = [...row.issues].sort((a, b) => a.assigneeId! - b.assigneeId!)
        expect(sorted).toEqual([
            { ref: null, assigneeId: 1 },
            { ref: 'Use new tokens', assigneeId: 2 },
        ])
        // The gate-null element is PRESENT with `ref === null` (not dropped, not absent).
        expect('ref' in sorted[0]!).toBe(true)
        expect(sorted[0]!.ref).toBe(null)
    })

    test('inline-element-rule-2-left-join-leaf-at-top-default-keeps-element-drops-leaf', async () => {
        // Rule-2 at the inline ELEMENT TOP: the sole leaf `name` is an
        // originallyRequired leaf of a LEFT-JOINED table (app_user), so the element is
        // optional. On a join miss the NON-DROPPING inline runtime keeps the element
        // and OMITS `name` under the default projector (contrast `aggregateAsArray`,
        // which drops the whole element). Project 2's issue 3 has no assignee → miss.
        const tAssignee = tAppUser.forUseInLeftJoin()
        ctx.mockNext({ pid: 2, assignees: [
            { name: null },
        ] })
        const assignees = ctx.conn.subSelectUsing(tProject).from(tIssue)
            .leftJoin(tAssignee).on(tAssignee.id.equals(tIssue.assigneeId))
            .where(tIssue.projectId.equals(tProject.id))
            .select({ name: tAssignee.fullName })
            .forUseAsInlineAggregatedArrayValue()
        const row = await ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(2))
            .select({ pid: tProject.id, assignees })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as pid, (select json_arrayagg(json_object('name', app_user.full_name)) from issue left join app_user on app_user.id = issue.assignee_id where issue.project_id = project.id) as assignees from project where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof row, {
            pid:       number
            assignees: Array<{ name?: string | undefined }>
        }>>()
        // The join-miss element is KEPT as `{}` with `name` ABSENT (inline root is
        // non-dropping — `aggregateAsArray` would have dropped it, yielding `[]`).
        expect(row.assignees).toEqual([{}])
        expect('name' in row.assignees[0]!).toBe(false)
    })

    test('inline-element-rule-2-left-join-leaf-at-top-as-nullable-surfaces-null', async () => {
        // Same rule-2 element top under `projectingOptionalValuesAsNullable()`: the
        // non-dropping inline runtime keeps the join-miss element and writes `name`
        // present-as-null. The plain nullable projector types the originallyRequired
        // `name` leaf as `string | null` (NOT non-null `T` — the dropping
        // `aggregateAsArray` shape), so the type matches the present-null runtime.
        const tAssignee = tAppUser.forUseInLeftJoin()
        ctx.mockNext({ pid: 2, assignees: [
            { name: null },
        ] })
        const assignees = ctx.conn.subSelectUsing(tProject).from(tIssue)
            .leftJoin(tAssignee).on(tAssignee.id.equals(tIssue.assigneeId))
            .where(tIssue.projectId.equals(tProject.id))
            .select({ name: tAssignee.fullName })
            .projectingOptionalValuesAsNullable()
            .forUseAsInlineAggregatedArrayValue()
        const row = await ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(2))
            .select({ pid: tProject.id, assignees })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as pid, (select json_arrayagg(json_object('name', app_user.full_name)) from issue left join app_user on app_user.id = issue.assignee_id where issue.project_id = project.id) as assignees from project where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof row, {
            pid:       number
            assignees: Array<{ name: string | null }>
        }>>()
        // The join-miss element is PRESENT with `name === null` (not dropped, not absent).
        expect(row.assignees).toEqual([{ name: null }])
        expect('name' in row.assignees[0]!).toBe(true)
        expect(row.assignees[0]!.name).toBe(null)
    })

    test('inline-element-top-rule-2-multi-left-join-leaves-as-nullable-surface-null', async () => {
        // Rule-2 at the inline ELEMENT TOP with MULTIPLE originallyRequired leaves
        // (`id`, `title`) plus an optional `body`, all from the SAME left-joined table,
        // under `projectingOptionalValuesAsNullable()`. The element is kept on a join
        // miss and every leaf comes back present-as-null. Org 2 groups project 3 (joins
        // issue 4) and project 4 (left-join miss → all leaves null, element kept).
        const tIssueLeft = tIssue.forUseInLeftJoin()
        ctx.mockNext({ orgId: 2, items: [
            { id: 4, title: 'Document /v2/users', body: 'See ADR-014' },
            { id: null, title: null, body: null },
        ] })
        const items = ctx.conn.subSelectUsing(tOrganization).from(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.organizationId.equals(tOrganization.id))
            .select({ id: tIssueLeft.id, title: tIssueLeft.title, body: tIssueLeft.body })
            .projectingOptionalValuesAsNullable()
            .forUseAsInlineAggregatedArrayValue()
        const row = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(2))
            .select({ orgId: tOrganization.id, items })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as orgId, (select json_arrayagg(json_object('id', issue.id, 'title', issue.title, 'body', issue.\`body\`)) from project left join issue on issue.project_id = project.id where project.organization_id = organization.id) as items from organization where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof row, {
            orgId: number
            items: Array<{ id: number | null; title: string | null; body: string | null }>
        }>>()
        const sorted = [...row.items].sort((a, b) => (a.id ?? -1) - (b.id ?? -1))
        expect(sorted).toEqual([
            { id: null, title: null, body: null },
            { id: 4, title: 'Document /v2/users', body: 'See ADR-014' },
        ])
        // The join-miss element is kept with both leaves present-null (two elements).
        expect(row.items.length).toBe(2)
    })

    test('inline-element-top-rule-4-all-optional-default-keeps-empty-element', async () => {
        // Rule-4 at the inline ELEMENT TOP: every leaf (`body`, `assigneeId`) is
        // genuinely-optional and from the same left join. Under the default projector an
        // all-null element is kept as `{}` (both null leaves ABSENT). Org 2 groups
        // project 3 (joins issue 4 → element present) and project 4 (left-join miss → all
        // leaves null → element kept as `{}`).
        const tIssueLeft = tIssue.forUseInLeftJoin()
        ctx.mockNext({ orgId: 2, items: [
            { body: 'See ADR-014', assigneeId: 3 },
            { body: null, assigneeId: null },
        ] })
        const items = ctx.conn.subSelectUsing(tOrganization).from(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.organizationId.equals(tOrganization.id))
            .select({ body: tIssueLeft.body, assigneeId: tIssueLeft.assigneeId })
            .forUseAsInlineAggregatedArrayValue()
        const row = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(2))
            .select({ orgId: tOrganization.id, items })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as orgId, (select json_arrayagg(json_object('body', issue.\`body\`, 'assigneeId', issue.assignee_id)) from project left join issue on issue.project_id = project.id where project.organization_id = organization.id) as items from organization where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof row, {
            orgId: number
            items: Array<{ body?: string | undefined; assigneeId?: number | undefined }>
        }>>()
        const sorted = [...row.items].sort((a, b) => (a.assigneeId ?? -1) - (b.assigneeId ?? -1))
        expect(sorted).toEqual([{}, { body: 'See ADR-014', assigneeId: 3 }])
        // The all-null element is kept as `{}` — the array has two elements, not one.
        expect(row.items.length).toBe(2)
        const empty = sorted[0]!
        expect('body' in empty).toBe(false)
        expect('assigneeId' in empty).toBe(false)
    })

    test('inline-element-top-rule-4-all-optional-as-nullable-surfaces-null', async () => {
        // The same rule-4 all-optional element top under
        // `projectingOptionalValuesAsNullable()`: the all-null element is kept and each
        // leaf surfaces present-as-null (`{ body: null, assigneeId: null }`). Same org-2
        // grouping.
        const tIssueLeft = tIssue.forUseInLeftJoin()
        ctx.mockNext({ orgId: 2, items: [
            { body: 'See ADR-014', assigneeId: 3 },
            { body: null, assigneeId: null },
        ] })
        const items = ctx.conn.subSelectUsing(tOrganization).from(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.organizationId.equals(tOrganization.id))
            .select({ body: tIssueLeft.body, assigneeId: tIssueLeft.assigneeId })
            .projectingOptionalValuesAsNullable()
            .forUseAsInlineAggregatedArrayValue()
        const row = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(2))
            .select({ orgId: tOrganization.id, items })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as orgId, (select json_arrayagg(json_object('body', issue.\`body\`, 'assigneeId', issue.assignee_id)) from project left join issue on issue.project_id = project.id where project.organization_id = organization.id) as items from organization where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof row, {
            orgId: number
            items: Array<{ body: string | null; assigneeId: number | null }>
        }>>()
        const sorted = [...row.items].sort((a, b) => (a.assigneeId ?? -1) - (b.assigneeId ?? -1))
        expect(sorted).toEqual([{ body: null, assigneeId: null }, { body: 'See ADR-014', assigneeId: 3 }])
        // The all-null element is kept present-null — two elements.
        expect(row.items.length).toBe(2)
    })

    test('inline-element-nested-rule-1-gate-object-default-drops-nested-on-null-gate', async () => {
        // A NESTED rule-1 object (`meta`) inside an inline element whose top `iid` is a
        // required own-table leaf. The nested `meta` is gated by a
        // `requiredInOptionalObject` leaf (`gate` = issue.body): a null gate drops the
        // whole `meta` object (key ABSENT) while the element itself (and its `iid`) is
        // kept. Project 1: issue 1 (body NULL → gate null → meta dropped) and issue 2
        // (body present → meta present).
        ctx.mockNext({ pid: 1, items: [
            { iid: 1, meta: { gate: null, assigneeId: 1 } },
            { iid: 2, meta: { gate: 'Use new tokens', assigneeId: 2 } },
        ] })
        const items = ctx.conn.subSelectUsing(tProject).from(tIssue)
            .where(tIssue.projectId.equals(tProject.id))
            .select({ iid: tIssue.id, meta: { gate: tIssue.body.asRequiredInOptionalObject(), assigneeId: tIssue.assigneeId } })
            .forUseAsInlineAggregatedArrayValue()
        const row = await ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ pid: tProject.id, items })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as pid, (select json_arrayagg(json_object('iid', id, 'meta.gate', \`body\`, 'meta.assigneeId', assignee_id)) from issue where project_id = project.id) as items from project where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            pid:   number
            items: Array<{ iid: number; meta?: { gate: string; assigneeId: number | undefined } }>
        }>>()
        const sorted = [...row.items].sort((a, b) => a.iid - b.iid)
        expect(sorted).toEqual([
            { iid: 1 },
            { iid: 2, meta: { gate: 'Use new tokens', assigneeId: 2 } },
        ])
        // The null-gate element is kept (its `iid` survives) but the nested `meta` is absent.
        expect('meta' in sorted[0]!).toBe(false)
    })

    test('inline-element-nested-rule-1-gate-object-as-nullable-surfaces-null-object', async () => {
        // The same nested rule-1 element under `projectingOptionalValuesAsNullable()`: the
        // null-gate `meta` object surfaces present-as-`null`, while `iid` stays required
        // and the inner `gate` stays required inside a present `meta`. Same project-1
        // grouping.
        ctx.mockNext({ pid: 1, items: [
            { iid: 1, meta: { gate: null, assigneeId: 1 } },
            { iid: 2, meta: { gate: 'Use new tokens', assigneeId: 2 } },
        ] })
        const items = ctx.conn.subSelectUsing(tProject).from(tIssue)
            .where(tIssue.projectId.equals(tProject.id))
            .select({ iid: tIssue.id, meta: { gate: tIssue.body.asRequiredInOptionalObject(), assigneeId: tIssue.assigneeId } })
            .projectingOptionalValuesAsNullable()
            .forUseAsInlineAggregatedArrayValue()
        const row = await ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ pid: tProject.id, items })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as pid, (select json_arrayagg(json_object('iid', id, 'meta.gate', \`body\`, 'meta.assigneeId', assignee_id)) from issue where project_id = project.id) as items from project where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            pid:   number
            items: Array<{ iid: number; meta: { gate: string; assigneeId: number | null } | null }>
        }>>()
        const sorted = [...row.items].sort((a, b) => a.iid - b.iid)
        expect(sorted).toEqual([
            { iid: 1, meta: null },
            { iid: 2, meta: { gate: 'Use new tokens', assigneeId: 2 } },
        ])
        // The null-gate `meta` is present as null, not absent.
        expect('meta' in sorted[0]!).toBe(true)
        expect(sorted[0]!.meta).toBe(null)
    })

    test('inline-element-nested-rule-2-left-join-object-default-drops-nested-on-miss', async () => {
        // A NESTED rule-2 left-join object (`iss`) inside an inline element whose top `pid`
        // is required. The nested `iss` mixes originallyRequired (`id`, `title`) with
        // optional (`body`); on a join miss it DROPS entirely (key ABSENT) while the
        // element keeps its `pid`. Org 2 groups project 3 (joins issue 4 → iss present)
        // and project 4 (left-join miss → iss dropped).
        const tIssueLeft = tIssue.forUseInLeftJoin()
        ctx.mockNext({ orgId: 2, items: [
            { pid: 3, iss: { id: 4, title: 'Document /v2/users', body: 'See ADR-014' } },
            { pid: 4, iss: { id: null, title: null, body: null } },
        ] })
        const items = ctx.conn.subSelectUsing(tOrganization).from(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.organizationId.equals(tOrganization.id))
            .select({ pid: tProject.id, iss: { id: tIssueLeft.id, title: tIssueLeft.title, body: tIssueLeft.body } })
            .forUseAsInlineAggregatedArrayValue()
        const row = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(2))
            .select({ orgId: tOrganization.id, items })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as orgId, (select json_arrayagg(json_object('pid', project.id, 'iss.id', issue.id, 'iss.title', issue.title, 'iss.body', issue.\`body\`)) from project left join issue on issue.project_id = project.id where project.organization_id = organization.id) as items from organization where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof row, {
            orgId: number
            items: Array<{ pid: number; iss?: { id: number; title: string; body: string | undefined } }>
        }>>()
        const sorted = [...row.items].sort((a, b) => a.pid - b.pid)
        expect(sorted).toEqual([
            { pid: 3, iss: { id: 4, title: 'Document /v2/users', body: 'See ADR-014' } },
            { pid: 4 },
        ])
        // Project 4's join-miss element is KEPT (its `pid` survives) but the nested `iss`
        // is ABSENT.
        expect('iss' in sorted[1]!).toBe(false)
    })

    test('inline-element-nested-rule-2-left-join-object-as-nullable-surfaces-null-object', async () => {
        // The same nested rule-2 element under `projectingOptionalValuesAsNullable()`: the
        // join-miss `iss` surfaces present-as-`null` and its optional `body` leaf becomes
        // `string | null` while the originallyRequired `id`/`title` stay non-null inside a
        // present `iss`. Same org-2 grouping.
        const tIssueLeft = tIssue.forUseInLeftJoin()
        ctx.mockNext({ orgId: 2, items: [
            { pid: 3, iss: { id: 4, title: 'Document /v2/users', body: 'See ADR-014' } },
            { pid: 4, iss: { id: null, title: null, body: null } },
        ] })
        const items = ctx.conn.subSelectUsing(tOrganization).from(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.organizationId.equals(tOrganization.id))
            .select({ pid: tProject.id, iss: { id: tIssueLeft.id, title: tIssueLeft.title, body: tIssueLeft.body } })
            .projectingOptionalValuesAsNullable()
            .forUseAsInlineAggregatedArrayValue()
        const row = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(2))
            .select({ orgId: tOrganization.id, items })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as orgId, (select json_arrayagg(json_object('pid', project.id, 'iss.id', issue.id, 'iss.title', issue.title, 'iss.body', issue.\`body\`)) from project left join issue on issue.project_id = project.id where project.organization_id = organization.id) as items from organization where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof row, {
            orgId: number
            items: Array<{ pid: number; iss: { id: number; title: string; body: string | null } | null }>
        }>>()
        const sorted = [...row.items].sort((a, b) => a.pid - b.pid)
        expect(sorted).toEqual([
            { pid: 3, iss: { id: 4, title: 'Document /v2/users', body: 'See ADR-014' } },
            { pid: 4, iss: null },
        ])
        // Project 4's join-miss `iss` is PRESENT as null.
        expect('iss' in sorted[1]!).toBe(true)
        expect(sorted[1]!.iss).toBe(null)
    })

    test('inline-element-sole-optional-inner-object-collapses-default', async () => {
        // A sole-optional-inner container (`wrapper` has the single member `inner`, an
        // all-optional object) inside an inline element whose top `iid` is required. The
        // container recursively inherits its sole member's optionality, so `wrapper`
        // collapses (key ABSENT) when the inner's every leaf is null. Org 1 groups its
        // issues: issue 1 (body null, assignee 1 → inner present with only assigneeId),
        // issue 2 (both present), issue 3 (body + assignee null → inner collapses →
        // wrapper dropped).
        ctx.mockNext({ orgId: 1, items: [
            { iid: 1, wrapper: { inner: { body: null, assigneeId: 1 } } },
            { iid: 2, wrapper: { inner: { body: 'Use new tokens', assigneeId: 2 } } },
            { iid: 3, wrapper: { inner: { body: null, assigneeId: null } } },
        ] })
        const items = ctx.conn.subSelectUsing(tOrganization).from(tProject)
            .innerJoin(tIssue).on(tIssue.projectId.equals(tProject.id))
            .where(tProject.organizationId.equals(tOrganization.id))
            .select({ iid: tIssue.id, wrapper: { inner: { body: tIssue.body, assigneeId: tIssue.assigneeId } } })
            .forUseAsInlineAggregatedArrayValue()
        const row = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .select({ orgId: tOrganization.id, items })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as orgId, (select json_arrayagg(json_object('iid', issue.id, 'wrapper.inner.body', issue.\`body\`, 'wrapper.inner.assigneeId', issue.assignee_id)) from project inner join issue on issue.project_id = project.id where project.organization_id = organization.id) as items from organization where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            orgId: number
            items: Array<{ iid: number; wrapper?: { inner: { body: string | undefined; assigneeId: number | undefined } | undefined } }>
        }>>()
        const sorted = [...row.items].sort((a, b) => a.iid - b.iid)
        expect(sorted).toEqual([
            { iid: 1, wrapper: { inner: { assigneeId: 1 } } },
            { iid: 2, wrapper: { inner: { body: 'Use new tokens', assigneeId: 2 } } },
            { iid: 3 },
        ])
        // Issue 3's inner collapsed → `wrapper` is ABSENT (the element is kept via `iid`).
        expect('wrapper' in sorted[2]!).toBe(false)
    })

    test('inline-element-sole-optional-inner-object-collapses-as-nullable', async () => {
        // The same sole-optional-inner element under `projectingOptionalValuesAsNullable()`:
        // `wrapper` becomes `{...} | null`, the inner `{...} | null`, and its leaves flip
        // to `| null`. Issue 3's all-null inner collapses the whole `wrapper` to null (not
        // absent). Same org-1 grouping.
        ctx.mockNext({ orgId: 1, items: [
            { iid: 1, wrapper: { inner: { body: null, assigneeId: 1 } } },
            { iid: 2, wrapper: { inner: { body: 'Use new tokens', assigneeId: 2 } } },
            { iid: 3, wrapper: { inner: { body: null, assigneeId: null } } },
        ] })
        const items = ctx.conn.subSelectUsing(tOrganization).from(tProject)
            .innerJoin(tIssue).on(tIssue.projectId.equals(tProject.id))
            .where(tProject.organizationId.equals(tOrganization.id))
            .select({ iid: tIssue.id, wrapper: { inner: { body: tIssue.body, assigneeId: tIssue.assigneeId } } })
            .projectingOptionalValuesAsNullable()
            .forUseAsInlineAggregatedArrayValue()
        const row = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .select({ orgId: tOrganization.id, items })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as orgId, (select json_arrayagg(json_object('iid', issue.id, 'wrapper.inner.body', issue.\`body\`, 'wrapper.inner.assigneeId', issue.assignee_id)) from project inner join issue on issue.project_id = project.id where project.organization_id = organization.id) as items from organization where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            orgId: number
            items: Array<{ iid: number; wrapper: { inner: { body: string | null; assigneeId: number | null } | null } | null }>
        }>>()
        const sorted = [...row.items].sort((a, b) => a.iid - b.iid)
        expect(sorted).toEqual([
            { iid: 1, wrapper: { inner: { body: null, assigneeId: 1 } } },
            { iid: 2, wrapper: { inner: { body: 'Use new tokens', assigneeId: 2 } } },
            { iid: 3, wrapper: null },
        ])
        // Issue 3's collapsed `wrapper` is PRESENT as null.
        expect(sorted[2]!.wrapper).toBe(null)
    })

    test('inline-element-own-table-multi-optional-leaf-as-nullable-surfaces-null', async () => {
        // The multi-optional-leaf twin of the single-leaf inline rule-3 nullable case: an
        // own-table element with a required `title` plus TWO optional leaves (`body`,
        // `assigneeId`), under `projectingOptionalValuesAsNullable()`. Both optional leaves
        // surface present-as-null. Project 1: issue 1 (body NULL → present null) and
        // issue 2 (body present); both have an assignee.
        ctx.mockNext({ pid: 1, items: [
            { title: 'Update hero copy', body: null, assigneeId: 1 },
            { title: 'Redesign navbar', body: 'Use new tokens', assigneeId: 2 },
        ] })
        const items = ctx.conn.subSelectUsing(tProject).from(tIssue)
            .where(tIssue.projectId.equals(tProject.id))
            .select({ title: tIssue.title, body: tIssue.body, assigneeId: tIssue.assigneeId })
            .projectingOptionalValuesAsNullable()
            .forUseAsInlineAggregatedArrayValue()
        const row = await ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ pid: tProject.id, items })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as pid, (select json_arrayagg(json_object('title', title, 'body', \`body\`, 'assigneeId', assignee_id)) from issue where project_id = project.id) as items from project where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            pid:   number
            items: Array<{ title: string; body: string | null; assigneeId: number | null }>
        }>>()
        const sorted = [...row.items].sort((a, b) => a.title.localeCompare(b.title))
        expect(sorted).toEqual([
            { title: 'Redesign navbar', body: 'Use new tokens', assigneeId: 2 },
            { title: 'Update hero copy', body: null, assigneeId: 1 },
        ])
        // Issue 1's null body is PRESENT as null (not absent).
        const issue1 = row.items.find(i => i.title === 'Update hero copy')!
        expect('body' in issue1).toBe(true)
        expect(issue1.body).toBe(null)
    })
})
