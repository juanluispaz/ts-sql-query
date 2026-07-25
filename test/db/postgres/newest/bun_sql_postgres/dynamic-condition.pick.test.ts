// Coverage of the `dynamicPick` / `expandType*` utilities that the
// existing docs.* and `dynamic-condition.pick-paths.test.ts` files do not
// reach:
//
//   - `dynamicPick` with a NESTED object pick (`{ meta: { priority: true } }`)
// drives `internalDynamicPick` — every documented `dynamicPick`
//     example uses a FLAT pick, so the recursion was never exercised.
//   - `dynamicPickPaths` against a DEPTH-3 `availableFields` with an
//     `a.b.c` path drives `internalDynamicPickPaths`' own recursion
// the sibling pick-paths file only goes two levels deep.
// `expandTypeProjectedAsNullableFromDynamicPickPaths` — the
//     nullable-projection sibling of the already-covered
//     `expandTypeFromDynamicPickPaths`; a runtime passthrough whose value is
//     the reshaped result TYPE.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact, type Extends } from '../../../../lib/assertType.js'
import { dynamicPick, dynamicPickPaths, expandTypeFromDynamicPickPaths, expandTypeProjectedAsNullableFromDynamicPickPaths } from '../../../../../src/dynamic/pick.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('pick/nested-dynamic-pick-keeps-only-chosen-leaf', async () => {
        const expected = [{ id: 1, meta: { priority: 2 } }]
        ctx.mockNext(expected)
        const availableFields = {
            id:    tIssue.id,
            title: tIssue.title,
            meta: {
                priority: tIssue.priority,
                status:   tIssue.status,
            },
        }
        // Nested object pick: keep only `meta.priority`, drop `meta.status`
        // and the un-picked top-level `title`. `id` is mandatory.
        const picked = dynamicPick(availableFields, { meta: { priority: true } }, ['id'])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select(picked)
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority as "meta.priority" from issue where id = $1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            id:     number
            title?: string
            meta?:  { priority?: number; status?: string }
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('pick/nested-dynamic-pick-paths-depth-3', async () => {
        // A 3-level path forces `internalDynamicPickPaths` to recurse into
        // itself (group -> sub -> priority) and keep the deep leaf.
        const expected = [{ id: 1, group: { sub: { priority: 2 } } }]
        ctx.mockNext(expected)
        const availableFields = {
            id: tIssue.id,
            group: {
                sub: {
                    priority: tIssue.priority,
                    status:   tIssue.status,
                },
            },
        }
        const picked = dynamicPickPaths(availableFields, ['group.sub.priority'], ['id'])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select(picked)
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority as "group.sub.priority" from issue where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            id:     number
            group?: { sub?: { priority?: number; status?: string } }
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('pick/nested-dynamic-pick-depth-3', async () => {
        // dynamicPick's OWN deep recursion (internalDynamicPick calling
        // itself) — the 3-level analogue of the depth-3 dynamicPickPaths
        // above. Unlike dynamicPickPaths, internalDynamicPick sets its
        // `hasContent` flag correctly, so the deep leaf survives and
        // this works as intended.
        const expected = [{ id: 1, group: { sub: { priority: 2 } } }]
        ctx.mockNext(expected)
        const availableFields = {
            id: tIssue.id,
            group: {
                sub: {
                    priority: tIssue.priority,
                    status:   tIssue.status,
                },
            },
        }
        const picked = dynamicPick(availableFields, { group: { sub: { priority: true } } }, ['id'])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select(picked)
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority as "group.sub.priority" from issue where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            id:     number
            group?: { sub?: { priority?: number; status?: string } }
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('pick/nested-mandatory-path-keeps-deep-leaf', async () => {
        // A mandatory path that points INTO a nested object
        // (`'meta.priority'`) is kept even though the pick only selects
        // `meta.status` — exercises internalDynamicPick's
        // `(prefix + '.' + prop) in required` branch (the nested-mandatory
        // arm, distinct from the top-level mandatory used elsewhere).
        const expected = [{ id: 1, meta: { priority: 2, status: 'open' } }]
        ctx.mockNext(expected)
        const availableFields = {
            id: tIssue.id,
            meta: {
                priority: tIssue.priority,
                status:   tIssue.status,
            },
        }
        const picked = dynamicPick(availableFields, { meta: { status: true } }, ['id', 'meta.priority'])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select(picked)
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority as "meta.priority", status as "meta.status" from issue where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            id:   number
            meta: { priority: number; status: string }
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('pick/whole-nested-object-in-mandatory-list-keeps-it-required', async () => {
        // A WHOLE nested-object key in the mandatory list (`'meta'`, not a
        // `'meta.<leaf>'` path) keeps the ENTIRE inner object required with all
        // its leaves, even though the pick only selects the top-level `title`.
        // issue 1: title 'Update hero copy', priority 2, status 'open'.
        const expected = [{ id: 1, title: 'Update hero copy', meta: { priority: 2, status: 'open' } }]
        ctx.mockNext(expected)
        const availableFields = {
            id: tIssue.id,
            title: tIssue.title,
            meta: {
                priority: tIssue.priority,
                status:   tIssue.status,
            },
        }
        const picked = dynamicPick(availableFields, { title: true }, ['id', 'meta'])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select(picked)
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title, priority as "meta.priority", status as "meta.status" from issue where id = $1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            id:    number
            title?: string
            meta:  { priority: number; status: string }
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('pick/nested-pick-selecting-nothing-drops-branch', async () => {
        // When a nested pick object selects none of its leaves,
        // internalDynamicPick finds no content and returns `undefined`, so
        // the parent drops the whole `meta` branch — only `id` survives.
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const availableFields = {
            id: tIssue.id,
            meta: {
                priority: tIssue.priority,
                status:   tIssue.status,
            },
        }
        const picked = dynamicPick(availableFields, { meta: { priority: false, status: false } }, ['id'])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select(picked)
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            id:    number
            meta?: { priority?: number; status?: string }
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('pick/select-picked-projecting-optional-values-as-nullable', async () => {
        // The picking × nullable-projector product on a REAL `.select(picked)`
        // query (not the `expandType...` passthrough helper). `body` is a
        // mandatory optional-value column, so under
        // `projectingOptionalValuesAsNullable()` its null is kept present as
        // `body: string | null` rather than dropped; `title` is a picked
        // non-mandatory key (`title?: string`). Issue 1 has body NULL, so the
        // present-null survives the round-trip.
        const expected = [{ id: 1, title: 'Update hero copy', body: null }]
        ctx.mockNext(expected)
        const availableFields = {
            id:    tIssue.id,
            title: tIssue.title,
            body:  tIssue.body,
        }
        const picked = dynamicPick(availableFields, { title: true }, ['id', 'body'])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select(picked)
            .projectingOptionalValuesAsNullable()
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title, body as body from issue where id = $1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            id:     number
            title?: string
            body:   string | null
        }>>>()
        expect(rows).toEqual(expected)
        // Issue 1's null body is PRESENT-NULL under the nullable projector.
        expect('body' in rows[0]!).toBe(true)
    })

    test('pick/expand-type-projected-as-nullable-passthrough', async () => {
        // Runtime passthrough: the helper returns its `result` argument
        // unchanged and only reshapes the TYPE. The `assertType` pins that
        // reshape so a regression in the projected type can't pass silently.
        // (`Extends`, not `Exact`: the reshaped type is an intersection that
        // `Exact` does not reduce.)
        const availableFields = {
            id:    tIssue.id,
            title: tIssue.title,
            meta: {
                priority: tIssue.priority,
            },
        }
        const rows = [{ id: 1, meta: { priority: 2 } }]
        const expanded = expandTypeProjectedAsNullableFromDynamicPickPaths(
            availableFields, ['meta.priority'], rows, ['id'])

        assertType<Extends<typeof expanded, Array<{
            id:     number
            title?: string
            meta?:  { priority?: number }
        }>>>()
        expect(expanded).toBe(rows)
        expect(expanded).toEqual([{ id: 1, meta: { priority: 2 } }])
    })

    test('pick/expand-type-projected-as-nullable-shows-null-leaf', async () => {
        // An OPTIONAL picked leaf is projected as a present `T | null` (not
        // `?: T`). `body` is an optional column, so the reshaped type carries
        // `body: string | null`.
        const availableFields = { id: tIssue.id, body: tIssue.body }
        const rows = [{ id: 1, body: null }, { id: 2, body: 'Use new tokens' }]
        const expanded = expandTypeProjectedAsNullableFromDynamicPickPaths(
            availableFields, ['body'], rows, ['id'])

        assertType<Extends<typeof expanded, Array<{ id: number; body: string | null }>>>()
        expect(expanded).toBe(rows)
        expect(expanded).toEqual([{ id: 1, body: null }, { id: 2, body: 'Use new tokens' }])
    })

    test('pick/expand-type-from-page-paths', async () => {
        // Piping an `executeSelectPage()` result through the helper: `count`
        // is preserved and the `data` rows are reshaped to the picked type.
        const availableFields = { id: tIssue.id, title: tIssue.title, body: tIssue.body }
        const picked = dynamicPickPaths(availableFields, ['title'], ['id'])

        ctx.mockNext([{ id: 1, title: 'Update hero copy' }])
        ctx.mockNext(1)
        const page = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select(picked)
            .limit(10)
            .offset(0)
            .executeSelectPage()
        const expanded = expandTypeFromDynamicPickPaths(availableFields, ['title'], page, ['id'])

        assertType<Extends<typeof expanded, {
            data:  Array<{ id: number; title?: string; body?: string }>
            count: number
        }>>()
        // Runtime passthrough: the helper returns its `result` argument as-is.
        expect(expanded).toBe(page)
        expect(expanded.count).toBe(1)
        expect(expanded.data).toEqual([{ id: 1, title: 'Update hero copy' }])
    })

    test('pick/expand-type-from-one-paths', async () => {
        // Piping an `executeSelectOne()` result (a `RESULT | null`) through the
        // helper: runtime passthrough, the type reshaped to the picked object.
        const availableFields = { id: tIssue.id, title: tIssue.title, body: tIssue.body }
        const picked = dynamicPickPaths(availableFields, ['title'], ['id'])

        ctx.mockNext({ id: 1, title: 'Update hero copy' })
        const one = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select(picked)
            .executeSelectOne()
        const expanded = expandTypeFromDynamicPickPaths(availableFields, ['title'], one, ['id'])

        assertType<Extends<typeof expanded, { id: number; title?: string; body?: string } | null>>()
        // Runtime passthrough.
        expect(expanded).toBe(one)
        expect(expanded).toEqual({ id: 1, title: 'Update hero copy' })
    })
    // dynamicPick composed with an aggregate-as-array field and with drop-rule
    // leaves (rule-1 requiredInOptionalObject gate, rule-2 left-join originally-
    // required leaf) inside a picked object, plus an all-optional picked select
    // under projectingOptionalValuesAsNullable(). `dynamicPick` returns a
    // `PickWitOthersAsOptionals` projection: mandatory keys stay required, every
    // other picked key is optional in the result type; each field's own value
    // source keeps its element / optional semantics.

    test('pick/aggregate-as-array-field-default', async () => {
        // The availableFields carries an `aggregateAsArray` field. The picked
        // projection keeps the aggregate column; its element drop rules still apply
        // (a null optional `body` leaf is dropped under the default projector). `pid`
        // is mandatory (required), `issues` is a picked-but-not-mandatory key so it
        // is `issues?` in the result. Project 1 has issue 1 (body NULL → absent) and
        // issue 2 ('Use new tokens').
        ctx.mockNext([{ pid: 1, issues: [
            { title: 'Update hero copy', body: null },
            { title: 'Redesign navbar',  body: 'Use new tokens' },
        ] }])
        const availableFields = {
            pid:    tProject.id,
            issues: ctx.conn.aggregateAsArray({ title: tIssue.title, body: tIssue.body }),
        }
        const picked = dynamicPick(availableFields, { issues: true }, ['pid'])
        const rows = await ctx.conn.selectFrom(tProject)
            .innerJoin(tIssue).on(tIssue.projectId.equals(tProject.id))
            .where(tProject.id.equals(1))
            .select(picked)
            .groupBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, (json_agg(json_build_object('title', issue.title, 'body', issue.body)))::text as issues from project inner join issue on issue.project_id = project.id where project.id = $1 group by project.id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid:     number
            issues?: Array<{ title: string; body?: string }>
        }>>>()
        const sorted = rows.map(r => ({ ...r, issues: [...(r.issues ?? [])].sort((a, b) => a.title.localeCompare(b.title)) }))
        expect(sorted).toEqual([{ pid: 1, issues: [
            { title: 'Redesign navbar', body: 'Use new tokens' },
            { title: 'Update hero copy' },
        ] }])
        // Issue 1's null body is ABSENT under the default projector.
        const issue1 = rows[0]!.issues!.find(i => i.title === 'Update hero copy')!
        expect('body' in issue1).toBe(false)
    })

    test('pick/aggregate-as-array-field-projecting-optional-values-as-nullable', async () => {
        // The same picked aggregate, but the nullable flag is carried BY THE AGGREGATE
        // (`aggregateAsArray(...).projectingOptionalValuesAsNullable()`): the element
        // projection honours the aggregate's own flag (an outer-select
        // `projectingOptionalValuesAsNullable()` does NOT reach aggregate elements, by
        // design — the element transform reads only the aggregate's own flag). The
        // optional `body` leaf surfaces present-as-null. `pid` mandatory, `issues?`
        // picked-optional.
        ctx.mockNext([{ pid: 1, issues: [
            { title: 'Update hero copy', body: null },
            { title: 'Redesign navbar',  body: 'Use new tokens' },
        ] }])
        const availableFields = {
            pid:    tProject.id,
            issues: ctx.conn.aggregateAsArray({ title: tIssue.title, body: tIssue.body })
                .projectingOptionalValuesAsNullable(),
        }
        const picked = dynamicPick(availableFields, { issues: true }, ['pid'])
        const rows = await ctx.conn.selectFrom(tProject)
            .innerJoin(tIssue).on(tIssue.projectId.equals(tProject.id))
            .where(tProject.id.equals(1))
            .select(picked)
            .groupBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, (json_agg(json_build_object('title', issue.title, 'body', issue.body)))::text as issues from project inner join issue on issue.project_id = project.id where project.id = $1 group by project.id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid:     number
            issues?: Array<{ title: string; body: string | null }>
        }>>>()
        const sorted = rows.map(r => ({ ...r, issues: [...(r.issues ?? [])].sort((a, b) => a.title.localeCompare(b.title)) }))
        expect(sorted).toEqual([{ pid: 1, issues: [
            { title: 'Redesign navbar', body: 'Use new tokens' },
            { title: 'Update hero copy', body: null },
        ] }])
        // Issue 1's null body is PRESENT-null under the nullable projector.
        const issue1 = rows[0]!.issues!.find(i => i.title === 'Update hero copy')!
        expect('body' in issue1).toBe(true)
        expect(issue1.body).toBe(null)
    })

    test('pick/rule-1-gate-leaf-inside-picked-object-default', async () => {
        // A rule-1 requiredInOptionalObject gate leaf (`gate` = issue.status) inside a
        // picked nested `meta` object. `meta.gate` is a mandatory path (kept required),
        // `meta.assigneeId` is the picked plain-optional sibling. `id` mandatory.
        // Issues 1, 2 both carry a status. This is the plain-select projector path
        // (no aggregate), so the reqInOptObj gate stays required inside `meta`.
        const expected = [
            { id: 1, meta: { gate: 'open', assigneeId: 1 } },
            { id: 2, meta: { gate: 'in_progress', assigneeId: 2 } },
        ]
        ctx.mockNext([
            { id: 1, 'meta.gate': 'open', 'meta.assigneeId': 1 },
            { id: 2, 'meta.gate': 'in_progress', 'meta.assigneeId': 2 },
        ])
        const availableFields = {
            id: tIssue.id,
            meta: {
                gate:       tIssue.status.asRequiredInOptionalObject(),
                assigneeId: tIssue.assigneeId,
            },
        }
        const picked = dynamicPick(availableFields, { meta: { assigneeId: true } }, ['id', 'meta.gate'])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.in([1, 2]))
            .select(picked)
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, status as "meta.gate", assignee_id as "meta.assigneeId" from issue where id in ($1, $2) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            id:   number
            meta?: { gate: string; assigneeId?: number }
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('pick/rule-1-gate-leaf-inside-picked-object-projecting-optional-values-as-nullable', async () => {
        // A rule-1 requiredInOptionalObject gate leaf inside a picked nested `meta`
        // object, under `projectingOptionalValuesAsNullable()`. The nullable
        // projector keeps optional shapes PRESENT: the optional `meta` object
        // surfaces as `meta: {…} | null` and the optional `meta.assigneeId` surfaces
        // as `number | null`. `meta.gate` stays the mandatory required leaf. Issues
        // 1, 2 both carry a status, so `meta` is present in every row.
        const expected = [
            { id: 1, meta: { gate: 'open', assigneeId: 1 } },
            { id: 2, meta: { gate: 'in_progress', assigneeId: 2 } },
        ]
        ctx.mockNext([
            { id: 1, 'meta.gate': 'open', 'meta.assigneeId': 1 },
            { id: 2, 'meta.gate': 'in_progress', 'meta.assigneeId': 2 },
        ])
        const availableFields = {
            id: tIssue.id,
            meta: {
                gate:       tIssue.status.asRequiredInOptionalObject(),
                assigneeId: tIssue.assigneeId,
            },
        }
        const picked = dynamicPick(availableFields, { meta: { assigneeId: true } }, ['id', 'meta.gate'])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.in([1, 2]))
            .select(picked)
            .projectingOptionalValuesAsNullable()
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, status as "meta.gate", assignee_id as "meta.assigneeId" from issue where id in ($1, $2) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            id:   number
            meta: { gate: string; assigneeId: number | null } | null
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('pick/rule-2-left-join-leaf-inside-picked-object-default', async () => {
        // A rule-2 originally-required left-join leaf (`name` from a left-joined
        // project) inside a picked nested `proj` object, mixed with the optional
        // `archivedAt`. `proj.id` / `proj.name` are mandatory paths (kept required),
        // `proj.archivedAt` is the picked optional sibling (dropped when null under the
        // default projector). `iid` mandatory. Issue 1 joins project 1 (archived_at
        // NULL → archivedAt dropped).
        const tProjLeft = tProject.forUseInLeftJoin()
        ctx.mockNext([{ iid: 1, proj: { id: 1, name: 'Marketing site', archivedAt: null } }])
        const availableFields = {
            iid: tIssue.id,
            proj: {
                id:         tProjLeft.id,
                name:       tProjLeft.name,
                archivedAt: tProjLeft.archivedAt,
            },
        }
        const picked = dynamicPick(availableFields, { proj: { archivedAt: true } }, ['iid', 'proj.id', 'proj.name'])
        const rows = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tProjLeft).on(tProjLeft.id.equals(tIssue.projectId))
            .where(tIssue.id.equals(1))
            .select(picked)
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, project.id as "proj.id", project.name as "proj.name", project.archived_at as "proj.archivedAt" from issue left join project on project.id = issue.project_id where issue.id = $1 order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid:  number
            proj?: { id: number; name: string; archivedAt?: Date }
        }>>>()
        expect(rows).toEqual([{ iid: 1, proj: { id: 1, name: 'Marketing site' } }])
        // Project 1's null archivedAt is dropped under the default projector.
        expect('archivedAt' in rows[0]!.proj!).toBe(false)
    })

    test('pick/rule-2-left-join-leaf-inside-picked-object-projecting-optional-values-as-nullable', async () => {
        // A rule-2 originally-required left-join leaf inside a picked nested `proj`
        // object, under `projectingOptionalValuesAsNullable()`. The nullable
        // projector keeps optional shapes PRESENT: the optional `proj` object
        // surfaces as `proj: {…} | null` and the optional `proj.archivedAt` surfaces
        // present-as-`Date | null`. `proj.id` / `proj.name` stay mandatory. Issue 1
        // joins project 1 (archived_at NULL → archivedAt PRESENT as null under the
        // nullable projector).
        const tProjLeft = tProject.forUseInLeftJoin()
        ctx.mockNext([{ iid: 1, proj: { id: 1, name: 'Marketing site', archivedAt: null } }])
        const availableFields = {
            iid: tIssue.id,
            proj: {
                id:         tProjLeft.id,
                name:       tProjLeft.name,
                archivedAt: tProjLeft.archivedAt,
            },
        }
        const picked = dynamicPick(availableFields, { proj: { archivedAt: true } }, ['iid', 'proj.id', 'proj.name'])
        const rows = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tProjLeft).on(tProjLeft.id.equals(tIssue.projectId))
            .where(tIssue.id.equals(1))
            .select(picked)
            .projectingOptionalValuesAsNullable()
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, project.id as "proj.id", project.name as "proj.name", project.archived_at as "proj.archivedAt" from issue left join project on project.id = issue.project_id where issue.id = $1 order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid:  number
            proj: { id: number; name: string; archivedAt: Date | null } | null
        }>>>()
        expect(rows).toEqual([{ iid: 1, proj: { id: 1, name: 'Marketing site', archivedAt: null } }])
        // Project 1's null archivedAt is PRESENT-null under the nullable projector.
        expect('archivedAt' in rows[0]!.proj!).toBe(true)
        expect(rows[0]!.proj!.archivedAt).toBe(null)
    })

    test('pick/all-optional-select-picked-projecting-optional-values-as-nullable', async () => {
        // PickWitOthersAsOptionals with NO mandatory keys → every picked key is
        // optional in the result. Through a real `.select(picked)` under
        // projectingOptionalValuesAsNullable(): `id` / `title` are picked-optional
        // (`?: T`), and the picked optional-value column `body` — being optional both
        // by the pick AND by nullability — surfaces present-as-null with the key
        // absent-vs-present distinction probed at runtime. Issue 1 has body NULL.
        const expected = [{ id: 1, title: 'Update hero copy', body: null }]
        ctx.mockNext(expected)
        const availableFields = {
            id:    tIssue.id,
            title: tIssue.title,
            body:  tIssue.body,
        }
        const picked = dynamicPick(availableFields, { id: true, title: true, body: true }, [])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select(picked)
            .projectingOptionalValuesAsNullable()
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title, body as body from issue where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            id?:    number
            title?: string
            body?:  string | null
        }>>>()
        expect(rows).toEqual(expected)
        // Issue 1's null body is PRESENT-null under the nullable projector.
        expect('body' in rows[0]!).toBe(true)
        expect(rows[0]!.body).toBe(null)
    })
    test('pick/dynamic-pick-optional-leaf-default-projector-drops-null-key', async () => {
        // a `dynamicPick` of an OPTIONAL column (`body`) under the DEFAULT
        // projector (no `projectingOptionalValuesAsNullable`). The picked leaf types as
        // `body?: string` and, per the default optionals-as-undefined projector, a NULL
        // value DROPS the key entirely (contrast the present-null nullable sibling above).
        // issue 1 body NULL → `body` absent; issue 2 body present → `body` present.
        const expected = [
            { id: 1 },
            { id: 2, body: 'Use new tokens' },
        ]
        ctx.mockNext([{ id: 1, body: null }, { id: 2, body: 'Use new tokens' }])
        const availableFields = {
            id:    tIssue.id,
            title: tIssue.title,
            body:  tIssue.body,
        }
        const picked = dynamicPick(availableFields, { body: true }, ['id'])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .select(picked)
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, body as body from issue where project_id = $1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            id:     number
            title?: string
            body?:  string
        }>>>()
        expect(rows).toEqual(expected)
        // Issue 1's null body is ABSENT under the default projector (not present-null).
        expect('body' in rows[0]!).toBe(false)
        expect('body' in rows[1]!).toBe(true)
    })
    test('pick/expand-type-projected-as-nullable-from-page-paths', async () => {
        // the nullable projector's `{ data, count }` PAGE passthrough overload of
        // `expandTypeProjectedAsNullableFromDynamicPickPaths` — the array overload is
        // covered by `pick/expand-type-projected-as-nullable-passthrough`; this pins the
        // page passthrough. Sibling of `pick/expand-type-from-page-paths`, but through
        // the nullable reshape (optional-value leaves surface present-as-`T | null`).
        // Runtime passthrough: the helper returns its `result` argument unchanged, only
        // retyping it.
        const availableFields = { id: tIssue.id, title: tIssue.title, body: tIssue.body }
        const picked = dynamicPickPaths(availableFields, ['title'], ['id'])

        ctx.mockNext([{ id: 1, title: 'Update hero copy' }])
        ctx.mockNext(1)
        const page = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select(picked)
            .limit(10)
            .offset(0)
            .executeSelectPage()
        const expanded = expandTypeProjectedAsNullableFromDynamicPickPaths(availableFields, ['title'], page, ['id'])

        assertType<Extends<typeof expanded, {
            data:  Array<{ id: number; title?: string; body?: string | null }>
            count: number
        }>>()
        // Runtime passthrough: the helper returns its `result` argument as-is.
        expect(expanded).toBe(page)
        expect(expanded.count).toBe(1)
        expect(expanded.data).toEqual([{ id: 1, title: 'Update hero copy' }])
    })
    test('pick/expand-type-projected-as-nullable-from-one-paths', async () => {
        // the nullable projector's ONE passthrough overload (a `RESULT | null`).
        // Sibling of `pick/expand-type-from-one-paths`: piping an `executeSelectOne()`
        // result through `expandTypeProjectedAsNullableFromDynamicPickPaths` reshapes the
        // type to the nullable-projected picked object. Runtime passthrough.
        const availableFields = { id: tIssue.id, title: tIssue.title, body: tIssue.body }
        const picked = dynamicPickPaths(availableFields, ['title'], ['id'])

        ctx.mockNext({ id: 1, title: 'Update hero copy' })
        const one = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select(picked)
            .executeSelectOne()
        const expanded = expandTypeProjectedAsNullableFromDynamicPickPaths(availableFields, ['title'], one, ['id'])

        assertType<Extends<typeof expanded, { id: number; title?: string; body?: string | null } | null>>()
        // Runtime passthrough.
        expect(expanded).toBe(one)
        expect(expanded).toEqual({ id: 1, title: 'Update hero copy' })
    })

    test('pick/dynamic-pick-paths-without-mandatory-arg', async () => {
        // `dynamicPickPaths` called WITHOUT the optional `mandatory` argument:
        // only the paths named in the pick list are projected (here `title`),
        // and every key is optional in the result type (no mandatory keys). The
        // sibling tests all pass a mandatory array, so the no-mandatory path was
        // never exercised.
        const expected = [{ title: 'Update hero copy' }]
        ctx.mockNext(expected)
        const availableFields = {
            id:    tIssue.id,
            title: tIssue.title,
            body:  tIssue.body,
        }
        const picked = dynamicPickPaths(availableFields, ['title'])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select(picked)
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select title as title from issue where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            id?:    number
            title?: string
            body?:  string
        }>>>()
        expect(rows).toEqual(expected)
    })
})
