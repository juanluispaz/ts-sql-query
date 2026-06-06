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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, json_arrayagg(cast(case project.published when 't' then 1 when 'f' then 0 else null end as bit) null on null) as published from issue left join project on project.id = issue.project_id where issue.id = @0 group by issue.id"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as projectId, json_arrayagg(created_at null on null) as createdAts from issue where project_id = @0 group by project_id"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, json_arrayagg(project.archived_at null on null) as archivedAts from issue left join project on project.id = issue.project_id where issue.id = @0 group by issue.id"`)
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

    test('aggregate-of-bigint-column-as-array', async () => {
        // Pins the `bigint` case in the SqlServer JSON switch. SqlServer
        // wraps bigint with `convert(nvarchar, ..., 0)` (the value
        // doesn't fit in a JSON int reliably). PG / MariaDB / MySQL /
        // SQLite / Oracle route the bigint through the native JSON
        // aggregator. `tIssue.viewCount` is `bigint`.
        //
        // The seed leaves `view_count` at its `0n` default, which would
        // make the asserted aggregate trivially `[0n, 0n]`. We UPDATE
        // project 1's issues to distinct values inside `withRollback`
        // so the assertion actually exercises bigint marshalling; the
        // rollback at the end reverts the seed for the next test.
        // `aggregateAsArrayOfOneColumn` does not expose an ORDER BY for
        // the JSON aggregate, so we sort the inner array in JS before
        // comparing to be insensitive to the per-dialect ordering.
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            await ctx.conn.update(tIssue).set({ viewCount: 100n }).where(tIssue.id.equals(1)).executeUpdate()
            ctx.mockNext(1)
            await ctx.conn.update(tIssue).set({ viewCount: 200n }).where(tIssue.id.equals(2)).executeUpdate()

            ctx.mockNext([{ projectId: 1, views: [100n, 200n] }])
            const rows = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.projectId.equals(1))
                .select({
                    projectId: tIssue.projectId,
                    views:     ctx.conn.aggregateAsArrayOfOneColumn(tIssue.viewCount),
                })
                .groupBy('projectId')
                .executeSelectMany()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as projectId, json_arrayagg(view_count null on null) as views from issue where project_id = @0 group by project_id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof rows, Array<{ projectId: number; views: bigint[] }>>>()
            const sorted = rows.map(r => ({ ...r, views: [...r.views].sort((a, b) => Number(a - b)) }))
            expect(sorted).toEqual([{ projectId: 1, views: [100n, 200n] }])
        })
    })

    test('aggregate-of-optional-double-column-as-array', async () => {
        // Pins the `double` case in the SqlServer JSON switch. Optional
        // wrapper (`isnull(..., 'null')`) is exercised by the
        // optional-localDateTime test; here we focus on the type
        // branch. `tIssue.estimatedHours` is `optionalColumn('double')`.
        // The aggregate strips NULLs from the projected array (its
        // result type is `number[]`, not `(number | null)[]`).
        //
        // The seed sets every `estimated_hours` to NULL, which would
        // collapse the aggregate to `[]` and trivialise the per-type
        // assertion. We UPDATE project 1's two issues to distinct
        // values inside `withRollback` so the assertion exercises
        // double marshalling end-to-end. JSON aggregate order isn't
        // guaranteed, so we sort the inner array in JS before
        // comparing.
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            await ctx.conn.update(tIssue).set({ estimatedHours: 4.5 }).where(tIssue.id.equals(1)).executeUpdate()
            ctx.mockNext(1)
            await ctx.conn.update(tIssue).set({ estimatedHours: 12.0 }).where(tIssue.id.equals(2)).executeUpdate()

            ctx.mockNext([{ projectId: 1, hours: [4.5, 12.0] }])
            const rows = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.projectId.equals(1))
                .select({
                    projectId: tIssue.projectId,
                    hours:     ctx.conn.aggregateAsArrayOfOneColumn(tIssue.estimatedHours),
                })
                .groupBy('projectId')
                .executeSelectMany()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as projectId, json_arrayagg(estimated_hours null on null) as hours from issue where project_id = @0 group by project_id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof rows, Array<{ projectId: number; hours: number[] }>>>()
            const sorted = rows.map(r => ({ ...r, hours: [...r.hours].sort((a, b) => a - b) }))
            expect(sorted).toEqual([{ projectId: 1, hours: [4.5, 12.0] }])
        })
    })

    test('aggregate-of-optional-uuid-column-as-array', async () => {
        // Pins the `uuid` case in the SqlServer JSON switch.
        // `tIssue.externalRef` is `optionalColumn('uuid')`. On SqlServer
        // the uuid surfaces as `nvarchar`; on PG/SQLite/etc the native
        // JSON aggregator picks it up. The aggregate strips NULLs from
        // the projected array (`string[]`, not `(string | null)[]`).
        //
        // Same shape as the optional-double test above: seed leaves
        // `external_ref` NULL, so we UPDATE project 1's two issues
        // inside `withRollback` to make the assertion non-trivial.
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            await ctx.conn.update(tIssue)
                .set({ externalRef: 'c733575e-b5ba-400c-8803-3d3d4bbcd52f' })
                .where(tIssue.id.equals(1))
                .executeUpdate()
            ctx.mockNext(1)
            await ctx.conn.update(tIssue)
                .set({ externalRef: 'c995d12f-ced4-4e94-a341-c2da118fe64b' })
                .where(tIssue.id.equals(2))
                .executeUpdate()

            ctx.mockNext([{
                projectId: 1,
                refs:      [
                    'c733575e-b5ba-400c-8803-3d3d4bbcd52f',
                    'c995d12f-ced4-4e94-a341-c2da118fe64b',
                ],
            }])
            const rows = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.projectId.equals(1))
                .select({
                    projectId: tIssue.projectId,
                    refs:      ctx.conn.aggregateAsArrayOfOneColumn(tIssue.externalRef),
                })
                .groupBy('projectId')
                .executeSelectMany()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as projectId, json_arrayagg(external_ref null on null) as refs from issue where project_id = @0 group by project_id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof rows, Array<{ projectId: number; refs: string[] }>>>()
            const sorted = rows.map(r => ({ ...r, refs: [...r.refs].sort() }))
            expect(sorted).toEqual([{
                projectId: 1,
                refs:      [
                    'c733575e-b5ba-400c-8803-3d3d4bbcd52f',
                    'c995d12f-ced4-4e94-a341-c2da118fe64b',
                ],
            }])
        })
    })

    test('aggregate-of-object-with-bigint-uuid-and-double', async () => {
        // Wrapped (object-shape) `aggregateAsArray({...})` mixing
        // `bigint` + optional `uuid` + optional `double`. Pins the
        // `bigint`/`uuid`/`double` cases in
        // `_appendJsonValueForWrappedAggregate` simultaneously
        // (SqlServerSqlBuilder.ts:1322-1362). On PG and the other
        // JSON-native dialects the per-property cast is absent.
        //
        // We UPDATE project 1's two issues to known per-row values so
        // the wrapped object surface exercises every type branch end
        // to end. The aggregate's inner-array order isn't guaranteed,
        // so we sort by `views` in JS before comparing.
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            await ctx.conn.update(tIssue)
                .set({
                    viewCount:      100n,
                    externalRef:    'c733575e-b5ba-400c-8803-3d3d4bbcd52f',
                    estimatedHours: 4.5,
                })
                .where(tIssue.id.equals(1))
                .executeUpdate()
            ctx.mockNext(1)
            await ctx.conn.update(tIssue)
                .set({
                    viewCount:      200n,
                    externalRef:    'c995d12f-ced4-4e94-a341-c2da118fe64b',
                    estimatedHours: 8.5,
                })
                .where(tIssue.id.equals(2))
                .executeUpdate()

            ctx.mockNext([{
                projectId: 1,
                issues:    [
                    { views: 100n, externalRef: 'c733575e-b5ba-400c-8803-3d3d4bbcd52f', estimatedHours: 4.5 },
                    { views: 200n, externalRef: 'c995d12f-ced4-4e94-a341-c2da118fe64b', estimatedHours: 8.5 },
                ],
            }])
            const rows = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.projectId.equals(1))
                .select({
                    projectId: tIssue.projectId,
                    issues:    ctx.conn.aggregateAsArray({
                        views:          tIssue.viewCount,
                        externalRef:    tIssue.externalRef,
                        estimatedHours: tIssue.estimatedHours,
                    }),
                })
                .groupBy('projectId')
                .executeSelectMany()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as projectId, json_arrayagg(json_object('views':view_count, 'externalRef':external_ref, 'estimatedHours':estimated_hours)) as issues from issue where project_id = @0 group by project_id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof rows, Array<{
                projectId: number
                issues:    Array<{
                    views:          bigint
                    externalRef?:   string
                    estimatedHours?: number
                }>
            }>>>()
            const sorted = rows.map(r => ({
                ...r,
                issues: [...r.issues].sort((a, b) => Number(a.views - b.views)),
            }))
            expect(sorted).toEqual([{
                projectId: 1,
                issues:    [
                    { views: 100n, externalRef: 'c733575e-b5ba-400c-8803-3d3d4bbcd52f', estimatedHours: 4.5 },
                    { views: 200n, externalRef: 'c995d12f-ced4-4e94-a341-c2da118fe64b', estimatedHours: 8.5 },
                ],
            }])
        })
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, json_arrayagg(json_object('published':cast(case project.published when 't' then 1 when 'f' then 0 else null end as bit), 'createdAt':project.created_at)) as projects from issue left join project on project.id = issue.project_id where issue.id = @0 group by issue.id"`)
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
