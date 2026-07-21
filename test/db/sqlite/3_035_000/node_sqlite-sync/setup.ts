// sqlite `3_035_000` / `node_sqlite-sync` — the node_sqlite runner driven in
// SYNCHRONOUS mode: runner + mock resolve through SynchronousPromise, so every
// query is unwrapped with sync() instead of await. Same SQL/params/values as the
// async node_sqlite cell; only the execution style differs. See
// docs/advanced/synchronous-query-runners.md.

import { createNodeSqliteSyncTestContext } from '../../runners.js'

export const ctx = createNodeSqliteSyncTestContext({
    label: '3_035_000 / node_sqlite-sync',
    compatibilityVersion: 3_035_000,
})
