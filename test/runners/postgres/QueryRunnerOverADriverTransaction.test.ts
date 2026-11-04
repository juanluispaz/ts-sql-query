// The query runners of PostgreSQL created inside a transaction the caller began with the driver.

import pg from 'pg'
import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, test } from '../../lib/testRunner.js'
import { PgLiteQueryRunner } from '../../../src/queryRunners/PgLiteQueryRunner.js'
import { PgQueryRunner } from '../../../src/queryRunners/PgQueryRunner.js'
import { PostgresQueryRunner } from '../../../src/queryRunners/PostgresQueryRunner.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/postgres/runners.js'
import { describeOverADriverTransaction, inManualTransaction } from '../lib/overADriverTransaction.js'
import { reasonOf, rejectionOf } from '../lib/runnerContract.js'

const isBun = typeof globalThis.Bun !== 'undefined'

describeOverADriverTransaction({
    label: 'PostgresQueryRunner (transaction of postgres.js)',
    realEnabled: isRealDbEnabled('postgres', 'docker', 'newest', 'postgres'),
    async open() {
        const db = await acquireRunnerTestDatabase()
        const sql = postgres(db.uri, { max: 2, onnotice: () => {} })
        return {
            begin: fn => sql.begin(fn) as Promise<any>,
            run: sql_ => sql.unsafe(sql_),
            count: async () => Number((await sql.unsafe('select count(*) as n from rt_given'))[0]!['n']),
            close: async () => { await sql.end(); await db.release() },
        }
    },
    createRunner: transaction => new PostgresQueryRunner(transaction),
})

describeOverADriverTransaction({
    label: 'BunSqlPostgresQueryRunner (transaction of Bun SQL)',
    realEnabled: isBun && isRealDbEnabled('postgres', 'docker', 'newest', 'bun_sql_postgres'),
    async open() {
        const db = await acquireRunnerTestDatabase()
        const { SQL } = await import('bun')
        const sql = new SQL(db.uri, { max: 2 })
        return {
            begin: fn => sql.begin(fn) as Promise<any>,
            run: sql_ => sql.unsafe(sql_),
            count: async () => Number((await sql.unsafe('select count(*) as n from rt_given'))[0]['n']),
            close: async () => { await sql.close(); await db.release() },
        }
    },
    async createRunner(transaction) {
        const { BunSqlPostgresQueryRunner } = await import('../../../src/queryRunners/BunSqlPostgresQueryRunner.js')
        return new BunSqlPostgresQueryRunner(transaction)
    },
})

describeOverADriverTransaction({
    label: 'PgQueryRunner (forUseInTransaction)',
    realEnabled: isRealDbEnabled('postgres', 'docker', 'newest', 'pg'),
    async open() {
        const db = await acquireRunnerTestDatabase()
        const client = new pg.Client(db.uri)
        await client.connect()
        const run = (sql: string) => client.query(sql)
        return {
            begin: fn => inManualTransaction(client, run, fn),
            run,
            count: async () => Number((await client.query('select count(*) as n from rt_given')).rows[0].n),
            close: async () => { await client.end(); await db.release() },
        }
    },
    createRunner: transaction => new PgQueryRunner(transaction, { forUseInTransaction: true }),
})

const pgliteEnabled = isRealDbEnabled('postgres', 'wasm', 'newest', 'pglite')
async function openPgLite() {
    const { PGlite } = await import('@electric-sql/pglite')
    return PGlite.create('memory://')
}
const countInPgLite = async (db: import('@electric-sql/pglite').PGlite) => Number((await db.query<{ n: unknown }>('select count(*) as n from rt_given')).rows[0]!.n)

describeOverADriverTransaction({
    label: 'PgLiteQueryRunner (transaction of PGlite)',
    realEnabled: pgliteEnabled,
    async open() {
        const db = await openPgLite()
        return {
            begin: fn => db.transaction(fn) as Promise<any>,
            run: sql => db.query(sql),
            count: () => countInPgLite(db),
            close: () => db.close(),
        }
    },
    createRunner: transaction => new PgLiteQueryRunner(transaction),
})

describeOverADriverTransaction({
    label: 'PgLiteQueryRunner (forUseInTransaction)',
    realEnabled: pgliteEnabled,
    async open() {
        const db = await openPgLite()
        const run = (sql: string) => db.query(sql)
        return {
            begin: fn => inManualTransaction(db, run, fn),
            run,
            count: () => countInPgLite(db),
            close: () => db.close(),
        }
    },
    createRunner: transaction => new PgLiteQueryRunner(transaction, { forUseInTransaction: true }),
})

// The commit of a transaction a failed statement aborted is answered ROLLBACK: the rollback that follows it sends
// nothing, as there is no transaction left, so PostgreSQL has nothing to warn about (postgres.js writes its notices to
// the console unless onnotice is given)
describe.skipIf(!isRealDbEnabled('postgres', 'docker', 'newest', 'postgres'))('PostgresQueryRunner (commit answered ROLLBACK)', () => {
    let sql: postgres.Sql | undefined
    let release: (() => Promise<void>) | undefined
    const notices: unknown[] = []
    const runner = () => new PostgresQueryRunner(sql!)

    beforeAll(async () => {
        const db = await acquireRunnerTestDatabase()
        sql = postgres(db.uri, { max: 2, onnotice: notice => { notices.push(notice) } })
        release = () => db.release()
        await sql.unsafe('drop table if exists rt_rolled_back')
        await sql.unsafe('create table rt_rolled_back (id integer primary key)')
        await sql.unsafe('insert into rt_rolled_back (id) values (1)')
        notices.length = 0
    }, 180_000)

    afterAll(async () => {
        await sql?.end()
        await release?.()
    }, 180_000)

    test('rollback-after-the-commit-sends-nothing', async () => {
        const r = runner()
        await r.executeBeginTransaction()
        await r.executeInsert('insert into rt_rolled_back (id) values (1)').catch(() => undefined)
        expect(reasonOf(await rejectionOf(r.executeCommit()))).toBe('TRANSACTION_ERROR')
        await r.executeRollback()
        expect(r.isTransactionActive()).toBe(false)
        expect(notices).toEqual([])
    })

    test('transaction-function-with-a-failed-statement-sends-nothing-more', async () => {
        const r = runner()
        // postgres.js rolls the transaction back and rejects with the error of the statement that failed
        const error = await rejectionOf(r.executeInTransaction(async () => {
            await r.executeInsert('insert into rt_rolled_back (id) values (1)').catch(() => undefined)
        }, r))
        expect(r.getErrorReason(error).reason).toBe('SQL_CONSTRAINT_VIOLATED')
        expect(r.isTransactionActive()).toBe(false)
        expect(notices).toEqual([])
        // The connection went back to the pool: the query runner works on
        expect(Number(await r.executeSelectOneColumnOneRow('select count(*) from rt_rolled_back'))).toBe(1)
    })
})
