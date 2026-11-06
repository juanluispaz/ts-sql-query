// The maximum of rows of an execute method is checked also without a minimum.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('execute-update-with-only-a-maximum-fails-when-exceeded', async () => {
        ctx.mockNext(4)
        await ctx.withRollback(async () => {
            await expect(ctx.conn.update(tIssue).set({ status: 'z' }).where(tIssue.id.greaterThan(0)).executeUpdate(undefined, 1))
                .rejects.toMatchObject({ errorReason: { reason: 'MAXIMUM_ROWS_EXCEEDED', count: 4, max: 1 } })
        })
    })

    test('execute-update-with-only-a-maximum-passes-when-not-exceeded', async () => {
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.update(tIssue).set({ status: 'z' }).where(tIssue.id.equals(1)).executeUpdate(undefined, 1)
            expect(affected).toBe(1)
        })
    })

    test('execute-delete-with-only-a-maximum-fails-when-exceeded', async () => {
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await expect(ctx.conn.deleteFrom(tIssue).where(tIssue.id.equals(4)).executeDelete(undefined, 0))
                .rejects.toMatchObject({ errorReason: { reason: 'MAXIMUM_ROWS_EXCEEDED', count: 1, max: 0 } })
        })
    })

    test('execute-insert-with-only-a-maximum-fails-when-exceeded', async () => {
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            await expect(ctx.conn.insertInto(tIssue)
                .values([
                    { projectId: 1, number: 100, title: 'a', status: 'open', priority: 1 },
                    { projectId: 1, number: 101, title: 'b', status: 'open', priority: 1 },
                ])
                .executeInsert(undefined, 1))
                .rejects.toMatchObject({ errorReason: { reason: 'MAXIMUM_ROWS_EXCEEDED', count: 2, max: 1 } })
        })
    })
})
