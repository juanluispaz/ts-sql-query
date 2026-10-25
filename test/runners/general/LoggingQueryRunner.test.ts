// LoggingQueryRunner reports every call to the logger callbacks it was given
// (any of them may be missing); ConsoleLogQueryRunner and
// ConsoleLogNoopQueryRunner write those reports with console.log.

import { afterEach, beforeEach, describe, expect, test } from '../../lib/testRunner.js'
import { ConsoleLogNoopQueryRunner } from '../../../src/queryRunners/ConsoleLogNoopQueryRunner.js'
import { ConsoleLogQueryRunner, type ConsoleLogQueryRunnerOpts } from '../../../src/queryRunners/ConsoleLogQueryRunner.js'
import { LoggingQueryRunner, type QueryLogger } from '../../../src/queryRunners/LoggingQueryRunner.js'
import { MockQueryRunner } from '../../../src/queryRunners/MockQueryRunner.js'
import type { QueryRunner } from '../../../src/queryRunners/QueryRunner.js'
import { QUERY_CALLS, sampleResult, type RunnerCall } from '../lib/queryRunnerCalls.js'
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

class ManagedMock extends MockQueryRunner {
    override lowLevelTransactionManagementSupported(): boolean { return false }
    override executeInTransaction<T>(fn: () => Promise<T>): Promise<T> { return fn() }
}

const TRANSACTION_CALLS: readonly RunnerCall[] = [
    { type: 'beginTransaction', shape: 'none', call: (r) => r.executeBeginTransaction() },
    { type: 'commit', shape: 'none', call: (r) => r.executeCommit() },
    { type: 'rollback', shape: 'none', call: (r) => r.executeRollback() },
]

function recordingLogger(parts: readonly ('onQuery' | 'onQueryResult' | 'onQueryError')[]): { logger: QueryLogger, events: string[] } {
    const events: string[] = []
    const logger: QueryLogger = {}
    if (parts.includes('onQuery')) {
        logger.onQuery = (type, query, params, { startedAt }) => { events.push(`query ${type} ${query} ${JSON.stringify(params)} ${typeof startedAt}`) }
    }
    if (parts.includes('onQueryResult')) {
        logger.onQueryResult = (type, _query, _params, result, { startedAt, endedAt }) => { events.push(`result ${type} ${JSON.stringify(result)} ${endedAt >= startedAt}`) }
    }
    if (parts.includes('onQueryError')) {
        logger.onQueryError = (type, _query, _params, error, { startedAt, endedAt }) => { events.push(`error ${type} ${error.message} ${endedAt >= startedAt}`) }
    }
    return { logger, events }
}

describe('LoggingQueryRunner', () => {
    for (const { type, shape, call } of [...QUERY_CALLS, ...TRANSACTION_CALLS]) {
        const result = sampleResult(shape)
        test(`${type}-is-logged`, async () => {
            const { logger, events } = recordingLogger(['onQuery', 'onQueryResult', 'onQueryError'])
            expect(await call(new LoggingQueryRunner(logger, mock()), 'q', [1])).toEqual(result)
            const query = type === 'beginTransaction' || type === 'commit' || type === 'rollback' ? '' : 'q'
            const params = query ? '[1]' : '[]'
            expect(events).toEqual([`query ${type} ${query} ${params} bigint`, `result ${type} ${JSON.stringify(result)} true`])
        })

        test(`${type}-error-is-logged`, async () => {
            const { logger, events } = recordingLogger(['onQuery', 'onQueryResult', 'onQueryError'])
            expect(await rejectionOf(call(new LoggingQueryRunner(logger, mock(true)), 'q', [1]))).toBe(failure)
            expect(events[1]).toBe(`error ${type} database failure true`)
        })

        test(`${type}-with-only-some-callbacks`, async () => {
            const onlyQuery = recordingLogger(['onQuery'])
            expect(await call(new LoggingQueryRunner(onlyQuery.logger, mock()), 'q', [1])).toEqual(result)
            expect(onlyQuery.events).toHaveLength(1)
            const onlyResult = recordingLogger(['onQueryResult'])
            expect(await rejectionOf(call(new LoggingQueryRunner(onlyResult.logger, mock(true)), 'q', [1]))).toBe(failure)
            expect(onlyResult.events).toEqual([])
            const onlyError = recordingLogger(['onQueryError'])
            expect(await call(new LoggingQueryRunner(onlyError.logger, mock()), 'q', [1])).toEqual(result)
            expect(onlyError.events).toEqual([])
        })
    }

    test('calls-without-params-are-logged', async () => {
        const { logger, events } = recordingLogger(['onQuery', 'onQueryResult', 'onQueryError'])
        const runner = new LoggingQueryRunner(logger, mock())
        for (const { call } of QUERY_CALLS) {
            await call(runner, 'q', undefined as any)
        }
        await runner.executeBeginTransaction(undefined)
        await runner.executeCommit(undefined)
        await runner.executeBeginTransaction()
        await runner.executeRollback(undefined)
        expect(events.filter(e => e.startsWith('query'))).toHaveLength(QUERY_CALLS.length + 4)
        expect(await runner.executeInTransaction(async () => 'r', runner, undefined)).toBe('r')
        const managed = new LoggingQueryRunner(logger, new ManagedMock(() => undefined, 'postgreSql'))
        expect(await managed.executeInTransaction(async () => 'r', managed, undefined)).toBe('r')
    })

    test('execute-in-transaction-goes-through-the-logger', async () => {
        const { logger, events } = recordingLogger(['onQuery', 'onQueryResult'])
        const runner = new LoggingQueryRunner(logger, mock())
        expect(await runner.executeInTransaction(async () => 'r', runner)).toBe('r')
        expect(events.map(e => e.split(' ').slice(0, 2).join(' '))).toEqual(['query beginTransaction', 'result beginTransaction', 'query commit', 'result commit'])
    })

    test('execute-in-transaction-without-low-level-transactions', async () => {
        const { logger, events } = recordingLogger(['onQuery', 'onQueryResult'])
        const runner = new LoggingQueryRunner(logger, new ManagedMock(() => undefined, 'postgreSql'))
        expect(await runner.executeInTransaction(async () => 'r', runner, ['serializable'])).toBe('r')
        const bodyFailure = new Error('body')
        expect(await rejectionOf(runner.executeInTransaction(async () => { throw bodyFailure }, runner))).toBe(bodyFailure)
        expect(events).toEqual([
            'query beginTransaction  ["serializable"] bigint', 'result beginTransaction undefined true',
            'query commit  ["serializable"] bigint', 'result commit undefined true',
            'query beginTransaction  [] bigint', 'result beginTransaction undefined true',
            'query rollback  [] bigint', 'result rollback undefined true',
        ])
    })

    test('execute-in-transaction-without-low-level-transactions-and-no-callbacks', async () => {
        const runner = new LoggingQueryRunner({}, new ManagedMock(() => undefined, 'postgreSql'))
        expect(await runner.executeInTransaction(async () => 'r', runner)).toBe('r')
        const bodyFailure = new Error('body')
        expect(await rejectionOf(runner.executeInTransaction(async () => { throw bodyFailure }, runner))).toBe(bodyFailure)
    })

    test('a-failing-logger-does-not-change-how-the-transaction-ends', async () => {
        const throwing: QueryLogger = { onQuery: (type) => { if (type !== 'beginTransaction') throw new Error('logger') } }
        const runner = new LoggingQueryRunner(throwing, new ManagedMock(() => undefined, 'postgreSql'))
        expect(await runner.executeInTransaction(async () => 'r', runner)).toBe('r')
        const bodyFailure = new Error('body')
        expect(await rejectionOf(runner.executeInTransaction(async () => { throw bodyFailure }, runner))).toBe(bodyFailure)
    })
})

