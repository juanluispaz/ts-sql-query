// BunSqlMySqlQueryRunner over Bun SQL's mysql adapter, against MySQL. Bun only.

import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/mysql/runners.js'
import { mysqlDialect } from '../lib/dialects.js'
import { describeRunnerContract } from '../lib/runnerContract.js'

const isBun = typeof globalThis.Bun !== 'undefined'

describeRunnerContract({
    label: 'BunSqlMySqlQueryRunner (MySQL)',
    dialect: mysqlDialect,
    realEnabled: isBun && isRealDbEnabled('mysql', 'docker', 'newest', 'bun_sql_mysql'),
    errorFields: ['code', 'errno', 'sqlState'],
    async create(failure) {
        const { BunSqlMySqlQueryRunner } = await import('../../../src/queryRunners/BunSqlMySqlQueryRunner.js')
        const db = await acquireRunnerTestDatabase(failure)
        const { SQL } = await import('bun')
        const sql = new SQL({ adapter: 'mysql', hostname: db.host, port: db.port, username: db.user, password: db.password, database: db.database, foundRows: true, allowPublicKeyRetrieval: true, max: 2 })
        return {
            runnerClass: BunSqlMySqlQueryRunner,
            runner: new BunSqlMySqlQueryRunner(sql),
            close: async () => { await sql.close(); await db.release() },
        }
    },
})
