// MockQueryRunner: what each method hands to the query executor, the shape
// gate it applies to the executor's answer, and its transaction bookkeeping.

import { SynchronousPromise } from 'synchronous-promise'
import type { ValueType } from '../../../src/expressions/values.js'
import { describe, expect, test } from '../../lib/testRunner.js'
import { MockQueryRunner, type MockQueryExecutor } from '../../../src/queryRunners/MockQueryRunner.js'
import type { DatabaseType, QueryType } from '../../../src/queryRunners/QueryRunner.js'
import { TsSqlProcessingError } from '../../../src/TsSqlError.js'
import { QUERY_CALLS, sampleResult, type ResultShape } from '../lib/queryRunnerCalls.js'
import { reasonOf, rejectionOf } from '../lib/runnerContract.js'
import { addOutParam, addParam } from '../lib/params.js'

const INVALID: { [shape in ResultShape]: readonly unknown[] } = {
    row: [1, new Date()],
    rows: ['rows', [1]],
    value: [],
    values: [1],
    count: ['3'],
    none: [5],
}

const DEFAULT_FOR_NOTHING: { [type in QueryType]?: unknown } = {
    selectManyRows: [], selectOneColumnManyRows: [], insertReturningMultipleLastInsertedId: [],
    insertReturningManyRows: [], insertReturningOneColumnManyRows: [], updateReturningManyRows: [],
    updateReturningOneColumnManyRows: [], deleteReturningManyRows: [], deleteReturningOneColumnManyRows: [],
    insert: 1, update: 0, delete: 0,
}

