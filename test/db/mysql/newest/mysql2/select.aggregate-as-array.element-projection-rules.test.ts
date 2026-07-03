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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as pid, json_arrayagg(json_object('title', title, 'body', body)) as issues from issue where project_id = ? group by project_id"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as pid, json_arrayagg(json_object('title', title, 'meta.gate', \`status\`, 'meta.assigneeId', assignee_id)) as issues from issue where project_id = ? group by project_id"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as pid, json_arrayagg(json_object('title', title, 'meta.gate', \`status\`, 'meta.assigneeId', assignee_id)) as issues from issue where project_id = ? group by project_id"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as pid, json_arrayagg(json_object('title', title, 'body', body)) as issues from issue where project_id = ? group by project_id"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.project_id as grp, json_arrayagg(json_object('iid', issue.id, 'proj.id', project.id, 'proj.name', project.\`name\`, 'proj.archivedAt', project.archived_at)) as items from issue left join project on project.id = issue.project_id where issue.project_id = ? group by issue.project_id"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.project_id as grp, json_arrayagg(json_object('iid', issue.id, 'proj.id', project.id, 'proj.name', project.\`name\`, 'proj.archivedAt', project.archived_at)) as items from issue left join project on project.id = issue.project_id where issue.project_id = ? group by issue.project_id"`)
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
})
