// postgres in the "oldest" zone — compatibilityVersion = 17_000_000.
//
// Connector: `postgres` (porsager/postgres).

import postgres from 'postgres'

import { createPgTestContext, oidTypesByName } from '../../runners.js'
import { MockPostgresQueryRunner } from '../../../../lib/mockRunners/MockPostgresQueryRunner.js'
import { PostgresQueryRunner } from '../../../../../src/queryRunners/PostgresQueryRunner.js'

export const ctx = createPgTestContext({
    label: 'oldest / postgres',
    compatibilityVersion: 17_000_000,
    mockRunnerClass: MockPostgresQueryRunner,
    async createRealRunner(uri) {
        const sql = postgres(uri)
        return {
            runner: new PostgresQueryRunner(sql, { typesByName: oidTypesByName }),
            shutdown: () => sql.end(),
        }
    },
})
