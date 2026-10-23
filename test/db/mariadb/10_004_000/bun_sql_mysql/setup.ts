// mariadb in the "10_004_000" zone via bun's built-in `bun:sql` (mysql
// adapter). Built-in module; loaded via dynamic import so
// the file can also be parsed under node — there the real branch is skipped.

import { createBunSqlMariaDBTestContext } from '../../runners.js'

export const ctx = createBunSqlMariaDBTestContext({
    label: '10_004_000 / bun_sql_mysql',
    compatibilityVersion: 10_004_000,
})
