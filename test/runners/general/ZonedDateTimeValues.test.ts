// Zoned dates and times (Temporal.ZonedDateTime) as the library takes them: the text it reads of one (its instant and
// its zone in brackets, as Temporal writes it or as Oracle gives it, the zone in capitals), the zone of a value checked
// as Temporal checks it, the options of toZonedDateTime, and the databases without zones, where a query with one fails
// when it is built and nothing is sent.

import { describe, expect, test } from '../../lib/testRunner.js'
import { PostgreSqlConnection } from '../../../src/connections/PostgreSqlConnection.js'
import { OracleConnection } from '../../../src/connections/OracleConnection.js'
import { MockQueryRunner } from '../../../src/queryRunners/MockQueryRunner.js'
import { Table } from '../../../src/exports/v2/index.js'
import { parseZonedDateTimeText } from '../../../src/utils/plainDateTimeText.js'
import { oraclePlainTemporalForm } from '../../../src/utils/oracle/oracleParamTypes.js'

let queries = 0
const runner = () => new MockQueryRunner(() => {
    queries++
    return []
})

class PostgreSqlDBConnection extends PostgreSqlConnection<'PostgreSqlDBConnection'> {}
class OracleDBConnection extends OracleConnection<'OracleDBConnection'> {}

const tPostgreSqlEvent = new class TPostgreSqlEvent extends Table<PostgreSqlDBConnection, 'TPostgreSqlEvent'> {
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
        // As Temporal writes it, and as Oracle gives it: the instant in UTC with its era and the region in capitals
        expect(parseZonedDateTimeText(madrid.toString(), 'zonedDateTime')?.toString()).toBe(madrid.toString())
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

    test('a-database-without-zones-fails-the-query-when-it-is-built', async () => {
        // PostgreSQL keeps no zone with each value: nothing is sent, for a value source and for a value
        const connection = new PostgreSqlDBConnection(runner())
        queries = 0
        expect(await reasonOf(() => connection.selectFrom(tPostgreSqlEvent).select({ at: tPostgreSqlEvent.at.toZonedDateTimeISO('Europe/Madrid') }).executeSelectMany())).toBe('UNSUPPORTED_QUERY')
        expect(await reasonOf(() => connection.selectFromNoTable().select({ at: connection.const(Temporal.ZonedDateTime.from('2024-01-14T10:00:00+01:00[Europe/Madrid]'), 'zonedDateTime') }).executeSelectOne())).toBe('UNSUPPORTED_QUERY')
        expect(queries).toBe(0)
    })
})
