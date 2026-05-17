// Behavioral coverage of the UPDATE `setIf*` family: setIfValue,
// setIfNotSet, ignoreIfSet. Each mutation runs in a rollback so the seed
// survives between tests.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('set-if-value-drops-null-fields', async () => {
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const newTitle: string | null = 'Updated title'
            const newPriority: number | null = null
            const affected = await ctx.conn.update(tIssue)
                .set({})
                .setIfValue({ title:    newTitle })
                .setIfValue({ priority: newPriority })
                .where(tIssue.id.equals(1))
                .executeUpdate()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set title = :0 where id = :1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Updated title",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('set-if-not-set-honors-prior-set', async () => {
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            // `set` already defines `title`; `setIfNotSet` does NOT override
            // it because title is already set. So title stays "Forced".
            const affected = await ctx.conn.update(tIssue)
                .set({ title: 'Forced' })
                .setIfNotSet({ title: 'Default (ignored)' })
                .where(tIssue.id.equals(1))
                .executeUpdate()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set title = :0 where id = :1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Forced",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('ignore-if-set-removes-prior', async () => {
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.update(tIssue)
                .set({ title: 'Would have changed' })
                .ignoreIfSet('title')
                .setIfNotSet({ title: 'Restored to default' })
                .where(tIssue.id.equals(1))
                .executeUpdate()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set title = :0 where id = :1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Restored to default",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })
})
