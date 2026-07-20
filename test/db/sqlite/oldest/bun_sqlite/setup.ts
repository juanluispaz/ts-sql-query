// sqlite in the "oldest" zone — compatibilityVersion = 3_029_000.
//
// Connector: `bun_sqlite`.

import { createBunSqliteTestContext } from '../../runners.js'

export const ctx = createBunSqliteTestContext({
    label: 'oldest / bun_sqlite',
    compatibilityVersion: 3_029_000,
})
