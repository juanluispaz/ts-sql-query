// MariaDB rolls back the whole transaction of a deadlock victim.

import mariadb, { type Connection, type Pool } from 'mariadb'
import { MariaDBQueryRunner } from '../../../src/queryRunners/MariaDBQueryRunner.js'
import { MariaDBPoolQueryRunner } from '../../../src/queryRunners/MariaDBPoolQueryRunner.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/mariadb/runners.js'
import { describeDeadlockRollback } from '../lib/deadlockRollback.js'

for (const pool of [false, true]) {
    describeDeadlockRollback(pool ? 'MariaDBPoolQueryRunner' : 'MariaDBQueryRunner', isRealDbEnabled('mariadb', 'docker', 'newest', 'mariadb'), async () => {
        const db = await acquireRunnerTestDatabase()
        const config = { host: db.host, port: db.port, user: db.user, password: db.password, database: db.database }
        const native = pool ? mariadb.createPool({ ...config, connectionLimit: 2, minimumIdle: 0 }) : await mariadb.createConnection(config)
        const other = await mariadb.createConnection(config)
        return {
            runner: pool ? new MariaDBPoolQueryRunner(native as Pool) : new MariaDBQueryRunner(native as Connection),
            other: (sql) => other.query(sql),
            close: async () => { await other.end(); await native.end(); await db.release() },
        }
    })
}
