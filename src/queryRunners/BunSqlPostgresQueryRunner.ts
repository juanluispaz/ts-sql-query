/// <reference types="bun-types" />

import { TsSqlError, TsSqlProcessingError, type TsSqlErrorReason } from '../TsSqlError.js'
import { AbstractBunSqlQueryRunner } from './AbstractBunSqlQueryRunner.js'
import { SQL } from 'bun'

type BunSqlPostgresError = InstanceType<typeof SQL.PostgresError>
type BunSqlError = InstanceType<typeof SQL.SQLError>

export class BunSqlPostgresQueryRunner extends AbstractBunSqlQueryRunner {
    constructor(connection: SQL) {
        super(connection, 'postgreSql')
        const adapter = connection.options.adapter
        if (!(adapter == undefined || adapter == 'postgres')) {
            throw new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name: 'adapter', value: adapter }, 'BunSqlPostgresQueryRunner only supports Bun.SQL connections using the postgres adapter')
        }
    }
    getErrorReason(error: unknown): TsSqlErrorReason {
        return BunSqlPostgresQueryRunner.getErrorReason(error)
    }
    isSqlError(error: unknown): boolean {
        return BunSqlPostgresQueryRunner.isSqlError(error)
    }

    static getErrorReason(error: unknown): TsSqlErrorReason {
        if (error instanceof TsSqlError) {
            return error.errorReason
        }
        if (!isBunSqlError(error)) {
            return { reason: 'UNKNOWN' }
        }
        return getPostgresErrorReason(error)
    }

    static isSqlError(error: unknown): boolean {
        return error instanceof TsSqlError || isBunSqlError(error)
    }
}

function getPostgresErrorReason(error: BunSqlError): TsSqlErrorReason {
    if (!(error instanceof SQL.PostgresError)) {
        return { reason: 'SQL_UNKNOWN', databaseErrorMessage: error.message }
    }
    const code = getPostgresSqlState(error)
    if (!code) {
        return getBunPostgresErrorReason(error)
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
            return { reason: 'SQL_DIVISION_BY_ZERO', databaseErrorCode: code, databaseErrorMessage: error.message }
        case '21000':
            return { reason: 'SQL_CARDINALITY_VIOLATION', databaseErrorCode: code, databaseErrorMessage: error.message }
        case '42702':
        case '42P09':
            return { reason: 'SQL_AMBIGUOUS_IDENTIFIER', databaseErrorCode: code, databaseErrorMessage: error.message, identifier: getColumnName(error) || extractQuotedName(error.message) }
        case '42P10':
            return { reason: 'SQL_INVALID_CONFLICT_TARGET', databaseErrorCode: code, databaseErrorMessage: error.message }
        case '42P02':
            return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode: code, databaseErrorMessage: error.message }
        case '42601':
            return { reason: 'SQL_SYNTAX_ERROR', databaseErrorCode: code, databaseErrorMessage: error.message }
        case '42501':
            return { reason: 'SQL_PERMISSION_DENIED', databaseErrorCode: code, databaseErrorMessage: error.message }
        case '40P01':
            return { reason: 'SQL_DEADLOCK_DETECTED', databaseErrorCode: code, databaseErrorMessage: error.message }
        case '57000':
        case '57015':
        case '57P01':
        case '57P02':
            return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode: code, databaseErrorMessage: error.message, errorType: 'connection lost' }
        case '57P03':
            return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode: code, databaseErrorMessage: error.message, errorType: 'temporarily unavailable' }
        case '57P04':
            return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode: code, databaseErrorMessage: error.message, errorType: 'invalid connection configuration' }
        case '55P03':
            return { reason: 'SQL_TIMEOUT', databaseErrorCode: code, databaseErrorMessage: error.message, timeoutType: 'lock' }
        case '57014':
            return { reason: 'SQL_TIMEOUT', databaseErrorCode: code, databaseErrorMessage: error.message, timeoutType: get57014TimeoutType(error) }
        case '25P03':
            return { reason: 'SQL_TIMEOUT', databaseErrorCode: code, databaseErrorMessage: error.message, timeoutType: 'idle transaction' }
        case '25P04':
            return { reason: 'SQL_TIMEOUT', databaseErrorCode: code, databaseErrorMessage: error.message, timeoutType: 'transaction' }
        case '40001':
            return { reason: 'SQL_SERIALIZATION_FAILURE', databaseErrorCode: code, databaseErrorMessage: error.message }
        case '25P01':
        case '2D000':
            return { reason: 'NOT_IN_TRANSACTION', databaseErrorCode: code, databaseErrorMessage: error.message }
        case '25P02':
            return { reason: 'SQL_TRANSACTION_ABORTED', databaseErrorCode: code, databaseErrorMessage: error.message }
        case '25006':
            return { reason: 'SQL_READ_ONLY_VIOLATION', databaseErrorCode: code, databaseErrorMessage: error.message }
        case '08001':
        case '08003':
        case '08004':
        case '08006':
        case '08007':
            return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode: code, databaseErrorMessage: error.message, errorType: 'connection lost' }
        case '08P01':
            if (isPostgresInvalidParameterMessage(error.message)) {
                return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode: code, databaseErrorMessage: error.message }
            }
            return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode: code, databaseErrorMessage: error.message, errorType: 'connection lost' }
        case '28P01':
            return { reason: 'SQL_AUTHENTICATION_ERROR', databaseErrorCode: code, databaseErrorMessage: error.message }
        case '28000':
            return { reason: 'SQL_AUTHORIZATION_ERROR', databaseErrorCode: code, databaseErrorMessage: error.message }
        case '53100':
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode: code, databaseErrorMessage: error.message, resourceType: 'disk' }
        case '53200':
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode: code, databaseErrorMessage: error.message, resourceType: 'memory' }
        case '53300':
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode: code, databaseErrorMessage: error.message, resourceType: 'connections' }
        case '53400':
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode: code, databaseErrorMessage: error.message }
        case '0A000':
            return { reason: 'SQL_FEATURE_NOT_SUPPORTED', databaseErrorCode: code, databaseErrorMessage: error.message }
        default:
            if (code.startsWith('08')) {
                return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode: code, databaseErrorMessage: error.message, errorType: 'connection lost' }
            }
            if (code.startsWith('28')) {
                return { reason: 'SQL_AUTHENTICATION_ERROR', databaseErrorCode: code, databaseErrorMessage: error.message }
            }
            if (code.startsWith('53')) {
                return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode: code, databaseErrorMessage: error.message }
            }
            return { reason: 'SQL_UNKNOWN', databaseErrorCode: code, databaseErrorMessage: error.message }
    }
}

