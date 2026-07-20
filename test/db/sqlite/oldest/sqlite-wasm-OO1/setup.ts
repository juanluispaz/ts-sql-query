// sqlite in the "oldest" zone — compatibilityVersion = 3_029_000.
//
// Connector: `sqlite-wasm-OO1`.

import { createSqliteWasmOO1TestContext } from '../../runners.js'

export const ctx = createSqliteWasmOO1TestContext({
    label: 'oldest / sqlite-wasm-OO1',
    compatibilityVersion: 3_029_000,
})
