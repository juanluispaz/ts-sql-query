// Coverage of `connection.updateAllowingNoWhere(...)`
// the explicit opt-in that lets an UPDATE reach the driver without a
// WHERE clause. The regular `connection.update(...)` throws when the
// sentence ends without a WHERE (the safety guard documented in
// docs/queries/update.md); `updateAllowingNoWhere` relaxes that guard.
//
// Both tests mutate, so they run inside `ctx.withRollback(...)` — the
// no-WHERE UPDATE touches every seeded issue and the rollback keeps the
// cell clean. The seeded issues all have `parent_id` NULL and `status`
// is a plain column, so updating all rows trips no FK constraint on any
// engine.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('update-allowing-no-where-touches-all-rows', async () => {
        // No WHERE at all: the sentence would be rejected by the regular
        // `update(...)` path; `updateAllowingNoWhere` lets it through and
        // every seeded issue is updated.
        ctx.mockNext(4)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.updateAllowingNoWhere(tIssue)
                .set({ status: 'archived' })
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set \`status\` = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "archived",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(4)
        })
    })

    test('update-allowing-no-where-still-honors-a-supplied-where', async () => {
        // The "allowing" variant only relaxes the guard — supplying a
        // WHERE is still valid and emits the predicate as usual.
        ctx.mockNext(4)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.updateAllowingNoWhere(tIssue)
                .set({ status: 'archived' })
                .where(tIssue.priority.greaterOrEqual(1))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set \`status\` = ? where priority >= ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "archived",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(4)
        })
    })

    test('update-allowing-no-where-dynamic-set-touches-all-rows', async () => {
        // `dynamicSet({...})` on the allowing-no-where builder is executable
        // with no WHERE, so it updates every seeded issue. The paired
        // `.set({...})` form is built but not executed — its query and params
        // are compared instead.
        ctx.mockNext(4)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.updateAllowingNoWhere(tIssue)
                .dynamicSet({ status: 'archived' })
                .executeUpdate()
            const dynamicSql = ctx.lastSql
            const dynamicParams = ctx.lastParams

            const viaSet = ctx.conn.updateAllowingNoWhere(tIssue).set({ status: 'archived' })
            expect(viaSet.query()).toBe(dynamicSql)
            expect(viaSet.params()).toEqual(dynamicParams)

            expect(dynamicSql).toMatchInlineSnapshot(`"update issue set \`status\` = ?"`)
            expect(dynamicParams).toMatchInlineSnapshot(`
              [
                "archived",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(4)
        })
    })

    test('update-allowing-no-where-set-if-value-skips-empty-and-touches-all-rows', async () => {
        // `setIfValue({...})` on the allowing-no-where builder needs no WHERE.
        // The value gate drops `body: undefined`, so only `status` reaches the
        // SET clause; with no WHERE every seeded issue is updated.
        ctx.mockNext(4)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.updateAllowingNoWhere(tIssue)
                .setIfValue({ status: 'archived', body: undefined })
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set \`status\` = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "archived",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(4)
        })
    })
})
