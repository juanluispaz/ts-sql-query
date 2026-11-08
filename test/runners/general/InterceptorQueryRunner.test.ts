// ChainedQueryRunner forwards every call to the runner it wraps;
// InterceptorQueryRunner also reports each one, with its result or its error.

import { describe, expect, test } from '../../lib/testRunner.js'
import { ChainedQueryRunner } from '../../../src/queryRunners/ChainedQueryRunner.js'
import { InterceptorQueryRunner } from '../../../src/queryRunners/InterceptorQueryRunner.js'
import { MockQueryRunner } from '../../../src/queryRunners/MockQueryRunner.js'
import type { QueryRunner, QueryType } from '../../../src/queryRunners/QueryRunner.js'
import { QUERY_CALLS, sampleResult } from '../lib/queryRunnerCalls.js'
import { rejectionOf } from '../lib/runnerContract.js'

const failure = new Error('database failure')

function mock(fail = false): MockQueryRunner {
    const shapes = new Map(QUERY_CALLS.map(c => [c.type, c.shape]))
    return new MockQueryRunner((type) => {
        if (fail) throw failure
        const shape = shapes.get(type)
        return shape ? sampleResult(shape) : undefined
    }, 'postgreSql')
}

class Recorder<T extends QueryRunner> extends InterceptorQueryRunner<string, T> {
    readonly events: string[] = []
    onQuery(queryType: QueryType, query: string, params: any[]): string {
        this.events.push(`query ${queryType} ${query} ${JSON.stringify(params)}`)
        return 'payload-' + queryType
    }
    onQueryResult(queryType: QueryType, _query: string, _params: any[], result: any, payload: string): void {
        this.events.push(`result ${queryType} ${JSON.stringify(result)} ${payload}`)
    }
    onQueryError(queryType: QueryType, _query: string, _params: any[], error: any, payload: string): void {
        this.events.push(`error ${queryType} ${error.message} ${payload}`)
    }
}

describe('ChainedQueryRunner', () => {
    for (const { type, shape, call } of QUERY_CALLS) {
        test(`${type}-is-forwarded`, async () => {
            expect(await call(new ChainedQueryRunner(mock()), 'q', [1])).toEqual(sampleResult(shape))
        })
    }

    test('calls-without-params-are-forwarded', async () => {
        const runner = new ChainedQueryRunner(mock())
        for (const { shape, call } of QUERY_CALLS) {
            expect(await call(runner, 'q', undefined as any)).toEqual(sampleResult(shape))
        }
    })

    test('the-rest-of-the-interface-is-forwarded', async () => {
        const inner = mock()
        const runner = new ChainedQueryRunner(inner)
        expect(runner.database).toBe('postgreSql')
        runner.useDatabase('sqlite')
        expect(inner.database).toBe('sqlite')
        expect(runner.getNativeRunner()).toBeNull()
        expect(runner.getCurrentNativeConnection()).toBeUndefined()
        expect(await runner.execute(async () => 'ran')).toBe('ran')
        await runner.executeBeginTransaction()
        expect(runner.isTransactionActive()).toBe(true)
        await runner.executeCommit()
        await runner.executeBeginTransaction()
        await runner.executeRollback()
        expect(runner.isTransactionActive()).toBe(false)
        expect(await runner.executeInTransaction(async () => 'r', runner)).toBe('r')
        const params: any[] = []
        expect(runner.addParam(params, 1, 'int', 'int', false)).toBe('?1')
        let error: unknown
        try { runner.addOutParam(params, 'id', 'int', 'int', false) } catch (e) { error = e }
        expect(error).toBeDefined()
        expect(await runner.executeCombined(async () => 1, async () => 2)).toEqual([1, 2])
        expect(await runner.createResolvedPromise(3)).toBe(3)
        expect(await rejectionOf(runner.createRejectedPromise(failure))).toBe(failure)
        expect([runner.isMocked(), runner.lowLevelTransactionManagementSupported(), runner.nestedTransactionsSupported()]).toEqual([true, true, true])
        expect(runner.getErrorReason(failure)).toEqual({ reason: 'UNKNOWN' })
        expect(runner.isSqlError(failure)).toBe(false)
    })
})

