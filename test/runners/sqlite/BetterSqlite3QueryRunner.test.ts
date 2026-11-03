// BetterSqlite3QueryRunner against an in-memory better-sqlite3 database, with
// the default promises and with SynchronousPromise.

import Database from 'better-sqlite3'
import { SynchronousPromise } from 'synchronous-promise'
import { BetterSqlite3QueryRunner } from '../../../src/queryRunners/BetterSqlite3QueryRunner.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { sqliteDialect } from '../lib/dialects.js'
import { describeRunnerContract } from '../lib/runnerContract.js'

for (const sync of [false, true]) {
    describeRunnerContract({
        label: sync ? 'BetterSqlite3QueryRunner (SynchronousPromise)' : 'BetterSqlite3QueryRunner',
        errorScenarios: !sync,
        ...(sync ? {} : { errorFields: ['code'] }),
        dialect: sqliteDialect,
        nativeExecute: async (connection, sql) => connection.exec(sql),
        runnerClass: BetterSqlite3QueryRunner,
        realEnabled: isRealDbEnabled('sqlite', 'native', 'newest', sync ? 'better-sqlite3-sync' : 'better-sqlite3'),
        async create() {
            const db = new Database(':memory:')
            const runner = sync ? new BetterSqlite3QueryRunner(db, { promise: SynchronousPromise }) : new BetterSqlite3QueryRunner(db)
            return { runner, close: async () => { db.close() } }
        },
    })
}
