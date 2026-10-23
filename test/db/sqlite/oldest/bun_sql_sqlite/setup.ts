// sqlite in the "oldest" zone via bun's built-in `bun:sql` (sqlite
// adapter). Built-in module; loaded via dynamic import so
// the file can also be parsed under node — there the real branch is skipped.

import { createBunSqlSqliteTestContext } from '../../runners.js'

export const ctx = createBunSqlSqliteTestContext({
    label: 'oldest / bun_sql_sqlite',
    compatibilityVersion: 3_029_000,
})
