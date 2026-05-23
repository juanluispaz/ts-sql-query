// `aggregateAsArray` / `aggregateAsArrayOfOneColumn` across value types
// the existing tests don't exercise (`boolean`, `localDateTime`,
// optional `localDateTime`). Motivated by gaps in
// [SqlServerSqlBuilder.ts:1238-1363](../../../../../src/sqlBuilders/SqlServerSqlBuilder.ts#L1238-L1363) —
// `_appendJsonValueForAggregate` / `_appendJsonValueForWrappedAggregate`:
// each case of the `switch(type)` (boolean/int/double, bigint/customInt/
// customDouble/uuid, string/aggregatedArray, localDate/localTime/
// localDateTime/customLocal*, default) emits a distinct JSON-escaping
// SQL shape on T-SQL ≥ SQL Server 2016 (compatibilityVersion ≥ 13_000_000).
// The `isnull(..., 'null')` optional-wrapper at L1278-1280 / L1358-1360
// is reached only when the column is `optional` — covered by the
// `aggregate-of-optional-local-date-time` test below.
//
// On every other dialect the emission funnels through different SQL
// (PostgreSQL `json_agg`, MariaDB/MySQL `json_arrayagg`, SQLite
// `json_group_array`, Oracle `json_arrayagg`), so the test runs
// everywhere; only the inline snapshots diverge.
//
// `int` / `string` aggregations are already pinned by
// `docs.aggregate-as-object-array.test.ts`; this file deliberately
// avoids re-doing them to stay focused on the gaps.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('aggregate-of-boolean-column-as-array', async () => {
        // `aggregateAsArrayOfOneColumn(tProjectLeftJoin.published)` —
        // pins the `boolean` case in the SqlServer JSON switch. On
        // every other dialect, just confirms the JSON-array emission
        // for a boolean column.
        ctx.mockNext([{ id: 1, published: [true, true] }])

        const tProjectLeftJoin = tProject.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tProjectLeftJoin).on(tProjectLeftJoin.id.equals(tIssue.projectId))
            .where(tIssue.id.equals(1))
            .select({
                id:        tIssue.id,
                published: ctx.conn.aggregateAsArrayOfOneColumn(tProjectLeftJoin.published),
            })
            .groupBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, json_group_array((project.published = 't')) as published from issue left join project on project.id = issue.project_id where issue.id = ? group by issue.id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; published: boolean[] }>>>()
        if (!ctx.realDbEnabled) {
            expect(rows).toEqual([{ id: 1, published: [true, true] }])
        } else {
            expect(rows.length).toBe(1)
            expect(rows[0]!.id).toBe(1)
            expect(Array.isArray(rows[0]!.published)).toBe(true)
        }
    })

    test('aggregate-of-local-date-time-column-as-array', async () => {
        // Pins the `localDateTime` case in the SqlServer JSON switch
        // — the only path that emits `convert(nvarchar, ..., 127)` for
        // ISO 8601 formatting. On PG / MariaDB / MySQL / SQLite /
        // Oracle the SQL just routes through the native JSON aggregator
        // with no per-column convert.
        ctx.mockNext([
            { projectId: 1, createdAts: [new Date('2024-01-01T00:00:00Z'), new Date('2024-01-02T00:00:00Z')] },
        ])

        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .select({
                projectId:  tIssue.projectId,
                createdAts: ctx.conn.aggregateAsArrayOfOneColumn(tIssue.createdAt),
            })
            .groupBy('projectId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as projectId, json_group_array(created_at) as createdAts from issue where project_id = ? group by project_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ projectId: number; createdAts: Date[] }>>>()
        if (!ctx.realDbEnabled) {
            expect(rows.length).toBe(1)
            expect(rows[0]!.createdAts.length).toBe(2)
        } else {
            expect(rows.length).toBeGreaterThan(0)
            expect(Array.isArray(rows[0]!.createdAts)).toBe(true)
        }
    })

    test('aggregate-of-optional-local-date-time-column-as-array', async () => {
        // `tProject.archivedAt` is `optional` — the SqlServer JSON
        // emission wraps the per-element SQL with `isnull(..., 'null')`
        // ([SqlServerSqlBuilder.ts:1278-1280](../../../../../src/sqlBuilders/SqlServerSqlBuilder.ts#L1278-L1280)).
        // The seed has project 4 archived and projects 1–3 not — at
        // least one NULL is present in the aggregate.
        ctx.mockNext([
            { id: 1, archivedAts: [null] },
        ])

        const tProjectLeftJoin = tProject.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tProjectLeftJoin).on(tProjectLeftJoin.id.equals(tIssue.projectId))
            .where(tIssue.id.equals(1))
            .select({
                id:          tIssue.id,
                archivedAts: ctx.conn.aggregateAsArrayOfOneColumn(tProjectLeftJoin.archivedAt),
            })
            .groupBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, json_group_array(project.archived_at) as archivedAts from issue left join project on project.id = issue.project_id where issue.id = ? group by issue.id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; archivedAts: Date[] }>>>()
        if (!ctx.realDbEnabled) {
            expect(rows.length).toBe(1)
        } else {
            expect(rows.length).toBe(1)
            expect(Array.isArray(rows[0]!.archivedAts)).toBe(true)
        }
    })

    test('aggregate-of-object-with-boolean-and-local-date-time', async () => {
        // Object-shape `aggregateAsArray({...})` mixing a boolean and
        // a localDateTime column. On SqlServer this exercises
        // `_appendJsonValueForWrappedAggregate` with the per-property
        // switch over `boolean` and `localDateTime` cases at
        // [SqlServerSqlBuilder.ts:1322-1362](../../../../../src/sqlBuilders/SqlServerSqlBuilder.ts#L1322-L1362).
        ctx.mockNext([
            {
                id:       1,
                projects: [
                    { published: true, createdAt: new Date('2024-01-01T00:00:00Z') },
                ],
            },
        ])

        const tProjectLeftJoin = tProject.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tProjectLeftJoin).on(tProjectLeftJoin.id.equals(tIssue.projectId))
            .where(tIssue.id.equals(1))
            .select({
                id:       tIssue.id,
                projects: ctx.conn.aggregateAsArray({
                    published: tProjectLeftJoin.published,
                    createdAt: tProjectLeftJoin.createdAt,
                }),
            })
            .groupBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, json_group_array(json_object('published', (project.published = 't'), 'createdAt', project.created_at)) as projects from issue left join project on project.id = issue.project_id where issue.id = ? group by issue.id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            id:       number
            projects: Array<{ published: boolean; createdAt: Date }>
        }>>>()
        if (!ctx.realDbEnabled) {
            expect(rows.length).toBe(1)
            expect(rows[0]!.projects.length).toBe(1)
        } else {
            expect(rows.length).toBe(1)
            expect(Array.isArray(rows[0]!.projects)).toBe(true)
        }
    })
})
