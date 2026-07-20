// sqlite in the "oldest" zone — compatibilityVersion = 3_029_000.
//
// Connector: `sqlite3`.

import { createSqlite3TestContext } from '../../runners.js'

export const ctx = createSqlite3TestContext({
    label: 'oldest / sqlite3',
    compatibilityVersion: 3_029_000,
})
