// The query runners of SQLite created inside a transaction the caller began with the driver.

import Database from 'better-sqlite3'
import { createRequire } from 'node:module'
import { BetterSqlite3QueryRunner } from '../../../src/queryRunners/BetterSqlite3QueryRunner.js'
import { NodeSqliteQueryRunner } from '../../../src/queryRunners/NodeSqliteQueryRunner.js'
import { Sqlite3WasmOO1QueryRunner } from '../../../src/queryRunners/Sqlite3WasmOO1QueryRunner.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { describeOverADriverTransaction, inManualTransaction } from '../lib/overADriverTransaction.js'

const isBun = typeof globalThis.Bun !== 'undefined'

function nodeSqliteAvailable(): boolean {
    try {
        createRequire(import.meta.url)('node:sqlite')
        return true
    } catch {
        return false
    }
}

function driverOver(connection: { exec(sql: string): unknown }, count: () => unknown, close: () => void) {
    const run = async (sql: string) => connection.exec(sql)
    return {
        begin: <T>(fn: (transaction: any) => Promise<T>) => inManualTransaction(connection, run, fn),
        run,
        count: async () => Number(count()),
        close: async () => close(),
    }
}

describeOverADriverTransaction({
    label: 'BetterSqlite3QueryRunner (forUseInTransaction)',
    realEnabled: isRealDbEnabled('sqlite', 'native', 'newest', 'better-sqlite3'),
    async open() {
        const db = new Database(':memory:')
        return driverOver(db, () => db.prepare('select count(*) from rt_given').pluck().get(), () => db.close())
    },
    createRunner: transaction => new BetterSqlite3QueryRunner(transaction, { forUseInTransaction: true }),
})

describeOverADriverTransaction({
    label: 'NodeSqliteQueryRunner (forUseInTransaction)',
    realEnabled: nodeSqliteAvailable() && isRealDbEnabled('sqlite', 'native', 'newest', 'node_sqlite'),
    async open() {
        const { DatabaseSync } = await import('node:sqlite')
        const db = new DatabaseSync(':memory:')
        return driverOver(db, () => db.prepare('select count(*) as n from rt_given').get()!['n'], () => db.close())
    },
    createRunner: transaction => new NodeSqliteQueryRunner(transaction, { forUseInTransaction: true }),
})

describeOverADriverTransaction({
    label: 'BunSqliteQueryRunner (forUseInTransaction)',
    realEnabled: isBun && isRealDbEnabled('sqlite', 'native', 'newest', 'bun_sqlite'),
    async open() {
        const { Database: BunDatabase } = await import('bun:sqlite')
        const db = new BunDatabase(':memory:')
        const driver = driverOver({ exec: sql => db.run(sql) }, () => (db.query('select count(*) as n from rt_given').get() as any).n, () => db.close())
        return { ...driver, begin: fn => inManualTransaction(db, driver.run, fn) }
    },
    async createRunner(transaction) {
        const { BunSqliteQueryRunner } = await import('../../../src/queryRunners/BunSqliteQueryRunner.js')
        return new BunSqliteQueryRunner(transaction, { forUseInTransaction: true })
    },
})

describeOverADriverTransaction({
    label: 'Sqlite3WasmOO1QueryRunner (forUseInTransaction)',
    realEnabled: isRealDbEnabled('sqlite', 'wasm', 'newest', 'sqlite-wasm-OO1'),
    async open() {
        const sqlite3InitModule = (await import('@sqlite.org/sqlite-wasm')).default
        const sqlite3 = await sqlite3InitModule()
        const db = new sqlite3.oo1.DB(':memory:', 'c')
        return driverOver(db, () => db.selectValue('select count(*) from rt_given'), () => db.close())
    },
    createRunner: transaction => new Sqlite3WasmOO1QueryRunner(transaction, { forUseInTransaction: true }),
})

describeOverADriverTransaction({
    label: 'BunSqlSqliteQueryRunner (transaction of Bun SQL)',
    realEnabled: isBun && isRealDbEnabled('sqlite', 'native', 'newest', 'bun_sql_sqlite'),
    async open() {
        const { SQL } = await import('bun')
        const sql = new SQL({ adapter: 'sqlite', filename: ':memory:' })
        return {
            begin: fn => sql.begin(fn) as Promise<any>,
            run: sql_ => sql.unsafe(sql_),
            count: async () => Number((await sql.unsafe('select count(*) as n from rt_given'))[0].n),
            close: async () => { await sql.close() },
        }
    },
    async createRunner(transaction) {
        const { BunSqlSqliteQueryRunner } = await import('../../../src/queryRunners/BunSqlSqliteQueryRunner.js')
        return new BunSqlSqliteQueryRunner(transaction)
    },
})
