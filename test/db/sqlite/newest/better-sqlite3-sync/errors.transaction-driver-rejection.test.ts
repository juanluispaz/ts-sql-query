// Coverage of AbstractConnection's transaction-lifecycle error-classification
// ladders: when the underlying driver rejects `beginTransaction` / `commit` /
// `rollback`, the connection routes the failure through a 3-way ladder that
//   1. re-throws a `TsSqlQueryExecutionError` unchanged (already the library's
//      own execution error),
//   2. wraps any other error the runner recognises as a SQL error into a fresh
//      `TsSqlQueryExecutionError` (preserving the original as `cause`),
//   3. re-throws anything else raw.
// Each method carries the ladder in BOTH an asynchronous form (the driver
// returns a rejected promise) and a synchronous form (the driver throws before
// returning). A healthy driver never rejects a COMMIT, so these arms are only
// reachable by forcing the rejection — `ctx.withFaultInjection()` arms the
// begin/commit/rollback calls to fail on demand. It also overrides
// `nestedTransactionsSupported()` to drive the `NESTED_TRANSACTION_NOT_SUPPORTED`
// guards a nested transaction raises.
//
// The injected error's CLASS selects the ladder arm:
//   - `TsSqlQueryExecutionError`  -> arm 1 (re-thrown, same instance)   [kind 'rethrown']
//   - `TsSqlProcessingError`      -> arm 2 (a SQL error, wrapped, `cause` kept) [kind 'wrapped']
//   - `ApplicationError`          -> arm 3 (not a SQL error, re-thrown raw)     [kind 'rethrown']
// `sync: true` throws out of the runner (the try/catch form); omitted rejects
// the returned promise (the `.then(_, reject)` form).
//
// These are MOCK-ONLY (`if (ctx.realDbEnabled) return`): the fault is INJECTED,
// so the classification under test is the library's and is identical in mock and
// real mode — forcing it on a real engine validates nothing the mock doesn't
// already prove. A faulted commit/rollback also leaves the transaction open, and
// a real native embedded runner (e.g. better-sqlite3) cannot be cleanly recovered
// from that. Every assertion targets the caught error, so the audit's
// exception-validation carve-out tolerates the skip.

