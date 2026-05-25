import type { Sql } from 'postgres'
import type { TsSqlDatabaseErrorNumber, TsSqlErrorReason } from '../../TsSqlError.js'
import { getPostgresEngineErrorReason, isPostgresSqlState } from '../databaseErrorMappers/PostgresErrorMapper.js'

type PostgresJsConnectionError = Error & {
    code?: string | undefined
    errno?: string | number | undefined
}
type PostgresJsDatabaseError = InstanceType<Sql['PostgresError']>
type PostgresJsError = PostgresJsDatabaseError | PostgresJsConnectionError

export function getPostgresJsErrorReason(error: unknown): TsSqlErrorReason {
    if (!isPostgresJsError(error)) {
        return { reason: 'UNKNOWN' }
    }
    return getPostgresErrorReason(error)
}

export function isPostgresJsError(error: unknown): error is PostgresJsError {
    if (!(error instanceof Error)) {
        return false
    }

    if (error.name === 'PostgresError') {
        return true
    }

    return !!getKnownPostgresJsDriverErrorReason(error as PostgresJsError)
}

function getPostgresErrorReason(error: PostgresJsError): TsSqlErrorReason {
    const code = stringValue(error.code)
    if (!code) {
        return getKnownPostgresJsDriverErrorReason(error) || { reason: 'SQL_UNKNOWN', databaseErrorMessage: error.message }
    }

    if (isPostgresSqlState(code)) {
        return getPostgresEngineErrorReason({
            sqlState: code,
            databaseErrorNumber: code,
            message: error.message,
            schemaName: getSchemaName(error),
            tableName: getTableName(error),
            columnName: getColumnName(error),
            typeName: getTypeName(error),
            constraintName: getConstraintName(error),
        })
    }

    const knownDriverReason = getKnownPostgresJsDriverErrorReason(error)
    if (knownDriverReason) {
        return knownDriverReason
    }

    return { reason: 'SQL_UNKNOWN', databaseErrorCode: code, databaseErrorMessage: error.message }
}

function getKnownPostgresJsDriverErrorReason(error: PostgresJsError): TsSqlErrorReason | undefined {
    const reason = getKnownPostgresJsDriverErrorReasonWithoutNumber(error)
    return reason && withDatabaseErrorNumber(reason, getPostgresJsDatabaseErrorNumber(error))
}

function getKnownPostgresJsDriverErrorReasonWithoutNumber(error: PostgresJsError): TsSqlErrorReason | undefined {
    const code = stringValue(error.code)
    const message = error.message
    const databaseErrorMessage = message || undefined

    if (!code) {
        const targetSessionAttrs = /^target_session_attrs (.+) is not supported$/.exec(message)
        if (targetSessionAttrs) {
            return { reason: 'INVALID_CONFIGURATION', name: 'target_session_attrs', value: targetSessionAttrs[1] }
        }

        switch (message) {
            case '.stream has been renamed to .forEach':
                return { reason: 'SQL_INTERNAL_ERROR', databaseErrorMessage, errorType: 'api misuse' }
            case 'Missing publication names':
                return { reason: 'SQL_INVALID_PARAMETER', databaseErrorMessage, parameterErrorType: 'missing' }
        }

        if (message.startsWith('Malformed subscribe pattern: ')) {
            return { reason: 'SQL_INVALID_PARAMETER', databaseErrorMessage, parameterErrorType: 'invalid value' }
        }

        return undefined
    }

    switch (code) {
        case 'CONNECTION_DESTROYED':
        case 'CONNECTION_CLOSED':
        case 'CONNECTION_ENDED':
            return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode: code, databaseErrorMessage, errorType: 'connection lost' }
        case '57014':
            if (isPostgresJsQueryCancelledMessage(message)) {
                return getPostgresEngineErrorReason({ sqlState: code, databaseErrorNumber: code, message })
            }
            return undefined
        case 'ECONNRESET':
        case 'EPIPE':
        case 'ECONNREFUSED':
        case 'ENOTFOUND':
        case 'EAI_AGAIN':
        case 'EHOSTUNREACH':
            return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode: code, databaseErrorMessage, errorType: 'connection lost' }
        case 'ETIMEDOUT':
        case 'ESOCKETTIMEDOUT':
            return { reason: 'SQL_TIMEOUT', databaseErrorCode: code, databaseErrorMessage, timeoutType: 'connection' }
        case 'UNDEFINED_VALUE':
            return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode: code, databaseErrorMessage, parameterErrorType: 'invalid value' }
        case 'MAX_PARAMETERS_EXCEEDED':
            return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode: code, databaseErrorMessage, ...getPostgresJsMaxParametersExceededDetails(message) }
        case 'NOT_TAGGED_CALL':
            return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode: code, databaseErrorMessage, parameterErrorType: 'invalid binding' }
        case 'UNSAFE_TRANSACTION':
            return { reason: 'TRANSACTION_ERROR', databaseErrorCode: code, databaseErrorMessage, transactionErrorType: 'unsupported operation' }
        case 'COPY_IN_PROGRESS':
            return { reason: 'FORBIDDEN_CONCURRENT_USAGE', databaseErrorCode: code, databaseErrorMessage }
        case 'SASL_SIGNATURE_MISMATCH':
        case 'AUTH_TYPE_NOT_IMPLEMENTED':
            return { reason: 'SQL_AUTHENTICATION_ERROR', databaseErrorCode: code, databaseErrorMessage }
        case 'CONNECT_TIMEOUT':
            return { reason: 'SQL_TIMEOUT', databaseErrorCode: code, databaseErrorMessage, timeoutType: 'connection' }
        case 'MESSAGE_NOT_SUPPORTED':
            return { reason: 'SQL_FEATURE_NOT_SUPPORTED', databaseErrorCode: code, databaseErrorMessage }
    }

    if (isPostgresJsInvalidConnectionConfigurationCode(code)) {
        return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode: code, databaseErrorMessage, errorType: 'invalid connection configuration' }
    }

    return undefined
}

