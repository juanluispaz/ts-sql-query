// Behavioral coverage of date/time operators. Uses the seeded
// `created_at` columns and connection-level `currentDate` /
// `currentDateTime` helpers.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tOrganization, tIssueWorklog, tProjectRelease } from '../../domain/connection.js'
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
})
