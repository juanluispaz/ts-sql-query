// MariaDBQueryRunner over a single mariadb connection.

import mariadb from 'mariadb'
import { MariaDBQueryRunner } from '../../../src/queryRunners/MariaDBQueryRunner.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/mariadb/runners.js'
import { mariadbDialect } from '../lib/dialects.js'
import { describeRunnerContract } from '../lib/runnerContract.js'

describeRunnerContract({
    label: 'MariaDBQueryRunner',
    dialect: mariadbDialect,
    runnerClass: MariaDBQueryRunner,
    realEnabled: isRealDbEnabled('mariadb', 'docker', 'newest', 'mariadb'),
    async create(failure) {
        const db = await acquireRunnerTestDatabase(failure)
        const connection = await mariadb.createConnection({ host: db.host, port: db.port, user: db.user, password: db.password, database: db.database })
        // A fatal error (a killed statement) closes the connection and is also emitted
        connection.on('error', () => undefined)
        return {
            runner: new MariaDBQueryRunner(connection),
            close: async () => { await connection.end(); await db.release() },
        }
    },
})
