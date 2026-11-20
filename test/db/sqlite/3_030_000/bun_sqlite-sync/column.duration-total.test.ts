// The total of a duration in a unit, as Temporal's total: without a date of reference a day is 24 hours and a duration
// with years, months or weeks fails the query; with one the duration is added to it and the unit counted from it. Every
// expected value is the one Temporal gives. duration_value: span is 1 3 days 04:05:06.789, 2 -1 day -2 hours, 3 01:30;
// span_text is the ISO 8601 text P1Y2M3DT4H5M6.789S, -PT26H and PT90M; span_calendar is 1 year 2 months in row 1 and
// null in the others. project_release: released_on 2024-01-15, 2024-02-20 and 2024-03-01, published_at
// 2024-01-16 09:00, 2024-02-21 10:00 and 2024-03-02 11:00, rollout_time 1 day 12:00:00, 00:45:00 and 2 days.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { TsSqlError } from '../../../../../src/exports/v2/index.js'
import { tDurationValue, tRelease } from '../../domain/connection.js'
import { ctx } from './setup.js'
import { sync } from '../../../../../src/extras/sync.js'

async function rejectionOf(query: Promise<unknown>): Promise<boolean> {
    try {
        await query
        return false
    } catch (error) {
        return error instanceof TsSqlError
    }
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('the-total-in-days-or-a-unit-of-time', async () => {
        ctx.mockNext([
            { id: 1, days: 3.1702174652777777, hours: 76.08521916666666 },
            { id: 2, days: -1.0833333333333333, hours: -26 },
            { id: 3, days: 0.0625, hours: 1.5 },
        ])
        const rows = sync(ctx.conn.selectFrom(tDurationValue)
            .select({
                id: tDurationValue.id,
                days: tDurationValue.span.total('day'),
                hours: tDurationValue.span.total({ unit: 'hours' }),
            })
            .orderBy('id')
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, tsq_duration_total(tsq_duration_part(span, 'M'), tsq_duration_part(span, 'weeks'), tsq_duration_part(span, 'days'), tsq_duration_part(span, 'S'), tsq_duration_part(span, 'N'), 0, 0, 0, 'day') as days, tsq_duration_total(tsq_duration_part(span, 'M'), tsq_duration_part(span, 'weeks'), tsq_duration_part(span, 'days'), tsq_duration_part(span, 'S'), tsq_duration_part(span, 'N'), 0, 0, 0, 'hour') as hours from duration_value order by id"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; days: number; hours: number }>>>()
        expect(rows.map(row => [row.id, row.days, row.hours])).toEqual([
            [1, 3.1702174652777777, 76.08521916666666],
            [2, -1.0833333333333333, -26],
            [3, 0.0625, 1.5],
        ])
    })

    test('the-total-of-a-duration-kept-as-text', async () => {
        ctx.mockNext([
            { id: 2, minutes: -1560, milliseconds: -93600000 },
            { id: 3, minutes: 90, milliseconds: 5400000 },
        ])
        const rows = sync(ctx.conn.selectFrom(tDurationValue)
            .where(tDurationValue.id.greaterThan(1))
            .select({
                id: tDurationValue.id,
                minutes: tDurationValue.spanText.total('minutes'),
                milliseconds: tDurationValue.spanText.total('millisecond'),
            })
            .orderBy('id')
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, tsq_duration_total(tsq_duration_part(span_text, 'M'), tsq_duration_part(span_text, 'weeks'), tsq_duration_part(span_text, 'days'), tsq_duration_part(span_text, 'S'), tsq_duration_part(span_text, 'N'), 0, 0, 0, 'minute') as minutes, tsq_duration_total(tsq_duration_part(span_text, 'M'), tsq_duration_part(span_text, 'weeks'), tsq_duration_part(span_text, 'days'), tsq_duration_part(span_text, 'S'), tsq_duration_part(span_text, 'N'), 0, 0, 0, 'millisecond') as milliseconds from duration_value where id > ?1 order by id"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "1",
          ]
        `)
        assertType<Exact<(typeof rows)[number]['minutes'], number | undefined>>()
        expect(rows.map(row => [row.id, row.minutes, row.milliseconds])).toEqual([
            [2, -1560, -93600000],
            [3, 90, 5400000],
        ])
    })

    test('a-duration-with-months-without-a-date-of-reference-fails-the-query', async () => {
        // P1Y2M3DT4H5M6.789S has years and months: Temporal can't total it without a date of reference
        ctx.mockNext([{ id: 1, days: 428 }])
        const rejected = await rejectionOf(ctx.conn.selectFrom(tDurationValue)
            .where(tDurationValue.id.equals(1))
            .select({ id: tDurationValue.id, days: tDurationValue.spanText.total('days') })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, tsq_duration_total(tsq_duration_part(span_text, 'M'), tsq_duration_part(span_text, 'weeks'), tsq_duration_part(span_text, 'days'), tsq_duration_part(span_text, 'S'), tsq_duration_part(span_text, 'N'), 0, 0, 0, 'day') as days from duration_value where id = ?1"`)
        expect(rejected).toBe(ctx.realDbEnabled)
    })

    test('the-total-from-a-date-of-reference', async () => {
        ctx.mockNext([
            { id: 1, months: 0.04838709677419355, weeks: 0.21428571428571427, years: 0.004098360655737705, hours: 36 },
            { id: 2, months: 0.0010775862068965517, weeks: 0.004464285714285714, years: 0.00008538251366120219, hours: 0.75 },
            { id: 3, months: 0.06451612903225806, weeks: 0.2857142857142857, years: 0.005479452054794521, hours: 48 },
        ])
        const rows = sync(ctx.conn.selectFrom(tRelease)
            .select({
                id: tRelease.id,
                months: tRelease.rolloutTime.total({ unit: 'month', relativeTo: tRelease.releasedOn }),
                // Of a date and time, only the date counts
                weeks: tRelease.rolloutTime.total({ unit: 'weeks', relativeTo: tRelease.publishedAt }),
                years: tRelease.rolloutTime.total({ unit: 'year', relativeTo: tRelease.releasedOn }),
                hours: tRelease.rolloutTime.total({ unit: 'hour', relativeTo: tRelease.releasedOn }),
            })
            .orderBy('id')
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, tsq_duration_total(tsq_duration_part(rollout_time, 'M'), tsq_duration_part(rollout_time, 'weeks'), tsq_duration_part(rollout_time, 'days'), tsq_duration_part(rollout_time, 'S'), tsq_duration_part(rollout_time, 'N'), cast(strftime('%Y', released_on) as integer), cast(strftime('%m', released_on) as integer), cast(strftime('%d', released_on) as integer), 'month') as months, tsq_duration_total(tsq_duration_part(rollout_time, 'M'), tsq_duration_part(rollout_time, 'weeks'), tsq_duration_part(rollout_time, 'days'), tsq_duration_part(rollout_time, 'S'), tsq_duration_part(rollout_time, 'N'), cast(strftime('%Y', published_at) as integer), cast(strftime('%m', published_at) as integer), cast(strftime('%d', published_at) as integer), 'week') as weeks, tsq_duration_total(tsq_duration_part(rollout_time, 'M'), tsq_duration_part(rollout_time, 'weeks'), tsq_duration_part(rollout_time, 'days'), tsq_duration_part(rollout_time, 'S'), tsq_duration_part(rollout_time, 'N'), cast(strftime('%Y', released_on) as integer), cast(strftime('%m', released_on) as integer), cast(strftime('%d', released_on) as integer), 'year') as years, tsq_duration_total(tsq_duration_part(rollout_time, 'M'), tsq_duration_part(rollout_time, 'weeks'), tsq_duration_part(rollout_time, 'days'), tsq_duration_part(rollout_time, 'S'), tsq_duration_part(rollout_time, 'N'), cast(strftime('%Y', released_on) as integer), cast(strftime('%m', released_on) as integer), cast(strftime('%d', released_on) as integer), 'hour') as hours from project_release order by id"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`[]`)
        assertType<Exact<(typeof rows)[number]['months'], number | undefined>>()
        expect(rows.map(row => [row.id, row.months, row.weeks, row.years, row.hours])).toEqual([
            [1, 0.04838709677419355, 0.21428571428571427, 0.004098360655737705, 36],
            [2, 0.0010775862068965517, 0.004464285714285714, 0.00008538251366120219, 0.75],
            [3, 0.06451612903225806, 0.2857142857142857, 0.005479452054794521, 48],
        ])
    })

    test('the-total-of-a-duration-of-years-and-months', async () => {
        // P1Y2M from January 31, 2024 lands on March 31, 2025: 425 days
        ctx.mockNext([{ id: 1, days: 425, months: 14 }, { id: 2, days: null, months: null }, { id: 3, days: null, months: null }])
        const rows = sync(ctx.conn.selectFrom(tDurationValue)
            .select({
                id: tDurationValue.id,
                days: tDurationValue.spanCalendar.total({ unit: 'days', relativeTo: Temporal.PlainDate.from('2024-01-31') }),
                months: tDurationValue.spanCalendar.total({ unit: 'months', relativeTo: Temporal.PlainDate.from('2024-01-31') }),
            })
            .orderBy('id')
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, tsq_duration_total(tsq_duration_part(span_calendar, 'M'), tsq_duration_part(span_calendar, 'weeks'), tsq_duration_part(span_calendar, 'days'), tsq_duration_part(span_calendar, 'S'), tsq_duration_part(span_calendar, 'N'), 2024, 1, 31, 'day') as days, tsq_duration_total(tsq_duration_part(span_calendar, 'M'), tsq_duration_part(span_calendar, 'weeks'), tsq_duration_part(span_calendar, 'days'), tsq_duration_part(span_calendar, 'S'), tsq_duration_part(span_calendar, 'N'), 2024, 1, 31, 'month') as months from duration_value order by id"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`[]`)
        assertType<Exact<(typeof rows)[number]['days'], number | undefined>>()
        expect(rows.map(row => [row.id, row.days, row.months])).toEqual([[1, 425, 14], [2, undefined, undefined], [3, undefined, undefined]])
    })

    test('the-total-from-a-date-given', async () => {
        // From January 31, 2024: a month is the days to February 29, and P1Y2M lands on March 31, 2025
        ctx.mockNext([
            { id: 1, months: 14.105673915509259, days: 428.1702174652778, years: 1.1703293629185691 },
            { id: 2, months: -0.03494623655913978, days: -1.0833333333333333, years: -0.0029680365296803654 },
            { id: 3, months: 0.0021551724137931034, days: 0.0625, years: 0.00017076502732240437 },
        ])
        const rows = sync(ctx.conn.selectFrom(tDurationValue)
            .select({
                id: tDurationValue.id,
                months: tDurationValue.spanText.total({ unit: 'month', relativeTo: Temporal.PlainDate.from('2024-01-31') }),
                days: tDurationValue.spanText.total({ unit: 'day', relativeTo: Temporal.PlainDate.from('2024-01-31') }),
                // Of a date and time, only the date counts
                years: tDurationValue.spanText.total({ unit: 'year', relativeTo: Temporal.PlainDateTime.from('2024-01-31T23:00') }),
            })
            .orderBy('id')
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, tsq_duration_total(tsq_duration_part(span_text, 'M'), tsq_duration_part(span_text, 'weeks'), tsq_duration_part(span_text, 'days'), tsq_duration_part(span_text, 'S'), tsq_duration_part(span_text, 'N'), 2024, 1, 31, 'month') as months, tsq_duration_total(tsq_duration_part(span_text, 'M'), tsq_duration_part(span_text, 'weeks'), tsq_duration_part(span_text, 'days'), tsq_duration_part(span_text, 'S'), tsq_duration_part(span_text, 'N'), 2024, 1, 31, 'day') as days, tsq_duration_total(tsq_duration_part(span_text, 'M'), tsq_duration_part(span_text, 'weeks'), tsq_duration_part(span_text, 'days'), tsq_duration_part(span_text, 'S'), tsq_duration_part(span_text, 'N'), 2024, 1, 31, 'year') as years from duration_value order by id"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`[]`)
        assertType<Exact<(typeof rows)[number]['months'], number | undefined>>()
        expect(rows.map(row => [row.id, row.months, row.days, row.years])).toEqual([
            [1, 14.105673915509259, 428.1702174652778, 1.1703293629185691],
            [2, -0.03494623655913978, -1.0833333333333333, -0.0029680365296803654],
            [3, 0.0021551724137931034, 0.0625, 0.00017076502732240437],
        ])
    })

    test('the-total-of-a-difference', async () => {
        // 2024-01-31 until 2024-03-30 is P1M30D in months: 1 month and 30 of the 31 days to April 30
        ctx.mockNext({ months: 1.967741935483871, days: 59 })
        const january31 = ctx.conn.const(Temporal.PlainDate.from('2024-01-31'), 'plainDate')
        const row = sync(ctx.conn.selectFromNoTable()
            .select({
                months: january31.until(Temporal.PlainDate.from('2024-03-30'), { largestUnit: 'month' }).total({ unit: 'month', relativeTo: january31 }),
                days: january31.until(Temporal.PlainDate.from('2024-03-30')).total('days'),
            })
            .executeSelectOne())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select tsq_duration_total(tsq_duration_part(tsq_duration_round(cast(strftime('%Y', ?1) as integer), cast(strftime('%m', ?1) as integer), cast(strftime('%d', ?1) as integer), 0, cast(strftime('%Y', ?2) as integer), cast(strftime('%m', ?2) as integer), cast(strftime('%d', ?2) as integer), 0, 'month', 'day', 1, 'trunc', 1), 'M'), tsq_duration_part(tsq_duration_round(cast(strftime('%Y', ?3) as integer), cast(strftime('%m', ?3) as integer), cast(strftime('%d', ?3) as integer), 0, cast(strftime('%Y', ?4) as integer), cast(strftime('%m', ?4) as integer), cast(strftime('%d', ?4) as integer), 0, 'month', 'day', 1, 'trunc', 1), 'weeks'), tsq_duration_part(tsq_duration_round(cast(strftime('%Y', ?5) as integer), cast(strftime('%m', ?5) as integer), cast(strftime('%d', ?5) as integer), 0, cast(strftime('%Y', ?6) as integer), cast(strftime('%m', ?6) as integer), cast(strftime('%d', ?6) as integer), 0, 'month', 'day', 1, 'trunc', 1), 'days'), tsq_duration_part(tsq_duration_round(cast(strftime('%Y', ?7) as integer), cast(strftime('%m', ?7) as integer), cast(strftime('%d', ?7) as integer), 0, cast(strftime('%Y', ?8) as integer), cast(strftime('%m', ?8) as integer), cast(strftime('%d', ?8) as integer), 0, 'month', 'day', 1, 'trunc', 1), 'S'), tsq_duration_part(tsq_duration_round(cast(strftime('%Y', ?9) as integer), cast(strftime('%m', ?9) as integer), cast(strftime('%d', ?9) as integer), 0, cast(strftime('%Y', ?10) as integer), cast(strftime('%m', ?10) as integer), cast(strftime('%d', ?10) as integer), 0, 'month', 'day', 1, 'trunc', 1), 'N'), cast(strftime('%Y', ?11) as integer), cast(strftime('%m', ?11) as integer), cast(strftime('%d', ?11) as integer), 'month') as months, tsq_duration_total(0, 0, cast(julianday(date(?12)) - julianday(date(?13)) as integer), 0, 0, 0, 0, 0, 'day') as days"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
            "2024-03-30",
            "2024-01-31",
          ]
        `)
        assertType<Exact<typeof row, { months: number; days: number }>>()
        expect([row.months, row.days]).toEqual([1.967741935483871, 59])
    })
})
