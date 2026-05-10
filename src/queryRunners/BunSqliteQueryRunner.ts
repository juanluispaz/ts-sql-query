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
    return getKnownBunSqliteDriverErrorReason(error) || { reason: 'SQL_UNKNOWN', databaseErrorMessage: error.message || undefined }
}

function getKnownBunSqliteDriverErrorReason(error: Error): TsSqlErrorReason | undefined {
    const message = error.message || ''
    const databaseErrorMessage = message || undefined
    const upper = message.toUpperCase()

    if (upper.includes('CANNOT OPEN AN ANONYMOUS DATABASE IN READ-ONLY MODE')) {
        return { reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration', databaseErrorMessage }
    }
    if (upper.includes('MISSPELLED OPTION "READONLY" SHOULD BE "READONLY"')) {
        return { reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration', databaseErrorMessage }
    }
    if (upper.includes("EXPECTED 'FILENAME' TO BE A STRING")) {
        return { reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration', databaseErrorMessage }
    }

    if (upper.includes('CANNOT USE A CLOSED DATABASE') || upper.includes('DATABASE HAS CLOSED') || upper.includes("CAN'T DO THIS ON A CLOSED DATABASE")) {
        return { reason: 'SQL_CONNECTION_ERROR', errorType: 'connection lost', databaseErrorMessage }
    }
    if (upper === 'DATABASE IS LOCKED') {
        return { reason: 'SQL_TIMEOUT', timeoutType: 'database file busy', databaseErrorMessage }
    }

    if (upper === 'STATEMENT HAS FINALIZED') {
        return { reason: 'SQL_INTERNAL_ERROR', errorType: 'api misuse', databaseErrorMessage }
    }
    if (upper.includes('INVALID DATABASE HANDLE')) {
        return { reason: 'SQL_INTERNAL_ERROR', errorType: 'api misuse', databaseErrorMessage }
    }
    if (upper.includes("SQL STRING MUSTN'T BE BLANK") || upper.includes('SQL QUERY CANNOT BE EMPTY') || upper.includes('QUERY CONTAINED NO VALID SQL STATEMENT') || upper.includes('INVALID SQL STATEMENT')) {
        return { reason: 'SQL_INTERNAL_ERROR', errorType: 'api misuse', databaseErrorMessage }
    }

    if (upper.startsWith('SQLITE QUERY EXPECTED ') && upper.includes(' VALUES, RECEIVED ')) {
        return { reason: 'SQL_INVALID_PARAMETER', databaseErrorMessage }
    }
    if (upper.startsWith('MISSING PARAMETER "')) {
        return { reason: 'SQL_INVALID_PARAMETER', databaseErrorMessage }
    }
    if (upper.includes('EXPECTED BINDINGS TO BE AN OBJECT OR ARRAY')) {
        return { reason: 'SQL_INVALID_PARAMETER', databaseErrorMessage }
    }
    if (upper.includes('EXPECTED OBJECT OR ARRAY')) {
        return { reason: 'SQL_INVALID_PARAMETER', databaseErrorMessage }
    }
    if (upper === 'EXPECTED ARRAY') {
        return { reason: 'SQL_INVALID_PARAMETER', databaseErrorMessage }
    }
    if (upper.includes('BINDING EXPECTED STRING, TYPEDARRAY, BOOLEAN, NUMBER, BIGINT OR NULL')) {
        return { reason: 'SQL_INVALID_PARAMETER', databaseErrorMessage }
    }
    if (upper === 'EXPECTED STRING') {
        return { reason: 'SQL_INVALID_PARAMETER', databaseErrorMessage }
    }

    if (upper.startsWith('BIGINT VALUE ') && upper.includes(' IS OUT OF RANGE')) {
        return { reason: 'SQL_INVALID_VALUE', errorType: 'out of range', databaseErrorMessage }
    }
    if (upper.includes('OUT OF MEMORY') || upper.includes('FAILED TO ALLOCATE MEMORY')) {
        return { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'memory', databaseErrorMessage }
    }

    return undefined
}

function isBunSqliteDriverError(error: unknown): error is Error {
    if (!(error instanceof Error)) {
        return false
    }
    return !!getKnownBunSqliteDriverErrorReason(error)
}

function isBunSqliteError(error: unknown): error is SQLiteError {
    return error instanceof SQLiteError
}
