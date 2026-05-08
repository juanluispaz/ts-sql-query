/// <reference types="bun-types" />

import { TsSqlError, TsSqlProcessingError, type TsSqlErrorReason } from '../TsSqlError.js'
import { AbstractBunSqlQueryRunner } from './AbstractBunSqlQueryRunner.js'
import { getPostgresEngineErrorReason, isPostgresSqlState } from './databaseErrorMappers/PostgresErrorMapper.js'
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
    const sqlState = getPostgresSqlState(error)
    if (sqlState) {
        return getPostgresEngineErrorReason({
            sqlState,
            databaseErrorCode: sqlState,
            message: error.message,
            schemaName: getSchemaName(error),
            tableName: getTableName(error),
            columnName: getColumnName(error),
            typeName: getTypeName(error),
            constraintName: getConstraintName(error),
        })
    }

    return getBunPostgresErrorReason(error)
}

function getBunPostgresErrorReason(error: BunSqlPostgresError): TsSqlErrorReason {
    const code = getBunPostgresErrorCode(error)
    if (!code) {
        return { reason: 'SQL_UNKNOWN', databaseErrorMessage: error.message }
    }

    switch (code) {
        case 'ERR_POSTGRES_CONNECTION_CLOSED':
        case 'ERR_POSTGRES_IDLE_TIMEOUT':
        case 'ERR_POSTGRES_LIFETIME_TIMEOUT':
            return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode: code, databaseErrorMessage: error.message, errorType: 'connection lost' }
        case 'ERR_POSTGRES_CONNECTION_TIMEOUT':
            return { reason: 'SQL_TIMEOUT', databaseErrorCode: code, databaseErrorMessage: error.message, timeoutType: 'connection' }
        case 'ERR_POSTGRES_QUERY_CANCELLED':
            return { reason: 'SQL_TIMEOUT', databaseErrorCode: code, databaseErrorMessage: error.message, timeoutType: 'cancelled' }
        case 'ERR_POSTGRES_SYNTAX_ERROR':
            return { reason: 'SQL_SYNTAX_ERROR', databaseErrorCode: code, databaseErrorMessage: error.message }
        case 'ERR_POSTGRES_INVALID_QUERY_BINDING':
        case 'ERR_POSTGRES_NOT_TAGGED_CALL':
        case 'ERR_POSTGRES_UNSAFE_TRANSACTION':
        case 'ERR_POSTGRES_INVALID_TRANSACTION_STATE':
            return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode: code, databaseErrorMessage: error.message }
        case 'ERR_POSTGRES_UNSUPPORTED_AUTHENTICATION_METHOD':
        case 'ERR_POSTGRES_UNKNOWN_AUTHENTICATION_METHOD':
        case 'ERR_POSTGRES_INVALID_SERVER_SIGNATURE':
        case 'ERR_POSTGRES_INVALID_SERVER_KEY':
        case 'ERR_POSTGRES_AUTHENTICATION_FAILED_PBKDF2':
        case 'ERR_POSTGRES_SASL_SIGNATURE_INVALID_BASE64':
        case 'ERR_POSTGRES_SASL_SIGNATURE_MISMATCH':
            return { reason: 'SQL_AUTHENTICATION_ERROR', databaseErrorCode: code, databaseErrorMessage: error.message }
        case 'ERR_POSTGRES_TLS_NOT_AVAILABLE':
        case 'ERR_POSTGRES_TLS_UPGRADE_FAILED':
            return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode: code, databaseErrorMessage: error.message, errorType: 'invalid connection configuration' }
        case 'ERR_POSTGRES_INVALID_BINARY_DATA':
        case 'ERR_POSTGRES_INVALID_BYTE_SEQUENCE':
        case 'ERR_POSTGRES_INVALID_BYTE_SEQUENCE_FOR_ENCODING':
        case 'ERR_POSTGRES_INVALID_CHARACTER':
            return { reason: 'SQL_INVALID_VALUE_FOR_COLUMN', databaseErrorCode: code, databaseErrorMessage: error.message, errorType: 'invalid value' }
        case 'ERR_POSTGRES_OVERFLOW':
        case 'ERR_POSTGRES_UNSUPPORTED_INTEGER_SIZE':
            return { reason: 'SQL_INVALID_VALUE_FOR_COLUMN', databaseErrorCode: code, databaseErrorMessage: error.message, errorType: 'out of range' }
        case 'ERR_POSTGRES_UNSUPPORTED_BYTEA_FORMAT':
        case 'ERR_POSTGRES_MULTIDIMENSIONAL_ARRAY_NOT_SUPPORTED_YET':
        case 'ERR_POSTGRES_NULLS_IN_ARRAY_NOT_SUPPORTED_YET':
            return { reason: 'SQL_FEATURE_NOT_SUPPORTED', databaseErrorCode: code, databaseErrorMessage: error.message }
        case 'ERR_POSTGRES_SERVER_ERROR':
            return { reason: 'SQL_UNKNOWN', databaseErrorCode: code, databaseErrorMessage: error.message }
        default:
            if (code.startsWith('ERR_POSTGRES_')) {
                return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode: code, databaseErrorMessage: error.message }
            }
            return { reason: 'SQL_UNKNOWN', databaseErrorCode: code, databaseErrorMessage: error.message }
    }
}

function getSchemaName(error: BunSqlPostgresError): string | undefined {
    return getStringProperty(error, 'schema')
}

function getTableName(error: BunSqlPostgresError): string | undefined {
    return getStringProperty(error, 'table')
}

function getColumnName(error: BunSqlPostgresError): string | undefined {
    return getStringProperty(error, 'column')
}

function getConstraintName(error: BunSqlPostgresError): string | undefined {
    return getStringProperty(error, 'constraint')
}

function getTypeName(error: BunSqlPostgresError): string | undefined {
    return getStringProperty(error, 'dataType')
}

function isBunSqlError(error: unknown): error is BunSqlError {
    return error instanceof SQL.PostgresError || error instanceof SQL.SQLError
}

function getPostgresSqlState(error: BunSqlPostgresError): string | undefined {
    return isPostgresSqlState(error.code) ? error.code : isPostgresSqlState(error.errno) ? error.errno : undefined
}

function getBunPostgresErrorCode(error: BunSqlPostgresError): string | undefined {
    return error.code
}

function getStringProperty(error: BunSqlPostgresError, property: string): string | undefined {
    const value = (error as unknown as Record<string, unknown>)[property]
    return typeof value === 'string' ? value : undefined
}
