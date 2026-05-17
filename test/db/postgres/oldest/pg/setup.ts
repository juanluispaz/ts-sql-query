// postgres in the "oldest" zone — compatibilityVersion = 17_000_000,
// representative of the `< 18_000_000` zone documented in
// docs/configuration/supported-databases/postgresql.md. The emitted SQL
// uses the pre-18 RETURNING / UPDATE shape (no native OLD/NEW aliases).

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
