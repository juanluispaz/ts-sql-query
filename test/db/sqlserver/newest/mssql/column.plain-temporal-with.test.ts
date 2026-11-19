// Dates and times without zone with some of their fields replaced, with the semantics of Temporal's with. col_matrix
// row 1 has the date 2024-03-04, the time 09:15:00 and the date and time 2024-01-14 12:30:00.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tColMatrixPlain } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('with-takes-the-day-to-the-last-of-the-month', async () => {
        ctx.mockNext({ february: '2024-02-29', notLeap: '2023-02-28', april: '2024-04-30', march: '2024-03-31', december: '2024-12-31', first: '2024-01-01' })
        const january31 = ctx.conn.const(Temporal.PlainDate.from('2024-01-31'), 'plainDate')
        const row = await ctx.conn.selectFromNoTable()
            .select({
                february: january31.with({ month: 2 }),
                notLeap: january31.with({ year: 2023, month: 2 }),
                april: ctx.conn.const(Temporal.PlainDate.from('2024-04-15'), 'plainDate').with({ day: 31 }),
                march: january31.with({ monthCode: 'M03' }),
                december: january31.with({ month: 13 }),
                first: january31.with({ day: 1 }),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select datefromparts(datepart(year, @0), 2, case when datepart(day, @1) < day(eomonth(datefromparts(datepart(year, @0), 2, 1))) then datepart(day, @1) else day(eomonth(datefromparts(datepart(year, @0), 2, 1))) end) as february, datefromparts(2023, 2, case when datepart(day, @2) < day(eomonth(datefromparts(2023, 2, 1))) then datepart(day, @2) else day(eomonth(datefromparts(2023, 2, 1))) end) as notLeap, datefromparts(datepart(year, @3), datepart(month, @4), case when 31 < day(eomonth(datefromparts(datepart(year, @3), datepart(month, @4), 1))) then 31 else day(eomonth(datefromparts(datepart(year, @3), datepart(month, @4), 1))) end) as april, datefromparts(datepart(year, @5), 3, case when datepart(day, @6) < day(eomonth(datefromparts(datepart(year, @5), 3, 1))) then datepart(day, @6) else day(eomonth(datefromparts(datepart(year, @5), 3, 1))) end) as march, datefromparts(datepart(year, @7), 12, case when datepart(day, @8) < day(eomonth(datefromparts(datepart(year, @7), 12, 1))) then datepart(day, @8) else day(eomonth(datefromparts(datepart(year, @7), 12, 1))) end) as december, datefromparts(datepart(year, @9), datepart(month, @10), 1) as first"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2024-01-31",
            "2024-01-31",
            "2024-01-31",
            "2024-04-15",
            "2024-04-15",
            "2024-01-31",
            "2024-01-31",
            "2024-01-31",
            "2024-01-31",
            "2024-01-31",
            "2024-01-31",
          ]
        `)
        assertType<Exact<typeof row, { february: Temporal.PlainDate; notLeap: Temporal.PlainDate; april: Temporal.PlainDate; march: Temporal.PlainDate; december: Temporal.PlainDate; first: Temporal.PlainDate }>>()
        expect([row.february, row.notLeap, row.april, row.march, row.december, row.first].map(String)).toEqual(['2024-02-29', '2023-02-28', '2024-04-30', '2024-03-31', '2024-12-31', '2024-01-01'])
    })

    test('with-of-a-time-takes-each-field-to-its-range', async () => {
        ctx.mockNext({ lastHour: '23:20:30.123', minuteZero: '10:00:30.123', millisecond: '10:20:30.005', wholeMinute: '10:20:00' })
        const time = ctx.conn.const(Temporal.PlainTime.from('10:20:30.123'), 'plainTime')
        const row = await ctx.conn.selectFromNoTable()
            .select({
                lastHour: time.with({ hour: 25 }),
                minuteZero: time.with({ minute: -1 }),
                millisecond: time.with({ millisecond: 5 }),
                wholeMinute: time.with({ second: 0, millisecond: 0, microsecond: 0, nanosecond: 0 }),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select timefromparts(23, datepart(minute, @0), datepart(second, @1), datepart(nanosecond, @2) / 100, 7) as lastHour, timefromparts(datepart(hour, @3), 0, datepart(second, @4), datepart(nanosecond, @5) / 100, 7) as minuteZero, timefromparts(datepart(hour, @6), datepart(minute, @7), datepart(second, @8), (5 * 1000000 + datepart(nanosecond, @9) / 1000 % 1000 * 1000 + datepart(nanosecond, @9) % 1000) / 100, 7) as millisecond, timefromparts(datepart(hour, @10), datepart(minute, @11), 0, 0 / 100, 7) as wholeMinute"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "10:20:30.123",
            "10:20:30.123",
            "10:20:30.123",
            "10:20:30.123",
            "10:20:30.123",
            "10:20:30.123",
            "10:20:30.123",
            "10:20:30.123",
            "10:20:30.123",
            "10:20:30.123",
            "10:20:30.123",
            "10:20:30.123",
          ]
        `)
        assertType<Exact<typeof row, { lastHour: Temporal.PlainTime; minuteZero: Temporal.PlainTime; millisecond: Temporal.PlainTime; wholeMinute: Temporal.PlainTime }>>()
        expect([row.lastHour, row.minuteZero, row.millisecond, row.wholeMinute].map(String)).toEqual(['23:20:30.123', '10:00:30.123', '10:20:30.005', '10:20:00'])
    })

    test('with-of-a-date-and-time', async () => {
        ctx.mockNext({ february: '2024-02-29 00:20:30.5', startOfMonth: '2024-01-01 00:00:00' })
        const moment = ctx.conn.const(Temporal.PlainDateTime.from('2024-01-31T10:20:30.5'), 'plainDateTime')
        const row = await ctx.conn.selectFromNoTable()
            .select({
                february: moment.with({ month: 2, hour: 0 }),
                startOfMonth: moment.with({ day: 1, hour: 0, minute: 0, second: 0, millisecond: 0 }),
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select datetime2fromparts(datepart(year, switchoffset(@0, '+00:00')), 2, case when datepart(day, switchoffset(@1, '+00:00')) < day(eomonth(datefromparts(datepart(year, switchoffset(@0, '+00:00')), 2, 1))) then datepart(day, switchoffset(@1, '+00:00')) else day(eomonth(datefromparts(datepart(year, switchoffset(@0, '+00:00')), 2, 1))) end, 0, datepart(minute, switchoffset(@2, '+00:00')), datepart(second, @3), datepart(nanosecond, @4) / 100, 7) as february, datetime2fromparts(datepart(year, switchoffset(@5, '+00:00')), datepart(month, switchoffset(@6, '+00:00')), 1, 0, 0, 0, (0 * 1000000 + datepart(nanosecond, @7) / 1000 % 1000 * 1000 + datepart(nanosecond, @7) % 1000) / 100, 7) as startOfMonth"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2024-01-31T10:20:30.5",
            "2024-01-31T10:20:30.5",
            "2024-01-31T10:20:30.5",
            "2024-01-31T10:20:30.5",
            "2024-01-31T10:20:30.5",
            "2024-01-31T10:20:30.5",
            "2024-01-31T10:20:30.5",
            "2024-01-31T10:20:30.5",
          ]
        `)
        assertType<Exact<typeof row, { february: Temporal.PlainDateTime; startOfMonth: Temporal.PlainDateTime }>>()
        expect([row.february, row.startOfMonth].map(String)).toEqual(['2024-02-29T00:20:30.5', '2024-01-01T00:00:00'])
    })

    test('with-of-the-values-of-a-column', async () => {
        ctx.mockNext([{ firstDay: '2024-03-01', oClock: '09:00:00', endOfFebruary: '2024-02-29 12:30:00' }])
        const rows = await ctx.conn.selectFrom(tColMatrixPlain)
            .where(tColMatrixPlain.id.equals(1))
            .select({
                firstDay: tColMatrixPlain.mDate.with({ day: 1 }),
                oClock: tColMatrixPlain.mTime.with({ minute: 0 }),
                endOfFebruary: tColMatrixPlain.mDatetime.with({ month: 2, day: 31 }),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select datefromparts(datepart(year, m_date), datepart(month, m_date), 1) as firstDay, timefromparts(datepart(hour, m_time), 0, datepart(second, m_time), datepart(nanosecond, m_time) / 100, 7) as oClock, datetime2fromparts(datepart(year, switchoffset(m_datetime, '+00:00')), 2, case when 31 < day(eomonth(datefromparts(datepart(year, switchoffset(m_datetime, '+00:00')), 2, 1))) then 31 else day(eomonth(datefromparts(datepart(year, switchoffset(m_datetime, '+00:00')), 2, 1))) end, datepart(hour, switchoffset(m_datetime, '+00:00')), datepart(minute, switchoffset(m_datetime, '+00:00')), datepart(second, m_datetime), datepart(nanosecond, m_datetime) / 100, 7) as endOfFebruary from col_matrix where id = @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ firstDay: Temporal.PlainDate; oClock: Temporal.PlainTime; endOfFebruary: Temporal.PlainDateTime }>>>()
        expect(rows.map(row => [row.firstDay, row.oClock, row.endOfFebruary].map(String))).toEqual([['2024-03-01', '09:00:00', '2024-02-29T12:30:00']])
    })
})
