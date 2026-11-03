// A deadlock makes MySQL and MariaDB roll back the whole transaction of its victim: the query runner of the victim
// rejects what follows in the transaction instead of running it outside any transaction.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../lib/testRunner.js'
import type { QueryRunner } from '../../../src/queryRunners/QueryRunner.js'
import { reasonOf, rejectionOf } from './runnerContract.js'

export interface DeadlockRunners {
    readonly runner: QueryRunner
    /** Runs a statement on another connection */
    other(sql: string): Promise<unknown>
    close(): Promise<void>
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export function describeDeadlockRollback(label: string, realEnabled: boolean, create: () => Promise<DeadlockRunners>): void {
    describe.skipIf(!realEnabled)(label + ': transaction rolled back by a deadlock', () => {
        let under: DeadlockRunners | undefined
        const u = () => under!
        beforeAll(async () => {
            under = await create()
            await u().other('drop table if exists rt_deadlock')
            await u().other('create table rt_deadlock (id int primary key, v int)')
        }, 180_000)
        afterAll(async () => {
            if (under) {
                await under.other('drop table if exists rt_deadlock')
                await under.close()
            }
        }, 180_000)
        beforeEach(async () => {
            while (u().runner.isTransactionActive()) {
                await u().runner.executeRollback()
            }
            await u().other('delete from rt_deadlock')
            await u().other('insert into rt_deadlock values (1, 0), (2, 0)')
        })

        // The runner's transaction is the victim: the other one changed more rows
        async function deadlockTheRunner(): Promise<unknown> {
            const { runner, other } = u()
            await runner.executeUpdate('update rt_deadlock set v = 1 where id = 1')
            await other('start transaction')
            await other('insert into rt_deadlock values (100, 0), (101, 0), (102, 0), (103, 0), (104, 0)')
            await other('update rt_deadlock set v = 1 where id = 2')
            const waiting = rejectionOf(runner.executeUpdate('update rt_deadlock set v = 2 where id = 2'))
            await delay(300)
            await other('update rt_deadlock set v = 2 where id = 1')
            const failure = await waiting
            await other('rollback')
            return failure
        }
        const savedRows = async () => (await u().other('select count(*) n from rt_deadlock where id >= 60 and id < 100') as any[])[0].n

        test('statements-and-commit-after-the-deadlock-are-rejected', async () => {
            const runner = u().runner
            await runner.executeBeginTransaction()
            await runner.executeInsert('insert into rt_deadlock values (60, 0)')
            const failure = await deadlockTheRunner()
            expect(u().runner.getErrorReason(failure)).toMatchObject({ reason: 'TRANSACTION_ERROR', transactionErrorType: 'deadlock' })
            const next = await rejectionOf(runner.executeInsert('insert into rt_deadlock values (61, 0)'))
            const commit = await rejectionOf(runner.executeCommit())
            await runner.executeRollback()
            expect(runner.isTransactionActive()).toBe(false)
            expect([reasonOf(next), (next as { cause?: unknown }).cause === failure]).toEqual(['TRANSACTION_ERROR', true])
            expect([reasonOf(commit), (commit as { cause?: unknown }).cause === failure]).toEqual(['TRANSACTION_ERROR', true])
            expect(Number(await savedRows())).toBe(0)
        })

        test('transaction-function-whose-deadlock-was-caught-rejects', async () => {
            const runner = u().runner
            const error = await rejectionOf(runner.executeInTransaction(async () => {
                await runner.executeInsert('insert into rt_deadlock values (60, 0)')
                await deadlockTheRunner()
                await rejectionOf(runner.executeInsert('insert into rt_deadlock values (61, 0)'))
            }, runner))
            expect(reasonOf(error)).toBe('TRANSACTION_ERROR')
            expect(runner.isTransactionActive()).toBe(false)
            expect(Number(await savedRows())).toBe(0)
        })

        test('lock-wait-timeout-keeps-the-transaction', async () => {
            const { runner, other } = u()
            await runner.executeConnectionConfiguration('set innodb_lock_wait_timeout = 1').catch(() => undefined)
            await other('start transaction')
            await other('update rt_deadlock set v = 5 where id = 1')
            await runner.executeBeginTransaction()
            await runner.executeConnectionConfiguration('set innodb_lock_wait_timeout = 1')
            await runner.executeInsert('insert into rt_deadlock values (60, 0)')
            await rejectionOf(runner.executeUpdate('update rt_deadlock set v = 6 where id = 1'))
            await other('rollback')
            await runner.executeInsert('insert into rt_deadlock values (61, 0)')
            await runner.executeCommit()
            expect(Number(await savedRows())).toBe(2)
        })
    })
}
