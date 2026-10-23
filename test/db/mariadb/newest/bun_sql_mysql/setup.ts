// mariadb in the "newest" zone via bun's built-in `bun:sql` (mysql
// adapter). Built-in module; loaded via dynamic import so
// the file can also be parsed under node — there the real branch is skipped.

import { createBunSqlMariaDBTestContext } from '../../runners.js'

export const ctx = createBunSqlMariaDBTestContext({
    label: 'newest / bun_sql_mysql',
    compatibilityVersion: Number.POSITIVE_INFINITY,
})
