import type {
    ConnectionError as MssqlConnectionError,
    MSSQLError as MssqlBaseError,
    PreparedStatementError as MssqlPreparedStatementError,
    RequestError as MssqlRequestError,
    TransactionError as MssqlTransactionError,
} from 'mssql'
import mssql from 'mssql'
import { TimeoutError } from 'tarn'
import type { TsSqlErrorReason } from '../../TsSqlError.js'
import { getSqlServerEngineErrorReason } from '../databaseErrorMappers/SqlServerErrorMapper.js'

const { ConnectionError, MSSQLError, PreparedStatementError, RequestError, TransactionError } = mssql

/**
 * An error of mssql: one of its error classes, a `TimeoutError` of its pool (tarn), or a plain `Error` with a message
 * of tedious, tarn or mssql.
 */
type MssqlError = MssqlBaseError | MssqlConnectionError | MssqlPreparedStatementError | MssqlRequestError | MssqlTransactionError | TimeoutError | PlainMssqlDriverError

/**
 * An error of mssql or tedious seen without its class: an `Error` that may carry a `code`, the error number of the
 * server (`number`) and the error it wraps (`originalError`).
 */
type PlainMssqlDriverError = Error & {
    code?: unknown | undefined
    number?: unknown | undefined
    originalError?: unknown | undefined
}

/** The code and the message of an error, as they are reported in a `TsSqlErrorReason`. */
type ErrorMetadata = {
    databaseErrorCode?: string | undefined
    databaseErrorMessage?: string | undefined
}

/** Gives the `TsSqlErrorReason` of an error raised through mssql; `UNKNOWN` when it isn't an error of that driver. */
export function getMssqlErrorReason(error: unknown): TsSqlErrorReason {
    if (!isMssqlError(error)) {
        return { reason: 'UNKNOWN' }
    }
    return getMssqlDriverOrEngineErrorReason(error)
}

/**
 * Tells whether the error comes from mssql: an error of one of its classes, a `TimeoutError` of tarn, or an `Error`
 * whose message is one tedious, tarn or mssql raises about the configuration or a lost connection.
 */
export function isMssqlError(error: unknown): error is MssqlError {
    if (error instanceof TimeoutError) {
        return true
    }
    if (error instanceof MSSQLError || error instanceof ConnectionError || error instanceof PreparedStatementError || error instanceof TransactionError) {
        return true
    }
    return isPlainMssqlDriverError(error)
}

/**
 * Gives the reason of an error of mssql by its class: a `TimeoutError` of tarn is the pool that ran out of connections;
 * each error class of mssql has its own mapping; a plain `Error` is mapped by its message.
 */
function getMssqlDriverOrEngineErrorReason(error: MssqlError): TsSqlErrorReason {
    if (error instanceof TimeoutError) {
        return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode: 'TimeoutError', databaseErrorMessage: error.message, resourceType: 'pool' }
    }
    if (error instanceof PreparedStatementError) {
        return getMssqlPreparedStatementErrorReason(error)
    }
    if (error instanceof TransactionError) {
        return getMssqlTransactionErrorReason(error)
    }
    if (error instanceof ConnectionError) {
        return getMssqlConnectionErrorReason(error)
    }
    if (error instanceof RequestError) {
        return getMssqlRequestErrorReason(error)
    }
    if (error instanceof MSSQLError) {
        return getMssqlBaseErrorReason(error)
    }
    return getPlainMssqlDriverErrorReason(error)
}

/**
 * Gives the reason of a `TransactionError`: the engine's when it, or the error it wraps, carries an error number of the
 * server; otherwise the one of its code; for an unknown code, a refused isolation level or else an invalid state of the
 * transaction.
 */
