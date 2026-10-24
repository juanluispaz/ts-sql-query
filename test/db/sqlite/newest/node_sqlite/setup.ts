// sqlite in the "newest" zone — compatibilityVersion =
// Number.POSITIVE_INFINITY.
//
// Connector: `node:sqlite` (built-in, Node >= 22.5 or Bun >= 1.4). On
// older Node versions the factory falls back to mock-only mode.

import { createNodeSqliteTestContext } from '../../runners.js'

export const ctx = createNodeSqliteTestContext({
    label: 'newest / node_sqlite',
    compatibilityVersion: Number.POSITIVE_INFINITY,
})
