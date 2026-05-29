// Coverage of `connection.deleteAllowingNoWhereFrom(...)`
// ([AbstractConnection.ts:425](../../../../../src/connections/AbstractConnection.ts#L425)):
// the explicit opt-in that lets a DELETE reach the driver without a
// WHERE clause. The regular `connection.deleteFrom(...)` throws when the
// sentence ends without a WHERE (the safety guard documented in
// docs/queries/delete.md); `deleteAllowingNoWhereFrom` relaxes that guard.
//
// Both tests mutate, so they run inside `ctx.withRollback(...)`. The
// no-WHERE DELETE removes every seeded issue; the seeded issues all have
// `parent_id` NULL and nothing else references `issue`, so deleting all
// rows trips no FK constraint on any engine.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('delete-allowing-no-where-removes-all-rows', async () => {
        // No WHERE at all: the sentence would be rejected by the regular
        // `deleteFrom(...)` path; `deleteAllowingNoWhereFrom` lets it
        // through and every seeded issue is removed.
        ctx.mockNext(4)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.deleteAllowingNoWhereFrom(tIssue)
                .executeDelete()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
            assertType<Exact<typeof affected, number>>()
            if (!ctx.realDbEnabled) expect(affected).toBe(4)
        })
    })

    test('delete-allowing-no-where-still-honors-a-supplied-where', async () => {
        // The "allowing" variant only relaxes the guard — supplying a
        // WHERE is still valid and emits the predicate as usual.
        ctx.mockNext(4)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.deleteAllowingNoWhereFrom(tIssue)
                .where(tIssue.priority.greaterOrEqual(1))
                .executeDelete()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where priority >= :0"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (!ctx.realDbEnabled) expect(affected).toBe(4)
        })
    })
})
