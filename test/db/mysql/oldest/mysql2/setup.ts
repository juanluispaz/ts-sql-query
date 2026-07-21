// mysql in the "oldest" zone — compatibilityVersion = 5_007_000.
//
// Connector: `mysql2`.

import { createMySql2PoolTestContext } from '../../runners.js'

export const ctx = createMySql2PoolTestContext({
    label: 'oldest / mysql2',
    compatibilityVersion: 5_007_000,
})
