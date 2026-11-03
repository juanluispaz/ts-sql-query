// BunSqlSqliteQueryRunner against an in-memory Bun SQL sqlite database. Bun only.

import { isRealDbEnabled } from '../../lib/backends.js'
import { sqliteDialect } from '../lib/dialects.js'
import { describeRunnerContract } from '../lib/runnerContract.js'

const isBun = typeof globalThis.Bun !== 'undefined'

describeRunnerContract({
    label: 'BunSqlSqliteQueryRunner',
    dialect: sqliteDialect,
    rolledBackTransactionUndetected: true,
    nativeExecute: (connection, sql) => connection.unsafe(sql),
    errorFields: ['code', 'errno'],
    realEnabled: isBun && isRealDbEnabled('sqlite', 'native', 'newest', 'bun_sql_sqlite'),
    async create() {
        const { BunSqlSqliteQueryRunner } = await import('../../../src/queryRunners/BunSqlSqliteQueryRunner.js')
        const { SQL } = await import('bun')
        const sql = new SQL({ adapter: 'sqlite', filename: ':memory:' })
        return { runnerClass: BunSqlSqliteQueryRunner, runner: new BunSqlSqliteQueryRunner(sql), close: async () => { await sql.close() } }
    },
})
