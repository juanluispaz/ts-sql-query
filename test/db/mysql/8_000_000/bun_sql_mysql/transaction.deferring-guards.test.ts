// Coverage of the deferred-hook guards and the nested-transaction hook
// stack in `AbstractConnection`:
//
//   - `executeBeforeNextCommit` called from inside another
//     `executeBeforeNextCommit` callback throws
// NESTED_DEFERRING_IN_TRANSACTION_NOT_SUPPORTED: the
//     before-commit list is drained while the transaction is still
//     active, so the `beforeCommit === null` guard is reachable.
//   - `executeAfterNextCommit` / `executeAfterNextRollback` callbacks run
//     AFTER the transaction has closed, so registering any deferred hook
// from inside them throws NOT_IN_TRANSACTION —
//     the post-transaction reach of that guard, distinct from the
//     "no transaction at all" path other tests cover.
//   - the nested-transaction hook stack `pushTransactionStack` /
// `popTransactionStack`: a nested `transaction(...)` saves
//     the outer transaction's pending hooks, runs the inner one, then
//     restores them — so the outer after-commit hook fires after the
//     inner one.
//   - inside a nested transaction, an after-commit hook that runs while
//     the OUTER transaction is still open cannot register another deferred
//     hook: the active-transaction check passes (the outer is still open),
//     so the `onCommit === null` guard fires (the list is nulled while
//     draining, popped only after) and throws
//     NESTED_DEFERRING_IN_TRANSACTION_NOT_SUPPORTED — distinct from the
//     NOT_IN_TRANSACTION a single transaction hits once it has closed.
//
// The errors thrown from inside a draining hook surface wrapped as
// ERROR_EXECUTING_DEFERRED_IN_TRANSACTION with the original reason in the
// attached chain, so the assertions walk the chain via `reasonsInChain`.
//
// `ctx.withReseed(...)` is used because the body opens its own
// `connection.transaction(...)`.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { QueryExecutionSource, TsSqlError, TsSqlQueryExecutionError } from '../../../../../src/TsSqlError.js'
import { ctx } from './setup.js'

function bodyError(message: string): TsSqlQueryExecutionError {
    return new TsSqlQueryExecutionError(new QueryExecutionSource('test-body'), { reason: 'UNKNOWN' }, message)
}

