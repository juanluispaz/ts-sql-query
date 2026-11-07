// NoopQueryRunner: every query answers "nothing", transactions are counted.

import { SynchronousPromise } from 'synchronous-promise'
import { describe, expect, test } from '../../lib/testRunner.js'
import { SqliteConnection } from '../../../src/connections/SqliteConnection.js'
import { NoopQueryRunner } from '../../../src/queryRunners/NoopQueryRunner.js'
import { Table } from '../../../src/Table.js'
import type { DatabaseType } from '../../../src/queryRunners/QueryRunner.js'
import { TsSqlProcessingError } from '../../../src/TsSqlError.js'
import { QUERY_CALLS } from '../lib/queryRunnerCalls.js'
import { reasonOf, rejectionOf } from '../lib/runnerContract.js'

describe('NoopQueryRunner', () => {
    for (const { type, shape, call } of QUERY_CALLS) {
        test(`${type}-answers-nothing`, async () => {
            const expected = shape === 'rows' || shape === 'values' ? [] : shape === 'count' ? 0 : undefined
            expect(await call(new NoopQueryRunner(), 'q', [1])).toEqual(expected)
        })
    }

    test('calls-without-params', async () => {
        const runner = new NoopQueryRunner()
        for (const { call } of QUERY_CALLS) {
            await call(runner, 'q', undefined as any)
        }
        await runner.executeBeginTransaction(undefined)
        await runner.executeCommit(undefined)
        await runner.executeBeginTransaction()
        await runner.executeRollback(undefined)
        expect(await runner.executeInTransaction(async () => 'r', runner, undefined)).toBe('r')
    })

    test('transactions-are-counted', async () => {
        const runner = new NoopQueryRunner()
        await runner.executeCommit()
        await runner.executeRollback()
        expect(runner.isTransactionActive()).toBe(false)
        await runner.executeBeginTransaction()
        expect(runner.isTransactionActive()).toBe(true)
        await runner.executeBeginTransaction()
        await runner.executeCommit()
        expect(runner.isTransactionActive()).toBe(true)
        await runner.executeRollback()
        expect(runner.isTransactionActive()).toBe(false)
    })

    test('execute-in-transaction', async () => {
        const runner = new NoopQueryRunner()
        expect(await runner.executeInTransaction(async () => {
            expect(runner.isTransactionActive()).toBe(true)
            return 'r'
        }, runner)).toBe('r')
        const failure = new Error('body')
        expect(await rejectionOf(runner.executeInTransaction(async () => { throw failure }, runner))).toBe(failure)
        expect(runner.isTransactionActive()).toBe(false)
    })

    test('execute-in-transaction-keeps-the-body-error-when-the-rollback-fails', async () => {
        const failure = new Error('body')
        const runner = new NoopQueryRunner()
        runner.executeRollback = () => Promise.reject(new Error('rollback'))
        expect(await rejectionOf(runner.executeInTransaction(async () => { throw failure }, runner))).toBe(failure)
    })

    test('nested-transactions', () => {
        expect(new NoopQueryRunner().nestedTransactionsSupported()).toBe(false)
        expect(new NoopQueryRunner({ allowNestedTransactions: true }).nestedTransactionsSupported()).toBe(true)
    })

    const PLACEHOLDERS: [DatabaseType, string, string][] = [
        ['mariaDB', '?', '?'], ['mySql', '?', '?'], ['noopDB', '$0', '$1'], ['oracle', ':0', ':1'],
        ['postgreSql', '$1', '$2'], ['sqlite', '?1', '?2'], ['sqlServer', '@0', '@1'],
    ]
    for (const [database, first, second] of PLACEHOLDERS) {
        test(`params-on-${database}`, () => {
            const runner = new NoopQueryRunner(database)
            const params: any[] = []
            expect([runner.addParam(params, 'a'), runner.addParam(params, 'b')]).toEqual([first, second])
            expect(runner.database).toBe(database)
        })
    }

    test('params-on-an-unknown-database', () => {
        const runner = new NoopQueryRunner()
        runner.useDatabase('dbase' as any)
        let error: unknown
        try { runner.addParam([], 1) } catch (e) { error = e }
        expect(reasonOf(error)).toBe('UNSUPPORTED_DATABASE')
    })

    test('out-params', () => {
        const params: any[] = []
        expect(new NoopQueryRunner().addOutParam(params, 'id')).toBe(':0')
        expect(params).toEqual([{ out_param_with_name: 'id' }])
    })

    test('the-rest-of-the-interface', async () => {
        const runner = new NoopQueryRunner({ database: 'postgreSql', promise: SynchronousPromise })
        expect(runner.database).toBe('postgreSql')
        expect(runner.executeSelectOneRow('q')).toBeInstanceOf(SynchronousPromise)
        expect(runner.getNativeRunner()).toBeNull()
        expect(runner.getCurrentNativeConnection()).toBeUndefined()
        expect(await runner.execute(async (connection) => connection)).toBeNull()
        expect(await runner.executeCombined(async () => 1, async () => 2)).toEqual([1, 2])
        expect(await runner.createResolvedPromise(3)).toBe(3)
        const failure = new Error('x')
        expect(await rejectionOf(runner.createRejectedPromise(failure))).toBe(failure)
        expect([runner.isMocked(), runner.lowLevelTransactionManagementSupported()]).toEqual([false, true])
        const library = new TsSqlProcessingError({ reason: 'NOT_IN_TRANSACTION' }, 'probe')
        expect(runner.getErrorReason(library)).toEqual({ reason: 'NOT_IN_TRANSACTION' })
        expect(runner.getErrorReason(new Error('x'))).toEqual({ reason: 'UNKNOWN' })
        expect(runner.isSqlError(new Error('x'))).toBe(true)
    })

    test('a-page-of-no-rows', async () => {
        class DBConnection extends SqliteConnection<'DBConnection'> {}
        const tThing = new class TThing extends Table<DBConnection, 'TThing'> {
            id = this.autogeneratedPrimaryKey('id', 'int')
            constructor() { super('thing') }
        }()
        const connection = new DBConnection(new NoopQueryRunner())

        const page = await connection.selectFrom(tThing).select({ id: tThing.id }).executeSelectPage()

        expect(page).toEqual({ data: [], count: 0 })
    })

    test('begin-transaction-on-a-query-runner-without-low-level-transactions', async () => {
        class DBConnection extends SqliteConnection<'DBConnection'> {}
        class OnlyFunctionsRunner extends NoopQueryRunner {
            override lowLevelTransactionManagementSupported(): boolean { return false }
        }
        const connection = new DBConnection(new OnlyFunctionsRunner())

        expect(reasonOf(await rejectionOf(connection.beginTransaction()))).toBe('LOW_LEVEL_TRANSACTION_NOT_SUPPORTED')
    })
})
