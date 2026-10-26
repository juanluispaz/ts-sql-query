// Coverage of two aggregate-array surfaces that the rest of the
// suite leaves alone:
//
//   1. `aggregateAsArrayDistinct({...})` — the object-shape `distinct`
//      form, distinct from the one-column
//      `aggregateAsArrayOfOneColumnDistinct`. Each dialect renders
//      distinct + json-object together in its own shape, pinned per cell
//      by the snapshot below.
//
//   2. `.useEmptyArrayForNoValue()` — JS-level result transformation
//      that coerces a `null` aggregate (LEFT JOIN with zero matching
//      rows on the right) to `[]`. The SQL is unchanged; the
//      projection layer narrows the TS type from `T[] | null` to `T[]`
//      and rewrites null → [] at materialisation time. Live in
//      `internal/ValueSourceImpl.ts` (the `useEmptyArrayForNoValue`
//      override on every aggregated-array value source).
//
// The "no matching rows" scenario is built by left-joining `tIssue`
// onto `tProject` with an impossible filter — the left side keeps the
// project row but the aggregate has no inputs and collapses to NULL on
// every dialect.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('aggregateAsArrayDistinct-on-object-shape', async () => {
        // org 2 has projects 3 and 4; project 4 is archived. Distinct
        // aggregate so the test is robust to row duplication from the
        // join even though the seed has none here. Returns the two
        // distinct {id, name} objects.
        //
        // Each dialect renders the distinct object-array in its own shape
        // (see the file header) — the exact SQL is pinned by the snapshot.
        const expected = {
            id: 2, name: 'Globex Ltd',
            projects: [
                { id: 3, name: 'Public API' },
                { id: 4, name: 'Legacy app' },
            ],
        }
        ctx.mockNext({
            id: 2, name: 'Globex Ltd',
            projects: JSON.stringify([
                { id: 3, name: 'Public API' },
                { id: 4, name: 'Legacy app' },
            ]),
        })
        const connection = ctx.conn
        const tProjectLeftJoin = tProject.forUseInLeftJoin()
        const row = await connection.selectFrom(tOrganization)
            .leftJoin(tProjectLeftJoin).on(tProjectLeftJoin.organizationId.equals(tOrganization.id))
            .where(tOrganization.id.equals(2))
            .select({
                id:       tOrganization.id,
                name:     tOrganization.name,
                projects: connection.aggregateAsArrayDistinct({
                    id:   tProjectLeftJoin.id,
                    name: tProjectLeftJoin.name,
                }),
            })
            .groupBy('id', 'name')
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization.id as id, organization.name as name, (json_agg(distinct jsonb_build_object('id', project.id, 'name', project.name)))::text as projects from organization left join project on project.organization_id = organization.id where organization.id = $1 group by organization.id, organization.name"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof row, {
            id:       number
            name:     string
            projects: Array<{ id: number; name: string }>
        }>>()
        const projectsSorted = [...(row?.projects ?? [])].sort((a, b) => a.id - b.id)
        expect({ id: row?.id, name: row?.name, projects: projectsSorted }).toEqual(expected)
    })

    test('useEmptyArrayForNoValue-on-one-column-aggregate', async () => {
        // Left-join project 1 onto issue with an impossible filter →
        // the join produces project 1's row with all-null issue
        // columns, the aggregate over those produces NULL. The
        // `.useEmptyArrayForNoValue()` modifier coerces NULL → [].
        // Without the modifier, the TS type would be `string[] | null`
        // (see `aggregateAsArrayOfOneColumn` projecting nullable).
        const expected: { id: number; titles: string[] } = { id: 1, titles: [] }
        ctx.mockNext({ id: 1, titles: null })
        const connection = ctx.conn
        const tIssueLeftJoin = tIssue.forUseInLeftJoin()
        const row = await connection.selectFrom(tProject)
            .leftJoin(tIssueLeftJoin).on(tIssueLeftJoin.projectId.equals(tProject.id)
                .and(tIssueLeftJoin.priority.equals(99)))
            .where(tProject.id.equals(1))
            .select({
                id:     tProject.id,
                titles: connection.aggregateAsArrayOfOneColumn(tIssueLeftJoin.title).useEmptyArrayForNoValue(),
            })
            .groupBy('id')
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as id, (json_agg(issue.title))::text as titles from project left join issue on issue.project_id = project.id and issue.priority = $1 where project.id = $2 group by project.id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            99,
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; titles: string[] }>>()
        expect(row).toEqual(expected)
    })

    test('useEmptyArrayForNoValue-on-object-aggregate', async () => {
        // Same shape but with the object aggregate form. The
        // value-type narrowing on `useEmptyArrayForNoValue` applies
        // identically; only the SQL emitter branch differs (object vs
        // singleton column).
        const expected: { id: number; issues: Array<{ id: number; title: string }> } = { id: 1, issues: [] }
        ctx.mockNext({ id: 1, issues: null })
        const connection = ctx.conn
        const tIssueLeftJoin = tIssue.forUseInLeftJoin()
        const row = await connection.selectFrom(tProject)
            .leftJoin(tIssueLeftJoin).on(tIssueLeftJoin.projectId.equals(tProject.id)
                .and(tIssueLeftJoin.priority.equals(99)))
            .where(tProject.id.equals(1))
            .select({
                id:     tProject.id,
                issues: connection.aggregateAsArray({
                    id:    tIssueLeftJoin.id,
                    title: tIssueLeftJoin.title,
                }).useEmptyArrayForNoValue(),
            })
            .groupBy('id')
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as id, (json_agg(json_build_object('id', issue.id, 'title', issue.title)))::text as issues from project left join issue on issue.project_id = project.id and issue.priority = $1 where project.id = $2 group by project.id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            99,
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            id:     number
            issues: Array<{ id: number; title: string }>
        }>>()
        expect(row).toEqual(expected)
    })

    test('useEmptyArrayForNoValue-with-distinct-one-column', async () => {
        // Combined modifiers: distinct + useEmptyArrayForNoValue. The
        // SQL keeps the `distinct` quantifier; the JS-level coercion
        // applies post-execution. Same impossible filter as above so
        // the runtime returns NULL → [].
        const expected: { id: number; priorities: number[] } = { id: 1, priorities: [] }
        ctx.mockNext({ id: 1, priorities: null })
        const connection = ctx.conn
        const tIssueLeftJoin = tIssue.forUseInLeftJoin()
        const row = await connection.selectFrom(tProject)
            .leftJoin(tIssueLeftJoin).on(tIssueLeftJoin.projectId.equals(tProject.id)
                .and(tIssueLeftJoin.priority.equals(99)))
            .where(tProject.id.equals(1))
            .select({
                id:         tProject.id,
                priorities: connection.aggregateAsArrayOfOneColumnDistinct(tIssueLeftJoin.priority).useEmptyArrayForNoValue(),
            })
            .groupBy('id')
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as id, (json_agg(distinct issue.priority))::text as priorities from project left join issue on issue.project_id = project.id and issue.priority = $1 where project.id = $2 group by project.id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            99,
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; priorities: number[] }>>()
        expect(row).toEqual(expected)
    })

    test('aggregateAsArrayDistinct-projecting-optionals-as-nullable', async () => {
        // Distinct object-array combined with projectingOptionalValuesAsNullable().
        // Project 1 has issue 1 (status 'open', body NULL) and issue 2
        // (status 'in_progress', body 'Use new tokens'). The distinct aggregate
        // collects the two distinct {status, body} objects. `body` is an
        // optional (nullable) leaf: by default a null `body` would be dropped
        // from the element, but under projectingOptionalValuesAsNullable() it
        // surfaces as PRESENT-null (`body: string | null`) — so issue 1's
        // element carries `body: null` rather than omitting the key.
        //
        // The `distinct` quantifier is preserved in the emitted aggregate and
        // pinned by the snapshot below.
        const expected = {
            id: 1, name: 'Marketing site',
            issues: [
                { status: 'in_progress', body: 'Use new tokens' },
                { status: 'open',        body: null },
            ],
        }
        ctx.mockNext({
            id: 1, name: 'Marketing site',
            issues: JSON.stringify([
                { status: 'open',        body: null },
                { status: 'in_progress', body: 'Use new tokens' },
            ]),
        })
        const connection = ctx.conn
        const tIssueLeftJoin = tIssue.forUseInLeftJoin()
        const row = await connection.selectFrom(tProject)
            .leftJoin(tIssueLeftJoin).on(tIssueLeftJoin.projectId.equals(tProject.id))
            .where(tProject.id.equals(1))
            .select({
                id:     tProject.id,
                name:   tProject.name,
                issues: connection.aggregateAsArrayDistinct({
                    status: tIssueLeftJoin.status,
                    body:   tIssueLeftJoin.body,
                }).projectingOptionalValuesAsNullable(),
            })
            .groupBy('id', 'name')
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as id, project.name as name, (json_agg(distinct jsonb_build_object('status', issue.status, 'body', issue.body)))::text as issues from project left join issue on issue.project_id = project.id where project.id = $1 group by project.id, project.name"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            id:     number
            name:   string
            issues: Array<{ status: string; body: string | null }>
        }>>()
        const issuesSorted = [...(row?.issues ?? [])].sort((a, b) => a.status.localeCompare(b.status))
        expect({ id: row?.id, name: row?.name, issues: issuesSorted }).toEqual(expected)
        // Issue 1's null body is PRESENT-null under the nullable projector.
        const openIssue = row!.issues.find(i => i.status === 'open')!
        expect('body' in openIssue).toBe(true)
        expect(openIssue.body).toBe(null)
    })

    // The complex-projection element drop rules (rule 1-4, nested) applied to the
    // DISTINCT object-array aggregate: `aggregateAsArrayDistinct` shares the same
    // element transform as `aggregateAsArray` (the JS-level drop rules are identical),
    // so only the emitted SQL differs (it gains the `distinct` quantifier and, on
    // postgres, a `jsonb_build_object`). Each seed scenario produces genuinely-distinct
    // element objects, so the `distinct` quantifier is a no-op on the values and the
    // runtime result coincides with the non-distinct sibling. NOT-APPLICABLE on the
    // dialects whose object-array aggregate cannot carry `distinct` (mysql / oracle /
    // sqlserver — the connection does not expose `aggregateAsArrayDistinct`).

    test('distinct-element-top-rule-1-gate-null-drops-whole-element-default', async () => {
        // Rule-1 gate at the element TOP under DISTINCT: `ref` is
        // `body.asRequiredInOptionalObject()`, so an element whose `ref` gate is NULL is
        // dropped from the array entirely. Org 1's issues 1, 2, 3 aggregate; issues 1
        // and 3 have a null body → dropped, leaving only issue 2. `ref` required (the
        // gate), `assigneeId` optional.
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
                items: ctx.conn.aggregateAsArrayDistinct({
                    ref:        tIssue.body.asRequiredInOptionalObject(),
                    assigneeId: tIssue.assigneeId,
                }),
            })
            .groupBy('orgId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.organization_id as "orgId", (json_agg(distinct jsonb_build_object('ref', issue.body, 'assigneeId', issue.assignee_id)))::text as items from project inner join issue on issue.project_id = project.id where project.organization_id = $1 group by project.organization_id"`)
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

    test('distinct-element-top-rule-1-gate-null-drops-whole-element-as-nullable', async () => {
        // The nullable-projector twin: the reqInOptObj gate still DROPS a null-gated
        // element (it is not surfaced as `{ ref: null }`); `ref` stays required,
        // `assigneeId` flips to `number | null`, the element itself is not `| null`.
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
                items: ctx.conn.aggregateAsArrayDistinct({
                    ref:        tIssue.body.asRequiredInOptionalObject(),
                    assigneeId: tIssue.assigneeId,
                }).projectingOptionalValuesAsNullable(),
            })
            .groupBy('orgId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.organization_id as "orgId", (json_agg(distinct jsonb_build_object('ref', issue.body, 'assigneeId', issue.assignee_id)))::text as items from project inner join issue on issue.project_id = project.id where project.organization_id = $1 group by project.organization_id"`)
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
        // Even under the nullable projector both null-gate elements DROP → one survives.
        expect(rows[0]!.items.length).toBe(1)
    })

    test('distinct-element-top-rule-2-all-left-join-element-drops-on-miss-default', async () => {
        // Rule-2 at the element TOP under DISTINCT: every leaf comes from the
        // left-joined table, mixing originally-required (`id`, `title`) with optional
        // (`body`). When the join MISSES every leaf is null and the WHOLE element is
        // dropped. Org 2 groups project 3 (joins issue 4 → present) and project 4 (miss
        // → dropped).
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
                items: ctx.conn.aggregateAsArrayDistinct({ id: tIssueLeft.id, title: tIssueLeft.title, body: tIssueLeft.body }),
            })
            .groupBy('orgId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.organization_id as "orgId", (json_agg(distinct jsonb_build_object('id', issue.id, 'title', issue.title, 'body', issue.body)))::text as items from project left join issue on issue.project_id = project.id where project.organization_id = $1 group by project.organization_id"`)
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

    test('distinct-element-top-rule-2-all-left-join-element-drops-on-miss-as-nullable', async () => {
        // The nullable-projector twin: a missed element is STILL dropped; the
        // originally-required leaves stay `id: number` / `title: string` and the
        // optional `body` becomes `string | null`.
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
                items: ctx.conn.aggregateAsArrayDistinct({ id: tIssueLeft.id, title: tIssueLeft.title, body: tIssueLeft.body })
                    .projectingOptionalValuesAsNullable(),
            })
            .groupBy('orgId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.organization_id as "orgId", (json_agg(distinct jsonb_build_object('id', issue.id, 'title', issue.title, 'body', issue.body)))::text as items from project left join issue on issue.project_id = project.id where project.organization_id = $1 group by project.organization_id"`)
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

    test('distinct-element-top-rule-3-own-table-optional-leaf-default-drops-null', async () => {
        // Rule-3 at the element TOP under DISTINCT: a null optional `body` leaf is
        // dropped from the element (`body?: string`). Project 1's issue 1 (body NULL →
        // absent) and issue 2 ('Use new tokens' → survives).
        ctx.mockNext([{ pid: 1, issues: [
            { title: 'Update hero copy', body: null },
            { title: 'Redesign navbar',  body: 'Use new tokens' },
        ] }])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .select({
                pid:    tIssue.projectId,
                issues: ctx.conn.aggregateAsArrayDistinct({ title: tIssue.title, body: tIssue.body }),
            })
            .groupBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as pid, (json_agg(distinct jsonb_build_object('title', title, 'body', body)))::text as issues from issue where project_id = $1 group by project_id"`)
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

    test('distinct-element-top-rule-4-all-optional-element-drops-when-all-null-default', async () => {
        // Rule-4 at the element TOP under DISTINCT: every leaf (`body`, `assigneeId`)
        // is optional. A row where all leaves are null drops the WHOLE element. Org 2
        // groups project 3 (left-joins issue 4 → present) and project 4 (miss → every
        // leaf null → dropped).
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
                items: ctx.conn.aggregateAsArrayDistinct({ body: tIssueLeft.body, assigneeId: tIssueLeft.assigneeId }),
            })
            .groupBy('orgId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.organization_id as "orgId", (json_agg(distinct jsonb_build_object('body', issue.body, 'assigneeId', issue.assignee_id)))::text as items from project left join issue on issue.project_id = project.id where project.organization_id = $1 group by project.organization_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            orgId: number
            items: Array<{ body?: string; assigneeId?: number }>
        }>>>()
        expect(rows).toEqual([{ orgId: 2, items: [{ body: 'See ADR-014', assigneeId: 3 }] }])
        // The all-null element is dropped entirely — the array has one element, not two.
        expect(rows[0]!.items.length).toBe(1)
    })

    test('distinct-element-top-rule-4-all-optional-element-drops-when-all-null-as-nullable', async () => {
        // The nullable-projector twin: the all-null element is STILL dropped (not
        // surfaced as a present `{ body: null, assigneeId: null }`). Same org-2 grouping.
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
                items: ctx.conn.aggregateAsArrayDistinct({ body: tIssueLeft.body, assigneeId: tIssueLeft.assigneeId })
                    .projectingOptionalValuesAsNullable(),
            })
            .groupBy('orgId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.organization_id as "orgId", (json_agg(distinct jsonb_build_object('body', issue.body, 'assigneeId', issue.assignee_id)))::text as items from project left join issue on issue.project_id = project.id where project.organization_id = $1 group by project.organization_id"`)
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

    test('distinct-element-containing-nested-rule-1-required-in-optional-object-default', async () => {
        // An aggregate element (DISTINCT) that CONTAINS a nested rule-1 object: `meta`
        // is made optional by its `requiredInOptionalObject` leaf (`gate`); the gate
        // stays required inside it, the plain-optional `assigneeId` is `?`. Project 1's
        // issues 1, 2 both carry a status, so `meta` is present for both.
        ctx.mockNext([{ pid: 1, issues: [
            { title: 'Update hero copy', meta: { gate: 'open', assigneeId: 1 } },
            { title: 'Redesign navbar',  meta: { gate: 'in_progress', assigneeId: 2 } },
        ] }])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .select({
                pid:    tIssue.projectId,
                issues: ctx.conn.aggregateAsArrayDistinct({
                    title: tIssue.title,
                    meta: {
                        gate:       tIssue.status.asRequiredInOptionalObject(),
                        assigneeId: tIssue.assigneeId,
                    },
                }),
            })
            .groupBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as pid, (json_agg(distinct jsonb_build_object('title', title, 'meta.gate', status, 'meta.assigneeId', assignee_id)))::text as issues from issue where project_id = $1 group by project_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid:    number
            issues: Array<{ title: string; meta?: { gate: string; assigneeId?: number } }>
        }>>>()
        const sorted = rows.map(r => ({ ...r, issues: [...r.issues].sort((a, b) => a.title.localeCompare(b.title)) }))
        expect(sorted).toEqual([{ pid: 1, issues: [
            { title: 'Redesign navbar', meta: { gate: 'in_progress', assigneeId: 2 } },
            { title: 'Update hero copy', meta: { gate: 'open', assigneeId: 1 } },
        ] }])
    })

    test('distinct-element-containing-nested-rule-1-required-in-optional-object-as-nullable', async () => {
        // The nested rule-1 element under the nullable projector: the inner `meta`
        // object becomes `{...} | null`, `gate` stays required, the plain-optional
        // `assigneeId` flips to `number | null`. Both project-1 issues have a status.
        ctx.mockNext([{ pid: 1, issues: [
            { title: 'Update hero copy', meta: { gate: 'open', assigneeId: 1 } },
            { title: 'Redesign navbar',  meta: { gate: 'in_progress', assigneeId: 2 } },
        ] }])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .select({
                pid:    tIssue.projectId,
                issues: ctx.conn.aggregateAsArrayDistinct({
                    title: tIssue.title,
                    meta: {
                        gate:       tIssue.status.asRequiredInOptionalObject(),
                        assigneeId: tIssue.assigneeId,
                    },
                }).projectingOptionalValuesAsNullable(),
            })
            .groupBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as pid, (json_agg(distinct jsonb_build_object('title', title, 'meta.gate', status, 'meta.assigneeId', assignee_id)))::text as issues from issue where project_id = $1 group by project_id"`)
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

    test('distinct-element-containing-rule-2-left-join-object-realizes-a-miss-default', async () => {
        // A nested rule-2 object (`iss`) under DISTINCT whose leaves come from a
        // left-joined table, mixing originally-required (`id`, `title`) with optional
        // (`body`): optional, dropped when the join misses. Org 2 groups project 3
        // (joins issue 4 → iss present) and project 4 (miss → iss dropped). The element
        // keeps a required `pid`, so only the nested `iss` disappears.
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
                items: ctx.conn.aggregateAsArrayDistinct({
                    pid: tProject.id,
                    iss: { id: tIssueLeft.id, title: tIssueLeft.title, body: tIssueLeft.body },
                }),
            })
            .groupBy('orgId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.organization_id as "orgId", (json_agg(distinct jsonb_build_object('pid', project.id, 'iss.id', issue.id, 'iss.title', issue.title, 'iss.body', issue.body)))::text as items from project left join issue on issue.project_id = project.id where project.organization_id = $1 group by project.organization_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            orgId: number
            items: Array<{ pid: number; iss?: { id: number; title: string; body?: string } }>
        }>>>()
        const sorted = rows.map(r => ({ ...r, items: [...r.items].sort((a, b) => a.pid - b.pid) }))
        expect(sorted).toEqual([{ orgId: 2, items: [
            { pid: 3, iss: { id: 4, title: 'Document /v2/users', body: 'See ADR-014' } },
            { pid: 4 },
        ] }])
        // Project 4's join missed → the whole `iss` object is absent.
        const proj4 = sorted[0]!.items.find(i => i.pid === 4)!
        expect('iss' in proj4).toBe(false)
    })
})
