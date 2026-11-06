// What arrives when a function deferred to the end of the transaction fails, depending on
// what else failed, and what the low level commit does when a function of before commit fails.

import { afterAll, ApplicationError, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { TsSqlQueryExecutionError } from '../../../../../src/TsSqlError.js'
import { tOrganization } from '../../domain/connection.js'
import { ctx } from './setup.js'

async function rejectionOf(run: () => Promise<unknown>) {
    try {
        await run()
        return undefined
    } catch (e) {
        return e
    }
}

function reasonOf(e: unknown) {
    return e instanceof TsSqlQueryExecutionError ? e.errorReason.reason : undefined
}

function causeOf(e: unknown) {
    return e instanceof TsSqlQueryExecutionError ? e.cause : undefined
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('an-error-of-the-body-arrives-as-it-is-when-the-functions-work', async () => {
        const bodyError = new ApplicationError('body')
        const events: string[] = []
        const caught = await rejectionOf(() => ctx.conn.transaction(() => {
            ctx.conn.executeAfterNextRollback(() => { events.push('after rollback') })
            throw bodyError
        }))
        expect(caught).toBe(bodyError)
        expect(events).toEqual(['after rollback'])
    })

    test('an-error-of-the-body-and-a-function-failing-keeps-both', async () => {
        const bodyError = new ApplicationError('body')
        const first = new ApplicationError('first')
        const second = new ApplicationError('second')
        const caught = await rejectionOf(() => ctx.conn.transaction(() => {
            ctx.conn.executeAfterNextRollback(() => { throw first })
            ctx.conn.executeAfterNextRollback(() => { throw second })
            throw bodyError
        }))
        expect(reasonOf(caught)).toBe('ERROR_EXECUTING_DEFERRED_IN_TRANSACTION')
        expect(causeOf(caught)).toBe(first)
        expect(caught instanceof TsSqlQueryExecutionError ? caught.transactionError : undefined).toBe(bodyError)
        expect(caught instanceof TsSqlQueryExecutionError ? caught.additionalErrors?.length : 0).toBe(1)
    })

    test('a-failed-before-commit-rolls-back-the-low-level-commit', async () => {
        // MOCK-ONLY: no statement is needed: what is checked is which transaction statements are sent, on a connection of its own.
        ctx.mockOnlyConnection()
        const { conn } = ctx.withFaultInjection()
        const failure = new ApplicationError('check')
        const events: string[] = []
        await conn.beginTransaction()
        conn.executeBeforeNextCommit(() => { throw failure })
        conn.executeAfterNextCommit(() => { events.push('after commit') })
        conn.executeAfterNextRollback(() => { events.push('after rollback') })
        const caught = await rejectionOf(() => conn.commit())
        expect(reasonOf(caught)).toBe('ERROR_EXECUTING_DEFERRED_IN_TRANSACTION')
        expect(causeOf(caught)).toBe(failure)
        expect(conn.isTransactionActive()).toBe(false)
        expect(events).toEqual(['after rollback'])
    })

    test('a-failed-before-commit-and-a-failed-after-rollback-keep-both', async () => {
        // MOCK-ONLY: a connection of its own, to end the transaction without touching the real one.
        ctx.mockOnlyConnection()
        const { conn } = ctx.withFaultInjection()
        const failure = new ApplicationError('check')
        const rollbackFailure = new ApplicationError('after rollback')
        await conn.beginTransaction()
        conn.executeBeforeNextCommit(() => { throw failure })
        conn.executeAfterNextRollback(() => { throw rollbackFailure })
        const caught = await rejectionOf(() => conn.commit())
        expect(causeOf(caught)).toBe(failure)
        expect(caught instanceof TsSqlQueryExecutionError ? caught.additionalErrors?.length : 0).toBe(1)
        expect(conn.isTransactionActive()).toBe(false)
    })

    test('the-row-of-a-failed-before-commit-is-not-saved', async () => {
        const failure = new ApplicationError('check')
        const name = 'row of a failed check'
        await ctx.conn.beginTransaction()
        ctx.mockNext(1)
        await ctx.conn.update(tOrganization).set({ name }).where(tOrganization.id.equals(1)).executeUpdate()
        ctx.conn.executeBeforeNextCommit(() => { throw failure })
        const caught = await rejectionOf(() => ctx.conn.commit())
        expect(causeOf(caught)).toBe(failure)
        expect(ctx.conn.isTransactionActive()).toBe(false)
        ctx.mockNext([{ name: 'Acme' }])
        const rows = await ctx.conn.selectFrom(tOrganization).where(tOrganization.id.equals(1)).select({ name: tOrganization.name }).executeSelectMany()
        expect(rows.some((row) => row.name === name)).toBe(false)
    })
})
