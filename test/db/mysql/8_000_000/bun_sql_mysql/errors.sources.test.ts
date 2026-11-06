// Where a failure came from: the source of the transaction in an error that leaves it,
// and the source of the execution in what a query runner receives.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { QueryExecutionSource, TsSqlQueryExecutionError } from '../../../../../src/TsSqlError.js'
import { getQueryExecutionStack } from '../../../../../src/queryRunners/QueryRunner.js'
import { MockQueryRunner } from '../../../../../src/queryRunners/MockQueryRunner.js'
import { DBConnection, tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

async function rejectionOf(run: () => Promise<unknown>) {
    try {
        await run()
        return undefined
    } catch (e) {
        return e
    }
}

function transactionSourceOf(e: unknown) {
    return e instanceof TsSqlQueryExecutionError ? e.transactionSource : undefined
}

function timesInTheStack(e: unknown, text: string) {
    return e instanceof Error ? (e.stack ?? '').split(text).length - 1 : 0
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('an-error-of-the-body-has-the-source-of-the-transaction', async () => {
        const caught = await rejectionOf(() => ctx.conn.transaction(() => (ctx.conn.deleteFrom(tIssue) as any).executeDelete()))
        expect(transactionSourceOf(caught)).toBeInstanceOf(QueryExecutionSource)
        expect(transactionSourceOf(caught)?.message).toBe('Transaction executed at')
        expect(timesInTheStack(caught, 'Transaction source:')).toBe(1)
    })

    test('a-rollback-that-works-adds-no-rollback-error', async () => {
        const caught = await rejectionOf(() => ctx.conn.transaction(() => (ctx.conn.deleteFrom(tIssue) as any).executeDelete()))
        expect(caught).toBeInstanceOf(TsSqlQueryExecutionError)
        expect(caught instanceof TsSqlQueryExecutionError ? caught.rollbackError : 'not this error').toBeUndefined()
    })

    test('a-transaction-keeps-the-first-source-in-a-nested-failure', () => {
        const error = new TsSqlQueryExecutionError(new QueryExecutionSource('Query'), { reason: 'UNKNOWN' }, 'failure')
        const first = new QueryExecutionSource('First')
        error.attachTransactionSource(first)
        error.attachTransactionSource(new QueryExecutionSource('Second'))
        expect(transactionSourceOf(error)).toBe(first)
        expect(timesInTheStack(error, 'Transaction source:')).toBe(1)
    })

    test('a-procedure-gives-its-source-to-the-query-runner', async () => {
        let stack: string | undefined
        const runner = new MockQueryRunner((_type, query, params) => {
            stack = getQueryExecutionStack(query, params)
            return undefined
        })
        const connection = new DBConnection(runner, Number.POSITIVE_INFINITY)
        await connection.callRefreshStats()
        expect(stack).toContain('Query executed at')
    })

    test('a-function-gives-its-source-to-the-query-runner', async () => {
        let stack: string | undefined
        const runner = new MockQueryRunner((_type, query, params) => {
            stack = getQueryExecutionStack(query, params)
            return 1
        })
        const connection = new DBConnection(runner, Number.POSITIVE_INFINITY)
        await connection.callCountOpenIssues(1)
        expect(stack).toContain('Query executed at')
    })
})
