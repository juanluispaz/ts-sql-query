// Behavioral coverage of date/time operators. Uses the seeded
// `created_at` columns and connection-level `currentDate` /
// `currentDateTime` helpers.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tOrganization, tIssueWorklog, tProject, tProjectRelease, tProjectReview } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('currentDate', async () => {
        const expected = [{ today: new Date() }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFromNoTable()
            .select({ today: ctx.conn.currentDate() })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select date('now', 'localtime') as today"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ today: Date }>>>()
        if (ctx.realDbEnabled) {
            expect(rows[0]?.today).toBeInstanceOf(Date)
        }
    })

    test('currentDateTime', async () => {
        const expected = [{ now: new Date() }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFromNoTable()
            .select({ now: ctx.conn.currentDateTime() })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select datetime('now', 'localtime') as now"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ now: Date }>>>()
        if (ctx.realDbEnabled) {
            expect(rows[0]?.now).toBeInstanceOf(Date)
        }
    })

    test('getFullYear', async () => {
        const expected = [{ id: 1, year: 2024 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .select({
                id:   tOrganization.id,
                year: tOrganization.createdAt.getFullYear(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cast(strftime('%Y', created_at) as integer) as year from organization where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; year: number }>>>()
        if (ctx.realDbEnabled) {
            expect(rows[0]?.year).toBeGreaterThanOrEqual(2000)
        }
    })

    test('getMonth-getDate', async () => {
        const expected = [{ id: 1, month: 6, date: 15 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .select({
                id:    tOrganization.id,
                month: tOrganization.createdAt.getMonth(),
                date:  tOrganization.createdAt.getDate(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cast(strftime('%m', created_at) as integer) - 1 as month, cast(strftime('%d', created_at) as integer) as date from organization where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; month: number; date: number }>>>()
        if (ctx.realDbEnabled) {
            // getMonth() follows JS Date semantics: 0 = January, 11 = December.
            expect(rows[0]?.month).toBeGreaterThanOrEqual(0)
            expect(rows[0]?.month).toBeLessThanOrEqual(11)
            expect(rows[0]?.date).toBeGreaterThanOrEqual(1)
            expect(rows[0]?.date).toBeLessThanOrEqual(31)
        }
    })

    test('getHours-getMinutes-getSeconds', async () => {
        const expected = [{ id: 1, h: 12, m: 30, s: 45 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                h:  tIssue.createdAt.getHours(),
                m:  tIssue.createdAt.getMinutes(),
                s:  tIssue.createdAt.getSeconds(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cast(strftime('%H', created_at) as integer) as "h", cast(strftime('%M', created_at) as integer) as "m", cast(strftime('%S', created_at) as integer) as "s" from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; h: number; m: number; s: number }>>>()
        if (ctx.realDbEnabled) {
            expect(rows[0]?.h).toBeGreaterThanOrEqual(0)
            expect(rows[0]?.h).toBeLessThan(24)
        }
    })

    test('getDay-day-of-week', async () => {
        // `.getDay()` returns the day-of-week (0..6 / 1..7 depending on
        // the dialect). The SQL form this dialect emits is pinned by the
        // snapshot below.
        const expected = [{ id: 1, dow: 6 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .select({
                id:  tOrganization.id,
                dow: tOrganization.createdAt.getDay(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cast(strftime('%w',created_at) as integer) as dow from organization where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; dow: number }>>>()
        if (ctx.realDbEnabled) {
            // JS Date.getDay() returns 0..6 (Sunday=0). SQLite's
            // strftime('%w') also returns 0..6.
            expect(rows[0]?.dow).toBeGreaterThanOrEqual(0)
            expect(rows[0]?.dow).toBeLessThanOrEqual(6)
        }
    })

    test('getTime-epoch-millis', async () => {
        // `.getTime()` returns the JS-style epoch milliseconds — every
        // dialect emits a different conversion to integer.
        const expected = [{ id: 1, t: 1718454645000 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .select({
                id: tOrganization.id,
                t:  tOrganization.createdAt.getTime(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, round(unixepoch(created_at, 'subsec') * 1000) as "t" from organization where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; t: number }>>>()
        if (ctx.realDbEnabled) {
            expect(rows[0]?.t).toBeGreaterThan(0)
        }
    })

    test('getMilliseconds', async () => {
        // `.getMilliseconds()` returns the millisecond component (0..999).
        // The expression this dialect uses is pinned by the snapshot below.
        const expected = [{ id: 1, ms: 0 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id: tIssue.id,
                ms: tIssue.createdAt.getMilliseconds(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, strftime('%f', created_at) * 1000 % 1000 as ms from issue where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; ms: number }>>>()
        if (ctx.realDbEnabled) {
            expect(rows[0]?.ms).toBeGreaterThanOrEqual(0)
            expect(rows[0]?.ms).toBeLessThan(1000)
        }
    })

    test('compare-date-with-current', async () => {
        // Find rows whose created_at is before "now".
        const expected = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.createdAt.lessOrEqual(ctx.conn.currentDateTime()))
            .select({ id: tOrganization.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from organization where created_at <= datetime('now', 'localtime') order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        // Both seeded orgs were created before "now".
        expect(rows.map(r => r.id).sort()).toEqual([1, 2])
    })
    test('localDate-getters', async () => {
        // LocalDateValueSource exposes getFullYear/getMonth/getDate/getDay.
        // work_date is a pure `localDate` column; worklog 1 is 2024-03-04 (a
        // Monday). getMonth follows JS semantics (0 = January) and getDay
        // follows JS semantics (0 = Sunday) on every dialect.
        const expected = [{ y: 2024, mo: 2, d: 4, dow: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({
                y:   tIssueWorklog.workDate.getFullYear(),
                mo:  tIssueWorklog.workDate.getMonth(),
                d:   tIssueWorklog.workDate.getDate(),
                dow: tIssueWorklog.workDate.getDay(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select cast(strftime('%Y', work_date) as integer) as "y", cast(strftime('%m', work_date) as integer) - 1 as mo, cast(strftime('%d', work_date) as integer) as "d", cast(strftime('%w',work_date) as integer) as dow from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ y: number; mo: number; d: number; dow: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('localTime-getters-optional', async () => {
        // LocalTimeValueSource exposes getHours/getMinutes/getSeconds/
        // getMilliseconds. started_at is an OPTIONAL localTime column, so each
        // getter carries the 'optional' marker through to a `number | undefined`
        // leaf. Worklog 1 started at 09:15:00.
        const expected = [{ h: 9, m: 15, s: 0, ms: 0 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({
                h:  tIssueWorklog.startedAt.getHours(),
                m:  tIssueWorklog.startedAt.getMinutes(),
                s:  tIssueWorklog.startedAt.getSeconds(),
                ms: tIssueWorklog.startedAt.getMilliseconds(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select cast(strftime('%H', started_at) as integer) as "h", cast(strftime('%M', started_at) as integer) as "m", cast(strftime('%S', started_at) as integer) as "s", strftime('%f', started_at) * 1000 % 1000 as ms from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ h?: number | undefined; m?: number | undefined; s?: number | undefined; ms?: number | undefined }>>>()
        expect(rows).toEqual(expected)
    })

    test('custom-temporal-getters-and-compare', async () => {
        // The date/time getters and comparison on the custom temporal columns.
        // releasedOn (customLocalDate, required) -> getFullYear; cutoffTime
        // (customLocalTime, required) -> getHours; signedOffAt
        // (customLocalDateTime, optional) -> getTime (the custom getter encodes
        // the optional leaf as `t?: number`, not `number | undefined`); and
        // releasedOn.lessThan(date) -> boolean. Release 1: released_on
        // 2024-01-15, cutoff_time 17:00:00, signed_off_at 2024-01-14 12:30:00.
        const epoch = new Date(Date.UTC(2024, 0, 14, 12, 30, 0)).getTime()
        const expected = [{ y: 2024, h: 17, t: epoch, before: true }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({
                y:      tProjectRelease.releasedOn.getFullYear(),
                h:      tProjectRelease.cutoffTime.getHours(),
                t:      tProjectRelease.signedOffAt.getTime(),
                before: tProjectRelease.releasedOn.lessThan(new Date(Date.UTC(2024, 1, 1, 10, 0, 0))),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select cast(strftime('%Y', released_on) as integer) as "y", cast(strftime('%H', cutoff_time) as integer) as "h", round(unixepoch(signed_off_at, 'subsec') * 1000) as "t", released_on < ? as "before" from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-02-01",
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ y: number; h: number; t?: number; before: boolean }>>>()
        expect(rows).toEqual(expected)
    })

    test('optional-localdate-getters', async () => {
        // The OPTIONAL-receiver branch of LocalDateValueSource getters: reviewDate
        // is an OPTIONAL plain `localDate`, so each getter carries the optional
        // marker to a `number | undefined` leaf. Review 1: review_date 2024-05-20 (a
        // Monday) -> year 2024, month 4 (May, JS 0-indexed), date 20, day-of-week 1.
        const expected = [{ y: 2024, mo: 4, d: 20, dow: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tProjectReview)
            .where(tProjectReview.id.equals(1))
            .select({
                y:   tProjectReview.reviewDate.getFullYear(),
                mo:  tProjectReview.reviewDate.getMonth(),
                d:   tProjectReview.reviewDate.getDate(),
                dow: tProjectReview.reviewDate.getDay(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select cast(strftime('%Y', review_date) as integer) as "y", cast(strftime('%m', review_date) as integer) - 1 as mo, cast(strftime('%d', review_date) as integer) as "d", cast(strftime('%w',review_date) as integer) as dow from project_review where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ y?: number | undefined; mo?: number | undefined; d?: number | undefined; dow?: number | undefined }>>>()
        expect(rows).toEqual(expected)
    })

    test('required-localtime-getters', async () => {
        // The REQUIRED-receiver branch of LocalTimeValueSource getters: reviewTime
        // is a REQUIRED plain `localTime`, so each getter is a required `number`
        // leaf. Review 1: review_time 14:30:45 -> hours 14, minutes 30,
        // seconds 45, milliseconds 0.
        const expected = [{ h: 14, m: 30, s: 45, ms: 0 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tProjectReview)
            .where(tProjectReview.id.equals(1))
            .select({
                h:  tProjectReview.reviewTime.getHours(),
                m:  tProjectReview.reviewTime.getMinutes(),
                s:  tProjectReview.reviewTime.getSeconds(),
                ms: tProjectReview.reviewTime.getMilliseconds(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select cast(strftime('%H', review_time) as integer) as "h", cast(strftime('%M', review_time) as integer) as "m", cast(strftime('%S', review_time) as integer) as "s", strftime('%f', review_time) * 1000 % 1000 as ms from project_review where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ h: number; m: number; s: number; ms: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('custom-localdate-remaining-getters', async () => {
        // The remaining LocalDateValueSource getters on the custom-localDate
        // column releasedOn (required): getMonth (JS 0-indexed), getDate, and
        // getDay (JS 0 = Sunday). Release 1: released_on
        // 2024-01-15 (a Monday) -> month 0 (January), date 15, day-of-week 1.
        const expected = [{ mo: 0, d: 15, dow: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({
                mo:  tProjectRelease.releasedOn.getMonth(),
                d:   tProjectRelease.releasedOn.getDate(),
                dow: tProjectRelease.releasedOn.getDay(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select cast(strftime('%m', released_on) as integer) - 1 as mo, cast(strftime('%d', released_on) as integer) as "d", cast(strftime('%w',released_on) as integer) as dow from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ mo: number; d: number; dow: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('custom-localtime-remaining-getters', async () => {
        // The remaining LocalTimeValueSource getters on the custom-localTime
        // column cutoffTime (required): getMinutes, getSeconds, getMilliseconds.
        // Release 1: cutoff_time 17:00:00 -> 0, 0, 0.
        const expected = [{ m: 0, s: 0, ms: 0 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({
                m:  tProjectRelease.cutoffTime.getMinutes(),
                s:  tProjectRelease.cutoffTime.getSeconds(),
                ms: tProjectRelease.cutoffTime.getMilliseconds(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select cast(strftime('%M', cutoff_time) as integer) as "m", cast(strftime('%S', cutoff_time) as integer) as "s", strftime('%f', cutoff_time) * 1000 % 1000 as ms from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ m: number; s: number; ms: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('custom-localdatetime-optional-getters', async () => {
        // The full LocalDateTimeValueSource getter set on the OPTIONAL
        // custom-localDateTime column signedOffAt — every getter carries the
        // optional marker through to a `?: number` leaf (the custom getter
        // encodes the optional leaf as `?: number`, not `number | undefined`). Release 1: signed_off_at 2024-01-14 12:30:00 (a Sunday) ->
        // year 2024, month 0, date 14, day-of-week 0, hours 12, minutes 30,
        // seconds 0, milliseconds 0.
        const expected = [{ y: 2024, mo: 0, d: 14, dow: 0, h: 12, m: 30, s: 0, ms: 0 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({
                y:   tProjectRelease.signedOffAt.getFullYear(),
                mo:  tProjectRelease.signedOffAt.getMonth(),
                d:   tProjectRelease.signedOffAt.getDate(),
                dow: tProjectRelease.signedOffAt.getDay(),
                h:   tProjectRelease.signedOffAt.getHours(),
                m:   tProjectRelease.signedOffAt.getMinutes(),
                s:   tProjectRelease.signedOffAt.getSeconds(),
                ms:  tProjectRelease.signedOffAt.getMilliseconds(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select cast(strftime('%Y', signed_off_at) as integer) as "y", cast(strftime('%m', signed_off_at) as integer) - 1 as mo, cast(strftime('%d', signed_off_at) as integer) as "d", cast(strftime('%w',signed_off_at) as integer) as dow, cast(strftime('%H', signed_off_at) as integer) as "h", cast(strftime('%M', signed_off_at) as integer) as "m", cast(strftime('%S', signed_off_at) as integer) as "s", strftime('%f', signed_off_at) * 1000 % 1000 as ms from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ y?: number | undefined; mo?: number | undefined; d?: number | undefined; dow?: number | undefined; h?: number | undefined; m?: number | undefined; s?: number | undefined; ms?: number | undefined }>>>()
        expect(rows).toEqual(expected)
    })

    test('temporal-equals-and-not-equals', async () => {
        // Equalable members (`.equals` / `.notEquals`) on a temporal column.
        // releasedOn (customLocalDate): release
        // 1 → 2024-01-15, 2 → 2024-02-20, 3 → 2024-03-01. `.equals(2024-01-15)`
        // matches release 1; `.notEquals(2024-01-15)` matches 2 and 3.
        const target = new Date(Date.UTC(2024, 0, 15))
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.releasedOn.equals(target))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where released_on = ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-01-15",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)

        const expectedOthers = [{ id: 2 }, { id: 3 }]
        ctx.mockNext(expectedOthers)
        const others = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.releasedOn.notEquals(target))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where released_on <> ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-01-15",
          ]
        `)
        expect(others).toEqual(expectedOthers)
    })

    test('temporal-is-and-is-not', async () => {
        // `.is` / `.isNot` — the null-safe equality arm on a temporal column
        // (IS NOT DISTINCT FROM / IS DISTINCT FROM). For a non-null operand it
        // behaves like equals/notEquals but the leaf is always required.
        const target = new Date(Date.UTC(2024, 0, 15))
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.releasedOn.is(target))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where released_on is ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-01-15",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)

        const expectedOthers = [{ id: 2 }, { id: 3 }]
        ctx.mockNext(expectedOthers)
        const others = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.releasedOn.isNot(target))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where released_on is not ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-01-15",
          ]
        `)
        expect(others).toEqual(expectedOthers)
    })

    test('temporal-in-and-in-n', async () => {
        // `.in([d1, d2])` (array form) and `.inN(d1, d2)` (variadic form) on a
        // plain localDate column. work_date: worklog 1 → 2024-03-04, 2 →
        // 2024-03-05, 3 → 2024-03-06. `.in([03-04, 03-06])` matches 1 and 3;
        // `.inN(03-04, 03-05)` matches 1 and 2.
        const d1 = new Date(Date.UTC(2024, 2, 4))
        const d2 = new Date(Date.UTC(2024, 2, 5))
        const d3 = new Date(Date.UTC(2024, 2, 6))
        const expectedIn = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expectedIn)
        const inRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.workDate.in([d1, d3]))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where work_date in (?, ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-03-04",
            "2024-03-06",
          ]
        `)
        assertType<Exact<typeof inRows, Array<{ id: number }>>>()
        expect(inRows).toEqual(expectedIn)

        const expectedInN = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(expectedInN)
        const inNRows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.workDate.inN(d1, d2))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where work_date in (?, ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-03-04",
            "2024-03-05",
          ]
        `)
        expect(inNRows).toEqual(expectedInN)
    })

    test('temporal-between-and-not-between', async () => {
        // `.between(lo, hi)` / `.notBetween(lo, hi)` on a temporal column —
        // the Comparable 3-arg arm with Date bounds. releasedOn between
        // 2024-01-01 and 2024-02-28 matches releases 1 (01-15) and 2 (02-20);
        // notBetween matches release 3 (03-01).
        const lo = new Date(Date.UTC(2024, 0, 1))
        const hi = new Date(Date.UTC(2024, 1, 28))
        const expected = [{ id: 1 }, { id: 2 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.releasedOn.between(lo, hi))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where released_on between ? and ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-01-01",
            "2024-02-28",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)

        const expectedOut = [{ id: 3 }]
        ctx.mockNext(expectedOut)
        const out = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.releasedOn.notBetween(lo, hi))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where released_on not between ? and ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "2024-01-01",
            "2024-02-28",
          ]
        `)
        expect(out).toEqual(expectedOut)
    })

    test('temporal-between-value-source-bounds-projected-is-optional', async () => {
        // `between(temporalVS, temporalVS)` projecting the both-bound
        // optional-boolean leaf. The optional lower bound is synthesized with
        // `.asOptional()` on the same required custom-localDate column
        // (asOptional preserves the TYPE_NAME), so the bound's optionality
        // merges into the projected boolean (`?: boolean`). Release 1:
        // released_on 2024-01-15 is between itself and itself -> true.
        const expected = [{ id: 1, b: true }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({
                id: tProjectRelease.id,
                b:  tProjectRelease.releasedOn.between(tProjectRelease.releasedOn.asOptional(), tProjectRelease.releasedOn),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, released_on between released_on and released_on as "b" from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; b?: boolean }>>>()
        expect(result).toEqual(expected)
    })

    test('temporal-comparison-value-source-column-overload', async () => {
        // The temporal equals/notEquals/is/isNot VALUE-SOURCE-column overload:
        // comparing the `released_on` column with itself, equals/is are true and
        // notEquals/isNot are false. Both operands are required columns, so each
        // leaf is a plain required boolean.
        const expected = [{ id: 1, eq: true, ne: false, i: true, ni: false }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({
                id: tProjectRelease.id,
                eq: tProjectRelease.releasedOn.equals(tProjectRelease.releasedOn),
                ne: tProjectRelease.releasedOn.notEquals(tProjectRelease.releasedOn),
                i:  tProjectRelease.releasedOn.is(tProjectRelease.releasedOn),
                ni: tProjectRelease.releasedOn.isNot(tProjectRelease.releasedOn),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, released_on = released_on as eq, released_on <> released_on as ne, released_on is released_on as "i", released_on is not released_on as ni from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; eq: boolean; ne: boolean; i: boolean; ni: boolean }>>>()
        expect(result).toEqual(expected)
    })

    test('temporal-value-when-null-with-optional-value-source-default', async () => {
        // `valueWhenNull(optional value source)` on a temporal column — the
        // optional VS default keeps the result optional (`?: Date`). The default
        // is `.asOptional()` on the same column, present at runtime, so the value
        // is observed. Release 1: signed_off_at 2024-01-14 12:30.
        const expected = [{ id: 1, soff: new Date(Date.UTC(2024, 0, 14, 12, 30, 0)) }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({
                id:   tProjectRelease.id,
                soff: tProjectRelease.signedOffAt.valueWhenNull(tProjectRelease.signedOffAt.asOptional()),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ifnull(signed_off_at, signed_off_at) as soff from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; soff?: Date }>>>()
        expect(result).toEqual(expected)
    })
    test('optional-localdatetime-getters', async () => {
        // The getters of an OPTIONAL plain `localDateTime` (archivedAt): each of
        // the 9 getters carries the optional marker to a `number | undefined`
        // leaf. archivedAt is set to a fixed timestamp in-rollback so the values
        // are deterministic: 2024-06-15 13:45:30 (a Saturday) -> year 2024, month
        // 5 (June, JS 0-indexed), date 15, day-of-week 6, hours 13, minutes 45,
        // seconds 30, ms 0.
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            await ctx.conn.update(tProject)
                .set({ archivedAt: new Date(Date.UTC(2024, 5, 15, 13, 45, 30)) })
                .where(tProject.id.equals(1))
                .executeUpdate()

            const expected = [{
                y: 2024, mo: 5, d: 15, dow: 6, h: 13, m: 45, s: 30, ms: 0,
                t: Date.UTC(2024, 5, 15, 13, 45, 30),
            }]
            ctx.mockNext(expected)
            const rows = await ctx.conn.selectFrom(tProject)
                .where(tProject.id.equals(1))
                .select({
                    y:   tProject.archivedAt.getFullYear(),
                    mo:  tProject.archivedAt.getMonth(),
                    d:   tProject.archivedAt.getDate(),
                    dow: tProject.archivedAt.getDay(),
                    h:   tProject.archivedAt.getHours(),
                    m:   tProject.archivedAt.getMinutes(),
                    s:   tProject.archivedAt.getSeconds(),
                    ms:  tProject.archivedAt.getMilliseconds(),
                    t:   tProject.archivedAt.getTime(),
                })
                .executeSelectMany()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"select cast(strftime('%Y', archived_at) as integer) as "y", cast(strftime('%m', archived_at) as integer) - 1 as mo, cast(strftime('%d', archived_at) as integer) as "d", cast(strftime('%w',archived_at) as integer) as dow, cast(strftime('%H', archived_at) as integer) as "h", cast(strftime('%M', archived_at) as integer) as "m", cast(strftime('%S', archived_at) as integer) as "s", strftime('%f', archived_at) * 1000 % 1000 as ms, round(unixepoch(archived_at, 'subsec') * 1000) as "t" from project where id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof rows, Array<{
                y?: number | undefined; mo?: number | undefined; d?: number | undefined
                dow?: number | undefined; h?: number | undefined; m?: number | undefined
                s?: number | undefined; ms?: number | undefined; t?: number | undefined
            }>>>()
            expect(rows).toEqual(expected)
        })
    })

})
