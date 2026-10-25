// PgQueryRunner over a single pg Client, with and without nested transactions.

import pg from 'pg'
import { PgQueryRunner } from '../../../src/queryRunners/PgQueryRunner.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/postgres/runners.js'
import { postgresDialect } from '../lib/dialects.js'
import { describeRunnerContract } from '../lib/runnerContract.js'

for (const nested of [false, true]) {
    describeRunnerContract({
        label: nested ? 'PgQueryRunner (allowNestedTransactions)' : 'PgQueryRunner',
        errorScenarios: !nested,
        dialect: postgresDialect,
        runnerClass: PgQueryRunner,
        realEnabled: isRealDbEnabled('postgres', 'docker', 'newest', 'pg'),
        nestedTransactions: nested,
        clientTimeout: true,
        errorFields: ['code', 'severity', 'schema', 'table', 'column', 'dataType', 'constraint'],
        async create(failure) {
            const db = await acquireRunnerTestDatabase(failure)
            const client = new pg.Client({ connectionString: db.uri, ...(failure === 'client timeout' ? { query_timeout: 300 } : {}) })
            await client.connect()
            return {
                runner: new PgQueryRunner(client, { allowNestedTransactions: nested }),
                close: async () => { await client.end(); await db.release() },
            }
        },
    })
}
