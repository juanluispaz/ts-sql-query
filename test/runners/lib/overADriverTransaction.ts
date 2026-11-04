// A query runner created inside a transaction something else manages: the statements run in that transaction, execute
// gives what the query runner was created with, and neither a transaction begins inside it nor does the query runner
// end it.

import { afterAll, beforeAll, describe, expect, test } from '../../lib/testRunner.js'
import type { QueryRunner } from '../../../src/queryRunners/QueryRunner.js'
import { reasonOf, rejectionOf } from './runnerContract.js'

export interface OverADriverTransactionDriver {
    /** Begins a transaction with the driver, commits it when fn ends and rolls it back when fn throws */
    begin<T>(fn: (transaction: any) => Promise<T>): Promise<T>
    run(sql: string): Promise<unknown>
    count(): Promise<number>
    close(): Promise<void>
}

export interface OverADriverTransactionConfig {
    label: string
    realEnabled: boolean
    open(): Promise<OverADriverTransactionDriver>
    createRunner(transaction: any): QueryRunner | Promise<QueryRunner>
    /** Created without what tells it about the transaction: its begin commits the transaction (MySQL and MariaDB) */
    createRunnerWhoseBeginCommits?: ((transaction: any) => QueryRunner) | undefined
}

export function describeOverADriverTransaction(config: OverADriverTransactionConfig) {
    describe.skipIf(!config.realEnabled)(config.label + ': over a transaction something else manages', () => {
        let driver: OverADriverTransactionDriver | undefined
        const d = (): OverADriverTransactionDriver => {
            if (!driver) throw new Error(config.label + ': driver read before beforeAll')
            return driver
        }

        beforeAll(async () => {
            driver = await config.open()
            await d().run('drop table if exists rt_given')
            await d().run('create table rt_given (id integer primary key)')
        }, 300_000)

        afterAll(async () => {
            await driver?.close()
        }, 300_000)

        test('statements-run-in-the-transaction-of-the-driver', async () => {
            const undo = new Error('undo')
            const error = await rejectionOf(d().begin(async transaction => {
                const runner = await config.createRunner(transaction)
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

        test('the-driver-commits-the-transaction', async () => {
            await d().begin(async transaction => {
                const runner = await config.createRunner(transaction)
                await runner.executeInsert('insert into rt_given (id) values (2)')
            })
            expect(await d().count()).toBe(1)
            await d().run('delete from rt_given')
        })

        test('no-transaction-begins-commits-or-rolls-back', async () => {
            const undo = new Error('undo')
            const error = await rejectionOf(d().begin(async transaction => {
                const runner = await config.createRunner(transaction)
                expect(reasonOf(await rejectionOf(runner.executeBeginTransaction()))).toBe('NESTED_TRANSACTION_NOT_SUPPORTED')
                expect(reasonOf(await rejectionOf(runner.executeInTransaction(async () => undefined, runner)))).toBe('NESTED_TRANSACTION_NOT_SUPPORTED')
                await runner.executeInsert('insert into rt_given (id) values (3)')
                expect(reasonOf(await rejectionOf(runner.executeCommit()))).toBe('NOT_IN_TRANSACTION')
                expect(reasonOf(await rejectionOf(runner.executeRollback()))).toBe('NOT_IN_TRANSACTION')
                expect(runner.isTransactionActive()).toBe(false)
                throw undo
            }))
            expect(error).toBe(undo)
            expect(await d().count()).toBe(0)
        })

        const createRunnerWhoseBeginCommits = config.createRunnerWhoseBeginCommits
        if (createRunnerWhoseBeginCommits) {
            test('a-query-runner-not-told-commits-the-transaction-when-one-begins', async () => {
                const undo = new Error('undo')
                await rejectionOf(d().begin(async transaction => {
                    const runner = createRunnerWhoseBeginCommits(transaction)
                    await runner.executeInsert('insert into rt_given (id) values (4)')
                    await runner.executeBeginTransaction()
                    await runner.executeRollback()
                    throw undo
                }))
                expect(await d().count()).toBe(1)
                await d().run('delete from rt_given')
            })
        }
    })
}

/** The begin of a driver with no transaction function of its own: statements on the connection itself */
export async function inManualTransaction<T>(connection: unknown, run: (sql: string) => Promise<unknown>, fn: (transaction: any) => Promise<T>): Promise<T> {
    await run('begin')
    try {
        const result = await fn(connection)
        await run('commit')
        return result
    } catch (error) {
        await run('rollback')
        throw error
    }
}
