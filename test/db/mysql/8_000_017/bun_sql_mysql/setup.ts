// mysql in the "8_000_017" zone via bun's built-in `bun:sql` (mysql
// adapter). Built-in module; loaded via dynamic import so
// the file can also be parsed under node — there the real branch is skipped.

import { createBunSqlMySqlTestContext } from '../../runners.js'

export const ctx = createBunSqlMySqlTestContext({
    label: '8_000_017 / bun_sql_mysql',
    compatibilityVersion: 8_000_017,
})
