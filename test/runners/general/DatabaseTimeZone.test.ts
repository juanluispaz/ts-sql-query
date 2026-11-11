// The databaseTimeZone of a connection: a zone other than UTC is supported where the database completes the zone of a
// value without zone with its session for every date (PostgreSQL, Oracle); MariaDB and MySQL (convert_tz leaves the
// values before 1970 unconverted), SQL Server (AT TIME ZONE has only the zones of Windows, without their history) and
// SQLite reject it at the first query, before anything is sent.

import { describe, expect, test } from '../../lib/testRunner.js'
import { MariaDBConnection } from '../../../src/connections/MariaDBConnection.js'
import { MySqlConnection } from '../../../src/connections/MySqlConnection.js'
import { PostgreSqlConnection } from '../../../src/connections/PostgreSqlConnection.js'
import { SqlServerConnection } from '../../../src/connections/SqlServerConnection.js'
import { SqliteConnection } from '../../../src/connections/SqliteConnection.js'
import { MockQueryRunner } from '../../../src/queryRunners/MockQueryRunner.js'
import { reasonOf } from '../lib/runnerContract.js'

class MariaDBMadrid extends MariaDBConnection<'MariaDBMadrid'> { protected override databaseTimeZone = 'Europe/Madrid' }
class MySqlMadrid extends MySqlConnection<'MySqlMadrid'> { protected override databaseTimeZone = 'Europe/Madrid' }
class SqlServerMadrid extends SqlServerConnection<'SqlServerMadrid'> { protected override databaseTimeZone = 'Europe/Madrid' }
class SqliteMadrid extends SqliteConnection<'SqliteMadrid'> { protected override databaseTimeZone = 'Europe/Madrid' }
class PostgreSqlMadrid extends PostgreSqlConnection<'PostgreSqlMadrid'> { protected override databaseTimeZone = 'Europe/Madrid' }
class PostgreSqlEtcUtc extends PostgreSqlConnection<'PostgreSqlEtcUtc'> { protected override databaseTimeZone = 'Etc/UTC' }
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

    test('a-zone-other-than-utc-is-accepted-on-postgresql-and-a-name-of-utc-everywhere', async () => {
        const madrid = new PostgreSqlMadrid(new MockQueryRunner(() => 1, { database: 'postgreSql' }))
        const etcUtc = new PostgreSqlEtcUtc(new MockQueryRunner(() => 1, { database: 'postgreSql' }))
        expect(await outcomeOf(() => madrid.selectFromNoTable().selectOneColumn(madrid.const(1, 'int')).executeSelectOne())).toBe('executed')
        expect(await outcomeOf(() => etcUtc.selectFromNoTable().selectOneColumn(etcUtc.const(1, 'int')).executeSelectOne())).toBe('executed')
    })

    test('a-local-time-reference-date-that-is-neither-a-date-nor-today-is-rejected', async () => {
        const conn = new PostgreSqlBadReferenceDate(new MockQueryRunner(() => 1, { database: 'postgreSql' }))
        expect(await outcomeOf(() => conn.selectFromNoTable().selectOneColumn(conn.const(1, 'int')).executeSelectOne())).toBe('rejected: INVALID_CONFIGURATION')
    })
})
