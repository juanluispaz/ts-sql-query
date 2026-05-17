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
import type { QueryRunner, QueryType } from '../../src/queryRunners/QueryRunner.js'

type CapturedType = QueryType | 'isTransactionActive' | ''

export class CaptureInterceptor extends InterceptorQueryRunner<undefined, QueryRunner> {
    public lastSql: string = ''
    public lastParams: unknown[] = []
    public lastType: CapturedType = ''
    public history: Array<{ type: CapturedType; sql: string; params: unknown[] }> = []

    override onQuery(queryType: QueryType, query: string, params: unknown[]): undefined {
        this.lastSql = query
        this.lastParams = params
        this.lastType = queryType
        this.history.push({ type: queryType, sql: query, params })
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
        this.history.length = 0
    }
}
