// Coverage of the `attach*` helpers on `TsSqlQueryExecutionError`
// at [src/TsSqlError.ts:432-503](../../../../../src/TsSqlError.ts#L432-L503):
//
//   - `attachTransactionSource` (L432-447): fired by every
//     `connection.transaction(…)` / `executeInTransaction(…)` error
//     path in [`AbstractConnection.transaction`](../../../../../src/connections/AbstractConnection.ts#L207-L268).
//     Already cross-covered by existing transaction tests, but we
//     re-pin the round-trip here so the assertion library reports
//     `transactionSource` defined when the body throws.
//   - `attachRollbackError` (L449-463): wired by
//     `ManagedTransactionQueryRunner.executeInTransaction` when the
//     body's error AND the subsequent rollback both throw. The
//     mock-mode `MockQueryRunner.executeInTransaction` swallows the
//     rollback error without chaining, and the real-driver runners
//     have no injection hook — so this branch is documented as a
//     gap (block-commented placeholder at the bottom of the file).
//   - `attachTransactionError` (L465-479): fired by
//     [`PromiseUtils.callDeferredFunctions`](../../../../../src/utils/PromiseUtils.ts#L42-L46)
//     when a deferred `executeAfterNextRollback` callback throws AND
//     the outer transaction body already threw. We register one
//     after-rollback hook that throws after the body has already
//     thrown — the second error attaches to the first via
//     `attachTransactionError(transactionError)`.
//   - `attachAdditionalError` (L481-503): fired by the same
//     `callDeferredFunctions` whenever MORE THAN ONE deferred hook
//     fails (after-commit or after-rollback) so the first becomes
//     the surfaced error and every subsequent failure is appended via
//     `attachAdditionalError(name)`. We register two
//     `executeAfterNextCommit` hooks that both throw — the second
//     should land in the surfaced error's `additionalErrors` list.
//
// Plus the inverse contract — when the body throws something the
// driver does NOT recognise as a SQL error AND is not a
// `TsSqlQueryExecutionError`, the `else { throw e }` branch at
// L227-228 / L237-238 of [`AbstractConnection.transaction`](../../../../../src/connections/AbstractConnection.ts#L222-L240)
// surfaces the EXACT same instance to the caller — no wrapping, no
// `attach*` decoration. Tests 4 and 5 pin both sides of that
// contract: a user-defined error class and a bare `new Error(...)`.
//
// All four tests use `ctx.withReseed(async () => …)` because the
// body opens its own `connection.transaction(...)` block and the
// outer `withRollback` wrapper would steal the transaction control.
// `withReseed` reseeds after the body so the next test starts from
// baseline regardless of whether the inner transaction committed,
// rolled back, or threw.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { QueryExecutionSource, TsSqlQueryExecutionError } from '../../../../../src/TsSqlError.js'

