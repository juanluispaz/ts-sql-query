// PgLiteQueryRunner over an in-memory PGlite, with and without nested
// transactions.

import { PgLiteQueryRunner } from '../../../src/queryRunners/PgLiteQueryRunner.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { postgresDialect } from '../lib/dialects.js'
import { describeRunnerContract } from '../lib/runnerContract.js'

for (const nested of [false, true]) {
    describeRunnerContract({
        label: nested ? 'PgLiteQueryRunner (allowNestedTransactions)' : 'PgLiteQueryRunner',
        errorScenarios: !nested,
        sharedDatabase: false,
        dialect: postgresDialect,
        runnerClass: PgLiteQueryRunner,
        realEnabled: isRealDbEnabled('postgres', 'wasm', 'newest', 'pglite'),
        nestedTransactions: nested,
        errorFields: ['message'],
        async create() {
            const { PGlite } = await import('@electric-sql/pglite')
            const db = await PGlite.create('memory://')
            return {
                runner: new PgLiteQueryRunner(db, { allowNestedTransactions: nested }),
                close: async () => { await db.close() },
            }
        },
    })
}
