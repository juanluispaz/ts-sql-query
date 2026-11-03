// PostgresQueryRunner and BunSqlPostgresQueryRunner created inside a transaction the caller began with the driver
// (sql.begin(tx => ...)): the statements run in that transaction, execute gives it, and the query runner doesn't begin
// another one inside it.

import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, test } from '../../lib/testRunner.js'
import type { QueryRunner } from '../../../src/queryRunners/QueryRunner.js'
import { PostgresQueryRunner } from '../../../src/queryRunners/PostgresQueryRunner.js'
import { isRealDbEnabled } from '../../lib/backends.js'
import { acquireRunnerTestDatabase } from '../../db/postgres/runners.js'
import { reasonOf, rejectionOf } from '../lib/runnerContract.js'

const isBun = typeof globalThis.Bun !== 'undefined'

interface Driver {
    begin<T>(fn: (transaction: any) => Promise<T>): Promise<T>
    count(): Promise<number>
    close(): Promise<void>
}

function describeOverADriverTransaction(label: string, realEnabled: boolean, open: (uri: string) => Promise<Driver>, createRunner: (transaction: any) => Promise<QueryRunner>) {
    describe.skipIf(!realEnabled)(label, () => {
        let driver: Driver | undefined
        let release: (() => Promise<void>) | undefined
        const d = (): Driver => {
            if (!driver) throw new Error(label + ': driver read before beforeAll')
            return driver
        }

        beforeAll(async () => {
            const db = await acquireRunnerTestDatabase()
            driver = await open(db.uri)
            release = () => db.release()
            await d().begin(async transaction => {
                await transaction.unsafe('drop table if exists rt_given')
                await transaction.unsafe('create table rt_given (id integer primary key)')
            })
        }, 180_000)

        afterAll(async () => {
            await driver?.close()
            await release?.()
        }, 180_000)

        test('statements-run-in-the-transaction-of-the-driver', async () => {
            const undo = new Error('undo')
            const error = await rejectionOf(d().begin(async transaction => {
                const runner = await createRunner(transaction)
                await runner.executeInsert('insert into rt_given (id) values (1)')
                expect(Number(await runner.executeSelectOneColumnOneRow('select count(*) from rt_given'))).toBe(1)
                expect(runner.isTransactionActive()).toBe(false)
                let given: unknown
                await runner.execute(async connection => { given = connection })
                expect(given).toBe(transaction)
                throw undo
            }))
            expect(error).toBe(undo)
            expect(await d().count()).toBe(0)
        })

        test('no-transaction-begins-inside-the-transaction-of-the-driver', async () => {
            await d().begin(async transaction => {
                const runner = await createRunner(transaction)
                expect(reasonOf(await rejectionOf(runner.executeBeginTransaction()))).toBe('NESTED_TRANSACTION_NOT_SUPPORTED')
                expect(reasonOf(await rejectionOf(runner.executeInTransaction(async () => undefined, runner)))).toBe('NESTED_TRANSACTION_NOT_SUPPORTED')
                expect(runner.isTransactionActive()).toBe(false)
            })
        })
    })
}

describeOverADriverTransaction('PostgresQueryRunner (transaction of postgres.js)', isRealDbEnabled('postgres', 'docker', 'newest', 'postgres'), async uri => {
    const sql = postgres(uri, { max: 2, onnotice: () => {} })
    return {
        begin: fn => sql.begin(fn) as Promise<any>,
        count: async () => Number((await sql.unsafe('select count(*) as n from rt_given'))[0]!['n']),
        close: () => sql.end(),
    }
}, async transaction => new PostgresQueryRunner(transaction))

describeOverADriverTransaction('BunSqlPostgresQueryRunner (transaction of Bun SQL)', isBun && isRealDbEnabled('postgres', 'docker', 'newest', 'bun_sql_postgres'), async uri => {
    const { SQL } = await import('bun')
    const sql = new SQL(uri, { max: 2 })
    return {
        begin: fn => sql.begin(fn) as Promise<any>,
        count: async () => Number((await sql.unsafe('select count(*) as n from rt_given'))[0]['n']),
        close: () => sql.close(),
    }
}, async transaction => {
    const { BunSqlPostgresQueryRunner } = await import('../../../src/queryRunners/BunSqlPostgresQueryRunner.js')
    return new BunSqlPostgresQueryRunner(transaction)
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
