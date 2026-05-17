// pilot-postgres in the "oldest" zone via the `postgres` connector.

import postgres, { type Sql } from 'postgres'

import { createPgTestContext } from '../../runners.js'
import { PostgresQueryRunner } from '../../../../../src/queryRunners/PostgresQueryRunner.js'

export const ctx = createPgTestContext({
    label: 'oldest / postgres',
    compatibilityVersion: 17_000_000,
    async createRealRunner(uri) {
        const sql: Sql = postgres(uri)
        return {
            runner: new PostgresQueryRunner(sql),
            shutdown: async () => { await sql.end() },
        }
    },
})
