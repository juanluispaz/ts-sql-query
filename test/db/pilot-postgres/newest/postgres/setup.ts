// pilot-postgres in the "newest" zone (compatibilityVersion =
// Number.POSITIVE_INFINITY) via the `postgres` connector (see
// docs/configuration/query-runners/recommended/postgres.md).

import postgres, { type Sql } from 'postgres'

import { createPgTestContext } from '../../runners.js'
import { PostgresQueryRunner } from '../../../../../src/queryRunners/PostgresQueryRunner.js'

export const ctx = createPgTestContext({
    label: 'newest / postgres',
    compatibilityVersion: Number.POSITIVE_INFINITY,
    async createRealRunner(uri) {
        const sql: Sql = postgres(uri)
        return {
            runner: new PostgresQueryRunner(sql),
            shutdown: async () => { await sql.end() },
        }
    },
})
