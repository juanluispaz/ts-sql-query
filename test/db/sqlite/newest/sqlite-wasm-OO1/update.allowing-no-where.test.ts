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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set status = ?"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set status = ? where priority >= ?"`)
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
})
