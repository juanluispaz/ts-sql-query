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
type BetterSqlite3DriverError = TypeError
type BetterSqlite3Error = BetterSqlite3SqliteError | BetterSqlite3DriverError

function getBetterSqlite3ErrorReason(error: BetterSqlite3Error): TsSqlErrorReason {
    if (error instanceof BetterSqlite3.SqliteError) {
        return getBetterSqlite3SqliteErrorReason(error)
    }
    return getBetterSqlite3DriverErrorReason(error)
}

function getBetterSqlite3SqliteErrorReason(error: BetterSqlite3SqliteError): TsSqlErrorReason {
    return getSqliteEngineErrorReason({ code: error.code, message: error.message })
}

function getBetterSqlite3DriverErrorReason(error: BetterSqlite3DriverError): TsSqlErrorReason {
    const message = error.message || ''
    const upper = message.toUpperCase()

    if (upper.includes('CANNOT OPEN DATABASE BECAUSE THE DIRECTORY DOES NOT EXIST')) {
        return { reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration' }
    }
    if (upper.includes('IN-MEMORY/TEMPORARY DATABASES CANNOT BE READONLY')) {
        return { reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration' }
    }
    if (upper.includes('DATABASE CONNECTION IS NOT OPEN')) {
        return { reason: 'SQL_CONNECTION_ERROR', errorType: 'connection lost' }
    }
    if (upper.includes('DATABASE CONNECTION IS BUSY EXECUTING A QUERY') || upper.includes('STATEMENT IS BUSY EXECUTING A QUERY')) {
        return { reason: 'FORBIDDEN_CONCURRENT_USAGE' }
    }
    if (upper.includes('MISSING NAMED PARAMETERS')) {
        return { reason: 'SQL_INVALID_PARAMETER' }
    }
    if (upper.includes('SQLITE3 CAN ONLY BIND NUMBERS, STRINGS, BIGINTS, BUFFERS, AND NULL')) {
        return { reason: 'SQL_INVALID_PARAMETER' }
    }
    if (upper.includes('YOU CANNOT SPECIFY NAMED PARAMETERS IN TWO DIFFERENT OBJECTS')) {
        return { reason: 'SQL_INVALID_PARAMETER' }
    }
    if (upper.includes('NAMED PARAMETERS CAN ONLY BE PASSED WITHIN PLAIN OBJECTS')) {
        return { reason: 'SQL_INVALID_PARAMETER' }
    }
    return { reason: 'SQL_UNKNOWN' }
}

function isBetterSqlite3Error(error: unknown): error is BetterSqlite3Error {
    if (error instanceof BetterSqlite3.SqliteError) {
        return true
    }
    if (!(error instanceof TypeError)) {
        return false
    }
    const message = (error.message || '').toUpperCase()
    if (message.includes('CANNOT OPEN DATABASE BECAUSE THE DIRECTORY DOES NOT EXIST')) {
        return true
    }
    if (message.includes('IN-MEMORY/TEMPORARY DATABASES CANNOT BE READONLY')) {
        return true
    }
    return message.includes('DATABASE CONNECTION IS NOT OPEN')
        || message.includes('DATABASE CONNECTION IS BUSY EXECUTING A QUERY')
        || message.includes('STATEMENT IS BUSY EXECUTING A QUERY')
        || message.includes('MISSING NAMED PARAMETERS')
        || message.includes('SQLITE3 CAN ONLY BIND NUMBERS, STRINGS, BIGINTS, BUFFERS, AND NULL')
        || message.includes('YOU CANNOT SPECIFY NAMED PARAMETERS IN TWO DIFFERENT OBJECTS')
        || message.includes('NAMED PARAMETERS CAN ONLY BE PASSED WITHIN PLAIN OBJECTS')
}
