// sqlite in the "newest" zone — compatibilityVersion =
// Number.POSITIVE_INFINITY.
//
// Connector: `sqlite3` (npm) — asynchronous, universal under Node and Bun.

import { createSqlite3TestContext } from '../../runners.js'

export const ctx = createSqlite3TestContext({
    label: 'newest / sqlite3',
    compatibilityVersion: Number.POSITIVE_INFINITY,
})
