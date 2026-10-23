// sqlite in the "3_030_000" zone via bun's built-in `bun:sql` (sqlite
// adapter). Built-in module; loaded via dynamic import so
// the file can also be parsed under node — there the real branch is skipped.

import { createBunSqlSqliteTestContext } from '../../runners.js'

export const ctx = createBunSqlSqliteTestContext({
    label: '3_030_000 / bun_sql_sqlite',
    compatibilityVersion: 3_030_000,
})
