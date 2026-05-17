// oracle in the "newest" zone — compatibilityVersion =
// Number.POSITIVE_INFINITY, the library default.
//
// Connector: `oracledb` (see docs/configuration/query-runners/recommended/oracledb.md).

import { createOracleDBPoolTestContext } from '../../runners.js'

export const ctx = createOracleDBPoolTestContext({
    label: 'newest / oracledb',
    canonicalForDocs: true,
    compatibilityVersion: Number.POSITIVE_INFINITY,
})