function getBunPostgresErrorReason(error: BunSqlPostgresError): TsSqlErrorReason {
    const code = getBunPostgresErrorCode(error)
    if (!code) {
        return { reason: 'SQL_UNKNOWN', databaseErrorMessage: error.message }
    }

    switch (code) {
        case 'ERR_POSTGRES_CONNECTION_CLOSED':
            return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode: code, databaseErrorMessage: error.message, errorType: 'connection lost' }
        case 'ERR_POSTGRES_QUERY_CANCELLED':
            return { reason: 'SQL_TIMEOUT', databaseErrorCode: code, databaseErrorMessage: error.message, timeoutType: 'cancelled' }
        case 'ERR_POSTGRES_SYNTAX_ERROR':
            return { reason: 'SQL_SYNTAX_ERROR', databaseErrorCode: code, databaseErrorMessage: error.message }
        case 'ERR_POSTGRES_NOT_TAGGED_CALL':
        case 'ERR_POSTGRES_UNSAFE_TRANSACTION':
        case 'ERR_POSTGRES_INVALID_TRANSACTION_STATE':
            return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode: code, databaseErrorMessage: error.message }
        case 'ERR_POSTGRES_UNSUPPORTED_AUTHENTICATION_METHOD':
        case 'ERR_POSTGRES_UNKNOWN_AUTHENTICATION_METHOD':
        case 'ERR_POSTGRES_INVALID_SERVER_SIGNATURE':
        case 'ERR_POSTGRES_INVALID_SERVER_KEY':
        case 'ERR_POSTGRES_AUTHENTICATION_FAILED_PBKDF2':
            return { reason: 'SQL_AUTHENTICATION_ERROR', databaseErrorCode: code, databaseErrorMessage: error.message }
        case 'ERR_POSTGRES_TLS_NOT_AVAILABLE':
        case 'ERR_POSTGRES_TLS_UPGRADE_FAILED':
            return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode: code, databaseErrorMessage: error.message, errorType: 'invalid connection configuration' }
        default:
            if (code.startsWith('ERR_POSTGRES_')) {
                return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode: code, databaseErrorMessage: error.message }
            }
            return { reason: 'SQL_UNKNOWN', databaseErrorCode: code, databaseErrorMessage: error.message }
    }
}