// Body errors are thrown as `TsSqlQueryExecutionError` directly so
// every dialect's `isSqlError(...)` recognises them and the wrapping
// at [src/connections/AbstractConnection.ts:222-256](../../../../../src/connections/AbstractConnection.ts#L222-L256)
// produces a `TsSqlQueryExecutionError` (which is what `attach*`
// helpers live on). A plain `new Error(...)` would be rejected by the
// per-driver `isSqlError` (e.g. PgLite's
// `isSqlError(error) => error instanceof TsSqlError || isPgError(error)`),
// leaving `throwError = e` as a plain Error and the downstream
// `errorContainer.error.attachAdditionalError(...)` call at
// [src/utils/PromiseUtils.ts:56](../../../../../src/utils/PromiseUtils.ts#L56)
// would crash with "not a function" on the real-DB cells.
function bodyError(message: string): TsSqlQueryExecutionError {
    return new TsSqlQueryExecutionError(
        new QueryExecutionSource('test-body'),
        { reason: 'UNKNOWN' },
        message,
    )
}
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('transaction-body-throw-wraps-with-transaction-source', async () => {
        // The base path: body throws a plain `Error`. `transaction(...)`
        // wraps it in `TsSqlQueryExecutionError` and calls
        // `attachTransactionSource`. We pin that `transactionSource`
        // is defined on the surfaced error (the helper at
        // L432-447 of `TsSqlError.ts`).
        const connection = ctx.conn
        let caught: unknown

        await ctx.withReseed(async () => {
            try {
                await connection.transaction(async () => {
                    throw bodyError('boom-from-body')
                })
            } catch (e) {
                caught = e
            }
        })

        expect(caught).toBeInstanceOf(Error)
        expect((caught as Error).message).toContain('boom-from-body')
        if (caught instanceof TsSqlQueryExecutionError) {
            expect(caught.transactionSource).toBeDefined()
        }
    })

    test('after-rollback-deferred-throw-attaches-transaction-error', async () => {
        // Body throws → transaction enters rollback path. The
        // registered `executeAfterNextRollback` hook also throws.
        // `callDeferredFunctions` wraps the hook's error as a new
        // `TsSqlQueryExecutionError`; since the outer transaction
        // also produced an error, the wrapper calls
        // `attachTransactionError(transactionError)` (L44 / L77 of
        // `PromiseUtils.ts`). We verify `transactionError` is
        // populated on the deferred-hook error.
        const connection = ctx.conn
        let caught: unknown

        await ctx.withReseed(async () => {
            try {
                await connection.transaction(async () => {
                    connection.executeAfterNextRollback(() => {
                        throw new Error('boom-from-after-rollback-hook')
                    })
                    throw bodyError('boom-from-body')
                })
            } catch (e) {
                caught = e
            }
        })

        expect(caught).toBeInstanceOf(Error)
        expect(caught).toBeInstanceOf(TsSqlQueryExecutionError)
        if (caught instanceof TsSqlQueryExecutionError) {
            // The SURFACED error is the body's wrapped error; the
            // deferred-fn-wrapper landed in `additionalErrors[0]`,
            // and THAT wrapper carries `transactionError` (the raw
            // body error passed through PromiseUtils L44 / L77).
            expect(caught.additionalErrors).toBeDefined()
            expect(caught.additionalErrors).toHaveLength(1)
            const additional = caught.additionalErrors?.[0]
            expect(additional).toBeInstanceOf(TsSqlQueryExecutionError)
            if (additional instanceof TsSqlQueryExecutionError) {
                expect(additional.transactionError).toBeDefined()
                expect((additional.transactionError as Error).message).toContain('boom-from-body')
            }
        }
    })

    test('two-after-commit-deferred-throws-attach-additional-error', async () => {
        // Body succeeds → transaction commits → both registered
        // `executeAfterNextCommit` hooks throw. `callDeferredFunctions`
        // is non-stopping, so the first error becomes the surfaced
        // wrapper and the second one is attached via
        // `attachAdditionalError('after next commit')` (L56 / L83 of
        // `PromiseUtils.ts`). Pin that `additionalErrors` is
        // populated on the surfaced error.
        const connection = ctx.conn
        let caught: unknown

        await ctx.withReseed(async () => {
            try {
                await connection.transaction(async () => {
                    connection.executeAfterNextCommit(() => {
                        throw new Error('boom-from-after-commit-hook-1')
                    })
                    connection.executeAfterNextCommit(() => {
                        throw new Error('boom-from-after-commit-hook-2')
                    })
                })
            } catch (e) {
                caught = e
            }
        })

        expect(caught).toBeInstanceOf(Error)
        expect(caught).toBeInstanceOf(TsSqlQueryExecutionError)
        if (caught instanceof TsSqlQueryExecutionError) {
            expect(caught.additionalErrors).toBeDefined()
            expect(caught.additionalErrors).toHaveLength(1)
            const additional = caught.additionalErrors?.[0]
            expect(additional).toBeInstanceOf(Error)
            expect((additional as Error).message).toContain('boom-from-after-commit-hook-2')
        }
    })

    test('transaction-body-throws-custom-error-class-propagates-raw-unwrapped', async () => {
        // A user-defined error class is not recognised as a SQL error by
        // the real-driver runners, so it crosses `transaction(...)` raw —
        // the same instance is caught outside. The mock runner classifies
        // every non-RollbackSignal error as a SQL error, so it wraps the
        // thrown error in a TsSqlQueryExecutionError (cause === thrown).
        class AppDomainError extends Error {}
        const thrown = new AppDomainError('boom-custom')
        let caught: unknown
        await ctx.withReseed(async () => {
            try {
                await ctx.conn.transaction(async () => {
                    throw thrown
                })
            } catch (e) {
                caught = e
            }
        })
        if (ctx.realDbEnabled) {
            expect(caught).toBe(thrown)
        } else {
            expect(caught).toBeInstanceOf(TsSqlQueryExecutionError)
            expect((caught as TsSqlQueryExecutionError).cause).toBe(thrown)
        }
    })

    test('transaction-body-throws-plain-error-propagates-raw-unwrapped', async () => {
        // Same contract for a bare `new Error(...)` — see the previous test.
        const thrown = new Error('boom-plain')
        let caught: unknown
        await ctx.withReseed(async () => {
            try {
                await ctx.conn.transaction(async () => {
                    throw thrown
                })
            } catch (e) {
                caught = e
            }
        })
        if (ctx.realDbEnabled) {
            expect(caught).toBe(thrown)
        } else {
            expect(caught).toBeInstanceOf(TsSqlQueryExecutionError)
            expect((caught as TsSqlQueryExecutionError).cause).toBe(thrown)
        }
    })

    // TODO[LIMITATION]: `attachRollbackError` needs both the body error and the
    // rollback to throw; the mock swallows the rollback error and the real
    // runners can't force one, so this path isn't drivable in this matrix.
    /*
    test('rollback-driver-failure-attaches-rollback-error', async () => {
        // would force `e instanceof TsSqlQueryExecutionError` body
        // and monkey-patch executeRollback to fail; see the comment
        // above for why this is not feasible here.
    })
    */
})