describe('ConsoleLogQueryRunner', () => {
    let logged: unknown[][] = []
    let original: typeof console.log
    beforeEach(() => {
        logged = []
        original = console.log
        console.log = (...args: unknown[]) => { logged.push(args) }
    })
    afterEach(() => {
        console.log = original
    })

    async function run(opts: ConsoleLogQueryRunnerOpts | undefined, fail = false): Promise<unknown[][]> {
        const runner: QueryRunner = new ConsoleLogQueryRunner(mock(fail), opts)
        if (fail) {
            await rejectionOf(runner.executeSelectOneRow('select 1', [7]))
        } else {
            await runner.executeSelectOneRow('select 1', [7])
        }
        return logged
    }

    test('logs-the-query', async () => {
        expect(await run(undefined)).toEqual([['selectOneRow', 'select 1', [7]]])
    })

    test('logs-the-result', async () => {
        expect(await run({ logResults: true })).toEqual([['selectOneRow', 'select 1', [7]], ['selectOneRow', 'select 1', [7], { id: 1 }]])
    })

    test('logs-the-result-as-an-object', async () => {
        expect(await run({ logResults: true, paramsAsObject: true })).toEqual([
            ['selectOneRow', { query: 'select 1', params: [7] }],
            ['selectOneRow', { query: 'select 1', params: [7], result: { id: 1 } }],
        ])
    })

    test('logs-the-end-without-the-result', async () => {
        const lines = await run({ logDurations: true, includeLogPhase: true })
        expect(lines[0]).toEqual(['selectOneRow (onQuery)', 'select 1', [7]])
        expect(String(lines[1]![0])).toMatch(/^\[Took \d+ms\] selectOneRow \(onQueryResult\)$/)
        expect(lines[1]!.slice(1)).toEqual(['select 1', [7]])
    })

    test('logs-the-end-without-the-result-as-an-object', async () => {
        const lines = await run({ logTimestamps: true, paramsAsObject: true, timeGranularity: 'us' })
        expect(String(lines[0]![0])).toMatch(/^\[\d+\]  selectOneRow$/)
        expect(lines[0]![1]).toEqual({ query: 'select 1', params: [7] })
        expect(String(lines[1]![0])).toMatch(/^\[\d+\] selectOneRow$/)
        expect(lines[1]![1]).toEqual({ query: 'select 1', params: [7] })
    })

    test('logs-the-error', async () => {
        const lines = await run({ logDurations: true, logTimestamps: true, timeGranularity: 'ns', includeLogPhase: true }, true)
        expect(String(lines[1]![0])).toMatch(/^\[\d+\]\[Took \d+ns\] selectOneRow \(onQueryError\)$/)
        expect(lines[1]!.slice(1)).toEqual(['select 1', [7], failure])
    })

    test('logs-the-error-as-an-object', async () => {
        const lines = await run({ logResults: true, paramsAsObject: true }, true)
        expect(lines[1]).toEqual(['selectOneRow', { query: 'select 1', params: [7], error: failure }])
    })

    test('console-log-noop-query-runner', async () => {
        const runner = new ConsoleLogNoopQueryRunner()
        expect(runner.database).toBe('noopDB')
        expect(await runner.executeSelectManyRows('select 1')).toEqual([])
        expect(new ConsoleLogNoopQueryRunner('sqlite').database).toBe('sqlite')
        expect(logged).toEqual([['selectManyRows', 'select 1', []]])
    })
})