import { afterAll, ApplicationError, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { QueryExecutionSource, TsSqlProcessingError, TsSqlQueryExecutionError } from '../../../../../src/TsSqlError.js'
import { ctx } from './setup.js'

// The three error classes that steer the classification ladder. `kind` is the
// expected outcome: 'rethrown' -> the surfaced error IS the injected instance;
// 'wrapped' -> a fresh TsSqlQueryExecutionError whose `cause` is the injected one.
interface Steer {
    key: string
    kind: 'rethrown' | 'wrapped'
    make: () => Error
}

const STEERS: Steer[] = [
    // Arm 1: already a TsSqlQueryExecutionError -> re-thrown, same instance.
    { key: 'execution-error-rethrown', kind: 'rethrown', make: () => new TsSqlQueryExecutionError(new QueryExecutionSource('fault-src'), { reason: 'UNKNOWN' }, 'driver-fault') },
    // Arm 2: a SQL error the runner recognises -> wrapped, original kept as cause.
    { key: 'sql-error-wrapped', kind: 'wrapped', make: () => new TsSqlProcessingError({ reason: 'UNKNOWN' }, 'driver-fault') },
    // Arm 3: not a SQL error -> re-thrown raw, same instance.
    { key: 'application-error-raw', kind: 'rethrown', make: () => new ApplicationError('driver-fault') },
]

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    for (const steer of STEERS) {
        for (const sync of [false, true]) {
            const form = sync ? 'synchronous' : 'asynchronous'

            test(`begin-transaction-${form}-driver-rejection-classifies-${steer.key}`, async () => {
                if (ctx.realDbEnabled) { return }
                // A direct `beginTransaction()` whose driver call fails.
                const { conn, faults } = ctx.withFaultInjection()
                const injected = steer.make()
                let caught: unknown

                faults.failBeginTransaction({ error: injected, sync })
                try {
                    await conn.beginTransaction()
                } catch (e) {
                    caught = e
                }

                if (steer.kind === 'wrapped') {
                    expect(caught).toBeInstanceOf(TsSqlQueryExecutionError)
                    expect(caught).not.toBe(injected)
                    if (caught instanceof TsSqlQueryExecutionError) {
                        expect(caught.cause).toBe(injected)
                    }
                } else {
                    expect(caught).toBe(injected)
                }
            })

            test(`commit-${form}-driver-rejection-classifies-${steer.key}`, async () => {
                if (ctx.realDbEnabled) { return }
                // A direct `commit()` with no before-commit hook whose driver call fails.
                const { conn, faults } = ctx.withFaultInjection()
                const injected = steer.make()
                let caught: unknown

                await conn.beginTransaction()
                faults.failCommit({ error: injected, sync })
                try {
                    await conn.commit()
                } catch (e) {
                    caught = e
                }

                if (steer.kind === 'wrapped') {
                    expect(caught).toBeInstanceOf(TsSqlQueryExecutionError)
                    expect(caught).not.toBe(injected)
                    if (caught instanceof TsSqlQueryExecutionError) {
                        expect(caught.cause).toBe(injected)
                    }
                } else {
                    expect(caught).toBe(injected)
                }
            })

            test(`commit-after-before-commit-hook-${form}-driver-rejection-classifies-${steer.key}`, async () => {
                if (ctx.realDbEnabled) { return }
                // A `commit()` preceded by a before-commit hook that returns a
                // promise, so the commit runs on the deferred-hook continuation
                // (a separate ladder from the plain commit above). The hook itself
                // succeeds; the commit driver call fails.
                const { conn, faults } = ctx.withFaultInjection()
                const injected = steer.make()
                let caught: unknown

                await conn.beginTransaction()
                conn.executeBeforeNextCommit(async () => { /* resolves, then the commit faults */ })
                faults.failCommit({ error: injected, sync })
                try {
                    await conn.commit()
                } catch (e) {
                    caught = e
                }

                if (steer.kind === 'wrapped') {
                    expect(caught).toBeInstanceOf(TsSqlQueryExecutionError)
                    expect(caught).not.toBe(injected)
                    if (caught instanceof TsSqlQueryExecutionError) {
                        expect(caught.cause).toBe(injected)
                    }
                } else {
                    expect(caught).toBe(injected)
                }
            })

            test(`rollback-${form}-driver-rejection-classifies-${steer.key}`, async () => {
                if (ctx.realDbEnabled) { return }
                // A direct `rollback()` whose driver call fails.
                const { conn, faults } = ctx.withFaultInjection()
                const injected = steer.make()
                let caught: unknown

                await conn.beginTransaction()
                faults.failRollback({ error: injected, sync })
                try {
                    await conn.rollback()
                } catch (e) {
                    caught = e
                }

                if (steer.kind === 'wrapped') {
                    expect(caught).toBeInstanceOf(TsSqlQueryExecutionError)
                    expect(caught).not.toBe(injected)
                    if (caught instanceof TsSqlQueryExecutionError) {
                        expect(caught.cause).toBe(injected)
                    }
                } else {
                    expect(caught).toBe(injected)
                }
            })
        }

        test(`transaction-block-synchronous-begin-rejection-classifies-${steer.key}`, async () => {
            if (ctx.realDbEnabled) { return }
            // A begin fault thrown SYNCHRONOUSLY from inside `transaction(fn)` makes
            // `executeInTransaction` throw synchronously, so it is classified by the
            // outer try/catch ladder of `transaction`.
            const { conn, faults } = ctx.withFaultInjection()
            const injected = steer.make()
            let caught: unknown

            faults.failBeginTransaction({ error: injected, sync: true })
            try {
                await conn.transaction(() => undefined)
            } catch (e) {
                caught = e
            }

            if (steer.kind === 'wrapped') {
                expect(caught).toBeInstanceOf(TsSqlQueryExecutionError)
                expect(caught).not.toBe(injected)
                if (caught instanceof TsSqlQueryExecutionError) {
                    expect(caught.cause).toBe(injected)
                }
            } else {
                expect(caught).toBe(injected)
            }
        })
    }

    test('transaction-block-asynchronous-begin-rejection-wraps-sql-error', async () => {
        if (ctx.realDbEnabled) { return }
        // A begin fault REJECTED asynchronously inside `transaction(fn)` reaches the
        // outer async classification handler (distinct from the synchronous outer
        // catch and from the direct `beginTransaction()` handler). A SQL error there
        // is wrapped, keeping the original as cause.
        const { conn, faults } = ctx.withFaultInjection()
        const injected = new TsSqlProcessingError({ reason: 'UNKNOWN' }, 'begin-fault')
        let caught: unknown

        faults.failBeginTransaction({ error: injected, sync: false })
        try {
            await conn.transaction(() => undefined)
        } catch (e) {
            caught = e
        }

        expect(caught).not.toBe(injected)
        expect(caught).toBeInstanceOf(TsSqlQueryExecutionError)
        if (caught instanceof TsSqlQueryExecutionError) {
            expect(caught.cause).toBe(injected)
        }
    })

    test('transaction-nested-within-active-transaction-throws-nested-not-supported', async () => {
        if (ctx.realDbEnabled) { return }
        // With nested transactions unsupported, starting a `transaction(...)` while
        // one is already open throws `NESTED_TRANSACTION_NOT_SUPPORTED` before any
        // driver call.
        const { conn } = ctx.withFaultInjection({ nestedTransactionsSupported: false })
        let caught: unknown

        await conn.beginTransaction()
        try {
            await conn.transaction(() => undefined)
        } catch (e) {
            caught = e
        }

        expect(caught).toBeInstanceOf(TsSqlQueryExecutionError)
        if (caught instanceof TsSqlQueryExecutionError) {
            expect(caught.errorReason.reason).toBe('NESTED_TRANSACTION_NOT_SUPPORTED')
        }
    })

    test('begin-transaction-nested-within-active-transaction-throws-nested-not-supported', async () => {
        if (ctx.realDbEnabled) { return }
        // The same guard on `beginTransaction()`: a second begin while a transaction
        // is open throws `NESTED_TRANSACTION_NOT_SUPPORTED`.
        const { conn } = ctx.withFaultInjection({ nestedTransactionsSupported: false })
        let caught: unknown

        await conn.beginTransaction()
        try {
            await conn.beginTransaction()
        } catch (e) {
            caught = e
        }

        expect(caught).toBeInstanceOf(TsSqlQueryExecutionError)
        if (caught instanceof TsSqlQueryExecutionError) {
            expect(caught.errorReason.reason).toBe('NESTED_TRANSACTION_NOT_SUPPORTED')
        }
    })
})
