import { DatabaseError } from 'pg'
import type { TsSqlDatabaseErrorNumber, TsSqlErrorReason } from '../../TsSqlError.js'
import { getPostgresEngineErrorReason, isPostgresParameterCountWrappedMessage, isPostgresSqlState, POSTGRES_MAX_PARAMETERS } from '../databaseErrorMappers/PostgresErrorMapper.js'

/**
 * An error raised through pg: an `Error` that may carry a `code` (a SQLSTATE or a Node error code), an `errno` and a
 * `sqlState`.
 */
type PgDriverError = Error & {
    code?: string | undefined
    errno?: string | number | undefined
    sqlState?: string | undefined
}

/**
 * Gives the `TsSqlErrorReason` of an error raised through pg: the engine's when it has a SQLSTATE or is a
 * `DatabaseError`, otherwise the one of the driver's code and message; `UNKNOWN` when it isn't an error of that driver.
 */
export function getPgErrorReason(error: unknown): TsSqlErrorReason {
    if (!isPgError(error)) {
        return { reason: 'UNKNOWN' }
    }
    const engineReason = getPgEngineErrorReason(error)
    if (engineReason) {
        return engineReason
    }
    return getPgDriverErrorReason(error) || { reason: 'UNKNOWN' }
}

/** Tells whether the error comes from pg: an `Error` that maps to a reason of the engine or of the driver. */
export function isPgError(error: unknown): error is DatabaseError | PgDriverError {
    if (!(error instanceof Error)) {
        return false
    }
    return !!getPgEngineErrorReason(error) || !!getPgDriverErrorReason(error)
}

/**
 * Gives the reason of an error of the engine, mapped with `getPostgresEngineErrorReason`, or `undefined` when the error
 * has no SQLSTATE and isn't a `DatabaseError`. Each field is read under the name `pg` gives it (`schema`, `table`,
 * `column`, `dataType`, `constraint`) or under a second name (`schemaName`, `tableName`, `columnName`, `dataTypeName`,
 * `constraintName`). Without a SQLSTATE, the `code` or `sqlState` goes in `databaseErrorCode`.
 */
function getPgEngineErrorReason(error: PgDriverError): TsSqlErrorReason | undefined {
    const sqlState = getPgSqlState(error)
    if (!sqlState && !(error instanceof DatabaseError)) {
        return undefined
    }
    return getPostgresEngineErrorReason({
        sqlState,
        databaseErrorCode: sqlState ? undefined : getStringProperty(error, 'code') || getStringProperty(error, 'sqlState'),
        databaseErrorNumber: sqlState || undefined,
        message: getPgErrorMessage(error),
        schemaName: getStringProperty(error, 'schema') || getStringProperty(error, 'schemaName'),
        tableName: getStringProperty(error, 'table') || getStringProperty(error, 'tableName'),
        columnName: getStringProperty(error, 'column') || getStringProperty(error, 'columnName'),
        typeName: getStringProperty(error, 'dataType') || getStringProperty(error, 'dataTypeName'),
        constraintName: getStringProperty(error, 'constraint') || getStringProperty(error, 'constraintName'),
    })
}

/**
 * Gives the reason of an error pg raises itself, with the number of the error added, or `undefined` when it isn't
 * known.
 */
function getPgDriverErrorReason(error: PgDriverError): TsSqlErrorReason | undefined {
    const reason = getPgDriverErrorReasonWithoutNumber(error)
    return reason && withDatabaseErrorNumber(reason, getPgDriverDatabaseErrorNumber(error))
}

/**
 * Gives the reason of an error pg raises itself, recognised by its Node error code and its message (network, timeouts,
 * TLS, authentication, parameters, closed connection or pool, protocol and internal errors); `undefined` when they
 * aren't one of them. A message that starts with `ERROR:`, `FATAL:` or `PANIC:` gives `SQL_UNKNOWN`.
 */
