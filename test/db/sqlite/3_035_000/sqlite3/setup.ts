// sqlite in the "3_035_000" zone — compatibilityVersion = 3_035_000.
//
// Connector: `sqlite3`.

import { createSqlite3TestContext } from '../../runners.js'

export const ctx = createSqlite3TestContext({
    label: '3_035_000 / sqlite3',
    compatibilityVersion: 3_035_000,
})
