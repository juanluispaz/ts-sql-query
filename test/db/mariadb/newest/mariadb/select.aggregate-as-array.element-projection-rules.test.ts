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
import { tIssue, tProject } from '../../domain/connection.js'
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
})
