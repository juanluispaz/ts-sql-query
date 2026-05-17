// postgres in the "oldest" zone via bun's built-in `bun:sql` (postgres
// dialect). Built-in module; loaded via dynamic import so the file can
// also be parsed under node — there the real branch is skipped.

import { createBunSqlPostgresTestContext } from '../../runners.js'

export const ctx = createBunSqlPostgresTestContext({
    label: 'oldest / bun_sql_postgres',
    compatibilityVersion: 17_000_000,
    async createRealRunner(uri) {
        const { SQL } = await import('bun')
        const { BunSqlPostgresQueryRunner } = await import('../../../../../src/queryRunners/BunSqlPostgresQueryRunner.js')
        const sql = new SQL(uri)
        return {
            runner: new BunSqlPostgresQueryRunner(sql),
            shutdown: async () => { await sql.close() },
        }
    },
})
