// sqlite in the "3_038_000" zone — compatibilityVersion = 3_038_000.
//
// Connector: `sqlite-wasm-OO1`.

import { createSqliteWasmOO1TestContext } from '../../runners.js'

export const ctx = createSqliteWasmOO1TestContext({
    label: '3_038_000 / sqlite-wasm-OO1',
    compatibilityVersion: 3_038_000,
})
