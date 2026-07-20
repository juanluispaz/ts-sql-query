// mysql in the "8_000_000" zone — compatibilityVersion = 8_000_000 (MySQL 8.0+).
// The WITH clause and recursive queries are supported. `DOUBLE` is NOT yet used
// as a cast target (that arrived in 8.0.17): a value that must become a floating
// point number is multiplied by the approximate literal 1.0e0 instead. The row
// alias syntax in ON DUPLICATE KEY UPDATE (8.0.19+) is also not emitted — legacy
// VALUES(col) is used.
//
// Connector: `mysql2` (see docs/configuration/query-runners/recommended/mysql2.md).

import { createMySql2PoolTestContext } from '../../runners.js'

export const ctx = createMySql2PoolTestContext({
    label: '8_000_000 / mysql2',
    compatibilityVersion: 8_000_000,
})
