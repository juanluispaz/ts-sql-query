// mysql in the "newest" zone — compatibilityVersion =
// Number.POSITIVE_INFINITY, the library default.
//
// Connector: `mysql2` (see docs/configuration/query-runners/recommended/mysql2.md).

import { createMySql2PoolTestContext } from '../../runners.js'

export const ctx = createMySql2PoolTestContext({
    label: 'newest / mysql2',
    canonicalForDocs: true,
    compatibilityVersion: Number.POSITIVE_INFINITY,
})
