// A text of a custom data type is sent as text, whatever it looks like.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tProjectRelease } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('a-text-that-looks-like-a-number-or-a-date-in-equals', async () => {
        for (const value of ['1.2', '12', '2024-01-01', '10:30:00', '2024-01-01 10:30:00']) {
            ctx.mockNext([])

            const rows = await ctx.conn.selectFrom(tProjectRelease)
                .where(tProjectRelease.version.equals(value))
                .select({ id: tProjectRelease.id })
                .executeSelectMany()

            assertType<Exact<typeof rows, Array<{ id: number }>>>()
            expect(rows).toEqual([])
        }
    })

    test('a-text-that-looks-like-a-number-in-in', async () => {
        ctx.mockNext([])

        const rows = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.version.in(['1.2', '12']))
            .select({ id: tProjectRelease.id })
            .executeSelectMany()

        expect(rows).toEqual([])
    })

    test('a-text-that-looks-like-a-number-in-a-filter', async () => {
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)

        const rows = await ctx.conn.selectFrom(tProjectRelease)
            .where(ctx.conn.dynamicConditionFor({ version: tProjectRelease.version }).withValues({ version: { lessThan: '1.2.1', greaterThan: '1.2' } }))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()

        expect(rows).toEqual(expected)
    })
})
