// sqlite in the "3_030_000" zone — compatibilityVersion = 3_030_000.
//
// Connector: `better-sqlite3`.

import { createBetterSqlite3TestContext } from '../../runners.js'

export const ctx = createBetterSqlite3TestContext({
    label: '3_030_000 / better-sqlite3',
    compatibilityVersion: 3_030_000,
})
