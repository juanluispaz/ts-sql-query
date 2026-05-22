// Low-level transaction API on
// [AbstractConnection.ts](../../../../../src/connections/AbstractConnection.ts):
// `beginTransaction()` / `commit()` / `rollback()` exposed directly
// rather than wrapped by the high-level `transaction(callback)`
// helper covered in `docs.transaction.test.ts`.
//
// `docs.transaction.test.ts` already pins:
//   - `connection.beginTransaction()` → INSERT → `commit()` (the
//     happy path on the docs page);
//   - deferred-hook registration outside a transaction throwing
//     `NOT_IN_TRANSACTION`.
//
// This file fills the remaining low-level surface that's reachable
// from user code but does not appear on the docs page:
//
//   - `rollback()` after a real INSERT actually undoes the insert
//     (asserted by a follow-up COUNT outside the rolled-back
//     transaction).
//   - `commit()` followed by another `commit()` or `rollback()` on
//     the now-closed transaction fails with `NOT_IN_TRANSACTION`.
//   - `executeBeforeNextCommit` / `executeAfterNextCommit` hooks
//     registered against a low-level managed transaction fire at
//     the right boundary (the high-level helper exercises the
//     same path but obscures the manual `commit()` step).
//   - `executeAfterNextRollback` fires when the rollback is the
//     user's explicit `connection.rollback()` call (not an exception
//     bubbling out of `transaction(...)`).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { tOrganization } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('low-level-rollback-undoes-insert', async () => {
        // Insert a sentinel inside a manually-managed transaction,
        // then `rollback()`. Asserts the row is not visible
        // afterward — pins the rollback wiring through
        // `queryRunner.executeRollback` and the `popTransactionStack`
        // path on [AbstractConnection.ts:L372-L408](../../../../../src/connections/AbstractConnection.ts#L372).
        // Mock-mode: the seeded count (2 organizations) is returned
        // by `mockNext`. Real-DB: the actual COUNT runs and proves
        // the rollback was honoured.
        const connection = ctx.conn

        // Two mock returns: one for the INSERT inside the
        // transaction, one for the COUNT after the rollback.
        ctx.mockNext(99)
        ctx.mockNext(2)

        await ctx.withReseed(async () => {
            await connection.beginTransaction()
            try {
                await connection.insertInto(tOrganization)
                    .values({ name: 'About to roll back', plan: 'free' })
                    .returningLastInsertedId()
                    .executeInsert()
            } finally {
                await connection.rollback()
            }

            const remaining = await connection.selectFrom(tOrganization)
                .selectOneColumn(connection.count(tOrganization.id))
                .executeSelectOne()

            // Seed has 2 organizations. The rolled-back insert must
            // not show up.
            expect(remaining).toBe(2)
        })
    })

    test('low-level-double-commit-throws-not-in-transaction', async () => {
        // After a clean `commit()` the transaction is closed.
        // Calling `commit()` (or `rollback()`) again must surface
        // `NOT_IN_TRANSACTION` — the runtime guard on
        // [AbstractConnection.ts:L303-L304](../../../../../src/connections/AbstractConnection.ts#L303)
        // and the matching one in `rollback()`. The same guard fires
        // in both mock and real-DB mode because
        // [MockQueryRunner](../../../../../src/queryRunners/MockQueryRunner.ts)
        // now tracks transaction depth unconditionally, so
        // `isTransactionActive()` reports `false` after the clean
        // commit on either runner.
        const connection = ctx.conn

        await ctx.withReseed(async () => {
            await connection.beginTransaction()
            await connection.commit()

            let caught: unknown
            try {
                await connection.commit()
            } catch (e) {
                caught = e
            }
            expect(String(caught)).toMatch(/NOT_IN_TRANSACTION|no open transaction/i)

            let caught2: unknown
            try {
                await connection.rollback()
            } catch (e) {
                caught2 = e
            }
            expect(String(caught2)).toMatch(/NOT_IN_TRANSACTION|no open transaction/i)
        })
    })

    test('low-level-before-and-after-commit-hooks-fire-on-explicit-commit', async () => {
        // Hooks registered after `beginTransaction()` and before
        // the explicit `commit()`. `executeBeforeNextCommit` runs
        // synchronously inside `commit()` (before the COMMIT SQL),
        // `executeAfterNextCommit` runs once the commit succeeds.
        // The order they observe must be: beforeCommit → COMMIT →
        // afterCommit.
        const connection = ctx.conn
        const order: string[] = []

        await ctx.withReseed(async () => {
            await connection.beginTransaction()
            try {
                connection.executeBeforeNextCommit(() => {
                    order.push('beforeCommit')
                })
                connection.executeAfterNextCommit(() => {
                    order.push('afterCommit')
                })
                await connection.commit()
                order.push('commitReturned')
            } catch (e) {
                await connection.rollback()
                throw e
            }
        })

        expect(order).toEqual(['beforeCommit', 'afterCommit', 'commitReturned'])
    })

    test('low-level-after-rollback-hook-fires-on-explicit-rollback', async () => {
        // `executeAfterNextRollback` registered against a
        // low-level managed transaction must fire when the user
        // calls `rollback()` explicitly — the same hook path that
        // the high-level `transaction(...)` triggers when its body
        // throws. The hook receives the rollback's source error
        // when one was passed; here we call `rollback()` directly
        // with no error, so the hook just observes the rollback
        // happened.
        const connection = ctx.conn
        const order: string[] = []

        await ctx.withReseed(async () => {
            await connection.beginTransaction()
            connection.executeAfterNextRollback(() => {
                order.push('afterRollback')
            })
            await connection.rollback()
            order.push('rollbackReturned')
        })

        expect(order).toEqual(['afterRollback', 'rollbackReturned'])
    })
})
