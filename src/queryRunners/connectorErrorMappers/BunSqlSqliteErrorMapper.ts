/// <reference types="bun-types" />

import { SQL } from 'bun'
import type { TsSqlErrorReason } from '../../TsSqlError.js'
import { getSqliteEngineErrorReason, getSqliteErrorCodeNumber } from '../databaseErrorMappers/SqliteErrorMapper.js'

/** An error Bun SQL raises for SQLite (its `SQL.SQLiteError` class), with a code. */
type BunSqliteError = InstanceType<typeof SQL.SQLiteError>
/** A generic error of Bun SQL (its `SQL.SQLError` class). */
type BunSqlError = InstanceType<typeof SQL.SQLError>

/**
 * Gives the `TsSqlErrorReason` of an error raised through Bun SQL on SQLite: the engine's for a `SQLiteError`,
 * `SQL_UNKNOWN` for another `SQLError`, the driver's for a known message, and `UNKNOWN` when it isn't an error of that
 * driver.
 */
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

/**
 * Tells whether the error comes from Bun SQL on SQLite: a `SQLiteError`, a `SQLError`, or an `Error` whose message is
 * one the driver raises.
 */
export function isBunSqlSqliteError(error: unknown): boolean {
    return isBunSqliteEngineError(error) || isBunSqlError(error) || isBunSqliteDriverError(error)
}

/**
 * Gives the reason of a `SQLiteError` of Bun SQL. The codes Bun gives itself (closed connection, cancelled query, a
 * call that isn't a tagged template, an invalid transaction state) are mapped here; a `SQLITE_` code goes to
 * `getSqliteEngineErrorReason`; any other gives `SQL_UNKNOWN`.
 */
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
            return { reason: 'TRANSACTION_ERROR', databaseErrorCode: code, databaseErrorNumber, databaseErrorMessage: error.message, transactionErrorType: 'invalid state' }
    }

    if (code.startsWith('SQLITE_')) {
        return getSqliteEngineErrorReason({ code, databaseErrorCode: code, databaseErrorNumber, message: error.message })
    }
    return { reason: 'SQL_UNKNOWN', databaseErrorCode: code, databaseErrorNumber, databaseErrorMessage: error.message }
}

/**
 * Gives the SQLite result code number of the error: its `errno` when it is a positive number, otherwise the number of
 * its `code`.
 */
function getBunSqliteErrorNumber(error: BunSqliteError): number | undefined {
    const errno = (error as { errno?: unknown }).errno
    if (typeof errno === 'number' && errno > 0) {
        return errno
    }
    return getSqliteErrorCodeNumber(error.code)
}

/**
 * Gives the reason of an error Bun SQL raises itself on SQLite, or `SQL_UNKNOWN` with its message when the message
 * isn't known.
 */
function getBunSqliteDriverErrorReason(error: Error): TsSqlErrorReason {
    return getKnownBunSqliteDriverErrorReason(error) || { reason: 'SQL_UNKNOWN', databaseErrorMessage: error.message || undefined }
}

/**
 * Gives the reason of an error Bun SQL raises itself on SQLite, recognised by its exact message: a closed connection, a
 * feature the SQLite adapter doesn't offer, or a wrong number of parameters (mapped with `getSqliteEngineErrorReason`);
 * `undefined` when the message isn't one of them.
 */
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

    if (/^SQLite query expected \d+ values?, received \d+$/.test(message)) {
        return getSqliteEngineErrorReason({ message })
    }
    if (/^SQLite doesn't support '.+' transaction mode\. Use DEFERRED, IMMEDIATE, or EXCLUSIVE\.$/.test(message)) {
        return { reason: 'SQL_FEATURE_NOT_SUPPORTED', databaseErrorMessage }
    }

    return undefined
}

/** Tells whether the error is an `Error` whose message is one Bun SQL raises itself on SQLite. */
function isBunSqliteDriverError(error: unknown): error is Error {
    if (!(error instanceof Error)) {
        return false
    }
    return !!getKnownBunSqliteDriverErrorReason(error)
}

/** Tells whether the error is a `SQLiteError` of Bun SQL. */
function isBunSqliteEngineError(error: unknown): error is BunSqliteError {
    return error instanceof SQL.SQLiteError
}

/** Tells whether the error is a `SQLError` of Bun SQL. */
function isBunSqlError(error: unknown): error is BunSqlError {
    return error instanceof SQL.SQLError
}
