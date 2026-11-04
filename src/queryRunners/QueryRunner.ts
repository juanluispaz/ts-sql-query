import type { TsSqlErrorReason, QueryExecutionSource } from "../TsSqlError.js"
import { getQueryExecutionMetadataOf, getQueryExecutionSourceOf, isSelectPageCountQueryParams } from '../utils/queryParamsMetadata.js'

export interface QueryRunner {
    readonly database: DatabaseType
    useDatabase(database: DatabaseType): void
    /** The driver's object the query runner was created with: a connection, or a pool */
    getNativeRunner(): unknown
    /**
     * The driver's connection the current transaction runs on, or undefined outside a transaction. A pool query runner
     * takes it from the pool with the first statement of the transaction, and has none before: execute gives it always
     */
    getCurrentNativeConnection(): unknown
    /**
     * Calls fn with a connection of the driver on which to run statements: inside a transaction, the one the
     * transaction runs on (taken from the pool, and the transaction begun on it, when it had none yet); outside a
     * transaction, the query runner's connection, or one taken from the pool for fn alone and given back when the
     * promise fn returns ends. mssql only gives a connection of its pool for a transaction: outside one, fn receives the
     * pool
     */
    execute<RESULT>(fn: (connection: unknown) => Promise<RESULT>): Promise<RESULT>
    executeSelectOneRow(query: string, params?: any[]): Promise<any>
    executeSelectManyRows(query: string, params?: any[]): Promise<any[]>
    executeSelectOneColumnOneRow(query: string, params?: any[]): Promise<any>
    executeSelectOneColumnManyRows(query: string, params?: any[]): Promise<any[]>
    executeInsert(query: string, params?: any[]): Promise<number>
    executeInsertReturningLastInsertedId(query: string, params?: any[]): Promise<any>
    executeInsertReturningMultipleLastInsertedId(query: string, params?: any[]): Promise<any[]>
    executeInsertReturningOneRow(query: string, params?: any[]): Promise<any>
    executeInsertReturningManyRows(query: string, params?: any[]): Promise<any[]>
    executeInsertReturningOneColumnOneRow(query: string, params?: any[]): Promise<any>
    executeInsertReturningOneColumnManyRows(query: string, params?: any[]): Promise<any[]>
    executeUpdate(query: string, params?: any[]): Promise<number>
    executeUpdateReturningOneRow(query: string, params?: any[]): Promise<any>
    executeUpdateReturningManyRows(query: string, params?: any[]): Promise<any[]>
    executeUpdateReturningOneColumnOneRow(query: string, params?: any[]): Promise<any>
    executeUpdateReturningOneColumnManyRows(query: string, params?: any[]): Promise<any[]>
    executeDelete(query: string, params?: any[]): Promise<number>
    executeDeleteReturningOneRow(query: string, params?: any[]): Promise<any>
    executeDeleteReturningManyRows(query: string, params?: any[]): Promise<any[]>
    executeDeleteReturningOneColumnOneRow(query: string, params?: any[]): Promise<any>
    executeDeleteReturningOneColumnManyRows(query: string, params?: any[]): Promise<any[]>
    executeProcedure(query: string, params?: any[]): Promise<void>
    executeFunction(query: string, params?: any[]): Promise<any>
    executeBeginTransaction(opts?: BeginTransactionOpts): Promise<void>
    executeCommit(opts?: CommitOpts): Promise<void>
    executeRollback(opts?: RollbackOpts): Promise<void>
    executeInTransaction<T>(fn: () => Promise<T>, outermostQueryRunner: QueryRunner, opts?: BeginTransactionOpts): Promise<T>
    isTransactionActive(): boolean
    executeDatabaseSchemaModification(query: string, params?: any[]): Promise<void>
    executeConnectionConfiguration(query: string, params?: any[]): Promise<void>
    addParam(params: any[], value: any): string
    addOutParam(params: any[], name: string): string
    // Resolves a value that may or may not already be a promise into a promise
    // on this runner's configured provider — like `Promise.resolve`, it adopts a
    // thenable and wraps a plain value, both yielding `Promise<RESULT>`. Keeping
    // the result on the runner's own provider is what lets a synchronous provider
    // (e.g. `SynchronousPromise`) drive the whole chain without deferring.
    createResolvedPromise<RESULT>(result: RESULT | PromiseLike<RESULT>): Promise<RESULT>
    createRejectedPromise<RESULT = any>(error: any): Promise<RESULT>
    executeCombined<R1, R2>(fn1: () => Promise<R1>, fn2: () => Promise<R2>): Promise<[R1, R2]>
    isMocked(): boolean
    lowLevelTransactionManagementSupported(): boolean
    nestedTransactionsSupported(): boolean
    getErrorReason(error: unknown): TsSqlErrorReason
    isSqlError(error: unknown): boolean
}

