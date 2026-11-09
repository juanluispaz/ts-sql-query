// The mariadb runners receive the values as the library reads them, whatever the connection was configured with: the
// options they give every query (dateStrings, a BIGINT as a bigint and a DECIMAL as text, the rows as objects, no
// typeCast) replace the ones of the connection, which keeps them for its own queries.

import mariadb, { type ConnectionConfig, type PoolConfig } from 'mariadb'
import { afterAll, beforeAll, describe, expect, test } from '../../lib/testRunner.js'
import { MariaDBQueryRunner } from '../../../src/queryRunners/MariaDBQueryRunner.js'
import { MariaDBPoolQueryRunner } from '../../../src/queryRunners/MariaDBPoolQueryRunner.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/mariadb/runners.js'

const SQL = "select cast(1.50 as decimal(10, 2)) as amount, cast(12345678901234567 as signed) as big, cast('2024-01-14' as date) as d, cast('2024-01-14 09:15:30.123' as datetime(3)) as dt, 'text' as s"
const EXPECTED = { amount: '1.50', big: 12345678901234567n, d: '2024-01-14', dt: '2024-01-14 09:15:30.123', s: 'text' }

// What a user can configure on the connection that changes the values or the shape of the rows
const USER_OPTIONS = {
    typeCast: (column: { type: string }, next: () => unknown) => column.type === 'VAR_STRING' ? 'USER' : next(),
    rowsAsArray: true,
    metaAsArray: true,
    nestTables: true,
    decimalAsNumber: true,
    bigIntAsNumber: true,
    insertIdAsNumber: true,
    timezone: '+05:00',
} as const

describe.skipIf(!isRealDbEnabled('mariadb', 'docker', 'newest', 'mariadb'))('mariadb runners: the configuration of the connection', () => {
    let db: Awaited<ReturnType<typeof acquireRunnerTestDatabase>> | undefined
    beforeAll(async () => {
        db = await acquireRunnerTestDatabase()
    }, 300_000)
    afterAll(async () => {
        await db?.release()
    }, 300_000)

    const connectionOptions = () => ({ host: db!.host, port: db!.port, user: db!.user, password: db!.password, database: db!.database })

    test('the-options-of-the-connection-dont-apply-to-the-queries-of-the-runner', async () => {
        const connection = await mariadb.createConnection({ ...connectionOptions(), ...USER_OPTIONS } as ConnectionConfig)
        try {
            const runner = new MariaDBQueryRunner(connection)
            expect(await runner.executeSelectOneRow(SQL, [])).toEqual(EXPECTED)
            // The id of an inserted row is a bigint, exact, not a rounded number
            await runner.executeDatabaseSchemaModification('create temporary table rt_conf_ids (id bigint auto_increment primary key, v int) auto_increment = 9007199254740993')
            expect(await runner.executeInsertReturningLastInsertedId('insert into rt_conf_ids (v) values (1)', [])).toBe(9007199254740993n)
            // The connection keeps its options for its own queries
            const own = await connection.query(SQL)
            expect(Array.isArray(own[0])).toBe(true)
        } finally {
            await connection.end()
        }
    })

    test('the-options-of-the-pool-dont-apply-to-the-queries-of-the-runner', async () => {
        const pool = mariadb.createPool({ ...connectionOptions(), connectionLimit: 1, ...USER_OPTIONS } as PoolConfig)
        try {
            expect(await new MariaDBPoolQueryRunner(pool).executeSelectOneRow(SQL, [])).toEqual(EXPECTED)
        } finally {
            await pool.end()
        }
    })
})
