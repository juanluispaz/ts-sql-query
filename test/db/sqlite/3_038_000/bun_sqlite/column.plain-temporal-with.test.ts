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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select date(printf('%04d-%02d-%02d', cast(strftime('%Y', ?1) as integer), 2, min(cast(strftime('%d', ?2) as integer), cast(strftime('%d', printf('%04d-%02d-01', cast(strftime('%Y', ?1) as integer), 2), '+1 months', '-1 days') as integer)))) as february, date(printf('%04d-%02d-%02d', 2023, 2, min(cast(strftime('%d', ?3) as integer), cast(strftime('%d', printf('%04d-%02d-01', 2023, 2), '+1 months', '-1 days') as integer)))) as notLeap, date(printf('%04d-%02d-%02d', cast(strftime('%Y', ?4) as integer), cast(strftime('%m', ?5) as integer), min(31, cast(strftime('%d', printf('%04d-%02d-01', cast(strftime('%Y', ?4) as integer), cast(strftime('%m', ?5) as integer)), '+1 months', '-1 days') as integer)))) as april, date(printf('%04d-%02d-%02d', cast(strftime('%Y', ?6) as integer), 3, min(cast(strftime('%d', ?7) as integer), cast(strftime('%d', printf('%04d-%02d-01', cast(strftime('%Y', ?6) as integer), 3), '+1 months', '-1 days') as integer)))) as march, date(printf('%04d-%02d-%02d', cast(strftime('%Y', ?8) as integer), 12, min(cast(strftime('%d', ?9) as integer), cast(strftime('%d', printf('%04d-%02d-01', cast(strftime('%Y', ?8) as integer), 12), '+1 months', '-1 days') as integer)))) as december, date(printf('%04d-%02d-%02d', cast(strftime('%Y', ?10) as integer), cast(strftime('%m', ?11) as integer), 1)) as first"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select strftime('%H:%M:%f', ?1, ((23 - cast(strftime('%H', ?2) as integer)) * 3600) || ' seconds') as lastHour, strftime('%H:%M:%f', ?3, ((0 - cast(strftime('%M', ?4) as integer)) * 60) || ' seconds') as minuteZero, strftime('%H:%M:%f', printf('%02d:%02d:%02d.%03d', cast(strftime('%H', ?5) as integer), cast(strftime('%M', ?6) as integer), cast(strftime('%S', ?7) as integer), cast((5 * 1000000 + cast((cast(round(strftime('%f', ?8) * 1000) as integer) % 1000) * 1000000 / 1000 as integer) % 1000 * 1000 + (cast(round(strftime('%f', ?8) * 1000) as integer) % 1000) * 1000000 % 1000) / 1000000 as integer))) as millisecond, strftime('%H:%M:%f', printf('%02d:%02d:%02d.%03d', cast(strftime('%H', ?9) as integer), cast(strftime('%M', ?10) as integer), 0, cast(0 / 1000000 as integer))) as wholeMinute"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select strftime('%Y-%m-%d %H:%M:%f', printf('%04d-%02d-%02d %02d:%02d:%02d.%03d', cast(strftime('%Y', ?1) as integer), 2, min(cast(strftime('%d', ?2) as integer), cast(strftime('%d', printf('%04d-%02d-01', cast(strftime('%Y', ?1) as integer), 2), '+1 months', '-1 days') as integer)), 0, cast(strftime('%M', ?3) as integer), cast(strftime('%S', ?4) as integer), cast((cast(round(strftime('%f', ?5) * 1000) as integer) % 1000) * 1000000 / 1000000 as integer))) as february, strftime('%Y-%m-%d %H:%M:%f', printf('%04d-%02d-%02d %02d:%02d:%02d.%03d', cast(strftime('%Y', ?6) as integer), cast(strftime('%m', ?7) as integer), 1, 0, 0, 0, cast((0 * 1000000 + cast((cast(round(strftime('%f', ?8) * 1000) as integer) % 1000) * 1000000 / 1000 as integer) % 1000 * 1000 + (cast(round(strftime('%f', ?8) * 1000) as integer) % 1000) * 1000000 % 1000) / 1000000 as integer))) as startOfMonth"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "2024-01-31 10:20:30.500",
            "2024-01-31 10:20:30.500",
            "2024-01-31 10:20:30.500",
            "2024-01-31 10:20:30.500",
            "2024-01-31 10:20:30.500",
            "2024-01-31 10:20:30.500",
            "2024-01-31 10:20:30.500",
            "2024-01-31 10:20:30.500",
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select date(printf('%04d-%02d-%02d', cast(strftime('%Y', m_date) as integer), cast(strftime('%m', m_date) as integer), 1)) as firstDay, strftime('%H:%M:%f', m_time, ((0 - cast(strftime('%M', m_time) as integer)) * 60) || ' seconds') as oClock, strftime('%Y-%m-%d %H:%M:%f', printf('%04d-%02d-%02d %02d:%02d:%02d.%03d', cast(strftime('%Y', m_datetime) as integer), 2, min(31, cast(strftime('%d', printf('%04d-%02d-01', cast(strftime('%Y', m_datetime) as integer), 2), '+1 months', '-1 days') as integer)), cast(strftime('%H', m_datetime) as integer), cast(strftime('%M', m_datetime) as integer), cast(strftime('%S', m_datetime) as integer), cast((cast(round(strftime('%f', m_datetime) * 1000) as integer) % 1000) * 1000000 / 1000000 as integer))) as endOfFebruary from col_matrix where id = ?1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ firstDay: Temporal.PlainDate; oClock: Temporal.PlainTime; endOfFebruary: Temporal.PlainDateTime }>>>()
        expect(rows.map(row => [row.firstDay, row.oClock, row.endOfFebruary].map(String))).toEqual([['2024-03-01', '09:00:00', '2024-02-29T12:30:00']])
    })
})
