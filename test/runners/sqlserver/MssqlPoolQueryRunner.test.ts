// MssqlPoolQueryRunner over an mssql ConnectionPool, and MssqlPoolPromiseQueryRunner
// over a promise of one.

import { afterAll, beforeAll, describe, expect, test } from '../../lib/testRunner.js'
import type { QueryRunner } from '../../../src/queryRunners/QueryRunner.js'
import { MssqlPoolQueryRunner } from '../../../src/queryRunners/MssqlPoolQueryRunner.js'
import { MssqlPoolPromiseQueryRunner } from '../../../src/queryRunners/MssqlPoolPromiseQueryRunner.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/sqlserver/runners.js'
import { sqlServerDialect } from '../lib/dialects.js'
import { describeRunnerContract, rejectionOf } from '../lib/runnerContract.js'

for (const promisePool of [false, true]) {
    describeRunnerContract({
        label: promisePool ? 'MssqlPoolPromiseQueryRunner' : 'MssqlPoolQueryRunner',
        pool: promisePool,
        dialect: sqlServerDialect,
        runnerClass: promisePool ? MssqlPoolPromiseQueryRunner : MssqlPoolQueryRunner,
        realEnabled: isRealDbEnabled('sqlserver', 'docker', 'newest', 'mssql'),
        timeoutMs: 300_000,
        async create() {
            const db = await acquireRunnerTestDatabase()
            const pool = new db.mssql.ConnectionPool({ ...db.config, pool: { max: 2, min: 0 } })
            const connected = pool.connect()
            const runner = promisePool ? new MssqlPoolPromiseQueryRunner(connected) : new MssqlPoolQueryRunner(await connected)
            return { runner, close: async () => { await (await connected).close(); await db.release() } }
        },
    })
}

// SQL Server keeps a transaction's isolation level on the session; with a
// one-connection pool every query reuses the connection the transaction ran on.
for (const promisePool of [false, true]) {
    describe.skipIf(!isRealDbEnabled('sqlserver', 'docker', 'newest', 'mssql'))(promisePool ? 'MssqlPoolPromiseQueryRunner: isolation level' : 'MssqlPoolQueryRunner: isolation level', () => {
        let db: Awaited<ReturnType<typeof acquireRunnerTestDatabase>> | undefined
        let pool: import('mssql').ConnectionPool | undefined
        let runner: QueryRunner | undefined
        const sessionLevel = 'select transaction_isolation_level from sys.dm_exec_sessions where session_id = @@spid'
        beforeAll(async () => {
            db = await acquireRunnerTestDatabase()
            const connected = new db.mssql.ConnectionPool({ ...db.config, pool: { max: 1, min: 0 } }).connect()
            pool = await connected
            runner = promisePool ? new MssqlPoolPromiseQueryRunner(connected) : new MssqlPoolQueryRunner(pool)
        }, 300_000)
        afterAll(async () => {
            await pool?.close()
            await db?.release()
        }, 300_000)

        test('does-not-outlive-a-committed-transaction', async () => {
            const r = runner!
            expect(await r.executeSelectOneColumnOneRow(sessionLevel)).toBe(2)
            await r.executeBeginTransaction(['serializable'])
            expect(await r.executeSelectOneColumnOneRow(sessionLevel)).toBe(4)
            await r.executeCommit()
            expect(await r.executeSelectOneColumnOneRow(sessionLevel)).toBe(2)
        })

        test('does-not-outlive-a-rolled-back-transaction', async () => {
            const r = runner!
            await r.executeBeginTransaction(['repeatable read'])
            expect(await r.executeSelectOneColumnOneRow(sessionLevel)).toBe(3)
            await r.executeRollback()
            expect(await r.executeSelectOneColumnOneRow(sessionLevel)).toBe(2)
        })

        test('does-not-outlive-a-transaction-the-server-aborted', async () => {
            // The test database has no ALLOW_SNAPSHOT_ISOLATION: reading a table
            // dooms a snapshot transaction, and the server rolls it back itself.
            const r = runner!
            await r.executeBeginTransaction(['snapshot'])
            expect(r.isSqlError(await rejectionOf(r.executeSelectOneColumnOneRow('select count(*) from organization')))).toBe(true)
            await r.executeRollback().catch(() => undefined)
            expect(r.isTransactionActive()).toBe(false)
            expect(await r.executeSelectOneColumnOneRow(sessionLevel)).toBe(2)
        })
    })
}
