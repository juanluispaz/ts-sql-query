// Documentation snippets for the Transaction page
// (docs/queries/transaction.md). Demonstrates the `connection.transaction`
// helper: an explicit commit on success, an explicit rollback if the
// body throws.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tOrganization } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:transaction/commit-on-success', async () => {
        ctx.mockNext(99)  // value returned by returningLastInsertedId in mock mode

        const connection = ctx.conn

        // `ctx.withReseed` runs the body without an outer transaction
        // (the body opens its own via `connection.transaction(...)`)
        // and reseeds in real-DB mode on exit so the committed insert
        // doesn't leak into the next test.
        await ctx.withReseed(async () => {
            // doc-start
            const id = await connection.transaction(async () => {
                return await connection.insertInto(tOrganization)
                    .values({ name: 'Inside-tx Co', plan: 'free' })
                    .returningLastInsertedId()
                    .executeInsert()
            })
            // doc-end

            // After a `connection.transaction(...)` block `ctx.lastSql`
            // would show `"commit"` (the synthetic entry the interceptor
            // emits via the empty-query fallback). `lastNoTransactionSql`
            // skips transaction-control ops so the assertion lands on the
            // insert in both mock and real-DB mode.
            expect(ctx.lastNoTransactionSql).toMatchInlineSnapshot(`"insert into organization (name, "plan") values (?, ?) returning id"`)
            expect(ctx.lastNoTransactionParams).toMatchInlineSnapshot(`
              [
                "Inside-tx Co",
                "free",
              ]
            `)
            assertType<Exact<typeof id, number>>()
            // Mock mode: returns the primed 99. Real-DB mode: the seed
            // reserves ids 1 and 2, so the new row's id is > 2.
            if (ctx.realDbEnabled) expect(id).toBeGreaterThan(2)
            else expect(id).toBe(99)
        })
    })

    test('docs:transaction/rollback-on-throw', async () => {
        class SentinelError extends Error {}
        const connection = ctx.conn

        // The body throws before any work — the library rolls back the
        // transaction automatically. `withReseed` still resets the
        // baseline on the way out, mirroring `commit-on-success` for
        // symmetry (and protecting against any side-effect a future
        // edit of this test might introduce).
        await ctx.withReseed(async () => {
            // doc-start
            let caught: unknown = null
            try {
                await connection.transaction(async () => {
                    // Throw before any work; transaction must roll back.
                    throw new SentinelError('aborted')
                })
            } catch (e) {
                caught = e
            }
            // doc-end

            expect(caught).not.toBeNull()
        })
    })
})
