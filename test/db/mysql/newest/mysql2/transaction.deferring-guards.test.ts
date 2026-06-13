// Coverage of the deferred-hook guards and the nested-transaction hook
// stack in AbstractConnection (src/connections/AbstractConnection.ts):
//
//   - `executeBeforeNextCommit` called from inside another
//     `executeBeforeNextCommit` callback throws
//     NESTED_DEFERRING_IN_TRANSACTION_NOT_SUPPORTED (L154-155): the
//     before-commit list is drained while the transaction is still
//     active, so the `beforeCommit === null` guard is reachable.
//   - `executeAfterNextCommit` / `executeAfterNextRollback` callbacks run
//     AFTER the transaction has closed, so registering any deferred hook
//     from inside them throws NOT_IN_TRANSACTION (L145 / L166 / L184) —
//     the post-transaction reach of that guard, distinct from the
//     "no transaction at all" path other tests cover.
//   - the nested-transaction hook stack `pushTransactionStack` /
//     `popTransactionStack` (L79-139): a nested `transaction(...)` saves
//     the outer transaction's pending hooks, runs the inner one, then
//     restores them — so the outer after-commit hook fires after the
//     inner one.
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

    // Nested `transaction(...)` requires the runner to report
    // `nestedTransactionsSupported() === true`. The MockQueryRunner does;
    // among real connectors only pg/pglite do, and only when constructed
    // with `allowNestedTransactions` (the matrix runners don't set it). The
    // mysql2 runner does NOT, so a real nested transaction throws
    // NESTED_TRANSACTION_NOT_SUPPORTED — asserted here in real mode. In mock
    // mode the same body pins the push/pop hook-stack ordering.
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
            // The real mysql2 runner rejects the nested transaction.
            expect(reasonsInChain(caught)).toContain('NESTED_TRANSACTION_NOT_SUPPORTED')
        } else {
            // Inner commit fires its hook first; the outer hook, saved on the
            // stack across the nested transaction, fires after the outer commit.
            expect(caught).toBeUndefined()
            expect(events).toEqual(['inner-after-commit', 'outer-after-commit'])
        }
    })

    // Only the pg / pglite connectors (PgPoolQueryRunner / PgLiteQueryRunner) can enable
    // SAVEPOINT-based nesting on the real engine; this connector's runner cannot, so the
    // nesting-works case is validated in the pg/pglite cells (the throw-when-not-enabled
    // case above still runs on the real engine here).
    // NOT-APPLICABLE: this connector's query runner does not support allowNestedTransactions.
    /*
    test('nested-transaction-works-with-allow-nested-transactions-enabled', async () => {
        // Builds a flag-on connection via ctx.nestedTransactionConn() and asserts
        // inner-before-outer after-commit hook order; see the pg / pglite cells.
    })
    */
})
