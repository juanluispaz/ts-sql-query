// localDate, localTime and localDateTime through every MySQL runner, with the process in UTC and in other zones:
// what is stored when a Date is sent, what is read from a stored value, and that a value read and sent back stays the
// same. The zone is set when a process starts, so each runner runs in a process of its own:
// see localTemporalValuesInAnyZone/probe.ts and ../lib/localTemporalValuesProbe.ts for the contract.

import { fileURLToPath } from 'node:url'
import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/mysql/runners.js'
import { describeLocalTemporalValuesInAnyZone } from '../lib/localTemporalValues.js'
import { mysqlTemporalDialect } from '../lib/localTemporalValuesProbe.js'
import { environmentVersions } from '../lib/versions.js'
import { closestImage } from '../../lib/dockerImages.js'

const isBun = typeof globalThis.Bun !== 'undefined'
// The cells of MySQL connect with mysql2: the other driver's runners run with the same selection. Each version of the
// engine mapped for --docker-version closest runs too, with the compatibilityVersion of its cells
for (const { version, compatibilityVersion, label } of await environmentVersions('mysql', 'mysql2')) {
    const enabled = isRealDbEnabled('mysql', 'docker', version, 'mysql2')
    // MySQL 8.0 doesn't find a TIME in a prepared statement with an in list of several values sent as text (Bun SQL
    // prepares every statement; mysql2 and mariadb don't): test/ENGINE_SUPPORT.md
    const bunSqlLimitOf = closestImage('mysql', version) === 'mysql:8.0'
        ? (_zone: string, caseName: string) => caseName.startsWith('send in | t TIME') ? 'MySQL 8.0 does not find a TIME in a prepared in list of several values' : undefined
        : undefined
    describeLocalTemporalValuesInAnyZone({
        database: 'MySQL' + label,
        compatibilityVersion,
        dialect: mysqlTemporalDialect,
        probe: fileURLToPath(new URL('./localTemporalValuesInAnyZone/probe.ts', import.meta.url)),
        async acquire() {
            const db = await acquireRunnerTestDatabase(undefined, version)
            return { info: { host: db.host, port: db.port, user: db.user, password: db.password, database: db.database }, release: () => db.release() }
        },
        runners: [
            { runner: 'MySql2QueryRunner', enabled, needsConnection: true },
            { runner: 'MySql2PoolQueryRunner', enabled, needsConnection: true },
            { runner: 'MariaDBQueryRunner', enabled, needsConnection: true },
            { runner: 'MariaDBPoolQueryRunner', enabled, needsConnection: true },
            { runner: 'BunSqlMySqlQueryRunner', enabled: isBun && isRealDbEnabled('mysql', 'docker', version, 'bun_sql_mysql'), needsConnection: true, limitOf: bunSqlLimitOf },
        ],
    })
}
