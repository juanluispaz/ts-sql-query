// The Bun SQL query runners check the Bun.SQL instance they are given: its
// adapter must be the one the runner speaks, MySQL needs foundRows, and no
// transform may rename the columns of the results. Bun only; nothing connects
// (Bun.SQL connects on the first query).

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

    test('a-transform-that-renames-the-columns-of-the-results-is-refused', async () => {
        const { SQL } = await import('bun')
        const { BunSqlMySqlQueryRunner } = await import('../../../src/queryRunners/BunSqlMySqlQueryRunner.js')
        const { BunSqlPostgresQueryRunner } = await import('../../../src/queryRunners/BunSqlPostgresQueryRunner.js')
        const { BunSqlSqliteQueryRunner } = await import('../../../src/queryRunners/BunSqlSqliteQueryRunner.js')
        const created: InstanceType<typeof SQL>[] = []
        const sqlite = (transform?: unknown) => {
            const sql = new SQL({ adapter: 'sqlite', filename: ':memory:', ...(transform === undefined ? {} : { transform }) } as any)
            created.push(sql)
            return sql
        }
        const postgres = (transform?: unknown) => {
            const sql = new SQL({ adapter: 'postgres', url: 'postgres://user:pwd@127.0.0.1:1/db', ...(transform === undefined ? {} : { transform }) } as any)
            created.push(sql)
            return sql
        }
        const mysql = (transform?: unknown) => {
            const sql = new SQL({ adapter: 'mysql', hostname: '127.0.0.1', port: 1, username: 'u', password: 'p', database: 'd', foundRows: true, ...(transform === undefined ? {} : { transform }) } as any)
            created.push(sql)
            return sql
        }
        for (const transform of [SQL.camel, SQL.toCamel, { column: { from: (name: string) => name.toUpperCase() } }]) {
            expect(reasonOf(errorOf(() => new BunSqlSqliteQueryRunner(sqlite(transform))))).toBe('INVALID_CONFIGURATION')
            expect(reasonOf(errorOf(() => new BunSqlPostgresQueryRunner(postgres(transform))))).toBe('INVALID_CONFIGURATION')
            expect(reasonOf(errorOf(() => new BunSqlMySqlQueryRunner(mysql(transform))))).toBe('INVALID_CONFIGURATION')
        }
        // The names sent by the helpers of sql`` and the value of undefined don't change what the library reads
        for (const transform of [undefined, SQL.fromCamel, { undefined: null }]) {
            expect(new BunSqlSqliteQueryRunner(sqlite(transform)).database).toBe('sqlite')
            expect(new BunSqlPostgresQueryRunner(postgres(transform)).database).toBe('postgreSql')
            expect(new BunSqlMySqlQueryRunner(mysql(transform)).database).toBe('mySql')
        }
        await Promise.all(created.map(sql => sql.close()))
    })

    test('a-transform-whose-column-is-a-function-is-refused-as-given', async () => {
        // Bun turns `transform: { column: fn }` into `column.from` today; the check
        // doesn't depend on it: a Bun.SQL whose options keep the function as it was
        // given (here the options of a real instance with that transform put back).
        const { SQL } = await import('bun')
        const { BunSqlSqliteQueryRunner } = await import('../../../src/queryRunners/BunSqlSqliteQueryRunner.js')
        const sql = new SQL({ adapter: 'sqlite', filename: ':memory:' })
        const rename = (name: string) => name.toUpperCase()
        const given = Object.create(sql, { options: { value: { ...sql.options, transform: { column: rename } } } })
        expect(reasonOf(errorOf(() => new BunSqlSqliteQueryRunner(given)))).toBe('INVALID_CONFIGURATION')
        await sql.close()
    })
})
