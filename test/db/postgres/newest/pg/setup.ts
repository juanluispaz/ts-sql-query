// postgres in the "newest" zone — compatibilityVersion =
// Number.POSITIVE_INFINITY, the library default. Every documented
// breakpoint is enabled, so the emitted SQL is the most modern flavour
// ts-sql-query produces for postgres.
//
// Connector: `pg` (see docs/configuration/query-runners/recommended/pg.md).

import { Pool } from 'pg'

import { createPgTestContext } from '../../runners.js'
import { PgPoolQueryRunner } from '../../../../../src/queryRunners/PgPoolQueryRunner.js'

export const ctx = createPgTestContext({
    label: 'newest / pg',
    canonicalForDocs: true,
    compatibilityVersion: Number.POSITIVE_INFINITY,
    async createRealRunner(uri) {
        const pool = new Pool({ connectionString: uri })
        return {
            runner: new PgPoolQueryRunner(pool),
            shutdown: () => pool.end(),
        }
    },
    // PgPoolQueryRunner supports allowNestedTransactions, so the
    // nesting-works test runs against the real engine here.
    createNestedTxRunner(uri) {
        const pool = new Pool({ connectionString: uri })
        return {
            runner: new PgPoolQueryRunner(pool, { allowNestedTransactions: true }),
            shutdown: () => pool.end(),
        }
    },
})
