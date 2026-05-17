// sqlite in the "newest" zone — compatibilityVersion =
// Number.POSITIVE_INFINITY, the library default.
//
// Connector: `better-sqlite3` (npm) — native module, Node-only. Under Bun
// the runner module falls back to mock-only mode (the native binding
// fails to load under Bun's Node API shim).

import { createBetterSqlite3TestContext } from '../../runners.js'

export const ctx = createBetterSqlite3TestContext({
    label: 'newest / better-sqlite3',
    compatibilityVersion: Number.POSITIVE_INFINITY,
})
