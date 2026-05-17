// sqlserver in the "newest" zone — compatibilityVersion =
// Number.POSITIVE_INFINITY, the library default.
//
// Connector: `mssql` (see docs/configuration/query-runners/recommended/mssql.md).

import { createMssqlPoolTestContext } from '../../runners.js'

export const ctx = createMssqlPoolTestContext({
    label: 'newest / mssql',
    canonicalForDocs: true,
    compatibilityVersion: Number.POSITIVE_INFINITY,
})
