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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select to_char((add_months(date '0001-01-01', (extract(year from to_date(:0, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) - 1) * 12 + 2 - 1) + least(extract(day from to_date(:1, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')), extract(day from last_day((add_months(date '0001-01-01', (extract(year from to_date(:0, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) - 1) * 12 + 2 - 1) + 1 - 1)))) - 1), 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "february", to_char((add_months(date '0001-01-01', (2023 - 1) * 12 + 2 - 1) + least(extract(day from to_date(:2, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')), extract(day from last_day((add_months(date '0001-01-01', (2023 - 1) * 12 + 2 - 1) + 1 - 1)))) - 1), 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "notLeap", to_char((add_months(date '0001-01-01', (extract(year from to_date(:3, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) - 1) * 12 + extract(month from to_date(:4, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) - 1) + least(31, extract(day from last_day((add_months(date '0001-01-01', (extract(year from to_date(:3, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) - 1) * 12 + extract(month from to_date(:4, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) - 1) + 1 - 1)))) - 1), 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "april", to_char((add_months(date '0001-01-01', (extract(year from to_date(:5, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) - 1) * 12 + 3 - 1) + least(extract(day from to_date(:6, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')), extract(day from last_day((add_months(date '0001-01-01', (extract(year from to_date(:5, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) - 1) * 12 + 3 - 1) + 1 - 1)))) - 1), 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "march", to_char((add_months(date '0001-01-01', (extract(year from to_date(:7, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) - 1) * 12 + 12 - 1) + least(extract(day from to_date(:8, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')), extract(day from last_day((add_months(date '0001-01-01', (extract(year from to_date(:7, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) - 1) * 12 + 12 - 1) + 1 - 1)))) - 1), 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "december", to_char((add_months(date '0001-01-01', (extract(year from to_date(:9, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) - 1) * 12 + extract(month from to_date(:10, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) - 1) + 1 - 1), 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "first" from dual"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select to_char(cast(timestamp '1970-01-01 00:00:00' + numtodsinterval(23 * 3600 + extract(minute from to_timestamp(:0, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN')) * 60 + trunc(extract(second from to_timestamp(:1, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN'))) + to_number(to_char(to_timestamp(:2, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN'), 'FF9')) / 1000000000, 'second') as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "lastHour", to_char(cast(timestamp '1970-01-01 00:00:00' + numtodsinterval(extract(hour from to_timestamp(:3, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN')) * 3600 + 0 * 60 + trunc(extract(second from to_timestamp(:4, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN'))) + to_number(to_char(to_timestamp(:5, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN'), 'FF9')) / 1000000000, 'second') as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "minuteZero", to_char(cast(timestamp '1970-01-01 00:00:00' + numtodsinterval(extract(hour from to_timestamp(:6, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN')) * 3600 + extract(minute from to_timestamp(:7, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN')) * 60 + trunc(extract(second from to_timestamp(:8, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN'))) + (5 * 1000000 + mod(trunc(to_number(to_char(to_timestamp(:9, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN'), 'FF9')) / 1000), 1000) * 1000 + mod(to_number(to_char(to_timestamp(:9, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN'), 'FF9')), 1000)) / 1000000000, 'second') as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "millisecond", to_char(cast(timestamp '1970-01-01 00:00:00' + numtodsinterval(extract(hour from to_timestamp(:10, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN')) * 3600 + extract(minute from to_timestamp(:11, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN')) * 60 + 0, 'second') as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "wholeMinute" from dual"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select to_char(cast(cast((add_months(date '0001-01-01', (extract(year from to_timestamp(:0, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN')) - 1) * 12 + 2 - 1) + least(extract(day from to_timestamp(:1, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN')), extract(day from last_day((add_months(date '0001-01-01', (extract(year from to_timestamp(:0, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN')) - 1) * 12 + 2 - 1) + 1 - 1)))) - 1) as timestamp(9)) + numtodsinterval(0 * 3600 + extract(minute from to_timestamp(:2, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN')) * 60 + trunc(extract(second from to_timestamp(:3, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN'))) + to_number(to_char(to_timestamp(:4, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN'), 'FF9')) / 1000000000, 'second') as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "february", to_char(cast(cast((add_months(date '0001-01-01', (extract(year from to_timestamp(:5, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN')) - 1) * 12 + extract(month from to_timestamp(:6, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN')) - 1) + 1 - 1) as timestamp(9)) + numtodsinterval(0 * 3600 + 0 * 60 + 0 + (0 * 1000000 + mod(trunc(to_number(to_char(to_timestamp(:7, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN'), 'FF9')) / 1000), 1000) * 1000 + mod(to_number(to_char(to_timestamp(:7, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN'), 'FF9')), 1000)) / 1000000000, 'second') as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "startOfMonth" from dual"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select to_char((add_months(date '0001-01-01', (extract(year from m_date) - 1) * 12 + extract(month from m_date) - 1) + 1 - 1), 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "firstDay", to_char(cast(timestamp '1970-01-01 00:00:00' + numtodsinterval(extract(hour from m_time) * 3600 + 0 * 60 + trunc(extract(second from m_time)) + to_number(to_char(m_time, 'FF9')) / 1000000000, 'second') as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "oClock", to_char(cast(cast((add_months(date '0001-01-01', (extract(year from m_datetime) - 1) * 12 + 2 - 1) + least(31, extract(day from last_day((add_months(date '0001-01-01', (extract(year from m_datetime) - 1) * 12 + 2 - 1) + 1 - 1)))) - 1) as timestamp(9)) + numtodsinterval(extract(hour from m_datetime) * 3600 + extract(minute from m_datetime) * 60 + trunc(extract(second from m_datetime)) + to_number(to_char(m_datetime, 'FF9')) / 1000000000, 'second') as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "endOfFebruary" from col_matrix where id = :0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ firstDay: Temporal.PlainDate; oClock: Temporal.PlainTime; endOfFebruary: Temporal.PlainDateTime }>>>()
        expect(rows.map(row => [row.firstDay, row.oClock, row.endOfFebruary].map(String))).toEqual([['2024-03-01', '09:00:00', '2024-02-29T12:30:00']])
    })
})
