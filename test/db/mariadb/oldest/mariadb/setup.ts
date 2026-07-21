// mariadb in the "oldest" zone — compatibilityVersion = 10_003_000.
//
// Connector: `mariadb`.

import { createMariaDBPoolTestContext } from '../../runners.js'

export const ctx = createMariaDBPoolTestContext({
    label: 'oldest / mariadb',
    compatibilityVersion: 10_003_000,
})
