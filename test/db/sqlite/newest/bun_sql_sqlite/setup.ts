// sqlite in the "newest" zone via bun's built-in `bun:sql` (sqlite
// adapter). Built-in module; loaded via dynamic import so
// the file can also be parsed under node — there the real branch is skipped.

import { createBunSqlSqliteTestContext } from '../../runners.js'

export const ctx = createBunSqlSqliteTestContext({
    label: 'newest / bun_sql_sqlite',
    compatibilityVersion: Number.POSITIVE_INFINITY,
})
