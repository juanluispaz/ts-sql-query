// NodeSqliteQueryRunner against an in-memory node:sqlite database (Node's, or
// Bun's implementation under Bun), with the default promises and with
// SynchronousPromise.

import { createRequire } from 'node:module'
import { SynchronousPromise } from 'synchronous-promise'
import { NodeSqliteQueryRunner } from '../../../src/queryRunners/NodeSqliteQueryRunner.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { sqliteDialect } from '../lib/dialects.js'
import { describeRunnerContract } from '../lib/runnerContract.js'

// node:sqlite is built into Node 22.5+ (and Bun 1.4+); without it the tests are skipped
function nodeSqliteAvailable(): boolean {
    try {
        createRequire(import.meta.url)('node:sqlite')
        return true
    } catch {
        return false
    }
}

for (const sync of [false, true]) {
    describeRunnerContract({
        label: sync ? 'NodeSqliteQueryRunner (SynchronousPromise)' : 'NodeSqliteQueryRunner',
        errorScenarios: !sync,
        ...(sync ? {} : { errorFields: ['code', 'errcode', 'errstr'] }),
        dialect: sqliteDialect,
        runnerClass: NodeSqliteQueryRunner,
        realEnabled: nodeSqliteAvailable() && isRealDbEnabled('sqlite', 'native', 'newest', sync ? 'node_sqlite-sync' : 'node_sqlite'),
        async create() {
            const { DatabaseSync } = await import('node:sqlite')
            const db = new DatabaseSync(':memory:')
            const runner = sync ? new NodeSqliteQueryRunner(db, { promise: SynchronousPromise }) : new NodeSqliteQueryRunner(db)
            return { runner, close: async () => { db.close() } }
        },
    })
}
