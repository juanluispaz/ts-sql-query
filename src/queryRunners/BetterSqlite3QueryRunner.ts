import type { DatabaseType, PromiseProvider } from './QueryRunner.js'
import BetterSqlite3, { type Database } from 'better-sqlite3'
import { SqlTransactionQueryRunner } from './SqlTransactionQueryRunner.js'
import { TsSqlError, TsSqlProcessingError, type TsSqlErrorReason } from "../TsSqlError.js"
import { getSqliteEngineErrorReason } from './databaseErrorMappers/SqliteErrorMapper.js'

export interface BetterSqlite3QueryRunnerConfig {
    promise?: PromiseProvider
}

export class BetterSqlite3QueryRunner extends SqlTransactionQueryRunner {
    readonly database: DatabaseType
    readonly connection: Database
    readonly promise: PromiseProvider

    constructor(connection: Database, config?: BetterSqlite3QueryRunnerConfig) {
        super()
        this.connection = connection
        this.database = 'sqlite'
        this.promise = config?.promise || Promise
    }

    useDatabase(database: DatabaseType): void {
        if (database !== 'sqlite') {
            throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_DATABASE', database }, 'Unsupported database: ' + database + '. BetterSqlite3QueryRunner only supports sqlite databases')
        }
    }

    getNativeRunner(): Database {
        return this.connection
    }

    getCurrentNativeTransaction(): undefined {
        return undefined
    }

    execute<RESULT>(fn: (connection: unknown, transaction?: unknown) => Promise<RESULT>): Promise<RESULT> {
        return fn(this.connection)
    }

