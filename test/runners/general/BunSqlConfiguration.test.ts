// The Bun SQL query runners check the Bun.SQL instance they are given: its
// adapter must be the one the runner speaks, and MySQL needs foundRows. Bun
// only; nothing connects (Bun.SQL connects on the first query).

import { describe, expect, test } from '../../lib/testRunner.js'
import { reasonOf } from '../lib/runnerContract.js'

const isBun = typeof globalThis.Bun !== 'undefined'

function errorOf(fn: () => unknown): unknown {
    try {
        fn()
    } catch (e) {
        return e
    }
    throw new Error('Expected the call to throw')
}

describe.skipIf(!isBun)('Bun SQL query runners: configuration', () => {
    test('each-runner-refuses-another-adapter', async () => {
        const { SQL } = await import('bun')
        const { BunSqlMySqlQueryRunner } = await import('../../../src/queryRunners/BunSqlMySqlQueryRunner.js')
        const { BunSqlPostgresQueryRunner } = await import('../../../src/queryRunners/BunSqlPostgresQueryRunner.js')
        const { BunSqlSqliteQueryRunner } = await import('../../../src/queryRunners/BunSqlSqliteQueryRunner.js')
        const sqlite = new SQL({ adapter: 'sqlite', filename: ':memory:' })
        const postgres = new SQL('postgres://user:pwd@127.0.0.1:1/db')
        expect(reasonOf(errorOf(() => new BunSqlPostgresQueryRunner(sqlite)))).toBe('INVALID_CONFIGURATION')
        expect(reasonOf(errorOf(() => new BunSqlMySqlQueryRunner(sqlite)))).toBe('INVALID_CONFIGURATION')
        expect(reasonOf(errorOf(() => new BunSqlSqliteQueryRunner(postgres)))).toBe('INVALID_CONFIGURATION')
        await sqlite.close()
        await postgres.close()
    })

    test('mysql-needs-found-rows', async () => {
        const { SQL } = await import('bun')
        const { BunSqlMySqlQueryRunner } = await import('../../../src/queryRunners/BunSqlMySqlQueryRunner.js')
        const withoutFoundRows = new SQL({ adapter: 'mysql', hostname: '127.0.0.1', port: 1, username: 'u', password: 'p', database: 'd' })
        const withFoundRows = new SQL({ adapter: 'mysql', hostname: '127.0.0.1', port: 1, username: 'u', password: 'p', database: 'd', foundRows: true })
        expect(reasonOf(errorOf(() => new BunSqlMySqlQueryRunner(withoutFoundRows)))).toBe('INVALID_CONFIGURATION')
        expect(new BunSqlMySqlQueryRunner(withFoundRows, 'mariaDB').database).toBe('mariaDB')
        await withoutFoundRows.close()
        await withFoundRows.close()
    })
})
