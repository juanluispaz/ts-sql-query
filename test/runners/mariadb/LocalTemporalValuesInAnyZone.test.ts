// localDate, localTime and localDateTime through every MariaDB runner, with the process in UTC and in other zones:
// what is stored when a Date is sent, what is read from a stored value, and that a value read and sent back stays the
// same. The zone is set when a process starts, so each runner runs in a process of its own:
// see localTemporalValuesInAnyZone/probe.ts and ../lib/localTemporalValuesProbe.ts for the contract.

import { fileURLToPath } from 'node:url'
import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/mariadb/runners.js'
import { describeLocalTemporalValuesInAnyZone } from '../lib/localTemporalValues.js'
import { mysqlTemporalDialect } from '../lib/localTemporalValuesProbe.js'

const isBun = typeof globalThis.Bun !== 'undefined'
// The cells of MariaDB connect with mariadb: the other driver's runners run with the same selection
const enabled = isRealDbEnabled('mariadb', 'docker', 'newest', 'mariadb')

describeLocalTemporalValuesInAnyZone({
    database: 'MariaDB',
    dialect: mysqlTemporalDialect,
    probe: fileURLToPath(new URL('./localTemporalValuesInAnyZone/probe.ts', import.meta.url)),
    async acquire() {
        const db = await acquireRunnerTestDatabase()
        return { info: { host: db.host, port: db.port, user: db.user, password: db.password, database: db.database }, release: () => db.release() }
    },
    runners: [
        { runner: 'MySql2QueryRunner', enabled, needsConnection: true },
        { runner: 'MySql2PoolQueryRunner', enabled, needsConnection: true },
        { runner: 'MariaDBQueryRunner', enabled, needsConnection: true },
        { runner: 'MariaDBPoolQueryRunner', enabled, needsConnection: true },
        { runner: 'BunSqlMySqlQueryRunner', enabled: isBun && isRealDbEnabled('mariadb', 'docker', 'newest', 'bun_sql_mysql'), needsConnection: true },
    ],
})