describe('InterceptorQueryRunner', () => {
    for (const { type, shape, call } of QUERY_CALLS) {
        test(`${type}-reports-the-result`, async () => {
            const runner = new Recorder(mock())
            expect(await call(runner, 'q', [1])).toEqual(sampleResult(shape))
            expect(runner.events).toEqual([`query ${type} q [1]`, `result ${type} ${JSON.stringify(sampleResult(shape))} payload-${type}`])
        })

        test(`${type}-reports-the-error`, async () => {
            const runner = new Recorder(mock(true))
            expect(await rejectionOf(call(runner, 'q', [1]))).toBe(failure)
            expect(runner.events).toEqual([`query ${type} q [1]`, `error ${type} database failure payload-${type}`])
        })
    }

    test('calls-without-params-are-reported', async () => {
        const runner = new Recorder(mock())
        for (const { call } of QUERY_CALLS) {
            await call(runner, 'q', undefined as any)
        }
        await runner.executeBeginTransaction(undefined)
        await runner.executeCommit(undefined)
        await runner.executeBeginTransaction()
        await runner.executeRollback(undefined)
        expect(runner.events.filter(e => e.startsWith('query'))).toHaveLength(QUERY_CALLS.length + 4)
        expect(await runner.executeInTransaction(async () => 'r', runner, undefined)).toBe('r')
    })

    test('transaction-control-is-reported', async () => {
        const runner = new Recorder(mock())
        await runner.executeBeginTransaction(['serializable'])
        await runner.executeCommit()
        await runner.executeBeginTransaction()
        await runner.executeRollback()
        expect(runner.events).toEqual([
            'query beginTransaction  ["serializable"]', 'result beginTransaction undefined payload-beginTransaction',
            'query commit  []', 'result commit undefined payload-commit',
            'query beginTransaction  []', 'result beginTransaction undefined payload-beginTransaction',
            'query rollback  []', 'result rollback undefined payload-rollback',
        ])
    })

    test('transaction-control-errors-are-reported', async () => {
        const runner = new Recorder(mock(true))
        expect(await rejectionOf(runner.executeBeginTransaction())).toBe(failure)
        expect(await rejectionOf(runner.executeCommit())).toBe(failure)
        expect(await rejectionOf(runner.executeRollback())).toBe(failure)
        expect(runner.events.filter(e => e.startsWith('error'))).toEqual([
            'error beginTransaction database failure payload-beginTransaction',
            'error commit database failure payload-commit',
            'error rollback database failure payload-rollback',
        ])
    })

    test('execute-in-transaction-goes-through-the-interceptor', async () => {
        const runner = new Recorder(mock())
        expect(await runner.executeInTransaction(async () => 'r', runner)).toBe('r')
        expect(runner.events.map(e => e.split(' ').slice(0, 2).join(' '))).toEqual([
            'query beginTransaction', 'result beginTransaction', 'query commit', 'result commit',
        ])
    })

    test('execute-in-transaction-without-low-level-transactions', async () => {
        // A runner managing transactions itself: the interceptor still reports
        // begin and commit / rollback around the body.
        class ManagedMock extends MockQueryRunner {
            override executeInTransactionCallsBeginAndCommit(): boolean { return false }
            override executeInTransaction<T>(fn: () => Promise<T>): Promise<T> { return fn() }
        }
        const inner = new ManagedMock(() => undefined, 'postgreSql')
        const runner = new Recorder(inner)
        expect(await runner.executeInTransaction(async () => 'r', runner)).toBe('r')
        const bodyFailure = new Error('body')
        expect(await rejectionOf(runner.executeInTransaction(async () => { throw bodyFailure }, runner))).toBe(bodyFailure)
        expect(runner.events).toEqual([
            'query beginTransaction  []', 'result beginTransaction undefined payload-beginTransaction',
            'query commit  []', 'result commit undefined payload-commit',
            'query beginTransaction  []', 'result beginTransaction undefined payload-beginTransaction',
            'query rollback  []', 'result rollback undefined payload-rollback',
        ])
    })
})
