// sqlserver in the "oldest" zone — compatibilityVersion = 15_000_000.
//
// Connector: `mssql`.

import { createMssqlPoolTestContext } from '../../runners.js'

export const ctx = createMssqlPoolTestContext({
    label: 'oldest / mssql',
    compatibilityVersion: 15_000_000,
})
