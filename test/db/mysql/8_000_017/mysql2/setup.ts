// mysql in the "8_000_017" zone — compatibilityVersion = 8_000_017
// (MySQL 8.0.17+). `DOUBLE` is used as a cast target when a value must become a
// floating point number (.asDouble(), both operands of .divide(...)). The row
// alias syntax in ON DUPLICATE KEY UPDATE was added in 8.0.19, so below that
// breakpoint the legacy VALUES(col) reference is emitted instead.
//
// Connector: `mysql2` (see docs/configuration/query-runners/recommended/mysql2.md).

import { createMySql2PoolTestContext } from '../../runners.js'

export const ctx = createMySql2PoolTestContext({
    label: '8_000_017 / mysql2',
    compatibilityVersion: 8_000_017,
})
