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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select make_date(cast(extract(year from $1) as integer), 2, least(cast(extract(day from $2) as integer), extract(day from make_date(cast(extract(year from $1) as integer), 2, 1) + interval '1 month - 1 day')::integer)) as february, make_date(2023, 2, least(cast(extract(day from $3) as integer), extract(day from make_date(2023, 2, 1) + interval '1 month - 1 day')::integer)) as "notLeap", make_date(cast(extract(year from $4) as integer), cast(extract(month from $5) as integer), least(31, extract(day from make_date(cast(extract(year from $4) as integer), cast(extract(month from $5) as integer), 1) + interval '1 month - 1 day')::integer)) as april, make_date(cast(extract(year from $6) as integer), 3, least(cast(extract(day from $7) as integer), extract(day from make_date(cast(extract(year from $6) as integer), 3, 1) + interval '1 month - 1 day')::integer)) as march, make_date(cast(extract(year from $8) as integer), 12, least(cast(extract(day from $9) as integer), extract(day from make_date(cast(extract(year from $8) as integer), 12, 1) + interval '1 month - 1 day')::integer)) as december, make_date(cast(extract(year from $10) as integer), cast(extract(month from $11) as integer), 1) as first"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select $1 + make_interval(secs => (23 - cast(extract(hour from $2) as integer)) * 3600) as "lastHour", $3 + make_interval(secs => (0 - cast(extract(minute from $4) as integer)) * 60) as "minuteZero", make_time(cast(extract(hour from $5) as integer), cast(extract(minute from $6) as integer), cast(trunc(extract(second from $7))::integer as integer) + (5 * 1000000 + ((trunc(extract(microseconds from $8))::integer % 1000000 * 1000) / 1000) % 1000 * 1000 + (trunc(extract(microseconds from $8))::integer % 1000000 * 1000) % 1000) / 1000000000.0) as millisecond, make_time(cast(extract(hour from $9) as integer), cast(extract(minute from $10) as integer), 0) as "wholeMinute""`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select make_timestamp(cast(extract(year from $1) as integer), 2, least(cast(extract(day from $2) as integer), extract(day from make_date(cast(extract(year from $1) as integer), 2, 1) + interval '1 month - 1 day')::integer), 0, cast(extract(minute from $3) as integer), cast(trunc(extract(second from $4))::integer as integer) + (trunc(extract(microseconds from $5))::integer % 1000000 * 1000) / 1000000000.0) as february, make_timestamp(cast(extract(year from $6) as integer), cast(extract(month from $7) as integer), 1, 0, 0, 0 + (0 * 1000000 + ((trunc(extract(microseconds from $8))::integer % 1000000 * 1000) / 1000) % 1000 * 1000 + (trunc(extract(microseconds from $8))::integer % 1000000 * 1000) % 1000) / 1000000000.0) as "startOfMonth""`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select make_date(cast(extract(year from m_date) as integer), cast(extract(month from m_date) as integer), 1) as "firstDay", m_time + make_interval(secs => (0 - cast(extract(minute from m_time) as integer)) * 60) as "oClock", make_timestamp(cast(extract(year from m_datetime) as integer), 2, least(31, extract(day from make_date(cast(extract(year from m_datetime) as integer), 2, 1) + interval '1 month - 1 day')::integer), cast(extract(hour from m_datetime) as integer), cast(extract(minute from m_datetime) as integer), cast(trunc(extract(second from m_datetime))::integer as integer) + (trunc(extract(microseconds from m_datetime))::integer % 1000000 * 1000) / 1000000000.0) as "endOfFebruary" from col_matrix where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ firstDay: Temporal.PlainDate; oClock: Temporal.PlainTime; endOfFebruary: Temporal.PlainDateTime }>>>()
        expect(rows.map(row => [row.firstDay, row.oClock, row.endOfFebruary].map(String))).toEqual([['2024-03-01', '09:00:00', '2024-02-29T12:30:00']])
    })
})
