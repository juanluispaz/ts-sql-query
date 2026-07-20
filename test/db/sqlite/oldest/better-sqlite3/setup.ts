// sqlite in the "oldest" zone — compatibilityVersion = 3_029_000.
//
// Connector: `better-sqlite3`.

import { createBetterSqlite3TestContext } from '../../runners.js'

export const ctx = createBetterSqlite3TestContext({
    label: 'oldest / better-sqlite3',
    compatibilityVersion: 3_029_000,
})
