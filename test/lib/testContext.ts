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
import { MockQueryRunner } from '../../src/queryRunners/MockQueryRunner.js'
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
     */
    withRollback(fn: () => Promise<void>): Promise<void>
}

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
    /** Optional one-shot seed step run during `up()` after the real runner is created. */
    onUp?: ((realInterceptor: CaptureInterceptor) => Promise<void>) | undefined
    /** Re-apply schema + seed. Called by `reseed()`. */
    onReseed?: (() => Promise<void>) | undefined
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
    const mockRunner = new MockQueryRunner((type, _query, _params) => {
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
            } else {
                inner = mockRunner
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
        },

        reset() {
            mockQueue.length = 0
            mockRunner.reset()
            capture?.reset()
        },

        async reseed() {
            if (!opts.realDbEnabled || !opts.onReseed) return
            await opts.onReseed()
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
    }
    return ctx
}
