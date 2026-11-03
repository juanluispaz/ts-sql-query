// MySQL rolls back the whole transaction of a deadlock victim.

import mysql2 from 'mysql2'
import mysql2Promise from 'mysql2/promise'
import { MySql2QueryRunner } from '../../../src/queryRunners/MySql2QueryRunner.js'
import { MySql2PoolQueryRunner } from '../../../src/queryRunners/MySql2PoolQueryRunner.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/mysql/runners.js'
import { describeDeadlockRollback } from '../lib/deadlockRollback.js'

for (const pool of [false, true]) {
    describeDeadlockRollback(pool ? 'MySql2PoolQueryRunner' : 'MySql2QueryRunner', isRealDbEnabled('mysql', 'docker', 'newest', 'mysql2'), async () => {
        const db = await acquireRunnerTestDatabase()
        const config = { host: db.host, port: db.port, user: db.user, password: db.password, database: db.database }
        const native = pool ? mysql2.createPool({ ...config, connectionLimit: 2 }) : mysql2.createConnection(config)
        const other = await mysql2Promise.createConnection(config)
        return {
            runner: pool ? new MySql2PoolQueryRunner(native as mysql2.Pool) : new MySql2QueryRunner(native as mysql2.Connection),
            other: async (sql) => (await other.query(sql))[0],
            close: async () => { await other.end(); await new Promise<void>(resolve => native.end(() => resolve())); await db.release() },
        }
    })
}
