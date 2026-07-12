// Behavioral coverage of aggregation: countAll / count / countDistinct /
// sum / average / min / max, with and without GROUP BY, with HAVING.
//
// sum / average / min / max return `optional` because an empty set
// aggregates to NULL.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tIssueWorklog, tProjectRelease } from '../../domain/connection.js'
import { ctx } from './setup.js'
describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('count-star', async () => {
        ctx.mockNext({ total: 4 })
        const result = await ctx.conn.selectFrom(tIssue)
            .select({ total: ctx.conn.countAll() })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select count(*) as total from issue"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, { total: number }>>()
        expect(result.total).toBe(4)
    })

    test('count-distinct-status', async () => {
        ctx.mockNext({ statuses: 3 })
        const result = await ctx.conn.selectFrom(tIssue)
            .select({ statuses: ctx.conn.countDistinct(tIssue.status) })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select count(distinct \`status\`) as statuses from issue"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, { statuses: number }>>()
        expect(result.statuses).toBe(3)
    })

    test('count-of-optional-column-stays-required', async () => {
        // `count` of an OPTIONAL column is still `required` — the result
        // optionality is decoupled from the input (unlike sum/average, which
        // are optional). `assignee_id` is an optionalColumn; seeded values are
        // 1, 2, NULL, 3, so count counts the 3 non-null rows.
        ctx.mockNext({ assigned: 3 })
        const result = await ctx.conn.selectFrom(tIssue)
            .select({ assigned: ctx.conn.count(tIssue.assigneeId) })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select count(assignee_id) as assigned from issue"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, { assigned: number }>>()
        expect(result.assigned).toBe(3)
    })

    test('sum-priority', async () => {
        ctx.mockNext({ totalPriority: 8 })
        const result = await ctx.conn.selectFrom(tIssue)
            .select({ totalPriority: ctx.conn.sum(tIssue.priority) })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select sum(priority) as totalPriority from issue"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        // sum is optional — empty set aggregates to NULL. The library
        // surfaces this as `key?: T | undefined`, distinct from the plain
        // `key?: T` shape produced for scalar inline subqueries.
        assertType<Exact<typeof result, { totalPriority?: number | undefined }>>()
        expect(result.totalPriority).toBe(8)
    })

    test('min-max-priority', async () => {
        ctx.mockNext({ lo: 1, hi: 3 })
        const result = await ctx.conn.selectFrom(tIssue)
            .select({
                lo: ctx.conn.min(tIssue.priority),
                hi: ctx.conn.max(tIssue.priority),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select min(priority) as lo, max(priority) as hi from issue"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, {
            lo?: number | undefined
            hi?: number | undefined
        }>>()
        expect(result).toEqual({ lo: 1, hi: 3 })
    })

    test('group-by-with-having', async () => {
        const expected = [
            { status: 'open', total: 2 },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .select({
                status: tIssue.status,
                total:  ctx.conn.count(tIssue.id),
            })
            .groupBy('status')
            .having(ctx.conn.count(tIssue.id).greaterThan(1))
            .orderBy('status')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select \`status\` as \`status\`, count(id) as total from issue group by \`status\` having count(id) > ? order by \`status\`"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ status: string; total: number }>>>()
        expect(result).toEqual(expected)
    })

    test('avg-int-column-fractional', async () => {
        // Verifies the cross-dialect contract that `average(intCol)` never
        // returns a truncated integer when the operand is an INTEGER column —
        // it always returns the fractional `number` the math says it should.
        // Issues 1 and 2 belong to project 1 with priorities {2, 1}; the
        // average is 1.5 on every supported engine. SQL Server's native
        // `AVG(int)` would truncate the result to 1, so the SqlServerSqlBuilder
        // wraps the operand in `cast(<expr> as float)`
        // `_average`); every other dialect produces the fractional result
        // natively. The `averageDistinct` flavour has its own twin in
        // `select.aggregate-distinct.test.ts`.
        ctx.mockNext({ avgPriority: 1.5 })

        const row = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .select({
                avgPriority: ctx.conn.average(tIssue.priority),
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select avg(priority) as avgPriority from issue where project_id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { avgPriority?: number | undefined }>>()
        expect(row.avgPriority).toBe(1.5)
    })

    test('sum-bigint-and-distinct', async () => {
        // sum / sumDistinct of a `bigint` column preserve the bigint result.
        // view_count is 0 for every issue, so both the plain and distinct sum
        // are 0n.
        ctx.mockNext({ s: 0n, sd: 0n })
        const result = await ctx.conn.selectFrom(tIssue)
            .select({
                s:  ctx.conn.sum(tIssue.viewCount),
                sd: ctx.conn.sumDistinct(tIssue.viewCount),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select sum(view_count) as \`s\`, sum(distinct view_count) as sd from issue"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, { s?: bigint | undefined; sd?: bigint | undefined }>>()
        expect(result).toEqual({ s: 0n, sd: 0n })
    })

    test('max-preserves-customcomparable', async () => {
        // max/min preserve the input value-source type, flipping only
        // optionality. max over a branded customComparable column keeps the
        // comparable (leaf `string`). version values {1.2.0, 1.3.0-beta.1,
        // 0.9.0} -> max '1.3.0-beta.1' (lexicographic). Semver marshals as
        // string.
        ctx.mockNext({ v: '1.3.0-beta.1' })
        const result = await ctx.conn.selectFrom(tProjectRelease)
            .select({
                v: ctx.conn.max(tProjectRelease.version),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select max(version) as \`v\` from project_release"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, { v?: string | undefined }>>()
        expect(result.v).toBe('1.3.0-beta.1')
    })

    test('min-preserves-localdate', async () => {
        // min over a pure localDate column keeps the localDate (leaf `Date`).
        // work_date values {03-04, 03-05, 03-06} -> min 2024-03-04. A date-only
        // value normalises to 10:00 UTC.
        const minDate = new Date(Date.UTC(2024, 2, 4, 10, 0, 0))
        ctx.mockNext({ d: minDate })
        const result = await ctx.conn.selectFrom(tIssueWorklog)
            .select({
                d: ctx.conn.min(tIssueWorklog.workDate),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select min(work_date) as \`d\` from issue_worklog"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, { d?: Date | undefined }>>()
        expect(result.d).toEqual(minDate)
    })
    test('average-and-average-distinct-over-bigint', async () => {
        // `average` / `averageDistinct` over a BIGINT operand (durationMs). The
        // avg of the two non-null
        // durations {5400000, 1800000} (worklog 2 is NULL, excluded) is
        // 3600000; the two values are distinct so averageDistinct matches.
        // (sum/average over a customDouble operand has no fixture column —
        // Money is only produced by executeFunction — so that arm is omitted.)
        ctx.mockNext({ avg: 3600000, avgD: 3600000 })
        const row = await ctx.conn.selectFrom(tIssueWorklog)
            .select({
                avg:  ctx.conn.average(tIssueWorklog.durationMs),
                avgD: ctx.conn.averageDistinct(tIssueWorklog.durationMs),
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select avg(duration_ms) as \`avg\`, avg(distinct duration_ms) as avgD from issue_worklog"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof row, { avg?: number | undefined; avgD?: number | undefined }>>()
        expect(row).toEqual({ avg: 3600000, avgD: 3600000 })
    })
    test('customdouble-sum-distinct-and-average-return-branches', async () => {
        // `sum(customDouble)` / `sumDistinct(customDouble)` keep the customDouble
        // kind ('optional'); `average(customDouble)` drops the brand to a plain
        // Number ('optional'). All surface as
        // `number?`. `billed_amount` ('Money') is {200, 50, 200}: sum = 450,
        // distinct sum = 250, average = 150.
        ctx.mockNext({ s: 450, sd: 250, av: 150 })
        const result = await ctx.conn.selectFrom(tIssueWorklog)
            .select({
                s:  ctx.conn.sum(tIssueWorklog.billedAmount),
                sd: ctx.conn.sumDistinct(tIssueWorklog.billedAmount),
                av: ctx.conn.average(tIssueWorklog.billedAmount),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select sum(billed_amount) as \`s\`, sum(distinct billed_amount) as sd, avg(billed_amount) as av from issue_worklog"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, { s?: number | undefined; sd?: number | undefined; av?: number | undefined }>>()
        expect(result).toEqual({ s: 450, sd: 250, av: 150 })
    })

    test('sum-customint-branded', async () => {
        // sum of a `customInt` column preserves the brand (leaf `number`).
        // cost_cents is {100, 100, 400} -> sum 600. The typeName is marshalled,
        // so the sum comes back as a clean `600` on every engine.
        ctx.mockNext({ ci: 600 })
        const result = await ctx.conn.selectFrom(tIssueWorklog)
            .select({
                ci: ctx.conn.sum(tIssueWorklog.costCents),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select sum(cost_cents) as ci from issue_worklog"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, { ci?: number | undefined }>>()
        expect(result).toEqual({ ci: 600 })
    })

    test('customint-sum-distinct-and-average-return-branches', async () => {
        // `sumDistinct(customInt)` keeps the customInt kind ('optional'); the
        // `average(customInt)` drops the brand to a plain Number
        // ('optional'). Both surface as `number?`, and the typeName is
        // marshalled so the value comes back clean. cost_cents {100,100,400}:
        // distinct sum = 500, average = 600/3 = 200.
        ctx.mockNext({ sd: 500, av: 200 })
        const result = await ctx.conn.selectFrom(tIssueWorklog)
            .select({
                sd: ctx.conn.sumDistinct(tIssueWorklog.costCents),
                av: ctx.conn.average(tIssueWorklog.costCents),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select sum(distinct cost_cents) as sd, avg(cost_cents) as av from issue_worklog"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, { sd?: number | undefined; av?: number | undefined }>>()
        expect(result).toEqual({ sd: 500, av: 200 })
    })

    test('min-max-over-bigint-customint-customdouble', async () => {
        // min/max preserve the input value-source kind, flipping only
        // optionality: the `bigint` (durationMs) leaf stays `bigint?`, and the
        // branded `customInt` ('Cents', costCents) / `customDouble` ('Money',
        // billedAmount) leaves stay `number?` — the brand is the typeName,
        // erased in the result, and the value comes back marshalled.
        // duration_ms {5400000, NULL, 1800000} -> min 1800000n, max 5400000n;
        // cost_cents {100,100,400} -> min 100; billed_amount {200,50,200} ->
        // min 50, max 200.
        ctx.mockNext({ durLo: 1800000n, durHi: 5400000n, centsLo: 100, amtLo: 50, amtHi: 200 })
        const result = await ctx.conn.selectFrom(tIssueWorklog)
            .select({
                durLo:   ctx.conn.min(tIssueWorklog.durationMs),
                durHi:   ctx.conn.max(tIssueWorklog.durationMs),
                centsLo: ctx.conn.min(tIssueWorklog.costCents),
                amtLo:   ctx.conn.min(tIssueWorklog.billedAmount),
                amtHi:   ctx.conn.max(tIssueWorklog.billedAmount),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select min(duration_ms) as durLo, max(duration_ms) as durHi, min(cost_cents) as centsLo, min(billed_amount) as amtLo, max(billed_amount) as amtHi from issue_worklog"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, {
            durLo?:   bigint | undefined
            durHi?:   bigint | undefined
            centsLo?: number | undefined
            amtLo?:   number | undefined
            amtHi?:   number | undefined
        }>>()
        expect(result).toEqual({ durLo: 1800000n, durHi: 5400000n, centsLo: 100, amtLo: 50, amtHi: 200 })
    })

    test('group-by-before-select-projecting-optional-values-as-nullable', async () => {
        // The groupBy-BEFORE-select shape: `.groupBy(<value source>)` is called on
        // the where-expression before `.select(...)`, so the select returns a
        // `WhereableExecutableSelectExpressionWithGroupByProjectableAsNullable` and
        // `.projectingOptionalValuesAsNullable()` is reached there (the other
        // projectingOptional* variants come from the select-first shape). The
        // optional `maxAssignee` aggregate (max over a nullable column) surfaces as
        // `number | null` (present-null) instead of the default `number | undefined`
        // (absent). Grouping the 4 issues by project: project 1 → max(assignee 1,2)
        // = 2; project 2 → max(assignee NULL) = null; project 3 → max(assignee 3) = 3.
        const expected = [
            { projectId: 1, maxAssignee: 2 },
            { projectId: 2, maxAssignee: null },
            { projectId: 3, maxAssignee: 3 },
        ]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .groupBy(tIssue.projectId)
            .select({
                projectId:   tIssue.projectId,
                maxAssignee: ctx.conn.max(tIssue.assigneeId),
            })
            .projectingOptionalValuesAsNullable()
            .orderBy('projectId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as projectId, max(assignee_id) as maxAssignee from issue group by project_id order by projectId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ projectId: number; maxAssignee: number | null }>>>()
        expect(result).toEqual(expected)
    })

    test('group-by-before-select-then-select-one-column-scalar-shortcut', async () => {
        // `groupBy(...)` before the select, projecting a single aggregate column via
        // the `selectOneColumn(...)` scalar shortcut. Grouping the 4 issues by
        // project and taking max(priority): project 1 → max(2, 1) = 2; project 2 →
        // max(3) = 3; project 3 → max(2) = 2. Sort in JS to stay deterministic across
        // mock and real DB.
        const expected = [2, 2, 3]
        ctx.mockNext([2, 3, 2])
        const result = await ctx.conn.selectFrom(tIssue)
            .groupBy(tIssue.projectId)
            .selectOneColumn(ctx.conn.max(tIssue.priority))
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select max(priority) as result from issue group by project_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        // `max(...)` is optional (empty set → NULL), so the one-column scalar array
        // is typed `Array<number | null>`; every group here is non-empty at runtime.
        assertType<Exact<typeof result, Array<number | null>>>()
        expect(result.slice().sort()).toEqual(expected)
    })

    test('group-by-before-select-then-select-count-all-scalar-shortcut', async () => {
        // `groupBy(...)` before the select, projecting the per-group row count via
        // the `selectCountAll()` scalar shortcut. Grouping the 4 issues by project
        // yields one count per group: project 1 → 2 issues, project 2 → 1, project 3
        // → 1. Sort in JS for determinism.
        const expected = [1, 1, 2]
        ctx.mockNext([2, 1, 1])
        const result = await ctx.conn.selectFrom(tIssue)
            .groupBy(tIssue.projectId)
            .selectCountAll()
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select count(*) as result from issue group by project_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<number>>>()
        expect(result.slice().sort()).toEqual(expected)
    })


    test('group-by-select-one-column-optional-aggregate-realizes-null-element', async () => {
        // The scalar-shortcut counterpart of the object-projector null realization:
        // groupBy(projectId).selectOneColumn(max(assigneeId)) where one group's max
        // is NULL — project 2's only issue (id 3) has assignee_id NULL, so its
        // group max is null. Unlike the sibling max(priority) shortcut above (whose
        // groups are all non-empty), the `Array<number | null>` type's null
        // inhabitant is realized in the VALUE here. Grouped maxes: project 1 →
        // max(1,2)=2, project 2 → max(NULL)=null, project 3 → max(3)=3. Sort by a
        // null-safe comparator for determinism across mock and real DB.
        ctx.mockNext([2, null, 3])
        const result = await ctx.conn.selectFrom(tIssue)
            .groupBy(tIssue.projectId)
            .selectOneColumn(ctx.conn.max(tIssue.assigneeId))
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select max(assignee_id) as result from issue group by project_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<number | null>>>()
        // the sorted array pins the exact multiset — the null inhabitant (project 2's
        // group) is realized in the value, not just the Array<number | null> type
        expect([...result].sort((a, b) => (a ?? 99) - (b ?? 99))).toEqual([2, 3, null])
    })
    // ---- CONN B5 aggregate min/max/sum/average leaves (round-44)
    // min/max fan-out over the leaf kinds the existing aggregation coverage
    // doesn't reach: a plain `string`, a plain `double`, a plain `localTime`, a
    // plain `localDateTime`, and the three CUSTOM temporal kinds (customLocalDate
    // / customLocalTime / customLocalDateTime). Plus sum/average over a plain
    // `double` column and sumDistinct/averageDistinct over a plain `int` column.
    // min/max preserve the input value-source kind (flipping only optionality), so
    // each leaf keeps its own result type; sum/average/*Distinct are optional
    // (empty set → NULL). Values are asserted exactly (the seed drives the real
    // aggregate on the native-sqlite / docker runs), mirroring the
    // min-preserves-localdate handling above. The plain double / localDateTime
    // leaves read through the double / localDateTime `virtualColumnFromFragment`
    // columns (billed_amount / published_at), keeping every reference on the three
    // already-imported fixtures.

    test('min-max-over-string', async () => {
        // min/max over a plain `string` column (issue.status). Statuses are
        // {open, in_progress, open, closed}; lexicographic min = 'closed',
        // max = 'open'.
        ctx.mockNext({ lo: 'closed', hi: 'open' })
        const result = await ctx.conn.selectFrom(tIssue)
            .select({
                lo: ctx.conn.min(tIssue.status),
                hi: ctx.conn.max(tIssue.status),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select min(\`status\`) as lo, max(\`status\`) as hi from issue"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, { lo?: string | undefined; hi?: string | undefined }>>()
        expect(result).toEqual({ lo: 'closed', hi: 'open' })
    })

    test('min-max-over-plain-double', async () => {
        // min/max over a plain `double` leaf (the double virtualColumnFromFragment
        // reading billed_amount). billed_amount is {200, 50, 200}; min = 50,
        // max = 200 — a distinct typed path from the customDouble min/max above.
        ctx.mockNext({ lo: 50, hi: 200 })
        const result = await ctx.conn.selectFrom(tIssueWorklog)
            .select({
                lo: ctx.conn.min(tIssueWorklog.doubleVirtual),
                hi: ctx.conn.max(tIssueWorklog.doubleVirtual),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select min(billed_amount) as lo, max(billed_amount) as hi from issue_worklog"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, { lo?: number | undefined; hi?: number | undefined }>>()
        expect(result).toEqual({ lo: 50, hi: 200 })
    })

    test('min-max-over-plain-localtime', async () => {
        // min/max over a plain `localTime` column (issue_worklog.started_at).
        // Times {09:15, 14:00, 10:30} → min 09:15, max 14:00, each normalised onto
        // 1970-01-01 UTC.
        const lo = new Date(Date.UTC(1970, 0, 1, 9, 15, 0))
        const hi = new Date(Date.UTC(1970, 0, 1, 14, 0, 0))
        ctx.mockNext({ lo, hi })
        const result = await ctx.conn.selectFrom(tIssueWorklog)
            .select({
                lo: ctx.conn.min(tIssueWorklog.startedAt),
                hi: ctx.conn.max(tIssueWorklog.startedAt),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select min(started_at) as lo, max(started_at) as hi from issue_worklog"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, { lo?: Date | undefined; hi?: Date | undefined }>>()
        expect(result).toEqual({ lo, hi })
    })

    test('min-max-over-plain-localdatetime', async () => {
        // min/max over a plain `localDateTime` leaf (the localDateTime
        // virtualColumnFromFragment reading published_at). Stamps
        // {2024-01-16 09:00, 2024-02-21 10:00, 2024-03-02 11:00} → min the earliest,
        // max the latest (UTC).
        const lo = new Date(Date.UTC(2024, 0, 16, 9, 0, 0))
        const hi = new Date(Date.UTC(2024, 2, 2, 11, 0, 0))
        ctx.mockNext({ lo, hi })
        const result = await ctx.conn.selectFrom(tProjectRelease)
            .select({
                lo: ctx.conn.min(tProjectRelease.localDateTimeVirtual),
                hi: ctx.conn.max(tProjectRelease.localDateTimeVirtual),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select min(published_at) as lo, max(published_at) as hi from project_release"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, { lo?: Date | undefined; hi?: Date | undefined }>>()
        expect(result).toEqual({ lo, hi })
    })

    test('min-max-over-custom-temporal-leaves', async () => {
        // min/max over the three CUSTOM temporal kinds on project_release:
        // released_on (customLocalDate 'ReleaseDay'), cutoff_time (customLocalTime
        // 'CutoffClock') and published_at (customLocalDateTime 'PublishStamp').
        // min/max preserve each custom kind (the brand is the typeName, erased in
        // the Date result). Dates {2024-01-15, 2024-02-20, 2024-03-01} → endpoints
        // (date-only normalises to 10:00 UTC); cutoffs {17:00, 18:30, 16:00} →
        // 16:00 / 18:30 on 1970-01-01; publish stamps {2024-01-16 09:00,
        // 2024-02-21 10:00, 2024-03-02 11:00} → the endpoints.
        const dayLo   = new Date(Date.UTC(2024, 0, 15, 10, 0, 0))
        const dayHi   = new Date(Date.UTC(2024, 2, 1, 10, 0, 0))
        const clockLo = new Date(Date.UTC(1970, 0, 1, 16, 0, 0))
        const clockHi = new Date(Date.UTC(1970, 0, 1, 18, 30, 0))
        const stampLo = new Date(Date.UTC(2024, 0, 16, 9, 0, 0))
        const stampHi = new Date(Date.UTC(2024, 2, 2, 11, 0, 0))
        const expected = { dayLo, dayHi, clockLo, clockHi, stampLo, stampHi }
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tProjectRelease)
            .select({
                dayLo:   ctx.conn.min(tProjectRelease.releasedOn),
                dayHi:   ctx.conn.max(tProjectRelease.releasedOn),
                clockLo: ctx.conn.min(tProjectRelease.cutoffTime),
                clockHi: ctx.conn.max(tProjectRelease.cutoffTime),
                stampLo: ctx.conn.min(tProjectRelease.publishedAt),
                stampHi: ctx.conn.max(tProjectRelease.publishedAt),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select min(released_on) as dayLo, max(released_on) as dayHi, min(cutoff_time) as clockLo, max(cutoff_time) as clockHi, min(published_at) as stampLo, max(published_at) as stampHi from project_release"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, {
            dayLo?:   Date | undefined
            dayHi?:   Date | undefined
            clockLo?: Date | undefined
            clockHi?: Date | undefined
            stampLo?: Date | undefined
            stampHi?: Date | undefined
        }>>()
        expect(result).toEqual(expected)
    })

    test('sum-average-over-plain-double', async () => {
        // sum / average over a plain `double` leaf (the double
        // virtualColumnFromFragment reading billed_amount). billed_amount is
        // {200, 50, 200}: sum = 450, average = 150.
        ctx.mockNext({ s: 450, av: 150 })
        const result = await ctx.conn.selectFrom(tIssueWorklog)
            .select({
                s:  ctx.conn.sum(tIssueWorklog.doubleVirtual),
                av: ctx.conn.average(tIssueWorklog.doubleVirtual),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select sum(billed_amount) as \`s\`, avg(billed_amount) as av from issue_worklog"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, { s?: number | undefined; av?: number | undefined }>>()
        expect(result).toEqual({ s: 450, av: 150 })
    })

    test('sum-distinct-average-distinct-over-int', async () => {
        // sumDistinct / averageDistinct over a plain `int` column (issue.priority).
        // Priorities {2, 1, 3, 2}; the DISTINCT set is {1, 2, 3}: sumDistinct = 6,
        // averageDistinct = 2.
        ctx.mockNext({ sd: 6, avd: 2 })
        const result = await ctx.conn.selectFrom(tIssue)
            .select({
                sd:  ctx.conn.sumDistinct(tIssue.priority),
                avd: ctx.conn.averageDistinct(tIssue.priority),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select sum(distinct priority) as sd, avg(distinct priority) as avd from issue"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, { sd?: number | undefined; avd?: number | undefined }>>()
        expect(result).toEqual({ sd: 6, avd: 2 })
    })
})
