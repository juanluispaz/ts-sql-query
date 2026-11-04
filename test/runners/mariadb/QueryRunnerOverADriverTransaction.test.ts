// The query runners of MariaDB created inside a transaction the caller began with the driver.

import mariadb from 'mariadb'
import { MariaDBQueryRunner } from '../../../src/queryRunners/MariaDBQueryRunner.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/mariadb/runners.js'
import { describeOverADriverTransaction, inManualTransaction } from '../lib/overADriverTransaction.js'

const isBun = typeof globalThis.Bun !== 'undefined'

describeOverADriverTransaction({
    label: 'MariaDBQueryRunner (forUseInTransaction)',
    realEnabled: isRealDbEnabled('mariadb', 'docker', 'newest', 'mariadb'),
    async open() {
        const db = await acquireRunnerTestDatabase()
        const connection = await mariadb.createConnection({ host: db.host, port: db.port, user: db.user, password: db.password, database: db.database })
        const run = (sql: string) => connection.query(sql)
        return {
            begin: fn => inManualTransaction(connection, run, fn),
            run,
            count: async () => Number((await run('select count(*) as n from rt_given'))[0].n),
            close: async () => { await connection.end(); await db.release() },
        }
    },
    createRunner: transaction => new MariaDBQueryRunner(transaction, { forUseInTransaction: true }),
    createRunnerWhoseBeginCommits: transaction => new MariaDBQueryRunner(transaction),
})

describeOverADriverTransaction({
    label: 'BunSqlMySqlQueryRunner (transaction of Bun SQL, MariaDB)',
    realEnabled: isBun && isRealDbEnabled('mariadb', 'docker', 'newest', 'bun_sql_mysql'),
    async open() {
        const db = await acquireRunnerTestDatabase()
        const { SQL } = await import('bun')
        const sql = new SQL({ adapter: 'mysql', hostname: db.host, port: db.port, username: db.user, password: db.password, database: db.database, foundRows: true, max: 2 })
        return {
            begin: fn => sql.begin(fn) as Promise<any>,
            run: sql_ => sql.unsafe(sql_),
            count: async () => Number((await sql.unsafe('select count(*) as n from rt_given'))[0].n),
            close: async () => { await sql.close(); await db.release() },
        }
    },
    async createRunner(transaction) {
        const { BunSqlMySqlQueryRunner } = await import('../../../src/queryRunners/BunSqlMySqlQueryRunner.js')
        return new BunSqlMySqlQueryRunner(transaction, 'mariaDB')
    },
})
