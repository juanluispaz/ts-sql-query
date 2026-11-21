// Zoned dates and times (Temporal.ZonedDateTime) as the library takes them: the text it reads of one (its instant and
// its zone in brackets, as Temporal writes it or as Oracle gives it, the zone in capitals), the zone of a value checked
// as Temporal checks it, the options of toZonedDateTime and of the arithmetic of a zoned date and time, PostgreSQL, which
// computes one in the query and knows its zone from the operation that computed it or the text of a column, and the
// databases without zones, which keep it as its RFC 9557 text and where a computation with the zones fails when it is
// built and nothing is sent.

import { describe, expect, test } from '../../lib/testRunner.js'
import { PostgreSqlConnection } from '../../../src/connections/PostgreSqlConnection.js'
import { MySqlConnection } from '../../../src/connections/MySqlConnection.js'
import { OracleConnection } from '../../../src/connections/OracleConnection.js'
import { MockQueryRunner } from '../../../src/queryRunners/MockQueryRunner.js'
import { Table } from '../../../src/exports/v2/index.js'
import { parseZonedDateTimeText } from '../../../src/utils/plainDateTimeText.js'
import { oraclePlainTemporalForm } from '../../../src/utils/oracle/oracleParamTypes.js'
import { offsetNanosecondsOf } from '../../../src/utils/zonedOptions.js'

let queries = 0
const runner = () => new MockQueryRunner(() => {
    queries++
    return []
})

class PostgreSqlDBConnection extends PostgreSqlConnection<'PostgreSqlDBConnection'> {}
class MySqlDBConnection extends MySqlConnection<'MySqlDBConnection'> {}
class OracleDBConnection extends OracleConnection<'OracleDBConnection'> {}

const tPostgreSqlEvent = new class TPostgreSqlEvent extends Table<PostgreSqlDBConnection, 'TPostgreSqlEvent'> {
    id = this.primaryKey('id', 'int')
    at = this.column('at', 'instant')
    zone = this.optionalColumn('zone', 'string')
    zoned = this.optionalColumn('zoned', 'zonedDateTime')
    constructor() { super('event') }
}()
const tMySqlEvent = new class TMySqlEvent extends Table<MySqlDBConnection, 'TMySqlEvent'> {
    id = this.primaryKey('id', 'int')
    at = this.column('at', 'instant')
    constructor() { super('event') }
}()
const tOracleEvent = new class TOracleEvent extends Table<OracleDBConnection, 'TOracleEvent'> {
    id = this.primaryKey('id', 'int')
    at = this.column('at', 'instant')
    wall = this.column('wall', 'plainDateTime')
    constructor() { super('event') }
}()

/** The reason of the error the code throws or rejects with, or 'no error' */
async function reasonOf(code: () => unknown): Promise<string> {
    try {
        await code()
        return 'no error'
    } catch (error) {
        return (error as { errorReason?: { reason?: string } }).errorReason?.reason ?? String(error)
    }
}

