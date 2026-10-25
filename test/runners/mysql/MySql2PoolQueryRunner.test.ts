// MySql2PoolQueryRunner over a mysql2 pool.

import mysql2 from 'mysql2'
import { MySql2PoolQueryRunner } from '../../../src/queryRunners/MySql2PoolQueryRunner.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/mysql/runners.js'
import { mysqlDialect } from '../lib/dialects.js'
import { describeRunnerContract } from '../lib/runnerContract.js'

describeRunnerContract({
    label: 'MySql2PoolQueryRunner',
    pool: true,
    dialect: mysqlDialect,
    runnerClass: MySql2PoolQueryRunner,
    realEnabled: isRealDbEnabled('mysql', 'docker', 'newest', 'mysql2'),
    async create(failure) {
        const db = await acquireRunnerTestDatabase(failure)
        const pool = mysql2.createPool({ host: db.host, port: db.port, user: db.user, password: db.password, database: db.database, connectionLimit: 2 })
        return {
            runner: new MySql2PoolQueryRunner(pool),
            close: async () => { await new Promise<void>(resolve => pool.end(() => resolve())); await db.release() },
        }
    },
})