    protected executeQueryReturning(query: string, params: any[]): Promise<any[]> {
        try {
            const rows = this.connection.prepare(query).all(params)
            return this.promise.resolve(rows)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    protected executeMutation(query: string, params: any[]): Promise<number> {
        try {
            return this.promise.resolve(this.connection.prepare(query).run(params).changes)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
        if (this.containsInsertReturningClause(query, params)) {
            return super.executeInsertReturningLastInsertedId(query, params)
        }

        try {
            return this.promise.resolve(this.connection.prepare(query).run(params).lastInsertRowid)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    addParam(params: any[], value: any): string {
        if (typeof value === 'boolean') {
            params.push(Number(value))
        } else {
            params.push(value)
        }
        return '?'
    }    
    createResolvedPromise<RESULT>(result: RESULT): Promise<RESULT> {
        return this.promise.resolve(result) 
    }
    createRejectedPromise<RESULT = any>(error: any): Promise<RESULT> {
        return this.promise.reject(error)
    }
    getErrorReason(error: unknown): TsSqlErrorReason {
        return BetterSqlite3QueryRunner.getErrorReason(error)
    }
    isSqlError(error: unknown): boolean {
        return BetterSqlite3QueryRunner.isSqlError(error)
    }

    static getErrorReason(error: unknown): TsSqlErrorReason {
        if (error instanceof TsSqlError) {
            return error.errorReason
        }
        if (!isBetterSqlite3Error(error)) {
            return { reason: 'UNKNOWN' }
        }
        return getBetterSqlite3ErrorReason(error)
    }

    static isSqlError(error: unknown): boolean {
        return error instanceof TsSqlError || isBetterSqlite3Error(error)
    }
}

type BetterSqlite3SqliteError = InstanceType<typeof BetterSqlite3.SqliteError>
type BetterSqlite3DriverError = Error
type BetterSqlite3Error = BetterSqlite3SqliteError | BetterSqlite3DriverError

function getBetterSqlite3ErrorReason(error: BetterSqlite3Error): TsSqlErrorReason {
    if (error instanceof BetterSqlite3.SqliteError) {
        return getBetterSqlite3SqliteErrorReason(error)
    }
    return getBetterSqlite3DriverErrorReason(error) || { reason: 'SQL_UNKNOWN', databaseErrorMessage: error.message || undefined }
}

function getBetterSqlite3SqliteErrorReason(error: BetterSqlite3SqliteError): TsSqlErrorReason {
    return getSqliteEngineErrorReason({ code: error.code, message: error.message })
}

function getBetterSqlite3DriverErrorReason(error: BetterSqlite3DriverError): TsSqlErrorReason | undefined {
    const message = error.message || ''
    const upper = message.toUpperCase()
    const databaseErrorMessage = message || undefined
    const fromBetterSqlite3Stack = isBetterSqlite3Stack(error)

    if (!message) {
        return undefined
    }

    if (message === 'Cannot open database because the directory does not exist'
        || message === 'Cannot save backup because the directory does not exist'
        || message === 'In-memory/temporary databases cannot be readonly') {
        return { reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration', databaseErrorMessage }
    }
    if (message === 'The database connection is not open') {
        return { reason: 'SQL_CONNECTION_ERROR', errorType: 'connection lost', databaseErrorMessage }
    }
    if (message === 'This database connection is busy executing a query'
        || message === 'This statement is busy executing a query') {
        return { reason: 'FORBIDDEN_CONCURRENT_USAGE', databaseErrorMessage }
    }
    if (isBetterSqlite3InvalidParameterMessage(message)) {
        return { reason: 'SQL_INVALID_PARAMETER', databaseErrorMessage }
    }
    if (message === 'The bound string, buffer, or bigint is too big') {
        return { reason: 'SQL_INVALID_VALUE_FOR_COLUMN', errorType: 'too long', databaseErrorMessage }
    }
    if (isBetterSqlite3TooBigReturnedValueMessage(message)) {
        return { reason: 'SQL_INVALID_VALUE_FOR_COLUMN', errorType: 'out of range', databaseErrorMessage }
    }
    if (isBetterSqlite3InvalidReturnedValueMessage(message)) {
        return { reason: 'SQL_INVALID_VALUE_FOR_COLUMN', errorType: 'invalid value', databaseErrorMessage }
    }
    if (message === 'Out of memory' || message === 'Array overflow (too many rows returned)') {
        return { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'memory', databaseErrorMessage }
    }
    if (message === 'Too many active database iterators') {
        return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorMessage }
    }
    if (isBetterSqlite3ApiMisuseMessage(message, fromBetterSqlite3Stack)) {
        return { reason: 'SQL_INTERNAL_ERROR', errorType: 'api misuse', databaseErrorMessage }
    }
    if (upper === 'AN UNEXPECTED ERROR OCCURED WHILE TRYING TO BIND PARAMETERS') {
        return { reason: 'SQL_UNKNOWN', databaseErrorMessage }
    }
    return undefined
}

function isBetterSqlite3Error(error: unknown): error is BetterSqlite3Error {
    if (error instanceof BetterSqlite3.SqliteError) {
        return true
    }
    if (!(error instanceof Error)) {
        return false
    }
    return !!getBetterSqlite3DriverErrorReason(error)
}

function isBetterSqlite3Stack(error: Error): boolean {
    const stack = error.stack || ''
    return stack.includes('node_modules/better-sqlite3/')
        || stack.includes('node_modules\\better-sqlite3\\')
}

function isBetterSqlite3InvalidParameterMessage(message: string): boolean {
    switch (message) {
        case 'Missing named parameters':
        case 'Too few parameter values were provided':
        case 'Too many parameter values were provided':
        case 'SQLite3 can only bind numbers, strings, bigints, buffers, and null':
        case 'You cannot specify named parameters in two different objects':
        case 'Named parameters can only be passed within plain objects':
        case 'This statement already has bound parameters':
            return true
    }
    return /^Missing named parameter ".+"$/.test(message)
}

function isBetterSqlite3TooBigReturnedValueMessage(message: string): boolean {
    return /^User-defined function .+\(\) returned a bigint that was too big$/.test(message)
        || /^Virtual table module ".+" yielded a bigint that was too big$/.test(message)
}

function isBetterSqlite3InvalidReturnedValueMessage(message: string): boolean {
    return /^User-defined function .+\(\) returned an invalid value$/.test(message)
        || /^Virtual table module ".+" yielded an invalid value$/.test(message)
}

function isBetterSqlite3ApiMisuseMessage(message: string, fromBetterSqlite3Stack: boolean): boolean {
    switch (message) {
        case 'Misspelled option "readOnly" should be "readonly"':
        case 'Option "memory" was removed in v7.0.0 (use ":memory:" filename instead)':
        case 'Expected the "timeout" option to be a positive integer':
        case 'Option "timeout" cannot be greater than 2147483647':
        case 'Expected the "verbose" option to be a function':
        case 'Expected the "nativeBinding" option to be a string or addon object':
        case 'The supplied SQL string contains no statements':
        case 'The supplied SQL string contains more than one statement':
        case 'This statement does not return data. Use run() instead':
        case 'The bind() method can only be invoked once per statement object':
        case 'The pluck() method is only for statements that return data':
        case 'The expand() method is only for statements that return data':
        case 'The raw() method is only for statements that return data':
        case 'The columns() method is only for statements that return data':
        case 'Transaction function cannot return a promise':
        case 'Backup filename cannot be an empty string':
        case 'Invalid backup filename ":memory:"':
        case 'Expected the "attached" option to be a string':
        case 'The "attached" option cannot be an empty string':
        case 'Expected the "progress" option to be a function':
        case 'Expected progress callback to return a number or undefined':
        case 'User-defined function name cannot be an empty string':
        case 'User-defined functions cannot have more than 100 arguments':
        case 'Virtual table module name cannot be an empty string':
        case 'Disabled constructor':
        case 'Statements can only be constructed by the db.prepare() method':
            return true
    }
    if (isBetterSqlite3DynamicApiMisuseMessage(message)) {
        return true
    }
    return fromBetterSqlite3Stack && isBetterSqlite3GenericApiMisuseMessage(message)
}

function isBetterSqlite3DynamicApiMisuseMessage(message: string): boolean {
    return /^Expected the ".+" option to be (?:a boolean|a function)$/.test(message)
        || /^Missing required option ".+"$/.test(message)
        || /^Virtual table module ".+" did not return a table definition object$/.test(message)
        || /^Virtual table module ".+" (?:used|returned) a table definition without a "(?:rows|columns)" property$/.test(message)
        || /^Virtual table module ".+" (?:used|returned) a table definition with .+$/.test(message)
        || /^Virtual table module ".+" yielded something that isn't a valid row object$/.test(message)
        || /^Virtual table module ".+" yielded a row with (?:an incorrect number of columns|missing columns)$/.test(message)
        || /^Virtual table module ".+" yielded a row with an undeclared column ".+"$/.test(message)
}

function isBetterSqlite3GenericApiMisuseMessage(message: string): boolean {
    switch (message) {
        case 'Expected a first argument':
        case 'Expected first argument to be a string':
        case 'Expected first argument to be a function':
        case 'Expected first argument to be an options object':
        case 'Expected first argument to be a boolean':
        case 'Expected first argument to be a 32-bit signed integer':
        case 'Expected second argument to be a string':
        case 'Expected second argument to be an object':
        case 'Expected second argument to be an options object':
        case 'Expected second argument to be a function or a table definition object':
        case 'Expected last argument to be a function':
        case 'Expected function.length to be a positive integer':
            return true
    }
    return false
}
