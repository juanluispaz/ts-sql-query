// MariaDBPoolQueryRunner over a mariadb pool.

import mariadb from 'mariadb'
import { MariaDBPoolQueryRunner } from '../../../src/queryRunners/MariaDBPoolQueryRunner.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/mariadb/runners.js'
import { mariadbDialect } from '../lib/dialects.js'
import { describeRunnerContract } from '../lib/runnerContract.js'

describeRunnerContract({
    label: 'MariaDBPoolQueryRunner',
    pool: true,
    dialect: mariadbDialect,
    runnerClass: MariaDBPoolQueryRunner,
    realEnabled: isRealDbEnabled('mariadb', 'docker', 'newest', 'mariadb'),
    async create() {
        const db = await acquireRunnerTestDatabase()
        const pool = mariadb.createPool({ host: db.host, port: db.port, user: db.user, password: db.password, database: db.database, connectionLimit: 2, minimumIdle: 0 })
        return {
            runner: new MariaDBPoolQueryRunner(pool),
            close: async () => { await pool.end(); await db.release() },
        }
    },
})
