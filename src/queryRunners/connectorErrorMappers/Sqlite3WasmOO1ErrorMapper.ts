import type { SQLite3Error } from '@sqlite.org/sqlite-wasm'
import type { TsSqlDatabaseErrorCode, TsSqlDatabaseErrorNumber, TsSqlErrorReason } from '../../TsSqlError.js'
import { getSqliteEngineErrorReason, getSqliteErrorCodeName } from '../databaseErrorMappers/SqliteErrorMapper.js'

/**
 * Gives the `TsSqlErrorReason` of an error raised through the OO1 API of sqlite-wasm; `UNKNOWN` when it isn't an error
 * of that driver.
 */
export function getSqlite3WasmOO1ErrorReason(error: unknown): TsSqlErrorReason {
    if (!isSqlite3WasmOO1Error(error)) {
        return { reason: 'UNKNOWN' }
    }
    return getSqlite3WasmErrorReason(error)
}

/**
 * Tells whether the error comes from sqlite-wasm: an `Error` named `SQLite3Error`, or one with a numeric `resultCode`.
 */
export function isSqlite3WasmOO1Error(error: unknown): error is Sqlite3WasmDbError {
    return !!error && error instanceof Error && (
        (error as Sqlite3WasmDbError).name === 'SQLite3Error'
        || typeof (error as Sqlite3WasmDbError).resultCode === 'number'
    )
}

/** An error of sqlite-wasm, with the SQLite result code in `resultCode`. */
type Sqlite3WasmDbError = SQLite3Error & Error & {
    resultCode: number
}

/**
 * Gives the reason of an error of sqlite-wasm. The messages the OO1 API raises itself (a locked or closed statement, a
 * closed database, the parameters, a bigint too big, an integer out of the JavaScript range, an empty SQL) are
 * recognised first; any other goes to `getSqliteEngineErrorReason` with the name of its result code, keeping the
 * original message.
 */
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
        // an integer read from the database that a build without BigInt can't hand back exactly:
        // the precision loss the other connectors report with the same reason
        return { reason: 'PRECISION_LOST_RECEIVING_VALUE_FROM_DATABASE', value: /:\s*(-?\d+)\s*$/.exec(message)?.[1], typeName: '' }
    }
    if (upper.includes('EXEC() REQUIRES AN SQL STRING.') || upper.includes('CANNOT PREPARE EMPTY SQL.')) {
        return { reason: 'SQL_INTERNAL_ERROR', errorType: 'api misuse', databaseErrorCode, databaseErrorNumber, databaseErrorMessage }
    }

    return withOriginalSqlite3WasmErrorMessage(
        getSqliteEngineErrorReason({ code: getSqlite3WasmErrorCode(error), databaseErrorCode, databaseErrorNumber, message }),
        databaseErrorMessage
    )
}

/**
 * Removes from the message the prefix sqlite-wasm adds with the name of the result code (and its number), leaving the
 * text of the error.
 */
function normalizeSqlite3WasmErrorMessage(message: string): string {
    return message
        .replace(/^SQLITE_[A-Z0-9_]+:\s*sqlite3 result code\s+-?\d+:\s*/i, '')
        .replace(/^SQLITE_[A-Z0-9_]+:\s*/i, '')
}

/** Gives the reason with `databaseErrorMessage` set to the original message, when there is one. */
function withOriginalSqlite3WasmErrorMessage(errorReason: TsSqlErrorReason, databaseErrorMessage: string | undefined): TsSqlErrorReason {
    if (!databaseErrorMessage) {
        return errorReason
    }
    return { ...errorReason, databaseErrorMessage } as TsSqlErrorReason
}

/** Gives the primary result code of a SQLite result code: its low 8 bits, without the extended part. */
function getPrimaryResultCode(resultCode: number): number {
    return resultCode & 0xff
}

/** Gives the name of the error's result code, or of its primary result code when the extended one has no name. */
function getSqlite3WasmErrorCode(error: Sqlite3WasmDbError): string | undefined {
    return getSqliteErrorCodeName(error.resultCode) || getSqliteErrorCodeName(getPrimaryResultCode(error.resultCode))
}

/** Gives the code reported as `databaseErrorCode`: the name of the error's result code. */
function getSqlite3WasmDatabaseErrorCode(error: Sqlite3WasmDbError): TsSqlDatabaseErrorCode | undefined {
    return getSqlite3WasmErrorCode(error)
}

/** Gives the SQLite result code number of the error (its `resultCode`), or `undefined` when it has none. */
function getSqlite3WasmDatabaseErrorNumber(error: Sqlite3WasmDbError): TsSqlDatabaseErrorNumber | undefined {
    return typeof error.resultCode === 'number' ? error.resultCode : undefined
}
