// Every execute method, and everything else that returns a promise on the connection,
// reports its failures through that promise: nothing is thrown when it's called. A helper
// below calls the method outside of any catch, so a synchronous throw fails the test.
//
// Nothing reaches the database in these tests. A query that can't be built is never
// sent, and the failures of the transaction methods are raised before any driver call.
//
// An error of the library arrives wrapped in TsSqlQueryExecutionError, with the original
// one as its cause. An error of the application raised while building the query, like the
// one given to `allowWhen`, arrives as it is.

import { afterAll, ApplicationError, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { TsSqlProcessingError, TsSqlQueryExecutionError } from '../../../../../src/TsSqlError.js'
import { MockQueryRunner } from '../../../../../src/queryRunners/MockQueryRunner.js'
import type { TypeAdapter } from '../../../../../src/TypeAdapter.js'
import { DBConnection, tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

// `run` is called outside of the try, so a synchronous throw escapes and fails the test.
async function rejectionOf(run: () => Promise<unknown>) {
    const promise = run()
    try {
        await promise
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

const DELETE_METHODS = ['executeDelete', 'executeDeleteNoneOrOne', 'executeDeleteOne', 'executeDeleteMany']
const UPDATE_METHODS = ['executeUpdate', 'executeUpdateNoneOrOne', 'executeUpdateOne', 'executeUpdateMany']
const INSERT_METHODS = ['executeInsert', 'executeInsertNoneOrOne', 'executeInsertOne', 'executeInsertMany']
const SELECT_METHODS = ['executeSelectNoneOrOne', 'executeSelectOne', 'executeSelectMany', 'executeSelectPage']

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    const disallowedSelect = (error: string | Error) => {
        const one = ctx.conn.const(1, 'int')
        return ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(typeof error === 'string' ? one.allowWhen(false, error) : one.allowWhen(false, error)))
            .select({ id: tProject.id })
    }
    const disallowedIssue = (error: string | Error) => {
        const title = ctx.conn.const('x', 'string')
        return { title: typeof error === 'string' ? title.allowWhen(false, error) : title.allowWhen(false, error) }
    }

    for (const method of DELETE_METHODS) {
        test(`${method}-rejects-missing-where`, async () => {
            const caught = await rejectionOf(() => (ctx.conn.deleteFrom(tIssue) as any)[method]())
            expect(caught).toBeInstanceOf(TsSqlQueryExecutionError)
            expect(reasonOf(caught)).toBe('MISSING_WHERE')
            expect(causeOf(caught)).toBeInstanceOf(TsSqlProcessingError)
        })
    }

    for (const method of UPDATE_METHODS) {
        test(`${method}-rejects-missing-where`, async () => {
            const caught = await rejectionOf(() => (ctx.conn.update(tIssue).set({ title: 'x' }) as any)[method]())
            expect(caught).toBeInstanceOf(TsSqlQueryExecutionError)
            expect(reasonOf(caught)).toBe('MISSING_WHERE')
            expect(causeOf(caught)).toBeInstanceOf(TsSqlProcessingError)
        })
    }

    for (const method of INSERT_METHODS) {
        test(`${method}-rejects-a-query-that-cannot-be-built`, async () => {
            const caught = await rejectionOf(() => (ctx.conn.insertInto(tIssue).values(disallowedIssue('not allowed') as any) as any)[method]())
            expect(caught).toBeInstanceOf(TsSqlQueryExecutionError)
            expect(reasonOf(caught)).toBe('DISALLOWED')
            expect(causeOf(caught)).toBeInstanceOf(TsSqlProcessingError)
        })

        test(`${method}-rejects-with-the-error-given-to-allow-when`, async () => {
            const applicationError = new ApplicationError('not allowed')
            expect(await rejectionOf(() => (ctx.conn.insertInto(tIssue).values(disallowedIssue(applicationError) as any) as any)[method]())).toBe(applicationError)
        })
    }

    for (const method of SELECT_METHODS) {
        test(`${method}-rejects-a-query-that-cannot-be-built`, async () => {
            const caught = await rejectionOf(() => (disallowedSelect('not allowed') as any)[method]())
            expect(caught).toBeInstanceOf(TsSqlQueryExecutionError)
            expect(reasonOf(caught)).toBe('DISALLOWED')
            expect(causeOf(caught)).toBeInstanceOf(TsSqlProcessingError)
        })

        test(`${method}-rejects-with-the-error-given-to-allow-when`, async () => {
            const applicationError = new ApplicationError('not allowed')
            expect(await rejectionOf(() => (disallowedSelect(applicationError) as any)[method]())).toBe(applicationError)
        })
    }

    test('execute-select-page-with-only-the-count-rejects-a-query-that-cannot-be-built', async () => {
        const caught = await rejectionOf(() => disallowedSelect('not allowed').executeSelectPage({ data: [] }))
        expect(caught).toBeInstanceOf(TsSqlQueryExecutionError)
        expect(reasonOf(caught)).toBe('DISALLOWED')
        expect(causeOf(caught)).toBeInstanceOf(TsSqlProcessingError)
    })

    test('execute-select-page-with-only-the-count-rejects-with-the-error-given-to-allow-when', async () => {
        const applicationError = new ApplicationError('not allowed')
        expect(await rejectionOf(() => disallowedSelect(applicationError).executeSelectPage({ data: [] }))).toBe(applicationError)
    })

    test('a-transform-value-to-db-of-the-application-arrives-as-it-is', async () => {
        const applicationError = new ApplicationError('cannot encode')
        const adapter: TypeAdapter = {
            transformValueFromDB: (value, context, next) => next.transformValueFromDB(value, context),
            transformValueToDB: () => { throw applicationError },
        }
        const caught = await rejectionOf(() => ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(ctx.conn.const(1, 'int', adapter)))
            .select({ id: tProject.id })
            .executeSelectMany())
        expect(caught).toBe(applicationError)
    })

    test('a-transform-placeholder-of-the-application-arrives-as-it-is', async () => {
        const applicationError = new ApplicationError('cannot write the placeholder')
        const adapter: TypeAdapter = {
            transformValueFromDB: (value, context, next) => next.transformValueFromDB(value, context),
            transformValueToDB: (value, context, next) => next.transformValueToDB(value, context),
            transformPlaceholder: () => { throw applicationError },
        }
        const caught = await rejectionOf(() => ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(ctx.conn.const(1, 'int', adapter)))
            .select({ id: tProject.id })
            .executeSelectMany())
        expect(caught).toBe(applicationError)
    })

    test('a-value-the-default-conversion-refuses-is-wrapped', async () => {
        const caught = await rejectionOf(() => ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(ctx.conn.const(1.5, 'int')))
            .select({ id: tProject.id })
            .executeSelectMany())
        expect(caught).toBeInstanceOf(TsSqlQueryExecutionError)
        expect(reasonOf(caught)).toBe('INVALID_VALUE_TO_SEND_TO_DATABASE')
        expect(causeOf(caught)).toBeInstanceOf(TsSqlProcessingError)
    })

    test('query-keeps-throwing-when-it-is-called', () => {
        expect(() => (ctx.conn.deleteFrom(tIssue) as any).query()).toThrow(/MISSING_WHERE/)
    })

    test('a-runner-throwing-when-it-executes-a-select-is-wrapped', async () => {
        const runnerError = new ApplicationError('driver failure')
        class ThrowingRunner extends MockQueryRunner {
            override executeSelectManyRows(): ReturnType<MockQueryRunner['executeSelectManyRows']> { throw runnerError }
        }
        const connection = new DBConnection(new ThrowingRunner(() => []), Number.POSITIVE_INFINITY)
        const caught = await rejectionOf(() => connection.selectFrom(tProject).select({ id: tProject.id }).executeSelectMany())
        expect(caught).toBeInstanceOf(TsSqlQueryExecutionError)
        expect(causeOf(caught)).toBe(runnerError)
    })

    test('a-runner-throwing-when-it-executes-the-count-is-wrapped', async () => {
        const runnerError = new ApplicationError('driver failure')
        class ThrowingRunner extends MockQueryRunner {
            override executeSelectOneColumnOneRow(): ReturnType<MockQueryRunner['executeSelectOneColumnOneRow']> { throw runnerError }
        }
        const connection = new DBConnection(new ThrowingRunner(() => []), Number.POSITIVE_INFINITY)
        const caught = await rejectionOf(() => connection.selectFrom(tProject).select({ id: tProject.id }).executeSelectPage({ data: [] }))
        expect(caught).toBeInstanceOf(TsSqlQueryExecutionError)
        expect(causeOf(caught)).toBe(runnerError)
    })

    test('commit-without-a-transaction-rejects', async () => {
        const caught = await rejectionOf(() => ctx.conn.commit())
        expect(caught).toBeInstanceOf(TsSqlQueryExecutionError)
        expect(reasonOf(caught)).toBe('NOT_IN_TRANSACTION')
    })

    test('rollback-without-a-transaction-rejects', async () => {
        const caught = await rejectionOf(() => ctx.conn.rollback())
        expect(caught).toBeInstanceOf(TsSqlQueryExecutionError)
        expect(reasonOf(caught)).toBe('NOT_IN_TRANSACTION')
    })

    test('begin-transaction-nested-rejects', async () => {
        // MOCK-ONLY: nested transactions are turned off through the injected runner, to get the same answer on every connector.
        ctx.mockOnlyConnection()
        const { conn } = ctx.withFaultInjection({ nestedTransactionsSupported: false })
        await conn.beginTransaction()
        const caught = await rejectionOf(() => conn.beginTransaction())
        expect(caught).toBeInstanceOf(TsSqlQueryExecutionError)
        expect(reasonOf(caught)).toBe('NESTED_TRANSACTION_NOT_SUPPORTED')
    })

    test('transaction-nested-rejects', async () => {
        // MOCK-ONLY: nested transactions are turned off through the injected runner, to get the same answer on every connector.
        ctx.mockOnlyConnection()
        const { conn } = ctx.withFaultInjection({ nestedTransactionsSupported: false })
        await conn.beginTransaction()
        const caught = await rejectionOf(() => conn.transaction(() => undefined))
        expect(caught).toBeInstanceOf(TsSqlQueryExecutionError)
        expect(reasonOf(caught)).toBe('NESTED_TRANSACTION_NOT_SUPPORTED')
    })

    test('commit-with-a-before-commit-hook-throwing-rolls-back-and-rejects', async () => {
        // MOCK-ONLY: it's a connection of its own, without touching the transaction of the real one.
        ctx.mockOnlyConnection()
        const { conn } = ctx.withFaultInjection()
        await conn.beginTransaction()
        const applicationError = new ApplicationError('hook failure')
        conn.executeBeforeNextCommit(() => { throw applicationError })
        const caught = await rejectionOf(() => conn.commit())
        expect(caught).toBeInstanceOf(TsSqlQueryExecutionError)
        expect(reasonOf(caught)).toBe('ERROR_EXECUTING_DEFERRED_IN_TRANSACTION')
        expect(causeOf(caught)).toBe(applicationError)
    })

    test('execute-procedure-rejects-a-call-that-cannot-be-built', async () => {
        const caught = await rejectionOf(() => (ctx.conn as any).executeProcedure('some_procedure', [ctx.conn.const(1, 'int').allowWhen(false, 'not allowed')]))
        expect(caught).toBeInstanceOf(TsSqlQueryExecutionError)
    })

    test('execute-procedure-rejects-with-the-error-given-to-allow-when', async () => {
        const applicationError = new ApplicationError('not allowed')
        const caught = await rejectionOf(() => (ctx.conn as any).executeProcedure('some_procedure', [ctx.conn.const(1, 'int').allowWhen(false, applicationError)]))
        expect(caught).toBe(applicationError)
    })

    test('execute-function-rejects-a-call-that-cannot-be-built', async () => {
        const caught = await rejectionOf(() => (ctx.conn as any).executeFunction('some_function', [ctx.conn.const(1, 'int').allowWhen(false, 'not allowed')], 'int', 'required'))
        expect(caught).toBeInstanceOf(TsSqlQueryExecutionError)
    })

    test('execute-function-rejects-with-the-error-given-to-allow-when', async () => {
        const applicationError = new ApplicationError('not allowed')
        const caught = await rejectionOf(() => (ctx.conn as any).executeFunction('some_function', [ctx.conn.const(1, 'int').allowWhen(false, applicationError)], 'int', 'required'))
        expect(caught).toBe(applicationError)
    })
})
