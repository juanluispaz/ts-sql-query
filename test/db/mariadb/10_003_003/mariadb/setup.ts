// mariadb in the "10_003_003" zone — compatibilityVersion = 10_003_003.
//
// Connector: `mariadb`.

import { createMariaDBPoolTestContext } from '../../runners.js'

export const ctx = createMariaDBPoolTestContext({
    label: '10_003_003 / mariadb',
    compatibilityVersion: 10_003_003,
})
