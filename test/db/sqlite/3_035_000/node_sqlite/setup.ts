// sqlite in the "3_035_000" zone — compatibilityVersion = 3_035_000.
//
// Connector: `node_sqlite`.

import { createNodeSqliteTestContext } from '../../runners.js'

export const ctx = createNodeSqliteTestContext({
    label: '3_035_000 / node_sqlite',
    compatibilityVersion: 3_035_000,
})
