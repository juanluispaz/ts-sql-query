/// <reference types="bun-types" />

import { SQL } from 'bun'
import type { TsSqlErrorReason } from '../../TsSqlError.js'
import { getSqliteEngineErrorReason, getSqliteErrorCodeNumber } from '../databaseErrorMappers/SqliteErrorMapper.js'

type BunSqliteError = InstanceType<typeof SQL.SQLiteError>
type BunSqlError = InstanceType<typeof SQL.SQLError>

export function getBunSqlSqliteErrorReason(error: unknown): TsSqlErrorReason {
    if (isBunSqliteEngineError(error)) {
        return getBunSqliteEngineErrorReason(error)
    }
    if (isBunSqlError(error)) {
        return { reason: 'SQL_UNKNOWN', databaseErrorMessage: error.message || undefined }
    }
    if (isBunSqliteDriverError(error)) {
        return getBunSqliteDriverErrorReason(error)
    }
    return { reason: 'UNKNOWN' }
}

export function isBunSqlSqliteError(error: unknown): boolean {
    return isBunSqliteEngineError(error) || isBunSqlError(error) || isBunSqliteDriverError(error)
}

function getBunSqliteEngineErrorReason(error: BunSqliteError): TsSqlErrorReason {
    const code = error.code
    const databaseErrorNumber = getBunSqliteErrorNumber(error)
    switch (code) {
        case 'ERR_SQLITE_CONNECTION_CLOSED':
        case 'SQLITE_CONNECTION_CLOSED':
            return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode: code, databaseErrorNumber, databaseErrorMessage: error.message, errorType: 'connection lost' }
        case 'ERR_SQLITE_QUERY_CANCELLED':
            return { reason: 'SQL_TIMEOUT', databaseErrorCode: code, databaseErrorNumber, databaseErrorMessage: error.message, timeoutType: 'cancelled' }
        case 'ERR_SQLITE_NOT_TAGGED_CALL':
            return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode: code, databaseErrorNumber, databaseErrorMessage: error.message, parameterErrorType: 'invalid binding' }
        case 'ERR_SQLITE_INVALID_TRANSACTION_STATE':
            return getSqliteEngineErrorReason({ code: 'SQLITE_ERROR', databaseErrorCode: code, databaseErrorNumber, message: error.message })
    }

    if (code.startsWith('SQLITE_')) {
        return getSqliteEngineErrorReason({ code, databaseErrorCode: code, databaseErrorNumber, message: error.message })
    }
    return { reason: 'SQL_UNKNOWN', databaseErrorCode: code, databaseErrorNumber, databaseErrorMessage: error.message }
}

function getBunSqliteErrorNumber(error: BunSqliteError): number | undefined {
    const errno = (error as { errno?: unknown }).errno
    if (typeof errno === 'number' && errno > 0) {
        return errno
    }
    return getSqliteErrorCodeNumber(error.code)
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

function isBunSqliteEngineError(error: unknown): error is BunSqliteError {
    return error instanceof SQL.SQLiteError
}

function isBunSqlError(error: unknown): error is BunSqlError {
    return error instanceof SQL.SQLError
}
