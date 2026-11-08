import type { TsSqlErrorReason, QueryExecutionSource } from "../TsSqlError.js"
import type { TypeCategory } from '../TypeAdapter.js'
import { getParamForceTypeCastAt, getParamTypeAt, getParamTypeCategoryAt, getQueryConnectionConfigurationOf, getQueryExecutionMetadataOf, getQueryExecutionSourceOf, getQueryResultColumnsOf, isSelectPageCountQueryParams, setParamTypeAt } from '../utils/queryParamsMetadata.js'

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
    /**
     * Adds the value to the params and returns its placeholder, the final one as it is written in the SQL. A query
     * runner that adds it keeps its type with `setQueryParamType`, at the index of the value; one that delegates to
     * another passes the type on. forceTypeCast tells the database must receive the type of the parameter, because the
     * position where it is written in the SQL gives it none: the query runner writes a cast in the placeholder, or
     * sends the parameter with its type when the driver can.
     */
    addParam(params: any[], value: any, type: string, typeCategory: TypeCategory, forceTypeCast: boolean): string
    addOutParam(params: any[], name: string, type: string, typeCategory: TypeCategory, forceTypeCast: boolean): string
    // Resolves a value that may or may not already be a promise into a promise
    // on this runner's configured provider — like `Promise.resolve`, it adopts a
    // thenable and wraps a plain value, both yielding `Promise<RESULT>`. Keeping
    // the result on the runner's own provider is what lets a synchronous provider
    // (e.g. `SynchronousPromise`) drive the whole chain without deferring.
    createResolvedPromise<RESULT>(result: RESULT | PromiseLike<RESULT>): Promise<RESULT>
    createRejectedPromise<RESULT = any>(error: any): Promise<RESULT>
    executeCombined<R1, R2>(fn1: () => Promise<R1>, fn2: () => Promise<R2>): Promise<[R1, R2]>
    isMocked(): boolean
    /** Whether connection.beginTransaction(), commit() and rollback() can be used, as separate calls. */
    lowLevelTransactionManagementSupported(): boolean
    /**
     * Whether executeInTransaction goes through executeBeginTransaction, executeCommit and executeRollback of the
     * outermost query runner. When the driver begins and ends the transaction by itself, in a function it receives, a
     * wrapper doesn't see those statements, and it must show them itself.
     */
    executeInTransactionCallsBeginAndCommit(): boolean
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

/**
 * Keeps the type name, the type category and the forceTypeCast of the parameter at that index of the params: the query
 * runner calls it when it adds the parameter, in `addParam` and `addOutParam`.
 */
export function setQueryParamType(params: any[], index: number, type: string, typeCategory: TypeCategory, forceTypeCast: boolean): void {
    setParamTypeAt(params, index, type, typeCategory, forceTypeCast)
}
/** The type name of the parameter at that index, or undefined when it was added without it */
export function getQueryParamType(query: string, params: any[], index: number): string | undefined {
    query
    return getParamTypeAt(params, index)
}
/** The type category of the parameter at that index, or undefined when it was added without it */
export function getQueryParamTypeCategory(query: string, params: any[], index: number): TypeCategory | undefined {
    query
    return getParamTypeCategoryAt(params, index)
}
/**
 * Whether the database must receive the type of the parameter at that index (the forceTypeCast given to `addParam`), or
 * undefined when it was added without it
 */
export function getQueryParamForceTypeCast(query: string, params: any[], index: number): boolean | undefined {
    query
    return getParamForceTypeCastAt(params, index)
}
/**
 * The configuration of the connection that executes a query: the connection itself, as its SQL builder reads it, so
 * each value is the one the connection has when it is read, field initialisers of a subclass included. A setting that
 * a database doesn't have is undefined on its connection.
 */