function reasonsInChain(e: unknown): string[] {
    const out: string[] = []
    const seen = new Set<unknown>()
    const visit = (x: unknown): void => {
        if (!x || typeof x !== 'object' || seen.has(x)) return
        seen.add(x)
        const err = x as { additionalErrors?: unknown[], transactionError?: unknown, cause?: unknown }
        if (x instanceof TsSqlError && x.errorReason?.reason) out.push(x.errorReason.reason)
        err.additionalErrors?.forEach(visit)
        visit(err.transactionError)
        visit(err.cause)
    }
    visit(e)
    return out
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('before-next-commit-inside-before-next-commit-throws-nested-deferring', async () => {
        const connection = ctx.conn
        let caught: unknown
        await ctx.withReseed(async () => {
            try {
                await connection.transaction(async () => {
                    connection.executeBeforeNextCommit(() => {
                        // The before-commit list is nulled while draining,
                        // and the transaction is still active → the
                        // `beforeCommit === null` guard fires.
                        connection.executeBeforeNextCommit(() => { /* unreachable */ })
                    })
                })
            } catch (e) { caught = e }
        })
        expect(reasonsInChain(caught)).toContain('NESTED_DEFERRING_IN_TRANSACTION_NOT_SUPPORTED')
        // The hook throws while the before-commit list is draining, so the
        // error surfaces wrapped as ERROR_EXECUTING_DEFERRED_IN_TRANSACTION
        // (the original reason above is the cause carried in the chain).
        expect(reasonsInChain(caught)).toContain('ERROR_EXECUTING_DEFERRED_IN_TRANSACTION')
    })

    test('deferring-from-inside-after-commit-hook-throws-not-in-transaction', async () => {
        const connection = ctx.conn
        let caught: unknown
        await ctx.withReseed(async () => {
            try {
                await connection.transaction(async () => {
                    connection.executeAfterNextCommit(() => {
                        // After-commit hooks run once the transaction has
                        // closed → no active transaction here.
                        connection.executeAfterNextCommit(() => { /* unreachable */ })
                    })
                })
            } catch (e) { caught = e }
        })
        expect(reasonsInChain(caught)).toContain('NOT_IN_TRANSACTION')
    })

    test('deferring-from-inside-after-rollback-hook-throws-not-in-transaction', async () => {
        const connection = ctx.conn
        let caught: unknown
        await ctx.withReseed(async () => {
            try {
                await connection.transaction(async () => {
                    connection.executeAfterNextRollback(() => {
                        connection.executeAfterNextRollback(() => { /* unreachable */ })
                    })
                    throw bodyError('trigger-rollback')
                })
            } catch (e) { caught = e }
        })
        expect(reasonsInChain(caught)).toContain('NOT_IN_TRANSACTION')
    })

    // Pins the nested-transaction hook-stack behaviour (outer hooks
    // saved and restored across the inner transaction). The matrix
    // runner is built without `allowNestedTransactions`, so a real
    // nested transaction throws NESTED_TRANSACTION_NOT_SUPPORTED.
    test('nested-transaction-preserves-and-restores-outer-after-commit-hook', async () => {
        const connection = ctx.conn
        const events: string[] = []
        let caught: unknown
        await ctx.withReseed(async () => {
            try {
                await connection.transaction(async () => {
                    connection.executeAfterNextCommit(() => { events.push('outer-after-commit') })
                    await connection.transaction(async () => {
                        connection.executeAfterNextCommit(() => { events.push('inner-after-commit') })
                    })
                })
            } catch (e) { caught = e }
        })
        if (ctx.realDbEnabled) {
            // The matrix runner is constructed without allowNestedTransactions,
            // so the real engine rejects the nested transaction.
            expect(reasonsInChain(caught)).toContain('NESTED_TRANSACTION_NOT_SUPPORTED')
        } else {
            // Inner commit fires its hook first; the outer hook, saved on the
            // stack across the nested transaction, fires after the outer commit.
            expect(caught).toBeUndefined()
            expect(events).toEqual(['inner-after-commit', 'outer-after-commit'])
        }
    })

    // Companion to the hook-ordering test above, for the error path: an
    // after-commit hook that runs while an OUTER transaction is still open
    // cannot itself register another deferred hook. The inner after-commit
    // list is nulled while draining and `popTransactionStack` runs AFTER the
    // hooks, so `onCommit === null` and the guard throws
    // NESTED_DEFERRING_IN_TRANSACTION_NOT_SUPPORTED — distinct from the
    // NOT_IN_TRANSACTION a single transaction's after-commit hook hits (there
    // the transaction has already closed, so the active check fails first).
    test('nested-transaction-inner-after-commit-hook-cannot-register-a-hook', async () => {
        const connection = ctx.conn
        const events: string[] = []
        let caught: unknown
        await ctx.withReseed(async () => {
            try {
                await connection.transaction(async () => {
                    connection.executeAfterNextCommit(() => { events.push('outer-after-commit') })
                    await connection.transaction(async () => {
                        connection.executeAfterNextCommit(() => {
                            connection.executeAfterNextCommit(() => { events.push('unreachable') })
                        })
                    })
                })
            } catch (e) { caught = e }
        })
        if (ctx.realDbEnabled) {
            // The matrix runner is constructed without allowNestedTransactions,
            // so the real engine rejects the nested transaction before the inner
            // after-commit hook can run.
            expect(reasonsInChain(caught)).toContain('NESTED_TRANSACTION_NOT_SUPPORTED')
        } else {
            // The inner hook throws while the after-commit list is draining, so
            // the error surfaces wrapped as ERROR_EXECUTING_DEFERRED_IN_TRANSACTION
            // with NESTED_DEFERRING_IN_TRANSACTION_NOT_SUPPORTED in the chain; the
            // aborted outer transaction never runs its own after-commit hook.
            expect(reasonsInChain(caught)).toContain('NESTED_DEFERRING_IN_TRANSACTION_NOT_SUPPORTED')
            expect(reasonsInChain(caught)).toContain('ERROR_EXECUTING_DEFERRED_IN_TRANSACTION')
            expect(events).toEqual([])
        }
    })

    // This connector's query runner cannot enable nested transactions
    // on the real engine, so the nesting-works case can only be validated
    // where the runner supports it (the throw-when-not-enabled case above
    // still runs on the real engine here).
    // NOT-APPLICABLE: this connector's query runner does not support allowNestedTransactions.
    /*
    test('nested-transaction-works-with-allow-nested-transactions-enabled', async () => {
        // Builds a flag-on connection via ctx.nestedTransactionConn() and asserts
        // inner-before-outer after-commit hook order.
    })
    */

    // Same nesting-enabled requirement as the case above: only a runner that
    // supports allowNestedTransactions lets the inner transaction commit and
    // run its after-commit hook while the outer transaction is still open, so
    // the NESTED_DEFERRING guard is only reachable on the real engine there.
    // The ctx.conn variant above still runs on the real engine here.
    // NOT-APPLICABLE: this connector's query runner does not support allowNestedTransactions.
    /*
    test('nested-transaction-inner-after-commit-hook-cannot-register-a-hook-with-allow-nested-transactions-enabled', async () => {
        // Builds a flag-on connection via ctx.nestedTransactionConn() and asserts
        // that registering a hook inside the inner after-commit hook throws
        // NESTED_DEFERRING_IN_TRANSACTION_NOT_SUPPORTED.
    })
    */

    // A real nested transaction cannot be opened on this connector, so the
    // case can only be validated where the runner supports the flag: it runs
    // live on the postgres/pg cells.
    // NOT-APPLICABLE: this connector's query runner does not support allowNestedTransactions.
    /*
    test('nested-transaction-three-levels-deep-unwinds-hooks-innermost-first', async () => {
        // Two levels already exercise saving the outer hooks across ONE
        // nesting; a third level is what pushes onto a stack that is already
        // allocated, and pops leaving it non-empty. The hooks unwind
        // innermost-first as each level commits.
        const connection = ctx.nestedTransactionConn()
        const events: string[] = []
        await connection.transaction(async () => {
            connection.executeAfterNextCommit(() => { events.push('l1') })
            await connection.transaction(async () => {
                connection.executeAfterNextCommit(() => { events.push('l2') })
                await connection.transaction(async () => {
                    connection.executeAfterNextCommit(() => { events.push('l3') })
                })
            })
        })
        expect(events).toEqual(['l3', 'l2', 'l1'])
    })
    */

    test('two-before-commit-hooks-fire-in-registration-order', async () => {
        // The second registration lands on an already-allocated list, which
        // is a different arm from allocating it.
        const connection = ctx.conn
        const events: string[] = []
        await ctx.withReseed(async () => {
            await connection.transaction(async () => {
                connection.executeBeforeNextCommit(() => { events.push('first') })
                connection.executeBeforeNextCommit(() => { events.push('second') })
            })
        })
        expect(events).toEqual(['first', 'second'])
    })

    test('two-after-rollback-hooks-fire-in-registration-order', async () => {
        // Same shape on the after-rollback list: the transaction body throws
        // so both hooks drain, in the order they were registered.
        const connection = ctx.conn
        const events: string[] = []
        let caught: unknown
        await ctx.withReseed(async () => {
            try {
                await connection.transaction(async () => {
                    connection.executeAfterNextRollback(() => { events.push('first') })
                    connection.executeAfterNextRollback(() => { events.push('second') })
                    throw bodyError('roll it back')
                })
            } catch (e) { caught = e }
        })
        expect(events).toEqual(['first', 'second'])
        // The load-bearing part: the BODY's error propagated, so both hooks
        // drained cleanly. A hook that threw would surface instead as
        // ERROR_EXECUTING_DEFERRED_IN_TRANSACTION.
        expect(reasonsInChain(caught)).not.toContain('ERROR_EXECUTING_DEFERRED_IN_TRANSACTION')
    })

    // A real nested transaction cannot be opened on this connector, so the
    // case can only be validated where the runner supports the flag: it runs
    // live on the postgres/pg cells.
    // NOT-APPLICABLE: this connector's query runner does not support allowNestedTransactions.
    /*
    test('nested-transaction-inner-after-rollback-hook-cannot-register-a-hook', async () => {
        // The after-COMMIT analogue of this is covered above. Here the INNER
        // transaction rolls back while the OUTER one is still open, so the
        // after-rollback drain reaches the same guard: the active-transaction
        // check passes (the outer is open) and the list-nulled-while-draining
        // check fires — NESTED_DEFERRING, not the NOT_IN_TRANSACTION a
        // single-level rollback would give.
        const connection = ctx.nestedTransactionConn()
        let caught: unknown
        try {
            await connection.transaction(async () => {
                await connection.transaction(async () => {
                    connection.executeAfterNextRollback(() => {
                        // Never reached: registering from inside the drain is
                        // itself what throws. Deliberately not a block comment,
                        // so the whole test stays safe to comment out on the
                        // cells whose runner cannot nest transactions.
                        connection.executeAfterNextCommit(() => undefined)
                    })
                    throw bodyError('inner rolls back')
                })
            })
        } catch (e) { caught = e }
        expect(reasonsInChain(caught)).toContain('NESTED_DEFERRING_IN_TRANSACTION_NOT_SUPPORTED')
    })
    */

    // A real nested transaction cannot be opened on this connector, so the
    // case can only be validated where the runner supports the flag: it runs
    // live on the postgres/pg cells.
    // NOT-APPLICABLE: this connector's query runner does not support allowNestedTransactions.
    /*
    test('nested-transaction-inner-after-rollback-hook-cannot-register-a-before-commit-hook', async () => {
        // Sibling of the test above with the OTHER registration API: the
        // guard is per deferred-hook kind, so reaching it from the same
        // after-rollback drain via executeBeforeNextCommit is a separate arm.
        const connection = ctx.nestedTransactionConn()
        let caught: unknown
        try {
            await connection.transaction(async () => {
                await connection.transaction(async () => {
                    connection.executeAfterNextRollback(() => {
                        // Never reached, and deliberately not a block comment
                        // so the whole test stays safe to comment out.
                        connection.executeBeforeNextCommit(() => undefined)
                    })
                    throw bodyError('inner rolls back')
                })
            })
        } catch (e) { caught = e }
        expect(reasonsInChain(caught)).toContain('NESTED_DEFERRING_IN_TRANSACTION_NOT_SUPPORTED')
    })
    */

    // A real nested transaction cannot be opened on this connector, so the
    // case can only be validated where the runner supports the flag: it runs
    // live on the postgres/pg cells.
    // NOT-APPLICABLE: this connector's query runner does not support allowNestedTransactions.
    /*
    test('nested-transaction-inner-after-rollback-hook-cannot-register-another-after-rollback-hook', async () => {
        // The third kind: re-registering an after-rollback hook from inside
        // the after-rollback drain itself, with the outer transaction open.
        const connection = ctx.nestedTransactionConn()
        let caught: unknown
        try {
            await connection.transaction(async () => {
                await connection.transaction(async () => {
                    connection.executeAfterNextRollback(() => {
                        // Never reached, and deliberately not a block comment
                        // so the whole test stays safe to comment out.
                        connection.executeAfterNextRollback(() => undefined)
                    })
                    throw bodyError('inner rolls back')
                })
            })
        } catch (e) { caught = e }
        expect(reasonsInChain(caught)).toContain('NESTED_DEFERRING_IN_TRANSACTION_NOT_SUPPORTED')
    })
    */

    test('nested-transaction-inner-after-commit-hook-cannot-register-a-before-commit-hook', async () => {
        // Companion to `nested-transaction-inner-after-commit-hook-cannot-register-a-hook`
        // for the OTHER registration API: the guard is per deferred-hook kind, so
        // reaching it from the same after-commit drain via `executeBeforeNextCommit`
        // is a distinct arm. The inner after-commit list is nulled while draining
        // and `popTransactionStack` runs after the hooks, so `onCommit === null`
        // and `executeBeforeNextCommit` throws NESTED_DEFERRING — not the
        // NOT_IN_TRANSACTION a single transaction's after-commit hook would hit.
        const connection = ctx.conn
        const events: string[] = []
        let caught: unknown
        await ctx.withReseed(async () => {
            try {
                await connection.transaction(async () => {
                    connection.executeAfterNextCommit(() => { events.push('outer-after-commit') })
                    await connection.transaction(async () => {
                        connection.executeAfterNextCommit(() => {
                            // Never reached, and deliberately not a block comment
                            // so the whole test stays safe to comment out.
                            connection.executeBeforeNextCommit(() => { events.push('unreachable') })
                        })
                    })
                })
            } catch (e) { caught = e }
        })
        if (ctx.realDbEnabled) {
            // The matrix runner is constructed without allowNestedTransactions,
            // so the real engine rejects the nested transaction before the inner
            // after-commit hook can run.
            expect(reasonsInChain(caught)).toContain('NESTED_TRANSACTION_NOT_SUPPORTED')
        } else {
            expect(reasonsInChain(caught)).toContain('NESTED_DEFERRING_IN_TRANSACTION_NOT_SUPPORTED')
            expect(reasonsInChain(caught)).toContain('ERROR_EXECUTING_DEFERRED_IN_TRANSACTION')
            expect(events).toEqual([])
        }
    })
})
