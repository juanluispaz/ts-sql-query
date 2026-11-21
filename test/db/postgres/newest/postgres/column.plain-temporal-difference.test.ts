// The duration between two dates, times or dates and times without zone, with the semantics of Temporal's until and
// since and their options. Every expected value is the one Temporal gives. PostgreSQL keeps a duration in an interval:
// its months hold the years, its days the weeks, and its time is read in hours.
// project_release (tRelease): 1 released on 2024-01-15, cut off at 17:00, published at 2024-01-16 09:00; 2 on
// 2024-02-20, 18:30, 2024-02-21 10:00; 3 on 2024-03-01, 16:00, 2024-03-02 11:00.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tRelease } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('in-days-by-default-and-in-hours-for-a-time', async () => {
        ctx.mockNext({ days: '59 days', daysBefore: '-59 days', dateTime: '58 days 22:00:00', time: '-01:30:00', timeSince: '01:30:00' })
        const row = await ctx.conn.selectFromNoTable()
            .select({
                days: ctx.conn.const(Temporal.PlainDate.from('2024-01-31'), 'plainDate').until(Temporal.PlainDate.from('2024-03-30')),
                daysBefore: ctx.conn.const(Temporal.PlainDate.from('2024-01-31'), 'plainDate').since(Temporal.PlainDate.from('2024-03-30')),
                dateTime: ctx.conn.const(Temporal.PlainDateTime.from('2024-01-31T10:00'), 'plainDateTime').until(Temporal.PlainDateTime.from('2024-03-30T08:00')),
                time: ctx.conn.const(Temporal.PlainTime.from('10:00'), 'plainTime').until(Temporal.PlainTime.from('08:30')),
                timeSince: ctx.conn.const(Temporal.PlainTime.from('10:00'), 'plainTime').since(Temporal.PlainTime.from('08:30')),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select make_interval(days => ($1 - $2)) as days, make_interval(days => -($3 - $4)) as "daysBefore", ($5 - $6) as "dateTime", make_interval(secs => (extract(epoch from $7 - $8) * 1000000000)::bigint / 1000000000.0) as time, make_interval(secs => -(extract(epoch from $9 - $10) * 1000000000)::bigint / 1000000000.0) as "timeSince""`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30T08:00:00",
            "2024-01-31T10:00:00",
            "08:30:00",
            "10:00:00",
            "08:30:00",
            "10:00:00",
          ]
        `)
        assertType<Exact<typeof row, { days: Temporal.Duration; daysBefore: Temporal.Duration; dateTime: Temporal.Duration; time: Temporal.Duration; timeSince: Temporal.Duration }>>()
        expect([row.days.toString(), row.daysBefore.toString(), row.dateTime.toString(), row.time.toString(), row.timeSince.toString()]).toEqual(['P59D', '-P59D', 'P58DT22H', '-PT1H30M', 'PT1H30M'])
    })

    test('whole-months-that-do-not-pass-the-other-date', async () => {
        // The day of the first date isn't kept in the month when counting: Jan 31 plus a month would be Feb 31, past Feb 29
        ctx.mockNext({ february: '29 days', march1: '1 mon 1 day', march30: '1 mon 30 days', back: '-1 mons', leapYear: '11 mons 30 days', nextYear: '1 year 1 day' })
        const january31 = ctx.conn.const(Temporal.PlainDate.from('2024-01-31'), 'plainDate')
        const row = await ctx.conn.selectFromNoTable()
            .select({
                february: january31.until(Temporal.PlainDate.from('2024-02-29'), { largestUnit: 'month' }),
                march1: january31.until(Temporal.PlainDate.from('2024-03-01'), { largestUnit: 'months' }),
                march30: january31.until(Temporal.PlainDate.from('2024-03-30'), { largestUnit: 'month' }),
                back: ctx.conn.const(Temporal.PlainDate.from('2024-03-31'), 'plainDate').until(Temporal.PlainDate.from('2024-02-29'), { largestUnit: 'month' }),
                leapYear: ctx.conn.const(Temporal.PlainDate.from('2024-02-29'), 'plainDate').until(Temporal.PlainDate.from('2025-02-28'), { largestUnit: 'year' }),
                nextYear: ctx.conn.const(Temporal.PlainDate.from('2024-02-29'), 'plainDate').until(Temporal.PlainDate.from('2025-03-01'), { largestUnit: 'year' }),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select tsq_duration_round(cast(extract(year from $1) as integer), cast(extract(month from $1) as integer), cast(extract(day from $1) as integer), 0, cast(extract(year from $2) as integer), cast(extract(month from $2) as integer), cast(extract(day from $2) as integer), 0, 'month', 'day', 1, 'trunc', 1) as february, tsq_duration_round(cast(extract(year from $3) as integer), cast(extract(month from $3) as integer), cast(extract(day from $3) as integer), 0, cast(extract(year from $4) as integer), cast(extract(month from $4) as integer), cast(extract(day from $4) as integer), 0, 'month', 'day', 1, 'trunc', 1) as march1, tsq_duration_round(cast(extract(year from $5) as integer), cast(extract(month from $5) as integer), cast(extract(day from $5) as integer), 0, cast(extract(year from $6) as integer), cast(extract(month from $6) as integer), cast(extract(day from $6) as integer), 0, 'month', 'day', 1, 'trunc', 1) as march30, tsq_duration_round(cast(extract(year from $7) as integer), cast(extract(month from $7) as integer), cast(extract(day from $7) as integer), 0, cast(extract(year from $8) as integer), cast(extract(month from $8) as integer), cast(extract(day from $8) as integer), 0, 'month', 'day', 1, 'trunc', 1) as back, tsq_duration_round(cast(extract(year from $9) as integer), cast(extract(month from $9) as integer), cast(extract(day from $9) as integer), 0, cast(extract(year from $10) as integer), cast(extract(month from $10) as integer), cast(extract(day from $10) as integer), 0, 'year', 'day', 1, 'trunc', 1) as "leapYear", tsq_duration_round(cast(extract(year from $11) as integer), cast(extract(month from $11) as integer), cast(extract(day from $11) as integer), 0, cast(extract(year from $12) as integer), cast(extract(month from $12) as integer), cast(extract(day from $12) as integer), 0, 'year', 'day', 1, 'trunc', 1) as "nextYear""`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2024-01-31",
            "2024-02-29",
            "2024-01-31",
            "2024-03-01",
            "2024-01-31",
            "2024-03-30",
            "2024-03-31",
            "2024-02-29",
            "2024-02-29",
            "2025-02-28",
            "2024-02-29",
            "2025-03-01",
          ]
        `)
        expect([row.february.toString(), row.march1.toString(), row.march30.toString(), row.back.toString(), row.leapYear.toString(), row.nextYear.toString()]).toEqual(['P29D', 'P1M1D', 'P1M30D', '-P1M', 'P11M30D', 'P1Y1D'])
    })

    test('since-counts-from-the-value-as-until-does', async () => {
        // since is until negated: Jan 31 since Mar 30 counts from Jan 31 (-P1M30D), not from Mar 30 (Mar 30 until Jan 31 is -P1M29D)
        ctx.mockNext({ since: '-1 mons -30 days', untilBack: '-1 mons -29 days', weeks: '74 days' })
        const row = await ctx.conn.selectFromNoTable()
            .select({
                since: ctx.conn.const(Temporal.PlainDate.from('2024-01-31'), 'plainDate').since(Temporal.PlainDate.from('2024-03-30'), { largestUnit: 'month' }),
                untilBack: ctx.conn.const(Temporal.PlainDate.from('2024-03-30'), 'plainDate').until(Temporal.PlainDate.from('2024-01-31'), { largestUnit: 'month' }),
                // Temporal's P10W4D: the interval keeps the weeks as days
                weeks: ctx.conn.const(Temporal.PlainDate.from('2024-01-01'), 'plainDate').until(Temporal.PlainDate.from('2024-03-15'), { largestUnit: 'week' }),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select tsq_duration_round(cast(extract(year from $1) as integer), cast(extract(month from $1) as integer), cast(extract(day from $1) as integer), 0, cast(extract(year from $2) as integer), cast(extract(month from $2) as integer), cast(extract(day from $2) as integer), 0, 'month', 'day', 1, 'trunc', -1) as since, tsq_duration_round(cast(extract(year from $3) as integer), cast(extract(month from $3) as integer), cast(extract(day from $3) as integer), 0, cast(extract(year from $4) as integer), cast(extract(month from $4) as integer), cast(extract(day from $4) as integer), 0, 'month', 'day', 1, 'trunc', 1) as "untilBack", make_interval(weeks => (($5 - $6) / 7), days => (($5 - $6) % 7)) as weeks"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2024-01-31",
            "2024-03-30",
            "2024-03-30",
            "2024-01-31",
            "2024-03-15",
            "2024-01-01",
          ]
        `)
        expect([row.since.toString(), row.untilBack.toString(), row.weeks.toString()]).toEqual(['-P1M30D', '-P1M29D', 'P74D'])
    })

    test('a-date-and-time-counts-a-day-only-when-its-time-is-reached', async () => {
        // From 23:00 to 01:00 of the next day there is no whole day; in minutes Temporal gives PT120M, the interval 02:00:00
        ctx.mockNext({ overnight: '02:00:00', inMinutes: '02:00:00', months: '28 days 23:00:00' })
        const row = await ctx.conn.selectFromNoTable()
            .select({
                overnight: ctx.conn.const(Temporal.PlainDateTime.from('2024-01-01T23:00'), 'plainDateTime').until(Temporal.PlainDateTime.from('2024-01-02T01:00')),
                inMinutes: ctx.conn.const(Temporal.PlainDateTime.from('2024-01-01T23:00'), 'plainDateTime').until(Temporal.PlainDateTime.from('2024-01-02T01:00'), { largestUnit: 'minute' }),
                months: ctx.conn.const(Temporal.PlainDateTime.from('2024-01-31T10:00'), 'plainDateTime').until(Temporal.PlainDateTime.from('2024-02-29T09:00'), { largestUnit: 'month' }),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ($1 - $2) as overnight, make_interval(hours => cast(div((extract(epoch from $3 - $4) * 1000000000), 3600000000000) as integer), secs => (extract(epoch from $3 - $4) * 1000000000) % 3600000000000 / 1000000000.0) as "inMinutes", tsq_duration_round(cast(extract(year from $5) as integer), cast(extract(month from $5) as integer), cast(extract(day from $5) as integer), (round(extract(epoch from cast($5 as time)) * 1000000)::bigint * 1000), cast(extract(year from $6) as integer), cast(extract(month from $6) as integer), cast(extract(day from $6) as integer), (round(extract(epoch from cast($6 as time)) * 1000000)::bigint * 1000), 'month', 'nanosecond', 1, 'trunc', 1) as months"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2024-01-02T01:00:00",
            "2024-01-01T23:00:00",
            "2024-01-02T01:00:00",
            "2024-01-01T23:00:00",
            "2024-01-31T10:00:00",
            "2024-02-29T09:00:00",
          ]
        `)
        expect([row.overnight.toString(), row.inMinutes.toString(), row.months.toString()]).toEqual(['PT2H', 'PT2H', 'P28DT23H'])
    })

    test('rounded-to-a-unit-of-the-time', async () => {
        // -1:29:59.5 to the second: floor gives -1:30:00, trunc (the default) -1:29:59
        ctx.mockNext({ floor: '-01:30:00', trunc: '-01:29:59', quarter: '02:15:00', hour: '2 days 03:00:00' })
        const row = await ctx.conn.selectFromNoTable()
            .select({
                floor: ctx.conn.const(Temporal.PlainTime.from('10:00'), 'plainTime').until(Temporal.PlainTime.from('08:30:00.5'), { smallestUnit: 'second', roundingMode: 'floor' }),
                trunc: ctx.conn.const(Temporal.PlainTime.from('10:00'), 'plainTime').until(Temporal.PlainTime.from('08:30:00.5'), { smallestUnit: 'second' }),
                quarter: ctx.conn.const(Temporal.PlainTime.from('08:00'), 'plainTime').until(Temporal.PlainTime.from('10:08'), { smallestUnit: 'minute', roundingIncrement: 15, roundingMode: 'halfExpand' }),
                hour: ctx.conn.const(Temporal.PlainDateTime.from('2024-03-01T08:00'), 'plainDateTime').until(Temporal.PlainDateTime.from('2024-03-03T10:40'), { smallestUnit: 'hour', roundingMode: 'halfExpand' }),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select make_interval(secs => ((((extract(epoch from $1 - $2) * 1000000000)::bigint - case when (extract(epoch from $1 - $2) * 1000000000)::bigint < 0 then 999999999 else 0 end) / 1000000000) * 1000000000) / 1000000000.0) as floor, make_interval(secs => (((extract(epoch from $3 - $4) * 1000000000)::bigint / 1000000000) * 1000000000) / 1000000000.0) as trunc, make_interval(secs => (((2 * (extract(epoch from $5 - $6) * 1000000000)::bigint + case when (extract(epoch from $5 - $6) * 1000000000)::bigint < 0 then -900000000000 else 900000000000 end) / 1800000000000) * 900000000000) / 1000000000.0) as quarter, make_interval(days => cast(div((div((2 * (extract(epoch from $7 - $8) * 1000000000) + case when (extract(epoch from $7 - $8) * 1000000000) < 0 then -3600000000000 else 3600000000000 end), 7200000000000) * 3600000000000), 86400000000000) as integer), secs => ((div((2 * (extract(epoch from $7 - $8) * 1000000000) + case when (extract(epoch from $7 - $8) * 1000000000) < 0 then -3600000000000 else 3600000000000 end), 7200000000000) * 3600000000000) % 86400000000000) / 1000000000.0) as hour"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "08:30:00.5",
            "10:00:00",
            "08:30:00.5",
            "10:00:00",
            "10:08:00",
            "08:00:00",
            "2024-03-03T10:40:00",
            "2024-03-01T08:00:00",
          ]
        `)
        expect([row.floor.toString(), row.trunc.toString(), row.quarter.toString(), row.hour.toString()]).toEqual(['-PT1H30M', '-PT1H29M59S', 'PT2H15M', 'P2DT3H'])
    })

    test('rounded-to-a-calendar-unit', async () => {
        // Jan 1 to Mar 15 is P2M14D: to the month P2M, to the week P2M2W (the interval keeps its weeks as days); to Mar 17
        // half up P3M (16 of 31 days);
        // 19 months half up to the year P2Y; since with ceil rounds toward the future: -P2M14D to -P2M
        ctx.mockNext({ month: '2 mons', week: '2 mons 14 days', halfUp: '3 mons', year: '2 years', sinceCeil: '-2 mons' })
        const january1 = ctx.conn.const(Temporal.PlainDate.from('2024-01-01'), 'plainDate')
        const row = await ctx.conn.selectFromNoTable()
            .select({
                month: january1.until(Temporal.PlainDate.from('2024-03-15'), { smallestUnit: 'month' }),
                week: january1.until(Temporal.PlainDate.from('2024-03-15'), { largestUnit: 'month', smallestUnit: 'week' }),
                halfUp: january1.until(Temporal.PlainDate.from('2024-03-17'), { smallestUnit: 'month', roundingMode: 'halfExpand' }),
                year: january1.until(Temporal.PlainDate.from('2025-08-01'), { smallestUnit: 'year', roundingMode: 'halfExpand' }),
                sinceCeil: january1.since(Temporal.PlainDate.from('2024-03-15'), { smallestUnit: 'month', roundingMode: 'ceil' }),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select tsq_duration_round(cast(extract(year from $1) as integer), cast(extract(month from $1) as integer), cast(extract(day from $1) as integer), 0, cast(extract(year from $2) as integer), cast(extract(month from $2) as integer), cast(extract(day from $2) as integer), 0, 'month', 'month', 1, 'trunc', 1) as month, tsq_duration_round(cast(extract(year from $3) as integer), cast(extract(month from $3) as integer), cast(extract(day from $3) as integer), 0, cast(extract(year from $4) as integer), cast(extract(month from $4) as integer), cast(extract(day from $4) as integer), 0, 'month', 'week', 1, 'trunc', 1) as week, tsq_duration_round(cast(extract(year from $5) as integer), cast(extract(month from $5) as integer), cast(extract(day from $5) as integer), 0, cast(extract(year from $6) as integer), cast(extract(month from $6) as integer), cast(extract(day from $6) as integer), 0, 'month', 'month', 1, 'halfExpand', 1) as "halfUp", tsq_duration_round(cast(extract(year from $7) as integer), cast(extract(month from $7) as integer), cast(extract(day from $7) as integer), 0, cast(extract(year from $8) as integer), cast(extract(month from $8) as integer), cast(extract(day from $8) as integer), 0, 'year', 'year', 1, 'halfExpand', 1) as year, tsq_duration_round(cast(extract(year from $9) as integer), cast(extract(month from $9) as integer), cast(extract(day from $9) as integer), 0, cast(extract(year from $10) as integer), cast(extract(month from $10) as integer), cast(extract(day from $10) as integer), 0, 'month', 'month', 1, 'floor', -1) as "sinceCeil""`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2024-01-01",
            "2024-03-15",
            "2024-01-01",
            "2024-03-15",
            "2024-01-01",
            "2024-03-17",
            "2024-01-01",
            "2025-08-01",
            "2024-01-01",
            "2024-03-15",
          ]
        `)
        expect([row.month.toString(), row.week.toString(), row.halfUp.toString(), row.year.toString(), row.sinceCeil.toString()]).toEqual(['P2M', 'P2M14D', 'P3M', 'P2Y', '-P2M'])
    })

    test('days-rounded-up-to-the-next-month', async () => {
        // Jan 1 to Jan 31 is P30D: rounded up to 7 days it is 35 days, past Feb 1: Temporal gives a month
        ctx.mockNext({ rounded: '1 mon' })
        const row = await ctx.conn.selectFromNoTable()
            .select({
                rounded: ctx.conn.const(Temporal.PlainDate.from('2024-01-01'), 'plainDate').until(Temporal.PlainDate.from('2024-01-31'), { largestUnit: 'month', smallestUnit: 'day', roundingIncrement: 7, roundingMode: 'ceil' }),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select tsq_duration_round(cast(extract(year from $1) as integer), cast(extract(month from $1) as integer), cast(extract(day from $1) as integer), 0, cast(extract(year from $2) as integer), cast(extract(month from $2) as integer), cast(extract(day from $2) as integer), 0, 'month', 'day', 7, 'ceil', 1) as rounded"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2024-01-01",
            "2024-01-31",
          ]
        `)
        expect(row.rounded.toString()).toBe('P1M')
    })

    test('between-columns', async () => {
        ctx.mockNext([
            { id: 1, toPublication: '1 day', sinceRelease: '33:00:00', cutoffToPublication: '-08:00:00' },
            { id: 2, toPublication: '1 day', sinceRelease: '34:00:00', cutoffToPublication: '-08:30:00' },
            { id: 3, toPublication: '1 day', sinceRelease: '35:00:00', cutoffToPublication: '-05:00:00' },
        ])
        const rows = await ctx.conn.selectFrom(tRelease)
            .select({
                id: tRelease.id,
                toPublication: tRelease.releasedOn.until(tRelease.publishedAt.toPlainDate()),
                sinceRelease: tRelease.publishedAt.since(tRelease.releasedOn.toPlainDateTime(), { largestUnit: 'hour' }),
                cutoffToPublication: tRelease.cutoffTime.until(tRelease.publishedAt.toPlainTime()),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, make_interval(days => (cast(published_at as date) - released_on)) as "toPublication", make_interval(hours => cast(div(-(extract(epoch from cast(released_on as timestamp) - published_at) * 1000000000), 3600000000000) as integer), secs => -(extract(epoch from cast(released_on as timestamp) - published_at) * 1000000000) % 3600000000000 / 1000000000.0) as "sinceRelease", make_interval(secs => (extract(epoch from cast(published_at as time) - cutoff_time) * 1000000000)::bigint / 1000000000.0) as "cutoffToPublication" from project_release order by id"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; toPublication: Temporal.Duration; sinceRelease: Temporal.Duration; cutoffToPublication: Temporal.Duration }>>>()
        expect(rows.map(row => [row.id, row.toPublication.toString(), row.sinceRelease.toString(), row.cutoffToPublication.toString()])).toEqual([
            [1, 'P1D', 'PT33H', '-PT8H'],
            [2, 'P1D', 'PT34H', '-PT8H30M'],
            [3, 'P1D', 'PT35H', '-PT5H'],
        ])
    })

    test('the-duration-added-to-the-first-gives-the-second', async () => {
        // A duration computed by the query is a duration like any other: the release date plus the time to the
        // publication is the date of the publication
        ctx.mockNext([
            { id: 1, publication: '2024-01-16' },
            { id: 2, publication: '2024-02-21' },
            { id: 3, publication: '2024-03-02' },
        ])
        const rows = await ctx.conn.selectFrom(tRelease)
            .select({
                id: tRelease.id,
                publication: tRelease.releasedOn.add(tRelease.releasedOn.until(tRelease.publishedAt.toPlainDate(), { largestUnit: 'month' })),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cast(released_on + make_interval(months => (extract(year from tsq_duration_round(cast(extract(year from released_on) as integer), cast(extract(month from released_on) as integer), cast(extract(day from released_on) as integer), 0, cast(extract(year from cast(published_at as date)) as integer), cast(extract(month from cast(published_at as date)) as integer), cast(extract(day from cast(published_at as date)) as integer), 0, 'month', 'day', 1, 'trunc', 1)) * 12 + extract(month from tsq_duration_round(cast(extract(year from released_on) as integer), cast(extract(month from released_on) as integer), cast(extract(day from released_on) as integer), 0, cast(extract(year from cast(published_at as date)) as integer), cast(extract(month from cast(published_at as date)) as integer), cast(extract(day from cast(published_at as date)) as integer), 0, 'month', 'day', 1, 'trunc', 1)))::integer, days => (extract(day from tsq_duration_round(cast(extract(year from released_on) as integer), cast(extract(month from released_on) as integer), cast(extract(day from released_on) as integer), 0, cast(extract(year from cast(published_at as date)) as integer), cast(extract(month from cast(published_at as date)) as integer), cast(extract(day from cast(published_at as date)) as integer), 0, 'month', 'day', 1, 'trunc', 1)) + trunc(extract(epoch from tsq_duration_round(cast(extract(year from released_on) as integer), cast(extract(month from released_on) as integer), cast(extract(day from released_on) as integer), 0, cast(extract(year from cast(published_at as date)) as integer), cast(extract(month from cast(published_at as date)) as integer), cast(extract(day from cast(published_at as date)) as integer), 0, 'month', 'day', 1, 'trunc', 1) - date_trunc('day', tsq_duration_round(cast(extract(year from released_on) as integer), cast(extract(month from released_on) as integer), cast(extract(day from released_on) as integer), 0, cast(extract(year from cast(published_at as date)) as integer), cast(extract(month from cast(published_at as date)) as integer), cast(extract(day from cast(published_at as date)) as integer), 0, 'month', 'day', 1, 'trunc', 1))) / 86400))::integer) as date) as publication from project_release order by id"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`[]`)
        expect(rows.map(row => [row.id, row.publication.toString()])).toEqual([[1, '2024-01-16'], [2, '2024-02-21'], [3, '2024-03-02']])
    })

    test('options-temporal-rejects-are-rejected', async () => {
        // As Temporal: a smallest unit larger than the largest one, an increment below 1, an increment that doesn't divide
        // the next unit; the query isn't sent
        const date = ctx.conn.const(Temporal.PlainDate.from('2024-01-01'), 'plainDate')
        const time = ctx.conn.const(Temporal.PlainTime.from('10:00'), 'plainTime')
        const messages: string[] = []
        for (const value of [
            date.until(Temporal.PlainDate.from('2024-02-01'), { largestUnit: 'day', smallestUnit: 'month' }),
            date.until(Temporal.PlainDate.from('2024-02-01'), { roundingIncrement: 0 }),
            time.until(Temporal.PlainTime.from('11:00'), { smallestUnit: 'minute', roundingIncrement: 7 }),
            time.since(Temporal.PlainTime.from('11:00'), { smallestUnit: 'second', roundingIncrement: 45 }),
        ]) {
            try {
                await ctx.conn.selectFromNoTable().select({ value }).executeSelectOne()
                messages.push('sent')
            } catch (error) {
                messages.push((error as Error).message)
            }
        }
        expect(messages).toEqual([
            'INVALID_VALUE_TO_SEND_TO_DATABASE: Invalid options of until: {"largestUnit":"day","smallestUnit":"month"}',
            'INVALID_VALUE_TO_SEND_TO_DATABASE: Invalid options of until: {"roundingIncrement":0}',
            'INVALID_VALUE_TO_SEND_TO_DATABASE: Invalid options of until: {"smallestUnit":"minute","roundingIncrement":7}',
            'INVALID_VALUE_TO_SEND_TO_DATABASE: Invalid options of since: {"smallestUnit":"second","roundingIncrement":45}',
        ])
    })
})
