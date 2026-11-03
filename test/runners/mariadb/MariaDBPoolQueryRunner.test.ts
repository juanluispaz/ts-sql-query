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
    nativeExecute: (connection, sql) => connection.query(sql),
    runnerClass: MariaDBPoolQueryRunner,
    realEnabled: isRealDbEnabled('mariadb', 'docker', 'newest', 'mariadb'),
    errorFields: ['code', 'errno', 'sqlState', 'sqlMessage', 'fatal'],
    async create(failure) {
        const db = await acquireRunnerTestDatabase(failure)
        const pool = mariadb.createPool({ host: db.host, port: db.port, user: db.user, password: db.password, database: db.database, connectionLimit: 2, minimumIdle: 0, ...(failure ? { acquireTimeout: 2000 } : {}) })
        return {
            runner: new MariaDBPoolQueryRunner(pool),
            close: async () => { await pool.end(); await db.release() },
        }
    },
})