function getSchemaName(error: PostgresJsError): string | undefined {
    return stringValue(asDatabaseError(error)?.schema_name)
}

function getTableName(error: PostgresJsError): string | undefined {
    return stringValue(asDatabaseError(error)?.table_name)
}

function getColumnName(error: PostgresJsError): string | undefined {
    return stringValue(asDatabaseError(error)?.column_name)
}

function getConstraintName(error: PostgresJsError): string | undefined {
    return stringValue(asDatabaseError(error)?.constraint_name)
}

function getTypeName(error: PostgresJsError): string | undefined {
    return stringValue(asDatabaseError(error)?.type_name)
}

function asDatabaseError(error: PostgresJsError): PostgresJsDatabaseError | undefined {
    return error.name === 'PostgresError' ? error as PostgresJsDatabaseError : undefined
}

function getPostgresJsDatabaseErrorNumber(error: PostgresJsError): TsSqlDatabaseErrorNumber | undefined {
    const code = stringValue(error.code)
    if (isPostgresSqlState(code)) {
        return code
    }

    const errno = stringOrNumberValue((error as { errno?: unknown }).errno)
    return errno !== code ? errno : undefined
}

function withDatabaseErrorNumber(reason: TsSqlErrorReason, databaseErrorNumber: TsSqlDatabaseErrorNumber | undefined): TsSqlErrorReason {
    if (databaseErrorNumber === undefined) {
        return reason
    }
    return { ...reason, databaseErrorNumber } as TsSqlErrorReason
}

function getPostgresJsMaxParametersExceededDetails(message: string): {
    parameterErrorType: 'too many'
    expectedParameterCount?: number | undefined
} {
    const maximum = /Max number of parameters \((\d+)\) exceeded/i.exec(message)
    return {
        parameterErrorType: 'too many',
        expectedParameterCount: numberValue(maximum?.[1]),
    }
}

function isPostgresJsQueryCancelledMessage(message: string): boolean {
    return message === '57014: canceling statement due to user request'
        || message === 'canceling statement due to user request'
}

function isPostgresJsInvalidConnectionConfigurationCode(code: string): boolean {
    return code === 'CERT_HAS_EXPIRED'
        || code === 'DEPTH_ZERO_SELF_SIGNED_CERT'
        || code === 'SELF_SIGNED_CERT_IN_CHAIN'
        || code === 'ERR_TLS_CERT_ALTNAME_INVALID'
        || code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'
        || code.startsWith('ERR_TLS_')
        || code.startsWith('ERR_SSL_')
}

function stringValue(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined
}

function stringOrNumberValue(value: unknown): string | number | undefined {
    return typeof value === 'string' || typeof value === 'number' ? value : undefined
}

function numberValue(value: string | undefined): number | undefined {
    if (value === undefined) {
        return undefined
    }
    const number = Number(value)
    return Number.isFinite(number) ? number : undefined
}
