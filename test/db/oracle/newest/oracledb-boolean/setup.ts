// oracle in the "newest" zone — compatibilityVersion =
// Number.POSITIVE_INFINITY, the library default.
//
// Connector: `oracledb-boolean` — the oracledb runner with the booleans stored
// as Oracle 23ai's BOOLEAN (`booleanStorage = 'boolean'` on the connection,
// see docs/configuration/supported-databases/oracle.md). The schema is the
// shared domain with its plain boolean columns declared BOOLEAN. Only the
// newest tier has this cell: the older Oracle versions have no BOOLEAN.

import { createOracleDBPoolTestContext } from '../../runners.js'

export const ctx = createOracleDBPoolTestContext({
    label: 'newest / oracledb-boolean',
    compatibilityVersion: Number.POSITIVE_INFINITY,
    booleanStorage: 'boolean',
})
