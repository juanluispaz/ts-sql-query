// postgres in the "oldest" zone — compatibilityVersion = 17_000_000.
// PgLite bundles PostgreSQL 17, so it sits naturally in the `< 18_000_000`
// zone.

import { createPgLiteTestContext } from '../../runners.js'

export const ctx = createPgLiteTestContext({
    label: 'oldest / pglite',
    compatibilityVersion: 17_000_000,
})
