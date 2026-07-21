// sqlite `3_038_000` / `bun_sqlite-sync` — the bun_sqlite runner driven in
// SYNCHRONOUS mode: runner + mock resolve through SynchronousPromise, so every
// query is unwrapped with sync() instead of await. Same SQL/params/values as the
// async bun_sqlite cell; only the execution style differs. See
// docs/advanced/synchronous-query-runners.md.

import { createBunSqliteSyncTestContext } from '../../runners.js'

export const ctx = createBunSqliteSyncTestContext({
    label: '3_038_000 / bun_sqlite-sync',
    compatibilityVersion: 3_038_000,
})
