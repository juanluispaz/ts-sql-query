// sqlite in the "3_030_000" zone — compatibilityVersion = 3_030_000.
//
// Connector: `sqlite3`.

import { createSqlite3TestContext } from '../../runners.js'

export const ctx = createSqlite3TestContext({
    label: '3_030_000 / sqlite3',
    compatibilityVersion: 3_030_000,
})
