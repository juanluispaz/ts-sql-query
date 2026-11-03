// Sqlite3QueryRunner against an in-memory sqlite3 (npm) database.

import { Sqlite3QueryRunner } from '../../../src/queryRunners/Sqlite3QueryRunner.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { sqliteDialect } from '../lib/dialects.js'
import { describeRunnerContract } from '../lib/runnerContract.js'

describeRunnerContract({
    label: 'Sqlite3QueryRunner',
    dialect: sqliteDialect,
    nativeExecute: (connection, sql) => new Promise((resolve, reject) => connection.run(sql, (error: unknown) => error ? reject(error) : resolve(undefined))),
    errorFields: ['code', 'errno'],
    runnerClass: Sqlite3QueryRunner,
    realEnabled: isRealDbEnabled('sqlite', 'native', 'newest', 'sqlite3'),
    async create() {
        const sqlite3 = (await import('sqlite3')).default
        const db = new sqlite3.Database(':memory:')
        return {
            runner: new Sqlite3QueryRunner(db),
            close: () => new Promise<void>((resolve, reject) => db.close(e => e ? reject(e) : resolve())),
        }
    },
})
