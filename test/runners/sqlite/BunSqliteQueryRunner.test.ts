// BunSqliteQueryRunner against an in-memory bun:sqlite database, with the
// default promises and with SynchronousPromise. Bun only.

import { SynchronousPromise } from 'synchronous-promise'
import { isRealDbEnabled } from '../../lib/backends.js'
import { sqliteDialect } from '../lib/dialects.js'
import { describeRunnerContract } from '../lib/runnerContract.js'

const isBun = typeof globalThis.Bun !== 'undefined'

for (const sync of [false, true]) {
    describeRunnerContract({
        label: sync ? 'BunSqliteQueryRunner (SynchronousPromise)' : 'BunSqliteQueryRunner',
        errorScenarios: !sync,
        ...(sync ? {} : { errorFields: ['code', 'errno', 'byteOffset'] }),
        dialect: sqliteDialect,
        nativeExecute: async (connection, sql) => connection.run(sql),
        realEnabled: isBun && isRealDbEnabled('sqlite', 'native', 'newest', sync ? 'bun_sqlite-sync' : 'bun_sqlite'),
        async create() {
            const { BunSqliteQueryRunner } = await import('../../../src/queryRunners/BunSqliteQueryRunner.js')
            const { Database } = await import('bun:sqlite')
            const db = new Database(':memory:')
            const runner = sync ? new BunSqliteQueryRunner(db, { promise: SynchronousPromise }) : new BunSqliteQueryRunner(db)
            return { runnerClass: BunSqliteQueryRunner, runner, close: async () => { db.close() } }
        },
    })
}
