// NoopQueryRunner: every query answers "nothing", transactions are counted.

import { SynchronousPromise } from 'synchronous-promise'
import type { DataTypeClass } from '../../../src/TypeAdapter.js'
import { describe, expect, test } from '../../lib/testRunner.js'
import { SqliteConnection } from '../../../src/connections/SqliteConnection.js'
import { NoopQueryRunner } from '../../../src/queryRunners/NoopQueryRunner.js'
import { Table } from '../../../src/Table.js'
import type { DatabaseType } from '../../../src/queryRunners/QueryRunner.js'
import { TsSqlProcessingError } from '../../../src/TsSqlError.js'
import { QUERY_CALLS } from '../lib/queryRunnerCalls.js'
import { reasonOf, rejectionOf } from '../lib/runnerContract.js'
import { addParam, typeNameOf } from '../lib/params.js'
import { ComparableType, EnumType, EqualableType } from '../../../src/exports/v2/index.js'

// The data types of the user the parameters are of, each one a class of the family of its values
abstract class BigType extends EqualableType<unknown, 'Big'> { static override readonly type = 'Big' }
abstract class RatioType extends ComparableType<unknown, 'Ratio'> { static override readonly type = 'Ratio' }
abstract class StatusType extends EnumType<unknown, 'Status'> { static override readonly type = 'Status' }

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
        expect(new NoopQueryRunner().nestedTransactionsSupported).toBe(false)
        expect(new NoopQueryRunner({ allowNestedTransactions: true }).nestedTransactionsSupported).toBe(true)
    })

    const PLACEHOLDERS: [DatabaseType, string, string][] = [
        ['mariaDB', '?', '?'], ['mySql', '?', '?'], ['noopDB', '$0', '$1'], ['oracle', ':0', ':1'],
        ['postgreSql', '$1', '$2'], ['sqlite', '?1', '?2'], ['sqlServer', '@0', '@1'],
    ]
    for (const [database, first, second] of PLACEHOLDERS) {
        test(`params-on-${database}`, () => {
            const runner = new NoopQueryRunner({ database })
            const params: any[] = []
            expect([addParam(runner, params, 'a', 'string', false), addParam(runner, params, 'b', 'string', false)]).toEqual([first, second])
            expect(runner.database).toBe(database)
        })
    }

    // The type a parameter is forced to have: a cast on PostgreSQL, as pg writes it; nothing on the others
    const FORCED: [DatabaseType, string][] = [
        ['mariaDB', '?'], ['mySql', '?'], ['noopDB', '$0'], ['oracle', ':0'], ['postgreSql', '$1::int4'], ['sqlite', '?1'], ['sqlServer', '@0'],
    ]
    for (const [database, placeholder] of FORCED) {
        test(`forced-type-on-${database}`, () => {
            const runner = new NoopQueryRunner({ database })
            expect(addParam(runner, [], 1, 'int', true)).toBe(placeholder)
        })
    }
    test('forced-type-on-postgreSql-by-the-value', () => {
        const runner = new NoopQueryRunner({ database: 'postgreSql' })
        const cases: [unknown, string | DataTypeClass, string][] = [
            [1, StatusType, '$1::int4'], [5000000000, BigType, '$1::int8'], [1.5, RatioType, '$1::float8'],
            [5n, 'Count', '$1::int8'], ['open', StatusType, '$1'], [null, StatusType, '$1'],
        ]
        for (const [value, type, placeholder] of cases) {
            expect([typeNameOf(type), value, addParam(runner, [], value, type, true)]).toEqual([typeNameOf(type), value, placeholder])
        }
    })

    test('params-on-an-unknown-database', () => {
        const runner = new NoopQueryRunner()
        runner.useDatabase('dbase' as any)
        let error: unknown
        try { addParam(runner, [], 1, 'int', false) } catch (e) { error = e }
        expect(reasonOf(error)).toBe('UNSUPPORTED_DATABASE')
    })

    test('out-params', () => {
        // Only Oracle has them, as oracledb receives them
        const params: any[] = []
        expect(new NoopQueryRunner({ database: 'oracle' }).addOutParam(params, 'id', 'int')).toBe(':0')
        expect(params).toEqual([{ dir: 3003, as: 'id' }])
        let error: unknown
        try { new NoopQueryRunner().addOutParam([], 'id', 'int') } catch (e) { error = e }
        expect(reasonOf(error)).toBe('OUT_PARAMS_NOT_SUPPORTED')
    })

    test('the-rest-of-the-interface', async () => {
        const runner = new NoopQueryRunner({ database: 'postgreSql', promise: SynchronousPromise })
        expect(runner.database).toBe('postgreSql')
        expect(runner.executeQuery('selectOneRow', 'q', [])).toBeInstanceOf(SynchronousPromise)
        expect(runner.getNativeRunner()).toBeNull()
        expect(runner.getCurrentNativeConnection()).toBeUndefined()
        expect(await runner.execute(async (connection) => connection)).toBeNull()
        expect(await runner.executeCombined(async () => 1, async () => 2)).toEqual([1, 2])
        expect(await runner.createResolvedPromise(3)).toBe(3)
        const failure = new Error('x')
        expect(await rejectionOf(runner.createRejectedPromise(failure))).toBe(failure)
        expect([runner.isMocked, runner.lowLevelTransactionManagementSupported]).toEqual([true, true])
        const library = new TsSqlProcessingError({ reason: 'NOT_IN_TRANSACTION' }, 'probe')
        expect(runner.getErrorReason(library)).toEqual({ reason: 'NOT_IN_TRANSACTION' })
        expect(runner.getErrorReason(new Error('x'))).toEqual({ reason: 'UNKNOWN' })
        // As on a real database, an error of the application isn't an error of the database
        expect(runner.isSqlError(library)).toBe(true)
        expect(runner.isSqlError(new Error('x'))).toBe(false)
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
            override get lowLevelTransactionManagementSupported(): boolean { return false }
        }
        const connection = new DBConnection(new OnlyFunctionsRunner())

        expect(reasonOf(await rejectionOf(connection.beginTransaction()))).toBe('LOW_LEVEL_TRANSACTION_NOT_SUPPORTED')
    })
})
