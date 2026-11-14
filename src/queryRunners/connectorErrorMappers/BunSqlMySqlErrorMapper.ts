/// <reference types="bun-types" />

import { SQL } from 'bun'
import type { TsSqlErrorReason } from '../../TsSqlError.js'
import type { DatabaseType } from '../QueryRunner.js'
import { getMySqlMariaDbEngineErrorReason, getMySqlMariaDbErrorCodeName, isMySqlMariaDbEngineErrorCode } from '../databaseErrorMappers/MySqlMariaDbErrorMapper.js'

/**
 * An error Bun SQL raises for MySQL or MariaDB (its `SQL.MySQLError` class), with a code and, from the server, an error
 * number and a SQLSTATE.
 */
type BunSqlMySqlError = InstanceType<typeof SQL.MySQLError>
/** A generic error of Bun SQL (its `SQL.SQLError` class). */
type BunSqlError = InstanceType<typeof SQL.SQLError>

/**
 * Gives the `TsSqlErrorReason` of an error raised through Bun SQL on MySQL or MariaDB (`database` picks the names of
 * the error codes): the connector's or the engine's for a `MySQLError`, `SQL_UNKNOWN` for another `SQLError`, the
 * driver's for a known message, and `UNKNOWN` when it isn't an error of that driver.
 */
export function getBunSqlMySqlErrorReason(error: unknown, database?: DatabaseType): TsSqlErrorReason {
    if (isBunSqlMySqlError(error)) {
        return getBunSqlMySqlEngineOrConnectorErrorReason(error, database)
    }
    if (isBunSqlError(error)) {
        return { reason: 'SQL_UNKNOWN', databaseErrorMessage: error.message || undefined }
    }
    if (isBunSqlMySqlDriverError(error)) {
        return getBunSqlMySqlDriverErrorReason(error)
    }
    return { reason: 'UNKNOWN' }
}

/**
 * Tells whether the error comes from Bun SQL on MySQL or MariaDB: a `MySQLError`, a `SQLError`, or an `Error` whose
 * message is one the driver raises.
 */
export function isBunSqlMySqlAnyError(error: unknown): boolean {
    return isBunSqlMySqlError(error) || isBunSqlError(error) || isBunSqlMySqlDriverError(error)
}

/**
 * Gives the reason of a `MySQLError`: the one of the `ERR_MYSQL_` code Bun gives it when known; the engine's, mapped
 * with `getMySqlMariaDbEngineErrorReason`, when it comes from the server; `SQL_UNKNOWN` otherwise.
 */
function getBunSqlMySqlEngineOrConnectorErrorReason(error: BunSqlMySqlError, database?: DatabaseType): TsSqlErrorReason {
    const connectorReason = getKnownBunSqlMySqlConnectorErrorReason(error)
    if (connectorReason) {
        return connectorReason
    }

    if (!isBunSqlMySqlEngineError(error)) {
        return withBunSqlMySqlErrorMetadata({ reason: 'SQL_UNKNOWN' }, error)
    }

    return getMySqlMariaDbEngineErrorReason({
        database,
        errno: getBunSqlMySqlErrorNumber(error),
        code: getBunSqlMySqlEngineErrorCode(error, database),
        sqlState: error.sqlState,
        message: error.message,
    })
}

/**
 * Gives the reason of the `ERR_MYSQL_` code Bun gives a `MySQLError` (connection, timeouts, parameters, authentication,
 * transactions, protocol), with the code, number and message of the error; `undefined` for any other code.
 */