function getConstraintViolation(error: BunSqlError, constraintType?: 'unique' | 'not null' | 'foreign key' | 'check' | 'exclusion'): TsSqlErrorReason {
    return {
        reason: 'SQL_CONSTRAINT_VIOLATED',
        databaseErrorCode: getDatabaseErrorCode(error),
        databaseErrorMessage: error.message,
        constraintType,
        constraintName: getConstraintName(error),
        tableName: getTableName(error),
        columnName: getColumnName(error),
    }
}

function getInvalidValueForColumn(error: BunSqlError, errorType?: 'out of range' | 'too long' | 'invalid value'): TsSqlErrorReason {
    return {
        reason: 'SQL_INVALID_VALUE_FOR_COLUMN',
        databaseErrorCode: getDatabaseErrorCode(error),
        databaseErrorMessage: error.message,
        errorType,
        tableName: getTableName(error),
        columnName: getColumnName(error),
        typeName: getTypeName(error),
    }
}

function getObjectNotFound(error: BunSqlError, objectType?: 'schema' | 'table' | 'table or view' | 'column' | 'routine' | 'database'): TsSqlErrorReason {
    return {
        reason: 'SQL_OBJECT_NOT_FOUND',
        databaseErrorCode: getDatabaseErrorCode(error),
        databaseErrorMessage: error.message,
        objectType,
        schemaName: getSchemaName(error),
        tableName: getTableName(error),
        columnName: getColumnName(error),
        objectName: getObjectName(error),
    }
}

function getObjectAlreadyExists(error: BunSqlError, objectType?: 'schema' | 'table' | 'table or view' | 'column' | 'routine' | 'database'): TsSqlErrorReason {
    return {
        reason: 'SQL_OBJECT_ALREADY_EXISTS',
        databaseErrorCode: getDatabaseErrorCode(error),
        databaseErrorMessage: error.message,
        objectType,
        schemaName: getSchemaName(error),
        tableName: getTableName(error),
        columnName: getColumnName(error),
        objectName: getObjectName(error),
    }
}

function getObjectName(error: BunSqlError): string | undefined {
    return getTableName(error)
        || getColumnName(error)
        || getConstraintName(error)
        || extractQuotedName(error.message)
}

function getSchemaName(error: BunSqlError): string | undefined {
    return asDatabaseError(error)?.schema
}

function getTableName(error: BunSqlError): string | undefined {
    return asDatabaseError(error)?.table
}

function getColumnName(error: BunSqlError): string | undefined {
    return asDatabaseError(error)?.column
}

function getConstraintName(error: BunSqlError): string | undefined {
    return asDatabaseError(error)?.constraint
}

function getTypeName(error: BunSqlError): string | undefined {
    return asDatabaseError(error)?.dataType
}

function get57014TimeoutType(error: BunSqlError): 'statement' | 'cancelled' {
    const message = error.message.toLowerCase()
    if (message.includes('statement timeout') || message.includes('canceling statement due to statement timeout')) {
        return 'statement'
    }
    return 'cancelled'
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

function isBunSqlError(error: unknown): error is BunSqlError {
    return error instanceof SQL.PostgresError || error instanceof SQL.SQLError
}

function isPostgresInvalidParameterMessage(message: string): boolean {
    const lower = message.toLowerCase()
    return lower.includes('bind message supplies')
        || lower.includes('there is no parameter $')
}

function asDatabaseError(error: BunSqlError): BunSqlPostgresError | undefined {
    return error instanceof SQL.PostgresError ? error : undefined
}

function getDatabaseErrorCode(error: BunSqlError): string | undefined {
    if (error instanceof SQL.PostgresError) {
        return getPostgresSqlState(error) || getBunPostgresErrorCode(error)
    }
    return undefined
}

function getPostgresSqlState(error: BunSqlPostgresError): string | undefined {
    return error.errno
}

function getBunPostgresErrorCode(error: BunSqlPostgresError): string | undefined {
    return error.code
}
