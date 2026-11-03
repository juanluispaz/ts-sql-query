// Sqlite3WasmOO1QueryRunner against an in-memory @sqlite.org/sqlite-wasm OO1
// database, with the default promises and with SynchronousPromise.

import { SynchronousPromise } from 'synchronous-promise'
import { Sqlite3WasmOO1QueryRunner } from '../../../src/queryRunners/Sqlite3WasmOO1QueryRunner.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { sqliteDialect } from '../lib/dialects.js'
import { describeRunnerContract } from '../lib/runnerContract.js'

for (const sync of [false, true]) {
    describeRunnerContract({
        label: sync ? 'Sqlite3WasmOO1QueryRunner (SynchronousPromise)' : 'Sqlite3WasmOO1QueryRunner',
        errorScenarios: !sync,
        ...(sync ? {} : { errorFields: ['resultCode'] }),
        dialect: sqliteDialect,
    rolledBackTransactionUndetected: true,
        nativeExecute: async (connection, sql) => connection.exec(sql),
        runnerClass: Sqlite3WasmOO1QueryRunner,
        realEnabled: isRealDbEnabled('sqlite', 'wasm', 'newest', sync ? 'sqlite-wasm-OO1-sync' : 'sqlite-wasm-OO1'),
        async create() {
            const sqlite3InitModule = (await import('@sqlite.org/sqlite-wasm')).default
            const sqlite3 = await sqlite3InitModule()
            const db = new sqlite3.oo1.DB(':memory:', 'c')
            const runner = sync ? new Sqlite3WasmOO1QueryRunner(db, { promise: SynchronousPromise }) : new Sqlite3WasmOO1QueryRunner(db)
            return { runner, close: async () => { db.close() } }
        },
    })
}