function getMssqlTransactionErrorReason(error: MssqlTransactionError): TsSqlErrorReason {
    const engineReason = getSqlServerEngineReasonFromMssqlError(error)
    if (engineReason) {
        return engineReason
    }

    const metadata = getErrorMetadata(error)
    switch (getMssqlErrorCode(error)) {
        case 'ENOTBEGUN':
            return { reason: 'NOT_IN_TRANSACTION', ...metadata }
        case 'EABORT':
            return { reason: 'TRANSACTION_ERROR', ...metadata, transactionErrorType: 'aborted' }
        case 'EALREADYBEGUN':
            return { reason: 'NESTED_TRANSACTION_NOT_SUPPORTED', ...metadata }
        case 'EINVALIDSTATE':
            // tedious names the state the connection is in: Final means it has already ended
            if (/ not the Final state$/.test(error.message)) {
                return { reason: 'SQL_CONNECTION_ERROR', ...metadata, errorType: 'connection lost' }
            }
            return { reason: 'FORBIDDEN_CONCURRENT_USAGE', ...metadata }
        case 'EREQINPROG':
            return { reason: 'FORBIDDEN_CONCURRENT_USAGE', ...metadata }
        case 'ECANCEL':
            return { reason: 'SQL_TIMEOUT', ...metadata, timeoutType: 'cancelled' }
        case 'ETIMEOUT':
            return { reason: 'SQL_TIMEOUT', ...metadata, timeoutType: 'transaction' }
        case 'ENOTOPEN':
        case 'ECONNCLOSED':
            return { reason: 'SQL_CONNECTION_ERROR', ...metadata, errorType: 'pool error' }
        case 'ECLOSE':
        case 'ESOCKET':
            return { reason: 'SQL_CONNECTION_ERROR', ...metadata, errorType: 'connection lost' }
        case 'ELOGIN':
        case 'EFEDAUTH':
            return { reason: 'SQL_AUTHENTICATION_ERROR', ...metadata }
        case 'EINSTLOOKUP':
        case 'EDRIVER':
        case 'EENCRYPT':
            return { reason: 'SQL_CONNECTION_ERROR', ...metadata, errorType: 'invalid connection configuration' }
        case 'ETDS':
        case 'EINTERFACENOTSUPP':
            return { reason: 'SQL_FEATURE_NOT_SUPPORTED', ...metadata }
        default:
            if (isInvalidIsolationLevelMessage(error.message)) {
                return { reason: 'TRANSACTION_LEVEL_NOT_SUPPORTED', ...metadata, transactionLevel: undefined }
            }
            return { reason: 'TRANSACTION_ERROR', ...metadata, transactionErrorType: 'invalid state' }
    }
}

/**
 * Gives the reason of a `ConnectionError` from its code (authentication, timeout, configuration, pool, socket,
 * protocol), or else from its message; `SQL_CONNECTION_ERROR` when neither is known.
 */
function getMssqlConnectionErrorReason(error: MssqlConnectionError): TsSqlErrorReason {
    const metadata = getErrorMetadata(error)
    switch (getMssqlErrorCode(error)) {
        case 'ELOGIN':
        case 'EFEDAUTH':
            return { reason: 'SQL_AUTHENTICATION_ERROR', ...metadata }
        case 'ETIMEOUT':
            return { reason: 'SQL_TIMEOUT', ...metadata, timeoutType: 'connection' }
        case 'EINSTLOOKUP':
        case 'EDRIVER':
        case 'EENCRYPT':
            return { reason: 'SQL_CONNECTION_ERROR', ...metadata, errorType: 'invalid connection configuration' }
        case 'ENOTOPEN':
        case 'ECONNCLOSED':
        case 'EALREADYCONNECTED':
        case 'EALREADYCONNECTING':
            return { reason: 'SQL_CONNECTION_ERROR', ...metadata, errorType: 'pool error' }
        case 'ESOCKET':
            return { reason: 'SQL_CONNECTION_ERROR', ...metadata, errorType: 'connection lost' }
        case 'ETDS':
        case 'EINTERFACENOTSUPP':
            return { reason: 'SQL_FEATURE_NOT_SUPPORTED', ...metadata }
        default:
            if (isMssqlAuthenticationMessage(error.message)) {
                return { reason: 'SQL_AUTHENTICATION_ERROR', ...metadata }
            }
            if (isMssqlFeatureNotSupportedMessage(error.message)) {
                return { reason: 'SQL_FEATURE_NOT_SUPPORTED', ...metadata }
            }
            if (isMssqlConnectionLostMessage(error.message)) {
                return { reason: 'SQL_CONNECTION_ERROR', ...metadata, errorType: 'connection lost' }
            }
            if (isMssqlPoolErrorMessage(error.message)) {
                return { reason: 'SQL_CONNECTION_ERROR', ...metadata, errorType: 'pool error' }
            }
            if (isMssqlInvalidConnectionConfigurationMessage(error.message)) {
                return { reason: 'SQL_CONNECTION_ERROR', ...metadata, errorType: 'invalid connection configuration' }
            }
            return { reason: 'SQL_CONNECTION_ERROR', ...metadata }
    }
}

/**
 * Gives the reason of a `RequestError`: the engine's, mapped with `getSqlServerEngineErrorReason`, when it carries an
 * error number of the server; otherwise the one of its code (cancel, timeout, connection, concurrent use, arguments and
 * parameters, JSON, bulk insert); `SQL_UNKNOWN` for an unknown code.
 */
