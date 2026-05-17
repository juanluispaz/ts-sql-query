// sqlite in the "newest" zone — compatibilityVersion =
// Number.POSITIVE_INFINITY.
//
// Connector: `@sqlite.org/sqlite-wasm` (OO1 API) — wasm-based, universal
// under Node and Bun, no native binding required.

import { createSqliteWasmOO1TestContext } from '../../runners.js'

export const ctx = createSqliteWasmOO1TestContext({
    label: 'newest / sqlite-wasm-OO1',
    compatibilityVersion: Number.POSITIVE_INFINITY,
})
