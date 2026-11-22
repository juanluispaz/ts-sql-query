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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, month_of as monthOf, day_of as dayOf, born_on as bornOn, date(tsq_date_with(strftime('%Y-%m-%d', born_on), null, null, 31, 0)) as lastOfMonth, date(tsq_date_with(strftime('%Y-%m-%d', born_on), null, 2, null, 0)) as inFebruary, date(tsq_date_with(strftime('%Y-%m-%d', day_of), 2023, null, null, 0)) as in2023, date(tsq_date_with(strftime('%Y-%m-%d', month_of), null, null, 30, 0)) as day30, tsq_duration_round_of(strftime('%Y-%m-01', month_of), strftime('%Y-%m-01', ?1), 'year', 'year', 1, 'halfExpand', 1) as toJune from calendar_value order by id"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as version, deployed_at as deployedAt, strftime('%Y-%m-%d %H:%M:%f', tsq_utc_of_epoch(cast(round(unixepoch(deployed_at, 'subsec') * 1000) as text), 1000000)) as ofMilliseconds, strftime('%Y-%m-%d %H:%M:%f', tsq_utc_of_epoch(cast((cast(round(unixepoch(deployed_at, 'subsec') * 1000) as integer) * 1000000) as text), 1)) as ofNanoseconds from project_release where deployed_at is not null order by version"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select case when m_int < 1 then abs(-9223372036854775807 - 1) else date(printf('%04d-%02d-%02d', cast(strftime('%Y', m_date) as integer), cast(strftime('%m', m_date) as integer), min(m_int, cast(strftime('%d', printf('%04d-%02d-01', cast(strftime('%Y', m_date) as integer), cast(strftime('%m', m_date) as integer)), '+1 months', '-1 days') as integer)))) end as lastDay, case when m_int < 1 then abs(-9223372036854775807 - 1) else date(printf('%04d-%02d-%02d', cast(strftime('%Y', m_date) as integer), min(m_int, 12), min(cast(strftime('%d', m_date) as integer), cast(strftime('%d', printf('%04d-%02d-01', cast(strftime('%Y', m_date) as integer), min(m_int, 12)), '+1 months', '-1 days') as integer)))) end as december, date(printf('%04d-%02d-%02d', (m_int + ?1), cast(strftime('%m', m_date) as integer), min(cast(strftime('%d', m_date) as integer), cast(strftime('%d', printf('%04d-%02d-01', (m_int + ?1), cast(strftime('%m', m_date) as integer)), '+1 months', '-1 days') as integer)))) as inYear, strftime('%H:%M:%f', printf('%02d:%02d:%02d.%03d', max(min(m_int, 23), 0), cast(strftime('%M', m_time) as integer), cast(strftime('%S', m_time) as integer), cast((cast(round(strftime('%f', m_time) * 1000) as integer) % 1000) * 1000000 / 1000000 as integer))) as lastHour, strftime('%H:%M:%f', printf('%02d:%02d:%02d.%03d', cast(strftime('%H', m_time) as integer), max(min(m_int, 59), 0), cast(strftime('%S', m_time) as integer), cast((cast(round(strftime('%f', m_time) * 1000) as integer) % 1000) * 1000000 / 1000000 as integer))) as minute, strftime('%H:%M:%f', printf('%02d:%02d:%02d.%03d', cast(strftime('%H', m_time) as integer), cast(strftime('%M', m_time) as integer), max(min((m_int * ?2), 59), 0), cast((cast(round(strftime('%f', m_time) * 1000) as integer) % 1000) * 1000000 / 1000000 as integer))) as lastSecond, case when m_int < 1 then abs(-9223372036854775807 - 1) else strftime('%Y-%m-%d %H:%M:%f', printf('%04d-%02d-%02d %02d:%02d:%02d.%03d', cast(strftime('%Y', m_datetime) as integer), cast(strftime('%m', m_datetime) as integer), min(m_int, cast(strftime('%d', printf('%04d-%02d-01', cast(strftime('%Y', m_datetime) as integer), cast(strftime('%m', m_datetime) as integer)), '+1 months', '-1 days') as integer)), max(min((?3 - m_int), 23), 0), cast(strftime('%M', m_datetime) as integer), cast(strftime('%S', m_datetime) as integer), cast((cast(round(strftime('%f', m_datetime) * 1000) as integer) % 1000) * 1000000 / 1000000 as integer))) end as dayAndHour, strftime('%Y-%m-%d %H:%M:%f', printf('%04d-%02d-%02d %02d:%02d:%02d.%03d', cast(strftime('%Y', m_datetime) as integer), cast(strftime('%m', m_datetime) as integer), cast(strftime('%d', m_datetime) as integer), cast(strftime('%H', m_datetime) as integer), cast(strftime('%M', m_datetime) as integer), cast(strftime('%S', m_datetime) as integer), cast((max(min(m_int, 999), 0) * 1000000 + cast((cast(round(strftime('%f', m_datetime) * 1000) as integer) % 1000) * 1000000 / 1000 as integer) % 1000 * 1000 + (cast(round(strftime('%f', m_datetime) * 1000) as integer) % 1000) * 1000000 % 1000) / 1000000 as integer))) as millisecond from col_matrix where id = ?4"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select case when m_int < 1 then abs(-9223372036854775807 - 1) else date(printf('%04d-%02d-%02d', cast(strftime('%Y', m_date) as integer), cast(strftime('%m', m_date) as integer), min(m_int, cast(strftime('%d', printf('%04d-%02d-01', cast(strftime('%Y', m_date) as integer), cast(strftime('%m', m_date) as integer)), '+1 months', '-1 days') as integer)))) end as lastDay, case when m_int < 1 then abs(-9223372036854775807 - 1) else date(printf('%04d-%02d-%02d', cast(strftime('%Y', m_date) as integer), min(m_int, 12), min(cast(strftime('%d', m_date) as integer), cast(strftime('%d', printf('%04d-%02d-01', cast(strftime('%Y', m_date) as integer), min(m_int, 12)), '+1 months', '-1 days') as integer)))) end as december, date(printf('%04d-%02d-%02d', (m_int + ?1), cast(strftime('%m', m_date) as integer), min(cast(strftime('%d', m_date) as integer), cast(strftime('%d', printf('%04d-%02d-01', (m_int + ?1), cast(strftime('%m', m_date) as integer)), '+1 months', '-1 days') as integer)))) as inYear, strftime('%H:%M:%f', printf('%02d:%02d:%02d.%03d', max(min(m_int, 23), 0), cast(strftime('%M', m_time) as integer), cast(strftime('%S', m_time) as integer), cast((cast(round(strftime('%f', m_time) * 1000) as integer) % 1000) * 1000000 / 1000000 as integer))) as lastHour, strftime('%H:%M:%f', printf('%02d:%02d:%02d.%03d', cast(strftime('%H', m_time) as integer), max(min(m_int, 59), 0), cast(strftime('%S', m_time) as integer), cast((cast(round(strftime('%f', m_time) * 1000) as integer) % 1000) * 1000000 / 1000000 as integer))) as minute, strftime('%H:%M:%f', printf('%02d:%02d:%02d.%03d', cast(strftime('%H', m_time) as integer), cast(strftime('%M', m_time) as integer), max(min((m_int * ?2), 59), 0), cast((cast(round(strftime('%f', m_time) * 1000) as integer) % 1000) * 1000000 / 1000000 as integer))) as lastSecond, case when m_int < 1 then abs(-9223372036854775807 - 1) else strftime('%Y-%m-%d %H:%M:%f', printf('%04d-%02d-%02d %02d:%02d:%02d.%03d', cast(strftime('%Y', m_datetime) as integer), cast(strftime('%m', m_datetime) as integer), min(m_int, cast(strftime('%d', printf('%04d-%02d-01', cast(strftime('%Y', m_datetime) as integer), cast(strftime('%m', m_datetime) as integer)), '+1 months', '-1 days') as integer)), max(min((?3 - m_int), 23), 0), cast(strftime('%M', m_datetime) as integer), cast(strftime('%S', m_datetime) as integer), cast((cast(round(strftime('%f', m_datetime) * 1000) as integer) % 1000) * 1000000 / 1000000 as integer))) end as dayAndHour, strftime('%Y-%m-%d %H:%M:%f', printf('%04d-%02d-%02d %02d:%02d:%02d.%03d', cast(strftime('%Y', m_datetime) as integer), cast(strftime('%m', m_datetime) as integer), cast(strftime('%d', m_datetime) as integer), cast(strftime('%H', m_datetime) as integer), cast(strftime('%M', m_datetime) as integer), cast(strftime('%S', m_datetime) as integer), cast((max(min(m_int, 999), 0) * 1000000 + cast((cast(round(strftime('%f', m_datetime) * 1000) as integer) % 1000) * 1000000 / 1000 as integer) % 1000 * 1000 + (cast(round(strftime('%f', m_datetime) * 1000) as integer) % 1000) * 1000000 % 1000) / 1000000 as integer))) as millisecond from col_matrix where id = ?4"`)
        expect(withFunctions.map(row => asRow(row))).toEqual([asRow(expected)])
    })

    test('fields-of-the-query-temporal-rejects-make-the-query-fail', async () => {
        // As Temporal throws: a day below 1 (the int 42 of the row negated); with reject, a month, an hour or a day out of
        // its range; a day in the month passes with reject
        const negated = ctx.conn.const(0, 'int').subtract(tColMatrixPlain.mInt)
        ctx.mockNext([{ value: '2024-03-04' }])
        const dayBelowOne = await failureOf(ctx.conn.selectFrom(tColMatrixPlain).where(tColMatrixPlain.id.equals(1))
            .select({ value: tColMatrixPlain.mDate.with({ day: negated }) }).executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select case when (?2 - m_int) < 1 then abs(-9223372036854775807 - 1) else date(printf('%04d-%02d-%02d', cast(strftime('%Y', m_date) as integer), cast(strftime('%m', m_date) as integer), min((?1 - m_int), cast(strftime('%d', printf('%04d-%02d-01', cast(strftime('%Y', m_date) as integer), cast(strftime('%m', m_date) as integer)), '+1 months', '-1 days') as integer)))) end as value from col_matrix where id = ?3"`)
        ctx.mockNext([{ value: '2024-03-04' }])
        const monthOutOfRange = await failureOf(ctx.conn.selectFrom(tColMatrixPlain).where(tColMatrixPlain.id.equals(1))
            .select({ value: tColMatrixPlain.mDate.with({ month: tColMatrixPlain.mInt }, { overflow: 'reject' }) }).executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select case when m_int < 1 or m_int > 12 then abs(-9223372036854775807 - 1) else date(printf('%04d-%02d-%02d', cast(strftime('%Y', m_date) as integer), m_int, case when cast(strftime('%d', m_date) as integer) > cast(strftime('%d', printf('%04d-%02d-01', cast(strftime('%Y', m_date) as integer), m_int), '+1 months', '-1 days') as integer) then abs(-9223372036854775807 - 1) else cast(strftime('%d', m_date) as integer) end)) end as value from col_matrix where id = ?1"`)
        ctx.mockNext([{ value: '09:15:00' }])
        const hourOutOfRange = await failureOf(ctx.conn.selectFrom(tColMatrixPlain).where(tColMatrixPlain.id.equals(1))
            .select({ value: tColMatrixPlain.mTime.with({ hour: tColMatrixPlain.mInt }, { overflow: 'reject' }) }).executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select case when m_int < 0 or m_int > 23 then abs(-9223372036854775807 - 1) else strftime('%H:%M:%f', printf('%02d:%02d:%02d.%03d', m_int, cast(strftime('%M', m_time) as integer), cast(strftime('%S', m_time) as integer), cast((cast(round(strftime('%f', m_time) * 1000) as integer) % 1000) * 1000000 / 1000000 as integer))) end as value from col_matrix where id = ?1"`)
        ctx.mockNext([{ value: '2024-03-04' }])
        const dayNotInMonth = await failureOf(ctx.conn.selectFrom(tColMatrixPlain).where(tColMatrixPlain.id.equals(1))
            .select({ value: tColMatrixPlain.mDate.with({ day: tColMatrixPlain.mInt }, { overflow: 'reject' }) }).executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select case when m_int < 1 then abs(-9223372036854775807 - 1) else date(printf('%04d-%02d-%02d', cast(strftime('%Y', m_date) as integer), cast(strftime('%m', m_date) as integer), case when m_int > cast(strftime('%d', printf('%04d-%02d-01', cast(strftime('%Y', m_date) as integer), cast(strftime('%m', m_date) as integer)), '+1 months', '-1 days') as integer) then abs(-9223372036854775807 - 1) else m_int end)) end as value from col_matrix where id = ?1"`)
        expect([dayBelowOne, monthOutOfRange, hourOutOfRange, dayNotInMonth]).toEqual([ctx.realDbEnabled, ctx.realDbEnabled, ctx.realDbEnabled, ctx.realDbEnabled])
        const day30 = Temporal.PlainDate.from('2024-03-04').with({ day: 30 }, { overflow: 'reject' })
        ctx.mockNext([{ value: day30.toString() }])
        const rows = await ctx.conn.selectFrom(tColMatrixPlain).where(tColMatrixPlain.id.equals(1))
            .select({ value: tColMatrixPlain.mDate.with({ day: tColMatrixPlain.mInt.subtract(ctx.conn.const(12, 'int')) }, { overflow: 'reject' }) }).executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select case when (m_int - ?2) < 1 then abs(-9223372036854775807 - 1) else date(printf('%04d-%02d-%02d', cast(strftime('%Y', m_date) as integer), cast(strftime('%m', m_date) as integer), case when (m_int - ?1) > cast(strftime('%d', printf('%04d-%02d-01', cast(strftime('%Y', m_date) as integer), cast(strftime('%m', m_date) as integer)), '+1 months', '-1 days') as integer) then abs(-9223372036854775807 - 1) else (m_int - ?1) end)) end as value from col_matrix where id = ?3"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select case when col_matrix.m_int < 1 then abs(-9223372036854775807 - 1) else date(printf('%04d-%02d-%02d', cast(strftime('%Y', calendar_value.month_of) as integer), min(col_matrix.m_int, 12), 1)) end as december, case when col_matrix.m_int < 1 then abs(-9223372036854775807 - 1) else date(printf('%04d-%02d-%02d', 1972, cast(strftime('%m', calendar_value.day_of) as integer), min(col_matrix.m_int, cast(strftime('%d', printf('%04d-%02d-01', 1972, cast(strftime('%m', calendar_value.day_of) as integer)), '+1 months', '-1 days') as integer)))) end as lastDay, case when (col_matrix.m_int - ?2) < 1 then abs(-9223372036854775807 - 1) else date(printf('%04d-%02d-%02d', 1972, min((col_matrix.m_int - ?1), 12), min(cast(strftime('%d', calendar_value.day_of) as integer), cast(strftime('%d', printf('%04d-%02d-01', 1972, min((col_matrix.m_int - ?1), 12)), '+1 months', '-1 days') as integer)))) end as inYear from calendar_value join col_matrix on col_matrix.id = ?3 where calendar_value.id = ?4"`)
        assertType<Exact<typeof rows, Array<{ december: Temporal.PlainYearMonth; lastDay: Temporal.PlainMonthDay; inYear: Temporal.PlainMonthDay }>>>()
        expect(rows.map(row => [row.december.toString(), row.lastDay.toString(), row.inYear.toString()])).toEqual([[expected.december.toString(), expected.lastDay.toString(), expected.inYear.toString()]])
        ctx.mockNext([{ december: '2024-12-01' }])
        const rejected = await failureOf(ctx.conn.selectFrom(tCalendarValue)
            .join(tColMatrixPlain).on(tColMatrixPlain.id.equals(1))
            .where(tCalendarValue.id.equals(1))
            .select({ december: tCalendarValue.monthOf.with({ month: tColMatrixPlain.mInt }, { overflow: 'reject' }) })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select case when col_matrix.m_int < 1 or col_matrix.m_int > 12 then abs(-9223372036854775807 - 1) else date(printf('%04d-%02d-%02d', cast(strftime('%Y', calendar_value.month_of) as integer), col_matrix.m_int, 1)) end as december from calendar_value join col_matrix on col_matrix.id = ?1 where calendar_value.id = ?2"`)
        expect(rejected).toBe(ctx.realDbEnabled)
    })
})
