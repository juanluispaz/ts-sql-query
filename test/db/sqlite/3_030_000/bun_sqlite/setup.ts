// sqlite in the "3_030_000" zone — compatibilityVersion = 3_030_000.
//
// Connector: `bun_sqlite`.

import { createBunSqliteTestContext } from '../../runners.js'

export const ctx = createBunSqliteTestContext({
    label: '3_030_000 / bun_sqlite',
    compatibilityVersion: 3_030_000,
})
