// BunSqlPostgresQueryRunner over Bun SQL's postgres adapter. Bun only.

import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/postgres/runners.js'
import { postgresDialect } from '../lib/dialects.js'
import { describeRunnerContract } from '../lib/runnerContract.js'

const isBun = typeof globalThis.Bun !== 'undefined'

describeRunnerContract({
    label: 'BunSqlPostgresQueryRunner',
    dialect: postgresDialect,
    realEnabled: isBun && isRealDbEnabled('postgres', 'docker', 'newest', 'bun_sql_postgres'),
    errorFields: ['code', 'errno'],
    async create(failure) {
        const { BunSqlPostgresQueryRunner } = await import('../../../src/queryRunners/BunSqlPostgresQueryRunner.js')
        const db = await acquireRunnerTestDatabase(failure)
        const { SQL } = await import('bun')
        const sql = new SQL(db.uri, { max: 2 })
        return {
            runnerClass: BunSqlPostgresQueryRunner,
            runner: new BunSqlPostgresQueryRunner(sql),
            close: async () => { await sql.close(); await db.release() },
        }
    },
})
