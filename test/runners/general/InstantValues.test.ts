// Instants (Temporal.Instant) as the connection converts them: what it accepts reading a value (the Instant, its text
// with every digit of the fraction of a second, with an offset or as a wall clock of the zone of the database, a Date
// of a driver that gives one), what it sends (only an Instant), and the forms each database receives: the text of its
// wall clock in UTC (with `+00` and the era on PostgreSQL), and on SQLite the format of a localDateTime.

import { describe, expect, test } from '../../lib/testRunner.js'
import { PostgreSqlConnection } from '../../../src/connections/PostgreSqlConnection.js'
import { MySqlConnection } from '../../../src/connections/MySqlConnection.js'
import { SqliteConnection } from '../../../src/connections/SqliteConnection.js'
import type { SqliteDateTimeFormat, SqliteDateTimeFormatType } from '../../../src/connections/SqliteConfiguration.js'
import { MockQueryRunner } from '../../../src/queryRunners/MockQueryRunner.js'
import { Table, TsSqlError } from '../../../src/exports/v2/index.js'
import { postgreSqlDriverParams } from '../../../src/utils/postgreSql/postgreSqlParamTypes.js'
import { mySqlMariaDBDriverParams } from '../../../src/utils/mySqlMariaDB/mySqlMariaDBParamTypes.js'
import { sqlServerTemporalDate } from '../../../src/utils/sqlServer/sqlServerParamTypes.js'
import { oraclePlainTemporalForm } from '../../../src/utils/oracle/oracleParamTypes.js'

class DBConnection extends PostgreSqlConnection<'DBConnection'> {}
class DBConnectionInMadrid extends PostgreSqlConnection<'DBConnectionInMadrid'> {
    protected override databaseTimeZone = 'Europe/Madrid'
}
class MySqlDBConnection extends MySqlConnection<'MySqlDBConnection'> {}

const tEvent = new class TEvent extends Table<DBConnection, 'TEvent'> {
    id = this.primaryKey('id', 'int')
    at = this.column('at', 'instant')
    moment = this.column('moment', 'localDateTime')
    constructor() { super('event') }
}()
const tEventInMadrid = new class TEventInMadrid extends Table<DBConnectionInMadrid, 'TEventInMadrid'> {
    at = this.column('at', 'instant')
    constructor() { super('event') }
}()
const tMySqlEvent = new class TMySqlEvent extends Table<MySqlDBConnection, 'TMySqlEvent'> {
    id = this.primaryKey('id', 'int')
    at = this.column('at', 'instant')
    constructor() { super('event') }
}()

let rowsToReturn: any[] = []
let lastParams: any[] = []
const mock = () => new MockQueryRunner((type, _query, params) => {
    lastParams = params
    return type === 'insert' ? 1 : type === 'selectOneRow' ? rowsToReturn[0] : rowsToReturn
})
const conn = new DBConnection(mock())
const connInMadrid = new DBConnectionInMadrid(mock())
const mySqlConn = new MySqlDBConnection(mock())

async function readAt(value: unknown): Promise<string> {
    rowsToReturn = [{ at: value }]
    try {
        return (await conn.selectFrom(tEvent).select({ at: tEvent.at }).executeSelectOne()).at.toString()
    } catch (error) {
        return error instanceof TsSqlError ? error.errorReason.reason : String(error)
    }
}

async function sendAt(value: unknown): Promise<string> {
    rowsToReturn = []
    try {
        await conn.selectFrom(tEvent).where(tEvent.at.equals(value as Temporal.Instant)).select({ id: tEvent.id }).executeSelectMany()
        return 'no error'
    } catch (error) {
        return error instanceof TsSqlError ? error.errorReason.reason : String(error)
    }
}

/** A SQLite connection keeping its date and time values in a format */
function sqliteConnection(format: SqliteDateTimeFormat) {
    class Connection extends SqliteConnection<'SqliteDBConnection'> {
        protected override getDateTimeFormat(_type: SqliteDateTimeFormatType): SqliteDateTimeFormat {
            return format
        }
    }
    return new Connection(mock())
}
const tSqliteEvent = new class TSqliteEvent extends Table<SqliteConnection<'SqliteDBConnection'>, 'TSqliteEvent'> {
    id = this.primaryKey('id', 'int')
    at = this.column('at', 'instant')
    constructor() { super('event') }
}()

