// Coverage of two aggregate-array surfaces that the rest of the
// suite leaves alone:
//
//   1. `aggregateAsArrayDistinct({...})` — the object-shape `distinct`
//      form, distinct from `aggregateAsArrayOfOneColumnDistinct` which
//      `docs.aggregate-as-object-array.test.ts` already exercises.
//      Lands on `_appendAggragateArrayColumns(distinct=true, columns=object)`
//      on every dialect's SqlBuilder — each builder overrides the
//      method and renders distinct + json-object together in its own
//      shape (PostgreSQL: `json_agg(distinct json_build_object(...))`,
//      SQLite: `json_group_array(distinct json_object(...))`,
//      MySQL/MariaDB: `json_arrayagg(distinct json_object(...))`,
//      Oracle: `json_arrayagg(distinct json_object(...))`, SQL Server:
//      a `FOR JSON PATH` subquery).
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization.id as id, organization.name as name, json_arrayagg(distinct json_object('id', project.id, 'name', project.name)) as projects from organization left join project on project.organization_id = organization.id where organization.id = ? group by organization.id, organization.name"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as id, json_arrayagg(issue.title) as titles from project left join issue on issue.project_id = project.id and issue.priority = ? where project.id = ? group by project.id"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as id, json_arrayagg(json_object('id', issue.id, 'title', issue.title)) as issues from project left join issue on issue.project_id = project.id and issue.priority = ? where project.id = ? group by project.id"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as id, json_arrayagg(distinct issue.priority) as priorities from project left join issue on issue.project_id = project.id and issue.priority = ? where project.id = ? group by project.id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            99,
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; priorities: number[] }>>()
        expect(row).toEqual(expected)
    })
})
