// sqlite in the "oldest" zone — compatibilityVersion = 3_029_000.
//
// Connector: `node_sqlite`.

import { createNodeSqliteTestContext } from '../../runners.js'

export const ctx = createNodeSqliteTestContext({
    label: 'oldest / node_sqlite',
    compatibilityVersion: 3_029_000,
})
