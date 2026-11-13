// The databaseTimeZone of a connection: a zone other than UTC is supported where the database completes the zone of a
// value without zone with its session for every date (PostgreSQL, Oracle); MariaDB and MySQL (convert_tz leaves the
// values before 1970 unconverted), SQL Server (AT TIME ZONE has only the zones of Windows, without their history) and
// SQLite reject it at the first query, before anything is sent. The SQL Oracle receives outside UTC, and the same
// queries in UTC, unchanged.

import { describe, expect, test } from '../../lib/testRunner.js'
import { MariaDBConnection } from '../../../src/connections/MariaDBConnection.js'
import { MySqlConnection } from '../../../src/connections/MySqlConnection.js'
import { OracleConnection } from '../../../src/connections/OracleConnection.js'
import { PostgreSqlConnection } from '../../../src/connections/PostgreSqlConnection.js'
import { SqlServerConnection } from '../../../src/connections/SqlServerConnection.js'
import { SqliteConnection } from '../../../src/connections/SqliteConnection.js'
import { MockQueryRunner } from '../../../src/queryRunners/MockQueryRunner.js'
import { Table } from '../../../src/Table.js'
import { OracleDateAsTimestampTypeAdapter } from '../../../src/TypeAdapter.js'
import { reasonOf } from '../lib/runnerContract.js'

class MariaDBMadrid extends MariaDBConnection<'MariaDBMadrid'> { protected override databaseTimeZone = 'Europe/Madrid' }
class MySqlMadrid extends MySqlConnection<'MySqlMadrid'> { protected override databaseTimeZone = 'Europe/Madrid' }
class SqlServerMadrid extends SqlServerConnection<'SqlServerMadrid'> { protected override databaseTimeZone = 'Europe/Madrid' }
class SqliteMadrid extends SqliteConnection<'SqliteMadrid'> { protected override databaseTimeZone = 'Europe/Madrid' }
class PostgreSqlMadrid extends PostgreSqlConnection<'PostgreSqlMadrid'> { protected override databaseTimeZone = 'Europe/Madrid' }
class PostgreSqlEtcUtc extends PostgreSqlConnection<'PostgreSqlEtcUtc'> { protected override databaseTimeZone = 'Etc/UTC' }
class OracleOfZone extends OracleConnection<'OracleOfZone'> {
    constructor(databaseTimeZone: string) {
        super(new MockQueryRunner(() => 1, { database: 'oracle' }))
        this.databaseTimeZone = databaseTimeZone
    }
}
class TOracleMoment extends Table<OracleOfZone, 'TOracleMoment'> {
    id = this.primaryKey('id', 'int')
    ts = this.optionalColumn('ts', 'localDateTime')
    dx = this.optionalColumn('dx', 'localDateTime', new OracleDateAsTimestampTypeAdapter())
    t = this.optionalColumn('t', 'localTime')
    constructor() {
        super('moment')
    }
}
class PostgreSqlBadReferenceDate extends PostgreSqlConnection<'PostgreSqlBadReferenceDate'> {
    protected override databaseTimeZone = 'Europe/Madrid'
    protected override localTimeReferenceDate = 'yesterday'
}

async function outcomeOf(execute: () => Promise<unknown>): Promise<string> {
    try {
        await execute()
        return 'executed'
    } catch (error) {
        return 'rejected: ' + reasonOf(error)
    }
}

