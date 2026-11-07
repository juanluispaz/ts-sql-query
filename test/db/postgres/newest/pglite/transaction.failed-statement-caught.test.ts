// On PostgreSQL a statement that fails inside a transaction leaves the transaction failed, even when the error is
// caught: the database answers the commit with ROLLBACK. connection.transaction(...) rejects with TRANSACTION_ERROR
// ('transaction rolled back'), with the error of the statement that failed as the cause of its cause, nothing is
// saved, and the after-rollback functions run instead of the after-commit ones. The same with every PostgreSQL query
// runner. In mock mode the statement doesn't fail, and the transaction commits.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { TsSqlError } from '../../../../../src/TsSqlError.js'
import { tCountry, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

function errorReasonOf(error: unknown): unknown {
    return error instanceof TsSqlError ? error.errorReason : undefined
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('transaction/failed-statement-caught-inside-a-transaction', async () => {
        const connection = ctx.conn
        const events: string[] = []
        let caught: unknown
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(0)

        await ctx.withReseed(async () => {
            try {
                await connection.transaction(async () => {
                    connection.executeAfterNextCommit(() => { events.push('after commit') })
                    connection.executeAfterNextRollback(() => { events.push('after rollback') })
                    await connection.insertInto(tProject).set({ name: 'Rolled back', slug: 'rolled-back', organizationId: 1 }).executeInsert()
                    try {
                        // The country US already exists
                        await connection.insertInto(tCountry).set({ code: 'US', name: 'Again', region: 'Americas' }).executeInsert()
                    } catch {
                        events.push('caught')
                    }
                })
            } catch (e) {
                caught = e
            }

            const saved = await connection.selectFrom(tProject)
                .where(tProject.slug.equals('rolled-back'))
                .selectCountAll()
                .executeSelectOne()

            if (ctx.realDbEnabled) {
                expect(errorReasonOf(caught)).toEqual({ reason: 'TRANSACTION_ERROR', transactionErrorType: 'transaction rolled back' })
                // The cause of the transaction error is the rollback, whose cause is the error of the driver
                const rollback = caught instanceof TsSqlError ? caught.cause : undefined
                const statementError = rollback instanceof TsSqlError ? rollback.cause : undefined
                expect(connection.queryRunner.getErrorReason(statementError)).toMatchObject({ reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'unique' })
                expect(events).toEqual(['caught', 'after rollback'])
                expect(saved).toBe(0)
            } else {
                expect(caught).toBeUndefined()
                expect(events).toEqual(['after commit'])
                expect(saved).toBe(0)
            }
        })
    })
})
