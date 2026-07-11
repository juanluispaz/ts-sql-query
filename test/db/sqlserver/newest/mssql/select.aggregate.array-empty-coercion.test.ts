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
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // NOT-APPLICABLE: SQL Server's `for json path` aggregation has no
    // DISTINCT quantifier, so the connection class does not expose
    // `aggregateAsArrayDistinct`.
    /*
    test('aggregateAsArrayDistinct-on-object-shape', async () => {
        const tProjectLeftJoin = tProject.forUseInLeftJoin()
        await ctx.conn.selectFrom(tOrganization)
            .leftJoin(tProjectLeftJoin).on(tProjectLeftJoin.organizationId.equals(tOrganization.id))
            .where(tOrganization.id.equals(2))
            .select({
                id:       tOrganization.id,
                name:     tOrganization.name,
                projects: ctx.conn.aggregateAsArrayDistinct({
                    id:   tProjectLeftJoin.id,
                    name: tProjectLeftJoin.name,
                }),
            })
            .groupBy('id', 'name')
            .executeSelectOne()
    })
    */

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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as id, json_arrayagg(issue.title null on null) as titles from project left join issue on issue.project_id = project.id and issue.priority = @0 where project.id = @1 group by project.id"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as id, json_arrayagg(json_object('id':issue.id, 'title':issue.title)) as issues from project left join issue on issue.project_id = project.id and issue.priority = @0 where project.id = @1 group by project.id"`)
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

    // NOT-APPLICABLE: see above — SQL Server's `for json path`
    // aggregation has no DISTINCT quantifier, so
    // `aggregateAsArrayOfOneColumnDistinct` is not exposed.
    /*
    test('useEmptyArrayForNoValue-with-distinct-one-column', async () => {
        const tIssueLeftJoin = tIssue.forUseInLeftJoin()
        await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeftJoin).on(tIssueLeftJoin.projectId.equals(tProject.id)
                .and(tIssueLeftJoin.priority.equals(99)))
            .where(tProject.id.equals(1))
            .select({
                id:         tProject.id,
                priorities: ctx.conn.aggregateAsArrayOfOneColumnDistinct(tIssueLeftJoin.priority).useEmptyArrayForNoValue(),
            })
            .groupBy('id')
            .executeSelectOne()
    })
    */

    // NOT-APPLICABLE: This dialect does not support a DISTINCT object-array aggregate, so aggregateAsArrayDistinct on an object shape is typed never here.
    /*
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

        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
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
    */
})
