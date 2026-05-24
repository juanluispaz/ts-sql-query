import type { BeginTransactionOpts, CommitOpts, DatabaseType, PromiseProvider, QueryRunner, QueryType, RollbackOpts } from './QueryRunner.js'
import { TsSqlError, TsSqlProcessingError, type TsSqlErrorReason } from '../TsSqlError.js'

export type MockQueryExecutor = (type: QueryType, query: string, params: any[], index: number) => any

export interface MockQueryRunnerConfig {
    database?: DatabaseType
    promise?: PromiseProvider
    /**
     * Customize how thrown errors that are NOT `TsSqlError` instances
     * are classified as SQL errors. `TsSqlError` is always recognised
     * as a SQL error regardless of this hook — only application-level
     * errors (`new Error(...)`, custom subclasses, driver-shape stubs)
     * reach the hook for classification. Returning `false` makes the
     * connection skip wrapping the error inside a
     * `TsSqlQueryExecutionError` in transaction handling, so the
     * original error bubbles up to your `catch` clause unchanged —
     * useful for test-only sentinels like rollback signals. Default:
     * `false` for everything that is not a `TsSqlError`, mirroring how
     * real driver runners (`PgLiteQueryRunner.isSqlError`,
     * `PgQueryRunner.isSqlError`, etc.) only recognise their own
     * driver error shapes plus `TsSqlError`.
     */
    isSqlError?: (error: unknown) => boolean
}

/**
 * `MockQueryRunner` impersonates a database driver for tests. Each `execute*` method
 * acts as a **shape gate**: the value returned by the user-supplied `queryExecutor`
 * is checked against the rough shape a real driver would produce for that query
 * type (plain object, array of plain objects, number, `null`/`undefined`, etc.), and
 * a non-conforming value is rejected with reason `'INVALID_MOCKED_VALUE'` naming the
 * `queryType` and `index` so the bad mock is easy to locate.
 *
 * Past that gate, the value flows through the **same** result-projection pipeline a
 * real driver's response would: type adapters convert each field, mandatory columns
 * are checked for `null`/`undefined`, and aggregated-array JSON is parsed and
 * validated. The mock is impersonating a database, so projector-level errors fire
 * identically to real-DB mode — most commonly `'MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE'`
 * when a mocked row is a structurally valid plain object that simply omits a column
 * the `select({...})` projects as required. That is the documented invariant, not a
 * bug: the fix in test code is to include every projected column in the mocked row
 * (or to seed `[]` / `undefined` when the test only asserts the emitted SQL).
 *
 * **Transaction-state guards.** `MockQueryRunner` maintains an internal
 * transaction-depth counter — `executeBeginTransaction` increments it,
 * `executeCommit` / `executeRollback` decrement it — and `isTransactionActive()`
 * is answered from the counter. The `AbstractConnection` transaction-lifecycle
 * guards (NOT_IN_TRANSACTION on `commit()` / `rollback()` / hook registration,
 * NESTED_TRANSACTION_NOT_SUPPORTED on a nested `transaction(...)`) therefore
 * engage in mock mode exactly as they do for a real driver. `isMocked()`
 * continues to return `true` purely as a diagnostic for external consumers
 * that need to discriminate mock vs real at runtime — it no longer disables
 * any guard.
 */
export class MockQueryRunner implements QueryRunner {
    private count = 0
    private transactionDepth = 0
    readonly queryExecutor: MockQueryExecutor
    readonly database: DatabaseType
    readonly promise: PromiseProvider
    private readonly isSqlErrorFn: (error: unknown) => boolean

    constructor(queryExecutor: MockQueryExecutor, databaseOrConfig: DatabaseType | MockQueryRunnerConfig = 'noopDB') {
        this.queryExecutor = queryExecutor
        if (typeof databaseOrConfig === 'string') {
            databaseOrConfig = { database: databaseOrConfig }
        }
        this.database = databaseOrConfig.database || 'noopDB'
        this.promise = databaseOrConfig.promise || Promise
        const userIsSqlError = databaseOrConfig.isSqlError
        this.isSqlErrorFn = userIsSqlError
            ? (error) => error instanceof TsSqlError || userIsSqlError(error)
            : (error) => error instanceof TsSqlError
    }

