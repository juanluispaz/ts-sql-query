/// <reference types="bun-types" />

import { TsSqlError, TsSqlProcessingError, type TsSqlErrorReason } from '../TsSqlError.js'
import { getSqliteEngineErrorReason } from './databaseErrorMappers/SqliteErrorMapper.js'
import { AbstractBunSqlQueryRunner } from './AbstractBunSqlQueryRunner.js'
import { SQL } from 'bun'

type BunSqliteError = InstanceType<typeof SQL.SQLiteError>
type BunSqlError = InstanceType<typeof SQL.SQLError>

export class BunSqlSqliteQueryRunner extends AbstractBunSqlQueryRunner {
    constructor(connection: SQL) {
        super(connection, 'sqlite')
        const adapter = connection.options.adapter
        if (adapter !== 'sqlite') {
            throw new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name: 'adapter', value: adapter }, 'BunSqlSqliteQueryRunner only supports Bun.SQL connections using the sqlite adapter')
        }
    }
    executeBeginTransactionQuery(query: string, params: any[]): Promise<number> {
        return this.connection.unsafe(query, params).then((result) => result.count)
    }
    executeCommitQuery(query: string, params: any[]): Promise<number> {
        return this.connection.unsafe(query, params).then((result) => result.count)
    }
    executeRollbackQuery(query: string, params: any[]): Promise<number> {
        return this.connection.unsafe(query, params).then((result) => result.count)
    }
    executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
        if (this.containsInsertReturningClause(query, params)) {
            return super.executeInsertReturningLastInsertedId(query, params)
        }

        const sql = this.transaction || this.lowLevelTransaction || this.connection
        return sql.unsafe(query, params).then((result) => result.lastInsertRowid)
    }
    addParam(params: any[], value: any): string {
        params.push(value)
        return '$' + params.length
    }
    getErrorReason(error: unknown): TsSqlErrorReason {
        return BunSqlSqliteQueryRunner.getErrorReason(error)
    }
    isSqlError(error: unknown): boolean {
        return BunSqlSqliteQueryRunner.isSqlError(error)
    }

    static getErrorReason(error: unknown): TsSqlErrorReason {
        if (error instanceof TsSqlError) {
            return error.errorReason
        }
        if (isBunSqliteError(error)) {
            return getBunSqliteErrorReason(error)
        }
        if (isBunSqlError(error)) {
            return { reason: 'SQL_UNKNOWN', databaseErrorMessage: error.message || undefined }
        }
        if (isBunSqliteDriverError(error)) {
            return getBunSqliteDriverErrorReason(error)
        }
        return { reason: 'UNKNOWN' }
    }

    static isSqlError(error: unknown): boolean {
        return error instanceof TsSqlError || isBunSqliteError(error) || isBunSqlError(error) || isBunSqliteDriverError(error)
    }
}

function getBunSqliteErrorReason(error: BunSqliteError): TsSqlErrorReason {
    const code = error.code
    switch (code) {
        case 'ERR_SQLITE_CONNECTION_CLOSED':
        case 'SQLITE_CONNECTION_CLOSED':
            return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode: code, databaseErrorMessage: error.message, errorType: 'connection lost' }
        case 'ERR_SQLITE_QUERY_CANCELLED':
            return { reason: 'SQL_TIMEOUT', databaseErrorCode: code, databaseErrorMessage: error.message, timeoutType: 'cancelled' }
        case 'ERR_SQLITE_NOT_TAGGED_CALL':
            return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode: code, databaseErrorMessage: error.message }
        case 'ERR_SQLITE_INVALID_TRANSACTION_STATE':
            return getSqliteEngineErrorReason({ code: 'SQLITE_ERROR', databaseErrorCode: code, message: error.message })
    }

    if (code.startsWith('SQLITE_')) {
        return getSqliteEngineErrorReason({ code, databaseErrorCode: code, message: error.message })
    }
    return { reason: 'SQL_UNKNOWN', databaseErrorCode: code, databaseErrorMessage: error.message }
}

function getBunSqliteDriverErrorReason(error: Error): TsSqlErrorReason {
    return getKnownBunSqliteDriverErrorReason(error) || { reason: 'SQL_UNKNOWN', databaseErrorMessage: error.message || undefined }
}

function getKnownBunSqliteDriverErrorReason(error: Error): TsSqlErrorReason | undefined {
    const message = error.message || ''
    const databaseErrorMessage = message || undefined

    switch (message) {
        case 'Connection closed':
            return { reason: 'SQL_CONNECTION_ERROR', errorType: 'connection lost', databaseErrorMessage }
        case "This adapter doesn't support connection reservation":
        case "SQLite doesn't support connection reservation (no connection pool)":
        case "This adapter doesn't support distributed transactions.":
        case "SQLite doesn't support distributed transactions.":
        case "SQLite doesn't support flush() - queries are executed synchronously":
        case "SQLite doesn't support arrays":
            return { reason: 'SQL_FEATURE_NOT_SUPPORTED', databaseErrorMessage }
    }

    if (/^SQLite doesn't support '.+' transaction mode\. Use DEFERRED, IMMEDIATE, or EXCLUSIVE\.$/.test(message)) {
        return { reason: 'SQL_FEATURE_NOT_SUPPORTED', databaseErrorMessage }
    }

    return undefined
}

function isBunSqliteDriverError(error: unknown): error is Error {
    if (!(error instanceof Error)) {
        return false
    }
    return !!getKnownBunSqliteDriverErrorReason(error)
}

function isBunSqliteError(error: unknown): error is BunSqliteError {
    return error instanceof SQL.SQLiteError
}

function isBunSqlError(error: unknown): error is BunSqlError {
    return error instanceof SQL.SQLError
}
