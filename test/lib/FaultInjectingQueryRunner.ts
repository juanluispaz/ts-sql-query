/**
 * Test-only `QueryRunner` wrapper that makes the transaction-lifecycle
 * calls (`executeBeginTransaction` / `executeCommit` / `executeRollback`)
 * **fail on demand** so the driver-rejection error-classification ladders
 * in `AbstractConnection` can be exercised.
 *
 * ## Why this exists
 *
 * `AbstractConnection.transaction` / `beginTransaction` / `commit` /
 * `rollback` each wrap the runner call in a 3-way error-classification
 * ladder, in both an async (`.then(_, reject)`) and a synchronous
 * (`try { … } catch`) form:
 *
 *   1. `e instanceof TsSqlQueryExecutionError`  → re-throw (attach source)
 *   2. `else if (this.queryRunner.isSqlError(e))` → wrap into a
 *      `TsSqlQueryExecutionError` via `getErrorReason(e)`
 *   3. `else`                                    → re-throw the raw error
 *
 * A healthy driver never rejects a `COMMIT`, so under the plain mock these
 * arms are dead. This wrapper injects the rejection, and because it wraps
 * the **outermost** runner it is honest in BOTH modes: point it at the mock
 * or at a real driver and it behaves identically — no `if (ctx.realDbEnabled)`
 * guard is needed. (The one thing it cannot do against a real driver is make
 * a real `COMMIT` genuinely fail, but the CLASSIFICATION under test is the
 * library's, not the driver's, so an injected error is a faithful stand-in.)
 *
 * ## Choosing the error to steer the ladder
 *
 * Pick the injected error's class to select which ladder arm runs:
 *   - a `TsSqlQueryExecutionError`  → arm 1
 *   - any other `TsSqlError`        → arm 2 (`isSqlError` recognises it)
 *   - a plain `Error` / value       → arm 3 (the raw `else`)
 *
 * (Arm 2 relies on the wrapped runner's `isSqlError`; the mock recognises
 * every `TsSqlError`, plus whatever its `isSqlError` config hook accepts.)
 *
 * ## `sync` — the two ladder forms
 *
 * Each transaction method has an async ladder AND a synchronous one. Set
 * `sync: true` to throw straight out of the runner method (drives the outer
 * `try/catch`); leave it off to reject the returned promise on the wrapped
 * runner's own provider (drives the `.then(_, reject)` arm). Rejecting on the
 * wrapped provider — not on the global `Promise` — is what keeps the
 * `SynchronousPromise` sqlite cells working.
 *
 * ## `transaction(fn)` is covered too
 *
 * `MockQueryRunner.executeInTransaction` calls back into the
 * `outermostQueryRunner` (this wrapper) for begin/commit/rollback, so arming
 * a commit/rollback fault also drives the `transaction(...)` ladders — no
 * separate `executeInTransaction` override is needed.
 *
 * ## `nestedTransactionsSupported`
 *
 * Pass `{ nestedTransactionsSupported: false }` to drive the
 * `NESTED_TRANSACTION_NOT_SUPPORTED` guards a nested `transaction(...)` /
 * `beginTransaction()` raises (the base mock reports `true`, which makes
 * those guards dead under the mock).
 *
 * See [`test/lib/queryIntrospection.ts`](./queryIntrospection.ts) for the
 * sibling test-only seam and the same stability contract: this is test
 * infrastructure, not a public API.
 */

import { ChainedQueryRunner } from '../../src/queryRunners/ChainedQueryRunner.js'
import type { BeginTransactionOpts, CommitOpts, QueryRunner, RollbackOpts } from '../../src/queryRunners/QueryRunner.js'

/** The transaction-lifecycle runner calls this wrapper can fault. */
export type TransactionPhase = 'beginTransaction' | 'commit' | 'rollback'

export interface Fault {
    /**
     * The error to surface. Its class picks the `AbstractConnection`
     * classification arm: a `TsSqlQueryExecutionError` → the re-throw arm;
     * any other `TsSqlError` → the `isSqlError` wrap arm; a plain error →
     * the raw `else` arm.
     */
    error: unknown
    /**
     * `true` → throw synchronously out of the runner method (drives the
     * `try/catch` ladders). Omitted / `false` → reject the returned promise
     * on the wrapped runner's provider (drives the `.then(_, reject)` ladders).
     */
    sync?: boolean
    /** How many consecutive calls of this phase fail before delegating normally. Default `1`. */
    times?: number
}

interface ArmedFault {
    error: unknown
    sync: boolean
    remaining: number
}

export interface FaultInjectingQueryRunnerOptions {
    /**
     * Override `nestedTransactionsSupported()`. Omit to delegate to the
     * wrapped runner (the mock reports `true`). Set `false` to drive the
     * `NESTED_TRANSACTION_NOT_SUPPORTED` guards.
     */
    nestedTransactionsSupported?: boolean
}

export class FaultInjectingQueryRunner<T extends QueryRunner = QueryRunner> extends ChainedQueryRunner<T> {
    private readonly faults: { [K in TransactionPhase]?: ArmedFault } = {}
    private readonly nestedSupportedOverride: boolean | undefined

    constructor(queryRunner: T, options: FaultInjectingQueryRunnerOptions = {}) {
        super(queryRunner)
        this.nestedSupportedOverride = options.nestedTransactionsSupported
    }

    /** Arm the next `executeBeginTransaction` (or the next `times` of them) to fail. Chainable. */
    failBeginTransaction(fault: Fault): this {
        return this.arm('beginTransaction', fault)
    }
    /** Arm the next `executeCommit` (direct `commit()` or the commit inside `transaction(...)`) to fail. Chainable. */
    failCommit(fault: Fault): this {
        return this.arm('commit', fault)
    }
    /** Arm the next `executeRollback` (direct `rollback()` or the rollback inside `transaction(...)`) to fail. Chainable. */
    failRollback(fault: Fault): this {
        return this.arm('rollback', fault)
    }
    /** Disarm every pending fault. Chainable. */
    clearFaults(): this {
        for (const phase of Object.keys(this.faults) as TransactionPhase[]) {
            delete this.faults[phase]
        }
        return this
    }

    private arm(phase: TransactionPhase, fault: Fault): this {
        this.faults[phase] = { error: fault.error, sync: fault.sync ?? false, remaining: fault.times ?? 1 }
        return this
    }

    private maybeFail<R>(phase: TransactionPhase, delegate: () => Promise<R>): Promise<R> {
        const fault = this.faults[phase]
        if (fault && fault.remaining > 0) {
            fault.remaining--
            if (fault.remaining <= 0) {
                delete this.faults[phase]
            }
            if (fault.sync) {
                throw fault.error
            }
            return this.queryRunner.createRejectedPromise<R>(fault.error)
        }
        return delegate()
    }

    override executeBeginTransaction(opts: BeginTransactionOpts = []): Promise<void> {
        return this.maybeFail('beginTransaction', () => this.queryRunner.executeBeginTransaction(opts))
    }
    override executeCommit(opts: CommitOpts = []): Promise<void> {
        return this.maybeFail('commit', () => this.queryRunner.executeCommit(opts))
    }
    override executeRollback(opts: RollbackOpts = []): Promise<void> {
        return this.maybeFail('rollback', () => this.queryRunner.executeRollback(opts))
    }
    override nestedTransactionsSupported(): boolean {
        if (this.nestedSupportedOverride !== undefined) {
            return this.nestedSupportedOverride
        }
        return super.nestedTransactionsSupported()
    }
}
