/// <reference types="bun-types" />

import type { DatabaseType, PromiseProvider } from './QueryRunner.js'
import { type Database, SQLiteError } from 'bun:sqlite'
import { SqlTransactionQueryRunner } from './SqlTransactionQueryRunner.js'
import { TsSqlError, TsSqlProcessingError, type TsSqlErrorReason } from "../TsSqlError.js"
import { getSqliteEngineErrorReason } from './databaseErrorMappers/SqliteErrorMapper.js'

export interface BunSqliteQueryRunnerConfig {
    promise?: PromiseProvider
}

export class BunSqliteQueryRunner extends SqlTransactionQueryRunner {
    readonly database: DatabaseType
    readonly connection: Database
    readonly promise: PromiseProvider

    constructor(connection: Database, config?: BunSqliteQueryRunnerConfig) {
        super()
        this.connection = connection
        this.database = 'sqlite'
        this.promise = config?.promise || Promise
    }

    useDatabase(database: DatabaseType): void {
        if (database !== 'sqlite') {
            throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_DATABASE', database }, 'Unsupported database: ' + database + '. BunSqliteQueryRunner only supports sqlite databases')
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
            const rows = this.connection.prepare(query).all(...params)
            return this.promise.resolve(rows)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    protected executeMutation(query: string, params: any[]): Promise<number> {
        try {
            return this.promise.resolve(this.connection.prepare(query).run(...params).changes)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
        if (this.containsInsertReturningClause(query, params)) {
            return super.executeInsertReturningLastInsertedId(query, params)
        }

        try {
            return this.promise.resolve(this.connection.prepare(query).run(...params).lastInsertRowid)
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
        return BunSqliteQueryRunner.getErrorReason(error)
    }
    isSqlError(error: unknown): boolean {
        return BunSqliteQueryRunner.isSqlError(error)
    }

    static getErrorReason(error: unknown): TsSqlErrorReason {
        if (error instanceof TsSqlError) {
            return error.errorReason
        }
        if (isBunSqliteError(error)) {
            return getBunSqliteErrorReason(error)
        }
        if (isBunSqliteDriverError(error)) {
            return getBunSqliteDriverErrorReason(error)
        }
        return { reason: 'UNKNOWN' }
    }

    static isSqlError(error: unknown): boolean {
        return error instanceof TsSqlError || isBunSqliteError(error) || isBunSqliteDriverError(error)
    }
}

function getBunSqliteErrorReason(error: SQLiteError): TsSqlErrorReason {
    return getSqliteEngineErrorReason({ code: error.code, message: error.message })
}

function getBunSqliteDriverErrorReason(error: Error): TsSqlErrorReason {
    const message = error.message || ''
    const upper = message.toUpperCase()

    if (upper.includes('CANNOT OPEN DATABASE BECAUSE THE DIRECTORY DOES NOT EXIST')) {
        return { reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration', databaseErrorMessage: message || undefined }
    }
    if (upper.includes('IN-MEMORY/TEMPORARY DATABASES CANNOT BE READONLY')) {
        return { reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration', databaseErrorMessage: message || undefined }
    }
    if (upper.includes('DATABASE CONNECTION IS NOT OPEN')) {
        return { reason: 'SQL_CONNECTION_ERROR', errorType: 'connection lost', databaseErrorMessage: message || undefined }
    }
    if (upper.includes('DATABASE CONNECTION IS BUSY EXECUTING A QUERY') || upper.includes('STATEMENT IS BUSY EXECUTING A QUERY')) {
        return { reason: 'FORBIDDEN_CONCURRENT_USAGE', databaseErrorMessage: message || undefined }
    }
    if (upper === 'STATEMENT HAS FINALIZED') {
        return { reason: 'SQL_CONNECTION_ERROR', errorType: 'connection lost', databaseErrorMessage: message || undefined }
    }
    if (upper.includes('EXPECTED OBJECT OR ARRAY')) {
        return { reason: 'SQL_INVALID_PARAMETER', databaseErrorMessage: message || undefined }
    }
    if (upper.startsWith('MISSING PARAMETER "')) {
        return { reason: 'SQL_INVALID_PARAMETER', databaseErrorMessage: message || undefined }
    }
    if (upper.includes('BINDING EXPECTED STRING, TYPEDARRAY, BOOLEAN, NUMBER, BIGINT OR NULL')) {
        return { reason: 'SQL_INVALID_PARAMETER', databaseErrorMessage: message || undefined }
    }
    if (upper === 'EXPECTED STRING') {
        return { reason: 'SQL_INVALID_PARAMETER', databaseErrorMessage: message || undefined }
    }
    if (upper.startsWith('BIGINT VALUE ') && upper.includes(' IS OUT OF RANGE')) {
        return { reason: 'SQL_INVALID_PARAMETER', databaseErrorMessage: message || undefined }
    }
    if (upper.includes('OUT OF MEMORY')) {
        return { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'memory', databaseErrorMessage: message || undefined }
    }
    return { reason: 'SQL_UNKNOWN', databaseErrorMessage: message || undefined }
}

function isBunSqliteDriverError(error: unknown): error is Error {
    if (!(error instanceof Error)) {
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
        || message === 'STATEMENT HAS FINALIZED'
        || message.includes('EXPECTED OBJECT OR ARRAY')
        || message.startsWith('MISSING PARAMETER "')
        || message.includes('BINDING EXPECTED STRING, TYPEDARRAY, BOOLEAN, NUMBER, BIGINT OR NULL')
        || message === 'EXPECTED STRING'
        || (message.startsWith('BIGINT VALUE ') && message.includes(' IS OUT OF RANGE'))
        || message.includes('OUT OF MEMORY')
}

function isBunSqliteError(error: unknown): error is SQLiteError {
    return error instanceof SQLiteError
}
