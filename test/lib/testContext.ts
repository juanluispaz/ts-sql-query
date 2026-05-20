// The single object a test file imports as `ctx`. After `up()`, every test
// reaches the same database via `ctx.conn`; the underlying runner is either
// the real driver-backed one (when the backend is enabled) or the mock one
// (otherwise). Test bodies read both ways out of `ctx`:
//
//   ctx.mockNext(value)   – queues a value the mock will hand back to the
//                           next `executeXxx`. Ignored when the real DB is
//                           active.
//   ctx.lastSql / ctx.lastParams – the most recent SQL + params the builder
//                                  emitted, captured by CaptureInterceptor.
//   ctx.conn              – the ts-sql-query connection to query through.
//
// Because the test always seeds the mock with the same data the real seed
// contains, a single `expect(result).toEqual(expected)` line covers both
// modes; SQL + params + exact type assertions need no branching.

import type { DatabaseType, QueryRunner } from '../../src/queryRunners/QueryRunner.js'
import { MockQueryRunner, type MockQueryExecutor, type MockQueryRunnerConfig } from '../../src/queryRunners/MockQueryRunner.js'
import { CaptureInterceptor } from './captureInterceptor.js'

export interface TestContext<CONN> {
    readonly label: string
    readonly canonicalForDocs: boolean
    readonly compatibilityVersion: number | undefined
    readonly realDbEnabled: boolean
    readonly timeoutMs: number

    /** Available after `up()` resolves; throws if read earlier. */
    readonly conn: CONN

    readonly lastSql: string
    readonly lastParams: unknown[]
    readonly lastType: string
    /**
     * Last SQL ignoring transaction-control ops (begin / commit /
     * rollback). Use it when the interceptor would otherwise surface a
     * synthetic `"commit"` / `"rollback"` entry — typically right
     * after a `connection.transaction(...)` block — and the test wants
     * to assert the real query that ran inside.
     */
    readonly lastNoTransactionSql: string
    readonly lastNoTransactionParams: unknown[]
    readonly lastNoTransactionType: string
    readonly history: ReadonlyArray<{ type: string; sql: string; params: unknown[] }>

    /** Queue a value the mock will return for the NEXT data query. */
    mockNext(value: unknown): void

    up(): Promise<void>
    down(): Promise<void>
    /** Forget captured state and mock queue. Call from `beforeEach`. */
    reset(): void
    /** Re-apply schema + seed. No-op when real DB is off. */
    reseed(): Promise<void>
    /**
     * Run a mutating test body so any data it writes never reaches the
     * next test. Opens a transaction inside `ctx.conn`, runs `fn`, then
     * throws an internal rollback signal that the connection treats as a
     * normal exception and rolls back on. Because the MockQueryRunner is
     * configured to NOT classify our signal as a SQL error, the same code
     * path works in mock mode without wrapping the signal in a
     * `TsSqlQueryExecutionError`.
     *
     * Default cooperation primitive for any test that mutates state: it
     * leaves zero trace on the next test (or the next process, with
     * container reuse).
     */
    withRollback(fn: () => Promise<void>): Promise<void>

    /**
     * Escape hatch for tests that genuinely need their mutations to
     * commit — DDL on engines without transactional DDL
     * (MySQL/MariaDB/Oracle/SQL Server), assertions that read committed
     * state from a second connection, sequence-counter behaviour that
     * survives rollback, etc.
     *
     * Runs `fn` inside an `ctx.conn.transaction(...)` that commits
     * normally (no rollback signal). On exit — success OR failure —
     * `ctx.reseed()` runs to restore the baseline schema + seed, so the
     * next test starts from the same shape as if `withRollback` had
     * been used. Any schema objects the test created outside the
     * declared seed remain (the reseed only resets what the seed
     * declares); the test should drop those itself before the
     * `withCommit` body returns so the cleanup is self-contained.
     *
     * Prefer `withRollback` for plain DML. Reach for `withCommit` only
     * when the mutation genuinely cannot be rolled back, or when the
     * test must observe post-commit visibility semantics.
     */
    withCommit(fn: () => Promise<void>): Promise<void>