export interface ConnectionConfiguration {
    /** Whether an empty string is a value (`allowEmptyString`); when false, the library treats it as no value */
    readonly allowEmptyString: boolean
    /**
     * The identifier written in the SQL: quoted when it is a reserved word or has a space, or, when `strict`, when it
     * isn't made only of letters, digits and underscores
     */
    escape(identifier: string, strict: boolean): string
    /** The collation the insensitive operations use (`insensitiveCollation`) */
    readonly insensitiveCollation?: string
    /** SQLite: the format a value of the type `'date'`, `'time'` or `'dateTime'` is stored with */
    getDateTimeFormat?(type: string): string
    /** The minimum version of the database the SQL must support (`compatibilityVersion`) */
    readonly compatibilityVersion: number
    /** MariaDB, MySQL, Oracle and SQLite: how a uuid is stored (`uuidStrategy`) */
    readonly uuidStrategy?: string
    /** MariaDB, MySQL and PostgreSQL: round with the function of the database as it is (`usePlatformDependentRound`) */
    readonly usePlatformDependentRound?: boolean
    /** PostgreSQL: write the insensitive comparisons with `like` instead of `ilike` (`useLikeInsteadOfIlike`) */
    readonly useLikeInsteadOfIlike?: boolean
    /** SQLite: the date and time functions of the database work in the time zone of the application */
    readonly sqliteRunsInApplicationTimeZone?: boolean
    /** SQLite: an integer read where a date or time with another format was expected is a Julian day */
    readonly treatUnexpectedIntegerDateTimeAsJulian?: boolean
    /** SQLite: a text without time zone read where a date or time with another format was expected is in UTC */
    readonly treatUnexpectedStringDateTimeAsUTC?: boolean
    /** SQLite: a Unix time read where a date or time with another format was expected is in milliseconds */
    readonly unexpectedUnixDateTimeAreMilliseconds?: boolean
    /** SQL Server: the length of a text excludes its trailing blanks (`excludeTrailingBlanksInLength`) */
    readonly excludeTrailingBlanksInLength?: boolean
    /** PostgreSQL and SQL Server: the smaller and greater of two values ignore a null (`ignoreNullInMinAndMaxValue`) */
    readonly ignoreNullInMinAndMaxValue?: boolean
    /** PostgreSQL and SQL Server: the function of yours that gives the smaller of two values (`minValueFunction`) */
    readonly minValueFunction?: string
    /** PostgreSQL and SQL Server: the function of yours that gives the greater of two values (`maxValueFunction`) */
    readonly maxValueFunction?: string
    /** Oracle: a concatenation reads a null as the empty string (`ignoreNullInConcat`) */
    readonly ignoreNullInConcat?: boolean
    /** Oracle: the function of yours that concatenates propagating a null (`concatFunction`) */
    readonly concatFunction?: string
    /** Oracle and SQL Server: the collation of `replace` (`replaceCollation`) */
    readonly replaceCollation?: string | undefined
    /** Oracle: the collation of the insensitive `replace` (`replaceInsensitiveCollation`) */
    readonly replaceInsensitiveCollation?: string | undefined
    /** SQLite: the function of yours that replaces ignoring case (`replaceAllInsensitiveFunction`) */
    readonly replaceAllInsensitiveFunction?: string | undefined
}

/**
 * A column of the result of the query, as the query builder will read it: the key of the column in a row the database
 * returns, the property path in the result object, and the type name and type category its value is converted with.
 */
export interface QueryResultColumn {
    /** The key of the column in a row returned by the database; '' when the SQL gives the column no alias */
    readonly name: string
    /** The property path in the result object (`customer.name`), `result` for a single value, '' without one */
    readonly path: string
    /** The type name (`int`, `Money`, `aggregatedArray`, …) */
    readonly type: string
    /** The type category; '' for an aggregated array (a JSON text whose values the library converts) */
    readonly typeCategory: TypeCategory
}

/**
 * The columns of the result of the query, in the order of its select list, each with the key it has in a row returned
 * by the database, its property path in the result, its type name and its type category; an empty array when the
 * query returns no columns, or undefined when the library didn't build the query
 */
export function getQueryResultColumns(query: string, params: any[]): readonly QueryResultColumn[] | undefined {
    query
    return getQueryResultColumnsOf(params)
}
/** The column of the result of the query with that key in a row returned by the database, or undefined */
export function getQueryResultColumn(query: string, params: any[], name: string): QueryResultColumn | undefined {
    query
    return getQueryResultColumnsOf(params)?.find(column => column.name === name)
}
/**
 * The configuration of the connection that executes the query (the connection itself, whose values are read when
 * used), or undefined when the library didn't build the query
 */
export function getQueryConnectionConfiguration(query: string, params: any[]): ConnectionConfiguration | undefined {
    query
    return getQueryConnectionConfigurationOf(params)
}
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