describe('MockQueryRunner', () => {
    for (const { type, shape, call } of QUERY_CALLS) {
        test(`${type}-hands-the-query-to-the-executor`, async () => {
            const seen: unknown[][] = []
            const runner = new MockQueryRunner((t, q, p, i) => { seen.push([t, q, p, i]); return sampleResult(shape) })
            expect(await call(runner, 'the query', [1, 'a'])).toEqual(sampleResult(shape))
            await call(runner, 'second', [])
            expect(seen).toEqual([[type, 'the query', [1, 'a'], 0], [type, 'second', [], 1]])
        })

        test(`${type}-without-a-mocked-value`, async () => {
            for (const nothing of [undefined, null]) {
                const runner = new MockQueryRunner(() => nothing)
                const expected = type in DEFAULT_FOR_NOTHING ? DEFAULT_FOR_NOTHING[type] : shape === 'none' ? undefined : nothing
                expect(await call(runner, 'q', [])).toEqual(expected)
            }
        })

        for (const invalid of INVALID[shape]) {
            test(`${type}-rejects-${JSON.stringify(invalid)}`, async () => {
                const runner = new MockQueryRunner(() => invalid)
                const error = await rejectionOf(call(runner, 'q', []))
                expect(reasonOf(error)).toBe('INVALID_MOCKED_VALUE')
            })
        }

        test(`${type}-passes-the-executor-error-on`, async () => {
            const failure = new Error('executor failure')
            const runner = new MockQueryRunner(() => { throw failure })
            expect(await rejectionOf(call(runner, 'q', []))).toBe(failure)
        })
    }

    test('transactions-go-through-the-executor', async () => {
        const seen: unknown[][] = []
        const runner = new MockQueryRunner((t, q, p) => { seen.push([t, q, p]); return undefined })
        await runner.executeBeginTransaction(['serializable'])
        expect(runner.isTransactionActive()).toBe(true)
        await runner.executeBeginTransaction()
        await runner.executeCommit()
        expect(runner.isTransactionActive()).toBe(true)
        await runner.executeRollback()
        expect(runner.isTransactionActive()).toBe(false)
        await runner.executeRollback()
        expect(runner.isTransactionActive()).toBe(false)
        expect(seen).toEqual([
            ['beginTransaction', 'begin transaction', ['serializable']],
            ['beginTransaction', 'begin transaction', []],
            ['commit', 'commit', []],
            ['rollback', 'rollback', []],
            ['rollback', 'rollback', []],
        ])
    })

    for (const step of ['begin', 'commit', 'rollback'] as const) {
        test(`${step}-rejects-a-mocked-value`, async () => {
            const runner = new MockQueryRunner(() => 1)
            const run = step === 'begin' ? runner.executeBeginTransaction() : step === 'commit' ? runner.executeCommit() : runner.executeRollback()
            expect(reasonOf(await rejectionOf(run))).toBe('INVALID_MOCKED_VALUE')
        })

        test(`${step}-passes-the-executor-error-on`, async () => {
            const failure = new Error(step)
            const runner = new MockQueryRunner(() => { throw failure })
            const run = step === 'begin' ? runner.executeBeginTransaction() : step === 'commit' ? runner.executeCommit() : runner.executeRollback()
            expect(await rejectionOf(run)).toBe(failure)
        })
    }

    test('calls-without-params', async () => {
        const runner = new MockQueryRunner(() => undefined)
        for (const { call } of QUERY_CALLS) {
            await call(runner, 'q', undefined as any)
        }
        await runner.executeBeginTransaction(undefined)
        await runner.executeCommit(undefined)
        await runner.executeBeginTransaction()
        await runner.executeRollback(undefined)
        expect(await runner.executeInTransaction(async () => 'r', runner, undefined)).toBe('r')
    })

    test('reset', async () => {
        const indexes: number[] = []
        const runner = new MockQueryRunner((_t, _q, _p, i) => { indexes.push(i); return undefined })
        await runner.executeSelectOneRow('q')
        await runner.executeBeginTransaction()
        runner.reset()
        expect(runner.isTransactionActive()).toBe(false)
        await runner.executeSelectOneRow('q')
        expect(indexes).toEqual([0, 1, 0])
    })

    test('execute-in-transaction', async () => {
        const seen: string[] = []
        const runner = new MockQueryRunner((t) => { seen.push(t); return undefined })
        expect(await runner.executeInTransaction(async () => 'r', runner)).toBe('r')
        const failure = new Error('body')
        expect(await rejectionOf(runner.executeInTransaction(async () => { throw failure }, runner))).toBe(failure)
        expect(seen).toEqual(['beginTransaction', 'commit', 'beginTransaction', 'rollback'])
    })

    test('execute-in-transaction-keeps-the-body-error-when-the-rollback-fails', async () => {
        const failure = new Error('body')
        const runner = new MockQueryRunner((t) => { if (t === 'rollback') throw new Error('rollback'); return undefined })
        expect(await rejectionOf(runner.executeInTransaction(async () => { throw failure }, runner))).toBe(failure)
    })

    const PLACEHOLDERS: [DatabaseType, string, string][] = [
        ['mariaDB', '?', '?'], ['mySql', '?', '?'], ['noopDB', '$0', '$1'], ['oracle', ':0', ':1'],
        ['postgreSql', '$1', '$2'], ['sqlite', '?1', '?2'], ['sqlServer', '@0', '@1'],
    ]
    for (const [database, first, second] of PLACEHOLDERS) {
        test(`params-on-${database}`, () => {
            const runner = new MockQueryRunner(() => undefined, database)
            const params: any[] = []
            expect([addParam(runner, params, 'a', 'string', 'string', false), addParam(runner, params, 'b', 'string', 'string', false)]).toEqual([first, second])
            expect(params).toEqual(['a', 'b'])
            expect(runner.database).toBe(database)
        })
    }

    // The type a parameter is forced to have: a cast on PostgreSQL, as pg writes it; nothing on the others
    const FORCED: [DatabaseType, string][] = [
        ['mariaDB', '?'], ['mySql', '?'], ['noopDB', '$0'], ['oracle', ':0'], ['postgreSql', '$1::int4'], ['sqlite', '?1'], ['sqlServer', '@0'],
    ]
    for (const [database, placeholder] of FORCED) {
        test(`forced-type-on-${database}`, () => {
            const runner = new MockQueryRunner(() => undefined, database)
            expect(addParam(runner, [], 1, 'int', 'int', true)).toBe(placeholder)
        })
    }
    test('forced-type-on-postgreSql-by-the-value', () => {
        const runner = new MockQueryRunner(() => undefined, 'postgreSql')
        const cases: [unknown, string, ValueType, string][] = [
            [1, 'Status', 'enum', '$1::int4'], [5000000000, 'Big', 'custom', '$1::int8'], [1.5, 'Ratio', 'customComparable', '$1::float8'],
            [5n, 'Count', '', '$1::int8'], ['open', 'Status', 'enum', '$1'], [null, 'Status', 'enum', '$1'],
        ]
        for (const [value, type, columnType, placeholder] of cases) {
            expect([type, value, addParam(runner, [], value, type, columnType, true)]).toEqual([type, value, placeholder])
        }
    })

    test('params-on-an-unknown-database', () => {
        const runner = new MockQueryRunner(() => undefined)
        runner.useDatabase('dbase' as any)
        let error: unknown
        try { addParam(runner, [], 1, 'int', 'int', false) } catch (e) { error = e }
        expect(reasonOf(error)).toBe('UNSUPPORTED_DATABASE')
    })

    test('out-params', () => {
        const oracle = new MockQueryRunner(() => undefined, { database: 'oracle' })
        const params: any[] = []
        expect(addOutParam(oracle, params, 'id', 'int', 'int', false)).toBe(':0')
        expect(addOutParam(oracle, params, '', 'int', 'int', false)).toBe(':1')
        expect(params).toEqual([{ dir: 3003, as: 'id' }, { dir: 3003 }])
        let error: unknown
        try { new MockQueryRunner(() => undefined).addOutParam([], 'id') } catch (e) { error = e }
        expect(reasonOf(error)).toBe('OUT_PARAMS_NOT_SUPPORTED')
    })

    test('sql-errors', () => {
        const plain = new MockQueryRunner(() => undefined)
        const library = new TsSqlProcessingError({ reason: 'NOT_IN_TRANSACTION' }, 'probe')
        expect(plain.isSqlError(library)).toBe(true)
        expect(plain.isSqlError(new Error('app'))).toBe(false)
        expect(plain.getErrorReason(library)).toEqual({ reason: 'NOT_IN_TRANSACTION' })
        expect(plain.getErrorReason(new Error('app'))).toEqual({ reason: 'UNKNOWN' })
        const custom = new MockQueryRunner(() => undefined, { isSqlError: (e) => e instanceof RangeError })
        expect(custom.isSqlError(new RangeError('x'))).toBe(true)
        expect(custom.isSqlError(new Error('x'))).toBe(false)
        expect(custom.isSqlError(library)).toBe(true)
    })

    test('a-null-in-the-rows-is-an-invalid-mocked-value', async () => {
        const runner = new MockQueryRunner(() => [null])

        expect(reasonOf(await rejectionOf(runner.executeSelectManyRows('q', [])))).toBe('INVALID_MOCKED_VALUE')
    })

    test('the-rest-of-the-interface', async () => {
        const runner = new MockQueryRunner(() => undefined)
        expect(runner.getNativeRunner()).toBeNull()
        expect(runner.getCurrentNativeConnection()).toBeUndefined()
        expect(await runner.execute(async (connection) => connection)).toBeNull()
        expect(await runner.executeCombined(async () => 1, async () => 2)).toEqual([1, 2])
        expect(await runner.createResolvedPromise(3)).toBe(3)
        const failure = new Error('x')
        expect(await rejectionOf(runner.createRejectedPromise(failure))).toBe(failure)
        expect([runner.isMocked(), runner.lowLevelTransactionManagementSupported(), runner.nestedTransactionsSupported()]).toEqual([true, true, true])
    })

    test('promise-provider', async () => {
        const executor: MockQueryExecutor = () => ({ id: 1 })
        const runner = new MockQueryRunner(executor, { database: 'sqlite', promise: SynchronousPromise })
        expect(runner.executeSelectOneRow('q')).toBeInstanceOf(SynchronousPromise)
        expect(runner.createResolvedPromise(1)).toBeInstanceOf(SynchronousPromise)
        expect(await runner.executeSelectOneRow('q')).toEqual({ id: 1 })
    })
})
