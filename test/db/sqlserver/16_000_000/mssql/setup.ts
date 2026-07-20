// sqlserver in the "16_000_000" zone — compatibilityVersion = 16_000_000
// (SQL Server 2022, internal version 16.0). minValue(...) / maxValue(...) emit
// the native LEAST(a, b) / GREATEST(a, b) added in 2022. The 2025 (17.0)
// features are NOT emitted: aggregateAsArray uses the string_agg/string_escape
// emulation (not JSON_ARRAYAGG), substringToEnd passes an explicit length, and
// currentDate emits cast(getdate() as date) rather than CURRENT_DATE.
//
// Connector: `mssql` (see docs/configuration/query-runners/recommended/mssql.md).

import { createMssqlPoolTestContext } from '../../runners.js'

export const ctx = createMssqlPoolTestContext({
    label: '16_000_000 / mssql',
    compatibilityVersion: 16_000_000,
})
