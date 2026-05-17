// pilot-postgres in the "oldest" zone (compatibilityVersion below the
// lowest documented breakpoint — `< 18_000_000` per
// docs/configuration/supported-databases/postgresql.md). Any value below
// the breakpoint puts the connection into this zone; the pilot pins
// 17_000_000 as a representative example, and the emitted SQL uses the
// pre-pg18 legacy form of UPDATE … RETURNING old.col.
//
// Connector: `pg`.

import { Pool } from 'pg'

import { createPgTestContext } from '../../runners.js'
import { PgPoolQueryRunner } from '../../../../../src/queryRunners/PgPoolQueryRunner.js'

export const ctx = createPgTestContext({
    label: 'oldest / pg',
    compatibilityVersion: 17_000_000,
    async createRealRunner(uri) {
        const pool = new Pool({ connectionString: uri })
        return {
            runner: new PgPoolQueryRunner(pool),
            shutdown: () => pool.end(),
        }
    },
})