function getMssqlRequestErrorReason(error: MssqlRequestError): TsSqlErrorReason {
    const number = error.number

    if (typeof number === 'number') {
        return getSqlServerEngineErrorReason({
            number,
            databaseErrorCode: getMssqlErrorCode(error),
            databaseErrorNumber: number,
            message: error.message || '',
        })
    }

    const metadata = getErrorMetadata(error)
    switch (getMssqlErrorCode(error)) {
        case 'ECANCEL':
            return { reason: 'SQL_TIMEOUT', ...metadata, timeoutType: 'cancelled' }
        case 'ETIMEOUT':
            return { reason: 'SQL_TIMEOUT', ...metadata, timeoutType: 'statement' }
        case 'ECLOSE':
        case 'ESOCKET':
            return { reason: 'SQL_CONNECTION_ERROR', ...metadata, errorType: 'connection lost' }
        case 'ENOCONN':
        case 'ENOTOPEN':
        case 'ECONNCLOSED':
            return { reason: 'SQL_CONNECTION_ERROR', ...metadata, errorType: 'pool error' }
        case 'EINVALIDSTATE':
            // tedious names the state the connection is in: Final means it has already ended
            if (/ not the Final state$/.test(error.message)) {
                return { reason: 'SQL_CONNECTION_ERROR', ...metadata, errorType: 'connection lost' }
            }
            return { reason: 'FORBIDDEN_CONCURRENT_USAGE', ...metadata }
        case 'EREQINPROG':
            return { reason: 'FORBIDDEN_CONCURRENT_USAGE', ...metadata }
        case 'EARGS':
            return getMssqlInvalidArgumentRequestErrorReason(error, metadata)
        case 'EDUPEPARAM':
            return { reason: 'SQL_INVALID_PARAMETER', ...metadata, parameterErrorType: 'already bound', parameterName: extractMssqlParameterName(error.message) }
        case 'EPARAM':
            return { reason: 'SQL_INVALID_PARAMETER', ...metadata, parameterErrorType: 'invalid value', parameterName: extractMssqlParameterName(error.message) }
        case 'EINJECT':
            return { reason: 'SQL_INVALID_PARAMETER', ...metadata, parameterErrorType: 'invalid name', parameterName: extractMssqlParameterName(error.message) }
        case 'EDEPRECATED':
            return { reason: 'SQL_FEATURE_NOT_SUPPORTED', ...metadata }
        case 'EJSON':
            return { reason: 'INVALID_JSON_RECEIVED_FROM_DATABASE', value: undefined, typeName: 'json' }
        case 'ENAME':
            return getMssqlNameRequestErrorReason(error, metadata)
        case 'UNKNOWN':
            return { reason: 'SQL_UNKNOWN', ...metadata }
        default:
            return { reason: 'SQL_UNKNOWN', ...metadata }
    }
}

/**
 * Gives the reason of a `PreparedStatementError` from its code (already prepared or not prepared, arguments,
 * parameters); `SQL_UNKNOWN` for an unknown code.
 */
function getMssqlPreparedStatementErrorReason(error: MssqlPreparedStatementError): TsSqlErrorReason {
    const metadata = getErrorMetadata(error)
    switch (getMssqlErrorCode(error)) {
        case 'EALREADYPREPARED':
        case 'ENOTPREPARED':
            return { reason: 'SQL_OBJECT_STATE_ERROR', ...metadata, objectType: 'prepared statement', objectStateErrorType: 'invalid state' }
        case 'EARGS':
            return getMssqlInvalidArgumentRequestErrorReason(error, metadata)
        case 'EDUPEPARAM':
            return { reason: 'SQL_INVALID_PARAMETER', ...metadata, parameterErrorType: 'already bound', parameterName: extractMssqlParameterName(error.message) }
        case 'EINJECT':
            return { reason: 'SQL_INVALID_PARAMETER', ...metadata, parameterErrorType: 'invalid name', parameterName: extractMssqlParameterName(error.message) }
        default:
            return { reason: 'SQL_UNKNOWN', ...metadata }
    }
}

/**
 * Gives the reason of an `MSSQLError` of no more specific class: an invalid configuration of the connection when its
 * message says so, otherwise `SQL_UNKNOWN`.
 */
function getMssqlBaseErrorReason(error: MssqlBaseError): TsSqlErrorReason {
    const metadata = getErrorMetadata(error)
    if (isMssqlInvalidConnectionConfigurationMessage(error.message)) {
        return { reason: 'SQL_CONNECTION_ERROR', ...metadata, errorType: 'invalid connection configuration' }
    }
    return { reason: 'SQL_UNKNOWN', ...metadata }
}

