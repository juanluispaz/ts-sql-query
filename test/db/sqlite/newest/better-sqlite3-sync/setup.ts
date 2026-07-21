// sqlite in the "newest" zone — compatibilityVersion =
// Number.POSITIVE_INFINITY, the library default.
//
// Connector: `better-sqlite3-sync` — the better-sqlite3 runner driven in
// SYNCHRONOUS mode. The runner and the mock both resolve through
// `SynchronousPromise`, so every query is unwrapped with the `sync()` helper
// instead of `await`. Same SQL, params and values as the async
// `better-sqlite3` cell; only the execution style differs. See
// docs/advanced/synchronous-query-runners.md.

import { createBetterSqlite3SyncTestContext } from '../../runners.js'

export const ctx = createBetterSqlite3SyncTestContext({
    label: 'newest / better-sqlite3-sync',
    compatibilityVersion: Number.POSITIVE_INFINITY,
})
