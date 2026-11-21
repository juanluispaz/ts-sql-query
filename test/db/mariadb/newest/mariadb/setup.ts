// mariadb in the "newest" zone — compatibilityVersion =
// Number.POSITIVE_INFINITY, the library default. Every documented
// breakpoint is enabled, so the emitted SQL is the most modern flavour
// ts-sql-query produces for mariadb.
//
// Connector: `mariadb` (see docs/databases/mariadb/query-runners/mariadb.md).

import { createMariaDBPoolTestContext } from '../../runners.js'

export const ctx = createMariaDBPoolTestContext({
    label: 'newest / mariadb',
    canonicalForDocs: true,
    compatibilityVersion: Number.POSITIVE_INFINITY,
})
