// mysql in the "oldest" zone via bun's built-in `bun:sql` (mysql
// adapter). Built-in module; loaded via dynamic import so
// the file can also be parsed under node — there the real branch is skipped.

import { createBunSqlMySqlTestContext } from '../../runners.js'

export const ctx = createBunSqlMySqlTestContext({
    label: 'oldest / bun_sql_mysql',
    compatibilityVersion: 5_007_000,
})
