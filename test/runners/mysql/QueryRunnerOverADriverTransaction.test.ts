// The query runners of MySQL created inside a transaction the caller began with the driver.

import mysql2 from 'mysql2'
import { MySql2QueryRunner } from '../../../src/queryRunners/MySql2QueryRunner.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/mysql/runners.js'
import { describeOverADriverTransaction, inManualTransaction } from '../lib/overADriverTransaction.js'

const isBun = typeof globalThis.Bun !== 'undefined'

describeOverADriverTransaction({
    label: 'MySql2QueryRunner (forUseInTransaction)',
    realEnabled: isRealDbEnabled('mysql', 'docker', 'newest', 'mysql2'),
    async open() {
        const db = await acquireRunnerTestDatabase()
        const connection = mysql2.createConnection({ host: db.host, port: db.port, user: db.user, password: db.password, database: db.database })
        const run = (sql: string) => new Promise<any>((resolve, reject) => connection.query(sql, (error: unknown, result: unknown) => error ? reject(error) : resolve(result)))
        return {
            begin: fn => inManualTransaction(connection, run, fn),
            run,
            count: async () => Number((await run('select count(*) as n from rt_given'))[0].n),
            close: async () => { await new Promise<void>(resolve => connection.end(() => resolve())); await db.release() },
        }
    },
    createRunner: transaction => new MySql2QueryRunner(transaction, { forUseInTransaction: true }),
    createRunnerWhoseBeginCommits: transaction => new MySql2QueryRunner(transaction),
})

describeOverADriverTransaction({
    label: 'BunSqlMySqlQueryRunner (transaction of Bun SQL, MySQL)',
    realEnabled: isBun && isRealDbEnabled('mysql', 'docker', 'newest', 'bun_sql_mysql'),
    async open() {
        const db = await acquireRunnerTestDatabase()
        const { SQL } = await import('bun')
        const sql = new SQL({ adapter: 'mysql', hostname: db.host, port: db.port, username: db.user, password: db.password, database: db.database, foundRows: true, allowPublicKeyRetrieval: true, max: 2 })
        return {
            begin: fn => sql.begin(fn) as Promise<any>,
            run: sql_ => sql.unsafe(sql_),
            count: async () => Number((await sql.unsafe('select count(*) as n from rt_given'))[0].n),
            close: async () => { await sql.close(); await db.release() },
        }
    },
    async createRunner(transaction) {
        const { BunSqlMySqlQueryRunner } = await import('../../../src/queryRunners/BunSqlMySqlQueryRunner.js')
        return new BunSqlMySqlQueryRunner(transaction)
    },
})
