// NodeSqliteQueryRunner against an in-memory node:sqlite database (Node's, or
// Bun's implementation under Bun), with the default promises and with
// SynchronousPromise.

import { createRequire } from 'node:module'
import { describe, expect, test } from '../../lib/testRunner.js'
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
        nativeExecute: async (connection, sql) => connection.exec(sql),
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

// A database opened with returnArrays gives each row as an array; the runner reads the rows of its statements as objects
async function returnArraysAvailable(): Promise<boolean> {
    if (!nodeSqliteAvailable()) {
        return false
    }
    const { DatabaseSync } = await import('node:sqlite')
    const db = new DatabaseSync(':memory:')
    try {
        return typeof db.prepare('select 1').setReturnArrays === 'function'
    } finally {
        db.close()
    }
}

describe.skipIf(!(await returnArraysAvailable()))('NodeSqliteQueryRunner: the configuration of the database', () => {
    test('the-rows-are-objects-with-return-arrays-on-the-database', async () => {
        const { DatabaseSync } = await import('node:sqlite')
        const db = new DatabaseSync(':memory:', { returnArrays: true })
        try {
            const runner = new NodeSqliteQueryRunner(db)
            expect(await runner.executeSelectOneRow("select 1 as one, 'text' as some_name", [])).toEqual({ one: 1, some_name: 'text' })
            expect(await runner.executeSelectOneColumnOneRow('select 2 as two', [])).toBe(2)
            // The database keeps it for its own statements
            expect(db.prepare('select 1 as one').all()).toEqual([[1]])
        } finally {
            db.close()
        }
    })
})
