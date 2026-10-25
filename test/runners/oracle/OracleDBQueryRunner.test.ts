// OracleDBQueryRunner over a single oracledb connection.

import oracledb from 'oracledb'
import { OracleDBQueryRunner } from '../../../src/queryRunners/OracleDBQueryRunner.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/oracle/runners.js'
import { oracleDialect } from '../lib/dialects.js'
import { describeRunnerContract } from '../lib/runnerContract.js'

describeRunnerContract({
    label: 'OracleDBQueryRunner',
    dialect: oracleDialect,
    runnerClass: OracleDBQueryRunner,
    realEnabled: isRealDbEnabled('oracle', 'docker', 'newest', 'oracledb'),
    timeoutMs: 300_000,
    endWithoutTransaction: true,
    async create(failure) {
        const db = await acquireRunnerTestDatabase(failure)
        const connection = await oracledb.getConnection({ user: db.user, password: db.password, connectString: db.connectString })
        return {
            runner: new OracleDBQueryRunner(connection),
            close: async () => { await connection.close(); await db.release() },
        }
    },
})
