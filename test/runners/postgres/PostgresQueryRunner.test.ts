// PostgresQueryRunner over postgres.js.

import postgres from 'postgres'
import { PostgresQueryRunner } from '../../../src/queryRunners/PostgresQueryRunner.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/postgres/runners.js'
import { postgresDialect } from '../lib/dialects.js'
import { describeRunnerContract } from '../lib/runnerContract.js'
import { describe, expect, test } from '../../lib/testRunner.js'

describeRunnerContract({
    label: 'PostgresQueryRunner',
    dialect: postgresDialect,
    nativeExecute: (connection, sql) => connection.unsafe(sql),
    runnerClass: PostgresQueryRunner,
    realEnabled: isRealDbEnabled('postgres', 'docker', 'newest', 'postgres'),
    errorFields: ['code', 'severity'],
    clientTimeout: true,
    async create(failure) {
        const db = await acquireRunnerTestDatabase(failure)
        // query_timeout is in seconds: postgres.js cancels the query and rejects with QUERY_TIMEOUT
        const sql = postgres(db.uri, { max: 2, onnotice: () => {}, ...(failure === 'client timeout' ? { query_timeout: 0.3 } : {}) })
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

// The errors of postgres.js that depend on how its client is created
describe.skipIf(!isRealDbEnabled('postgres', 'docker', 'newest', 'postgres'))('PostgresQueryRunner (errors of the client options)', () => {
    async function errorOf(promise: Promise<unknown>): Promise<unknown> {
        return promise.then(() => { throw new Error('Expected a rejection') }, (error: unknown) => error)
    }

    test('error.waited-longer-than-queue-timeout-for-a-connection', async () => {
        const db = await acquireRunnerTestDatabase()
        const sql = postgres(db.uri, { max: 1, queue_timeout: 0.3, onnotice: () => {} })
        // The only connection of the pool is taken
        const reserved = await sql.reserve()
        try {
            const runner = new PostgresQueryRunner(sql)
            const error = await errorOf(runner.executeSelectManyRows('select 1'))
            expect(runner.isSqlError(error)).toBe(true)
            expect(runner.getErrorReason(error)).toMatchObject({ reason: 'SQL_TIMEOUT', timeoutType: 'connection', databaseErrorCode: 'QUEUE_TIMEOUT' })
        } finally {
            reserved.release()
            await sql.end()
            await db.release()
        }
    }, 30_000)

    test('error.nul-character-in-a-connection-parameter', async () => {
        const db = await acquireRunnerTestDatabase()
        const sql = postgres(db.uri, { max: 1, connection: { application_name: 'rt\0err' }, onnotice: () => {} })
        try {
            const runner = new PostgresQueryRunner(sql)
            const error = await errorOf(runner.executeSelectManyRows('select 1'))
            expect(runner.isSqlError(error)).toBe(true)
            expect(runner.getErrorReason(error)).toMatchObject({ reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration', databaseErrorCode: 'NUL_CHARACTER' })
        } finally {
            await Promise.race([sql.end().catch(() => undefined), new Promise(resolve => setTimeout(resolve, 2000))])
            await db.release()
        }
    }, 30_000)

    test('error.query-timeout-carries-the-cancel', async () => {
        const db = await acquireRunnerTestDatabase('client timeout')
        const sql = postgres(db.uri, { max: 1, query_timeout: 0.3, onnotice: () => {} })
        try {
            const runner = new PostgresQueryRunner(sql)
            const error = await errorOf(runner.executeSelectManyRows('select pg_sleep(2)'))
            expect(runner.getErrorReason(error)).toMatchObject({ reason: 'SQL_TIMEOUT', timeoutType: 'statement', databaseErrorCode: 'QUERY_TIMEOUT' })
            // The cancel of the query, answered by the server
            expect((error as { cause?: { code?: unknown } }).cause?.code).toBe('57014')
        } finally {
            await sql.end()
            await db.release()
        }
    }, 30_000)
})
