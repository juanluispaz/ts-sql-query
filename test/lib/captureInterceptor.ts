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
import { getQueryContext } from '../../src/QueryContext.js'

const BUILT_IN_TYPES = new Set<string>([
    'boolean', 'int', 'bigint', 'double', 'stringDecimal', 'string', 'uuid', 'localDate', 'localTime', 'localDateTime',
])
const CUSTOM_TYPES = new Set<string>([
    'customInt', 'customBigint', 'customDouble', 'customDecimal', 'customUuid', 'customLocalDate', 'customLocalTime',
    'customLocalDateTime', 'enum', 'custom', 'customComparable',
])

// A type is its name with, for a custom one, which custom type it is; without it, the name is the one of a built-in
// type (or of the internal ones given)
function isKnownType(type: unknown, customType: unknown, internalTypes: readonly string[] = []): boolean {
    if (typeof type !== 'string') {
        return false
    }
    if (customType === undefined) {
        return BUILT_IN_TYPES.has(type) || internalTypes.includes(type)
    }
    return typeof customType === 'string' && CUSTOM_TYPES.has(customType)
}

// Every parameter the library adds goes with its original type, the one requested for it and its forceTypeCast, kept
// by the library in the context of the query: a parameter without them is a place where the library lost the type of
// the value.
function checkParamTypes(query: string, params: unknown[]): void {
    for (let index = 0; index < params.length; index++) {
        const param = getQueryContext(query, params as any[]).getParam(index)
        if (!param || !isKnownType(param.originalType, param.originalCustomType) || !isKnownType(param.requestedType, param.requestedCustomType) || typeof param.forceTypeCast !== 'boolean') {
            throw new Error('The parameter ' + index + ' of the query has no type (original: ' + String(param?.originalType) + ' ' + String(param?.originalCustomType) + ', requested: ' + String(param?.requestedType) + ' ' + String(param?.requestedCustomType) + ', forceTypeCast: ' + String(param?.forceTypeCast) + '): ' + query)
        }
    }
}

// The queries that return one value without its column name, and the ones that return no columns
const SINGLE_VALUE_QUERY_TYPES = new Set<QueryType>([
    'selectOneColumnOneRow', 'selectOneColumnManyRows', 'insertReturningLastInsertedId', 'insertReturningMultipleLastInsertedId',
    'insertReturningOneColumnOneRow', 'insertReturningOneColumnManyRows', 'updateReturningOneColumnOneRow', 'updateReturningOneColumnManyRows',
    'deleteReturningOneColumnOneRow', 'deleteReturningOneColumnManyRows', 'executeFunction',
])
const NO_COLUMNS_QUERY_TYPES = new Set<QueryType>(['insert', 'update', 'delete', 'executeProcedure', 'beginTransaction', 'commit', 'rollback'])
// The queries whose result is rows, each an object keyed by the names of the columns
const ROWS_QUERY_TYPES = new Set<QueryType>([
    'selectOneRow', 'selectManyRows', 'insertReturningOneRow', 'insertReturningManyRows', 'updateReturningOneRow', 'updateReturningManyRows',
    'deleteReturningOneRow', 'deleteReturningManyRows',
])

// Every query the library builds (the ones with the place where they were executed) goes with the columns of its
// result and the configuration of the connection: a query without them, a column without its type, or a number of
// columns that doesn't fit the query, is a place where the library lost what the query runner may read.
function checkResultColumns(queryType: QueryType, query: string, params: unknown[]): void {
    const queryContext = getQueryContext(query, params as any[])
    if (!queryContext.executionSource) {
        // A query the library didn't build (a raw query of a test through the runner)
        return
    }
    if (!queryContext.connectionConfiguration) {
        throw new Error('The query has no connection configuration: ' + query)
    }
    const columns = queryContext.resultColumns
    if (!Array.isArray(columns)) {
        throw new Error('The query has no result columns: ' + query)
    }
    for (const column of columns) {
        const valid = typeof column.name === 'string' && typeof column.path === 'string'
            && isKnownType(column.originalType, column.originalCustomType, ['aggregatedArray'])
            && isKnownType(column.requestedType, column.requestedCustomType, ['aggregatedArray'])
        if (!valid) {
            throw new Error('A result column of the query has no type (' + JSON.stringify(column) + '): ' + query)
        }
    }
    if (SINGLE_VALUE_QUERY_TYPES.has(queryType) && columns.length !== 1) {
        throw new Error('The ' + queryType + ' query has ' + columns.length + ' result columns instead of one: ' + query)
    }
    if (NO_COLUMNS_QUERY_TYPES.has(queryType) && columns.length !== 0) {
        throw new Error('The ' + queryType + ' query has ' + columns.length + ' result columns instead of none: ' + query)
    }
}

// On a real database, the name of each result column is a key of the rows returned by the database: a name not in
// the row is a column the query runner would look up under the wrong key. The row can have more keys: a
// `customizeQuery({ beforeColumns })` fragment can add columns of its own.
function checkResultColumnNames(queryType: QueryType, query: string, params: unknown[], result: unknown): void {
    const queryContext = getQueryContext(query, params as any[])
    if (!ROWS_QUERY_TYPES.has(queryType) || !queryContext.executionSource) {
        return
    }
    const row = Array.isArray(result) ? result[0] : result
    if (!row || typeof row !== 'object') {
        return
    }
    const columns = queryContext.resultColumns ?? []
    const missing = columns.map(column => column.name).filter(name => !(name in row))
    if (missing.length > 0) {
        throw new Error('The result columns ' + JSON.stringify(missing) + ' of the query are not keys of the row returned by the database (' + JSON.stringify(Object.keys(row)) + '): ' + query)
    }
}

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
        if (!TRANSACTION_CONTROL_TYPES.has(queryType)) {
            // The params of a begin, commit or rollback are the options of the transaction
            checkParamTypes(query, params)
        }
        checkResultColumns(queryType, query, params)
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

    override onQueryResult(queryType: QueryType, query: string, params: unknown[], result: unknown, _playload: undefined): void {
        if ((this.queryRunner as { mockActive?: boolean }).mockActive === false) {
            checkResultColumnNames(queryType, query, params, result)
        }
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