    /**
     * Like `withCommit` but does NOT open an outer transaction. Use
     * when the test body itself manages a transaction
     * (`connection.transaction(...)`) — wrapping that body in another
     * tx would nest, and most engines reject nested transactions.
     *
     * The body runs as-is; on exit — success OR failure — `ctx.reseed()`
     * runs in real-DB mode to restore the baseline so the next test
     * starts clean.
     *
     * This is the primitive to use for tests that document
     * `connection.transaction(...)` behaviour: the body opens its own
     * tx and commits or rolls back, `withReseed` does the cleanup.
     */
    withReseed(fn: () => Promise<void>): Promise<void>
}

/**
 * Constructor signature shared by `MockQueryRunner` and every
 * connector-specialised subclass under `test/lib/mockRunners/`. The
 * specialised classes only override behaviour (e.g. `addParam` for the
 * SQLite connectors that coerce `boolean` to `0`/`1`) — never the
 * constructor — so they all share this shape.
 */
export type MockRunnerClass = new (executor: MockQueryExecutor, config: MockQueryRunnerConfig) => MockQueryRunner

export interface TestContextOptions<CONN> {
    label: string
    canonicalForDocs?: boolean | undefined
    compatibilityVersion?: number | undefined
    database: DatabaseType
    timeoutMs?: number | undefined
    /** True if the real DB backend is currently enabled (`isBackendEnabled('pg')`, …). */
    realDbEnabled: boolean
    /**
     * Build a real (driver-backed) runner. Called from `up()` when
     * `realDbEnabled` is true. Returns the runner plus a shutdown hook.
     */
    createRealRunner?: (() => Promise<{ runner: QueryRunner; shutdown(): Promise<void> }>) | undefined
    /**
     * Optional connector-specialised mock class. Falls back to
     * `MockQueryRunner` when not provided. Use this when the real
     * connector applies an observable param transformation (e.g. the
     * SQLite runners that coerce `boolean` to `0`/`1` inside
     * `addParam`) so the mock pass captures the same param shape as
     * the real pass — tests then assert one snapshot for both modes.
     */
    mockRunnerClass?: MockRunnerClass | undefined
    /** Optional one-shot seed step run during `up()` after the real runner is created. */
    onUp?: ((realInterceptor: CaptureInterceptor) => Promise<void>) | undefined
    /**
     * Re-apply schema + seed. Called by `reseed()` between tests when the
     * real backend is enabled. Receives the **underlying** `QueryRunner`
     * (the one returned by `createRealRunner` — already unwrapped of the
     * test-side `CaptureInterceptor`) so the implementation can reuse the
     * runner's existing connection pool via `runner.getNativeRunner()`.
     * Borrowing from the pool instead of opening a fresh driver-level
     * connection per reseed avoids the auth handshake on every test that
     * exercises a commit path — a real cost on Oracle / SQL Server under
     * the parallel matrix.
     */
    onReseed?: ((runner: QueryRunner) => Promise<void>) | undefined
    /** Tear down anything `onUp` or `createRealRunner` allocated. */
    onDown?: (() => Promise<void>) | undefined
    /** Build the user-facing connection from the capture interceptor + compat version. */
    buildConnection(interceptor: CaptureInterceptor, compatibilityVersion: number | undefined): CONN
}

// Sentinel thrown by `withRollback` to roll a transaction back without
// surfacing the error to the test. The MockQueryRunner is told via its
// `isSqlError` config that this is not a SQL error, so the connection
// re-throws it instead of wrapping it in a TsSqlQueryExecutionError.
class RollbackSignal extends Error {
    override readonly name = 'RollbackSignal'
    constructor() { super('rollback') }
}

const NON_CONSUMING_TYPES = new Set<string>([
    'beginTransaction', 'commit', 'rollback', 'isTransactionActive',
    'executeProcedure', 'executeDatabaseSchemaModification',
    'executeConnectionConfiguration',
])

