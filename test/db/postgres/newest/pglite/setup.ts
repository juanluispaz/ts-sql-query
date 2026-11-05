// postgres in the "newest" zone, in-process PgLite engine.
//
// PGlite bundles its own PostgreSQL, version 18, the same major as the
// `newest` docker image. It shares `compatibilityVersion =
// Number.POSITIVE_INFINITY` with the rest of `newest/`, so the SQL it sees is
// the most modern flavour the library emits.

import { createPgLiteTestContext } from '../../runners.js'

export const ctx = createPgLiteTestContext({
    label: 'newest / pglite',
    compatibilityVersion: Number.POSITIVE_INFINITY,
})