function getKnownBunSqlMySqlConnectorErrorReason(error: BunSqlMySqlError): TsSqlErrorReason | undefined {
    switch (error.code) {
        case 'ERR_MYSQL_CONNECTION_CLOSED':
        case 'ERR_MYSQL_CONNECTION_REFUSED':
        case 'ERR_MYSQL_CONNECTION_FAILED':
            return withBunSqlMySqlErrorMetadata({ reason: 'SQL_CONNECTION_ERROR', errorType: 'connection lost' }, error)
        case 'ERR_MYSQL_CONNECTION_TIMEOUT':
        case 'ERR_MYSQL_IDLE_TIMEOUT':
        case 'ERR_MYSQL_LIFETIME_TIMEOUT':
            return withBunSqlMySqlErrorMetadata({ reason: 'SQL_TIMEOUT', timeoutType: 'connection' }, error)
        case 'ERR_MYSQL_QUERY_CANCELLED':
            return withBunSqlMySqlErrorMetadata({ reason: 'SQL_TIMEOUT', timeoutType: 'cancelled' }, error)
        case 'ERR_MYSQL_NOT_TAGGED_CALL':
        case 'ERR_MYSQL_INVALID_QUERY_BINDING':
            return withBunSqlMySqlErrorMetadata({ reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid binding' }, error)
        case 'ERR_MYSQL_WRONG_NUMBER_OF_PARAMETERS_PROVIDED':
            return withBunSqlMySqlErrorMetadata({ reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'wrong count' }, error)
        case 'ERR_MYSQL_PASSWORD_REQUIRED':
        case 'ERR_MYSQL_MISSING_AUTH_DATA':
        case 'ERR_MYSQL_AUTHENTICATION_FAILED':
        case 'ERR_MYSQL_PUBLIC_KEY_RETRIEVAL_NOT_ALLOWED':
        case 'ERR_MYSQL_FAILED_TO_ENCRYPT_PASSWORD':
        case 'ERR_MYSQL_INVALID_PUBLIC_KEY':
        case 'ERR_MYSQL_UNSUPPORTED_AUTH_PLUGIN':
            return withBunSqlMySqlErrorMetadata({ reason: 'SQL_AUTHENTICATION_ERROR' }, error)
        case 'ERR_MYSQL_UNSUPPORTED_PROTOCOL_VERSION':
            return withBunSqlMySqlErrorMetadata({ reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration' }, error)
        case 'ERR_MYSQL_UNSAFE_TRANSACTION':
            return withBunSqlMySqlErrorMetadata({ reason: 'TRANSACTION_ERROR', transactionErrorType: 'unsupported operation' }, error)
        case 'ERR_MYSQL_INVALID_TRANSACTION_STATE':
            return withBunSqlMySqlErrorMetadata({ reason: 'TRANSACTION_ERROR', transactionErrorType: 'invalid state' }, error)
        case 'ERR_MYSQL_LOCAL_INFILE_NOT_SUPPORTED':
            return withBunSqlMySqlErrorMetadata({ reason: 'SQL_FEATURE_NOT_SUPPORTED' }, error)
        case 'ERR_MYSQL_UNSUPPORTED_COLUMN_TYPE':
            return withBunSqlMySqlErrorMetadata({ reason: 'SQL_FEATURE_NOT_SUPPORTED' }, error)
        case 'ERR_MYSQL_OVERFLOW':
        case 'ERR_MYSQL_INVALID_LOCAL_INFILE_REQUEST':
        case 'ERR_MYSQL_INVALID_AUTH_SWITCH_REQUEST':
        case 'ERR_MYSQL_INVALID_RESULT_ROW':
        case 'ERR_MYSQL_INVALID_BINARY_VALUE':
        case 'ERR_MYSQL_INVALID_ENCODED_INTEGER':
        case 'ERR_MYSQL_INVALID_ENCODED_LENGTH':
        case 'ERR_MYSQL_INVALID_PREPARE_OK_PACKET':
        case 'ERR_MYSQL_INVALID_OK_PACKET':
        case 'ERR_MYSQL_INVALID_EOF_PACKET':
        case 'ERR_MYSQL_INVALID_ERROR_PACKET':
        case 'ERR_MYSQL_UNEXPECTED_PACKET':
        case 'ERR_MYSQL_MALFORMED_PACKET':
        case 'ERR_MYSQL_INVALID_STATE':
            return withBunSqlMySqlErrorMetadata({ reason: 'SQL_INTERNAL_ERROR', errorType: 'engine internal' }, error)
        case 'ERR_MYSQL_UNKNOWN_ERROR':
            return withBunSqlMySqlErrorMetadata({ reason: 'SQL_UNKNOWN' }, error)
    }

    return undefined
}

/**
 * Gives the code of an error of the server: for the generic codes of Bun (`ERR_MYSQL_SERVER_ERROR`,
 * `ERR_MYSQL_SYNTAX_ERROR`) with an error number, the name of that number on the database; otherwise the code as it is.
 */
function getBunSqlMySqlEngineErrorCode(error: BunSqlMySqlError, database?: DatabaseType): string | undefined {
    const code = error.code || undefined
    const errorNumber = getBunSqlMySqlErrorNumber(error)

    if (errorNumber !== undefined && isBunSqlMySqlGenericServerErrorCode(code)) {
        return getMySqlMariaDbErrorCodeName(errorNumber, database) ?? code
    }
    return code
}

/** Gives the error number of the server (`errno`) when it is a positive number, otherwise `undefined`. */
function getBunSqlMySqlErrorNumber(error: BunSqlMySqlError): number | undefined {
    return typeof error.errno === 'number' && error.errno > 0 ? error.errno : undefined
}

/**
 * Tells whether the `MySQLError` comes from the server: it has an error number, a SQLSTATE, a code of the engine or one
 * of the generic codes of Bun for an error of the server.
 */
function isBunSqlMySqlEngineError(error: BunSqlMySqlError): boolean {
    return getBunSqlMySqlErrorNumber(error) !== undefined
        || !!error.sqlState
        || isMySqlMariaDbEngineErrorCode(error.code)
        || isBunSqlMySqlGenericServerErrorCode(error.code)
}

/**
 * Tells whether the code is one Bun gives to an error of the server without its name: `ERR_MYSQL_SERVER_ERROR` or
 * `ERR_MYSQL_SYNTAX_ERROR`.
 */
function isBunSqlMySqlGenericServerErrorCode(code: string | undefined): boolean {
    return code === 'ERR_MYSQL_SERVER_ERROR' || code === 'ERR_MYSQL_SYNTAX_ERROR'
}

/** Gives the reason with the code, number and message of the `MySQLError` added. */
function withBunSqlMySqlErrorMetadata(reason: TsSqlErrorReason, error: BunSqlMySqlError): TsSqlErrorReason {
    return withErrorMetadata(reason, error)
}

/**
 * Gives the reason of an error Bun SQL raises itself on MySQL or MariaDB, or `SQL_UNKNOWN` with its message when the
 * message isn't known.
 */
function getBunSqlMySqlDriverErrorReason(error: Error): TsSqlErrorReason {
    return getKnownBunSqlMySqlDriverErrorReason(error) || { reason: 'SQL_UNKNOWN', databaseErrorMessage: error.message || undefined }
}

/**
 * Gives the reason of an error Bun SQL raises itself on MySQL or MariaDB, recognised by its message (misuse of the API,
 * features not offered, TLS, parameters, a query too long, a failed connection); `undefined` when the message isn't one
 * of them.
 */
function getKnownBunSqlMySqlDriverErrorReason(error: Error): TsSqlErrorReason | undefined {
    const message = error.message || ''
    const databaseErrorMessage = message || undefined

    switch (message) {
        case 'MySQLConnection cannot be constructed directly':
        case 'MySQLQuery cannot be constructed directly':
        case 'run must be called with 2 arguments connection and target':
            return withErrorMetadata({ reason: 'SQL_INTERNAL_ERROR', errorType: 'api misuse', databaseErrorMessage }, error)
        case 'MySQL doesn\'t support arrays':
        case 'File blobs are not supported':
            return withErrorMetadata({ reason: 'SQL_FEATURE_NOT_SUPPORTED', databaseErrorMessage }, error)
        case 'Distributed transaction name cannot contain single quotes.':
            return withErrorMetadata({ reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid value', databaseErrorMessage }, error)
        case 'tls must be a boolean or an object':
        case 'failed to create TLS context':
            return withErrorMetadata({ reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration', databaseErrorMessage }, error)
        case 'simple query cannot have parameters':
            return withErrorMetadata({ reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'not bindable', databaseErrorMessage }, error)
        case 'query is too long':
            return withErrorMetadata({ reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'statement length', databaseErrorMessage }, error)
        case 'Cannot bind NumberObject to query parameter. Use a primitive number instead.':
        case 'Cannot bind BooleanObject to query parameter. Use a primitive boolean instead.':
        case 'Cannot bind this type to query parameter':
        case 'Expected a string, blob, or array buffer':
        case 'Expected a date or number':
            return withErrorMetadata({ reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid type', databaseErrorMessage }, error)
    }

    if (message.includes('failed to connect to mysql')) {
        return withErrorMetadata({ reason: 'SQL_CONNECTION_ERROR', errorType: 'connection lost', databaseErrorMessage }, error)
    }

    return undefined
}

/** Gives the reason with the code, the number and the message of the error added, each only when the error has it. */
function withErrorMetadata(reason: TsSqlErrorReason, error: Error): TsSqlErrorReason {
    const databaseErrorCode = getErrorStringCode(error)
    const databaseErrorNumber = getErrorNumber(error)
    const databaseErrorMessage = error.message || undefined

    return {
        ...reason,
        ...(databaseErrorCode ? { databaseErrorCode } : undefined),
        ...(databaseErrorNumber !== undefined ? { databaseErrorNumber } : undefined),
        ...(databaseErrorMessage ? { databaseErrorMessage } : undefined),
    } as TsSqlErrorReason
}

/** Gives the `code` of the error when it is a non-empty text, otherwise `undefined`. */
function getErrorStringCode(error: Error): string | undefined {
    const code = (error as { code?: unknown }).code
    return typeof code === 'string' && code ? code : undefined
}

/** Gives the `errno` of the error when it is a positive number, otherwise `undefined`. */
function getErrorNumber(error: Error): number | undefined {
    const errno = (error as { errno?: unknown }).errno
    return typeof errno === 'number' && errno > 0 ? errno : undefined
}

/** Tells whether the error is an `Error` whose message is one Bun SQL raises itself on MySQL or MariaDB. */
function isBunSqlMySqlDriverError(error: unknown): error is Error {
    return error instanceof Error && !!getKnownBunSqlMySqlDriverErrorReason(error)
}

/** Tells whether the error is a `MySQLError` of Bun SQL. */
function isBunSqlMySqlError(error: unknown): error is BunSqlMySqlError {
    return error instanceof SQL.MySQLError
}

/** Tells whether the error is a `SQLError` of Bun SQL. */
function isBunSqlError(error: unknown): error is BunSqlError {
    return error instanceof SQL.SQLError
}
