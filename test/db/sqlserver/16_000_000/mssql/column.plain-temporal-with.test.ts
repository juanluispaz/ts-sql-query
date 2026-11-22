// Dates and times without zone with some of their fields replaced, with the semantics of Temporal's with. col_matrix
// row 1 has the date 2024-03-04, the time 09:15:00 and the date and time 2024-01-14 12:30:00.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tCalendarValue, tColMatrixPlain, tRelease } from '../../domain/connection.js'
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select dateadd(second, (23 - datepart(hour, @0)) * 3600, @1) as lastHour, dateadd(second, (0 - datepart(minute, @2)) * 60, @3) as minuteZero, timefromparts(datepart(hour, @4), datepart(minute, @5), datepart(second, @6), (5 * 1000000 + datepart(nanosecond, @7) / 1000 % 1000 * 1000 + datepart(nanosecond, @7) % 1000) / 100, 7) as millisecond, timefromparts(datepart(hour, @8), datepart(minute, @9), 0, 0 / 100, 7) as wholeMinute"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select datetime2fromparts(datepart(year, @0), 2, case when datepart(day, @1) < day(eomonth(datefromparts(datepart(year, @0), 2, 1))) then datepart(day, @1) else day(eomonth(datefromparts(datepart(year, @0), 2, 1))) end, 0, datepart(minute, @2), datepart(second, @3), datepart(nanosecond, @4) / 100, 7) as february, datetime2fromparts(datepart(year, @5), datepart(month, @6), 1, 0, 0, 0, (0 * 1000000 + datepart(nanosecond, @7) / 1000 % 1000 * 1000 + datepart(nanosecond, @7) % 1000) / 100, 7) as startOfMonth"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select datefromparts(datepart(year, m_date), datepart(month, m_date), 1) as firstDay, dateadd(second, (0 - datepart(minute, m_time)) * 60, m_time) as oClock, datetime2fromparts(datepart(year, switchoffset(m_datetime, '+00:00')), 2, case when 31 < day(eomonth(datefromparts(datepart(year, switchoffset(m_datetime, '+00:00')), 2, 1))) then 31 else day(eomonth(datefromparts(datepart(year, switchoffset(m_datetime, '+00:00')), 2, 1))) end, datepart(hour, switchoffset(m_datetime, '+00:00')), datepart(minute, switchoffset(m_datetime, '+00:00')), datepart(second, m_datetime), datepart(nanosecond, m_datetime) / 100, 7) as endOfFebruary from col_matrix where id = @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ firstDay: Temporal.PlainDate; oClock: Temporal.PlainTime; endOfFebruary: Temporal.PlainDateTime }>>>()
        expect(rows.map(row => [row.firstDay, row.oClock, row.endOfFebruary].map(String))).toEqual([['2024-03-01', '09:00:00', '2024-02-29T12:30:00']])
    })

    test('dates-with-fields-and-instants-of-epochs-with-the-functions-of-the-library', async () => {
        // With the functions of the library installed with of a date, toPlainDate of a month of a year and of a day of a
        // month, and an instant of its milliseconds or nanoseconds write the value once: the values are the ones of
        // Temporal for the values read, with and without the functions, and a day the month hasn't fails with reject
        // (the mock answers no rows: there it is the SQL that is checked)
        const query = (conn: typeof ctx.conn) => conn.selectFrom(tCalendarValue)
            .select({
                id: tCalendarValue.id,
                monthOf: tCalendarValue.monthOf,
                dayOf: tCalendarValue.dayOf,
                bornOn: tCalendarValue.bornOn,
                lastOfMonth: tCalendarValue.bornOn.with({ day: 31 }),
                inFebruary: tCalendarValue.bornOn.with({ month: 2 }),
                in2023: tCalendarValue.dayOf.toPlainDate({ year: 2023 }),
                day30: tCalendarValue.monthOf.toPlainDate({ day: 30 }),
                toJune: tCalendarValue.monthOf.until(Temporal.PlainYearMonth.from('2025-06'), { smallestUnit: 'year', roundingMode: 'halfExpand' }),
            })
            .orderBy('id')
            .executeSelectMany()
        const epochs = (conn: typeof ctx.conn) => conn.selectFrom(tRelease)
            .where(tRelease.deployedAt.isNotNull())
            .select({
                version: tRelease.version,
                deployedAt: tRelease.deployedAt,
                ofMilliseconds: conn.instantFromEpochMilliseconds(tRelease.deployedAt.epochMilliseconds()),
                ofNanoseconds: conn.instantFromEpochNanoseconds(tRelease.deployedAt.epochNanoseconds()),
            })
            .orderBy('version')
            .executeSelectMany()
        ctx.mockNext([])
        const withFunctions = await query(ctx.withLibraryFunctions())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, month_of as monthOf, day_of as dayOf, born_on as bornOn, dbo.tsq_date_with(born_on, null, null, 31, 0) as lastOfMonth, dbo.tsq_date_with(born_on, null, 2, null, 0) as inFebruary, dbo.tsq_date_with(day_of, 2023, null, null, 0) as in2023, dbo.tsq_date_with(month_of, null, null, 30, 0) as day30, dbo.tsq_duration_round_of(datefromparts(datepart(year, month_of), datepart(month, month_of), 1), datefromparts(datepart(year, @0), datepart(month, @0), 1), 'year', 'year', 1, 'halfExpand', 1) as toJune from calendar_value order by id"`)
        ctx.mockNext([])
        const withoutFunctions = await query(ctx.conn)
        expect(withFunctions.length).toBe(ctx.realDbEnabled ? 3 : 0)
        type Row = (typeof withFunctions)[number]
        const read = (row: Row) => [row.id, row.lastOfMonth.toString(), row.inFebruary.toString(), row.in2023.toString(), row.day30.toString(), row.toJune.years * 12 + row.toJune.months]
        const ofTemporal = (row: Row) => {
            const toJune = row.monthOf.until(Temporal.PlainYearMonth.from('2025-06'), { smallestUnit: 'year', roundingMode: 'halfExpand' })
            return [row.id, row.bornOn.with({ day: 31 }).toString(), row.bornOn.with({ month: 2 }).toString(), row.dayOf.toPlainDate({ year: 2023 }).toString(), row.monthOf.toPlainDate({ day: 30 }).toString(), toJune.years * 12 + toJune.months]
        }
        expect(withFunctions.map(read)).toEqual(withFunctions.map(ofTemporal))
        expect(withoutFunctions.map(read)).toEqual(withoutFunctions.map(ofTemporal))
        ctx.mockNext([])
        const epochsWithFunctions = await epochs(ctx.withLibraryFunctions())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as version, deployed_at as deployedAt, dbo.tsq_utc_of_epoch(cast(datediff_big(millisecond, '1970-01-01 00:00:00', deployed_at) as bigint), 1000000) as ofMilliseconds, dbo.tsq_utc_of_epoch((datediff_big(microsecond, '1970-01-01 00:00:00', deployed_at) * 1000 + datepart(nanosecond, deployed_at) % 1000), 1) as ofNanoseconds from project_release where deployed_at is not null order by version"`)
        ctx.mockNext([])
        const epochsWithoutFunctions = await epochs(ctx.conn)
        expect(epochsWithFunctions.length).toBe(ctx.realDbEnabled ? 2 : 0)
        type EpochRow = (typeof epochsWithFunctions)[number]
        const readEpochs = (row: EpochRow) => [row.version, row.ofMilliseconds?.toString(), row.ofNanoseconds?.toString()]
        const epochsOfTemporal = (row: EpochRow) => [row.version, row.deployedAt && Temporal.Instant.fromEpochMilliseconds(row.deployedAt.epochMilliseconds).toString(), row.deployedAt?.toString()]
        expect(epochsWithFunctions.map(readEpochs)).toEqual(epochsWithFunctions.map(epochsOfTemporal))
        expect(epochsWithoutFunctions.map(readEpochs)).toEqual(epochsWithoutFunctions.map(epochsOfTemporal))
        ctx.mockNext([])
        const failsWithFunctions = await ctx.withLibraryFunctions().selectFrom(tCalendarValue).where(tCalendarValue.id.equals(1)).select({ v: tCalendarValue.bornOn.with({ year: 2023 }, { overflow: 'reject' }) }).executeSelectMany().then(() => false, () => true)
        ctx.mockNext([])
        const failsWithoutFunctions = await ctx.conn.selectFrom(tCalendarValue).where(tCalendarValue.id.equals(1)).select({ v: tCalendarValue.bornOn.with({ year: 2023 }, { overflow: 'reject' }) }).executeSelectMany().then(() => false, () => true)
        expect([failsWithFunctions, failsWithoutFunctions]).toEqual([ctx.realDbEnabled, ctx.realDbEnabled])
    })

    test('with-fields-of-the-query', async () => {
        // Each field is an integer or an int of the query, taken to its range as Temporal's overflow 'constrain' takes it:
        // the int 42 of the row as a day is the last one of the month, as a month December, as an hour 23, as a minute 42;
        // negated as an hour, 0; the same with the functions of the library, which aren't used for fields of the query
        const date = Temporal.PlainDate.from('2024-03-04')
        const time = Temporal.PlainTime.from('09:15')
        const dateTime = Temporal.PlainDateTime.from('2024-01-14T12:30')
        const expected = {
            lastDay: date.with({ day: 42 }),
            december: date.with({ month: 42 }),
            inYear: date.with({ year: 2022 }),
            lastHour: time.with({ hour: 42 }),
            minute: time.with({ minute: 42 }),
            lastSecond: time.with({ second: 84 }),
            dayAndHour: dateTime.with({ day: 42, hour: -42 }),
            millisecond: dateTime.with({ millisecond: 42 }),
        }
        const query = (conn: typeof ctx.conn) => {
            const negated = conn.const(0, 'int').subtract(tColMatrixPlain.mInt)
            return conn.selectFrom(tColMatrixPlain)
                .where(tColMatrixPlain.id.equals(1))
                .select({
                    lastDay: tColMatrixPlain.mDate.with({ day: tColMatrixPlain.mInt }),
                    december: tColMatrixPlain.mDate.with({ month: tColMatrixPlain.mInt }),
                    inYear: tColMatrixPlain.mDate.with({ year: tColMatrixPlain.mInt.add(conn.const(1980, 'int')) }),
                    lastHour: tColMatrixPlain.mTime.with({ hour: tColMatrixPlain.mInt }),
                    minute: tColMatrixPlain.mTime.with({ minute: tColMatrixPlain.mInt }),
                    lastSecond: tColMatrixPlain.mTime.with({ second: tColMatrixPlain.mInt.multiply(conn.const(2, 'int')) }),
                    dayAndHour: tColMatrixPlain.mDatetime.with({ day: tColMatrixPlain.mInt, hour: negated }),
                    millisecond: tColMatrixPlain.mDatetime.with({ millisecond: tColMatrixPlain.mInt }),
                })
                .executeSelectMany()
        }
        ctx.mockNext([asRow(expected)])
        const rows = await query(ctx.conn)
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select dateadd(day, (day(datefromparts(2001, 2, case when m_int < 1 then 29 else 28 end)) - 28), datefromparts(datepart(year, m_date), datepart(month, m_date), case when m_int < day(eomonth(datefromparts(datepart(year, m_date), datepart(month, m_date), 1))) then m_int else day(eomonth(datefromparts(datepart(year, m_date), datepart(month, m_date), 1))) end)) as lastDay, dateadd(day, (day(datefromparts(2001, 2, case when m_int < 1 then 29 else 28 end)) - 28), datefromparts(datepart(year, m_date), case when m_int < 12 then m_int else 12 end, case when datepart(day, m_date) < day(eomonth(datefromparts(datepart(year, m_date), case when m_int < 12 then m_int else 12 end, 1))) then datepart(day, m_date) else day(eomonth(datefromparts(datepart(year, m_date), case when m_int < 12 then m_int else 12 end, 1))) end)) as december, datefromparts((m_int + @0), datepart(month, m_date), case when datepart(day, m_date) < day(eomonth(datefromparts((m_int + @0), datepart(month, m_date), 1))) then datepart(day, m_date) else day(eomonth(datefromparts((m_int + @0), datepart(month, m_date), 1))) end) as inYear, timefromparts(case when case when m_int < 23 then m_int else 23 end > 0 then case when m_int < 23 then m_int else 23 end else 0 end, datepart(minute, m_time), datepart(second, m_time), datepart(nanosecond, m_time) / 100, 7) as lastHour, timefromparts(datepart(hour, m_time), case when case when m_int < 59 then m_int else 59 end > 0 then case when m_int < 59 then m_int else 59 end else 0 end, datepart(second, m_time), datepart(nanosecond, m_time) / 100, 7) as minute, timefromparts(datepart(hour, m_time), datepart(minute, m_time), case when case when (m_int * @1) < 59 then (m_int * @1) else 59 end > 0 then case when (m_int * @1) < 59 then (m_int * @1) else 59 end else 0 end, datepart(nanosecond, m_time) / 100, 7) as lastSecond, dateadd(day, (day(datefromparts(2001, 2, case when m_int < 1 then 29 else 28 end)) - 28), datetime2fromparts(datepart(year, switchoffset(m_datetime, '+00:00')), datepart(month, switchoffset(m_datetime, '+00:00')), case when m_int < day(eomonth(datefromparts(datepart(year, switchoffset(m_datetime, '+00:00')), datepart(month, switchoffset(m_datetime, '+00:00')), 1))) then m_int else day(eomonth(datefromparts(datepart(year, switchoffset(m_datetime, '+00:00')), datepart(month, switchoffset(m_datetime, '+00:00')), 1))) end, case when case when (@2 - m_int) < 23 then (@2 - m_int) else 23 end > 0 then case when (@2 - m_int) < 23 then (@2 - m_int) else 23 end else 0 end, datepart(minute, switchoffset(m_datetime, '+00:00')), datepart(second, m_datetime), datepart(nanosecond, m_datetime) / 100, 7)) as dayAndHour, datetime2fromparts(datepart(year, switchoffset(m_datetime, '+00:00')), datepart(month, switchoffset(m_datetime, '+00:00')), datepart(day, switchoffset(m_datetime, '+00:00')), datepart(hour, switchoffset(m_datetime, '+00:00')), datepart(minute, switchoffset(m_datetime, '+00:00')), datepart(second, m_datetime), (case when case when m_int < 999 then m_int else 999 end > 0 then case when m_int < 999 then m_int else 999 end else 0 end * 1000000 + datepart(nanosecond, m_datetime) / 1000 % 1000 * 1000 + datepart(nanosecond, m_datetime) % 1000) / 100, 7) as millisecond from col_matrix where id = @3"`)
        expect(ctx.lastParams.map(String)).toMatchInlineSnapshot(`
          [
            "1980",
            "2",
            "0",
            "1",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ lastDay: Temporal.PlainDate; december: Temporal.PlainDate; inYear: Temporal.PlainDate; lastHour: Temporal.PlainTime; minute: Temporal.PlainTime; lastSecond: Temporal.PlainTime; dayAndHour: Temporal.PlainDateTime; millisecond: Temporal.PlainDateTime }>>>()
        expect(rows.map(row => asRow(row))).toEqual([asRow(expected)])
        ctx.mockNext([asRow(expected)])
        const withFunctions = await query(ctx.withLibraryFunctions())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select dateadd(day, (day(datefromparts(2001, 2, case when m_int < 1 then 29 else 28 end)) - 28), datefromparts(datepart(year, m_date), datepart(month, m_date), case when m_int < day(eomonth(datefromparts(datepart(year, m_date), datepart(month, m_date), 1))) then m_int else day(eomonth(datefromparts(datepart(year, m_date), datepart(month, m_date), 1))) end)) as lastDay, dateadd(day, (day(datefromparts(2001, 2, case when m_int < 1 then 29 else 28 end)) - 28), datefromparts(datepart(year, m_date), case when m_int < 12 then m_int else 12 end, case when datepart(day, m_date) < day(eomonth(datefromparts(datepart(year, m_date), case when m_int < 12 then m_int else 12 end, 1))) then datepart(day, m_date) else day(eomonth(datefromparts(datepart(year, m_date), case when m_int < 12 then m_int else 12 end, 1))) end)) as december, datefromparts((m_int + @0), datepart(month, m_date), case when datepart(day, m_date) < day(eomonth(datefromparts((m_int + @0), datepart(month, m_date), 1))) then datepart(day, m_date) else day(eomonth(datefromparts((m_int + @0), datepart(month, m_date), 1))) end) as inYear, timefromparts(case when case when m_int < 23 then m_int else 23 end > 0 then case when m_int < 23 then m_int else 23 end else 0 end, datepart(minute, m_time), datepart(second, m_time), datepart(nanosecond, m_time) / 100, 7) as lastHour, timefromparts(datepart(hour, m_time), case when case when m_int < 59 then m_int else 59 end > 0 then case when m_int < 59 then m_int else 59 end else 0 end, datepart(second, m_time), datepart(nanosecond, m_time) / 100, 7) as minute, timefromparts(datepart(hour, m_time), datepart(minute, m_time), case when case when (m_int * @1) < 59 then (m_int * @1) else 59 end > 0 then case when (m_int * @1) < 59 then (m_int * @1) else 59 end else 0 end, datepart(nanosecond, m_time) / 100, 7) as lastSecond, dateadd(day, (day(datefromparts(2001, 2, case when m_int < 1 then 29 else 28 end)) - 28), datetime2fromparts(datepart(year, switchoffset(m_datetime, '+00:00')), datepart(month, switchoffset(m_datetime, '+00:00')), case when m_int < day(eomonth(datefromparts(datepart(year, switchoffset(m_datetime, '+00:00')), datepart(month, switchoffset(m_datetime, '+00:00')), 1))) then m_int else day(eomonth(datefromparts(datepart(year, switchoffset(m_datetime, '+00:00')), datepart(month, switchoffset(m_datetime, '+00:00')), 1))) end, case when case when (@2 - m_int) < 23 then (@2 - m_int) else 23 end > 0 then case when (@2 - m_int) < 23 then (@2 - m_int) else 23 end else 0 end, datepart(minute, switchoffset(m_datetime, '+00:00')), datepart(second, m_datetime), datepart(nanosecond, m_datetime) / 100, 7)) as dayAndHour, datetime2fromparts(datepart(year, switchoffset(m_datetime, '+00:00')), datepart(month, switchoffset(m_datetime, '+00:00')), datepart(day, switchoffset(m_datetime, '+00:00')), datepart(hour, switchoffset(m_datetime, '+00:00')), datepart(minute, switchoffset(m_datetime, '+00:00')), datepart(second, m_datetime), (case when case when m_int < 999 then m_int else 999 end > 0 then case when m_int < 999 then m_int else 999 end else 0 end * 1000000 + datepart(nanosecond, m_datetime) / 1000 % 1000 * 1000 + datepart(nanosecond, m_datetime) % 1000) / 100, 7) as millisecond from col_matrix where id = @3"`)
        expect(withFunctions.map(row => asRow(row))).toEqual([asRow(expected)])
    })

    test('fields-of-the-query-temporal-rejects-make-the-query-fail', async () => {
        // As Temporal throws: a day below 1 (the int 42 of the row negated); with reject, a month, an hour or a day out of
        // its range; a day in the month passes with reject
        const negated = ctx.conn.const(0, 'int').subtract(tColMatrixPlain.mInt)
        ctx.mockNext([{ value: '2024-03-04' }])
        const dayBelowOne = await failureOf(ctx.conn.selectFrom(tColMatrixPlain).where(tColMatrixPlain.id.equals(1))
            .select({ value: tColMatrixPlain.mDate.with({ day: negated }) }).executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select dateadd(day, (day(datefromparts(2001, 2, case when (@1 - m_int) < 1 then 29 else 28 end)) - 28), datefromparts(datepart(year, m_date), datepart(month, m_date), case when (@0 - m_int) < day(eomonth(datefromparts(datepart(year, m_date), datepart(month, m_date), 1))) then (@0 - m_int) else day(eomonth(datefromparts(datepart(year, m_date), datepart(month, m_date), 1))) end)) as value from col_matrix where id = @2"`)
        ctx.mockNext([{ value: '2024-03-04' }])
        const monthOutOfRange = await failureOf(ctx.conn.selectFrom(tColMatrixPlain).where(tColMatrixPlain.id.equals(1))
            .select({ value: tColMatrixPlain.mDate.with({ month: tColMatrixPlain.mInt }, { overflow: 'reject' }) }).executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select dateadd(day, (day(datefromparts(2001, 2, case when m_int < 1 or m_int > 12 then 29 else 28 end)) - 28), datefromparts(datepart(year, m_date), m_int, day(datefromparts(datepart(year, m_date), m_int, datepart(day, m_date))))) as value from col_matrix where id = @0"`)
        ctx.mockNext([{ value: '09:15:00' }])
        const hourOutOfRange = await failureOf(ctx.conn.selectFrom(tColMatrixPlain).where(tColMatrixPlain.id.equals(1))
            .select({ value: tColMatrixPlain.mTime.with({ hour: tColMatrixPlain.mInt }, { overflow: 'reject' }) }).executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select dateadd(second, day(datefromparts(2001, 2, case when m_int < 0 or m_int > 23 then 29 else 28 end)) - 28, timefromparts(m_int, datepart(minute, m_time), datepart(second, m_time), datepart(nanosecond, m_time) / 100, 7)) as value from col_matrix where id = @0"`)
        ctx.mockNext([{ value: '2024-03-04' }])
        const dayNotInMonth = await failureOf(ctx.conn.selectFrom(tColMatrixPlain).where(tColMatrixPlain.id.equals(1))
            .select({ value: tColMatrixPlain.mDate.with({ day: tColMatrixPlain.mInt }, { overflow: 'reject' }) }).executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select dateadd(day, (day(datefromparts(2001, 2, case when m_int < 1 then 29 else 28 end)) - 28), datefromparts(datepart(year, m_date), datepart(month, m_date), day(datefromparts(datepart(year, m_date), datepart(month, m_date), m_int)))) as value from col_matrix where id = @0"`)
        expect([dayBelowOne, monthOutOfRange, hourOutOfRange, dayNotInMonth]).toEqual([ctx.realDbEnabled, ctx.realDbEnabled, ctx.realDbEnabled, ctx.realDbEnabled])
        const day30 = Temporal.PlainDate.from('2024-03-04').with({ day: 30 }, { overflow: 'reject' })
        ctx.mockNext([{ value: day30.toString() }])
        const rows = await ctx.conn.selectFrom(tColMatrixPlain).where(tColMatrixPlain.id.equals(1))
            .select({ value: tColMatrixPlain.mDate.with({ day: tColMatrixPlain.mInt.subtract(ctx.conn.const(12, 'int')) }, { overflow: 'reject' }) }).executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select dateadd(day, (day(datefromparts(2001, 2, case when (m_int - @1) < 1 then 29 else 28 end)) - 28), datefromparts(datepart(year, m_date), datepart(month, m_date), day(datefromparts(datepart(year, m_date), datepart(month, m_date), (m_int - @0))))) as value from col_matrix where id = @2"`)
        expect(rows.map(row => row.value.toString())).toEqual([day30.toString()])
    })

    test('with-fields-of-the-query-of-a-month-of-a-year-and-of-a-day-of-a-month', async () => {
        // calendar_value row 1 is 2024-02 and 02-29; the int 42 of col_matrix row 1 as a month is December, as a day the
        // last one of the month; with reject the month fails, as Temporal throws
        const yearMonth = Temporal.PlainYearMonth.from('2024-02')
        const monthDay = Temporal.PlainMonthDay.from('02-29')
        const expected = { december: yearMonth.with({ month: 42 }), lastDay: monthDay.with({ day: 42 }), inYear: monthDay.with({ month: 3 }) }
        ctx.mockNext([{ december: '2024-12-01', lastDay: '1972-02-29', inYear: '1972-03-29' }])
        const rows = await ctx.conn.selectFrom(tCalendarValue)
            .join(tColMatrixPlain).on(tColMatrixPlain.id.equals(1))
            .where(tCalendarValue.id.equals(1))
            .select({
                december: tCalendarValue.monthOf.with({ month: tColMatrixPlain.mInt }),
                lastDay: tCalendarValue.dayOf.with({ day: tColMatrixPlain.mInt }),
                inYear: tCalendarValue.dayOf.with({ month: tColMatrixPlain.mInt.subtract(ctx.conn.const(39, 'int')) }),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select dateadd(day, (day(datefromparts(2001, 2, case when col_matrix.m_int < 1 then 29 else 28 end)) - 28), datefromparts(datepart(year, calendar_value.month_of), case when col_matrix.m_int < 12 then col_matrix.m_int else 12 end, 1)) as december, dateadd(day, (day(datefromparts(2001, 2, case when col_matrix.m_int < 1 then 29 else 28 end)) - 28), datefromparts(1972, datepart(month, calendar_value.day_of), case when col_matrix.m_int < day(eomonth(datefromparts(1972, datepart(month, calendar_value.day_of), 1))) then col_matrix.m_int else day(eomonth(datefromparts(1972, datepart(month, calendar_value.day_of), 1))) end)) as lastDay, dateadd(day, (day(datefromparts(2001, 2, case when (col_matrix.m_int - @1) < 1 then 29 else 28 end)) - 28), datefromparts(1972, case when (col_matrix.m_int - @0) < 12 then (col_matrix.m_int - @0) else 12 end, case when datepart(day, calendar_value.day_of) < day(eomonth(datefromparts(1972, case when (col_matrix.m_int - @0) < 12 then (col_matrix.m_int - @0) else 12 end, 1))) then datepart(day, calendar_value.day_of) else day(eomonth(datefromparts(1972, case when (col_matrix.m_int - @0) < 12 then (col_matrix.m_int - @0) else 12 end, 1))) end)) as inYear from calendar_value join col_matrix on col_matrix.id = @2 where calendar_value.id = @3"`)
        assertType<Exact<typeof rows, Array<{ december: Temporal.PlainYearMonth; lastDay: Temporal.PlainMonthDay; inYear: Temporal.PlainMonthDay }>>>()
        expect(rows.map(row => [row.december.toString(), row.lastDay.toString(), row.inYear.toString()])).toEqual([[expected.december.toString(), expected.lastDay.toString(), expected.inYear.toString()]])
        ctx.mockNext([{ december: '2024-12-01' }])
        const rejected = await failureOf(ctx.conn.selectFrom(tCalendarValue)
            .join(tColMatrixPlain).on(tColMatrixPlain.id.equals(1))
            .where(tCalendarValue.id.equals(1))
            .select({ december: tCalendarValue.monthOf.with({ month: tColMatrixPlain.mInt }, { overflow: 'reject' }) })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select dateadd(day, (day(datefromparts(2001, 2, case when col_matrix.m_int < 1 or col_matrix.m_int > 12 then 29 else 28 end)) - 28), datefromparts(datepart(year, calendar_value.month_of), col_matrix.m_int, 1)) as december from calendar_value join col_matrix on col_matrix.id = @0 where calendar_value.id = @1"`)
        expect(rejected).toBe(ctx.realDbEnabled)
    })
})
