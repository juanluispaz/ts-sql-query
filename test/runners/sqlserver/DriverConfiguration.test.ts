// The SQL Server runners receive the rows as the library reads them, whatever the pool was configured with: each
// request of the runner gives its rows as objects (arrayRowMode), and a pool whose tedious options rename the columns of
// the results (camelCaseColumns, columnNameReplacer), which can't be undone per request, is rejected when the runner is
// created.

import { afterAll, beforeAll, describe, expect, test } from '../../lib/testRunner.js'
import { MssqlPoolQueryRunner } from '../../../src/queryRunners/MssqlPoolQueryRunner.js'
import { MssqlPoolPromiseQueryRunner } from '../../../src/queryRunners/MssqlPoolPromiseQueryRunner.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/sqlserver/runners.js'
import { reasonOf, rejectionOf } from '../lib/runnerContract.js'

function errorOf(fn: () => unknown): unknown {
    try {
        fn()
    } catch (e) {
        return e
    }
    throw new Error('Expected the call to throw')
}

describe.skipIf(!isRealDbEnabled('sqlserver', 'docker', 'newest', 'mssql'))('mssql runners: the configuration of the pool', () => {
    let db: Awaited<ReturnType<typeof acquireRunnerTestDatabase>> | undefined
    beforeAll(async () => {
        db = await acquireRunnerTestDatabase()
    }, 300_000)
    afterAll(async () => {
        await db?.release()
    }, 300_000)

    test('the-rows-are-objects-with-array-row-mode-on-the-pool', async () => {
        const pool = await new db!.mssql.ConnectionPool({ ...db!.config, arrayRowMode: true, pool: { max: 1, min: 0 } }).connect()
        try {
            const runner = new MssqlPoolQueryRunner(pool)
            expect(await runner.executeSelectOneRow('select 1 as one, \'text\' as some_name', [])).toEqual({ one: 1, some_name: 'text' })
            await runner.executeBeginTransaction()
            try {
                expect(await runner.executeSelectOneRow('select 2 as two', [])).toEqual({ two: 2 })
            } finally {
                await runner.executeRollback()
            }
            // The pool keeps its mode for its own requests
            const own = await pool.request().query('select 1 as one')
            expect(own.recordset[0]).toEqual([1])
        } finally {
            await pool.close()
        }
    })

    test('a-pool-that-renames-the-columns-is-rejected', async () => {
        const camelCase = new db!.mssql.ConnectionPool({ ...db!.config, options: { ...db!.config.options, camelCaseColumns: true } })
        const replacer = new db!.mssql.ConnectionPool({ ...db!.config, options: { ...db!.config.options, columnNameReplacer: (name: string) => name.toUpperCase() } })
        const plain = new db!.mssql.ConnectionPool(db!.config)
        try {
            expect(reasonOf(errorOf(() => new MssqlPoolQueryRunner(camelCase)))).toBe('INVALID_CONFIGURATION')
            expect(reasonOf(errorOf(() => new MssqlPoolQueryRunner(replacer)))).toBe('INVALID_CONFIGURATION')
            expect(new MssqlPoolQueryRunner(plain).database).toBe('sqlServer')
            // A promise of the pool shows its configuration only when it resolves: the first query is rejected
            const promised = new MssqlPoolPromiseQueryRunner(camelCase.connect())
            expect(reasonOf(await rejectionOf(promised.executeSelectOneRow('select 1 as one', [])))).toBe('INVALID_CONFIGURATION')
        } finally {
            await Promise.all([camelCase.close(), replacer.close(), plain.close()])
        }
    })
})
