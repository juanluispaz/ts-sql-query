// sqlite in the "3_038_000" zone — compatibilityVersion = 3_038_000.
//
// Connector: `bun_sqlite`.

import { createBunSqliteTestContext } from '../../runners.js'

export const ctx = createBunSqliteTestContext({
    label: '3_038_000 / bun_sqlite',
    compatibilityVersion: 3_038_000,
})
