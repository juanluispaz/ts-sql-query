// sqlite in the "newest" zone — compatibilityVersion =
// Number.POSITIVE_INFINITY, the library default.
//
// Connector: `better-sqlite3`.

import { createBetterSqlite3TestContext } from '../../runners.js'

export const ctx = createBetterSqlite3TestContext({
    label: 'newest / better-sqlite3',
    compatibilityVersion: Number.POSITIVE_INFINITY,
})
