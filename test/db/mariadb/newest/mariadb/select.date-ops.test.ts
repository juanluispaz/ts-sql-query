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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select current_date as today"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select current_timestamp as now"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, year(created_at) as year from organization where id = ?"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, month(created_at) - 1 as month, dayofmonth(created_at) as date from organization where id = ?"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, hour(created_at) as \`h\`, minute(created_at) as \`m\`, second(created_at) as \`s\` from issue where id = ?"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, dayofweek(created_at) - 1 as dow from organization where id = ?"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, round(unix_timestamp(created_at) * 1000) as \`t\` from organization where id = ?"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, round(microsecond(created_at) / 1000) as ms from issue where id = ?"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from organization where created_at <= current_timestamp order by id"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select year(work_date) as \`y\`, month(work_date) - 1 as mo, dayofmonth(work_date) as \`d\`, dayofweek(work_date) - 1 as dow from issue_worklog where id = ?"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select hour(started_at) as \`h\`, minute(started_at) as \`m\`, second(started_at) as \`s\`, round(microsecond(started_at) / 1000) as ms from issue_worklog where id = ?"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select year(released_on) as \`y\`, hour(cutoff_time) as \`h\`, round(unix_timestamp(signed_off_at) * 1000) as \`t\`, released_on < ? as \`before\` from project_release where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2024-02-01T10:00:00.000Z,
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ y: number; h: number; t?: number; before: boolean }>>>()
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
            2024-01-15T00:00:00.000Z,
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
            2024-01-15T00:00:00.000Z,
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where released_on <=> ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2024-01-15T00:00:00.000Z,
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where not (released_on <=> ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2024-01-15T00:00:00.000Z,
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
            2024-03-04T00:00:00.000Z,
            2024-03-06T00:00:00.000Z,
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
            2024-03-04T00:00:00.000Z,
            2024-03-05T00:00:00.000Z,
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
            2024-01-01T00:00:00.000Z,
            2024-02-28T00:00:00.000Z,
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
            2024-01-01T00:00:00.000Z,
            2024-02-28T00:00:00.000Z,
          ]
        `)
        expect(out).toEqual(expectedOut)
    })
})