/**
 * Gives the reason of a plain `Error` of tedious, tarn or mssql from its message: an invalid configuration, an error of
 * the pool or a lost connection; `UNKNOWN` otherwise.
 */
function getPlainMssqlDriverErrorReason(error: PlainMssqlDriverError): TsSqlErrorReason {
    const metadata = getErrorMetadata(error)
    if (isTediousInvalidConnectionConfigurationMessage(error.message)) {
        return { reason: 'SQL_CONNECTION_ERROR', ...metadata, errorType: 'invalid connection configuration' }
    }
    if (isTarnPoolConfigurationMessage(error.message)) {
        return { reason: 'SQL_CONNECTION_ERROR', ...metadata, errorType: 'pool error' }
    }
    if (isMssqlConnectionLostMessage(error.message)) {
        return { reason: 'SQL_CONNECTION_ERROR', ...metadata, errorType: 'connection lost' }
    }
    return { reason: 'UNKNOWN' }
}

/**
 * Gives the reason of the engine, mapped with `getSqlServerEngineErrorReason`, when the error or the error it wraps
 * carries an error number of the server; `undefined` otherwise.
 */
function getSqlServerEngineReasonFromMssqlError(error: PlainMssqlDriverError): TsSqlErrorReason | undefined {
    const number = getMssqlErrorNumber(error)
        ?? getMssqlErrorNumber(getOriginalError(error))
    if (typeof number !== 'number') {
        return undefined
    }
    return getSqlServerEngineErrorReason({
        number,
        databaseErrorCode: getMssqlErrorCode(error),
        databaseErrorNumber: number,
        message: error.message || '',
    })
}

/**
 * Gives the `SQL_INVALID_PARAMETER` reason of an `EARGS` error: an invalid data type for a column of a table-valued
 * parameter, a wrong number of arguments, or no more detail.
 */
function getMssqlInvalidArgumentRequestErrorReason(error: PlainMssqlDriverError, metadata = getErrorMetadata(error)): TsSqlErrorReason {
    if (isMssqlUnsupportedTvpTypeMessage(error.message)) {
        return { reason: 'SQL_INVALID_PARAMETER', ...metadata, parameterErrorType: 'invalid type', parameterName: extractMssqlColumnName(error.message) }
    }
    if (isMssqlInvalidNumberOfArgumentsMessage(error.message)) {
        return { reason: 'SQL_INVALID_PARAMETER', ...metadata, parameterErrorType: 'wrong count' }
    }
    return { reason: 'SQL_INVALID_PARAMETER', ...metadata }
}

/**
 * Gives the reason of an `ENAME` error of a bulk insert, from its message: a missing table name, a table variable, a
 * table that isn't on the server, or else an invalid table name.
 */
function getMssqlNameRequestErrorReason(error: PlainMssqlDriverError, metadata = getErrorMetadata(error)): TsSqlErrorReason {
    if (error.message === 'Table name must be specified for bulk insert.') {
        return { reason: 'SQL_INVALID_PARAMETER', ...metadata, parameterErrorType: 'missing', parameterName: 'tableName' }
    }
    if (error.message === "You can't use table variables for bulk insert.") {
        return { reason: 'SQL_FEATURE_NOT_SUPPORTED', ...metadata }
    }
    if (error.message === 'Table was not found on the server.') {
        return { reason: 'SQL_OBJECT_NOT_FOUND', ...metadata, objectType: 'table' }
    }
    return { reason: 'SQL_INVALID_PARAMETER', ...metadata, parameterErrorType: 'invalid value', parameterName: 'tableName' }
}

/** Gives the code and the message of the error. */
function getErrorMetadata(error: PlainMssqlDriverError): ErrorMetadata {
    return {
        databaseErrorCode: getMssqlErrorCode(error),
        databaseErrorMessage: error.message || undefined,
    }
}

/** Gives the `code` of the error when it is a non-empty text, otherwise `undefined`. */
function getMssqlErrorCode(error: PlainMssqlDriverError | undefined): string | undefined {
    return typeof error?.code === 'string' && error.code ? error.code : undefined
}

/** Gives the error number of the server (`number`) when it is a number, otherwise `undefined`. */
function getMssqlErrorNumber(error: PlainMssqlDriverError | undefined): number | undefined {
    return typeof error?.number === 'number' ? error.number : undefined
}

/** Gives the error that the error of mssql wraps (`originalError`) when it is an `Error`, otherwise `undefined`. */
function getOriginalError(error: PlainMssqlDriverError): PlainMssqlDriverError | undefined {
    return error.originalError instanceof Error ? error.originalError as PlainMssqlDriverError : undefined
}

