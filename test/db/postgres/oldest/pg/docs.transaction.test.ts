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
            expect(ctx.lastNoTransactionSql).toMatchInlineSnapshot(`"insert into organization (name, plan) values ($1, $2) returning id"`)
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

    test('docs:transaction/low-level-begin-commit', async () => {
        // Section "Low-level transaction management" — `beginTransaction`,
        // `commit`, `rollback` give explicit control instead of the
        // high-level `.transaction(async () => {...})` helper.
        const connection = ctx.conn

        await ctx.withReseed(async () => {
            // doc-start
            await connection.beginTransaction()
            try {
                await connection.insertInto(tOrganization)
                    .values({ name: 'Initech', plan: 'free' })
                    .returningLastInsertedId()
                    .executeInsert()
                await connection.commit()
            } catch (e) {
                await connection.rollback()
                throw e
            }
            // doc-end

            // The history includes the synthetic begin/commit entries
            // plus the actual INSERT (asserted via lastNoTransactionSql
            // since `commit` is the most recent capture).
            expect(ctx.lastNoTransactionSql).toMatchInlineSnapshot(`"insert into organization (name, plan) values ($1, $2) returning id"`)
        })
    })

    test('docs:transaction/isolation-level', async () => {
        // Section "Transaction isolation": the isolation level AND the access
        // mode can be combined in a single `connection.isolationLevel(level,
        // mode)` argument to `.transaction(...)`. Dialects that support the
        // combination run this test; the rest keep it commented out for
        // symmetry.
        ctx.mockNext(1)
        const connection = ctx.conn

        await ctx.withReseed(async () => {
            // doc-start
            const result = await connection.transaction(async () => {
                return await connection.selectFromNoTable()
                    .selectOneColumn(connection.const(1, 'int'))
                    .executeSelectOne()
            }, connection.isolationLevel('serializable', 'read only'))
            // doc-end

            // Both parts are carried through: the combined opts pair, and a
            // real read-only serializable transaction that actually ran.
            expect(ctx.lastTransactionOpts).toEqual(['serializable', 'read only'])
            expect(result).toBe(1)
        })
    })

    test('docs:transaction/execute-before-next-commit', async () => {
        // Section "Deferring logic during a transaction" —
        // `executeBeforeNextCommit` runs the hook just before commit.
        const connection = ctx.conn
        let fired = false

        await ctx.withReseed(async () => {
            // doc-start
            await connection.transaction(async () => {
                connection.executeBeforeNextCommit(() => {
                    fired = true
                })
            })
            // doc-end
        })

        expect(fired).toBe(true)
    })

    test('docs:transaction/execute-after-next-commit', async () => {
        // `executeAfterNextCommit` runs the hook only after a successful
        // commit.
        const connection = ctx.conn
        let fired = false

        await ctx.withReseed(async () => {
            await connection.transaction(async () => {
                connection.executeAfterNextCommit(() => {
                    fired = true
                })
            })
        })

        expect(fired).toBe(true)
    })

    test('docs:transaction/execute-after-next-rollback', async () => {
        // `executeAfterNextRollback` runs the hook only after a rollback.
        const connection = ctx.conn
        let fired = false

        await ctx.withReseed(async () => {
            try {
                await connection.transaction(async () => {
                    connection.executeAfterNextRollback(() => {
                        fired = true
                    })
                    throw new Error('roll me back')
                })
            } catch { /* swallow */ }
        })

        expect(fired).toBe(true)
    })

    test('docs:transaction/get-transaction-metadata', async () => {
        // Section "Transaction metadata" — `getTransactionMetadata()`
        // returns a `Map<unknown, unknown>` scoped to the current
        // transaction.
        const connection = ctx.conn

        await ctx.withReseed(async () => {
            // doc-start
            const stored = await connection.transaction(async () => {
                connection.getTransactionMetadata().set('my key', 'my value')
                return connection.getTransactionMetadata().get('my key')
            })
            // doc-end
            expect(stored).toBe('my value')
        })
    })

    test('docs-extra:transaction/hooks-no-effect-without-transaction', async () => {
        // "Note" on the page: deferred-hook registration outside a
        // transaction throws `NOT_IN_TRANSACTION`. The guard now fires
        // uniformly in mock and real-DB mode: the lenient mock
        // short-circuit that used to silence it (`isMocked()` skipping
        // the check) has been removed. Transaction depth is tracked
        // internally and `AbstractConnection` consults
        // `isTransactionActive()` directly.
        const connection = ctx.conn

        expect(() => connection.executeBeforeNextCommit(() => { /* */ })).toThrow(/NOT_IN_TRANSACTION/)
        expect(() => connection.executeAfterNextCommit(() => { /* */ })).toThrow(/NOT_IN_TRANSACTION/)
        expect(() => connection.executeAfterNextRollback(() => { /* */ })).toThrow(/NOT_IN_TRANSACTION/)
    })

    test('docs-extra:transaction/hooks-cleared-after-use', async () => {
        // "Note" on the page: hooks are registered for the NEXT
        // transaction event and cleared after use — a subsequent
        // transaction does not re-fire them.
        const connection = ctx.conn
        let count = 0

        await ctx.withReseed(async () => {
            await connection.transaction(async () => {
                connection.executeAfterNextCommit(() => { count += 1 })
            })
            await connection.transaction(async () => {
                // no hook registered here — count must stay at 1.
            })
        })

        expect(count).toBe(1)
    })

    test('docs-extra:transaction/before-commit-not-fired-on-rollback', async () => {
        // "Deferring logic" section: the hooks "only run if the transaction
        // reaches a specific outcome (commit or rollback)".
        // `executeBeforeNextCommit` is a commit-only hook — when the body
        // throws and the transaction rolls back, it must NOT fire. The
        // after-rollback hook is the positive control proving the rollback
        // outcome was actually reached.
        const connection = ctx.conn
        let beforeCommitFired = false
        let rollbackFired = false

        await ctx.withReseed(async () => {
            try {
                await connection.transaction(async () => {
                    connection.executeBeforeNextCommit(() => { beforeCommitFired = true })
                    connection.executeAfterNextRollback(() => { rollbackFired = true })
                    throw new Error('roll me back')
                })
            } catch { /* swallow */ }
        })

        expect(rollbackFired).toBe(true)
        expect(beforeCommitFired).toBe(false)
    })

    test('docs-extra:transaction/after-commit-not-fired-on-rollback', async () => {
        // Companion for `executeAfterNextCommit`: a rolled-back transaction
        // never runs the after-commit hook. Again the after-rollback hook is
        // the positive control for the outcome reached.
        const connection = ctx.conn
        let afterCommitFired = false
        let rollbackFired = false

        await ctx.withReseed(async () => {
            try {
                await connection.transaction(async () => {
                    connection.executeAfterNextCommit(() => { afterCommitFired = true })
                    connection.executeAfterNextRollback(() => { rollbackFired = true })
                    throw new Error('roll me back')
                })
            } catch { /* swallow */ }
        })

        expect(rollbackFired).toBe(true)
        expect(afterCommitFired).toBe(false)
    })

    test('docs-extra:transaction/after-rollback-not-fired-on-commit', async () => {
        // The inverse: `executeAfterNextRollback` is a rollback-only hook, so
        // a transaction that commits cleanly must NOT run it. The after-commit
        // hook is the positive control proving the commit outcome was reached.
        const connection = ctx.conn
        let afterRollbackFired = false
        let commitFired = false

        await ctx.withReseed(async () => {
            await connection.transaction(async () => {
                connection.executeAfterNextCommit(() => { commitFired = true })
                connection.executeAfterNextRollback(() => { afterRollbackFired = true })
            })
        })

        expect(commitFired).toBe(true)
        expect(afterRollbackFired).toBe(false)
    })

    test('docs-extra:transaction/before-commit-throw-aborts-commit-and-triggers-rollback', async () => {
        // `executeBeforeNextCommit` runs "just before the commit". Because it
        // runs while the transaction is still open, throwing from it aborts
        // the commit: the transaction rolls back instead, the after-rollback
        // hook fires, and the after-commit hook does not. The thrown error
        // surfaces to the caller of `transaction(...)`.
        const connection = ctx.conn
        const events: string[] = []
        let caught: unknown

        await ctx.withReseed(async () => {
            try {
                await connection.transaction(async () => {
                    connection.executeBeforeNextCommit(() => {
                        events.push('before-commit')
                        throw new Error('veto the commit')
                    })
                    connection.executeAfterNextCommit(() => { events.push('after-commit') })
                    connection.executeAfterNextRollback(() => { events.push('after-rollback') })
                })
            } catch (e) { caught = e }
        })

        expect((caught as Error).message).toContain('veto the commit')
        // after-commit absent → the commit was aborted; after-rollback present
        // → the transaction rolled back instead.
        expect(events).toEqual(['before-commit', 'after-rollback'])
    })

    test('docs-extra:transaction/async-hooks-are-awaited', async () => {
        // The page: each hook "accepts either a synchronous function (`() =>
        // void`) or an asynchronous one (`() => Promise<void>`)". An async
        // hook's promise is awaited before the surrounding transaction call
        // resolves — so a hook that defers its write across a microtask still
        // completes in time. Covers the before-commit and after-commit hooks
        // on a committing transaction and the after-rollback hook on a
        // rolling-back one.
        const connection = ctx.conn
        const order: string[] = []

        await ctx.withReseed(async () => {
            await connection.transaction(async () => {
                connection.executeBeforeNextCommit(async () => {
                    await Promise.resolve()
                    order.push('before-commit')
                })
                connection.executeAfterNextCommit(async () => {
                    await Promise.resolve()
                    order.push('after-commit')
                })
            })

            let rolledBack = false
            try {
                await connection.transaction(async () => {
                    connection.executeAfterNextRollback(async () => {
                        await Promise.resolve()
                        rolledBack = true
                    })
                    throw new Error('roll me back')
                })
            } catch { /* swallow */ }

            expect(rolledBack).toBe(true)
        })

        expect(order).toEqual(['before-commit', 'after-commit'])
    })

    test('docs-extra:transaction/metadata-throws-without-transaction', async () => {
        // "Transaction metadata" section: `getTransactionMetadata()` is scoped
        // to the current transaction. Called with no active transaction it
        // throws `NOT_IN_TRANSACTION` — the same guard the deferred-hook
        // registrars enforce (see hooks-no-effect-without-transaction above).
        const connection = ctx.conn
        expect(() => connection.getTransactionMetadata()).toThrow(/NOT_IN_TRANSACTION/)
    })

    test('docs-extra:transaction/metadata-not-shared-between-transactions', async () => {
        // The metadata map is per-transaction: a value stored in one
        // transaction is gone in the next (the map is cleared when the
        // transaction closes), mirroring "registered only for the next
        // transaction" for the deferred hooks.
        const connection = ctx.conn
        let secondHasKey = true

        await ctx.withReseed(async () => {
            await connection.transaction(async () => {
                connection.getTransactionMetadata().set('my key', 'my value')
            })
            await connection.transaction(async () => {
                secondHasKey = connection.getTransactionMetadata().has('my key')
            })
        })

        expect(secondHasKey).toBe(false)
    })
})
