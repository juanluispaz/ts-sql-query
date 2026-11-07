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

        const channelBinding = /^channel_binding (.+) is not supported$/.exec(message)
        if (channelBinding) {
            return { reason: 'INVALID_CONFIGURATION', name: 'channel_binding', value: channelBinding[1] }
        }

        switch (message) {
            case '.stream has been renamed to .forEach':
                return { reason: 'SQL_INTERNAL_ERROR', databaseErrorMessage, errorType: 'api misuse' }
            case 'Missing publication names':
                return { reason: 'SQL_INVALID_PARAMETER', databaseErrorMessage, parameterErrorType: 'missing' }
        }

        return undefined
    }

    switch (code) {
        case 'CONNECTION_DESTROYED':
        case 'CONNECTION_CLOSED':
        case 'CONNECTION_ENDED':
        // The server didn't answer the cancel of a query, and the connection is destroyed: it comes as the cause of
        // CONNECTION_DESTROYED (or of QUERY_TIMEOUT)
        case 'CANCEL_UNANSWERED':
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
        // A helper (sql(object), sql(rows)) given no columns
        case 'NO_COLUMNS':
            return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode: code, databaseErrorMessage, parameterErrorType: 'invalid value' }
        case 'NO_PARTS':
            // sql.identifier() with no part
            return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode: code, databaseErrorMessage, parameterErrorType: 'missing' }
        case 'BATCH_NOT_ARRAY':
        case 'BATCH_NOT_QUERY':
            // sql.batch(...) given something else than an array of queries
            return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode: code, databaseErrorMessage, parameterErrorType: 'invalid type' }
        case 'MAX_PARAMETERS_EXCEEDED':
            // postgres.js refuses 65534 parameters or more, although its message says that 65534 is the maximum
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode: code, databaseErrorMessage, resourceType: 'parameters', limit: 65533 }
        case 'NOT_TAGGED_CALL':
            return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode: code, databaseErrorMessage, parameterErrorType: 'invalid binding' }
        case 'TYPE_NOT_FOUND':
            // A custom type of the `types` option, given by name, that the database doesn't have (or can't be looked
            // up, with fetch_types: false)
            return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode: code, databaseErrorMessage }
        case 'UNSAFE_TRANSACTION':
        // A savepoint (sql.begin inside sql.begin) given another mode than its transaction's, or prepared
        case 'NESTED_TRANSACTION_MODE':
            return { reason: 'TRANSACTION_ERROR', databaseErrorCode: code, databaseErrorMessage, transactionErrorType: 'unsupported operation' }
        case 'TRANSACTION_ROLLED_BACK':
            // The commit of sql.begin(...) answered ROLLBACK, or a query of a transaction rolled back with sql.rollback()
            return { reason: 'TRANSACTION_ERROR', databaseErrorCode: code, databaseErrorMessage, transactionErrorType: 'transaction rolled back' }
        case 'COPY_IN_PROGRESS':
            return { reason: 'FORBIDDEN_CONCURRENT_USAGE', databaseErrorCode: code, databaseErrorMessage }
        case 'SASL_SIGNATURE_MISMATCH':
        case 'SASL_NONCE_MISMATCH':
        case 'SASL_MECHANISM_NOT_SUPPORTED':
        case 'CHANNEL_BINDING_REQUIRED':
        case 'AUTHENTICATION_INCOMPLETE':
        case 'AUTH_TYPE_NOT_IMPLEMENTED':
            return { reason: 'SQL_AUTHENTICATION_ERROR', databaseErrorCode: code, databaseErrorMessage }
        case 'CONNECT_TIMEOUT':
        // Waited longer than queue_timeout for a connection of the pool
        case 'QUEUE_TIMEOUT':
            return { reason: 'SQL_TIMEOUT', databaseErrorCode: code, databaseErrorMessage, timeoutType: 'connection' }
        case 'QUERY_TIMEOUT':
            // Longer than query_timeout: postgres.js cancels the query, and the cancel is its cause
            return { reason: 'SQL_TIMEOUT', databaseErrorCode: code, databaseErrorMessage, timeoutType: 'statement' }
        case 'SSL_NOT_SUPPORTED':
        case 'SSL_NEGOTIATION_NOT_SUPPORTED':
        case 'TLS_HANDSHAKE_FAILED':
        // A connection parameter (user, database, application_name, ...) with a NUL character
        case 'NUL_CHARACTER':
            return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode: code, databaseErrorMessage, errorType: 'invalid connection configuration' }
        case 'MESSAGE_NOT_SUPPORTED':
            return { reason: 'SQL_FEATURE_NOT_SUPPORTED', databaseErrorCode: code, databaseErrorMessage }
        case 'PROTOCOL_ERROR':
            // A message of the server with an invalid length; it closes the connection, and comes as the cause of
            // CONNECTION_CLOSED
        case 'STATEMENT_PENDING':
            // A prepared statement used before the server described it
            return { reason: 'SQL_INTERNAL_ERROR', databaseErrorCode: code, databaseErrorMessage, errorType: 'engine internal' }
        case 'ARRAY_REMOVED':
        case 'BATCH_EXECUTED':
        case 'BATCH_UNSUPPORTED':
            // sql.array() (removed in postgres.js 4), a query of sql.batch(...) already run, or one that can't go in a batch
            return { reason: 'SQL_INTERNAL_ERROR', databaseErrorCode: code, databaseErrorMessage, errorType: 'api misuse' }
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
    // postgres.js 3 names the field 'data type_name' (with a space) although its types say type_name; 4 names it
    // data_type_name
    const databaseError = asDatabaseError(error) as Record<string, unknown> | undefined
    return stringValue(databaseError?.['data_type_name']) || stringValue(databaseError?.['data type_name']) || stringValue(databaseError?.['type_name'])
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