    /**
     * Reset the internal index used to call `queryExecutor` and the
     * internal transaction-depth counter. The next query dispatched
     * through this runner will be passed `index = 0`, and
     * `isTransactionActive()` will report `false` again. Useful when
     * reusing a single `MockQueryRunner` across many test cases that
     * each prime their own sequence of responses keyed by index.
     */
    reset(): void {
        this.count = 0
        this.transactionDepth = 0
    }

    useDatabase(database: DatabaseType): void {
        // @ts-ignore
        this.database = database
    }

    getNativeRunner(): unknown {
        return null
    }

    getCurrentNativeTransaction(): unknown {
        return undefined
    }

    execute<RESULT>(fn: (connection: unknown, transaction?: unknown) => Promise<RESULT>): Promise<RESULT> {
        return fn(null)
    }

    executeSelectOneRow(query: string, params: any[] = []): Promise<any> {
        try {
            const index = this.count++
            const result = this.queryExecutor('selectOneRow', query, params, index)
            if (!isPlainObjectOrNoValue(result)) {
                throw new TsSqlProcessingError({ reason: 'INVALID_MOCKED_VALUE', value: result, index, queryType: 'selectOneRow' }, 'Invalid test case result for a selectOneRow with index ' + index + '. Your mock function provided to the MockQueryRunner must returns null, undefined or a plain object')
            }
            return this.promise.resolve(result)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeSelectManyRows(query: string, params: any[] = []): Promise<any[]> {
        try {
            const index = this.count++
            let result = this.queryExecutor('selectManyRows', query, params, index)
            if (result === undefined || result === null) {
                result = []
            }
            if (!Array.isArray(result)) {
                throw new TsSqlProcessingError({ reason: 'INVALID_MOCKED_VALUE', value: result, index, queryType: 'selectManyRows' }, 'Invalid test case result for a selectManyRows with index ' + index + '. Your mock function provided to the MockQueryRunner must returns null, undefined or an Array of plain object')
            }
            for (let i = 0; i < result.length; i++) {
                if (!isPlainObject(result[i])) {
                    throw new TsSqlProcessingError({ reason: 'INVALID_MOCKED_VALUE', value: result, index, queryType: 'selectManyRows' }, 'Invalid test case result for a selectManyRows with index ' + index + '. The returned array by the mock function provided to the MockQueryRunner contains a no plain object at position ' + i)
                }
            }
            return this.promise.resolve(result)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeSelectOneColumnOneRow(query: string, params: any[] = []): Promise<any> {
        // undefined result means no value returned by the database
        try {
            return this.promise.resolve(this.queryExecutor('selectOneColumnOneRow', query, params, this.count++))
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeSelectOneColumnManyRows(query: string, params: any[] = []): Promise<any[]> {
        try {
            const index = this.count++
            let result = this.queryExecutor('selectOneColumnManyRows', query, params, index)
            if (result === undefined || result === null) {
                result = []
            }
            if (!Array.isArray(result)) {
                throw new TsSqlProcessingError({ reason: 'INVALID_MOCKED_VALUE', value: result, index, queryType: 'selectOneColumnManyRows' }, 'Invalid test case result for a selectOneColumnManyRows with index ' + index + '. Your mock function provided to the MockQueryRunner must returns null, undefined or an Array')
            }
            return this.promise.resolve(result)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeInsert(query: string, params: any[] = []): Promise<number> {
        try {
            const index = this.count++
            let result = this.queryExecutor('insert', query, params, index)
            if (result === undefined || result === null) {
                result = 1
            }
            if (typeof result !== 'number') {
                throw new TsSqlProcessingError({ reason: 'INVALID_MOCKED_VALUE', value: result, index, queryType: 'insert' }, 'Invalid test case result for an insert with index ' + index + '. Your mock function provided to the MockQueryRunner must returns null, undefined or a number')
            }
            return this.promise.resolve(result)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
        try {
            return this.promise.resolve(this.queryExecutor('insertReturningLastInsertedId', query, params, this.count++))
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeInsertReturningMultipleLastInsertedId(query: string, params: any[] = []): Promise<any[]> {
        try {
            const index = this.count++
            let result = this.queryExecutor('insertReturningMultipleLastInsertedId', query, params, index)
            if (result === undefined || result === null) {
                result = []
            }
            if (!Array.isArray(result)) {
                throw new TsSqlProcessingError({ reason: 'INVALID_MOCKED_VALUE', value: result, index, queryType: 'insertReturningMultipleLastInsertedId' }, 'Invalid test case result for an insertReturningMultipleLastInsertedId with index ' + index + '. Your mock function provided to the MockQueryRunner must returns null, undefined or an Array')
            }
            return this.promise.resolve(result)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeInsertReturningOneRow(query: string, params: any[] = []): Promise<any> {
        try {
            const index = this.count++
            const result = this.queryExecutor('insertReturningOneRow', query, params, index)
            if (!isPlainObjectOrNoValue(result)) {
                throw new TsSqlProcessingError({ reason: 'INVALID_MOCKED_VALUE', value: result, index, queryType: 'insertReturningOneRow' }, 'Invalid test case result for a insertReturningOneRow with index ' + index + '. Your mock function provided to the MockQueryRunner must returns null, undefined or a plain object')
            }
            return this.promise.resolve(result)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeInsertReturningManyRows(query: string, params: any[] = []): Promise<any[]> {
        try {
            const index = this.count++
            let result = this.queryExecutor('insertReturningManyRows', query, params, index)
            if (result === undefined || result === null) {
                result = []
            }
            if (!Array.isArray(result)) {
                throw new TsSqlProcessingError({ reason: 'INVALID_MOCKED_VALUE', value: result, index, queryType: 'insertReturningManyRows' }, 'Invalid test case result for a insertReturningManyRows with index ' + index + '. Your mock function provided to the MockQueryRunner must returns null, undefined or an Array of plain object')
            }
            for (let i = 0; i < result.length; i++) {
                if (!isPlainObject(result[i])) {
                    throw new TsSqlProcessingError({ reason: 'INVALID_MOCKED_VALUE', value: result, index, queryType: 'insertReturningManyRows' }, 'Invalid test case result for a insertReturningManyRows with index ' + index + '. The returned array by the mock function provided to the MockQueryRunner contains a no plain object at position ' + i)
                }
            }
            return this.promise.resolve(result)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeInsertReturningOneColumnOneRow(query: string, params: any[] = []): Promise<any> {
        // undefined result means no value returned by the database
        try {
            return this.promise.resolve(this.queryExecutor('insertReturningOneColumnOneRow', query, params, this.count++))
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeInsertReturningOneColumnManyRows(query: string, params: any[] = []): Promise<any[]> {
        try {
            const index = this.count++
            let result = this.queryExecutor('insertReturningOneColumnManyRows', query, params, index)
            if (result === undefined || result === null) {
                result = []
            }
            if (!Array.isArray(result)) {
                throw new TsSqlProcessingError({ reason: 'INVALID_MOCKED_VALUE', value: result, index, queryType: 'insertReturningOneColumnManyRows' }, 'Invalid test case result for a insertReturningOneColumnManyRows with index ' + index + '. Your mock function provided to the MockQueryRunner must returns null, undefined or an Array')
            }
            return this.promise.resolve(result)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeUpdate(query: string, params: any[] = []): Promise<number> {
        try {
            const index = this.count++
            let result = this.queryExecutor('update', query, params, index)
            if (result === undefined || result === null) {
                result = 0
            }
            if (typeof result !== 'number') {
                throw new TsSqlProcessingError({ reason: 'INVALID_MOCKED_VALUE', value: result, index, queryType: 'update' }, 'Invalid test case result for an update with index ' + index + '. Your mock function provided to the MockQueryRunner must returns null, undefined or a number')
            }
            return this.promise.resolve(result)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeUpdateReturningOneRow(query: string, params: any[] = []): Promise<any> {
        try {
            const index = this.count++
            const result = this.queryExecutor('updateReturningOneRow', query, params, index)
            if (!isPlainObjectOrNoValue(result)) {
                throw new TsSqlProcessingError({ reason: 'INVALID_MOCKED_VALUE', value: result, index, queryType: 'updateReturningOneRow' }, 'Invalid test case result for a updateReturningOneRow with index ' + index + '. Your mock function provided to the MockQueryRunner must returns null, undefined or a plain object')
            }
            return this.promise.resolve(result)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeUpdateReturningManyRows(query: string, params: any[] = []): Promise<any[]> {
        try {
            const index = this.count++
            let result = this.queryExecutor('updateReturningManyRows', query, params, index)
            if (result === undefined || result === null) {
                result = []
            }
            if (!Array.isArray(result)) {
                throw new TsSqlProcessingError({ reason: 'INVALID_MOCKED_VALUE', value: result, index, queryType: 'updateReturningManyRows' }, 'Invalid test case result for a updateReturningManyRows with index ' + index + '. Your mock function provided to the MockQueryRunner must returns null, undefined or an Array of plain object')
            }
            for (let i = 0; i < result.length; i++) {
                if (!isPlainObject(result[i])) {
                    throw new TsSqlProcessingError({ reason: 'INVALID_MOCKED_VALUE', value: result, index, queryType: 'updateReturningManyRows' }, 'Invalid test case result for a updateReturningManyRows with index ' + index + '. The returned array by the mock function provided to the MockQueryRunner contains a no plain object at position ' + i)
                }
            }
            return this.promise.resolve(result)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeUpdateReturningOneColumnOneRow(query: string, params: any[] = []): Promise<any> {
        // undefined result means no value returned by the database
        try {
            return this.promise.resolve(this.queryExecutor('updateReturningOneColumnOneRow', query, params, this.count++))
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeUpdateReturningOneColumnManyRows(query: string, params: any[] = []): Promise<any[]> {
        try {
            const index = this.count++
            let result = this.queryExecutor('updateReturningOneColumnManyRows', query, params, index)
            if (result === undefined || result === null) {
                result = []
            }
            if (!Array.isArray(result)) {
                throw new TsSqlProcessingError({ reason: 'INVALID_MOCKED_VALUE', value: result, index, queryType: 'updateReturningOneColumnManyRows' }, 'Invalid test case result for a updateReturningOneColumnManyRows with index ' + index + '. Your mock function provided to the MockQueryRunner must returns null, undefined or an Array')
            }
            return this.promise.resolve(result)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeDelete(query: string, params: any[] = []): Promise<number> {
        try {
            const index = this.count++
            let result = this.queryExecutor('delete', query, params, index)
            if (result === undefined || result === null) {
                result = 0
            }
            if (typeof result !== 'number') {
                throw new TsSqlProcessingError({ reason: 'INVALID_MOCKED_VALUE', value: result, index, queryType: 'delete' }, 'Invalid test case result for a delete with index ' + index + '. Your mock function provided to the MockQueryRunner must returns null, undefined or a number')
            }
            return this.promise.resolve(result)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeDeleteReturningOneRow(query: string, params: any[] = []): Promise<any> {
        try {
            const index = this.count++
            const result = this.queryExecutor('deleteReturningOneRow', query, params, index)
            if (!isPlainObjectOrNoValue(result)) {
                throw new TsSqlProcessingError({ reason: 'INVALID_MOCKED_VALUE', value: result, index, queryType: 'deleteReturningOneRow' }, 'Invalid test case result for a deleteReturningOneRow with index ' + index + '. Your mock function provided to the MockQueryRunner must returns null, undefined or a plain object')
            }
            return this.promise.resolve(result)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeDeleteReturningManyRows(query: string, params: any[] = []): Promise<any[]> {
        try {
            const index = this.count++
            let result = this.queryExecutor('deleteReturningManyRows', query, params, index)
            if (result === undefined || result === null) {
                result = []
            }
            if (!Array.isArray(result)) {
                throw new TsSqlProcessingError({ reason: 'INVALID_MOCKED_VALUE', value: result, index, queryType: 'deleteReturningManyRows' }, 'Invalid test case result for a deleteReturningManyRows with index ' + index + '. Your mock function provided to the MockQueryRunner must returns null, undefined or an Array of plain object')
            }
            for (let i = 0; i < result.length; i++) {
                if (!isPlainObject(result[i])) {
                    throw new TsSqlProcessingError({ reason: 'INVALID_MOCKED_VALUE', value: result, index, queryType: 'deleteReturningManyRows' }, 'Invalid test case result for a deleteReturningManyRows with index ' + index + '. The returned array by the mock function provided to the MockQueryRunner contains a no plain object at position ' + i)
                }
            }
            return this.promise.resolve(result)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeDeleteReturningOneColumnOneRow(query: string, params: any[] = []): Promise<any> {
        // undefined result means no value returned by the database
        try {
            return this.promise.resolve(this.queryExecutor('deleteReturningOneColumnOneRow', query, params, this.count++))
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeDeleteReturningOneColumnManyRows(query: string, params: any[] = []): Promise<any[]> {
        try {
            const index = this.count++
            let result = this.queryExecutor('deleteReturningOneColumnManyRows', query, params, index)
            if (result === undefined || result === null) {
                result = []
            }
            if (!Array.isArray(result)) {
                throw new TsSqlProcessingError({ reason: 'INVALID_MOCKED_VALUE', value: result, index, queryType: 'deleteReturningOneColumnManyRows' }, 'Invalid test case result for a deleteReturningOneColumnManyRows with index ' + index + '. Your mock function provided to the MockQueryRunner must returns null, undefined or an Array')
            }
            return this.promise.resolve(result)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeProcedure(query: string, params: any[] = []): Promise<void> {
        try {
            const index = this.count++
            const result = this.queryExecutor('executeProcedure', query, params, index)
            if (result !== undefined && result !== null) {
                throw new TsSqlProcessingError({ reason: 'INVALID_MOCKED_VALUE', value: result, index, queryType: 'executeProcedure' }, 'Invalid test case result for an executeProcedure with index ' + index + '. Your mock function provided to the MockQueryRunner must returns null or undefined')
            }
            return this.promise.resolve(undefined)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeFunction(query: string, params: any[] = []): Promise<any> {
        try {
            return this.promise.resolve(this.queryExecutor('executeFunction', query, params, this.count++))
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeBeginTransaction(opts: BeginTransactionOpts = []): Promise<void> {
        try {
            const index = this.count++
            const result = this.queryExecutor('beginTransaction', 'begin transaction', opts, index)
            if (result !== undefined && result !== null) {
                throw new TsSqlProcessingError({ reason: 'INVALID_MOCKED_VALUE', value: result, index, queryType: 'beginTransaction' }, 'Invalid test case result for a beginTransaction with index ' + index + '. Your mock function provided to the MockQueryRunner must returns null or undefined')
            }
            this.transactionDepth++
            return this.promise.resolve(undefined)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeCommit(opts: CommitOpts = []): Promise<void> {
        try {
            const index = this.count++
            const result = this.queryExecutor('commit', 'commit', opts, index)
            if (result !== undefined && result !== null) {
                throw new TsSqlProcessingError({ reason: 'INVALID_MOCKED_VALUE', value: result, index, queryType: 'commit' }, 'Invalid test case result for a commit with index ' + index + '. Your mock function provided to the MockQueryRunner must returns null or undefined')
            }
            if (this.transactionDepth > 0) {
                this.transactionDepth--
            }
            return this.promise.resolve(undefined)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeRollback(opts: RollbackOpts = []): Promise<void> {
        try {
            const index = this.count++
            const result = this.queryExecutor('rollback', 'rollback', opts || [], index)
            if (result !== undefined && result !== null) {
                throw new TsSqlProcessingError({ reason: 'INVALID_MOCKED_VALUE', value: result, index, queryType: 'rollback' }, 'Invalid test case result for a commit with index ' + index + '. Your mock function provided to the MockQueryRunner must returns null or undefined')
            }
            if (this.transactionDepth > 0) {
                this.transactionDepth--
            }
            return this.promise.resolve(undefined)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    isTransactionActive(): boolean {
        return this.transactionDepth > 0
    }
    executeDatabaseSchemaModification(query: string, params: any[] = []): Promise<void> {
        try {
            const index = this.count++
            const result = this.queryExecutor('executeDatabaseSchemaModification', query, params, index)
            if (result !== undefined && result !== null) {
                throw new TsSqlProcessingError({ reason: 'INVALID_MOCKED_VALUE', value: result, index, queryType: 'executeDatabaseSchemaModification' }, 'Invalid test case result for a executeDatabaseSchemaModification with index ' + index + '. Your mock function provided to the MockQueryRunner must returns null or undefined')
            }
            return this.promise.resolve(undefined)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeConnectionConfiguration(query: string, params: any[] = []): Promise<void> {
        try {
            const index = this.count++
            const result = this.queryExecutor('executeConnectionConfiguration', query, params, index)
            if (result !== undefined && result !== null) {
                throw new TsSqlProcessingError({ reason: 'INVALID_MOCKED_VALUE', value: result, index, queryType: 'executeConnectionConfiguration' }, 'Invalid test case result for a executeConnectionConfiguration with index ' + index + '. Your mock function provided to the MockQueryRunner must returns null or undefined')
            }
            return this.promise.resolve(undefined)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    addParam(params: any[], value: any): string {
        const index = params.length
        let result
        switch (this.database) {
            case 'mariaDB':
                result = '?'
                break
            case 'mySql':
                result = '?'
                break
            case 'noopDB':
                result = '$' + index
                break
            case 'oracle':
                result = ':' + index
                break
            case 'postgreSql':
                result = '$' + (index + 1)
                break
            case 'sqlite':
                result = '?'
                break
            case 'sqlServer':
                result = '@' + index
                break
            default:
                throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_DATABASE', database: this.database }, 'Unknown database ' + this.database)
        }
        params.push(value)
        return result
    }
    addOutParam(params: any[], name: string): string {
        if (this.database !== 'oracle') {
            throw new TsSqlProcessingError({ reason: 'OUT_PARAMS_NOT_SUPPORTED' }, 'Unsupported output parameters')
        }
        const index = params.length
        if (name) {
            params.push({dir: 3003 /*oracledb.BIND_OUT*/, as: name}) // See https://github.com/oracle/node-oracledb/blob/master/lib/oracledb.js
        } else {
            params.push({dir: 3003 /*oracledb.BIND_OUT*/}) // See https://github.com/oracle/node-oracledb/blob/master/lib/oracledb.js
        }
        return ':' + index
    }

    executeInTransaction<T>(fn: () => Promise<T>, outermostQueryRunner: QueryRunner, opts: BeginTransactionOpts = []): Promise<T> {
        return outermostQueryRunner.executeBeginTransaction(opts).then(() => {
            let result = fn()
            return result.then((r) => {
                return outermostQueryRunner.executeCommit(opts as any).then(() => {
                    return r
                })
            }, (e) => {
                return outermostQueryRunner.executeRollback(opts as any).then(() => {
                    throw e
                }, () => {
                    // Throw the innermost error
                    throw e
                })
            })
        })
    }
    executeCombined<R1, R2>(fn1: () => Promise<R1>, fn2: () => Promise<R2>): Promise<[R1, R2]> {
        return fn1().then((r1) => {
            return fn2().then((r2) => {
                return [r1, r2]
            })
        })
    }

    createResolvedPromise<RESULT>(result: RESULT): Promise<RESULT> {
        return this.promise.resolve(result) 
    }
    createRejectedPromise<RESULT = any>(error: any): Promise<RESULT> {
        return this.promise.reject(error)
    }

    isMocked(): boolean {
        return true
    }
    lowLevelTransactionManagementSupported(): boolean {
        return true
    }
    nestedTransactionsSupported(): boolean {
        return true
    }
    getErrorReason(error: unknown): TsSqlErrorReason {
        if (error instanceof TsSqlError) {
            return error.errorReason
        }
        return { reason: 'UNKNOWN'}
    }
    isSqlError(error: unknown): boolean {
        return this.isSqlErrorFn(error)
    }
}

function isPlainObject(value: any): boolean {
	if (!value && typeof value !== 'object') {
		return false
	}

	const prototype = Object.getPrototypeOf(value)
	return prototype === null || prototype === Object.prototype
}

function isPlainObjectOrNoValue(value: any): boolean {
    if (value === null || value === undefined) {
        return true
    }

	if (typeof value !== 'object') {
		return false
	}

	const prototype = Object.getPrototypeOf(value)
	return prototype === null || prototype === Object.prototype
}
