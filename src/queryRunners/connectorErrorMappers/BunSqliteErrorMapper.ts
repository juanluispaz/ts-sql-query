/// <reference types="bun-types" />

import { SQLiteError } from 'bun:sqlite'
import type { TsSqlErrorReason } from '../../TsSqlError.js'
import { getSqliteEngineErrorReason, getSqliteErrorCodeNumber } from '../databaseErrorMappers/SqliteErrorMapper.js'

export function getBunSqliteErrorReason(error: unknown): TsSqlErrorReason {
    if (isBunSqliteEngineError(error)) {
        return getBunSqliteEngineErrorReason(error)
    }
    if (isBunSqliteDriverError(error)) {
        return getBunSqliteDriverErrorReason(error)
    }
    return { reason: 'UNKNOWN' }
}

export function isBunSqliteError(error: unknown): boolean {
    return isBunSqliteEngineError(error) || isBunSqliteDriverError(error)
}

function getBunSqliteEngineErrorReason(error: SQLiteError): TsSqlErrorReason {
    return getSqliteEngineErrorReason({ code: error.code, databaseErrorNumber: getBunSqliteErrorNumber(error), message: error.message })
}

function getBunSqliteErrorNumber(error: SQLiteError): number | undefined {
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
        return getSqliteEngineErrorReason({ message })
    }
    if (upper.startsWith('MISSING PARAMETER "')) {
        return getSqliteEngineErrorReason({ message })
    }
    if (upper.includes('EXPECTED BINDINGS TO BE AN OBJECT OR ARRAY')) {
        return getSqliteEngineErrorReason({ message })
    }
    if (upper.includes('EXPECTED OBJECT OR ARRAY')) {
        return getSqliteEngineErrorReason({ message })
    }
    if (upper === 'EXPECTED ARRAY') {
        return getSqliteEngineErrorReason({ message })
    }
    if (upper.includes('BINDING EXPECTED STRING, TYPEDARRAY, BOOLEAN, NUMBER, BIGINT OR NULL')) {
        return getSqliteEngineErrorReason({ message })
    }
    if (upper === 'EXPECTED STRING') {
        return getSqliteEngineErrorReason({ message })
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

function isBunSqliteEngineError(error: unknown): error is SQLiteError {
    return error instanceof SQLiteError
}
