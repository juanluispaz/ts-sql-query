// MySql2QueryRunner over a single mysql2 connection.

import mysql2 from 'mysql2'
import { MySql2QueryRunner } from '../../../src/queryRunners/MySql2QueryRunner.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/mysql/runners.js'
import { mysqlDialect } from '../lib/dialects.js'
import { describeRunnerContract } from '../lib/runnerContract.js'

describeRunnerContract({
    label: 'MySql2QueryRunner',
    dialect: mysqlDialect,
    runnerClass: MySql2QueryRunner,
    realEnabled: isRealDbEnabled('mysql', 'docker', 'newest', 'mysql2'),
    errorFields: ['code', 'errno', 'sqlState', 'sqlMessage'],
    async create(failure) {
        const db = await acquireRunnerTestDatabase(failure)
        const connection = mysql2.createConnection({ host: db.host, port: db.port, user: db.user, password: db.password, database: db.database })
        return {
            runner: new MySql2QueryRunner(connection),
            close: async () => { await new Promise<void>(resolve => connection.end(() => resolve())); await db.release() },
        }
    },
})