describe('ZonedDateTimeValues', () => {
    test('the-text-of-a-zoned-date-and-time-is-read', () => {
        const madrid = Temporal.ZonedDateTime.from('2024-10-27T02:30:00.123456789+02:00[Europe/Madrid]')
        // As Temporal writes it, and as Oracle gives it: the wall clock with its offset and its era and the region in
        // capitals, or the instant in UTC
        expect(parseZonedDateTimeText(madrid.toString(), 'zonedDateTime')?.toString()).toBe(madrid.toString())
        expect(parseZonedDateTimeText('2024-10-27T02:30:00.123456789+02:00 AD[EUROPE/MADRID]', 'zonedDateTime')?.toString()).toBe(madrid.toString())
        expect(parseZonedDateTimeText('2024-10-27T02:30:00.123456789+01:00 AD[EUROPE/MADRID]', 'zonedDateTime')?.toString()).toBe(madrid.add({ hours: 1 }).toString())
        expect(parseZonedDateTimeText('0044-03-15T14:45:30.000000000+05:30 BC[+05:30]', 'zonedDateTime')?.toString()).toBe(Temporal.Instant.from('-000043-03-15T09:15:30Z').toZonedDateTimeISO('+05:30').toString())
        expect(parseZonedDateTimeText('2024-10-27T00:30:00.123456789Z AD[EUROPE/MADRID]', 'zonedDateTime')?.toString()).toBe(madrid.toString())
        expect(parseZonedDateTimeText('0044-03-15T09:15:30.000000000Z BC[+05:30]', 'zonedDateTime')?.toString()).toBe(Temporal.Instant.from('-000043-03-15T09:15:30Z').toZonedDateTimeISO('+05:30').toString())
        // Not one: without a zone, with a zone Temporal doesn't know, or not a date and time
        expect([
            parseZonedDateTimeText('2024-10-27T00:30:00Z', 'zonedDateTime'),
            parseZonedDateTimeText('2024-10-27T00:30:00Z[Nowhere/City]', 'zonedDateTime'),
            parseZonedDateTimeText('soon[Europe/Madrid]', 'zonedDateTime'),
        ]).toEqual([undefined, undefined, undefined])
    })

    test('the-zone-and-the-options-of-a-value-are-checked-as-temporal-checks-them', async () => {
        // A name of any case and an offset are zones; an unknown name isn't, nor a disambiguation Temporal hasn't
        expect(await reasonOf(() => tOracleEvent.at.toZonedDateTimeISO('europe/madrid'))).toBe('no error')
        expect(await reasonOf(() => tOracleEvent.at.toZonedDateTimeISO('-03:30'))).toBe('no error')
        expect(await reasonOf(() => tOracleEvent.at.toZonedDateTimeISO('Nowhere/City'))).toBe('INVALID_VALUE_TO_SEND_TO_DATABASE')
        expect(await reasonOf(() => tOracleEvent.wall.toZonedDateTime('Europe/Madrid', { disambiguation: 'first' as never }))).toBe('INVALID_VALUE_TO_SEND_TO_DATABASE')
    })

    test('the-options-of-the-arithmetic-of-a-zoned-date-and-time-are-checked-as-temporal-checks-them', async () => {
        // What Temporal takes is built; what it rejects fails when the query is built
        const connection = new OracleDBConnection(runner())
        const zoned = tOracleEvent.at.toZonedDateTimeISO('Europe/Madrid')
        const built = (valueSource: () => any) => reasonOf(() => connection.selectFrom(tOracleEvent).selectOneColumn(valueSource()).executeSelectMany())
        expect(await Promise.all([
            built(() => zoned.add({ days: 1 }, { overflow: 'reject' })),
            built(() => zoned.with({ offset: '+01:00' })),
            built(() => zoned.with({ hour: 2 }, { offset: 'use', disambiguation: 'reject' })),
            built(() => zoned.round({ smallestUnit: 'day', roundingMode: 'halfEven' })),
            built(() => zoned.until(zoned, { largestUnit: 'year', smallestUnit: 'week', roundingIncrement: 2 })),
        ])).toEqual(['no error', 'no error', 'no error', 'no error', 'no error'])
        expect(await Promise.all([
            built(() => zoned.add({ days: 1 }, { overflow: 'keep' as never })),
            built(() => zoned.add({ days: 1, hours: -1 })),
            built(() => zoned.with({ offset: '+1:00' })),
            built(() => zoned.with({ hour: 2 }, { offset: 'keep' as never })),
            built(() => zoned.with({ hour: 2 }, { disambiguation: 'first' as never })),
            built(() => zoned.with({} as never)),
            built(() => zoned.round({ smallestUnit: 'day', roundingIncrement: 2 })),
            built(() => zoned.round('week' as never)),
            built(() => zoned.until(zoned, { largestUnit: 'hour', smallestUnit: 'day' })),
            built(() => zoned.until(zoned, { smallestUnit: 'minute', roundingIncrement: 7 })),
        ])).toEqual(Array(10).fill('INVALID_VALUE_TO_SEND_TO_DATABASE'))
        // An offset as Temporal writes it: with or without colons, up to the nanosecond
        expect(['+01:00', '-0330', '+05', '+05:30:15.5', '+24:00', '1:00'].map(offset => offsetNanosecondsOf(offset))).toEqual([3_600_000_000_000n, -12_600_000_000_000n, 18_000_000_000_000n, 19_815_500_000_000n, undefined, undefined])
    })

    test('oracle-receives-the-instant-of-a-zoned-date-and-time-and-its-zone', async () => {
        // The text of the wall clock of its instant in UTC, which its placeholder takes to its zone, written by its name
        const madrid = Temporal.ZonedDateTime.from('2024-10-27T02:30:00.123456789+02:00[Europe/Madrid]')
        expect(oraclePlainTemporalForm(madrid, false)).toEqual({ text: '2024-10-27 00:30:00.123456789 AD', conversion: 'to_timestamp', format: 'YYYY-MM-DD HH24:MI:SS.FF9 BC' })
        let sql = ''
        const connection = new OracleDBConnection(new MockQueryRunner((_type, query) => {
            sql = query
            return []
        }))
        await connection.selectFrom(tOracleEvent).where(tOracleEvent.at.equals(connection.const(madrid, 'zonedDateTime').toInstant())).selectOneColumn(tOracleEvent.id).executeSelectMany()
        expect(sql).toBe("select id as \"result\" from event where at = (from_tz(to_timestamp(:0, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN'), '+00:00') at time zone 'Europe/Madrid')")
    })

    test('postgresql-knows-the-zone-of-a-zoned-date-and-time-only-where-the-query-computes-it', async () => {
        // A zoned date and time sent is its instant; a column keeps its RFC 9557 text, whose zone is in it, and a value
        // whose zone the query doesn't know (valueWhenNull of two, which may have different zones) can't be read: nothing
        // is sent
        let sql = ''
        let params: unknown[] = []
        const connection = new PostgreSqlDBConnection(new MockQueryRunner((_type, query, sent) => {
            queries++
            sql = query
            params = sent
            return []
        }))
        const madrid = Temporal.ZonedDateTime.from('2024-01-14T10:00:00.123456+01:00[Europe/Madrid]')
        await connection.selectFromNoTable().select({ at: connection.const(madrid, 'zonedDateTime') }).executeSelectOne().catch(() => undefined)
        expect([sql, params.map(String)]).toEqual(["select to_char($1::timestamptz at time zone 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\" BC') || '[Europe/Madrid]' as at", [madrid.toString()]])
        queries = 0
        const zoned = tPostgreSqlEvent.at.toZonedDateTimeISO(tPostgreSqlEvent.zone)
        expect(await Promise.all([
            reasonOf(() => connection.selectFrom(tPostgreSqlEvent).select({ zoned: tPostgreSqlEvent.zoned }).executeSelectMany()),
            reasonOf(() => connection.selectFrom(tPostgreSqlEvent).select({ zoned: zoned.valueWhenNull(tPostgreSqlEvent.at.toZonedDateTimeISO('UTC')) }).executeSelectMany()),
            reasonOf(() => connection.selectFrom(tPostgreSqlEvent).select({ hour: zoned.valueWhenNull(tPostgreSqlEvent.at.toZonedDateTimeISO('UTC')).hour() }).executeSelectMany()),
            reasonOf(() => connection.selectFrom(tPostgreSqlEvent).select({ zoneName: zoned.timeZoneId(), instant: zoned.valueWhenNull(madrid).toInstant() }).executeSelectMany()),
        ])).toEqual(['no error', 'UNSUPPORTED_QUERY', 'UNSUPPORTED_QUERY', 'no error'])
        expect(queries).toBe(2)
    })

    test('a-database-without-zones-fails-the-query-when-it-is-built', async () => {
        // MySQL computes with no zones of IANA: a computation with them sends nothing
        const connection = new MySqlDBConnection(runner())
        queries = 0
        expect(await reasonOf(() => connection.selectFrom(tMySqlEvent).select({ at: tMySqlEvent.at.toZonedDateTimeISO('Europe/Madrid') }).executeSelectMany())).toBe('UNSUPPORTED_QUERY')
        expect(queries).toBe(0)
    })

    test('a-database-without-zones-keeps-it-as-its-rfc-9557-text', async () => {
        // MySQL keeps a zoned date and time as the text of Temporal's toString, also for an offset of seconds of a zone
        // before its standard time (rounded to the minute), and reads it as Temporal's from with offset 'prefer': the
        // value written, the wall clock in its zone when the zone no longer has the offset, and a Z as the instant
        const values = ['2024-01-14T10:00:00.5+01:00[Europe/Madrid]', '1900-01-01T00:00:00[Europe/Madrid]', '2024-03-02T10:00:00-09:30[Pacific/Marquesas]'].map(text => Temporal.ZonedDateTime.from(text))
        const sent: unknown[] = []
        const read = ['2024-01-14T10:00:00.5+01:00[Europe/Madrid]', '1900-01-01T00:00:00-00:15[Europe/Madrid]', '2024-03-02T10:00:00-09:30[Pacific/Marquesas]', '2024-07-01T09:00:00+01:00[Europe/Madrid]', '2024-03-02T11:05:00Z[Europe/Paris]']
        const connection = new MySqlDBConnection(new MockQueryRunner((_type, _query, params) => {
            sent.push(...params)
            return read.map(at => ({ at }))
        }))
        const rows = await connection.selectFromNoTable().select({ at: connection.const(values[0]!, 'zonedDateTime') }).executeSelectMany()
        await connection.selectFromNoTable().select({ at: connection.const(values[1]!, 'zonedDateTime') }).executeSelectMany()
        await connection.selectFromNoTable().select({ at: connection.const(values[2]!, 'zonedDateTime') }).executeSelectMany()
        expect(sent).toEqual(values.map(value => value.toString()))
        expect(rows.map(row => row.at.toString())).toEqual([...values.map(value => value.toString()), '2024-07-01T09:00:00+02:00[Europe/Madrid]', '2024-03-02T12:05:00+01:00[Europe/Paris]'])
    })
})
