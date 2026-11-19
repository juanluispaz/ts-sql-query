// The durations (Temporal.Duration) as the connection converts them: what it accepts reading a value (the duration, its
// ISO 8601 text, also with a sign in each field, the text of a PostgreSQL interval, an interval of oracledb), what it
// rejects (fields with mixed signs, a number), what it sends to each storage (an interval, or its ISO 8601 text), and the
// durations an interval of Oracle can't keep.

import { describe, expect, test } from '../../lib/testRunner.js'
import { PostgreSqlConnection } from '../../../src/connections/PostgreSqlConnection.js'
import { OracleConnection } from '../../../src/connections/OracleConnection.js'
import { MySqlConnection } from '../../../src/connections/MySqlConnection.js'
import { MockQueryRunner } from '../../../src/queryRunners/MockQueryRunner.js'
import { Table, TsSqlError, withSqlDataType } from '../../../src/exports/v2/index.js'
import { postgreSqlDriverParams } from '../../../src/utils/postgreSql/postgreSqlParamTypes.js'
import { durationIsoTextWithoutWeeks, durationPartsFor } from '../../../src/utils/durationValues.js'
import { sqliteScalarFunctions } from '../../../src/utils/sqlite/sqliteFunctions.js'
import { plainTemporalFieldsOf } from '../../../src/utils/plainTemporalFields.js'
import { plainTemporalRoundingOf } from '../../../src/utils/plainTemporalRounding.js'

class PgConnection extends PostgreSqlConnection<'PgConnection'> {}
class OraConnection extends OracleConnection<'OraConnection'> {}
class MyConnection extends MySqlConnection<'MyConnection'> {}

const tPgSpan = new class TPgSpan extends Table<PgConnection, 'TPgSpan'> {
    id = this.primaryKey('id', 'int')
    span = this.column('span', 'duration')
    constructor() { super('span') }
}()
const tOraSpan = new class TOraSpan extends Table<OraConnection, 'TOraSpan'> {
    id = this.primaryKey('id', 'int')
    span = this.column('span', 'duration')
    spanCalendar = this.column('span_calendar', 'duration', withSqlDataType({ family: 'interval', fields: 'year to month' }))
    spanText = this.column('span_text', 'duration', withSqlDataType({ family: 'character string', length: 64 }))
    constructor() { super('span') }
}()
const tMySpan = new class TMySpan extends Table<MyConnection, 'TMySpan'> {
    id = this.primaryKey('id', 'int')
    span = this.column('span', 'duration')
    constructor() { super('span') }
}()

let rowsToReturn: any[] = []
let lastSql = ''
let lastParams: any[] = []
function executor(type: string, query: string, params: any[]): any {
    lastSql = query
    lastParams = params
    return type === 'selectOneRow' ? rowsToReturn[0] : type === 'update' || type === 'insert' ? 1 : rowsToReturn
}
const pg = new PgConnection(new MockQueryRunner(executor, { queryRunner: 'PgPoolQueryRunner' }))
const oracle = new OraConnection(new MockQueryRunner(executor, { queryRunner: 'OracleDBQueryRunner' }))
const mysql = new MyConnection(new MockQueryRunner(executor, { queryRunner: 'MySql2QueryRunner' }))

function reasonOf(error: unknown): string {
    return error instanceof TsSqlError ? error.errorReason.reason : String(error)
}

/** The text of the duration read from that value, or the reason of its error */
async function read(value: unknown): Promise<string> {
    rowsToReturn = [{ span: value }]
    try {
        const row = await pg.selectFrom(tPgSpan).select({ span: tPgSpan.span }).executeSelectOne()
        return row.span.toString()
    } catch (error) {
        return reasonOf(error)
    }
}

/** What was sent, or the reason of the error */
async function outcome(execute: () => Promise<unknown>): Promise<string> {
    try {
        await execute()
        return 'sent'
    } catch (error) {
        return reasonOf(error)
    }
}

