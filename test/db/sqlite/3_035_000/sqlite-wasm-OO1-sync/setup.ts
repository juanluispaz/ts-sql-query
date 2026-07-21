// sqlite `3_035_000` / `sqlite-wasm-OO1-sync` — the sqlite-wasm-OO1 runner driven in
// SYNCHRONOUS mode: runner + mock resolve through SynchronousPromise, so every
// query is unwrapped with sync() instead of await. Same SQL/params/values as the
// async sqlite-wasm-OO1 cell; only the execution style differs. See
// docs/advanced/synchronous-query-runners.md.

import { createSqliteWasmOO1SyncTestContext } from '../../runners.js'

export const ctx = createSqliteWasmOO1SyncTestContext({
    label: '3_035_000 / sqlite-wasm-OO1-sync',
    compatibilityVersion: 3_035_000,
})
