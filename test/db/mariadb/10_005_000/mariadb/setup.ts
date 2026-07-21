// mariadb in the "10_005_000" zone — compatibilityVersion = 10_005_000.
//
// Connector: `mariadb`.

import { createMariaDBPoolTestContext } from '../../runners.js'

export const ctx = createMariaDBPoolTestContext({
    label: '10_005_000 / mariadb',
    compatibilityVersion: 10_005_000,
})
