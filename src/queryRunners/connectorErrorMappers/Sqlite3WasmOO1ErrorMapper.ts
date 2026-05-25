import type { SQLite3Error } from '@sqlite.org/sqlite-wasm'
import type { TsSqlDatabaseErrorCode, TsSqlDatabaseErrorNumber, TsSqlErrorReason } from '../../TsSqlError.js'
import { getSqliteEngineErrorReason, getSqliteErrorCodeName } from '../databaseErrorMappers/SqliteErrorMapper.js'

export function getSqlite3WasmOO1ErrorReason(error: unknown): TsSqlErrorReason {
    if (!isSqlite3WasmOO1Error(error)) {
        return { reason: 'UNKNOWN' }
    }
    return getSqlite3WasmErrorReason(error)
}

export function isSqlite3WasmOO1Error(error: unknown): error is Sqlite3WasmDbError {
    return !!error && error instanceof Error && (
        (error as Sqlite3WasmDbError).name === 'SQLite3Error'
        || typeof (error as Sqlite3WasmDbError).resultCode === 'number'
    )
}

type Sqlite3WasmDbError = SQLite3Error & Error & {
    resultCode: number
}

function getSqlite3WasmErrorReason(error: Sqlite3WasmDbError): TsSqlErrorReason {
    const databaseErrorCode = getSqlite3WasmDatabaseErrorCode(error)
    const databaseErrorNumber = getSqlite3WasmDatabaseErrorNumber(error)
    const databaseErrorMessage = error.message || undefined
    const message = normalizeSqlite3WasmErrorMessage(error.message || '')
    const upper = message.toUpperCase()

    if (upper.includes('OPERATION IS ILLEGAL WHEN STATEMENT IS LOCKED')) {
        return { reason: 'FORBIDDEN_CONCURRENT_USAGE', databaseErrorCode, databaseErrorNumber, databaseErrorMessage }
    }
    if (upper.includes('DB HAS BEEN CLOSED.') || upper.includes('STMT HAS BEEN CLOSED.')) {
        return { reason: 'SQL_CONNECTION_ERROR', errorType: 'connection lost', databaseErrorCode, databaseErrorNumber, databaseErrorMessage }
    }
    if (upper.includes('INVALID BIND() PARAMETER NAME:')) {
        return getSqliteEngineErrorReason({ databaseErrorCode, databaseErrorNumber, message })
    }
    if (upper.includes('THIS STATEMENT HAS NO BINDABLE PARAMETERS.')) {
        return getSqliteEngineErrorReason({ databaseErrorCode, databaseErrorNumber, message })
    }
    if (upper.includes('INVALID BIND() ARGUMENTS.')) {
        return getSqliteEngineErrorReason({ databaseErrorCode, databaseErrorNumber, message })
    }
    if (upper.includes('UNSUPPORTED BIND() ARGUMENT TYPE:')) {
        return getSqliteEngineErrorReason({ databaseErrorCode, databaseErrorNumber, message })
    }
    if (upper.includes('BIND INDEX') && upper.includes('IS OUT OF RANGE.')) {
        return getSqliteEngineErrorReason({ databaseErrorCode, databaseErrorNumber, message })
    }
    if (upper.includes('WHEN BINDING AN ARRAY, AN INDEX ARGUMENT IS NOT PERMITTED.')) {
        return getSqliteEngineErrorReason({ databaseErrorCode, databaseErrorNumber, message })
    }
    if (upper.includes('WHEN BINDING AN OBJECT, AN INDEX ARGUMENT IS NOT PERMITTED.')) {
        return getSqliteEngineErrorReason({ databaseErrorCode, databaseErrorNumber, message })
    }
    if (upper.includes('BIGINT VALUE IS TOO BIG TO STORE WITHOUT PRECISION LOSS:')) {
        return { reason: 'SQL_INVALID_VALUE', errorType: 'out of range', databaseErrorCode, databaseErrorNumber, databaseErrorMessage }
    }
    if (upper.includes('INTEGER IS OUT OF RANGE FOR JS INTEGER RANGE:')) {
        return { reason: 'SQL_INVALID_VALUE', errorType: 'out of range', databaseErrorCode, databaseErrorNumber, databaseErrorMessage }
    }
    if (upper.includes('EXEC() REQUIRES AN SQL STRING.') || upper.includes('CANNOT PREPARE EMPTY SQL.')) {
        return { reason: 'SQL_INTERNAL_ERROR', errorType: 'api misuse', databaseErrorCode, databaseErrorNumber, databaseErrorMessage }
    }

    return withOriginalSqlite3WasmErrorMessage(
        getSqliteEngineErrorReason({ code: getSqlite3WasmErrorCode(error), databaseErrorCode, databaseErrorNumber, message }),
        databaseErrorMessage
    )
}

function normalizeSqlite3WasmErrorMessage(message: string): string {
    return message
        .replace(/^SQLITE_[A-Z0-9_]+:\s*sqlite3 result code\s+-?\d+:\s*/i, '')
        .replace(/^SQLITE_[A-Z0-9_]+:\s*/i, '')
}

function withOriginalSqlite3WasmErrorMessage(errorReason: TsSqlErrorReason, databaseErrorMessage: string | undefined): TsSqlErrorReason {
    if (!databaseErrorMessage) {
        return errorReason
    }
    return { ...errorReason, databaseErrorMessage } as TsSqlErrorReason
}

function getPrimaryResultCode(resultCode: number): number {
    return resultCode & 0xff
}

function getSqlite3WasmErrorCode(error: Sqlite3WasmDbError): string | undefined {
    return getSqliteErrorCodeName(error.resultCode) || getSqliteErrorCodeName(getPrimaryResultCode(error.resultCode))
}

function getSqlite3WasmDatabaseErrorCode(error: Sqlite3WasmDbError): TsSqlDatabaseErrorCode | undefined {
    return getSqlite3WasmErrorCode(error)
}

function getSqlite3WasmDatabaseErrorNumber(error: Sqlite3WasmDbError): TsSqlDatabaseErrorNumber | undefined {
    return typeof error.resultCode === 'number' ? error.resultCode : undefined
}