export type DatabaseType = 'mariaDB' | 'mySql' | 'noopDB' | 'oracle' | 'postgreSql' | 'sqlite' | 'sqlServer'

export type QueryType = 'selectOneRow' | 'selectManyRows' | 'selectOneColumnOneRow' | 'selectOneColumnManyRows' |
    'insert' | 'insertReturningLastInsertedId' | 'insertReturningMultipleLastInsertedId' |
    'insertReturningOneRow' | 'insertReturningManyRows' | 'insertReturningOneColumnOneRow' | 'insertReturningOneColumnManyRows' |
    'update' | 'updateReturningOneRow' | 'updateReturningManyRows' | 'updateReturningOneColumnOneRow' | 'updateReturningOneColumnManyRows' |
    'delete' | 'deleteReturningOneRow' | 'deleteReturningManyRows' | 'deleteReturningOneColumnOneRow' | 'deleteReturningOneColumnManyRows' |
    'executeProcedure' | 'executeFunction' | 'beginTransaction' | 'commit' | 'rollback' | 
    'executeDatabaseSchemaModification' | 'executeConnectionConfiguration'

export type PromiseProvider = PromiseConstructorLike & {
    resolve: typeof Promise.resolve,
    reject: typeof Promise.reject,
    /* Not all providers have compatible interface, by example:
        * synchronous-promise doesn't provide an definition so detailed like the ones included in the standar library
        */
    // all: typeof Promise.all, 
    // all(values: any[]): Promise<any[]>, 
    /* Not all providers support it, by example: 
        * synchronous-promise doesn't provide an implementation of it
        */
    // race: typeof Promise.race, 
    /* So new, introduced in ES2020. Not all providers have compatible interface, by example:
        * synchronous-promise doesn't provide an definition compatible with the ones included in the standar library
        */
    // allSettled: typeof Promise.allSettled
}

// `[undefined, accessMode]` when only an access mode was requested
export type BeginTransactionOpts = [transactionLevel?: 'read uncommitted' | 'read committed' | 'repeatable read' | 'snapshot' | 'serializable' | undefined, accessMode?: 'read write' | 'read only' | undefined]
export type CommitOpts = []
export type RollbackOpts = []

export function getQueryExecutionName(query: string, params: any[]): string | undefined {
    query
    return getQueryExecutionMetadataOf(params)?.queryExecutionName
}
export function getQueryExecutionMetadata(query: string, params: any[]): unknown {
    query
    return getQueryExecutionMetadataOf(params)?.queryExecutionMetadata
}
export function getQueryExecutionSource(query: string, params: any[]): QueryExecutionSource | undefined {
    query
    return getQueryExecutionSourceOf(params)
}
export function getQueryExecutionStack(query: string, params: any[]): string | undefined {
    query
    return getQueryExecutionSourceOf(params)?.stack
}
export interface FunctionExecutingQueryInformation {
    functionName?: string | undefined,
    fileName?: string | undefined,
    lineNumber?: string | undefined,
    positionNumber?: string | undefined
}
export function getFunctionExecutingQuery(query: string, params: any[]): FunctionExecutingQueryInformation | undefined {
    const stack = getQueryExecutionStack(query, params)
    if (!stack) {
        return undefined
    }
    const lineRegex = /^.+?\n.+?\n\s+?at(?: async)? (.+?)(?: (?:\((.+?)\)))?$/m
    const lineMatch = stack.match(lineRegex)
    if (!lineMatch) {
        return undefined
    }
    let functionName = lineMatch[1]
    if (!functionName) {
        return undefined
    }
    let file = lineMatch[2]
    if (!file) {
        file = functionName
        functionName = undefined
    }
    if (functionName === '<anonymous>') {
        functionName = undefined
    }
    if (file === '<anonymous>') {
        return undefined
    }
    const fileRegex = /^(.+?)(?:\:(\d+?)(?:\:(\d+?))?)?$/
    const fileMatch = file.match(fileRegex)
    if (!fileMatch) {
        return { functionName }
    }
    const result = {
        functionName,
        fileName: fileMatch[1], 
        lineNumber: fileMatch[2], 
        positionNumber: fileMatch[3]
    }
    return result
}
export function isSelectPageCountQuery(query: string, params: any[]): boolean {
    query
    return isSelectPageCountQueryParams(params)
}