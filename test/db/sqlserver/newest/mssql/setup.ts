// sqlserver in the "newest" zone — compatibilityVersion =
// Number.POSITIVE_INFINITY, the library default.
//
// Connector: `mssql` (see docs/databases/sqlserver/query-runners/mssql.md).

import { createMssqlPoolTestContext } from '../../runners.js'

export const ctx = createMssqlPoolTestContext({
    label: 'newest / mssql',
    canonicalForDocs: true,
    compatibilityVersion: Number.POSITIVE_INFINITY,
})
