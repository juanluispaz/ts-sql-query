// sqlite in the "3_035_000" zone — compatibilityVersion = 3_035_000.
//
// Connector: `bun_sqlite`.

import { createBunSqliteTestContext } from '../../runners.js'

export const ctx = createBunSqliteTestContext({
    label: '3_035_000 / bun_sqlite',
    compatibilityVersion: 3_035_000,
})