describe('The databaseTimeZone of the connection', () => {
    test('a-zone-other-than-utc-is-rejected-where-the-database-cant-complete-it', async () => {
        const sent: string[] = []
        const runner = (database: 'mariaDB' | 'mySql' | 'sqlServer' | 'sqlite') => new MockQueryRunner((_type, query) => { sent.push(query); return 1 }, { database })
        const mariaDB = new MariaDBMadrid(runner('mariaDB'))
        const mySql = new MySqlMadrid(runner('mySql'))
        const sqlServer = new SqlServerMadrid(runner('sqlServer'))
        const sqlite = new SqliteMadrid(runner('sqlite'))
        expect(await outcomeOf(() => mariaDB.selectFromNoTable().selectOneColumn(mariaDB.const(1, 'int')).executeSelectOne())).toBe('rejected: INVALID_CONFIGURATION')
        expect(await outcomeOf(() => mySql.selectFromNoTable().selectOneColumn(mySql.const(1, 'int')).executeSelectOne())).toBe('rejected: INVALID_CONFIGURATION')
        expect(await outcomeOf(() => sqlServer.selectFromNoTable().selectOneColumn(sqlServer.const(1, 'int')).executeSelectOne())).toBe('rejected: INVALID_CONFIGURATION')
        expect(await outcomeOf(() => sqlite.selectFromNoTable().selectOneColumn(sqlite.const(1, 'int')).executeSelectOne())).toBe('rejected: INVALID_CONFIGURATION')
        expect(sent).toEqual([])
    })

    test('a-zone-other-than-utc-is-accepted-on-postgresql-and-oracle-and-a-name-of-utc-everywhere', async () => {
        const madrid = new PostgreSqlMadrid(new MockQueryRunner(() => 1, { database: 'postgreSql' }))
        const etcUtc = new PostgreSqlEtcUtc(new MockQueryRunner(() => 1, { database: 'postgreSql' }))
        const oracle = new OracleOfZone('Europe/Madrid')
        expect(await outcomeOf(() => madrid.selectFromNoTable().selectOneColumn(madrid.const(1, 'int')).executeSelectOne())).toBe('executed')
        expect(await outcomeOf(() => oracle.selectFromNoTable().selectOneColumn(oracle.const(1, 'int')).executeSelectOne())).toBe('executed')
        expect(await outcomeOf(() => etcUtc.selectFromNoTable().selectOneColumn(etcUtc.const(1, 'int')).executeSelectOne())).toBe('executed')
    })

    test('a-local-time-reference-date-that-is-neither-a-date-nor-today-is-rejected', async () => {
        const conn = new PostgreSqlBadReferenceDate(new MockQueryRunner(() => 1, { database: 'postgreSql' }))
        expect(await outcomeOf(() => conn.selectFromNoTable().selectOneColumn(conn.const(1, 'int')).executeSelectOne())).toBe('rejected: INVALID_CONFIGURATION')
    })

    test('oracle-outside-utc-casts-a-compared-value-to-the-type-of-the-column-and-reads-the-instant', () => {
        const value = new Date('2024-01-14T09:15:30.123Z')
        const whole = new Date('2024-01-14T09:15:30.000Z')
        const sqlOf = (conn: OracleOfZone) => {
            const tMoment = new TOracleMoment()
            return [
                conn.insertInto(tMoment).set({ id: 1, ts: value, dx: whole, t: value }).query(),
                conn.update(tMoment).set({ ts: value }).where(tMoment.id.equals(1)).query(),
                conn.selectFrom(tMoment).where(tMoment.ts.equals(value)).and(tMoment.dx.equals(whole)).and(tMoment.dx.lessThan(value)).and(tMoment.t.equals(value))
                    .select({ ts: tMoment.ts, t: tMoment.t, hours: tMoment.ts.getHours(), time: tMoment.ts.getTime(), dxHours: tMoment.dx.getHours(), arr: conn.aggregateAsArrayOfOneColumn(tMoment.ts) }).query(),
                conn.insertInto(tMoment).set({ id: 1, ts: value, t: value }).returning({ ts: tMoment.ts, t: tMoment.t }).query(),
            ]
        }
        expect(sqlOf(new OracleOfZone('Europe/Madrid'))).toEqual([
            'insert into moment (id, ts, dx, t) values (:0, :1, :2, :3)',
            'update moment set ts = :0 where id = :1',
            'select cast(ts as timestamp with time zone) as "ts", cast(timestamp \'1970-01-01 00:00:00\' + (t - trunc(t)) as timestamp with time zone) as "t", '
                + 'extract(hour from sys_extract_utc(cast(ts as timestamp with time zone))) as "hours", '
                + "(trunc(sys_extract_utc(cast(ts as timestamp with time zone))) - date '1970-01-01') * 86400000 + to_number(to_char(sys_extract_utc(cast(ts as timestamp with time zone)), 'SSSSSFF3')) as \"time\", "
                + 'extract(hour from sys_extract_utc(cast(dx as timestamp with time zone))) as "dxHours", '
                + 'json_arrayagg(cast(ts as timestamp with time zone)) as "arr" '
                + 'from moment where ts = cast(:0 as timestamp) and dx = cast(:1 as date) and dx < cast(:2 as timestamp) and t = cast(:3 as timestamp)',
            'insert into moment (id, ts, t) values (:0, :1, :2) returning cast(ts as timestamp with time zone), cast(timestamp \'1970-01-01 00:00:00\' + (t - trunc(t)) as timestamp with time zone) into :3, :4',
        ])
        expect(sqlOf(new OracleOfZone('UTC'))).toEqual([
            'insert into moment (id, ts, dx, t) values (:0, :1, :2, :3)',
            'update moment set ts = :0 where id = :1',
            'select ts as "ts", t as "t", extract(hour from ts) as "hours", '
                + "(trunc(timestamp '1970-01-01 00:00:00' + (ts - timestamp '1970-01-01 00:00:00')) - date '1970-01-01') * 86400000 + to_number(to_char(timestamp '1970-01-01 00:00:00' + (ts - timestamp '1970-01-01 00:00:00'), 'SSSSSFF3')) as \"time\", "
                + 'extract(hour from cast(dx as timestamp)) as "dxHours", json_arrayagg(ts) as "arr" '
                + 'from moment where ts = :0 and dx = :1 and dx < :2 and t = :3',
            'insert into moment (id, ts, t) values (:0, :1, :2) returning ts, t into :3, :4',
        ])
    })
})
