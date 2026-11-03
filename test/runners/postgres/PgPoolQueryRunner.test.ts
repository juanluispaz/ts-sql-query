// PgPoolQueryRunner over a pg Pool, with and without nested transactions.

import pg from 'pg'
import { PgPoolQueryRunner } from '../../../src/queryRunners/PgPoolQueryRunner.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/postgres/runners.js'
import { postgresDialect } from '../lib/dialects.js'
import { describeRunnerContract } from '../lib/runnerContract.js'

for (const nested of [false, true]) {
    describeRunnerContract({
        label: nested ? 'PgPoolQueryRunner (allowNestedTransactions)' : 'PgPoolQueryRunner',
        errorScenarios: !nested,
        pool: true,
        dialect: postgresDialect,
        nativeExecute: (connection, sql) => connection.query(sql),
        runnerClass: PgPoolQueryRunner,
        realEnabled: isRealDbEnabled('postgres', 'docker', 'newest', 'pg'),
        nestedTransactions: nested,
        clientTimeout: true,
        errorFields: ['code', 'severity', 'schema', 'table', 'column', 'dataType', 'constraint'],
        async create(failure) {
            const db = await acquireRunnerTestDatabase(failure)
            const pool = new pg.Pool({ connectionString: db.uri, max: 2, ...(failure === 'client timeout' ? { query_timeout: 300 } : {}) })
            return {
                runner: new PgPoolQueryRunner(pool, { allowNestedTransactions: nested }),
                close: async () => { await pool.end(); await db.release() },
            }
        },
    })
}
