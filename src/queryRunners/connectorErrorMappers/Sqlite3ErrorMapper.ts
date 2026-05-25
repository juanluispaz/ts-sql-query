import type { TsSqlDatabaseErrorCode, TsSqlDatabaseErrorNumber, TsSqlErrorReason } from '../../TsSqlError.js'
import { getSqliteEngineErrorReason, getSqliteErrorCodeName, getSqliteErrorCodeNumber } from '../databaseErrorMappers/SqliteErrorMapper.js'

export function getSqlite3ErrorReason(error: unknown): TsSqlErrorReason {
    if (!isSqlite3Error(error)) {
        return { reason: 'UNKNOWN' }
    }
    return getSqlite3DriverErrorReason(error)
}

export function isSqlite3Error(error: unknown): error is Sqlite3Error {
    return !!error && error instanceof Error && (
        isSqlite3CodedError(error)
        || isSqlite3DriverMessage(error.message || '')
    )
}

type Sqlite3Error = Error & {
    errno?: number | undefined
    code?: string | undefined
}

function getSqlite3DriverErrorReason(error: Sqlite3Error): TsSqlErrorReason {
    const databaseErrorCode = getSqlite3DatabaseErrorCode(error)
    const databaseErrorNumber = getSqlite3DatabaseErrorNumber(error)
    const databaseErrorMessage = error.message || undefined
    const message = error.message || ''
    const upper = message.toUpperCase()

    if (upper.includes('DATABASE IS NOT OPEN')
            || upper.includes('DATABASE IS CLOSING')
            || upper.includes('DATABASE IS CLOSED')
            || upper.includes('DATABASE HANDLE IS CLOSED')) {
        return { reason: 'SQL_CONNECTION_ERROR', errorType: 'connection lost', databaseErrorCode, databaseErrorNumber, databaseErrorMessage }
    }
    if (upper.includes('DATA TYPE IS NOT SUPPORTED')) {
        return { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid type', databaseErrorCode, databaseErrorNumber, databaseErrorMessage }
    }
    if (upper.includes('STATEMENT IS ALREADY FINALIZED')) {
        return { reason: 'SQL_INTERNAL_ERROR', errorType: 'api misuse', databaseErrorCode, databaseErrorNumber, databaseErrorMessage }
    }
    if (upper.includes('SQL QUERY EXPECTED') || upper.includes('CALLBACK EXPECTED')) {
        return { reason: 'SQL_INTERNAL_ERROR', errorType: 'api misuse', databaseErrorCode, databaseErrorNumber, databaseErrorMessage }
    }

    return getSqliteEngineErrorReason({ code: getSqlite3ErrorCode(error), databaseErrorCode, databaseErrorNumber, message })
}

function getSqlite3DatabaseErrorCode(error: Sqlite3Error): TsSqlDatabaseErrorCode | undefined {
    const code = getSqlite3ErrorCode(error)
    if (code) {
        return code
    }
    if (typeof error.errno === 'number') {
        return getSqliteErrorCodeName(error.errno)
    }
    return undefined
}

function getSqlite3DatabaseErrorNumber(error: Sqlite3Error): TsSqlDatabaseErrorNumber | undefined {
    if (typeof error.errno === 'number') {
        return error.errno
    }
    return getSqliteErrorCodeNumber(getSqlite3ErrorCode(error))
}

function getSqlite3ErrorCode(error: Sqlite3Error): string | undefined {
    if (error.code && error.code !== 'UNKNOWN') {
        return error.code
    }
    if (typeof error.errno === 'number') {
        return getSqliteErrorCodeName(error.errno)
    }
    return undefined
}

function isSqlite3CodedError(error: unknown): error is Sqlite3Error {
    const sqliteError = error as Sqlite3Error
    if (typeof sqliteError.code === 'string') {
        return sqliteError.code.startsWith('SQLITE_')
            || (sqliteError.code === 'UNKNOWN' && typeof sqliteError.errno === 'number')
    }
    return typeof sqliteError.errno === 'number' && !!getSqliteErrorCodeName(sqliteError.errno)
}

function isSqlite3DriverMessage(message: string): boolean {
    const upper = message.toUpperCase()
    return upper.includes('DATABASE IS NOT OPEN')
        || upper.includes('DATABASE IS CLOSING')
        || upper.includes('DATABASE IS CLOSED')
        || upper.includes('DATABASE HANDLE IS CLOSED')
        || upper.includes('DATA TYPE IS NOT SUPPORTED')
        || upper.includes('STATEMENT IS ALREADY FINALIZED')
        || upper.includes('SQL QUERY EXPECTED')
        || upper.includes('CALLBACK EXPECTED')
}
