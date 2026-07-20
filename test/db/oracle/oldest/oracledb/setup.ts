// oracle in the "oldest" zone — compatibilityVersion = 21_000_000.
//
// Connector: `oracledb`.

import { createOracleDBPoolTestContext } from '../../runners.js'

export const ctx = createOracleDBPoolTestContext({
    label: 'oldest / oracledb',
    compatibilityVersion: 21_000_000,
})
