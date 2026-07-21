// mariadb in the "10_004_000" zone — compatibilityVersion = 10_004_000.
//
// Connector: `mariadb`.

import { createMariaDBPoolTestContext } from '../../runners.js'

export const ctx = createMariaDBPoolTestContext({
    label: '10_004_000 / mariadb',
    compatibilityVersion: 10_004_000,
})
