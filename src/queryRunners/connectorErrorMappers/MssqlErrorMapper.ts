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

type MssqlError = MssqlBaseError | MssqlConnectionError | MssqlPreparedStatementError | MssqlRequestError | MssqlTransactionError | TimeoutError | PlainMssqlDriverError

type PlainMssqlDriverError = Error & {
    code?: unknown | undefined
    number?: unknown | undefined
    originalError?: unknown | undefined
}

type ErrorMetadata = {
    databaseErrorCode?: string | undefined
    databaseErrorMessage?: string | undefined
}

export function getMssqlErrorReason(error: unknown): TsSqlErrorReason {
    if (!isMssqlError(error)) {
        return { reason: 'UNKNOWN' }
    }
    return getMssqlDriverOrEngineErrorReason(error)
}

export function isMssqlError(error: unknown): error is MssqlError {
    if (error instanceof TimeoutError) {
        return true
    }
    if (error instanceof MSSQLError || error instanceof ConnectionError || error instanceof PreparedStatementError || error instanceof TransactionError) {
        return true
    }
    return isPlainMssqlDriverError(error)
}

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
        case 'EREQINPROG':
        case 'EINVALIDSTATE':
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
        case 'EREQINPROG':
        case 'EINVALIDSTATE':
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

function getMssqlBaseErrorReason(error: MssqlBaseError): TsSqlErrorReason {
    const metadata = getErrorMetadata(error)
    if (isMssqlInvalidConnectionConfigurationMessage(error.message)) {
        return { reason: 'SQL_CONNECTION_ERROR', ...metadata, errorType: 'invalid connection configuration' }
    }
    return { reason: 'SQL_UNKNOWN', ...metadata }
}

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

function getMssqlInvalidArgumentRequestErrorReason(error: PlainMssqlDriverError, metadata = getErrorMetadata(error)): TsSqlErrorReason {
    if (isMssqlUnsupportedTvpTypeMessage(error.message)) {
        return { reason: 'SQL_INVALID_PARAMETER', ...metadata, parameterErrorType: 'invalid type', parameterName: extractMssqlColumnName(error.message) }
    }
    if (isMssqlInvalidNumberOfArgumentsMessage(error.message)) {
        return { reason: 'SQL_INVALID_PARAMETER', ...metadata, parameterErrorType: 'wrong count' }
    }
    return { reason: 'SQL_INVALID_PARAMETER', ...metadata }
}

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

function getErrorMetadata(error: PlainMssqlDriverError): ErrorMetadata {
    return {
        databaseErrorCode: getMssqlErrorCode(error),
        databaseErrorMessage: error.message || undefined,
    }
}

function getMssqlErrorCode(error: PlainMssqlDriverError | undefined): string | undefined {
    return typeof error?.code === 'string' && error.code ? error.code : undefined
}

function getMssqlErrorNumber(error: PlainMssqlDriverError | undefined): number | undefined {
    return typeof error?.number === 'number' ? error.number : undefined
}

function getOriginalError(error: PlainMssqlDriverError): PlainMssqlDriverError | undefined {
    return error.originalError instanceof Error ? error.originalError as PlainMssqlDriverError : undefined
}

function extractMssqlParameterName(message: string): string | undefined {
    return /^SQL injection warning for param '([^']+)'$/.exec(message)?.[1]
        ?? /^The parameter name ([^\s]+) has already been declared\./.exec(message)?.[1]
        ?? /^Validation failed for parameter '([^']+)'\./.exec(message)?.[1]
}

function extractMssqlColumnName(message: string): string | undefined {
    return /^Column '([^']+)' in TVP /.exec(message)?.[1]
}

function isPlainMssqlDriverError(error: unknown): error is PlainMssqlDriverError {
    if (!(error instanceof Error)) {
        return false
    }
    return isTediousInvalidConnectionConfigurationMessage(error.message)
        || isTarnPoolConfigurationMessage(error.message)
        || isMssqlConnectionLostMessage(error.message)
}

function isInvalidIsolationLevelMessage(message: string): boolean {
    return message === 'Invalid isolation level.'
}

function isMssqlInvalidNumberOfArgumentsMessage(message: string): boolean {
    return message.startsWith('Invalid number of arguments.')
}

function isMssqlUnsupportedTvpTypeMessage(message: string): boolean {
    return message.includes(' uses sql_variant which is not supported by the tedious driver for TVP column types.')
}

function isMssqlAuthenticationMessage(message: string): boolean {
    return message.includes('Active Directory authentication')
        || message === 'Did not request Active Directory authentication, but received the acknowledgment'
}

function isMssqlFeatureNotSupportedMessage(message: string): boolean {
    return message === 'Received acknowledgement for unknown feature'
        || message === 'Server responded with unknown TDS version.'
        || message === 'Server responded with unsupported interface.'
}

function isMssqlConnectionLostMessage(message: string): boolean {
    return message === 'The connection ended without ever completing the connection'
        || message.startsWith('Connection lost - ')
        || message === 'Connection closed before request completed.'
}

function isMssqlPoolErrorMessage(message: string): boolean {
    return message === 'Cannot close a pool while it is connecting'
        || message === 'Connection not yet open.'
        || message === 'Connection is closing'
        || message === 'Connection is closed.'
}

function isMssqlInvalidConnectionConfigurationMessage(message: string): boolean {
    return message === 'Invalid options `useColumnNames`, use `arrayRowMode` instead'
        || message.startsWith('Server requires encryption, ')
}

function isTediousInvalidConnectionConfigurationMessage(message: string): boolean {
    return message === 'The "config" argument is required and must be of type Object.'
        || message === 'The "config.server" property is required and must be of type string.'
        || message.startsWith('The "config.authentication')
        || message.startsWith('The "config.options.')
        || message.startsWith('The "encrypt" property must be ')
        || message.startsWith('The "type" property must one of ')
        || message.startsWith('Port and instanceName are mutually exclusive, ')
}

function isTarnPoolConfigurationMessage(message: string): boolean {
    return message.startsWith('Tarn: invalid opt.')
        || message.startsWith('Tarn: unsupported option opt.')
        || message === 'Tarn: opt.create function most be provided'
        || message === 'Tarn: opt.destroy function most be provided'
        || message === 'Tarn: opt.min must be an integer >= 0'
        || message === 'Tarn: opt.max must be an integer > 0'
        || message === 'Tarn: opt.max is smaller than opt.min'
}
