// OracleDBPoolQueryRunner over an oracledb pool, and OracleDBPoolPromiseQueryRunner
// over a promise of one.

import oracledb from 'oracledb'
import { OracleDBPoolQueryRunner } from '../../../src/queryRunners/OracleDBPoolQueryRunner.js'
import { OracleDBPoolPromiseQueryRunner } from '../../../src/queryRunners/OracleDBPoolPromiseQueryRunner.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/oracle/runners.js'
import { oracleDialect } from '../lib/dialects.js'
import { describeRunnerContract } from '../lib/runnerContract.js'

for (const promisePool of [false, true]) {
    describeRunnerContract({
        label: promisePool ? 'OracleDBPoolPromiseQueryRunner' : 'OracleDBPoolQueryRunner',
        pool: true,
        dialect: oracleDialect,
        nativeExecute: (connection, sql) => connection.execute(sql),
        runnerClass: promisePool ? OracleDBPoolPromiseQueryRunner : OracleDBPoolQueryRunner,
        realEnabled: isRealDbEnabled('oracle', 'docker', 'newest', 'oracledb'),
        timeoutMs: 300_000,
        errorFields: ['code', 'errorNum', 'offset', 'isRecoverable'],
        async create(failure) {
            const db = await acquireRunnerTestDatabase(failure)
            const pool = oracledb.createPool({ user: db.user, password: db.password, connectString: db.connectString, poolMin: 0, poolMax: 2, stmtCacheSize: 0 })
            const runner = promisePool ? new OracleDBPoolPromiseQueryRunner(pool) : new OracleDBPoolQueryRunner(await pool)
            return { runner, close: async () => { await (await pool).close(0); await db.release() } }
        },
    })
}