function getPgDriverErrorReasonWithoutNumber(error: PgDriverError): TsSqlErrorReason | undefined {
    const code = getStringProperty(error, 'code')
    const message = getPgErrorMessage(error)
    const databaseErrorCode = code || getStringProperty(error, 'sqlState')
    const databaseErrorMessage = message || undefined
    const lower = message.toLowerCase()

    if (code === 'ECONNRESET' || code === 'EPIPE' || code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'EAI_AGAIN' || code === 'EHOSTUNREACH') {
        return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'connection lost' }
    }
    if (code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT') {
        return { reason: 'SQL_TIMEOUT', databaseErrorCode, databaseErrorMessage, timeoutType: 'connection' }
    }
    if (isPgInvalidConnectionConfigurationCode(code)) {
        return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'invalid connection configuration' }
    }

    if (message === 'Query read timeout') {
        return { reason: 'SQL_TIMEOUT', databaseErrorCode, databaseErrorMessage, timeoutType: 'statement' }
    }
    if (message === 'timeout expired' || message === 'timeout exceeded when trying to connect' || message === 'Connection terminated due to connection timeout') {
        return { reason: 'SQL_TIMEOUT', databaseErrorCode, databaseErrorMessage, timeoutType: 'connection' }
    }

    if (message === 'The server does not support SSL connections' || message === 'There was an error establishing an SSL connection') {
        return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'invalid connection configuration' }
    }
    if (message === 'Password must be a string' || lower.startsWith('sasl:') || lower.startsWith('sasl channel binding:')) {
        return { reason: 'SQL_AUTHENTICATION_ERROR', databaseErrorCode, databaseErrorMessage }
    }

    if (isPostgresParameterCountWrappedMessage(message)) {
        return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode, databaseErrorMessage, resourceType: 'parameters', limit: POSTGRES_MAX_PARAMETERS }
    }
    if (isPgInvalidParameterError(message)) {
        return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode, databaseErrorMessage, ...getPgInvalidParameterDetails(message) }
    }
    if (message === 'Client was passed a null or undefined query') {
        return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode, databaseErrorMessage, parameterErrorType: 'invalid value' }
    }
    if (message === 'A query must have either text or a name. Supplying neither is unsupported.') {
        return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode, databaseErrorMessage, parameterErrorType: 'missing' }
    }
    if (message.startsWith('Prepared statements must be unique - ')) {
        return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode, databaseErrorMessage, parameterErrorType: 'invalid value' }
    }
    if (message === 'Query values must be an array' || message === 'Parameters must be an array' || message === 'Passing a function as the first parameter to pool.query is not supported') {
        return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode, databaseErrorMessage, parameterErrorType: 'invalid type' }
    }
    if (message === 'Callback is required' || message === 'Must provide a connection callback') {
        return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode, databaseErrorMessage, parameterErrorType: 'missing' }
    }
    if (isPgWrongArgumentCountError(message)) {
        return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode, databaseErrorMessage, ...getPgWrongArgumentCountDetails(message) }
    }

    if (message.startsWith('circular reference detected while preparing ')) {
        return { reason: 'SQL_INVALID_VALUE', databaseErrorCode, databaseErrorMessage, errorType: 'invalid value' }
    }

    if (message === 'Connection terminated' || message === 'Connection terminated unexpectedly'
        || message === 'Client has encountered a connection error and is not queryable'
        || message === 'Client was closed and is not queryable'
        || message === 'Must be connected to start reader'
        || message === 'Must be connected to start writer'
        || isPgNativeConnectionMessage(lower)) {
        return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'connection lost' }
    }
    if (message === 'Cannot use a pool after calling end on the pool'
        || message === 'Release called on client which has already been released to the pool.'
        || message === 'Called end on pool more than once') {
        return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'pool error' }
    }

    if (message.startsWith('Received unexpected ') && message.endsWith(' message from backend.')) {
        return { reason: 'SQL_INTERNAL_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'engine internal' }
    }
    if (message.startsWith('Unknown authenticationOk message type ')
        || message.startsWith('unrecognized command status: ')
        || message.startsWith('Unrecognized read status: ')
        || message === 'Unable to set non-blocking to true'
        || message === 'Something went wrong dispatching the query'
        || message === 'Unable to allocate cancel struct'
        || message === 'unexpected condition'
        || isPgSaslInternalError(message)) {
        return { reason: 'SQL_INTERNAL_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'engine internal' }
    }
    if (message === 'Binary mode not supported yet') {
        return { reason: 'SQL_FEATURE_NOT_SUPPORTED', databaseErrorCode, databaseErrorMessage }
    }

    if (lower.startsWith('fatal:') && lower.includes('password authentication failed')) {
        return { reason: 'SQL_AUTHENTICATION_ERROR', databaseErrorCode, databaseErrorMessage }
    }
    if (lower.startsWith('fatal:') && lower.includes('no pg_hba.conf entry')) {
        return { reason: 'SQL_AUTHORIZATION_ERROR', databaseErrorCode, databaseErrorMessage }
    }
    if (message.startsWith('ERROR:') || message.startsWith('FATAL:') || message.startsWith('PANIC:')) {
        return { reason: 'SQL_UNKNOWN', databaseErrorCode, databaseErrorMessage }
    }

    return undefined
}

/**
 * Gives the SQLSTATE of the error, read from `code` or else from `sqlState`, or `undefined` when neither is a SQLSTATE.
 */
function getPgSqlState(error: PgDriverError): string | undefined {
    const code = getStringProperty(error, 'code')
    if (isPostgresSqlState(code)) {
        return code
    }
    const sqlState = getStringProperty(error, 'sqlState')
    return isPostgresSqlState(sqlState) ? sqlState : undefined
}

/**
 * Gives the number reported as `databaseErrorNumber`: the SQLSTATE, otherwise the `errno` when it differs from the
 * `code`.
 */
function getPgDriverDatabaseErrorNumber(error: PgDriverError): TsSqlDatabaseErrorNumber | undefined {
    const sqlState = getPgSqlState(error)
    if (sqlState) {
        return sqlState
    }

    const code = getStringProperty(error, 'code')
    const errno = getStringOrNumberProperty(error, 'errno')
    return errno !== code ? errno : undefined
}

/** Gives the message of the error, from `message` or else from `messagePrimary`, or an empty text. */
function getPgErrorMessage(error: PgDriverError): string {
    return error.message || getStringProperty(error, 'messagePrimary') || ''
}

/**
 * Tells whether the code is one Node gives for a TLS certificate that can't be verified (expired, self-signed, wrong
 * name).
 */
function isPgInvalidConnectionConfigurationCode(code: string | undefined): boolean {
    return code === 'CERT_HAS_EXPIRED'
        || code === 'DEPTH_ZERO_SELF_SIGNED_CERT'
        || code === 'SELF_SIGNED_CERT_IN_CHAIN'
        || code === 'ERR_TLS_CERT_ALTNAME_INVALID'
        || code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'
}

/** Tells whether the message, in lower case, says that the connection to the server couldn't be made or was closed. */
function isPgNativeConnectionMessage(lower: string): boolean {
    return lower.startsWith('connection to server')
        || lower.includes('could not connect')
        || lower.includes('server closed the connection unexpectedly')
        || lower.includes('no connection to the server')
        || lower.includes('connection not open')
}

/** Tells whether the message is one of the checks of the buffers of the SASL authentication of pg. */
function isPgSaslInternalError(message: string): boolean {
    return message === 'first argument must be a Buffer'
        || message === 'second argument must be a Buffer'
        || message === 'Buffer lengths must match'
        || message === 'Buffers cannot be empty'
}

/**
 * Tells whether the message says that the bind supplies a wrong number of parameters or names a parameter that doesn't
 * exist.
 */
function isPgInvalidParameterError(message: string): boolean {
    const lower = message.toLowerCase()
    return lower.includes('bind message supplies')
        || lower.includes('there is no parameter $')
}

/** Tells whether the message says how many arguments must be supplied (`Must supply N arguments`). */
function isPgWrongArgumentCountError(message: string): boolean {
    return /^Must supply \d+ arguments?$/i.test(message)
}

/**
 * Gives the details of a wrong number of arguments: the `wrong count` parameter error and the expected count read from
 * the message.
 */
function getPgWrongArgumentCountDetails(message: string): {
    parameterErrorType: 'wrong count'
    expectedParameterCount?: number | undefined
} {
    const expected = /^Must supply (\d+) arguments?$/i.exec(message)
    return {
        parameterErrorType: 'wrong count',
        expectedParameterCount: expected ? Number(expected[1]) : undefined,
    }
}

/**
 * Gives the details of an invalid parameter read from the message: the index of a missing parameter, or the actual and
 * expected counts of a wrong count; `invalid binding` otherwise.
 */
function getPgInvalidParameterDetails(message: string): {
    parameterErrorType: 'missing' | 'wrong count' | 'invalid binding'
    parameterIndex?: number | undefined
    expectedParameterCount?: number | undefined
    actualParameterCount?: number | undefined
} {
    const missingIndex = /there is no parameter \$(\d+)/i.exec(message)
    if (missingIndex) {
        return { parameterErrorType: 'missing', parameterIndex: Number(missingIndex[1]) }
    }

    const wrongCount = /bind message supplies (\d+) parameters?, but prepared statement .+ requires (\d+)/i.exec(message)
    if (wrongCount) {
        return {
            parameterErrorType: 'wrong count',
            actualParameterCount: Number(wrongCount[1]),
            expectedParameterCount: Number(wrongCount[2]),
        }
    }

    if (message.toLowerCase().includes('bind message supplies')) {
        return { parameterErrorType: 'wrong count' }
    }

    return { parameterErrorType: 'invalid binding' }
}

/** Gives the property of the error with that name when it is a text, otherwise `undefined`. */
function getStringProperty(error: PgDriverError, property: string): string | undefined {
    const value = (error as unknown as Record<string, unknown>)[property]
    return typeof value === 'string' ? value : undefined
}

/** Gives the property of the error with that name when it is a text or a number, otherwise `undefined`. */
function getStringOrNumberProperty(error: PgDriverError, property: string): string | number | undefined {
    const value = (error as unknown as Record<string, unknown>)[property]
    return typeof value === 'string' || typeof value === 'number' ? value : undefined
}

/** Gives the reason with `databaseErrorNumber` set, or the reason as it is when there is no number. */
function withDatabaseErrorNumber(reason: TsSqlErrorReason, databaseErrorNumber: TsSqlDatabaseErrorNumber | undefined): TsSqlErrorReason {
    if (databaseErrorNumber === undefined) {
        return reason
    }
    return { ...reason, databaseErrorNumber } as TsSqlErrorReason
}
