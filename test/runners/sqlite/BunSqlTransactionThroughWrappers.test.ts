// postgres.js and Bun SQL begin and commit a transaction(fn) by themselves: a wrapper has to show those statements.

import { describe, expect, test } from '../../lib/testRunner.js'
import { LoggingQueryRunner } from '../../../src/queryRunners/LoggingQueryRunner.js'
import type { QueryType } from '../../../src/queryRunners/QueryRunner.js'

const isBun = typeof globalThis.Bun !== 'undefined'

describe('A wrapper over Bun SQL', () => {
    test.skipIf(!isBun)('sees-the-begin-and-the-commit-of-a-transaction', async () => {
        const { BunSqlSqliteQueryRunner } = await import('../../../src/queryRunners/BunSqlSqliteQueryRunner.js')
        const { SqliteConnection } = await import('../../../src/connections/SqliteConnection.js')
        const { SQL } = await import('bun')

        class DBConnection extends SqliteConnection<'DBConnection'> {}
        const log: QueryType[] = []
        const inner = new BunSqlSqliteQueryRunner(new SQL({ adapter: 'sqlite', filename: ':memory:' }))
        const connection = new DBConnection(new LoggingQueryRunner({ onQuery(type) { log.push(type) } }, inner))

        await connection.transaction(async () => {})

        expect(log).toEqual(['beginTransaction', 'commit'])
    })
})
