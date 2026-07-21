// sqlite `oldest` / `better-sqlite3-sync` — the better-sqlite3 runner driven in
// SYNCHRONOUS mode: runner + mock resolve through SynchronousPromise, so every
// query is unwrapped with sync() instead of await. Same SQL/params/values as the
// async better-sqlite3 cell; only the execution style differs. See
// docs/advanced/synchronous-query-runners.md.

import { createBetterSqlite3SyncTestContext } from '../../runners.js'

export const ctx = createBetterSqlite3SyncTestContext({
    label: 'oldest / better-sqlite3-sync',
    compatibilityVersion: 3_029_000,
})
