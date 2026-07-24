// `aggregateAsArray` / `aggregateAsArrayOfOneColumn` across value types
// the existing tests don't exercise (`boolean`, `localDateTime`,
// optional `localDateTime`). On dialects that build JSON through a
// per-value-type switch, each type emits a distinct JSON-escaping SQL
// shape, and the optional-wrapper is reached only when the column is
// `optional` — covered by the `aggregate-of-optional-local-date-time`
// test below. The test runs on every dialect; only the inline snapshots
// diverge. `int` / `string` aggregations are already covered elsewhere,
// so this file deliberately avoids re-doing them to stay focused on the
// gaps.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tIssueWorklog, tProject, tProjectRelease, tProjectReview, vReleaseOverview, type ReleaseTag } from '../../domain/connection.js'
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as "id", json_arrayagg(case project.published when 't' then 1 when 'f' then 0 else null end) as "published" from issue left join project on project.id = issue.project_id where issue.id = :0 group by issue.id"`)
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
        // Exercises the `localDateTime` value type in the JSON
        // aggregate. On dialects with a per-type JSON switch this is the
        // path that formats the timestamp for ISO 8601; the exact form
        // is pinned by the snapshot below.
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as "projectId", json_arrayagg(created_at) as "createdAts" from issue where project_id = :0 group by project_id"`)
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

    test('aggregate-of-local-date-column-as-array', async () => {
        // A `localDate` leaf in the JSON aggregate. Oracle serialises a `DATE` there WITH a
        // midnight time — "2024-03-04T00:00:00" — not the bare "2024-03-04" the other dialects
        // emit, so the `localDate` marshaller must tolerate the time component (else it built an
        // Invalid Date and threw). `tIssueWorklog.workDate` is `localDate`; worklogs 1 and 3 both
        // belong to issue 1 (2024-03-04 and 2024-03-06).
        ctx.mockNext([{ issueId: 1, dates: [new Date('2024-03-04T00:00:00Z'), new Date('2024-03-06T00:00:00Z')] }])
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.issueId.equals(1))
            .select({
                issueId: tIssueWorklog.issueId,
                dates:   ctx.conn.aggregateAsArrayOfOneColumn(tIssueWorklog.workDate),
            })
            .groupBy('issueId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue_id as "issueId", json_arrayagg(work_date) as "dates" from issue_worklog where issue_id = :0 group by issue_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ issueId: number; dates: Date[] }>>>()
        expect(rows.length).toBe(1)
        expect(Array.isArray(rows[0]!.dates)).toBe(true)
        const sorted = [...rows[0]!.dates].sort((a, b) => a.getTime() - b.getTime())
        expect(sorted.map(d => d.getUTCFullYear() + '-' + (d.getUTCMonth() + 1) + '-' + d.getUTCDate())).toEqual(['2024-3-4', '2024-3-6'])
    })

    test('aggregate-of-optional-local-date-time-column-as-array', async () => {
        // `tProject.archivedAt` is `optional` — on dialects with a
        // per-type JSON switch the per-element SQL is wrapped to
        // preserve NULLs; the exact form is pinned by the snapshot below.
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as "id", json_arrayagg(project.archived_at) as "archivedAts" from issue left join project on project.id = issue.project_id where issue.id = :0 group by issue.id"`)
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
        // Exercises the `bigint` value type in the JSON aggregate. Every number in
        // a JSON document is an IEEE-754 double once parsed, so the two seeded
        // values are BEYOND 2^53 (both odd, so a plain JSON number would round each
        // to the wrong even neighbour). The library reads the aggregate as a raw
        // JSON string and parses it WITHOUT rounding — numbers become strings, which
        // the `bigint` marshaller re-reads exactly via BigInt(string) — so the digits
        // survive; the exact SQL is pinned by the snapshot below. `tIssue.viewCount`
        // is `bigint`.
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
            await ctx.conn.update(tIssue).set({ viewCount: 9007199254740993n }).where(tIssue.id.equals(1)).executeUpdate()
            ctx.mockNext(1)
            await ctx.conn.update(tIssue).set({ viewCount: 9007199254740995n }).where(tIssue.id.equals(2)).executeUpdate()

            ctx.mockNext([{ projectId: 1, views: [9007199254740993n, 9007199254740995n] }])
            const rows = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.projectId.equals(1))
                .select({
                    projectId: tIssue.projectId,
                    views:     ctx.conn.aggregateAsArrayOfOneColumn(tIssue.viewCount),
                })
                .groupBy('projectId')
                .executeSelectMany()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as "projectId", json_arrayagg(view_count) as "views" from issue where project_id = :0 group by project_id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof rows, Array<{ projectId: number; views: bigint[] }>>>()
            const sorted = rows.map(r => ({ ...r, views: [...r.views].sort((a, b) => Number(a - b)) }))
            expect(sorted).toEqual([{ projectId: 1, views: [9007199254740993n, 9007199254740995n] }])
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as "projectId", json_arrayagg(estimated_hours) as "hours" from issue where project_id = :0 group by project_id"`)
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

    test('aggregate-of-scientific-double-column-as-array', async () => {
        // A double of small magnitude renders in SCIENTIFIC notation inside the JSON aggregate
        // (e.g. `1.5e-08`, `2.5e-10`) on every engine here. finding A reads the aggregate as raw
        // text, so the value reaches the `double` marshaller as a scientific-notation STRING,
        // which `+value` parses back exactly — the sibling above pins the emitted SQL. Values are
        // kept small on purpose: a very large double (e.g. `6e23`) does not round-trip through
        // sqlite-wasm's JSON, an engine limitation unrelated to the marshaller.
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            await ctx.conn.update(tIssue).set({ estimatedHours: 1.5e-8 }).where(tIssue.id.equals(1)).executeUpdate()
            ctx.mockNext(1)
            await ctx.conn.update(tIssue).set({ estimatedHours: 2.5e-10 }).where(tIssue.id.equals(2)).executeUpdate()

            ctx.mockNext([{ projectId: 1, hours: [1.5e-8, 2.5e-10] }])
            const rows = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.projectId.equals(1))
                .select({
                    projectId: tIssue.projectId,
                    hours:     ctx.conn.aggregateAsArrayOfOneColumn(tIssue.estimatedHours),
                })
                .groupBy('projectId')
                .executeSelectMany()

            assertType<Exact<typeof rows, Array<{ projectId: number; hours: number[] }>>>()
            const sorted = rows.map(r => ({ ...r, hours: [...r.hours].sort((a, b) => a - b) }))
            expect(sorted).toEqual([{ projectId: 1, hours: [2.5e-10, 1.5e-8] }])
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as "projectId", json_arrayagg(raw_to_uuid(external_ref)) as "refs" from issue where project_id = :0 group by project_id"`)
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
        // On PG and the other
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as "projectId", json_arrayagg(json_object('views' value view_count, 'externalRef' value raw_to_uuid(external_ref), 'estimatedHours' value estimated_hours)) as "issues" from issue where project_id = :0 group by project_id"`)
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
        // switch over `boolean` and `localDateTime` cases
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as "id", json_arrayagg(json_object('published' value case project.published when 't' then 1 when 'f' then 0 else null end, 'createdAt' value project.created_at)) as "projects" from issue left join project on project.id = issue.project_id where issue.id = :0 group by issue.id"`)
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
    test('aggregate-of-object-with-adapter-transformed-columns', async () => {
        // Both element leaves carry a value-transforming per-column
        // TypeAdapter: `score` (int, scaledTenthAdapter ÷10 on read) and
        // `reviewerCode` (string, bracketAdapter wraps in [...]). Aggregating
        // them into a JSON array threads each adapter's read transform
        // through every element, not just a top-level column read. The mock
        // is primed with the RAW aggregated row (score 850, code 'R-7A2');
        // the assertion proves both adapters fired per element (85,
        // '[R-7A2]'). Project 1 has a single review, so the one-element array
        // is deterministic.
        ctx.mockNext([{ projectId: 1, reviews: [{ score: 850, reviewer: 'R-7A2' }] }])
        const rows = await ctx.conn.selectFrom(tProjectReview)
            .where(tProjectReview.projectId.equals(1))
            .select({
                projectId: tProjectReview.projectId,
                reviews:   ctx.conn.aggregateAsArray({
                    score:    tProjectReview.score,
                    reviewer: tProjectReview.reviewerCode,
                }),
            })
            .groupBy('projectId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as "projectId", json_arrayagg(json_object('score' value score, 'reviewer' value reviewer_code)) as "reviews" from project_review where project_id = :0 group by project_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            projectId: number
            reviews:   Array<{ score: number; reviewer: string }>
        }>>>()
        expect(rows).toEqual([{ projectId: 1, reviews: [{ score: 85, reviewer: '[R-7A2]' }] }])
    })


    test('aggregate-of-one-column-optional-strips-null-elements', async () => {
        // `aggregateAsArrayOfOneColumn(<optional column>)` types the result as `number[]`
        // (optionality stripped): the JS projector drops the null/undefined elements per row.
        // Project 1's issue 1 gets estimated_hours = 4.5, issue 2 stays NULL, so
        // `json_agg(estimated_hours)` produces `[4.5, null]` and the projector strips the null,
        // leaving the 1-element `[4.5]`.
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            await ctx.conn.update(tIssue).set({ estimatedHours: 4.5 }).where(tIssue.id.equals(1)).executeUpdate()

            ctx.mockNext([{ projectId: 1, hours: [4.5, null] }])
            const rows = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.projectId.equals(1))
                .select({
                    projectId: tIssue.projectId,
                    hours:     ctx.conn.aggregateAsArrayOfOneColumn(tIssue.estimatedHours),
                })
                .groupBy('projectId')
                .executeSelectMany()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as "projectId", json_arrayagg(estimated_hours) as "hours" from issue where project_id = :0 group by project_id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof rows, Array<{ projectId: number; hours: number[] }>>>()
            expect(rows).toEqual([{ projectId: 1, hours: [4.5] }])
        })
    })
    test('aggregate-of-one-column-optional-branded-adapter-strips-null', async () => {
        // The scalar-aggregate NULL strip over a branded custom column carrying a value-transform
        // adapter — `vReleaseOverview.optionalReleaseOrdinal` (optional customInt `ReleaseTag`,
        // read +1000). The per-element adapter fires (raw 1 → 1001) and the element type keeps the
        // `ReleaseTag` newtype. Project 1 groups releases 1 (download present → ordinal 1) and 2
        // (download NULL → ordinal NULL), so the raw `[1, null]` becomes `[1001]` after the adapter
        // and the null strip.
        ctx.mockNext([{ projectId: 1, ords: [1, null] }])
        const rows = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.projectId.equals(1))
            .select({
                projectId: vReleaseOverview.projectId,
                ords:      ctx.conn.aggregateAsArrayOfOneColumn(vReleaseOverview.optionalReleaseOrdinal),
            })
            .groupBy('projectId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as "projectId", json_arrayagg(optional_release_ordinal) as "ords" from release_overview where project_id = :0 group by project_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ projectId: number; ords: ReleaseTag[] }>>>()
        expect(rows).toEqual([{ projectId: 1, ords: [1001 as ReleaseTag] }])
    })

    test('aggregate-of-double-column-as-wrapped-array', async () => {
        // WRAPPED single-column inline aggregate: the inner `order by` forces the
        // builder to wrap the subquery as `... from (select … order by …) as a_N_`,
        // routing the value through the WRAPPED JSON-leaf path. Only SQL Server at
        // `compatibilityVersion < 17_000_000` emits a per-value-type `string_agg` /
        // `convert` leaf there; every other dialect uses its native, type-agnostic
        // JSON aggregator. Pins the `double` case (and the optional `isnull(...)`
        // wrapper, since `estimated_hours` is optional) on the `sqlserver/16_000_000`
        // cell after propagation; on pg the wrapped leaf is type-agnostic. Project 1
        // owns issues 1 and 2; their `estimated_hours` is seeded NULL, so UPDATE to
        // distinct values inside `withRollback`. The inline aggregate has no outer
        // order guarantee, so sort the inner array in JS before comparing.
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            await ctx.conn.update(tIssue).set({ estimatedHours: 4.5 }).where(tIssue.id.equals(1)).executeUpdate()
            ctx.mockNext(1)
            await ctx.conn.update(tIssue).set({ estimatedHours: 12.0 }).where(tIssue.id.equals(2)).executeUpdate()

            const hours = ctx.conn.subSelectUsing(tProject).from(tIssue)
                .where(tIssue.projectId.equals(tProject.id))
                .selectOneColumn(tIssue.estimatedHours)
                .orderBy('result')
                .forUseAsInlineAggregatedArrayValue()

            ctx.mockNext({ id: 1, hours: '[4.5, 12]' })
            const row = await ctx.conn.selectFrom(tProject)
                .where(tProject.id.equals(1))
                .select({ id: tProject.id, hours })
                .executeSelectOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", (select json_arrayagg(a_1_.result) from (select estimated_hours as result from issue where project_id = project.id order by result offset 0 rows) a_1_) as "hours" from project where id = :0"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof row, { id: number; hours: number[] }>>()
            const sorted = { ...row, hours: [...row.hours].sort((a, b) => a - b) }
            expect(sorted).toEqual({ id: 1, hours: [4.5, 12] })
        })
    })

    test('aggregate-of-bigint-column-as-wrapped-array', async () => {
        // WRAPPED single-column inline aggregate of a `bigint` column — pins the
        // `bigint` case of the wrapped JSON-leaf path (SQL Server < 17M emits the
        // quoted `convert(nvarchar, …)` leaf; other dialects native). Same wrap
        // trigger (inner `order by`) and same correlation (project 1 → issues 1, 2).
        // `view_count` seeds to 0, so UPDATE to distinct values inside `withRollback`.
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            await ctx.conn.update(tIssue).set({ viewCount: 100n }).where(tIssue.id.equals(1)).executeUpdate()
            ctx.mockNext(1)
            await ctx.conn.update(tIssue).set({ viewCount: 200n }).where(tIssue.id.equals(2)).executeUpdate()

            const views = ctx.conn.subSelectUsing(tProject).from(tIssue)
                .where(tIssue.projectId.equals(tProject.id))
                .selectOneColumn(tIssue.viewCount)
                .orderBy('result')
                .forUseAsInlineAggregatedArrayValue()

            ctx.mockNext({ id: 1, views: '[100, 200]' })
            const row = await ctx.conn.selectFrom(tProject)
                .where(tProject.id.equals(1))
                .select({ id: tProject.id, views })
                .executeSelectOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", (select json_arrayagg(a_1_.result) from (select view_count as result from issue where project_id = project.id order by result offset 0 rows) a_1_) as "views" from project where id = :0"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof row, { id: number; views: bigint[] }>>()
            const sorted = { ...row, views: [...row.views].sort((a, b) => Number(a - b)) }
            expect(sorted).toEqual({ id: 1, views: [100n, 200n] })
        })
    })

    test('aggregate-of-uuid-column-as-wrapped-array', async () => {
        // WRAPPED single-column aggregate of an optional `uuid` column — pins the
        // `uuid` wrapped JSON-leaf case (SQL Server < 17M wraps it in
        // `convert(nvarchar(36), …)`; other dialects native). `external_ref` is
        // optional; UPDATE project 1's issues 1 and 2 to known distinct uuids inside
        // `withRollback` for a deterministic assertion.
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            await ctx.conn.update(tIssue).set({ externalRef: 'c733575e-b5ba-400c-8803-3d3d4bbcd52f' }).where(tIssue.id.equals(1)).executeUpdate()
            ctx.mockNext(1)
            await ctx.conn.update(tIssue).set({ externalRef: 'c995d12f-ced4-4e94-a341-c2da118fe64b' }).where(tIssue.id.equals(2)).executeUpdate()

            const refs = ctx.conn.subSelectUsing(tProject).from(tIssue)
                .where(tIssue.projectId.equals(tProject.id))
                .selectOneColumn(tIssue.externalRef)
                .orderBy('result')
                .forUseAsInlineAggregatedArrayValue()

            ctx.mockNext({ id: 1, refs: '["c733575e-b5ba-400c-8803-3d3d4bbcd52f", "c995d12f-ced4-4e94-a341-c2da118fe64b"]' })
            const row = await ctx.conn.selectFrom(tProject)
                .where(tProject.id.equals(1))
                .select({ id: tProject.id, refs })
                .executeSelectOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", (select json_arrayagg(raw_to_uuid(a_1_.result)) from (select external_ref as result from issue where project_id = project.id order by result offset 0 rows) a_1_) as "refs" from project where id = :0"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof row, { id: number; refs: string[] }>>()
            const sorted = { ...row, refs: [...row.refs].sort() }
            expect(sorted).toEqual({ id: 1, refs: ['c733575e-b5ba-400c-8803-3d3d4bbcd52f', 'c995d12f-ced4-4e94-a341-c2da118fe64b'] })
        })
    })

    test('aggregate-of-local-date-time-column-as-wrapped-array', async () => {
        // WRAPPED single-column aggregate of a `localDateTime` column — pins the
        // `localDateTime` wrapped JSON-leaf case (SQL Server < 17M emits
        // `convert(nvarchar, …, 127)`; other dialects native). Project 1 → issues
        // 1, 2; UPDATE their `created_at` to known instants inside `withRollback`.
        // Tests force TZ=UTC, so the ISO strings round-trip without offset.
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            await ctx.conn.update(tIssue).set({ createdAt: new Date('2024-01-01T00:00:00Z') }).where(tIssue.id.equals(1)).executeUpdate()
            ctx.mockNext(1)
            await ctx.conn.update(tIssue).set({ createdAt: new Date('2024-01-02T00:00:00Z') }).where(tIssue.id.equals(2)).executeUpdate()

            const stamps = ctx.conn.subSelectUsing(tProject).from(tIssue)
                .where(tIssue.projectId.equals(tProject.id))
                .selectOneColumn(tIssue.createdAt)
                .orderBy('result')
                .forUseAsInlineAggregatedArrayValue()

            ctx.mockNext({ id: 1, stamps: '["2024-01-01T00:00:00", "2024-01-02T00:00:00"]' })
            const row = await ctx.conn.selectFrom(tProject)
                .where(tProject.id.equals(1))
                .select({ id: tProject.id, stamps })
                .executeSelectOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", (select json_arrayagg(a_1_.result) from (select created_at as result from issue where project_id = project.id order by result offset 0 rows) a_1_) as "stamps" from project where id = :0"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof row, { id: number; stamps: Date[] }>>()
            const sorted = [...row.stamps].sort((a, b) => a.getTime() - b.getTime())
            expect(sorted.map(d => d.toISOString())).toEqual(['2024-01-01T00:00:00.000Z', '2024-01-02T00:00:00.000Z'])
        })
    })

    test('aggregate-of-boolean-column-as-wrapped-array', async () => {
        // WRAPPED single-column aggregate of an optional `boolean` column — pins the
        // `boolean` wrapped JSON-leaf case (SQL Server < 17M emits `convert(nvarchar,
        // …)` over the bit; other dialects native). Correlated over issue 1's
        // worklogs (1 and 3); UPDATE their `billable` to known values.
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            await ctx.conn.update(tIssueWorklog).set({ billable: true }).where(tIssueWorklog.id.equals(1)).executeUpdate()
            ctx.mockNext(1)
            await ctx.conn.update(tIssueWorklog).set({ billable: false }).where(tIssueWorklog.id.equals(3)).executeUpdate()

            const flags = ctx.conn.subSelectUsing(tIssue).from(tIssueWorklog)
                .where(tIssueWorklog.issueId.equals(tIssue.id))
                .selectOneColumn(tIssueWorklog.billable)
                .orderBy('result')
                .forUseAsInlineAggregatedArrayValue()

            ctx.mockNext({ id: 1, flags: '[false, true]' })
            const row = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.id.equals(1))
                .select({ id: tIssue.id, flags })
                .executeSelectOne()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", (select json_arrayagg(a_1_.result) from (select billable as result from issue_worklog where issue_id = issue.id order by result offset 0 rows) a_1_) as "flags" from issue where id = :0"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof row, { id: number; flags: boolean[] }>>()
            const sorted = { ...row, flags: [...row.flags].sort() }
            expect(sorted).toEqual({ id: 1, flags: [false, true] })
        })
    })

    test('aggregate-of-local-date-column-as-wrapped-array', async () => {
        // WRAPPED single-column aggregate of a `localDate` column — pins the
        // `localDate` wrapped JSON-leaf case (SQL Server < 17M emits
        // `convert(nvarchar, …, 127)`; other dialects native). Correlated over issue
        // 1's worklogs (1 and 3), whose seeded `work_date` is 2024-03-04 / 2024-03-06.
        ctx.mockNext({ id: 1, dates: '["2024-03-04", "2024-03-06"]' })
        const dates = ctx.conn.subSelectUsing(tIssue).from(tIssueWorklog)
            .where(tIssueWorklog.issueId.equals(tIssue.id))
            .selectOneColumn(tIssueWorklog.workDate)
            .orderBy('result')
            .forUseAsInlineAggregatedArrayValue()

        const row = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({ id: tIssue.id, dates })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", (select json_arrayagg(a_1_.result) from (select work_date as result from issue_worklog where issue_id = issue.id order by result offset 0 rows) a_1_) as "dates" from issue where id = :0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; dates: Date[] }>>()
        const sorted = [...row.dates].sort((a, b) => a.getTime() - b.getTime())
        expect(sorted.map(d => d.getUTCFullYear() + '-' + (d.getUTCMonth() + 1) + '-' + d.getUTCDate())).toEqual(['2024-3-4', '2024-3-6'])
    })

    test('aggregate-of-custom-double-column-as-wrapped-array', async () => {
        // WRAPPED single-column aggregate of a `customDouble` (branded `Money`)
        // column — pins the `customDouble` wrapped JSON-leaf case (quoted, lossless
        // style-3 convert). `tIssueWorklog.customDoubleVirtual` is `billed_amount`
        // branded Money; issue 1's worklogs 1 and 3 both have billed_amount 200.
        const amounts = ctx.conn.subSelectUsing(tIssue).from(tIssueWorklog)
            .where(tIssueWorklog.issueId.equals(tIssue.id))
            .selectOneColumn(tIssueWorklog.customDoubleVirtual)
            .orderBy('result')
            .forUseAsInlineAggregatedArrayValue()

        ctx.mockNext({ id: 1, amounts: '[200, 200]' })
        const row = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({ id: tIssue.id, amounts })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", (select json_arrayagg(a_1_.result) from (select billed_amount as result from issue_worklog where issue_id = issue.id order by result offset 0 rows) a_1_) as "amounts" from issue where id = :0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; amounts: number[] }>>()
        expect(row).toEqual({ id: 1, amounts: [200, 200] })
    })

    test('aggregate-of-custom-double-column-as-array', async () => {
        // NON-wrapped aggregate of the same `customDouble` column — pins the
        // non-wrapped `customDouble` JSON-leaf case. Issue 1's worklogs 1 and 3.
        ctx.mockNext([{ issueId: 1, amounts: [200, 200] }])
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.issueId.equals(1))
            .select({
                issueId: tIssueWorklog.issueId,
                amounts: ctx.conn.aggregateAsArrayOfOneColumn(tIssueWorklog.customDoubleVirtual),
            })
            .groupBy('issueId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue_id as "issueId", json_arrayagg(billed_amount) as "amounts" from issue_worklog where issue_id = :0 group by issue_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ issueId: number; amounts: number[] }>>>()
        expect(rows).toEqual([{ issueId: 1, amounts: [200, 200] }])
    })

    test('aggregate-of-local-time-column-as-wrapped-array', async () => {
        // WRAPPED single-column aggregate of a `localTime` column — pins the
        // `localTime` wrapped JSON-leaf case. `tIssueWorklog.startedAt` is optional
        // localTime; issue 1's worklogs 1 and 3 seed 09:15:00 and 10:30:00. Tests
        // force TZ=UTC, so the clock components read back stably.
        const clocks = ctx.conn.subSelectUsing(tIssue).from(tIssueWorklog)
            .where(tIssueWorklog.issueId.equals(tIssue.id))
            .selectOneColumn(tIssueWorklog.startedAt)
            .orderBy('result')
            .forUseAsInlineAggregatedArrayValue()

        ctx.mockNext({ id: 1, clocks: '["09:15:00", "10:30:00"]' })
        const row = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({ id: tIssue.id, clocks })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", (select json_arrayagg(a_1_.result) from (select started_at as result from issue_worklog where issue_id = issue.id order by result offset 0 rows) a_1_) as "clocks" from issue where id = :0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; clocks: Date[] }>>()
        const sorted = [...row.clocks].sort((a, b) => a.getTime() - b.getTime())
        expect(sorted.map(d => d.getUTCHours() + ':' + String(d.getUTCMinutes()).padStart(2, '0'))).toEqual(['9:15', '10:30'])
    })

    test('aggregate-of-custom-uuid-column-as-wrapped-array', async () => {
        // WRAPPED single-column aggregate of a `customUuid` column — pins the
        // `customUuid` wrapped JSON-leaf case (nvarchar(36) convert). Project 1 owns
        // releases 1 and 2; release 1's `signing_key` is a uuid, release 2's is NULL,
        // and the optional aggregate strips the null — one element remains.
        const keys = ctx.conn.subSelectUsing(tProject).from(tProjectRelease)
            .where(tProjectRelease.projectId.equals(tProject.id))
            .selectOneColumn(tProjectRelease.signingKey)
            .orderBy('result')
            .forUseAsInlineAggregatedArrayValue()

        ctx.mockNext({ id: 1, keys: '["0a8f9c1e-1111-4222-8333-444455556666", null]' })
        const row = await ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ id: tProject.id, keys })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", (select json_arrayagg(raw_to_uuid(a_1_.result)) from (select signing_key as result from project_release where project_id = project.id order by result offset 0 rows) a_1_) as "keys" from project where id = :0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; keys: string[] }>>()
        expect(row).toEqual({ id: 1, keys: ['0a8f9c1e-1111-4222-8333-444455556666'] })
    })

    test('aggregate-of-custom-local-date-column-as-wrapped-array', async () => {
        // WRAPPED single-column aggregate of a `customLocalDate` column — pins the
        // `customLocalDate` wrapped JSON-leaf case. Project 1's releases 1 and 2 seed
        // `released_on` 2024-01-15 and 2024-02-20.
        const days = ctx.conn.subSelectUsing(tProject).from(tProjectRelease)
            .where(tProjectRelease.projectId.equals(tProject.id))
            .selectOneColumn(tProjectRelease.releasedOn)
            .orderBy('result')
            .forUseAsInlineAggregatedArrayValue()

        ctx.mockNext({ id: 1, days: '["2024-01-15", "2024-02-20"]' })
        const row = await ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ id: tProject.id, days })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", (select json_arrayagg(a_1_.result) from (select released_on as result from project_release where project_id = project.id order by result offset 0 rows) a_1_) as "days" from project where id = :0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; days: Date[] }>>()
        const sorted = [...row.days].sort((a, b) => a.getTime() - b.getTime())
        expect(sorted.map(d => d.getUTCFullYear() + '-' + (d.getUTCMonth() + 1) + '-' + d.getUTCDate())).toEqual(['2024-1-15', '2024-2-20'])
    })

    test('aggregate-of-custom-local-time-column-as-wrapped-array', async () => {
        // WRAPPED single-column aggregate of a `customLocalTime` column — pins the
        // `customLocalTime` wrapped JSON-leaf case. Project 1's releases 1 and 2 seed
        // `cutoff_time` 17:00:00 and 18:30:00.
        const cutoffs = ctx.conn.subSelectUsing(tProject).from(tProjectRelease)
            .where(tProjectRelease.projectId.equals(tProject.id))
            .selectOneColumn(tProjectRelease.cutoffTime)
            .orderBy('result')
            .forUseAsInlineAggregatedArrayValue()

        ctx.mockNext({ id: 1, cutoffs: '["17:00:00", "18:30:00"]' })
        const row = await ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ id: tProject.id, cutoffs })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", (select json_arrayagg(a_1_.result) from (select cutoff_time as result from project_release where project_id = project.id order by result offset 0 rows) a_1_) as "cutoffs" from project where id = :0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; cutoffs: Date[] }>>()
        const sorted = [...row.cutoffs].sort((a, b) => a.getTime() - b.getTime())
        expect(sorted.map(d => d.getUTCHours() + ':' + String(d.getUTCMinutes()).padStart(2, '0'))).toEqual(['17:00', '18:30'])
    })

    test('aggregate-of-custom-local-date-time-column-as-wrapped-array', async () => {
        // WRAPPED single-column aggregate of a `customLocalDateTime` column — pins
        // the `customLocalDateTime` wrapped JSON-leaf case. Project 1's releases 1 and
        // 2: `signed_off_at` is 2024-01-14 12:30:00 for release 1 and NULL for release
        // 2, and the optional aggregate strips the null — one element remains.
        const signoffs = ctx.conn.subSelectUsing(tProject).from(tProjectRelease)
            .where(tProjectRelease.projectId.equals(tProject.id))
            .selectOneColumn(tProjectRelease.signedOffAt)
            .orderBy('result')
            .forUseAsInlineAggregatedArrayValue()

        ctx.mockNext({ id: 1, signoffs: '["2024-01-14T12:30:00", null]' })
        const row = await ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ id: tProject.id, signoffs })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", (select json_arrayagg(a_1_.result) from (select signed_off_at as result from project_release where project_id = project.id order by result offset 0 rows) a_1_) as "signoffs" from project where id = :0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; signoffs: Date[] }>>()
        expect(row.signoffs.map(d => d.toISOString())).toEqual(['2024-01-14T12:30:00.000Z'])
    })
})
