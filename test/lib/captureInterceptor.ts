// CaptureInterceptor wraps a QueryRunner and records the most recently
// emitted SQL string, parameters, and query type. The wrapped runner is
// either:
//   * a `MockQueryRunner` when no real database is available, or
//   * the real driver-backed runner when it is.
//
// The point is that test files use ONE connection (`ctx.conn`) backed by
// this interceptor, write the query exactly once, and still get:
//   - SQL + params assertions via `interceptor.lastSql / lastParams`
//   - the exact result type from `await conn.execute…()`
//   - the value either from the real DB (when enabled) or from whatever the
//     test pre-queued onto the mock — see TestContext.mockNext()
//
// `InterceptorQueryRunner` requires three abstract methods. We implement
// `onQuery` to capture, and stub `onQueryResult` / `onQueryError` to
// no-ops here — they are the parts this interceptor does not care about.

import { InterceptorQueryRunner } from '../../src/queryRunners/InterceptorQueryRunner.js'
import type { BeginTransactionOpts, QueryRunner, QueryType } from '../../src/queryRunners/QueryRunner.js'

type CapturedType = QueryType | 'isTransactionActive' | ''

// The interceptor sees BEGIN / COMMIT / ROLLBACK through their dedicated
// query types — the underlying runner emits no SQL string for them, just
// the operation kind. Identifying them by type (not by "is the SQL
// empty?") keeps the rule explicit even if a future runner ever surfaces
// a non-empty query for one of them.
const TRANSACTION_CONTROL_TYPES = new Set<CapturedType>([
    'beginTransaction',
    'commit',
    'rollback',
])

export class CaptureInterceptor extends InterceptorQueryRunner<undefined, QueryRunner> {
    public lastSql: string = ''
    public lastParams: unknown[] = []
    public lastType: CapturedType = ''
    /**
     * Latest SQL ignoring transaction-control ops (begin / commit /
     * rollback) and anything else that reaches the interceptor with
     * an empty query string. Use it when asserting "the last *real*
     * SQL that ran" — typically inside or after a
     * `connection.transaction(...)` block, where `lastSql` would
     * otherwise show the synthetic `"commit"` / `"rollback"` entry.
     */
    public lastNoTransactionSql: string = ''
    public lastNoTransactionParams: unknown[] = []
    public lastNoTransactionType: CapturedType = ''
    public history: Array<{ type: CapturedType; sql: string; params: unknown[] }> = []
    /**
     * The most recent `BeginTransactionOpts` array passed through
     * `connection.transaction(fn, opts)` or `connection.beginTransaction(opts)`.
     * Captured at the interceptor layer — BEFORE any per-runner handling
     * — so the assertion is mode-agnostic and works even for connectors
     * whose real-DB runner manages transactions internally (Porsager's
     * `postgres` and Bun's `sql` use `sql.begin(fn)`, `oracledb` flips
     * autocommit) and therefore never call `outermostQueryRunner.
     * executeBeginTransaction` — those skip the `onQuery('beginTransaction', …)`
     * path that `history` relies on.
     */
    public lastTransactionOpts: BeginTransactionOpts | undefined = undefined

    override executeBeginTransaction(opts: BeginTransactionOpts = []): Promise<void> {
        this.lastTransactionOpts = opts
        return super.executeBeginTransaction(opts)
    }

    override executeInTransaction<T>(fn: () => Promise<T>, outermostQueryRunner: QueryRunner, opts: BeginTransactionOpts = []): Promise<T> {
        this.lastTransactionOpts = opts
        return super.executeInTransaction(fn, outermostQueryRunner, opts)
    }

    override onQuery(queryType: QueryType, query: string, params: unknown[]): undefined {
        // Transaction-control calls (begin / commit / rollback) and a
        // couple of other ops surface with an empty SQL string — the
        // underlying runner emits no real SQL for them. Falling back to
        // the query type keeps `lastSql` / history readable: a snapshot
        // of `"commit"` is far more useful than `""` for a test that
        // asserts what just happened.
        //
        // Tests that need to look past the transaction wrapper read
        // `lastNoTransactionSql` instead — that one is gated by the
        // query *type* (commit / rollback / beginTransaction), not by
        // "is the SQL empty?", so the rule stays explicit even if a
        // future runner ever surfaces a non-empty query for one of
        // those ops.
        const effectiveQuery = query === '' ? queryType : query
        this.lastSql = effectiveQuery
        this.lastParams = params
        this.lastType = queryType
        if (!TRANSACTION_CONTROL_TYPES.has(queryType)) {
            this.lastNoTransactionSql = effectiveQuery
            this.lastNoTransactionParams = params
            this.lastNoTransactionType = queryType
        }
        this.history.push({ type: queryType, sql: effectiveQuery, params })
        return undefined
    }

    override onQueryResult(_queryType: QueryType, _query: string, _params: unknown[], _result: unknown, _playload: undefined): void {
        // no-op: this interceptor only observes query dispatch
    }

    override onQueryError(_queryType: QueryType, _query: string, _params: unknown[], _error: unknown, _playload: undefined): void {
        // no-op: this interceptor only observes query dispatch
    }

    /** Forget the captured state. Called from `TestContext.reset()`. */
    reset(): void {
        this.lastSql = ''
        this.lastParams = []
        this.lastType = ''
        this.lastNoTransactionSql = ''
        this.lastNoTransactionParams = []
        this.lastNoTransactionType = ''
        this.history.length = 0
        this.lastTransactionOpts = undefined
    }
}
