// postgres in the "newest" zone, in-process PgLite engine.
//
// NOTE: PgLite bundles its own PostgreSQL version (17 at time of writing).
// Hosting it under `newest/` is a deliberate convention choice: it shares
// a `compatibilityVersion = Number.POSITIVE_INFINITY` with the rest of
// `newest/`, so the SQL it sees is the most modern flavour the library
// emits. The version mismatch with `postgres:18-alpine` only shows up if
// a test exercises an 18-only feature — comment such tests in this cell
// only.

import { createPgLiteTestContext } from '../../runners.js'

export const ctx = createPgLiteTestContext({
    label: 'newest / pglite',
    compatibilityVersion: Number.POSITIVE_INFINITY,
})