export function createTestContext<CONN>(opts: TestContextOptions<CONN>): TestContext<CONN> {
    let conn: CONN | null = null
    let capture: CaptureInterceptor | null = null
    const mockQueue: unknown[] = []

    // The MockQueryRunner's internal `index` increments on every executor
    // call, including transaction control (begin/commit/rollback) and
    // procedures, which the test never primes for. We filter those out so
    // only "data query" calls (selects/inserts/updates/deletes/function)
    // consume from `mockQueue`, and use FIFO `shift()` so the queue index
    // stays decoupled from the runner's index.
    const MockClass = opts.mockRunnerClass ?? MockQueryRunner
    const mockRunner = new MockClass((type, _query, _params) => {
        if (NON_CONSUMING_TYPES.has(type)) return undefined
        return mockQueue.shift()
    }, {
        database: opts.database,
        // RollbackSignal is a deliberate test-side sentinel — not a SQL
        // error. Returning false here makes the connection propagate it as
        // a plain exception, so `withRollback`'s try/catch can handle it
        // identically in mock and real modes.
        isSqlError: (e) => !(e instanceof RollbackSignal),
    })

    let shutdownReal: (() => Promise<void>) | null = null
    // Hold the unwrapped runner so `onReseed` can borrow from its pool
    // instead of opening a fresh driver-level connection per reseed.
    let realRunner: QueryRunner | null = null

    const ctx: TestContext<CONN> = {
        label: opts.label,
        canonicalForDocs: opts.canonicalForDocs === true,
        compatibilityVersion: opts.compatibilityVersion,
        realDbEnabled: opts.realDbEnabled,
        timeoutMs: opts.timeoutMs ?? 180_000,

        get conn(): CONN {
            if (conn === null) throw new Error(`TestContext "${opts.label}": conn read before up()`)
            return conn
        },
        get lastSql(): string {
            return capture?.lastSql ?? ''
        },
        get lastParams(): unknown[] {
            return capture?.lastParams ?? []
        },
        get lastType(): string {
            return capture?.lastType ?? ''
        },
        get lastNoTransactionSql(): string {
            return capture?.lastNoTransactionSql ?? ''
        },
        get lastNoTransactionParams(): unknown[] {
            return capture?.lastNoTransactionParams ?? []
        },
        get lastNoTransactionType(): string {
            return capture?.lastNoTransactionType ?? ''
        },
        get history() {
            return capture?.history ?? []
        },

        mockNext(value) {
            mockQueue.push(value)
        },

        async up() {
            let inner: QueryRunner
            if (opts.realDbEnabled && opts.createRealRunner) {
                const created = await opts.createRealRunner()
                inner = created.runner
                shutdownReal = created.shutdown
                realRunner = inner
            } else {
                inner = mockRunner
                realRunner = null
            }
            capture = new CaptureInterceptor(inner)
            conn = opts.buildConnection(capture, opts.compatibilityVersion)
            if (opts.realDbEnabled && opts.onUp) {
                await opts.onUp(capture)
            }
        },

        async down() {
            if (shutdownReal) {
                await shutdownReal()
                shutdownReal = null
            }
            if (opts.onDown) {
                await opts.onDown()
            }
            capture = null
            conn = null
            realRunner = null
        },

        reset() {
            mockQueue.length = 0
            mockRunner.reset()
            capture?.reset()
        },

        async reseed() {
            if (!opts.realDbEnabled || !opts.onReseed || !realRunner) return
            await opts.onReseed(realRunner)
        },

        async withRollback(fn) {
            // Same code path in both modes: open a transaction, run the
            // body, throw RollbackSignal to roll back, catch the signal
            // on the way out. The real DB rolls back its changes;
            // the mock simply records the begin/rollback in its log.
            const c = conn as unknown as {
                transaction(inner: () => Promise<void>): Promise<void>
            }
            try {
                await c.transaction(async () => {
                    await fn()
                    throw new RollbackSignal()
                })
            } catch (e) {
                if (e instanceof RollbackSignal) return
                throw e
            }
        },

        async withCommit(fn) {
            // Run inside a real (committing) transaction. The body's
            // changes persist; we then call `reseed()` (which only runs
            // when the real DB is enabled) to restore the seeded
            // baseline so the next test starts from the same state as
            // it would after a `withRollback`. The reseed runs from a
            // `finally` so a failing body still triggers it — leaving
            // committed garbage behind would defeat the point.
            const c = conn as unknown as {
                transaction(inner: () => Promise<void>): Promise<void>
            }
            try {
                await c.transaction(async () => { await fn() })
            } finally {
                if (opts.realDbEnabled && opts.onReseed && realRunner) {
                    await opts.onReseed(realRunner)
                }
            }
        },

        async withReseed(fn) {
            // No outer transaction — the body is responsible for its
            // own transactional behaviour (typically a
            // `connection.transaction(...)` block, which is exactly the
            // API these tests document). Either way the reseed in the
            // `finally` restores the baseline so the next test starts
            // clean.
            try {
                await fn()
            } finally {
                if (opts.realDbEnabled && opts.onReseed && realRunner) {
                    await opts.onReseed(realRunner)
                }
            }
        },
    }
    return ctx
}
