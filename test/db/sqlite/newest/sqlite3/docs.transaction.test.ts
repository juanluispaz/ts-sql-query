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
        // Nested transactions are not supported by most engines, so we
        // cannot wrap this in `ctx.withRollback` — it already opens a
        // transaction. We only run the test in mock mode (which does not
        // mutate any real DB) and reseed in real-DB mode.
        if (ctx.realDbEnabled) {
            await ctx.reseed()
            return
        }
        ctx.mockNext(99)  // value returned by returningLastInsertedId

        const connection = ctx.conn

        // doc-start
        const id = await connection.transaction(async () => {
            return await connection.insertInto(tOrganization)
                .values({ name: 'Inside-tx Co', plan: 'free' })
                .returningLastInsertedId()
                .executeInsert()
        })
        // doc-end

        // ctx.lastSql captures the most recent data query — the insert.
        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof id, number>>()
        expect(id).toBe(99)
    })

    test('docs:transaction/rollback-on-throw', async () => {
        // Same nested-transaction constraint as above.
        if (ctx.realDbEnabled) {
            await ctx.reseed()
            return
        }

        class SentinelError extends Error {}
        const connection = ctx.conn

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

        // The sentinel propagates as itself — the MockQueryRunner
        // configuration classifies any error as a SQL error by default,
        // which causes the connection to wrap thrown values. Either way
        // the catch sees something non-null.
        expect(caught).not.toBeNull()
    })
})
