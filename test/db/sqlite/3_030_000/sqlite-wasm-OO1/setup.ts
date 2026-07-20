// sqlite in the "3_030_000" zone — compatibilityVersion = 3_030_000.
//
// Connector: `sqlite-wasm-OO1`.

import { createSqliteWasmOO1TestContext } from '../../runners.js'

export const ctx = createSqliteWasmOO1TestContext({
    label: '3_030_000 / sqlite-wasm-OO1',
    compatibilityVersion: 3_030_000,
})
