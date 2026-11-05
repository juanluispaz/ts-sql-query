// postgres in the "oldest" zone — compatibilityVersion = 17_000_000.
// PGlite bundles one PostgreSQL version (18), so this cell runs the library's
// compatibility mode for the `< 18_000_000` zone against that engine, not
// against a PostgreSQL 17.

import { createPgLiteTestContext } from '../../runners.js'

export const ctx = createPgLiteTestContext({
    label: 'oldest / pglite',
    compatibilityVersion: 17_000_000,
})