describe('DurationValues', () => {
    test('a-duration-and-its-iso-text-are-read-as-they-are', async () => {
        expect(await read(Temporal.Duration.from('P1Y2M3W4DT5H6M7.123456789S'))).toBe('P1Y2M3W4DT5H6M7.123456789S')
        expect(await read('P1Y2M3DT4H5M6.789S')).toBe('P1Y2M3DT4H5M6.789S')
        expect(await read('-PT90M')).toBe('-PT90M')
        expect(await read('PT0.000000001S')).toBe('PT0.000000001S')
        expect(await read('PT1,5S')).toBe('PT1.5S')
        expect(await read('p2w')).toBe('P2W')
    })

    test('an-iso-text-with-a-sign-in-each-field', async () => {
        // PostgreSQL's IntervalStyle 'iso_8601'
        expect(await read('P-1DT-2H')).toBe('-P1DT2H')
        expect(await read('PT-1.5S')).toBe('-PT1.5S')
        expect(await read('P-1Y-2M')).toBe('-P1Y2M')
    })

    test('the-text-of-a-postgresql-interval', async () => {
        // IntervalStyle 'postgres', the default
        expect(await read('1 year 2 mons 3 days 04:05:06.789')).toBe('P1Y2M3DT4H5M6.789S')
        expect(await read('2 years 1 mon')).toBe('P2Y1M')
        expect(await read('14 days')).toBe('P14D')
        expect(await read('-1 days -02:00:00')).toBe('-P1DT2H')
        expect(await read('-00:00:01.5')).toBe('-PT1.5S')
        expect(await read('00:00:00')).toBe('PT0S')
        expect(await read('100:00:00.123456')).toBe('PT100H0.123456S')
    })

    test('an-interval-of-oracledb', async () => {
        expect(await read({ years: 1, months: 2 })).toBe('P1Y2M')
        expect(await read({ years: -1, months: -2 })).toBe('-P1Y2M')
        expect(await read({ days: 3, hours: 4, minutes: 5, seconds: 6, fseconds: 789123456 })).toBe('P3DT4H5M6.789123456S')
        expect(await read({ days: -1, hours: -2, minutes: 0, seconds: 0, fseconds: 0 })).toBe('-P1DT2H')
    })

    test('the-text-of-an-interval-of-oracle', async () => {
        // As Oracle converts an interval to a text, as in an OUT bind of a RETURNING
        expect(await read('+000000003 04:05:06.789000000')).toBe('P3DT4H5M6.789S')
        expect(await read('-000000001 02:00:00.000000000')).toBe('-P1DT2H')
        expect(await read('+00 00:00:01')).toBe('PT1S')
        expect(await read('+000000001-02')).toBe('P1Y2M')
        expect(await read('-000000000-03')).toBe('-P3M')
    })

    test('a-value-whose-fields-mix-signs-is-rejected', async () => {
        // A Temporal.Duration has one sign; a PostgreSQL interval can mix them
        expect(await read('-1 days +02:03:00')).toBe('INVALID_VALUE_RECEIVED_FROM_DATABASE')
        expect(await read('1 mon -1 days')).toBe('INVALID_VALUE_RECEIVED_FROM_DATABASE')
        expect(await read('P-1DT2H')).toBe('INVALID_VALUE_RECEIVED_FROM_DATABASE')
        expect(await read({ days: 1, hours: -2, minutes: 0, seconds: 0, fseconds: 0 })).toBe('INVALID_VALUE_RECEIVED_FROM_DATABASE')
    })

    test('what-isnt-a-duration-is-rejected-reading-it', async () => {
        expect(await read('PT')).toBe('INVALID_VALUE_RECEIVED_FROM_DATABASE')
        expect(await read('P')).toBe('INVALID_VALUE_RECEIVED_FROM_DATABASE')
        expect(await read('1 hour')).toBe('INVALID_VALUE_RECEIVED_FROM_DATABASE')
        expect(await read('1.5')).toBe('INVALID_VALUE_RECEIVED_FROM_DATABASE')
        expect(await read(true)).toBe('INVALID_VALUE_RECEIVED_FROM_DATABASE')
        expect(await read(5400000000)).toBe('INVALID_VALUE_RECEIVED_FROM_DATABASE')
        expect(await read('5400000000')).toBe('INVALID_VALUE_RECEIVED_FROM_DATABASE')
        expect(await read(Temporal.PlainTime.from('01:30'))).toBe('INVALID_VALUE_RECEIVED_FROM_DATABASE')
        expect(await read({ days: 1 })).toBe('INVALID_VALUE_RECEIVED_FROM_DATABASE')
    })

    test('only-a-duration-is-sent', async () => {
        const send = (value: unknown) => outcome(() => pg.update(tPgSpan).set({ span: value as Temporal.Duration }).where(tPgSpan.id.equals(1)).executeUpdate())
        expect(await send(Temporal.Duration.from('PT1H'))).toBe('sent')
        expect(await send('PT1H')).toBe('INVALID_VALUE_TO_SEND_TO_DATABASE')
        expect(await send(3600000000)).toBe('INVALID_VALUE_TO_SEND_TO_DATABASE')
        expect(await send(Temporal.PlainTime.from('01:00'))).toBe('INVALID_VALUE_TO_SEND_TO_DATABASE')
    })

    test('postgresql-receives-a-sign-in-each-field-and-weeks-as-days', async () => {
        // PostgreSQL rejects `-P1DT2H` and has no weeks
        rowsToReturn = []
        await pg.selectFrom(tPgSpan)
            .where(tPgSpan.span.equals(Temporal.Duration.from('-P1DT2H')))
            .or(tPgSpan.span.equals(Temporal.Duration.from('P1W2DT0.000001S')))
            .or(tPgSpan.span.equals(Temporal.Duration.from('PT0S')))
            .select({ id: tPgSpan.id })
            .executeSelectMany()
        expect(lastSql).toBe('select id as id from span where span = $1 or span = $2 or span = $3')
        expect(postgreSqlDriverParams(lastParams)).toEqual(['P-1DT-2H', 'P9DT0.000001S', 'PT0S'])
    })

    test('oracle-receives-the-iso-text-with-weeks-as-days', () => {
        expect(durationIsoTextWithoutWeeks(Temporal.Duration.from('-P1W1DT2H'), false)).toBe('-P8DT2H')
        expect(durationIsoTextWithoutWeeks(Temporal.Duration.from('P1Y2M'), false)).toBe('P1Y2M')
        expect(durationIsoTextWithoutWeeks(Temporal.Duration.from('PT1.000000009S'), false)).toBe('PT1.000000009S')
    })

    test('oracle-converts-the-text-to-the-interval-of-the-column', async () => {
        await oracle.update(tOraSpan)
            .set({ span: Temporal.Duration.from('P1DT2H'), spanCalendar: Temporal.Duration.from('P1Y2M'), spanText: Temporal.Duration.from('P1Y2DT3H') })
            .where(tOraSpan.id.equals(1))
            .executeUpdate()
        expect(lastSql).toBe('update span set span = to_dsinterval(:0), span_calendar = to_yminterval(:1), span_text = :2 where id = :3')
        expect(lastParams.map(String)).toEqual(['P1DT2H', 'P1Y2M', 'P1Y2DT3H', '1'])
    })

    test('oracle-rejects-a-duration-that-doesnt-fit-the-interval-of-its-column', async () => {
        // An interval of days to seconds can't keep months, nor one of years to months days or less
        const setSpan = (value: Temporal.Duration) => outcome(() => oracle.update(tOraSpan).set({ span: value }).where(tOraSpan.id.equals(1)).executeUpdate())
        const setCalendar = (value: Temporal.Duration) => outcome(() => oracle.update(tOraSpan).set({ spanCalendar: value }).where(tOraSpan.id.equals(1)).executeUpdate())
        expect(await setSpan(Temporal.Duration.from('P1M'))).toBe('INVALID_VALUE_TO_SEND_TO_DATABASE')
        expect(await setSpan(Temporal.Duration.from('P1Y1D'))).toBe('INVALID_VALUE_TO_SEND_TO_DATABASE')
        expect(await setSpan(Temporal.Duration.from('P1W'))).toBe('sent')
        expect(await setCalendar(Temporal.Duration.from('P1D'))).toBe('INVALID_VALUE_TO_SEND_TO_DATABASE')
        expect(await setCalendar(Temporal.Duration.from('P1YT0.000000001S'))).toBe('INVALID_VALUE_TO_SEND_TO_DATABASE')
        expect(await setCalendar(Temporal.Duration.from('P14M'))).toBe('sent')
        // A text column keeps any duration
        expect(await outcome(() => oracle.update(tOraSpan).set({ spanText: Temporal.Duration.from('P1M1D') }).where(tOraSpan.id.equals(1)).executeUpdate())).toBe('sent')
    })

    test('a-database-without-intervals-keeps-the-iso-text', async () => {
        await mysql.update(tMySpan)
            .set({ span: Temporal.Duration.from('-P1Y2W3DT0.000000001S') })
            .where(tMySpan.id.equals(1))
            .executeUpdate()
        expect(lastParams.map(String)).toEqual(['-P1Y2W3DT0.000000001S', '1'])
    })

    test('the-parts-a-duration-adds-to-each-type', () => {
        const duration = Temporal.Duration.from('P1Y2M1W3DT36H0.000000001S')
        // A date takes the whole days of the time; a time only the time, less than a day
        expect(durationPartsFor(duration, 'date', 1)).toEqual({ months: 14, days: 11, seconds: 0, nanoseconds: 0 })
        expect(durationPartsFor(duration, 'time', 1)).toEqual({ months: 0, days: 0, seconds: 43200, nanoseconds: 1 })
        expect(durationPartsFor(duration, 'timestamp', -1)).toEqual({ months: -14, days: -10, seconds: -129600, nanoseconds: -1 })
        // Minus 36 hours is minus one day on a date, as in Temporal
        expect(durationPartsFor(Temporal.Duration.from('-PT36H'), 'date', 1).days).toBe(-1)
    })

    test('the-function-of-sqlite-reads-the-parts-of-the-iso-text', () => {
        const part = sqliteScalarFunctions.find(fn => fn.name === 'tsq_duration_part')!.fn as (value: unknown, part: unknown) => unknown
        const parts = (text: unknown) => ['M', 'D', 'S', 'N'].map(name => part(text, name))
        expect(parts('P1Y2M3W4DT5H6M7.123456789S')).toEqual([14, 25, 18367, 123456789])
        expect(parts('-PT26H')).toEqual([0, 0, -93600, 0])
        expect(parts('p1dt1,25s')).toEqual([0, 1, 1, 250000000])
        expect(parts('PT0.5S')).toEqual([0, 0, 0, 500000000])
        expect(parts(null)).toEqual([null, null, null, null])
    })

    test('a-duration-to-add-must-be-a-duration-of-temporal', async () => {
        rowsToReturn = [{ day: '2024-02-01' }]
        const day = pg.const(Temporal.PlainDate.from('2024-01-31'), 'plainDate')
        const add = (value: unknown) => outcome(() => pg.selectFromNoTable().select({ day: day.add(value as Temporal.Duration) }).executeSelectOne())
        expect(await add({ days: 1 })).toBe('sent')
        // Fields with different signs, a fraction, nothing of a duration
        expect(await add({ days: 1, hours: -1 })).toBe('INVALID_VALUE_TO_SEND_TO_DATABASE')
        expect(await add({ days: 1.5 })).toBe('INVALID_VALUE_TO_SEND_TO_DATABASE')
        expect(await add({})).toBe('INVALID_VALUE_TO_SEND_TO_DATABASE')
        expect(await add('P1D')).toBe('INVALID_VALUE_TO_SEND_TO_DATABASE')
    })

    test('the-fields-of-with-are-read-as-temporal-reads-them', () => {
        // Each case checked against Temporal's with of 2024-01-31 and 10:20:30.123456789
        const date = (fields: object) => { const result = plainTemporalFieldsOf(fields, 'date'); return result && [result.year, result.month, result.day] }
        const time = (fields: object) => { const result = plainTemporalFieldsOf(fields, 'time'); return result && [result.hour, result.minute, result.second, result.millisecond, result.microsecond, result.nanosecond] }
        expect(date({ month: 13 })).toEqual([undefined, 12, undefined])
        expect(date({ day: 1.7 })).toEqual([undefined, undefined, 1])
        expect(date({ day: '3' })).toEqual([undefined, undefined, 3])
        expect(date({ monthCode: 'M02' })).toEqual([undefined, 2, undefined])
        expect(time({ hour: 25, minute: -1, nanosecond: 1000 })).toEqual([23, 0, undefined, undefined, undefined, 999])
        // Rejected by Temporal: a day or a month below 1, a month code of another calendar or of another month, no
        // field of the type, a field that isn't a number
        expect(date({ day: 0 })).toBeUndefined()
        expect(date({ month: 0 })).toBeUndefined()
        expect(date({ monthCode: 'M13' })).toBeUndefined()
        expect(date({ month: 2, monthCode: 'M03' })).toBeUndefined()
        expect(date({})).toBeUndefined()
        expect(date({ hour: 3 })).toBeUndefined()
        expect(date({ day: Infinity })).toBeUndefined()
        expect(time({ minute: 'x' })).toBeUndefined()
    })

    test('with-rejects-the-fields-temporal-rejects', async () => {
        rowsToReturn = [{ day: '2024-02-29' }]
        const day = pg.const(Temporal.PlainDate.from('2024-01-31'), 'plainDate')
        const withFields = (fields: unknown) => outcome(() => pg.selectFromNoTable().select({ day: day.with(fields as { day: number }) }).executeSelectOne())
        expect(await withFields({ month: 2 })).toBe('sent')
        expect(await withFields({ day: 0 })).toBe('INVALID_VALUE_TO_SEND_TO_DATABASE')
        expect(await withFields({})).toBe('INVALID_VALUE_TO_SEND_TO_DATABASE')
    })

    test('the-options-of-round-are-read-as-temporal-reads-them', () => {
        // Each case checked against Temporal's round of a PlainTime and a PlainDateTime
        expect(plainTemporalRoundingOf('minute', 'time')).toEqual({ step: 60_000_000_000n, mode: 'halfExpand' })
        expect(plainTemporalRoundingOf({ smallestUnit: 'hours', roundingIncrement: 12, roundingMode: 'floor' }, 'time')).toEqual({ step: 43_200_000_000_000n, mode: 'trunc' })
        expect(plainTemporalRoundingOf({ smallestUnit: 'minute', roundingIncrement: 1.5 }, 'time')).toEqual({ step: 60_000_000_000n, mode: 'halfExpand' })
        expect(plainTemporalRoundingOf({ smallestUnit: 'second', roundingMode: 'expand' }, 'time')?.mode).toBe('ceil')
        expect(plainTemporalRoundingOf({ smallestUnit: 'second', roundingMode: 'halfCeil' }, 'time')?.mode).toBe('halfExpand')
        expect(plainTemporalRoundingOf({ smallestUnit: 'second', roundingMode: 'halfFloor' }, 'time')?.mode).toBe('halfTrunc')
        expect(plainTemporalRoundingOf('day', 'timestamp')).toEqual({ step: 86_400_000_000_000n, mode: 'halfExpand' })
        // Rejected by Temporal: an increment that doesn't divide the next unit or isn't less than it, a day of a time,
        // a day in more than one, no unit, an unknown mode
        expect(plainTemporalRoundingOf({ smallestUnit: 'hour', roundingIncrement: 24 }, 'time')).toBeUndefined()
        expect(plainTemporalRoundingOf({ smallestUnit: 'minute', roundingIncrement: 7 }, 'time')).toBeUndefined()
        expect(plainTemporalRoundingOf('day', 'time')).toBeUndefined()
        expect(plainTemporalRoundingOf({ smallestUnit: 'day', roundingIncrement: 2 }, 'timestamp')).toBeUndefined()
        expect(plainTemporalRoundingOf({ roundingIncrement: 2 }, 'time')).toBeUndefined()
        expect(plainTemporalRoundingOf({ smallestUnit: 'minute', roundingMode: 'nearest' }, 'time')).toBeUndefined()
    })

    test('reject-rejects-before-the-query-what-is-known-out-of-range', async () => {
        // As Temporal's with with overflow 'reject': a field out of its range, and a day the month given hasn't
        expect(plainTemporalFieldsOf({ month: 13 }, 'date', true)).toBeUndefined()
        expect(plainTemporalFieldsOf({ year: 2023, month: 2, day: 29 }, 'date', true)).toBeUndefined()
        expect(plainTemporalFieldsOf({ year: 2024, month: 2, day: 29 }, 'date', true)?.day).toBe(29)
        expect(plainTemporalFieldsOf({ hour: 25 }, 'time', true)).toBeUndefined()
        expect(plainTemporalFieldsOf({ minute: -1 }, 'time', true)).toBeUndefined()
        rowsToReturn = [{ day: '2024-02-29' }]
        const day = pg.const(Temporal.PlainDate.from('2024-01-31'), 'plainDate')
        expect(await outcome(() => pg.selectFromNoTable().select({ day: day.with({ month: 13 }, { overflow: 'reject' }) }).executeSelectOne())).toBe('INVALID_VALUE_TO_SEND_TO_DATABASE')
        expect(await outcome(async () => pg.selectFromNoTable().select({ day: day.add({ months: 1 }, { overflow: 'clamp' as 'reject' }) }).executeSelectOne())).toBe('INVALID_VALUE_TO_SEND_TO_DATABASE')
    })
})
