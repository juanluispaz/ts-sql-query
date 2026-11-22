// Durations added to and subtracted from dates and times without zone, with the semantics of Temporal's add and
// subtract. duration_value 1 has span 3 days 04:05:06.789, span_calendar 1 year 2 months and span_text
// P1Y2M3DT4H5M6.789S; 2 has span -1 day -2 hours and span_text -PT26H.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tDurationValue, tColMatrixPlain } from '../../domain/connection.js'
import { ctx } from './setup.js'
import { TsSqlError } from '../../../../../src/exports/v2/index.js'

/** Whether the query fails with an error of the database */
async function failureOf(query: Promise<unknown>): Promise<boolean> {
    try {
        await query
        return false
    } catch (error) {
        return error instanceof TsSqlError
    }
}

/** The text of each value, as the database gives it */
function asRow(values: Record<string, { toString(): string }>): Record<string, string> {
    const row: Record<string, string> = {}
    for (const key in values) {
        row[key] = values[key]!.toString().replace('T', ' ')
    }
    return row
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('a-month-added-keeps-the-day-in-the-month', async () => {
        ctx.mockNext({ endOfFebruary: '2024-02-29', afterLeapDay: '2025-02-28', monthBefore: '2024-02-29', moment: '2024-02-29 10:00:00.5' })
        const january31 = ctx.conn.const(Temporal.PlainDate.from('2024-01-31'), 'plainDate')
        const row = await ctx.conn.selectFromNoTable()
            .select({
                endOfFebruary: january31.add({ months: 1 }),
                afterLeapDay: ctx.conn.const(Temporal.PlainDate.from('2024-02-29'), 'plainDate').add(Temporal.Duration.from('P1Y')),
                monthBefore: ctx.conn.const(Temporal.PlainDate.from('2024-03-31'), 'plainDate').subtract({ months: 1 }),
                moment: ctx.conn.const(Temporal.PlainDateTime.from('2024-01-31T10:00:00.5'), 'plainDateTime').add({ months: 1 }),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select dateadd(month, @1, @0) as endOfFebruary, dateadd(month, @3, @2) as afterLeapDay, dateadd(month, @5, @4) as monthBefore, dateadd(month, @7, @6) as moment"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2024-01-31",
            "1",
            "2024-02-29",
            "12",
            "2024-03-31",
            "-1",
            "2024-01-31T10:00:00.5",
            "1",
          ]
        `)
        assertType<Exact<typeof row, { endOfFebruary: Temporal.PlainDate; afterLeapDay: Temporal.PlainDate; monthBefore: Temporal.PlainDate; moment: Temporal.PlainDateTime }>>()
        expect([row.endOfFebruary.toString(), row.afterLeapDay.toString(), row.monthBefore.toString(), row.moment.toString()]).toEqual(['2024-02-29', '2025-02-28', '2024-02-29', '2024-02-29T10:00:00.5'])
    })

    test('a-plain-date-adds-the-whole-days-of-the-time', async () => {
        // 36 hours are one day, and minus 36 hours minus one day; a week is 7 days
        ctx.mockNext({ later: '2024-03-02', earlier: '2024-02-29', nextWeek: '2024-03-08' })
        const march1 = ctx.conn.const(Temporal.PlainDate.from('2024-03-01'), 'plainDate')
        const row = await ctx.conn.selectFromNoTable()
            .select({
                later: march1.add({ hours: 36 }),
                earlier: march1.subtract({ hours: 36 }),
                nextWeek: march1.add({ weeks: 1 }),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select dateadd(day, @1, @0) as later, dateadd(day, @3, @2) as earlier, dateadd(day, @5, @4) as nextWeek"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2024-03-01",
            "1",
            "2024-03-01",
            "-1",
            "2024-03-01",
            "7",
          ]
        `)
        expect([row.later.toString(), row.earlier.toString(), row.nextWeek.toString()]).toEqual(['2024-03-02', '2024-02-29', '2024-03-08'])
    })

    test('a-plain-time-goes-round-at-midnight', async () => {
        // A time takes only the time of the duration: a day adds nothing
        ctx.mockNext({ afterMidnight: '00:30:00', beforeMidnight: '23:30:00', sameTime: '12:00:00', fraction: '10:00:01.5' })
        const row = await ctx.conn.selectFromNoTable()
            .select({
                afterMidnight: ctx.conn.const(Temporal.PlainTime.from('23:30'), 'plainTime').add({ hours: 1 }),
                beforeMidnight: ctx.conn.const(Temporal.PlainTime.from('00:30'), 'plainTime').subtract({ hours: 1 }),
                sameTime: ctx.conn.const(Temporal.PlainTime.from('10:00'), 'plainTime').add({ days: 1, hours: 2 }),
                fraction: ctx.conn.const(Temporal.PlainTime.from('10:00'), 'plainTime').add({ seconds: 1, milliseconds: 500 }),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select dateadd(second, @1, @0) as afterMidnight, dateadd(second, @3, @2) as beforeMidnight, dateadd(second, @5, @4) as sameTime, dateadd(nanosecond, @8, dateadd(second, @7, @6)) as fraction"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "23:30:00",
            "3600",
            "00:30:00",
            "-3600",
            "10:00:00",
            "7200",
            "10:00:00",
            "1",
            "500000000",
          ]
        `)
        assertType<Exact<typeof row, { afterMidnight: Temporal.PlainTime; beforeMidnight: Temporal.PlainTime; sameTime: Temporal.PlainTime; fraction: Temporal.PlainTime }>>()
        expect([row.afterMidnight.toString(), row.beforeMidnight.toString(), row.sameTime.toString(), row.fraction.toString()]).toEqual(['00:30:00', '23:30:00', '12:00:00', '10:00:01.5'])
    })

    test('a-plain-date-time-adds-the-days-and-the-time', async () => {
        ctx.mockNext({ later: '2024-03-01 01:30:00', earlier: '2024-01-30 22:00:00' })
        const row = await ctx.conn.selectFromNoTable()
            .select({
                later: ctx.conn.const(Temporal.PlainDateTime.from('2024-02-28T23:00'), 'plainDateTime').add({ days: 1, hours: 2, minutes: 30 }),
                earlier: ctx.conn.const(Temporal.PlainDateTime.from('2024-03-31T00:00'), 'plainDateTime').subtract({ months: 1, days: 29, hours: 2 }),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select dateadd(second, @2, dateadd(day, @1, @0)) as later, dateadd(second, @6, dateadd(day, @5, dateadd(month, @4, @3))) as earlier"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2024-02-28T23:00:00",
            "1",
            "9000",
            "2024-03-31T00:00:00",
            "-1",
            "-29",
            "-7200",
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
        const rows = await ctx.conn.selectFrom(tDurationValue)
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
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, dateadd(day, (dbo.tsq_duration_part(span, 'D') + dbo.tsq_duration_part(span, 'S') / 86400), dateadd(month, dbo.tsq_duration_part(span, 'M'), @0)) as day, dateadd(day, (dbo.tsq_duration_part(span_calendar, 'D') + dbo.tsq_duration_part(span_calendar, 'S') / 86400), dateadd(month, dbo.tsq_duration_part(span_calendar, 'M'), @1)) as calendarDay, dateadd(day, (dbo.tsq_duration_part(span_text, 'D') + dbo.tsq_duration_part(span_text, 'S') / 86400), dateadd(month, dbo.tsq_duration_part(span_text, 'M'), @2)) as textDay, dateadd(nanosecond, dbo.tsq_duration_part(span, 'N'), dateadd(second, dbo.tsq_duration_part(span, 'S') % 86400, dateadd(day, (dbo.tsq_duration_part(span, 'D') + dbo.tsq_duration_part(span, 'S') / 86400), dateadd(month, dbo.tsq_duration_part(span, 'M'), @3)))) as moment, dateadd(nanosecond, dbo.tsq_duration_part(span_text, 'N'), dateadd(second, dbo.tsq_duration_part(span_text, 'S') % 86400, dateadd(day, (dbo.tsq_duration_part(span_text, 'D') + dbo.tsq_duration_part(span_text, 'S') / 86400), dateadd(month, dbo.tsq_duration_part(span_text, 'M'), @4)))) as textMoment, dateadd(nanosecond, dbo.tsq_duration_part(span_text, 'N'), dateadd(second, dbo.tsq_duration_part(span_text, 'S') % 86400, @5)) as time, dateadd(nanosecond, -dbo.tsq_duration_part(span_calendar, 'N'), cast(dateadd(second, -dbo.tsq_duration_part(span_calendar, 'S') % 86400, dateadd(day, (-dbo.tsq_duration_part(span_calendar, 'D') + -dbo.tsq_duration_part(span_calendar, 'S') / 86400), dateadd(month, -dbo.tsq_duration_part(span_calendar, 'M'), dateadd(nanosecond, -dbo.tsq_duration_part(span, 'N'), dateadd(second, -dbo.tsq_duration_part(span, 'S') % 86400, dateadd(day, (-dbo.tsq_duration_part(span, 'D') + -dbo.tsq_duration_part(span, 'S') / 86400), dateadd(month, -dbo.tsq_duration_part(span, 'M'), @6))))))) as datetime2)) as earlier from duration_value where id in (@7, @8) order by id"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2024-01-31",
            "2024-01-31",
            "2024-01-31",
            "2024-01-01T10:00:00",
            "2024-01-01T10:00:00",
            "10:00:00",
            "2024-01-01T10:00:00",
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

    test('a-duration-of-fields-of-the-query-is-added-and-subtracted', async () => {
        // Each field is an integer or an int of the query, as Temporal's Duration.from takes numbers: the int 42 of the
        // row, and that int negated
        const date = Temporal.PlainDate.from('2024-03-04')
        const time = Temporal.PlainTime.from('09:15')
        const dateTime = Temporal.PlainDateTime.from('2024-01-14T12:30')
        const expected = {
            inDays: date.add({ days: 42 }),
            inMonthsAndDays: date.subtract({ months: 42, days: 1 }),
            inYearsAndMonths: date.add({ years: 1, months: 42 }),
            wholeDaysOfHours: date.add({ hours: 42 }),
            negated: date.add({ weeks: -42 }),
            timeInHours: time.add({ hours: 42, minutes: 30 }),
            inDaysAndHours: dateTime.add({ days: 42, hours: 42, milliseconds: 5 }),
            minusMonths: dateTime.subtract({ months: 42 }),
            inMilliseconds: dateTime.add({ milliseconds: 4200 }),
        }
        ctx.mockNext([asRow(expected)])
        const negated = ctx.conn.const(0, 'int').subtract(tColMatrixPlain.mInt)
        const rows = await ctx.conn.selectFrom(tColMatrixPlain)
            .where(tColMatrixPlain.id.equals(1))
            .select({
                inDays: tColMatrixPlain.mDate.add({ days: tColMatrixPlain.mInt }),
                inMonthsAndDays: tColMatrixPlain.mDate.subtract({ months: tColMatrixPlain.mInt, days: 1 }),
                inYearsAndMonths: tColMatrixPlain.mDate.add({ years: 1, months: tColMatrixPlain.mInt }),
                wholeDaysOfHours: tColMatrixPlain.mDate.add({ hours: tColMatrixPlain.mInt }),
                negated: tColMatrixPlain.mDate.add({ weeks: negated }),
                timeInHours: tColMatrixPlain.mTime.add({ hours: tColMatrixPlain.mInt, minutes: 30 }),
                inDaysAndHours: tColMatrixPlain.mDatetime.add({ days: tColMatrixPlain.mInt, hours: tColMatrixPlain.mInt, milliseconds: 5 }),
                minusMonths: tColMatrixPlain.mDatetime.subtract({ months: tColMatrixPlain.mInt }),
                inMilliseconds: tColMatrixPlain.mDatetime.add({ milliseconds: tColMatrixPlain.mInt.multiply(ctx.conn.const(100, 'int')) }),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select dateadd(day, m_int, m_date) as inDays, dateadd(day, (day(datefromparts(2001, 2, case when m_int < 0 then 29 else 28 end)) - 28), dateadd(day, -1, dateadd(month, -m_int, m_date))) as inMonthsAndDays, dateadd(day, (day(datefromparts(2001, 2, case when m_int < 0 then 29 else 28 end)) - 28), dateadd(month, (m_int + 12), m_date)) as inYearsAndMonths, dateadd(day, (m_int * 3600) / 86400, m_date) as wholeDaysOfHours, dateadd(day, ((@0 - m_int) * 7), m_date) as negated, dateadd(second, day(datefromparts(2001, 2, case when m_int < 0 then 29 else 28 end)) - 28, dateadd(second, (m_int * 3600 + 1800) % 86400, m_time)) as timeInHours, dateadd(day, (day(datefromparts(2001, 2, case when m_int < 0 then 29 else 28 end)) - 28), dateadd(nanosecond, 5000000, cast(dateadd(second, (m_int * 3600) % 86400, dateadd(day, (m_int + (m_int * 3600) / 86400), m_datetime)) as datetime2))) as inDaysAndHours, dateadd(month, -m_int, m_datetime) as minusMonths, dateadd(nanosecond, ((m_int * @3) % 1000) * 1000000, cast(dateadd(second, (m_int * @2) / 1000 % 86400, dateadd(day, (m_int * @1) / 1000 / 86400, m_datetime)) as datetime2)) as inMilliseconds from col_matrix where id = @4"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "0",
            "100",
            "100",
            "100",
            "1",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ inDays: Temporal.PlainDate; inMonthsAndDays: Temporal.PlainDate; inYearsAndMonths: Temporal.PlainDate; wholeDaysOfHours: Temporal.PlainDate; negated: Temporal.PlainDate; timeInHours: Temporal.PlainTime; inDaysAndHours: Temporal.PlainDateTime; minusMonths: Temporal.PlainDateTime; inMilliseconds: Temporal.PlainDateTime }>>>()
        expect(rows.map(row => asRow(row))).toEqual([asRow(expected)])
    })

    test('fields-of-the-query-with-different-signs-make-the-query-fail', async () => {
        // As Temporal throws: the int 42 of the row with -1 hour, and with itself negated; negated with -1 hour it adds
        const negated = ctx.conn.const(0, 'int').subtract(tColMatrixPlain.mInt)
        ctx.mockNext([{ day: '2024-04-15' }])
        const withNumber = await failureOf(ctx.conn.selectFrom(tColMatrixPlain)
            .where(tColMatrixPlain.id.equals(1))
            .select({ day: tColMatrixPlain.mDate.add({ days: tColMatrixPlain.mInt, hours: -1 }) })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select dateadd(day, (day(datefromparts(2001, 2, case when m_int > 0 then 29 else 28 end)) - 28), dateadd(day, m_int, m_date)) as day from col_matrix where id = @0"`)
        expect(withNumber).toBe(ctx.realDbEnabled)
        ctx.mockNext([{ moment: '2024-02-25 12:30:00' }])
        const withNegated = await failureOf(ctx.conn.selectFrom(tColMatrixPlain)
            .where(tColMatrixPlain.id.equals(1))
            .select({ moment: tColMatrixPlain.mDatetime.add({ days: tColMatrixPlain.mInt, hours: negated }) })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select dateadd(day, (day(datefromparts(2001, 2, case when (m_int > 0 or (@2 - m_int) > 0) and (m_int < 0 or (@3 - m_int) < 0) then 29 else 28 end)) - 28), dateadd(second, ((@1 - m_int) * 3600) % 86400, dateadd(day, (m_int + ((@0 - m_int) * 3600) / 86400), m_datetime))) as moment from col_matrix where id = @4"`)
        expect(withNegated).toBe(ctx.realDbEnabled)
        const expected = Temporal.PlainDate.from('2024-03-04').subtract({ days: -42, hours: -1 })
        ctx.mockNext([{ day: expected.toString() }])
        const rows = await ctx.conn.selectFrom(tColMatrixPlain)
            .where(tColMatrixPlain.id.equals(1))
            .select({ day: tColMatrixPlain.mDate.subtract({ days: negated, hours: -1 }) })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select dateadd(day, (day(datefromparts(2001, 2, case when (@1 - m_int) > 0 then 29 else 28 end)) - 28), dateadd(day, -(@0 - m_int), m_date)) as day from col_matrix where id = @2"`)
        expect(rows.map(row => row.day.toString())).toEqual([expected.toString()])
    })

    test('a-row-is-updated-with-durations-of-its-own-values', async () => {
        // The date of col_matrix row 1 plus the int of the row in days, its time minus that int in minutes, its date and
        // time plus that int in months and an hour: each one with the values the row had before the update, also the
        // int, set to 0 in the same update (written first)
        const expected = {
            mDate: Temporal.PlainDate.from('2024-03-04').add({ days: 42 }),
            mTime: Temporal.PlainTime.from('09:15').subtract({ minutes: 42 }),
            mDatetime: Temporal.PlainDateTime.from('2024-01-14T12:30').add({ months: 42, hours: 1 }),
        }
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            const updated = await ctx.conn.update(tColMatrixPlain)
                .set({
                    mInt: 0,
                    mDate: tColMatrixPlain.mDate.add({ days: tColMatrixPlain.mInt }),
                    mTime: tColMatrixPlain.mTime.subtract({ minutes: tColMatrixPlain.mInt }),
                    mDatetime: tColMatrixPlain.mDatetime.add({ months: tColMatrixPlain.mInt, hours: 1 }),
                })
                .where(tColMatrixPlain.id.equals(1))
                .executeUpdate()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update col_matrix set m_int = @0, m_date = dateadd(day, m_int, m_date), m_time = dateadd(second, -(m_int * 60) % 86400, m_time), m_datetime = dateadd(day, (day(datefromparts(2001, 2, case when m_int < 0 then 29 else 28 end)) - 28), dateadd(second, 3600 % 86400, dateadd(month, m_int, m_datetime))) where id = @1"`)
            expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
              [
                "0",
                "1",
              ]
            `)
            expect(updated).toBe(1)
            ctx.mockNext([{ ...asRow(expected), mInt: 0 }])
            const rows = await ctx.conn.selectFrom(tColMatrixPlain)
                .where(tColMatrixPlain.id.equals(1))
                .select({ mDate: tColMatrixPlain.mDate, mTime: tColMatrixPlain.mTime, mDatetime: tColMatrixPlain.mDatetime, mInt: tColMatrixPlain.mInt })
                .executeSelectMany()
            expect(rows.map(row => [asRow({ mDate: row.mDate, mTime: row.mTime, mDatetime: row.mDatetime }), row.mInt])).toEqual([[asRow(expected), 0]])
        })
    })

    test('numbers-temporal-rejects-in-fields-of-the-query-are-rejected-before-the-query-is-sent', () => {
        // As Temporal: a number with a fraction, and numbers of different signs
        expect(() => tColMatrixPlain.mDate.add({ days: tColMatrixPlain.mInt, hours: 1.5 })).toThrow('it must be an integer')
        expect(() => tColMatrixPlain.mDatetime.subtract({ days: tColMatrixPlain.mInt, hours: -1, minutes: 1 })).toThrow('the fields must have one sign')
    })
})
