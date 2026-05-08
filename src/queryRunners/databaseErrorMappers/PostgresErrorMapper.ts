import type { TsSqlDatabaseErrorCode, TsSqlErrorReason } from '../../TsSqlError.js'

export interface PostgresEngineError {
    sqlState?: string
    databaseErrorCode?: TsSqlDatabaseErrorCode
    message?: string
    schemaName?: string
    tableName?: string
    columnName?: string
    typeName?: string
    constraintName?: string
}

function getPostgresTransactionErrorReasonFromSqlState(
    sqlState: string,
    databaseErrorCode: TsSqlDatabaseErrorCode | undefined,
    databaseErrorMessage: string | undefined
): TsSqlErrorReason | undefined {
    switch (sqlState) {
        case '08007':
            return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'outcome unknown' }
        case '0B000':
            return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'invalid state' }
        case '25000':
            return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'invalid state' }
        case '25001':
        case '25002':
            return { reason: 'NESTED_TRANSACTION_NOT_SUPPORTED', databaseErrorCode, databaseErrorMessage }
        case '25003':
            return { reason: 'TRANSACTION_ACCESS_MODE_NOT_SUPPORTED', accessMode: undefined, databaseErrorCode, databaseErrorMessage }
        case '25004':
        case '25008':
            return { reason: 'TRANSACTION_LEVEL_NOT_SUPPORTED', transactionLevel: undefined, databaseErrorCode, databaseErrorMessage }
        case '25005':
        case '25P01':
            return { reason: 'NOT_IN_TRANSACTION', databaseErrorCode, databaseErrorMessage }
        case '25006':
            return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'read only' }
        case '25007':
            return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'unsupported operation' }
        case '25P02':
            return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'aborted' }
        case '2D000':
            return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'invalid state' }
        case '3B000':
        case '3B001':
            return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'invalid savepoint' }
        case '40000':
            return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'transaction rolled back' }
        case '40001':
            return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'serialization failure' }
        case '40003':
            return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'outcome unknown' }
        case '40P01':
            return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'deadlock' }
    }

    if (sqlState.startsWith('0B')) {
        return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'invalid state' }
    }
    if (sqlState.startsWith('25')) {
        return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'invalid state' }
    }
    if (sqlState.startsWith('2D')) {
        return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'invalid state' }
    }
    if (sqlState.startsWith('3B')) {
        return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'invalid savepoint' }
    }
    if (sqlState.startsWith('40') && sqlState !== '40002') {
        return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'transaction rolled back' }
    }

    return undefined
}

export function getPostgresEngineErrorReason(error: PostgresEngineError): TsSqlErrorReason {
    const code = error.sqlState || ''
    const databaseErrorCode = error.databaseErrorCode ?? (code || undefined)
    const databaseErrorMessage = error.message || undefined

    if (!code) {
        return { reason: 'SQL_UNKNOWN', databaseErrorCode, databaseErrorMessage }
    }

    switch (code) {
        case '23000':
            return getConstraintViolation(error)
        case '23505':
            return getConstraintViolation(error, 'unique')
        case '23502':
            return getConstraintViolation(error, 'not null')
        case '23503':
            return getConstraintViolation(error, 'foreign key')
        case '23514':
            return getConstraintViolation(error, 'check')
        case '23P01':
            return getConstraintViolation(error, 'exclusion')
        case '40002':
            return getConstraintViolation(error)
        case '22003':
            return getInvalidValueForColumn(error, 'out of range')
        case '22001':
            return getInvalidValueForColumn(error, 'too long')
        case '22007':
        case '22P02':
        case '22008':
        case '22018':
        case '22023':
            return getInvalidValueForColumn(error, 'invalid value')
        case '3D000':
            return getObjectNotFound(error, 'database')
        case '3F000':
            return getObjectNotFound(error, 'schema')
        case '42P01':
            return getObjectNotFound(error, 'table or view')
        case '42703':
            return getObjectNotFound(error, 'column')
        case '42704':
            return getObjectNotFound(error)
        case '42883':
            return getObjectNotFound(error, 'routine')
        case '42P04':
            return getObjectAlreadyExists(error, 'database')
        case '42P06':
            return getObjectAlreadyExists(error, 'schema')
        case '42P07':
            return getObjectAlreadyExists(error, 'table or view')
        case '42701':
            return getObjectAlreadyExists(error, 'column')
        case '42710':
            return getObjectAlreadyExists(error)
        case '42723':
            return getObjectAlreadyExists(error, 'routine')
        case '22012':
            return { reason: 'SQL_DIVISION_BY_ZERO', databaseErrorCode, databaseErrorMessage }
        case '21000':
            return { reason: 'SQL_CARDINALITY_VIOLATION', databaseErrorCode, databaseErrorMessage }
        case '42702':
        case '42P09':
            return { reason: 'SQL_AMBIGUOUS_IDENTIFIER', databaseErrorCode, databaseErrorMessage, identifier: stringValue(error.columnName) || extractQuotedName(error.message || '') }
        case '42P10':
            return { reason: 'SQL_INVALID_CONFLICT_TARGET', databaseErrorCode, databaseErrorMessage }
        case '42P02':
            return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode, databaseErrorMessage }
        case '42601':
            return { reason: 'SQL_SYNTAX_ERROR', databaseErrorCode, databaseErrorMessage }
        case '42501':
            return { reason: 'SQL_PERMISSION_DENIED', databaseErrorCode, databaseErrorMessage }
        case '57000':
        case '57015':
        case '57P01':
        case '57P02':
            return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'connection lost' }
        case '57P03':
            return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'temporarily unavailable' }
        case '57P04':
            return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'invalid connection configuration' }
        case '55P03':
            return { reason: 'SQL_TIMEOUT', databaseErrorCode, databaseErrorMessage, timeoutType: 'lock' }
        case '57014':
            return { reason: 'SQL_TIMEOUT', databaseErrorCode, databaseErrorMessage, timeoutType: get57014TimeoutType(error.message || '') }
        case '25P03':
            return { reason: 'SQL_TIMEOUT', databaseErrorCode, databaseErrorMessage, timeoutType: 'idle transaction' }
        case '25P04':
            return { reason: 'SQL_TIMEOUT', databaseErrorCode, databaseErrorMessage, timeoutType: 'transaction' }
        case '08001':
        case '08003':
        case '08004':
        case '08006':
            return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'connection lost' }
        case '08P01':
            if (isPostgresInvalidParameterMessage(error.message || '')) {
                return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode, databaseErrorMessage }
            }
            return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'connection lost' }
        case '28P01':
            return { reason: 'SQL_AUTHENTICATION_ERROR', databaseErrorCode, databaseErrorMessage }
        case '28000':
            return { reason: 'SQL_AUTHORIZATION_ERROR', databaseErrorCode, databaseErrorMessage }
        case '53100':
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode, databaseErrorMessage, resourceType: 'disk' }
        case '53200':
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode, databaseErrorMessage, resourceType: 'memory' }
        case '53300':
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode, databaseErrorMessage, resourceType: 'connections' }
        case '53400':
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode, databaseErrorMessage }
        case '0A000':
            return { reason: 'SQL_FEATURE_NOT_SUPPORTED', databaseErrorCode, databaseErrorMessage }
        default:
            const transactionErrorReason = getPostgresTransactionErrorReasonFromSqlState(code, databaseErrorCode, databaseErrorMessage)
            if (transactionErrorReason) {
                return transactionErrorReason
            }
            if (code.startsWith('08')) {
                return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'connection lost' }
            }
            if (code.startsWith('28')) {
                return { reason: 'SQL_AUTHENTICATION_ERROR', databaseErrorCode, databaseErrorMessage }
            }
            if (code.startsWith('53')) {
                return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode, databaseErrorMessage }
            }
            return { reason: 'SQL_UNKNOWN', databaseErrorCode, databaseErrorMessage }
    }
}

