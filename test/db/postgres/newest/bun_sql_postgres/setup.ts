// postgres in the "newest" zone via bun's built-in `bun:sql` (postgres
// dialect). Built-in module; loaded via dynamic import so the file can
// also be parsed under node — there the real branch is skipped.

import { castTypesByName, createBunSqlPostgresTestContext } from '../../runners.js'

export const ctx = createBunSqlPostgresTestContext({
    label: 'newest / bun_sql_postgres',
    compatibilityVersion: Number.POSITIVE_INFINITY,
    async createRealRunner(uri) {
        const { SQL } = await import('bun')
        const { BunSqlPostgresQueryRunner } = await import('../../../../../src/queryRunners/BunSqlPostgresQueryRunner.js')
        // Bun SQL opens its whole pool up front (10 connections by default): one
        // pool per test worker would exceed PostgreSQL's 100 max_connections when
        // every worker runs this cell. A worker runs one test at a time.
        const sql = new SQL(uri, { max: 3 })
        return {
            runner: new BunSqlPostgresQueryRunner(sql, { typesByName: castTypesByName }),
            shutdown: async () => { await sql.close() },
        }
    },
})
