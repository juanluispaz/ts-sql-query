// A COMPOUND query (UNION / UNION ALL) whose arms re-project a NESTED OBJECT
// that is optional / left-join / rule-1 (requiredInOptionalObject) / rule-4
// (all-optional). The existing compound coverage re-projects flat columns or a
// REQUIRED nested object; the distinct path here is the compound carrying the
// optionality of a nested object through to the merged result.
//
// - a UNION of two left-join arms → the nested object stays optional (`proj?`).
// - a UNION ALL of two rule-4 (all-optional) arms → the object is dropped only
//   when every leaf is null.
// - a UNION of two rule-1 (requiredInOptionalObject) arms → the object stays
//   optional, its requiredInOptionalObject leaf required-when-present.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('union-of-left-join-arms-keeps-the-nested-object-optional', async () => {
        // Each arm left-joins the project and projects a `proj` object built from
        // the left-joined leaves, so the object is optional (rule-2). The compound
        // re-projects it unchanged: the merged result keeps `proj?`. Arm 1 = issue
        // 1 (project 1), arm 2 = issue 2 (project 1); both joins hit.
        const expected = [
            { iid: 1, proj: { id: 1, name: 'Marketing site' } },
            { iid: 2, proj: { id: 1, name: 'Marketing site' } },
        ]
        ctx.mockNext([
            { iid: 1, 'proj.id': 1, 'proj.name': 'Marketing site' },
            { iid: 2, 'proj.id': 1, 'proj.name': 'Marketing site' },
        ])
        const tProjLeft = tProject.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tProjLeft).on(tProjLeft.id.equals(tIssue.projectId))
            .where(tIssue.id.equals(1))
            .select({ iid: tIssue.id, proj: { id: tProjLeft.id, name: tProjLeft.name } })
            .union(
                ctx.conn.selectFrom(tIssue)
                    .leftJoin(tProjLeft).on(tProjLeft.id.equals(tIssue.projectId))
                    .where(tIssue.id.equals(2))
                    .select({ iid: tIssue.id, proj: { id: tProjLeft.id, name: tProjLeft.name } }),
            )
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, project.id as [proj.id], project.name as [proj.name] from issue left join project on project.id = issue.project_id where issue.id = @0 union select issue.id as iid, project.id as [proj.id], project.name as [proj.name] from issue left join project on project.id = issue.project_id where issue.id = @1 order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid:   number
            proj?: { id: number; name: string }
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('union-all-of-rule-4-all-optional-arms-drops-object-when-every-leaf-is-null', async () => {
        // Each arm projects an all-optional nested `opt` object (rule-4): the
        // object is optional and dropped when every leaf is null. UNION ALL keeps
        // both rows. Arm 1 = issue 1 (body NULL, assignee 1) → opt present with
        // assigneeId only. Arm 2 = issue 3 (body NULL, assignee NULL) → opt
        // dropped entirely.
        const expected = [
            { iid: 1, opt: { assigneeId: 1 } },
            { iid: 3 },
        ]
        ctx.mockNext([
            { iid: 1, 'opt.body': null, 'opt.assigneeId': 1 },
            { iid: 3, 'opt.body': null, 'opt.assigneeId': null },
        ])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({ iid: tIssue.id, opt: { body: tIssue.body, assigneeId: tIssue.assigneeId } })
            .unionAll(
                ctx.conn.selectFrom(tIssue)
                    .where(tIssue.id.equals(3))
                    .select({ iid: tIssue.id, opt: { body: tIssue.body, assigneeId: tIssue.assigneeId } }),
            )
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, body as [opt.body], assignee_id as [opt.assigneeId] from issue where id = @0 union all select id as iid, body as [opt.body], assignee_id as [opt.assigneeId] from issue where id = @1 order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            3,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid:  number
            opt?: { body: string | undefined; assigneeId: number | undefined }
        }>>>()
        expect(rows).toEqual(expected)
        // Arm 2 (issue 3) has every leaf null, so the optional `opt` object is
        // dropped entirely — the key must be ABSENT, not present-as-undefined.
        expect('opt' in rows[1]!).toBe(false)
    })

    test('union-all-of-rule-4-all-optional-arms-under-projecting-optional-values-as-nullable', async () => {
        // The rule-4 UNION ALL above under `projectingOptionalValuesAsNullable()`:
        // the compound carries the all-optional `opt` object through as `{...} | null`
        // with its leaves flipped to `| null`. Arm 2 (issue 3, every leaf null)
        // surfaces as `opt: null` (present-key/null) instead of being dropped; arm 1
        // (issue 1, body null, assignee 1) keeps a present `opt` with `body: null`.
        // This is the null-vs-absent value distinction the asUndefined sibling cannot
        // stand in for.
        ctx.mockNext([
            { iid: 1, 'opt.body': null, 'opt.assigneeId': 1 },
            { iid: 3, 'opt.body': null, 'opt.assigneeId': null },
        ])
        const expected = [
            { iid: 1, opt: { body: null, assigneeId: 1 } },
            { iid: 3, opt: null },
        ]
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({ iid: tIssue.id, opt: { body: tIssue.body, assigneeId: tIssue.assigneeId } })
            .unionAll(
                ctx.conn.selectFrom(tIssue)
                    .where(tIssue.id.equals(3))
                    .select({ iid: tIssue.id, opt: { body: tIssue.body, assigneeId: tIssue.assigneeId } }),
            )
            .projectingOptionalValuesAsNullable()
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, body as [opt.body], assignee_id as [opt.assigneeId] from issue where id = @0 union all select id as iid, body as [opt.body], assignee_id as [opt.assigneeId] from issue where id = @1 order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            3,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid: number
            opt: { body: string | null; assigneeId: number | null } | null
        }>>>()
        expect(rows).toEqual(expected)
        // Arm 2 (issue 3) has every leaf null, so the `opt` object is PRESENT-`null`
        // under the asNull projector, not absent.
        expect('opt' in rows[1]!).toBe(true)
        expect(rows[1]!.opt).toBeNull()
    })

    test('union-of-rule-1-required-in-optional-object-arms-stays-optional', async () => {
        // Each arm projects a rule-1 nested `meta` object made optional by its
        // `requiredInOptionalObject` leaf (`gate`, status). The compound keeps the
        // object optional, with `gate` required-when-present and the plain-optional
        // `assigneeId` sibling `| undefined`. Arm 1 = issue 1, arm 2 = issue 2;
        // both have a status, so `meta` is present.
        const expected = [
            { iid: 1, meta: { gate: 'open', assigneeId: 1 } },
            { iid: 2, meta: { gate: 'in_progress', assigneeId: 2 } },
        ]
        ctx.mockNext([
            { iid: 1, 'meta.gate': 'open', 'meta.assigneeId': 1 },
            { iid: 2, 'meta.gate': 'in_progress', 'meta.assigneeId': 2 },
        ])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                iid:  tIssue.id,
                meta: { gate: tIssue.status.asRequiredInOptionalObject(), assigneeId: tIssue.assigneeId },
            })
            .union(
                ctx.conn.selectFrom(tIssue)
                    .where(tIssue.id.equals(2))
                    .select({
                        iid:  tIssue.id,
                        meta: { gate: tIssue.status.asRequiredInOptionalObject(), assigneeId: tIssue.assigneeId },
                    }),
            )
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, status as [meta.gate], assignee_id as [meta.assigneeId] from issue where id = @0 union select id as iid, status as [meta.gate], assignee_id as [meta.assigneeId] from issue where id = @1 order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid:   number
            meta?: { gate: string; assigneeId: number | undefined }
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('union-of-rule-1-required-in-optional-object-arms-under-projecting-optional-values-as-nullable', async () => {
        // The rule-1 UNION above under `projectingOptionalValuesAsNullable()`: the
        // compound carries the `meta` object through as `{...} | null`, its
        // `requiredInOptionalObject` `gate` (status, a required column) stays required
        // and keeps the object present, and the plain-optional `assigneeId` flips to
        // `number | null`. Arm 2 uses issue 3 (assignee NULL) so `assigneeId` surfaces
        // as present-`null` (not absent); arm 1 = issue 1 (assignee 1). Both statuses
        // are present, so `meta` itself never collapses here.
        ctx.mockNext([
            { iid: 1, 'meta.gate': 'open', 'meta.assigneeId': 1 },
            { iid: 3, 'meta.gate': 'open', 'meta.assigneeId': null },
        ])
        const expected = [
            { iid: 1, meta: { gate: 'open', assigneeId: 1 } },
            { iid: 3, meta: { gate: 'open', assigneeId: null } },
        ]
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                iid:  tIssue.id,
                meta: { gate: tIssue.status.asRequiredInOptionalObject(), assigneeId: tIssue.assigneeId },
            })
            .union(
                ctx.conn.selectFrom(tIssue)
                    .where(tIssue.id.equals(3))
                    .select({
                        iid:  tIssue.id,
                        meta: { gate: tIssue.status.asRequiredInOptionalObject(), assigneeId: tIssue.assigneeId },
                    }),
            )
            .projectingOptionalValuesAsNullable()
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, status as [meta.gate], assignee_id as [meta.assigneeId] from issue where id = @0 union select id as iid, status as [meta.gate], assignee_id as [meta.assigneeId] from issue where id = @1 order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            3,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid:  number
            meta: { gate: string; assigneeId: number | null } | null
        }>>>()
        expect(rows).toEqual(expected)
        // Arm 2 (issue 3) has a null assignee; under the asNull projector
        // `assigneeId` is PRESENT-`null` inside the (present) `meta` object, not absent.
        expect('assigneeId' in rows[1]!.meta!).toBe(true)
        expect(rows[1]!.meta!.assigneeId).toBeNull()
    })

    test('union-all-of-aggregate-as-array-arms-merges-array-typed-columns', async () => {
        // Each arm carries an aggregate-as-array column (`projects`), grouped over a
        // LEFT JOIN of the organization's projects. The compound re-projector must
        // MERGE the array-typed column from both arms — the distinct path from the
        // flat/scalar merges the other compound tests exercise. UNION ALL (not UNION)
        // is used because the arms carry an array/JSON-typed column that some engines
        // cannot de-duplicate (no equality operator for the aggregate type); the two
        // arms select disjoint orgs, so no dedup is needed anyway. Arm 1 = org 1
        // (projects 1,2), arm 2 = org 2 (projects 3,4). JSON aggregate order is not
        // guaranteed, so each row's inner array is sorted by id before comparing;
        // mocks are primed with the RAW aggregated rows.
        const tProjectLeft = tProject.forUseInLeftJoin()
        const expected = [
            { orgId: 1, projects: [
                { id: 1, name: 'Marketing site' },
                { id: 2, name: 'Internal tools' },
            ] },
            { orgId: 2, projects: [
                { id: 3, name: 'Public API' },
                { id: 4, name: 'Legacy app' },
            ] },
        ]
        ctx.mockNext([
            { orgId: 1, projects: [
                { id: 1, name: 'Marketing site' },
                { id: 2, name: 'Internal tools' },
            ] },
            { orgId: 2, projects: [
                { id: 3, name: 'Public API' },
                { id: 4, name: 'Legacy app' },
            ] },
        ])
        const rows = await ctx.conn.selectFrom(tOrganization)
            .leftJoin(tProjectLeft).on(tProjectLeft.organizationId.equals(tOrganization.id))
            .where(tOrganization.id.equals(1))
            .select({
                orgId:    tOrganization.id,
                projects: ctx.conn.aggregateAsArray({ id: tProjectLeft.id, name: tProjectLeft.name }),
            })
            .groupBy('orgId')
            .unionAll(
                ctx.conn.selectFrom(tOrganization)
                    .leftJoin(tProjectLeft).on(tProjectLeft.organizationId.equals(tOrganization.id))
                    .where(tOrganization.id.equals(2))
                    .select({
                        orgId:    tOrganization.id,
                        projects: ctx.conn.aggregateAsArray({ id: tProjectLeft.id, name: tProjectLeft.name }),
                    })
                    .groupBy('orgId'),
            )
            .orderBy('orgId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization.id as orgId, json_arrayagg(json_object('id':project.id, 'name':project.name)) as projects from organization left join project on project.organization_id = organization.id where organization.id = @0 group by organization.id union all select organization.id as orgId, json_arrayagg(json_object('id':project.id, 'name':project.name)) as projects from organization left join project on project.organization_id = organization.id where organization.id = @1 group by organization.id order by orgId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            orgId:    number
            projects: Array<{ id: number; name: string }>
        }>>>()
        const sorted = rows.map(r => ({ ...r, projects: [...r.projects].sort((a, b) => a.id - b.id) }))
        expect(sorted).toEqual(expected)
    })

    test('union-of-rule-3-required-object-with-optional-leaf-under-projecting-optional-values-as-nullable', async () => {
        // Each arm projects a rule-3 nested `detail` object: a REQUIRED leaf (`title`)
        // keeps the object required, plus an OPTIONAL `body` leaf. Under
        // `projectingOptionalValuesAsNullable()` the object stays required (never
        // `| null`) while `body` flips to `| null`. Arm 1 = issue 1 (body null ->
        // present-`null`); arm 2 = issue 2 (body 'Use new tokens').
        ctx.mockNext([
            { iid: 1, 'detail.title': 'Update hero copy', 'detail.body': null },
            { iid: 2, 'detail.title': 'Redesign navbar', 'detail.body': 'Use new tokens' },
        ])
        const expected = [
            { iid: 1, detail: { title: 'Update hero copy', body: null } },
            { iid: 2, detail: { title: 'Redesign navbar', body: 'Use new tokens' } },
        ]
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({ iid: tIssue.id, detail: { title: tIssue.title, body: tIssue.body } })
            .union(
                ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(2))
                    .select({ iid: tIssue.id, detail: { title: tIssue.title, body: tIssue.body } }),
            )
            .projectingOptionalValuesAsNullable()
            .orderBy('iid')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, title as [detail.title], body as [detail.body] from issue where id = @0 union select id as iid, title as [detail.title], body as [detail.body] from issue where id = @1 order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
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

    test('union-of-depth-3-nested-objects-recurses-through-columns-for-with-view', async () => {
        // Each arm projects a depth-3 nested object `{ outer: { mid: { title, num } } }`
        // of REQUIRED leaves; the compound merges them level by level. Every leaf
        // required -> every level required.
        const expected = [
            { iid: 1, outer: { mid: { title: 'Update hero copy', num: 1 } } },
            { iid: 2, outer: { mid: { title: 'Redesign navbar', num: 2 } } },
        ]
        ctx.mockNext([
            { iid: 1, 'outer.mid.title': 'Update hero copy', 'outer.mid.num': 1 },
            { iid: 2, 'outer.mid.title': 'Redesign navbar', 'outer.mid.num': 2 },
        ])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({ iid: tIssue.id, outer: { mid: { title: tIssue.title, num: tIssue.number } } })
            .union(
                ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(2))
                    .select({ iid: tIssue.id, outer: { mid: { title: tIssue.title, num: tIssue.number } } }),
            )
            .orderBy('iid')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, title as [outer.mid.title], number as [outer.mid.num] from issue where id = @0 union select id as iid, title as [outer.mid.title], number as [outer.mid.num] from issue where id = @1 order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid: number
            outer: { mid: { title: string; num: number } }
        }>>>()
        expect(rows).toEqual(expected)
    })
    // Missing twins of the compound nested-object paths: the DEFAULT rule-3 (the
    // existing one is nullable-only), a NULLABLE depth-3, a NULLABLE left-join
    // object, the unionAll before-op variants of the left-join and rule-1 defaults,
    // and — the R40/R41-sensitive case — a UNION ALL of aggregate arms whose element
    // carries an OPTIONAL leaf under projectingOptionalValuesAsNullable().

    test('union-of-rule-3-required-object-with-optional-leaf-default', async () => {
        // The DEFAULT-projector twin of the rule-3 nullable compound test above: each
        // arm projects a `detail` object with a REQUIRED leaf (`title`, keeping the
        // object required) plus an OPTIONAL `body` leaf. Under the default projector a
        // null `body` is DROPPED (absent). Arm 1 = issue 1 (body null → absent), arm 2
        // = issue 2 ('Use new tokens').
        ctx.mockNext([
            { iid: 1, 'detail.title': 'Update hero copy', 'detail.body': null },
            { iid: 2, 'detail.title': 'Redesign navbar',  'detail.body': 'Use new tokens' },
        ])
        const expected = [
            { iid: 1, detail: { title: 'Update hero copy' } },
            { iid: 2, detail: { title: 'Redesign navbar', body: 'Use new tokens' } },
        ]
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({ iid: tIssue.id, detail: { title: tIssue.title, body: tIssue.body } })
            .union(
                ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(2))
                    .select({ iid: tIssue.id, detail: { title: tIssue.title, body: tIssue.body } }),
            )
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, title as [detail.title], body as [detail.body] from issue where id = @0 union select id as iid, title as [detail.title], body as [detail.body] from issue where id = @1 order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid: number
            detail: { title: string; body?: string }
        }>>>()
        expect(rows).toEqual(expected)
        // Arm 1's null body is DROPPED under the default projector.
        expect('body' in rows[0]!.detail).toBe(false)
    })

    test('union-of-depth-3-nested-object-projecting-optional-values-as-nullable', async () => {
        // The nullable twin of the depth-3 compound test above: each arm projects
        // `outer.mid.{num,body}` mixing a required leaf (`num`, keeps every level
        // required) with an optional `body`. Under projectingOptionalValuesAsNullable()
        // `body` flips to `string | null`. Arm 1 = issue 1 (body null → present-null),
        // arm 2 = issue 2 ('Use new tokens').
        const expected = [
            { iid: 1, outer: { mid: { num: 1, body: null } } },
            { iid: 2, outer: { mid: { num: 2, body: 'Use new tokens' } } },
        ]
        ctx.mockNext([
            { iid: 1, 'outer.mid.num': 1, 'outer.mid.body': null },
            { iid: 2, 'outer.mid.num': 2, 'outer.mid.body': 'Use new tokens' },
        ])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({ iid: tIssue.id, outer: { mid: { num: tIssue.number, body: tIssue.body } } })
            .union(
                ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(2))
                    .select({ iid: tIssue.id, outer: { mid: { num: tIssue.number, body: tIssue.body } } }),
            )
            .projectingOptionalValuesAsNullable()
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, number as [outer.mid.num], body as [outer.mid.body] from issue where id = @0 union select id as iid, number as [outer.mid.num], body as [outer.mid.body] from issue where id = @1 order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid: number
            outer: { mid: { num: number; body: string | null } }
        }>>>()
        expect(rows).toEqual(expected)
        // Arm 1's null body is PRESENT-null at the bottom of the depth-3 object.
        expect(rows[0]!.outer.mid.body).toBeNull()
    })

    test('union-of-left-join-arms-nested-object-projecting-optional-values-as-nullable', async () => {
        // The nullable twin of the union-of-left-join test above: each arm left-joins
        // the project and projects a `proj` object with originally-required leaves
        // (`id`, `name`) plus an OPTIONAL `archivedAt`. Under
        // projectingOptionalValuesAsNullable() the object becomes `{...} | null` (null
        // only on a join miss) and `archivedAt` flips to `Date | null`. Arm 1 = issue 1,
        // arm 2 = issue 2; both join project 1 (archived_at NULL → archivedAt null).
        const expected = [
            { iid: 1, proj: { id: 1, name: 'Marketing site', archivedAt: null } },
            { iid: 2, proj: { id: 1, name: 'Marketing site', archivedAt: null } },
        ]
        ctx.mockNext([
            { iid: 1, 'proj.id': 1, 'proj.name': 'Marketing site', 'proj.archivedAt': null },
            { iid: 2, 'proj.id': 1, 'proj.name': 'Marketing site', 'proj.archivedAt': null },
        ])
        const tProjLeft = tProject.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tProjLeft).on(tProjLeft.id.equals(tIssue.projectId))
            .where(tIssue.id.equals(1))
            .select({ iid: tIssue.id, proj: { id: tProjLeft.id, name: tProjLeft.name, archivedAt: tProjLeft.archivedAt } })
            .union(
                ctx.conn.selectFrom(tIssue)
                    .leftJoin(tProjLeft).on(tProjLeft.id.equals(tIssue.projectId))
                    .where(tIssue.id.equals(2))
                    .select({ iid: tIssue.id, proj: { id: tProjLeft.id, name: tProjLeft.name, archivedAt: tProjLeft.archivedAt } }),
            )
            .projectingOptionalValuesAsNullable()
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, project.id as [proj.id], project.name as [proj.name], project.archived_at as [proj.archivedAt] from issue left join project on project.id = issue.project_id where issue.id = @0 union select issue.id as iid, project.id as [proj.id], project.name as [proj.name], project.archived_at as [proj.archivedAt] from issue left join project on project.id = issue.project_id where issue.id = @1 order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid:  number
            proj: { id: number; name: string; archivedAt: Date | null } | null
        }>>>()
        expect(rows).toEqual(expected)
        // Both arms hit → proj present; its null archivedAt is PRESENT-null.
        expect(rows[0]!.proj!.archivedAt).toBeNull()
    })

    test('union-all-of-left-join-arms-keeps-the-nested-object-optional-default', async () => {
        // The unionAll before-op DEFAULT twin of the union-of-left-join test: each arm
        // left-joins the project and projects an optional `proj` object (rule-2) with
        // originally-required `id`/`name` and an optional `archivedAt`. UNION ALL keeps
        // both rows; the default projector drops the null `archivedAt`. Arm 1 = issue 1,
        // arm 2 = issue 2; both join project 1.
        const expected = [
            { iid: 1, proj: { id: 1, name: 'Marketing site' } },
            { iid: 2, proj: { id: 1, name: 'Marketing site' } },
        ]
        ctx.mockNext([
            { iid: 1, 'proj.id': 1, 'proj.name': 'Marketing site', 'proj.archivedAt': null },
            { iid: 2, 'proj.id': 1, 'proj.name': 'Marketing site', 'proj.archivedAt': null },
        ])
        const tProjLeft = tProject.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tProjLeft).on(tProjLeft.id.equals(tIssue.projectId))
            .where(tIssue.id.equals(1))
            .select({ iid: tIssue.id, proj: { id: tProjLeft.id, name: tProjLeft.name, archivedAt: tProjLeft.archivedAt } })
            .unionAll(
                ctx.conn.selectFrom(tIssue)
                    .leftJoin(tProjLeft).on(tProjLeft.id.equals(tIssue.projectId))
                    .where(tIssue.id.equals(2))
                    .select({ iid: tIssue.id, proj: { id: tProjLeft.id, name: tProjLeft.name, archivedAt: tProjLeft.archivedAt } }),
            )
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, project.id as [proj.id], project.name as [proj.name], project.archived_at as [proj.archivedAt] from issue left join project on project.id = issue.project_id where issue.id = @0 union all select issue.id as iid, project.id as [proj.id], project.name as [proj.name], project.archived_at as [proj.archivedAt] from issue left join project on project.id = issue.project_id where issue.id = @1 order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid:   number
            proj?: { id: number; name: string; archivedAt: Date | undefined }
        }>>>()
        expect(rows).toEqual(expected)
        // Both arms hit → proj present; its null archivedAt is DROPPED under default.
        expect('archivedAt' in rows[0]!.proj!).toBe(false)
    })

    test('union-all-of-rule-1-required-in-optional-object-arms-default', async () => {
        // The unionAll before-op DEFAULT twin of the union-of-rule-1 test: each arm
        // projects a rule-1 `meta` object made optional by its requiredInOptionalObject
        // gate (`gate`, status), plus an optional `assigneeId`. UNION ALL keeps both
        // rows; `gate` stays required-when-present, `assigneeId` is `| undefined`. Arm 1
        // = issue 1, arm 2 = issue 2; both have a status.
        const expected = [
            { iid: 1, meta: { gate: 'open', assigneeId: 1 } },
            { iid: 2, meta: { gate: 'in_progress', assigneeId: 2 } },
        ]
        ctx.mockNext([
            { iid: 1, 'meta.gate': 'open', 'meta.assigneeId': 1 },
            { iid: 2, 'meta.gate': 'in_progress', 'meta.assigneeId': 2 },
        ])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                iid:  tIssue.id,
                meta: { gate: tIssue.status.asRequiredInOptionalObject(), assigneeId: tIssue.assigneeId },
            })
            .unionAll(
                ctx.conn.selectFrom(tIssue)
                    .where(tIssue.id.equals(2))
                    .select({
                        iid:  tIssue.id,
                        meta: { gate: tIssue.status.asRequiredInOptionalObject(), assigneeId: tIssue.assigneeId },
                    }),
            )
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, status as [meta.gate], assignee_id as [meta.assigneeId] from issue where id = @0 union all select id as iid, status as [meta.gate], assignee_id as [meta.assigneeId] from issue where id = @1 order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid:   number
            meta?: { gate: string; assigneeId: number | undefined }
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('union-all-of-aggregate-as-array-arms-projecting-optional-values-as-nullable', async () => {
        // Each UNION ALL arm carries an aggregate-as-array column whose element has an
        // OPTIONAL leaf (`archivedAt`) and its own projectingOptionalValuesAsNullable()
        // flag. The flag rides through the compound: a null `archivedAt` surfaces as
        // PRESENT-null (`archivedAt: Date | null`), exactly as a standalone such aggregate
        // does — the compound re-projection carries the aggregate's own element nullable
        // flag into the merged result, so the type and the runtime agree.
        //
        // Arm 1 = org 1 (projects 1, 2 — archived_at NULL), arm 2 = org 2 (projects 3
        // NULL, 4 archived). The mock is primed with the RAW aggregated arrays (each
        // element carrying archivedAt: null / a Date); the projection keeps the null
        // leaves present-null.
        const tProjectLeft = tProject.forUseInLeftJoin()
        const archivedDate = new Date('2024-02-01T00:00:00.000Z')
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
        const rows = await ctx.conn.selectFrom(tOrganization)
            .leftJoin(tProjectLeft).on(tProjectLeft.organizationId.equals(tOrganization.id))
            .where(tOrganization.id.equals(1))
            .select({
                orgId:    tOrganization.id,
                projects: ctx.conn.aggregateAsArray({ id: tProjectLeft.id, name: tProjectLeft.name, archivedAt: tProjectLeft.archivedAt })
                    .projectingOptionalValuesAsNullable(),
            })
            .groupBy('orgId')
            .unionAll(
                ctx.conn.selectFrom(tOrganization)
                    .leftJoin(tProjectLeft).on(tProjectLeft.organizationId.equals(tOrganization.id))
                    .where(tOrganization.id.equals(2))
                    .select({
                        orgId:    tOrganization.id,
                        projects: ctx.conn.aggregateAsArray({ id: tProjectLeft.id, name: tProjectLeft.name, archivedAt: tProjectLeft.archivedAt })
                            .projectingOptionalValuesAsNullable(),
                    })
                    .groupBy('orgId'),
            )
            .orderBy('orgId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization.id as orgId, json_arrayagg(json_object('id':project.id, 'name':project.name, 'archivedAt':project.archived_at)) as projects from organization left join project on project.organization_id = organization.id where organization.id = @0 group by organization.id union all select organization.id as orgId, json_arrayagg(json_object('id':project.id, 'name':project.name, 'archivedAt':project.archived_at)) as projects from organization left join project on project.organization_id = organization.id where organization.id = @1 group by organization.id order by orgId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        // assertType is ground truth: the TYPE claims `archivedAt: Date | null` (present).
        assertType<Exact<typeof rows, Array<{
            orgId:    number
            projects: Array<{ id: number; name: string; archivedAt: Date | null }>
        }>>>()
        const sorted = rows.map(r => ({ ...r, projects: [...r.projects].sort((a, b) => a.id - b.id) }))
        if (!ctx.realDbEnabled) {
            expect(sorted).toEqual(expected)
        } else {
            // Real DB: the null `archivedAt` leaves stay PRESENT-null; project 4's
            // archived_at is a seed-set timestamp (dynamic value) so only its presence
            // and Date type are asserted.
            expect(sorted[0]!.projects).toEqual([
                { id: 1, name: 'Marketing site', archivedAt: null },
                { id: 2, name: 'Internal tools', archivedAt: null },
            ])
            expect(sorted[1]!.projects.find(p => p.id === 3)).toEqual({ id: 3, name: 'Public API', archivedAt: null })
            expect(sorted[1]!.projects.find(p => p.id === 4)!.archivedAt instanceof Date).toBe(true)
        }
        // The null `archivedAt` leaf stays PRESENT-null under UNION ALL, matching the
        // type and a standalone nullable aggregate.
        const proj1 = sorted[0]!.projects.find(p => p.id === 1)!
        expect('archivedAt' in proj1).toBe(true)
        const proj3 = sorted[1]!.projects.find(p => p.id === 3)!
        expect('archivedAt' in proj3).toBe(true)
    })
    // The rule-3 nested-object default test above is pinned on `union`. These mirror it
    // to the remaining compound ops (intersect / intersectAll / except / exceptAll /
    // minus / minusAll): each arm projects a `detail` object with a REQUIRED leaf
    // (`title`, keeping the object required) plus an OPTIONAL `body` leaf. Under the
    // default projector a null `body` is DROPPED (absent). Arms reuse the id predicates
    // of the compound-optional before-op siblings so each op yields a deterministic,
    // non-empty result (issue 1, body null → detail.body absent).

    test('intersect-of-rule-3-required-object-with-optional-leaf-default', async () => {
        ctx.mockNext([
            { iid: 1, 'detail.title': 'Update hero copy', 'detail.body': null },
        ])
        const expected = [
            { iid: 1, detail: { title: 'Update hero copy' } },
        ]
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.in([1, 2]))
            .select({ iid: tIssue.id, detail: { title: tIssue.title, body: tIssue.body } })
            .intersect(
                ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(1))
                    .select({ iid: tIssue.id, detail: { title: tIssue.title, body: tIssue.body } }),
            )
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, title as [detail.title], body as [detail.body] from issue where id in (@0, @1) intersect select id as iid, title as [detail.title], body as [detail.body] from issue where id = @2 order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid: number
            detail: { title: string; body?: string }
        }>>>()
        expect(rows).toEqual(expected)
        // The null body is DROPPED under the default projector.
        expect('body' in rows[0]!.detail).toBe(false)
    })

    // NOT-APPLICABLE: This dialect does not support the INTERSECT ALL / EXCEPT ALL set operators, so intersectAll / exceptAll / minusAll are typed never here.
    /*
    test('intersectAll-of-rule-3-required-object-with-optional-leaf-default', async () => {
        ctx.mockNext([
            { iid: 1, 'detail.title': 'Update hero copy', 'detail.body': null },
        ])
        const expected = [
            { iid: 1, detail: { title: 'Update hero copy' } },
        ]
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.in([1, 2]))
            .select({ iid: tIssue.id, detail: { title: tIssue.title, body: tIssue.body } })
            .intersectAll(
                ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(1))
                    .select({ iid: tIssue.id, detail: { title: tIssue.title, body: tIssue.body } }),
            )
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof rows, Array<{
            iid: number
            detail: { title: string; body?: string }
        }>>>()
        expect(rows).toEqual(expected)
        expect('body' in rows[0]!.detail).toBe(false)
    })
    */

    test('except-of-rule-3-required-object-with-optional-leaf-default', async () => {
        ctx.mockNext([
            { iid: 1, 'detail.title': 'Update hero copy', 'detail.body': null },
        ])
        const expected = [
            { iid: 1, detail: { title: 'Update hero copy' } },
        ]
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.in([1, 2]))
            .select({ iid: tIssue.id, detail: { title: tIssue.title, body: tIssue.body } })
            .except(
                ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(2))
                    .select({ iid: tIssue.id, detail: { title: tIssue.title, body: tIssue.body } }),
            )
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, title as [detail.title], body as [detail.body] from issue where id in (@0, @1) except select id as iid, title as [detail.title], body as [detail.body] from issue where id = @2 order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid: number
            detail: { title: string; body?: string }
        }>>>()
        expect(rows).toEqual(expected)
        expect('body' in rows[0]!.detail).toBe(false)
    })

    // NOT-APPLICABLE: This dialect does not support the INTERSECT ALL / EXCEPT ALL set operators, so intersectAll / exceptAll / minusAll are typed never here.
    /*
    test('exceptAll-of-rule-3-required-object-with-optional-leaf-default', async () => {
        ctx.mockNext([
            { iid: 1, 'detail.title': 'Update hero copy', 'detail.body': null },
        ])
        const expected = [
            { iid: 1, detail: { title: 'Update hero copy' } },
        ]
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.in([1, 2]))
            .select({ iid: tIssue.id, detail: { title: tIssue.title, body: tIssue.body } })
            .exceptAll(
                ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(2))
                    .select({ iid: tIssue.id, detail: { title: tIssue.title, body: tIssue.body } }),
            )
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof rows, Array<{
            iid: number
            detail: { title: string; body?: string }
        }>>>()
        expect(rows).toEqual(expected)
        expect('body' in rows[0]!.detail).toBe(false)
    })
    */

    test('minus-of-rule-3-required-object-with-optional-leaf-default', async () => {
        ctx.mockNext([
            { iid: 1, 'detail.title': 'Update hero copy', 'detail.body': null },
        ])
        const expected = [
            { iid: 1, detail: { title: 'Update hero copy' } },
        ]
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.in([1, 2]))
            .select({ iid: tIssue.id, detail: { title: tIssue.title, body: tIssue.body } })
            .minus(
                ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(2))
                    .select({ iid: tIssue.id, detail: { title: tIssue.title, body: tIssue.body } }),
            )
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, title as [detail.title], body as [detail.body] from issue where id in (@0, @1) except select id as iid, title as [detail.title], body as [detail.body] from issue where id = @2 order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid: number
            detail: { title: string; body?: string }
        }>>>()
        expect(rows).toEqual(expected)
        expect('body' in rows[0]!.detail).toBe(false)
    })

    // NOT-APPLICABLE: This dialect does not support the INTERSECT ALL / EXCEPT ALL set operators, so intersectAll / exceptAll / minusAll are typed never here.
    /*
    test('minusAll-of-rule-3-required-object-with-optional-leaf-default', async () => {
        ctx.mockNext([
            { iid: 1, 'detail.title': 'Update hero copy', 'detail.body': null },
        ])
        const expected = [
            { iid: 1, detail: { title: 'Update hero copy' } },
        ]
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.in([1, 2]))
            .select({ iid: tIssue.id, detail: { title: tIssue.title, body: tIssue.body } })
            .minusAll(
                ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(2))
                    .select({ iid: tIssue.id, detail: { title: tIssue.title, body: tIssue.body } }),
            )
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof rows, Array<{
            iid: number
            detail: { title: string; body?: string }
        }>>>()
        expect(rows).toEqual(expected)
        expect('body' in rows[0]!.detail).toBe(false)
    })
    */
    test('union-all-of-nested-object-aggregate-arms-projecting-optional-values-as-nullable', async () => {
        // A nullable aggregate NESTED inside a projection object member (`wrap`),
        // re-projected through a compound (unionAll). The element's
        // projectingOptionalValuesAsNullable() flag must ride through the compound: a
        // null `archivedAt` surfaces PRESENT-null one nesting level deeper. Arm 1 = org 1 (projects 1,2 — archived_at NULL), arm 2 =
        // org 2 (projects 3 NULL, 4 archived).
        const tProjectLeft = tProject.forUseInLeftJoin()
        const archivedDate = new Date('2024-02-01T00:00:00.000Z')
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
        const rows = await ctx.conn.selectFrom(tOrganization)
            .leftJoin(tProjectLeft).on(tProjectLeft.organizationId.equals(tOrganization.id))
            .where(tOrganization.id.equals(1))
            .select({
                orgId: tOrganization.id,
                wrap:  { projects: ctx.conn.aggregateAsArray({ id: tProjectLeft.id, name: tProjectLeft.name, archivedAt: tProjectLeft.archivedAt })
                    .projectingOptionalValuesAsNullable() },
            })
            .groupBy('orgId')
            .unionAll(
                ctx.conn.selectFrom(tOrganization)
                    .leftJoin(tProjectLeft).on(tProjectLeft.organizationId.equals(tOrganization.id))
                    .where(tOrganization.id.equals(2))
                    .select({
                        orgId: tOrganization.id,
                        wrap:  { projects: ctx.conn.aggregateAsArray({ id: tProjectLeft.id, name: tProjectLeft.name, archivedAt: tProjectLeft.archivedAt })
                            .projectingOptionalValuesAsNullable() },
                    })
                    .groupBy('orgId'),
            )
            .orderBy('orgId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization.id as orgId, json_arrayagg(json_object('id':project.id, 'name':project.name, 'archivedAt':project.archived_at)) as [wrap.projects] from organization left join project on project.organization_id = organization.id where organization.id = @0 group by organization.id union all select organization.id as orgId, json_arrayagg(json_object('id':project.id, 'name':project.name, 'archivedAt':project.archived_at)) as [wrap.projects] from organization left join project on project.organization_id = organization.id where organization.id = @1 group by organization.id order by orgId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
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
            expect(sorted[1]!.wrap.projects.find(p => p.id === 3)).toEqual({ id: 3, name: 'Public API', archivedAt: null })
            expect(sorted[1]!.wrap.projects.find(p => p.id === 4)!.archivedAt instanceof Date).toBe(true)
        }
        // The null `archivedAt` leaf stays PRESENT-null through the nested-object compound.
        expect('archivedAt' in sorted[0]!.wrap.projects[0]!).toBe(true)
        expect(sorted[0]!.wrap.projects[0]!.archivedAt).toBeNull()
    })
    test('union-all-of-aggregate-as-array-arms-projecting-then-use-empty-array-for-no-value', async () => {
        // Each UNION ALL arm's aggregate uses `projectingOptionalValuesAsNullable()` then
        // `useEmptyArrayForNoValue()`. The empty-group modifier only coerces NULL → [] and
        // leaves the element projection alone: the optional `archivedAt` leaf stays present-as-
        // `null` in every arm. Arm 1 = org 1 (projects 1,2 archived_at NULL), arm 2 = org 2
        // (project 3 NULL, 4 archived).
        const tProjectLeft = tProject.forUseInLeftJoin()
        const archivedDate = new Date('2024-02-01T00:00:00.000Z')
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
        const rows = await ctx.conn.selectFrom(tOrganization)
            .leftJoin(tProjectLeft).on(tProjectLeft.organizationId.equals(tOrganization.id))
            .where(tOrganization.id.equals(1))
            .select({
                orgId:    tOrganization.id,
                projects: ctx.conn.aggregateAsArray({ id: tProjectLeft.id, name: tProjectLeft.name, archivedAt: tProjectLeft.archivedAt })
                    .projectingOptionalValuesAsNullable()
                    .useEmptyArrayForNoValue(),
            })
            .groupBy('orgId')
            .unionAll(
                ctx.conn.selectFrom(tOrganization)
                    .leftJoin(tProjectLeft).on(tProjectLeft.organizationId.equals(tOrganization.id))
                    .where(tOrganization.id.equals(2))
                    .select({
                        orgId:    tOrganization.id,
                        projects: ctx.conn.aggregateAsArray({ id: tProjectLeft.id, name: tProjectLeft.name, archivedAt: tProjectLeft.archivedAt })
                            .projectingOptionalValuesAsNullable()
                            .useEmptyArrayForNoValue(),
                    })
                    .groupBy('orgId'),
            )
            .orderBy('orgId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization.id as orgId, json_arrayagg(json_object('id':project.id, 'name':project.name, 'archivedAt':project.archived_at)) as projects from organization left join project on project.organization_id = organization.id where organization.id = @0 group by organization.id union all select organization.id as orgId, json_arrayagg(json_object('id':project.id, 'name':project.name, 'archivedAt':project.archived_at)) as projects from organization left join project on project.organization_id = organization.id where organization.id = @1 group by organization.id order by orgId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
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
        // Projecting-then-modifier: the null `archivedAt` leaf stays PRESENT-null.
        expect('archivedAt' in sorted[0]!.projects[0]!).toBe(true)
    })

    test('union-all-of-aggregate-as-array-arms-projecting-then-as-optional-non-empty-array', async () => {
        // Each UNION ALL arm's aggregate uses `projectingOptionalValuesAsNullable()` then
        // `asOptionalNonEmptyArray()`, which makes the array optional (`projects?`) while its
        // elements keep the present-null `archivedAt` leaf. Both orgs have projects, so the
        // array is present on every row.
        const tProjectLeft = tProject.forUseInLeftJoin()
        const archivedDate = new Date('2024-02-01T00:00:00.000Z')
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
        const rows = await ctx.conn.selectFrom(tOrganization)
            .leftJoin(tProjectLeft).on(tProjectLeft.organizationId.equals(tOrganization.id))
            .where(tOrganization.id.equals(1))
            .select({
                orgId:    tOrganization.id,
                projects: ctx.conn.aggregateAsArray({ id: tProjectLeft.id, name: tProjectLeft.name, archivedAt: tProjectLeft.archivedAt })
                    .projectingOptionalValuesAsNullable()
                    .asOptionalNonEmptyArray(),
            })
            .groupBy('orgId')
            .unionAll(
                ctx.conn.selectFrom(tOrganization)
                    .leftJoin(tProjectLeft).on(tProjectLeft.organizationId.equals(tOrganization.id))
                    .where(tOrganization.id.equals(2))
                    .select({
                        orgId:    tOrganization.id,
                        projects: ctx.conn.aggregateAsArray({ id: tProjectLeft.id, name: tProjectLeft.name, archivedAt: tProjectLeft.archivedAt })
                            .projectingOptionalValuesAsNullable()
                            .asOptionalNonEmptyArray(),
                    })
                    .groupBy('orgId'),
            )
            .orderBy('orgId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization.id as orgId, json_arrayagg(json_object('id':project.id, 'name':project.name, 'archivedAt':project.archived_at)) as projects from organization left join project on project.organization_id = organization.id where organization.id = @0 group by organization.id union all select organization.id as orgId, json_arrayagg(json_object('id':project.id, 'name':project.name, 'archivedAt':project.archived_at)) as projects from organization left join project on project.organization_id = organization.id where organization.id = @1 group by organization.id order by orgId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            orgId:    number
            projects?: Array<{ id: number; name: string; archivedAt: Date | null }>
        }>>>()
        const sorted = rows.map(r => ({ ...r, projects: [...r.projects!].sort((a, b) => a.id - b.id) }))
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
        expect('archivedAt' in sorted[0]!.projects[0]!).toBe(true)
    })

    test('union-all-of-aggregate-as-array-arms-projecting-then-as-required-in-optional-object', async () => {
        // Each UNION ALL arm's aggregate uses `projectingOptionalValuesAsNullable()` then
        // `asRequiredInOptionalObject()`, making it the required member of an optional `meta`
        // object (`meta?`) whose elements keep the present-null `archivedAt` leaf. Both orgs
        // have projects, so `meta` is present.
        const tProjectLeft = tProject.forUseInLeftJoin()
        const archivedDate = new Date('2024-02-01T00:00:00.000Z')
        const expected = [
            { orgId: 1, meta: { projects: [
                { id: 1, name: 'Marketing site', archivedAt: null },
                { id: 2, name: 'Internal tools', archivedAt: null },
            ] } },
            { orgId: 2, meta: { projects: [
                { id: 3, name: 'Public API', archivedAt: null },
                { id: 4, name: 'Legacy app', archivedAt: archivedDate },
            ] } },
        ]
        ctx.mockNext([
            { orgId: 1, 'meta.projects': [
                { id: 1, name: 'Marketing site', archivedAt: null },
                { id: 2, name: 'Internal tools', archivedAt: null },
            ] },
            { orgId: 2, 'meta.projects': [
                { id: 3, name: 'Public API', archivedAt: null },
                { id: 4, name: 'Legacy app', archivedAt: archivedDate },
            ] },
        ])
        const rows = await ctx.conn.selectFrom(tOrganization)
            .leftJoin(tProjectLeft).on(tProjectLeft.organizationId.equals(tOrganization.id))
            .where(tOrganization.id.equals(1))
            .select({
                orgId: tOrganization.id,
                meta:  { projects: ctx.conn.aggregateAsArray({ id: tProjectLeft.id, name: tProjectLeft.name, archivedAt: tProjectLeft.archivedAt })
                    .projectingOptionalValuesAsNullable()
                    .asRequiredInOptionalObject() },
            })
            .groupBy('orgId')
            .unionAll(
                ctx.conn.selectFrom(tOrganization)
                    .leftJoin(tProjectLeft).on(tProjectLeft.organizationId.equals(tOrganization.id))
                    .where(tOrganization.id.equals(2))
                    .select({
                        orgId: tOrganization.id,
                        meta:  { projects: ctx.conn.aggregateAsArray({ id: tProjectLeft.id, name: tProjectLeft.name, archivedAt: tProjectLeft.archivedAt })
                            .projectingOptionalValuesAsNullable()
                            .asRequiredInOptionalObject() },
                    })
                    .groupBy('orgId'),
            )
            .orderBy('orgId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization.id as orgId, json_arrayagg(json_object('id':project.id, 'name':project.name, 'archivedAt':project.archived_at)) as [meta.projects] from organization left join project on project.organization_id = organization.id where organization.id = @0 group by organization.id union all select organization.id as orgId, json_arrayagg(json_object('id':project.id, 'name':project.name, 'archivedAt':project.archived_at)) as [meta.projects] from organization left join project on project.organization_id = organization.id where organization.id = @1 group by organization.id order by orgId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            orgId: number
            meta?: { projects: Array<{ id: number; name: string; archivedAt: Date | null }> }
        }>>>()
        const sorted = rows.map(r => ({ ...r, meta: { projects: [...r.meta!.projects].sort((a, b) => a.id - b.id) } }))
        if (!ctx.realDbEnabled) {
            expect(sorted).toEqual(expected)
        } else {
            expect(sorted[0]!.meta.projects).toEqual([
                { id: 1, name: 'Marketing site', archivedAt: null },
                { id: 2, name: 'Internal tools', archivedAt: null },
            ])
            expect(sorted[1]!.meta.projects.find(p => p.id === 3)).toEqual({ id: 3, name: 'Public API', archivedAt: null })
            expect(sorted[1]!.meta.projects.find(p => p.id === 4)!.archivedAt instanceof Date).toBe(true)
        }
        expect('archivedAt' in sorted[0]!.meta.projects[0]!).toBe(true)
    })

})