export function isPostgresSqlState(code: unknown): code is string {
    return typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)
}

function getConstraintViolation(error: PostgresEngineError, constraintType?: 'unique' | 'not null' | 'foreign key' | 'check' | 'exclusion'): TsSqlErrorReason {
    return {
        reason: 'SQL_CONSTRAINT_VIOLATED',
        databaseErrorCode: error.databaseErrorCode ?? error.sqlState,
        databaseErrorMessage: error.message || undefined,
        constraintType,
        constraintName: stringValue(error.constraintName),
        tableName: stringValue(error.tableName),
        columnName: stringValue(error.columnName),
    }
}

function getInvalidValueForColumn(error: PostgresEngineError, errorType?: 'out of range' | 'too long' | 'invalid value'): TsSqlErrorReason {
    return {
        reason: 'SQL_INVALID_VALUE_FOR_COLUMN',
        databaseErrorCode: error.databaseErrorCode ?? error.sqlState,
        databaseErrorMessage: error.message || undefined,
        errorType,
        tableName: stringValue(error.tableName),
        columnName: stringValue(error.columnName),
        typeName: stringValue(error.typeName),
    }
}

function getObjectNotFound(error: PostgresEngineError, objectType?: 'schema' | 'table' | 'table or view' | 'column' | 'routine' | 'database'): TsSqlErrorReason {
    return {
        reason: 'SQL_OBJECT_NOT_FOUND',
        databaseErrorCode: error.databaseErrorCode ?? error.sqlState,
        databaseErrorMessage: error.message || undefined,
        objectType,
        schemaName: stringValue(error.schemaName),
        tableName: stringValue(error.tableName),
        columnName: stringValue(error.columnName),
        objectName: getObjectName(error),
    }
}

function getObjectAlreadyExists(error: PostgresEngineError, objectType?: 'schema' | 'table' | 'table or view' | 'column' | 'routine' | 'database'): TsSqlErrorReason {
    return {
        reason: 'SQL_OBJECT_ALREADY_EXISTS',
        databaseErrorCode: error.databaseErrorCode ?? error.sqlState,
        databaseErrorMessage: error.message || undefined,
        objectType,
        schemaName: stringValue(error.schemaName),
        tableName: stringValue(error.tableName),
        columnName: stringValue(error.columnName),
        objectName: getObjectName(error),
    }
}

function getObjectName(error: PostgresEngineError): string | undefined {
    return stringValue(error.tableName)
        || stringValue(error.columnName)
        || stringValue(error.constraintName)
        || extractQuotedName(error.message || '')
}

function get57014TimeoutType(message: string): 'statement' | 'cancelled' {
    const lower = message.toLowerCase()
    if (lower.includes('statement timeout') || lower.includes('canceling statement due to statement timeout')) {
        return 'statement'
    }
    return 'cancelled'
}

function isPostgresInvalidParameterMessage(message: string): boolean {
    const lower = message.toLowerCase()
    return lower.includes('bind message supplies')
        || lower.includes('there is no parameter $')
}

function extractQuotedName(message: string): string | undefined {
    const quoted = /"([^"]+)"/.exec(message)
    if (quoted) {
        return quoted[1]
    }

    const singleQuoted = /'([^']+)'/.exec(message)
    if (singleQuoted) {
        return singleQuoted[1]
    }

    return undefined
}

function stringValue(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined
}
