// PostgresQueryRunner over postgres.js.

import postgres from 'postgres'
import { PostgresQueryRunner } from '../../../src/queryRunners/PostgresQueryRunner.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/postgres/runners.js'
import { postgresDialect } from '../lib/dialects.js'
import { describeRunnerContract } from '../lib/runnerContract.js'

describeRunnerContract({
    label: 'PostgresQueryRunner',
    dialect: postgresDialect,
    nativeExecute: (connection, sql) => connection.unsafe(sql),
    runnerClass: PostgresQueryRunner,
    realEnabled: isRealDbEnabled('postgres', 'docker', 'newest', 'postgres'),
    errorFields: ['code', 'severity'],
    async create(failure) {
        const db = await acquireRunnerTestDatabase(failure)
        const sql = postgres(db.uri, { max: 2, onnotice: () => {} })
        return {
            runner: new PostgresQueryRunner(sql),
            close: async () => { await sql.end(); await db.release() },
        }
    },
})

// The query runner over a connection the caller reserved: it runs every statement and transaction on it, and leaves it
// to the caller to release
describeRunnerContract({
    label: 'PostgresQueryRunner (reserved connection)',
    errorScenarios: false,
    dialect: postgresDialect,
    nativeExecute: (connection, sql) => connection.unsafe(sql),
    runnerClass: PostgresQueryRunner,
    realEnabled: isRealDbEnabled('postgres', 'docker', 'newest', 'postgres'),
    async create(failure) {
        const db = await acquireRunnerTestDatabase(failure)
        const sql = postgres(db.uri, { max: 2, onnotice: () => {} })
        const reserved = await sql.reserve()
        return {
            runner: new PostgresQueryRunner(reserved),
            close: async () => { reserved.release(); await sql.end(); await db.release() },
        }
    },
})