describe('InstantValues', () => {
    test('an-instant-is-read-as-it-is', async () => {
        expect(await readAt(Temporal.Instant.from('2024-01-14T09:15:30.123456789Z'))).toBe('2024-01-14T09:15:30.123456789Z')
    })

    test('a-text-with-an-offset-is-that-instant', async () => {
        expect(await readAt('2024-01-14 18:15:30.123456789+09')).toBe('2024-01-14T09:15:30.123456789Z')
        expect(await readAt('2024-01-14T09:15:30Z')).toBe('2024-01-14T09:15:30Z')
        expect(await readAt('2024-01-14T04:45:30.5-04:30')).toBe('2024-01-14T09:15:30.5Z')
        // Oracle's text, with its era
        expect(await readAt('2024-01-14T09:15:30.123456789Z AD')).toBe('2024-01-14T09:15:30.123456789Z')
        // PostgreSQL's text of a year before 1: the year -43 is 44 BC
        expect(await readAt('0044-03-15 09:15:30+00 BC')).toBe('-000043-03-15T09:15:30Z')
    })

    test('a-text-without-an-offset-is-a-wall-clock-of-the-zone-of-the-database', async () => {
        expect(await readAt('2024-01-14 09:15:30.1234567')).toBe('2024-01-14T09:15:30.1234567Z')
        expect(await readAt('2024-01-14')).toBe('2024-01-14T00:00:00Z')
        // With a database in Madrid (UTC+1 in January, +2 in July)
        rowsToReturn = [{ at: '2024-01-14 10:15:30.123' }, { at: '2024-07-14 11:15:30.123' }, { at: '2024-01-14 18:15:30+09' }]
        const rows = await connInMadrid.selectFrom(tEventInMadrid).select({ at: tEventInMadrid.at }).executeSelectMany()
        expect(rows.map(row => row.at.toString())).toEqual(['2024-01-14T09:15:30.123Z', '2024-07-14T09:15:30.123Z', '2024-01-14T09:15:30Z'])
    })

    test('a-date-of-a-driver-gives-its-instant', async () => {
        expect(await readAt(new Date(Date.UTC(2024, 0, 14, 9, 15, 30, 123)))).toBe('2024-01-14T09:15:30.123Z')
    })

    test('what-isnt-an-instant-is-rejected-reading-it', async () => {
        expect(await readAt('2024-02-30 09:15:30')).toBe('INVALID_VALUE_RECEIVED_FROM_DATABASE')
        expect(await readAt('2024-01-14 24:00:00')).toBe('INVALID_VALUE_RECEIVED_FROM_DATABASE')
        expect(await readAt('infinity')).toBe('INVALID_VALUE_RECEIVED_FROM_DATABASE')
        expect(await readAt(1705223730123)).toBe('INVALID_VALUE_RECEIVED_FROM_DATABASE')
        expect(await readAt(new Date(NaN))).toBe('INVALID_VALUE_RECEIVED_FROM_DATABASE')
        expect(await readAt(Temporal.PlainDateTime.from('2024-01-14T09:15'))).toBe('INVALID_VALUE_RECEIVED_FROM_DATABASE')
        // Beyond the range of an instant
        expect(await readAt('+275760-09-14 00:00:00Z')).toBe('INVALID_VALUE_RECEIVED_FROM_DATABASE')
    })

    test('only-an-instant-is-sent', async () => {
        expect(await sendAt(Temporal.Instant.from('2024-01-14T09:15:30Z'))).toBe('no error')
        expect(await sendAt(new Date(Date.UTC(2024, 0, 14)))).toBe('INVALID_VALUE_TO_SEND_TO_DATABASE')
        expect(await sendAt(Temporal.PlainDateTime.from('2024-01-14T09:15'))).toBe('INVALID_VALUE_TO_SEND_TO_DATABASE')
        expect(await sendAt(Temporal.Instant.from('2024-01-14T09:15:30Z').toZonedDateTimeISO('UTC'))).toBe('INVALID_VALUE_TO_SEND_TO_DATABASE')
        expect(await sendAt('2024-01-14T09:15:30Z')).toBe('INVALID_VALUE_TO_SEND_TO_DATABASE')
    })

    test('an-instant-sent-as-a-local-date-time-is-rejected', async () => {
        rowsToReturn = []
        let reason = 'no error'
        try {
            await conn.selectFrom(tEvent).where(tEvent.moment.equals(Temporal.Instant.from('2024-01-14T09:15:30Z') as unknown as Date)).select({ id: tEvent.id }).executeSelectMany()
        } catch (error) {
            reason = error instanceof TsSqlError ? error.message : String(error)
        }
        expect(reason).toBe('INVALID_VALUE_TO_SEND_TO_DATABASE: Invalid localDateTime value to send to the db: 2024-01-14T09:15:30Z')
    })

    test('each-database-receives-the-wall-clock-of-the-instant-in-utc', async () => {
        const instant = Temporal.Instant.from('2024-01-14T18:15:30.123456789+09:00')
        await conn.selectFrom(tEvent)
            .where(tEvent.at.equals(instant))
            .or(tEvent.at.equals(Temporal.Instant.from('-000043-03-15T09:15:30.1Z')))
            .select({ id: tEvent.id })
            .executeSelectMany()
        // PostgreSQL: with its offset, and the era of a year before 1
        expect(postgreSqlDriverParams(lastParams)).toEqual(['2024-01-14 09:15:30.123456789+00', '0044-03-15 09:15:30.1+00 BC'])
        // MySQL and MariaDB: the text of the wall clock
        await mySqlConn.selectFrom(tMySqlEvent).where(tMySqlEvent.at.equals(instant)).select({ id: tMySqlEvent.id }).executeSelectMany()
        expect(mySqlMariaDBDriverParams(lastParams)).toEqual(['2024-01-14 09:15:30.123456789'])
        // SQL Server: the Date tedious binds, with the digits below the millisecond apart
        const date = sqlServerTemporalDate(instant) as Date & { nanosecondDelta: number }
        expect([date.toISOString(), date.nanosecondDelta]).toEqual(['2024-01-14T09:15:30.123Z', 0.000456789])
        // Oracle: its text, converted with a format of its own
        expect(oraclePlainTemporalForm(instant, false)).toEqual({ text: '2024-01-14 09:15:30.123456789 AD', conversion: 'to_timestamp', format: 'YYYY-MM-DD HH24:MI:SS.FF9 BC' })
    })

    test('sqlite-keeps-an-instant-as-a-local-date-time', async () => {
        const instant = Temporal.Instant.from('2024-01-14T09:15:30.123456Z')
        const sent: Record<string, unknown> = {}
        const read: Record<string, string> = {}
        const formats: SqliteDateTimeFormat[] = [
            'localdate milliseconds as text', 'UTC seconds as text', 'UTC milliseconds as text using T separator and Z timezone',
            'Julian day as real number', 'Unix time seconds as integer', 'Unix time milliseconds as integer',
        ]
        for (const format of formats) {
            const sqlite = sqliteConnection(format)
            rowsToReturn = []
            await sqlite.insertInto(tSqliteEvent).set({ id: 1, at: instant }).executeInsert()
            sent[format] = lastParams[1]
            rowsToReturn = [{ at: lastParams[1] }]
            read[format] = (await sqlite.selectFrom(tSqliteEvent).select({ at: tSqliteEvent.at }).executeSelectOne()).at.toString()
        }
        // The process runs in UTC: a localdate format is the wall clock in UTC
        expect(sent).toEqual({
            'localdate milliseconds as text': '2024-01-14 09:15:30.123',
            'UTC seconds as text': '2024-01-14 09:15:30',
            'UTC milliseconds as text using T separator and Z timezone': '2024-01-14T09:15:30.123Z',
            'Julian day as real number': 2460323.8857653127,
            'Unix time seconds as integer': 1705223730,
            'Unix time milliseconds as integer': 1705223730123,
        })
        expect(read).toEqual({
            'localdate milliseconds as text': '2024-01-14T09:15:30.123Z',
            'UTC seconds as text': '2024-01-14T09:15:30Z',
            'UTC milliseconds as text using T separator and Z timezone': '2024-01-14T09:15:30.123Z',
            'Julian day as real number': '2024-01-14T09:15:30.123Z',
            'Unix time seconds as integer': '2024-01-14T09:15:30Z',
            'Unix time milliseconds as integer': '2024-01-14T09:15:30.123Z',
        })
        // A text with an offset, written by another program, is that instant; a year before 1 keeps its sign
        const sqlite = sqliteConnection('localdate milliseconds as text')
        rowsToReturn = [{ at: '2024-01-14T18:15:30.123+09:00' }, { at: '-0043-03-15 09:15:30.000' }]
        expect((await sqlite.selectFrom(tSqliteEvent).select({ at: tSqliteEvent.at }).executeSelectMany()).map(row => row.at.toString()))
            .toEqual(['2024-01-14T09:15:30.123Z', '-000043-03-15T09:15:30Z'])
    })

    test('a-runtime-without-temporal-fails-converting-a-value', async () => {
        const temporal = Object.getOwnPropertyDescriptor(globalThis, 'Temporal')!
        Reflect.deleteProperty(globalThis, 'Temporal')
        try {
            expect(await readAt('2024-01-14 09:15:30Z')).toBe('TEMPORAL_NOT_AVAILABLE')
        } finally {
            Object.defineProperty(globalThis, 'Temporal', temporal)
        }
        expect(await readAt('2024-01-14 09:15:30Z')).toBe('2024-01-14T09:15:30Z')
    })
})
