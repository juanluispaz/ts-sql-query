// sqlite in the "newest" zone — compatibilityVersion =
// Number.POSITIVE_INFINITY, the library default. Every documented
// breakpoint is enabled, so the emitted SQL is the most modern flavour
// ts-sql-query produces for sqlite.
//
// Connector: `bun:sqlite` (see docs/configuration/query-runners/recommended/bun_sqlite.md).

import { createBunSqliteTestContext } from '../../runners.js'

export const ctx = createBunSqliteTestContext({
    label: 'newest / bun_sqlite',
    canonicalForDocs: true,
    compatibilityVersion: Number.POSITIVE_INFINITY,
})
