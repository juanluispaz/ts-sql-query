// postgres.js and Bun SQL begin and commit a transaction(fn) by themselves: a wrapper has to show those statements.

import postgres from 'postgres'
import { PostgreSqlConnection } from '../../../src/connections/PostgreSqlConnection.js'
import { LoggingQueryRunner } from '../../../src/queryRunners/LoggingQueryRunner.js'
import { PostgresQueryRunner } from '../../../src/queryRunners/PostgresQueryRunner.js'
import type { QueryType } from '../../../src/queryRunners/QueryRunner.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/postgres/runners.js'
import { describe, expect, test } from '../../lib/testRunner.js'

class DBConnection extends PostgreSqlConnection<'DBConnection'> {}

describe.skipIf(!isRealDbEnabled('postgres', 'docker', 'newest', 'postgres'))('A wrapper over postgres.js', () => {
    test('sees-the-begin-and-the-commit-of-a-transaction', async () => {
        const db = await acquireRunnerTestDatabase()
        const sql = postgres(db.uri, { max: 2, onnotice: () => {} })
        try {
            const log: QueryType[] = []
            const connection = new DBConnection(new LoggingQueryRunner({ onQuery(type) { log.push(type) } }, new PostgresQueryRunner(sql)))

            await connection.transaction(async () => {})
            await expect(connection.transaction(async () => { throw new Error('body') })).rejects.toThrow('body')

            expect(log).toEqual(['beginTransaction', 'commit', 'beginTransaction', 'rollback'])
        } finally {
            await sql.end()
            await db.release()
        }
    })

    test('on-a-reserved-connection-the-transaction-is-visible-by-itself', async () => {
        const db = await acquireRunnerTestDatabase()
        const sql = postgres(db.uri, { max: 2, onnotice: () => {} })
        const reserved = await sql.reserve()
        try {
            const log: QueryType[] = []
            const connection = new DBConnection(new LoggingQueryRunner({ onQuery(type) { log.push(type) } }, new PostgresQueryRunner(reserved)))

            await connection.transaction(async () => {})

            expect(log).toEqual(['beginTransaction', 'commit'])
        } finally {
            reserved.release()
            await sql.end()
            await db.release()
        }
    })
})