/** Gives the name of the parameter the message of mssql names, or `undefined` when it names none. */
function extractMssqlParameterName(message: string): string | undefined {
    return /^SQL injection warning for param '([^']+)'$/.exec(message)?.[1]
        ?? /^Invalid parameter name '([^']+)'\./.exec(message)?.[1]
        ?? /^The parameter name ([^\s]+) has already been declared\./.exec(message)?.[1]
        ?? /^Validation failed for parameter '([^']+)'\./.exec(message)?.[1]
}

/** Gives the name of the column of a table-valued parameter the message names, or `undefined`. */
function extractMssqlColumnName(message: string): string | undefined {
    return /^Column '([^']+)' in TVP /.exec(message)?.[1]
}

/**
 * Tells whether the error is an `Error` whose message is one tedious, tarn or mssql raises about the configuration or a
 * lost connection.
 */
function isPlainMssqlDriverError(error: unknown): error is PlainMssqlDriverError {
    if (!(error instanceof Error)) {
        return false
    }
    return isTediousInvalidConnectionConfigurationMessage(error.message)
        || isTarnPoolConfigurationMessage(error.message)
        || isMssqlConnectionLostMessage(error.message)
}

/** Tells whether the message is the one mssql raises for an invalid isolation level. */
function isInvalidIsolationLevelMessage(message: string): boolean {
    return message === 'Invalid isolation level.'
}

/** Tells whether the message says that the number of arguments is invalid. */
function isMssqlInvalidNumberOfArgumentsMessage(message: string): boolean {
    return message.startsWith('Invalid number of arguments.')
}

/**
 * Tells whether the message says that a column of a table-valued parameter uses `sql_variant`, which tedious doesn't
 * support there.
 */
function isMssqlUnsupportedTvpTypeMessage(message: string): boolean {
    return message.includes(' uses sql_variant which is not supported by the tedious driver for TVP column types.')
}

/** Tells whether the message is about the Active Directory authentication. */
function isMssqlAuthenticationMessage(message: string): boolean {
    return message.includes('Active Directory authentication')
        || message === 'Did not request Active Directory authentication, but received the acknowledgment'
}

/**
 * Tells whether the message says that the server answered with a feature, a TDS version or an interface the driver
 * doesn't know.
 */
function isMssqlFeatureNotSupportedMessage(message: string): boolean {
    return message === 'Received acknowledgement for unknown feature'
        || message === 'Server responded with unknown TDS version.'
        || message === 'Server responded with unsupported interface.'
}

/** Tells whether the message says that the connection ended or was lost before completing. */
function isMssqlConnectionLostMessage(message: string): boolean {
    return message === 'The connection ended without ever completing the connection'
        || message.startsWith('Connection lost - ')
        || message === 'Connection closed before request completed.'
}

/** Tells whether the message says that the pool or the connection isn't open, is closing or is closed. */
function isMssqlPoolErrorMessage(message: string): boolean {
    return message === 'Cannot close a pool while it is connecting'
        || message === 'Connection not yet open.'
        || message === 'Connection is closing'
        || message === 'Connection is closed.'
}

/**
 * Tells whether the message is about an invalid option of the connection: `useColumnNames`, or the encryption the
 * server requires.
 */
function isMssqlInvalidConnectionConfigurationMessage(message: string): boolean {
    return message === 'Invalid options `useColumnNames`, use `arrayRowMode` instead'
        || message.startsWith('Server requires encryption, ')
}

/** Tells whether the message is one tedious raises for an invalid configuration of the connection. */
function isTediousInvalidConnectionConfigurationMessage(message: string): boolean {
    return message === 'The "config" argument is required and must be of type Object.'
        || message === 'The "config.server" property is required and must be of type string.'
        || message.startsWith('The "config.authentication')
        || message.startsWith('The "config.options.')
        || message.startsWith('The "encrypt" property must be ')
        || message.startsWith('The "type" property must one of ')
        || message.startsWith('Port and instanceName are mutually exclusive, ')
}

/** Tells whether the message is one tarn raises for an invalid option of the pool. */
function isTarnPoolConfigurationMessage(message: string): boolean {
    return message.startsWith('Tarn: invalid opt.')
        || message.startsWith('Tarn: unsupported option opt.')
        || message === 'Tarn: opt.create function most be provided'
        || message === 'Tarn: opt.destroy function most be provided'
        || message === 'Tarn: opt.min must be an integer >= 0'
        || message === 'Tarn: opt.max must be an integer > 0'
        || message === 'Tarn: opt.max is smaller than opt.min'
}
