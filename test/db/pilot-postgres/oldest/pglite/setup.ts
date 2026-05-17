// pilot-postgres in the "oldest" zone via the `pglite` connector — see
// docs/configuration/query-runners/recommended/pglite.md. PgLite bundles
// PostgreSQL 17, so it only appears under the `oldest/` folder; the
// `newest/` zone emits SQL targeted at newer breakpoints (18_000_000+)
// that the in-process pg17 engine cannot execute.

import { createPgLiteTestContext } from '../../runners.js'

export const ctx = createPgLiteTestContext({
    label: 'oldest / pglite',
    compatibilityVersion: 17_000_000,
})
