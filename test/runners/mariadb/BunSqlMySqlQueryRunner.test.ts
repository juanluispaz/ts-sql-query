// BunSqlMySqlQueryRunner over Bun SQL's mariadb adapter, against MariaDB. Bun only.

import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/mariadb/runners.js'
import { mariadbDialect } from '../lib/dialects.js'
import { describeRunnerContract } from '../lib/runnerContract.js'

const isBun = typeof globalThis.Bun !== 'undefined'

describeRunnerContract({
    label: 'BunSqlMySqlQueryRunner (MariaDB)',
    dialect: mariadbDialect,
    realEnabled: isBun && isRealDbEnabled('mariadb', 'docker', 'newest', 'bun_sql_mysql'),
    async create() {
        const { BunSqlMySqlQueryRunner } = await import('../../../src/queryRunners/BunSqlMySqlQueryRunner.js')
        const db = await acquireRunnerTestDatabase()
        const { SQL } = await import('bun')
        const sql = new SQL({ adapter: 'mysql', hostname: db.host, port: db.port, username: db.user, password: db.password, database: db.database, foundRows: true, max: 2 })
        return {
            runnerClass: BunSqlMySqlQueryRunner,
            runner: new BunSqlMySqlQueryRunner(sql, 'mariaDB'),
            close: async () => { await sql.close(); await db.release() },
        }
    },
})
