// The mysql2 runners receive the values as the library reads them, whatever the connection was configured with: the
// options they give every query (dateStrings, the big numbers as text, the rows as objects, a typeCast of their own
// when the connection has one or reads a decimal as a number) replace the ones of the connection, which keeps them for
// its own queries.

import mysql2 from 'mysql2'
import { afterAll, beforeAll, describe, expect, test } from '../../lib/testRunner.js'
import { MySql2QueryRunner } from '../../../src/queryRunners/MySql2QueryRunner.js'
import { MySql2PoolQueryRunner } from '../../../src/queryRunners/MySql2PoolQueryRunner.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/mysql/runners.js'

const SQL = "select cast(1.50 as decimal(10, 2)) as amount, cast(12345678901234567 as signed) as big, cast('2024-01-14' as date) as d, cast('2024-01-14 09:15:30.123' as datetime(3)) as dt, 'text' as s"
const EXPECTED = { amount: '1.50', big: '12345678901234567', d: '2024-01-14', dt: '2024-01-14 09:15:30.123', s: 'text' }

// What a user can configure on the connection that changes the values or the shape of the rows
const USER_OPTIONS = {
    typeCast: (field: { type: string }, next: () => unknown) => field.type === 'VAR_STRING' ? 'USER' : next(),
    rowsAsArray: true,
    decimalNumbers: true,
    timezone: '+05:00',
} as const

describe.skipIf(!isRealDbEnabled('mysql', 'docker', 'newest', 'mysql2'))('mysql2 runners: the configuration of the connection', () => {
    let db: Awaited<ReturnType<typeof acquireRunnerTestDatabase>> | undefined
    beforeAll(async () => {
        db = await acquireRunnerTestDatabase()
    }, 300_000)
    afterAll(async () => {
        await db?.release()
    }, 300_000)

    const connectionOptions = () => ({ host: db!.host, port: db!.port, user: db!.user, password: db!.password, database: db!.database })

    test('the-options-of-the-connection-dont-apply-to-the-queries-of-the-runner', async () => {
        const connection = mysql2.createConnection({ ...connectionOptions(), ...USER_OPTIONS })
        try {
            expect(await new MySql2QueryRunner(connection).executeSelectOneRow(SQL, [])).toEqual(EXPECTED)
            // The connection keeps them for its own queries
            const own = await new Promise<any>((resolve, reject) => connection.query(SQL, (error: unknown, rows: unknown) => error ? reject(error) : resolve(rows)))
            expect(own[0]).toEqual([1.5, 12345678901234568, expect.any(Date), expect.any(Date), 'USER'])
        } finally {
            await new Promise<void>(resolve => connection.end(() => resolve()))
        }
    })

    test('a-decimal-is-text-with-decimal-numbers-and-no-type-cast-on-the-connection', async () => {
        const connection = mysql2.createConnection({ ...connectionOptions(), decimalNumbers: true })
        try {
            expect(await new MySql2QueryRunner(connection).executeSelectOneRow(SQL, [])).toEqual(EXPECTED)
        } finally {
            await new Promise<void>(resolve => connection.end(() => resolve()))
        }
    })

    test('a-connection-with-type-cast-false-doesnt-change-the-queries-of-the-runner', async () => {
        // typeCast: false makes mysql2 give every value as a Buffer
        const connection = mysql2.createConnection({ ...connectionOptions(), typeCast: false })
        const pool = mysql2.createPool({ ...connectionOptions(), connectionLimit: 1, typeCast: false })
        try {
            expect(await new MySql2QueryRunner(connection).executeSelectOneRow(SQL, [])).toEqual(EXPECTED)
            expect(await new MySql2PoolQueryRunner(pool).executeSelectOneRow(SQL, [])).toEqual(EXPECTED)
        } finally {
            await new Promise<void>(resolve => connection.end(() => resolve()))
            await new Promise<void>(resolve => pool.end(() => resolve()))
        }
    })

    test('the-options-of-the-pool-dont-apply-to-the-queries-of-the-runner', async () => {
        const pool = mysql2.createPool({ ...connectionOptions(), connectionLimit: 1, ...USER_OPTIONS })
        try {
            expect(await new MySql2PoolQueryRunner(pool).executeSelectOneRow(SQL, [])).toEqual(EXPECTED)
        } finally {
            await new Promise<void>(resolve => pool.end(() => resolve()))
        }
    })
})
