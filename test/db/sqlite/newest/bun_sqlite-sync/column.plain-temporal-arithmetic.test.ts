// Durations added to and subtracted from dates and times without zone, with the semantics of Temporal's add and
// subtract. duration_value 1 has span 3 days 04:05:06.789, span_calendar 1 year 2 months and span_text
// P1Y2M3DT4H5M6.789S; 2 has span -1 day -2 hours and span_text -PT26H.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tDurationValue } from '../../domain/connection.js'
import { ctx } from './setup.js'
import { sync } from '../../../../../src/extras/sync.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('a-month-added-keeps-the-day-in-the-month', async () => {
        ctx.mockNext({ endOfFebruary: '2024-02-29', afterLeapDay: '2025-02-28', monthBefore: '2024-02-29', moment: '2024-02-29 10:00:00.5' })
        const january31 = ctx.conn.const(Temporal.PlainDate.from('2024-01-31'), 'plainDate')
        const row = sync(ctx.conn.selectFromNoTable()
            .select({
                endOfFebruary: january31.add({ months: 1 }),
                afterLeapDay: ctx.conn.const(Temporal.PlainDate.from('2024-02-29'), 'plainDate').add(Temporal.Duration.from('P1Y')),
                monthBefore: ctx.conn.const(Temporal.PlainDate.from('2024-03-31'), 'plainDate').subtract({ months: 1 }),
                moment: ctx.conn.const(Temporal.PlainDateTime.from('2024-01-31T10:00:00.5'), 'plainDateTime').add({ months: 1 }),
            })
            .executeSelectOne())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select date(date(?2, 'start of month', ?1), (min(cast(strftime('%d', ?2) as integer), cast(strftime('%d', date(?2, 'start of month', ?1), '+1 months', '-1 days') as integer)) - 1) || ' days') as endOfFebruary, date(date(?4, 'start of month', ?3), (min(cast(strftime('%d', ?4) as integer), cast(strftime('%d', date(?4, 'start of month', ?3), '+1 months', '-1 days') as integer)) - 1) || ' days') as afterLeapDay, date(date(?6, 'start of month', ?5), (min(cast(strftime('%d', ?6) as integer), cast(strftime('%d', date(?6, 'start of month', ?5), '+1 months', '-1 days') as integer)) - 1) || ' days') as monthBefore, strftime('%Y-%m-%d %H:%M:%f', date(date(?8, 'start of month', ?7), (min(cast(strftime('%d', ?8) as integer), cast(strftime('%d', date(?8, 'start of month', ?7), '+1 months', '-1 days') as integer)) - 1) || ' days') || ' ' || strftime('%H:%M:%f', ?8)) as moment"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "1 months",
            "2024-01-31",
            "12 months",
            "2024-02-29",
            "-1 months",
            "2024-03-31",
            "1 months",
            "2024-01-31 10:00:00.500",
          ]
        `)
        assertType<Exact<typeof row, { endOfFebruary: Temporal.PlainDate; afterLeapDay: Temporal.PlainDate; monthBefore: Temporal.PlainDate; moment: Temporal.PlainDateTime }>>()
        expect([row.endOfFebruary.toString(), row.afterLeapDay.toString(), row.monthBefore.toString(), row.moment.toString()]).toEqual(['2024-02-29', '2025-02-28', '2024-02-29', '2024-02-29T10:00:00.5'])
    })

    test('a-plain-date-adds-the-whole-days-of-the-time', async () => {
        // 36 hours are one day, and minus 36 hours minus one day; a week is 7 days
        ctx.mockNext({ later: '2024-03-02', earlier: '2024-02-29', nextWeek: '2024-03-08' })
        const march1 = ctx.conn.const(Temporal.PlainDate.from('2024-03-01'), 'plainDate')
        const row = sync(ctx.conn.selectFromNoTable()
            .select({
                later: march1.add({ hours: 36 }),
                earlier: march1.subtract({ hours: 36 }),
                nextWeek: march1.add({ weeks: 1 }),
            })
            .executeSelectOne())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select date(?2, ?1) as later, date(?4, ?3) as earlier, date(?6, ?5) as nextWeek"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "1 days",
            "2024-03-01",
            "-1 days",
            "2024-03-01",
            "7 days",
            "2024-03-01",
          ]
        `)
        expect([row.later.toString(), row.earlier.toString(), row.nextWeek.toString()]).toEqual(['2024-03-02', '2024-02-29', '2024-03-08'])
    })

    test('a-plain-time-goes-round-at-midnight', async () => {
        // A time takes only the time of the duration: a day adds nothing
        ctx.mockNext({ afterMidnight: '00:30:00', beforeMidnight: '23:30:00', sameTime: '12:00:00', fraction: '10:00:01.5' })
        const row = sync(ctx.conn.selectFromNoTable()
            .select({
                afterMidnight: ctx.conn.const(Temporal.PlainTime.from('23:30'), 'plainTime').add({ hours: 1 }),
                beforeMidnight: ctx.conn.const(Temporal.PlainTime.from('00:30'), 'plainTime').subtract({ hours: 1 }),
                sameTime: ctx.conn.const(Temporal.PlainTime.from('10:00'), 'plainTime').add({ days: 1, hours: 2 }),
                fraction: ctx.conn.const(Temporal.PlainTime.from('10:00'), 'plainTime').add({ seconds: 1, milliseconds: 500 }),
            })
            .executeSelectOne())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select strftime('%H:%M:%f', ?2, ?1) as afterMidnight, strftime('%H:%M:%f', ?4, ?3) as beforeMidnight, strftime('%H:%M:%f', ?6, ?5) as sameTime, strftime('%H:%M:%f', ?8, ?7) as fraction"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "3600 seconds",
            "23:30:00.000",
            "-3600 seconds",
            "00:30:00.000",
            "7200 seconds",
            "10:00:00.000",
            "1.5 seconds",
            "10:00:00.000",
          ]
        `)
        assertType<Exact<typeof row, { afterMidnight: Temporal.PlainTime; beforeMidnight: Temporal.PlainTime; sameTime: Temporal.PlainTime; fraction: Temporal.PlainTime }>>()
        expect([row.afterMidnight.toString(), row.beforeMidnight.toString(), row.sameTime.toString(), row.fraction.toString()]).toEqual(['00:30:00', '23:30:00', '12:00:00', '10:00:01.5'])
    })

    test('a-plain-date-time-adds-the-days-and-the-time', async () => {
        ctx.mockNext({ later: '2024-03-01 01:30:00', earlier: '2024-01-30 22:00:00' })
        const row = sync(ctx.conn.selectFromNoTable()
            .select({
                later: ctx.conn.const(Temporal.PlainDateTime.from('2024-02-28T23:00'), 'plainDateTime').add({ days: 1, hours: 2, minutes: 30 }),
                earlier: ctx.conn.const(Temporal.PlainDateTime.from('2024-03-31T00:00'), 'plainDateTime').subtract({ months: 1, days: 29, hours: 2 }),
            })
            .executeSelectOne())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select strftime('%Y-%m-%d %H:%M:%f', ?3, ?1, ?2) as later, strftime('%Y-%m-%d %H:%M:%f', date(date(?7, 'start of month', ?4), (min(cast(strftime('%d', ?7) as integer), cast(strftime('%d', date(?7, 'start of month', ?4), '+1 months', '-1 days') as integer)) - 1) || ' days') || ' ' || strftime('%H:%M:%f', ?7), ?5, ?6) as earlier"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "1 days",
            "9000 seconds",
            "2024-02-28 23:00:00.000",
            "-1 months",
            "-29 days",
            "-7200 seconds",
            "2024-03-31 00:00:00.000",
          ]
        `)
        expect([row.later.toString(), row.earlier.toString()]).toEqual(['2024-03-01T01:30:00', '2024-01-30T22:00:00'])
    })

    test('a-duration-of-a-column-is-added-and-subtracted', async () => {
        ctx.mockNext([
            { id: 1, day: '2024-02-03', calendarDay: '2025-03-31', textDay: '2025-04-03', moment: '2024-01-04 14:05:06.789', textMoment: '2025-03-04 14:05:06.789', time: '14:05:06.789', earlier: '2022-10-29 05:54:53.211' },
            { id: 2, day: '2024-01-30', textDay: '2024-01-30', moment: '2023-12-31 08:00:00', textMoment: '2023-12-31 08:00:00', time: '08:00:00' },
        ])
        const january31 = ctx.conn.const(Temporal.PlainDate.from('2024-01-31'), 'plainDate')
        const january1 = ctx.conn.const(Temporal.PlainDateTime.from('2024-01-01T10:00'), 'plainDateTime')
        const rows = sync(ctx.conn.selectFrom(tDurationValue)
            .where(tDurationValue.id.in([1, 2]))
            .select({
                id: tDurationValue.id,
                day: january31.add(tDurationValue.span),
                calendarDay: january31.add(tDurationValue.spanCalendar),
                textDay: january31.add(tDurationValue.spanText),
                moment: january1.add(tDurationValue.span),
                textMoment: january1.add(tDurationValue.spanText),
                time: ctx.conn.const(Temporal.PlainTime.from('10:00'), 'plainTime').add(tDurationValue.spanText),
                earlier: january1.subtract(tDurationValue.span).subtract(tDurationValue.spanCalendar),
            })
            .orderBy('id')
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, date(date(?1, 'start of month', (tsq_duration_part(span, 'M')) || ' months'), (min(cast(strftime('%d', ?1) as integer), cast(strftime('%d', date(?1, 'start of month', (tsq_duration_part(span, 'M')) || ' months'), '+1 months', '-1 days') as integer)) - 1) || ' days', (tsq_duration_part(span, 'D') + cast(tsq_duration_part(span, 'S') / 86400 as integer)) || ' days') as day, date(date(?2, 'start of month', (tsq_duration_part(span_calendar, 'M')) || ' months'), (min(cast(strftime('%d', ?2) as integer), cast(strftime('%d', date(?2, 'start of month', (tsq_duration_part(span_calendar, 'M')) || ' months'), '+1 months', '-1 days') as integer)) - 1) || ' days', (tsq_duration_part(span_calendar, 'D') + cast(tsq_duration_part(span_calendar, 'S') / 86400 as integer)) || ' days') as calendarDay, date(date(?3, 'start of month', (tsq_duration_part(span_text, 'M')) || ' months'), (min(cast(strftime('%d', ?3) as integer), cast(strftime('%d', date(?3, 'start of month', (tsq_duration_part(span_text, 'M')) || ' months'), '+1 months', '-1 days') as integer)) - 1) || ' days', (tsq_duration_part(span_text, 'D') + cast(tsq_duration_part(span_text, 'S') / 86400 as integer)) || ' days') as textDay, strftime('%Y-%m-%d %H:%M:%f', date(date(?4, 'start of month', (tsq_duration_part(span, 'M')) || ' months'), (min(cast(strftime('%d', ?4) as integer), cast(strftime('%d', date(?4, 'start of month', (tsq_duration_part(span, 'M')) || ' months'), '+1 months', '-1 days') as integer)) - 1) || ' days') || ' ' || strftime('%H:%M:%f', ?4), (tsq_duration_part(span, 'D')) || ' days', (tsq_duration_part(span, 'S') + tsq_duration_part(span, 'N') / 1000000000.0) || ' seconds') as moment, strftime('%Y-%m-%d %H:%M:%f', date(date(?5, 'start of month', (tsq_duration_part(span_text, 'M')) || ' months'), (min(cast(strftime('%d', ?5) as integer), cast(strftime('%d', date(?5, 'start of month', (tsq_duration_part(span_text, 'M')) || ' months'), '+1 months', '-1 days') as integer)) - 1) || ' days') || ' ' || strftime('%H:%M:%f', ?5), (tsq_duration_part(span_text, 'D')) || ' days', (tsq_duration_part(span_text, 'S') + tsq_duration_part(span_text, 'N') / 1000000000.0) || ' seconds') as textMoment, strftime('%H:%M:%f', ?6, (tsq_duration_part(span_text, 'S') + tsq_duration_part(span_text, 'N') / 1000000000.0) || ' seconds') as time, strftime('%Y-%m-%d %H:%M:%f', date(date(strftime('%Y-%m-%d %H:%M:%f', date(date(?7, 'start of month', (-tsq_duration_part(span, 'M')) || ' months'), (min(cast(strftime('%d', ?7) as integer), cast(strftime('%d', date(?7, 'start of month', (-tsq_duration_part(span, 'M')) || ' months'), '+1 months', '-1 days') as integer)) - 1) || ' days') || ' ' || strftime('%H:%M:%f', ?7), (-tsq_duration_part(span, 'D')) || ' days', (-tsq_duration_part(span, 'S') + -tsq_duration_part(span, 'N') / 1000000000.0) || ' seconds'), 'start of month', (-tsq_duration_part(span_calendar, 'M')) || ' months'), (min(cast(strftime('%d', strftime('%Y-%m-%d %H:%M:%f', date(date(?7, 'start of month', (-tsq_duration_part(span, 'M')) || ' months'), (min(cast(strftime('%d', ?7) as integer), cast(strftime('%d', date(?7, 'start of month', (-tsq_duration_part(span, 'M')) || ' months'), '+1 months', '-1 days') as integer)) - 1) || ' days') || ' ' || strftime('%H:%M:%f', ?7), (-tsq_duration_part(span, 'D')) || ' days', (-tsq_duration_part(span, 'S') + -tsq_duration_part(span, 'N') / 1000000000.0) || ' seconds')) as integer), cast(strftime('%d', date(strftime('%Y-%m-%d %H:%M:%f', date(date(?7, 'start of month', (-tsq_duration_part(span, 'M')) || ' months'), (min(cast(strftime('%d', ?7) as integer), cast(strftime('%d', date(?7, 'start of month', (-tsq_duration_part(span, 'M')) || ' months'), '+1 months', '-1 days') as integer)) - 1) || ' days') || ' ' || strftime('%H:%M:%f', ?7), (-tsq_duration_part(span, 'D')) || ' days', (-tsq_duration_part(span, 'S') + -tsq_duration_part(span, 'N') / 1000000000.0) || ' seconds'), 'start of month', (-tsq_duration_part(span_calendar, 'M')) || ' months'), '+1 months', '-1 days') as integer)) - 1) || ' days') || ' ' || strftime('%H:%M:%f', strftime('%Y-%m-%d %H:%M:%f', date(date(?7, 'start of month', (-tsq_duration_part(span, 'M')) || ' months'), (min(cast(strftime('%d', ?7) as integer), cast(strftime('%d', date(?7, 'start of month', (-tsq_duration_part(span, 'M')) || ' months'), '+1 months', '-1 days') as integer)) - 1) || ' days') || ' ' || strftime('%H:%M:%f', ?7), (-tsq_duration_part(span, 'D')) || ' days', (-tsq_duration_part(span, 'S') + -tsq_duration_part(span, 'N') / 1000000000.0) || ' seconds')), (-tsq_duration_part(span_calendar, 'D')) || ' days', (-tsq_duration_part(span_calendar, 'S') + -tsq_duration_part(span_calendar, 'N') / 1000000000.0) || ' seconds') as earlier from duration_value where id in (?8, ?9) order by id"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2024-01-31",
            "2024-01-31",
            "2024-01-31",
            "2024-01-01 10:00:00.000",
            "2024-01-01 10:00:00.000",
            "10:00:00.000",
            "2024-01-01 10:00:00.000",
            "1",
            "2",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; day: Temporal.PlainDate; calendarDay?: Temporal.PlainDate; textDay?: Temporal.PlainDate; moment: Temporal.PlainDateTime; textMoment?: Temporal.PlainDateTime; time?: Temporal.PlainTime; earlier?: Temporal.PlainDateTime }>>>()
        expect(rows.map(row => [row.id, row.day.toString(), row.calendarDay?.toString(), row.textDay?.toString(), row.moment.toString(), row.textMoment?.toString(), row.time?.toString(), row.earlier?.toString()])).toEqual([
            [1, '2024-02-03', '2025-03-31', '2025-04-03', '2024-01-04T14:05:06.789', '2025-03-04T14:05:06.789', '14:05:06.789', '2022-10-29T05:54:53.211'],
            [2, '2024-01-30', undefined, '2024-01-30', '2023-12-31T08:00:00', '2023-12-31T08:00:00', '08:00:00', undefined],
        ])
    })
})
