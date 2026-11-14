// localDate, localTime and localDateTime through every MariaDB runner, with the process in UTC and in other zones:
// what is stored when a Date is sent, what is read from a stored value, and that a value read and sent back stays the
// same. The zone is set when a process starts, so each runner runs in a process of its own:
// see localTemporalValuesInAnyZone/probe.ts and ../lib/localTemporalValuesProbe.ts for the contract.

import { fileURLToPath } from 'node:url'
import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/mariadb/runners.js'
import { describeLocalTemporalValuesInAnyZone } from '../lib/localTemporalValues.js'
import { mysqlTemporalDialect } from '../lib/localTemporalValuesProbe.js'
import { environmentVersions } from '../lib/versions.js'

const isBun = typeof globalThis.Bun !== 'undefined'
// The cells of MariaDB connect with mariadb: the other driver's runners run with the same selection. Each version of the
// engine mapped for --docker-version closest runs too, with the compatibilityVersion of its cells
for (const { version, compatibilityVersion, label } of await environmentVersions('mariadb', 'mariadb')) {
    const enabled = isRealDbEnabled('mariadb', 'docker', version, 'mariadb')
    // MariaDB before 10.5 has no json_arrayagg, which aggregateAsArray writes (test/ENGINE_SUPPORT.md)
    const limitOf = compatibilityVersion !== undefined && compatibilityVersion < 10_005_000
        ? (_zone: string, caseName: string) => caseName.startsWith('read aggregateAsArray |') ? 'MariaDB before 10.5 has no json_arrayagg' : undefined
        : undefined
    describeLocalTemporalValuesInAnyZone({
        database: 'MariaDB' + label,
        compatibilityVersion,
        dialect: mysqlTemporalDialect,
        probe: fileURLToPath(new URL('./localTemporalValuesInAnyZone/probe.ts', import.meta.url)),
        async acquire() {
            const db = await acquireRunnerTestDatabase(undefined, version)
            return { info: { host: db.host, port: db.port, user: db.user, password: db.password, database: db.database }, release: () => db.release() }
        },
        runners: [
            { runner: 'MySql2QueryRunner', enabled, needsConnection: true, limitOf },
            { runner: 'MySql2PoolQueryRunner', enabled, needsConnection: true, limitOf },
            { runner: 'MariaDBQueryRunner', enabled, needsConnection: true, limitOf },
            { runner: 'MariaDBPoolQueryRunner', enabled, needsConnection: true, limitOf },
            { runner: 'BunSqlMySqlQueryRunner', enabled: isBun && isRealDbEnabled('mariadb', 'docker', version, 'bun_sql_mysql'), needsConnection: true, limitOf },
        ],
    })
}
