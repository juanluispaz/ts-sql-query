// postgres in the "newest" zone — compatibilityVersion =
// Number.POSITIVE_INFINITY, the library default.
//
// Connector: `postgres` (porsager/postgres — see
// docs/databases/postgresql/query-runners/postgres.md).

import postgres from 'postgres'

import { createPgTestContext } from '../../runners.js'
import { PostgresQueryRunner } from '../../../../../src/queryRunners/PostgresQueryRunner.js'

export const ctx = createPgTestContext({
    label: 'newest / postgres',
    compatibilityVersion: Number.POSITIVE_INFINITY,
    mockQueryRunner: 'PostgresQueryRunner',
    async createRealRunner(uri) {
        const sql = postgres(uri)
        return {
            runner: new PostgresQueryRunner(sql),
            shutdown: () => sql.end(),
        }
    },
})
