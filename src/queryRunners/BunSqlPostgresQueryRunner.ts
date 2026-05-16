/// <reference types="bun-types" />

import { TsSqlError, TsSqlProcessingError, type TsSqlDatabaseErrorNumber, type TsSqlErrorReason } from '../TsSqlError.js'
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
    override getErrorReason(error: unknown): TsSqlErrorReason {
        return BunSqlPostgresQueryRunner.getErrorReason(error)
    }
    override isSqlError(error: unknown): boolean {
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
    const databaseErrorNumber = getBunPostgresDatabaseErrorNumber(error)
    if (!(error instanceof SQL.PostgresError)) {
        return withDatabaseErrorNumber({
            reason: 'SQL_UNKNOWN',
            databaseErrorCode: getBunPostgresDatabaseErrorCode(error),
            databaseErrorMessage: error.message,
        }, databaseErrorNumber)
    }
    const sqlState = getPostgresSqlState(error)
    if (sqlState) {
        return getPostgresEngineErrorReason({
            sqlState,
            databaseErrorNumber: sqlState,
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
    const databaseErrorCode = getBunPostgresDatabaseErrorCode(error)
    const databaseErrorNumber = getBunPostgresDatabaseErrorNumber(error)
    const withNumber = (reason: TsSqlErrorReason) => withDatabaseErrorNumber(reason, databaseErrorNumber)
    if (!code) {
        return withNumber({ reason: 'SQL_UNKNOWN', databaseErrorMessage: error.message })
    }

    switch (code) {
        case 'ERR_POSTGRES_CONNECTION_CLOSED':
        case 'ERR_POSTGRES_IDLE_TIMEOUT':
        case 'ERR_POSTGRES_LIFETIME_TIMEOUT':
            return withNumber({ reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage: error.message, errorType: 'connection lost' })
        case 'ERR_POSTGRES_CONNECTION_TIMEOUT':
            return withNumber({ reason: 'SQL_TIMEOUT', databaseErrorCode, databaseErrorMessage: error.message, timeoutType: 'connection' })
        case 'ERR_POSTGRES_QUERY_CANCELLED':
            return withNumber({ reason: 'SQL_TIMEOUT', databaseErrorCode, databaseErrorMessage: error.message, timeoutType: 'cancelled' })
        case 'ERR_POSTGRES_SYNTAX_ERROR':
            return withNumber({ reason: 'SQL_SYNTAX_ERROR', databaseErrorCode, databaseErrorMessage: error.message })
        case 'ERR_POSTGRES_INVALID_QUERY_BINDING':
        case 'ERR_POSTGRES_NOT_TAGGED_CALL':
            return withNumber({ reason: 'SQL_INVALID_PARAMETER', databaseErrorCode, databaseErrorMessage: error.message, parameterErrorType: 'invalid binding' })
        case 'ERR_POSTGRES_TOO_MANY_PARAMETERS':
            return withNumber({ reason: 'SQL_INVALID_PARAMETER', databaseErrorCode, databaseErrorMessage: error.message, ...getBunPostgresTooManyParametersDetails(error.message) })
        case 'ERR_POSTGRES_UNSAFE_TRANSACTION':
            return withNumber({ reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage: error.message, transactionErrorType: 'unsupported operation' })
        case 'ERR_POSTGRES_INVALID_TRANSACTION_STATE':
            return withNumber({ reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage: error.message, transactionErrorType: 'invalid state' })
        case 'ERR_POSTGRES_UNSUPPORTED_AUTHENTICATION_METHOD':
        case 'ERR_POSTGRES_UNKNOWN_AUTHENTICATION_METHOD':
        case 'ERR_POSTGRES_INVALID_SERVER_SIGNATURE':
        case 'ERR_POSTGRES_INVALID_SERVER_KEY':
        case 'ERR_POSTGRES_AUTHENTICATION_FAILED_PBKDF2':
        case 'ERR_POSTGRES_SASL_SIGNATURE_INVALID_BASE64':
        case 'ERR_POSTGRES_SASL_SIGNATURE_MISMATCH':
            return withNumber({ reason: 'SQL_AUTHENTICATION_ERROR', databaseErrorCode, databaseErrorMessage: error.message })
        case 'ERR_POSTGRES_TLS_NOT_AVAILABLE':
        case 'ERR_POSTGRES_TLS_UPGRADE_FAILED':
            return withNumber({ reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage: error.message, errorType: 'invalid connection configuration' })
        case 'ERR_POSTGRES_INVALID_BINARY_DATA':
        case 'ERR_POSTGRES_INVALID_TIME_FORMAT':
        case 'ERR_POSTGRES_UNSUPPORTED_NUMERIC_FORMAT':
        case 'ERR_POSTGRES_UNKNOWN_FORMAT_CODE':
            return withNumber({ reason: 'SQL_INVALID_VALUE', databaseErrorCode, databaseErrorMessage: error.message, errorType: 'invalid format' })
        case 'ERR_POSTGRES_INVALID_BYTE_SEQUENCE':
        case 'ERR_POSTGRES_INVALID_BYTE_SEQUENCE_FOR_ENCODING':
            return withNumber({ reason: 'SQL_INVALID_VALUE', databaseErrorCode, databaseErrorMessage: error.message, errorType: 'invalid encoding' })
        case 'ERR_POSTGRES_INVALID_CHARACTER':
            return withNumber({ reason: 'SQL_INVALID_VALUE', databaseErrorCode, databaseErrorMessage: error.message, errorType: 'invalid value' })
        case 'ERR_POSTGRES_OVERFLOW':
        case 'ERR_POSTGRES_UNSUPPORTED_INTEGER_SIZE':
            return withNumber({ reason: 'SQL_INVALID_VALUE', databaseErrorCode, databaseErrorMessage: error.message, errorType: 'out of range' })
        case 'ERR_POSTGRES_UNSUPPORTED_BYTEA_FORMAT':
        case 'ERR_POSTGRES_UNSUPPORTED_ARRAY_FORMAT':
        case 'ERR_POSTGRES_MULTIDIMENSIONAL_ARRAY_NOT_SUPPORTED_YET':
        case 'ERR_POSTGRES_NULLS_IN_ARRAY_NOT_SUPPORTED_YET':
            return withNumber({ reason: 'SQL_FEATURE_NOT_SUPPORTED', databaseErrorCode, databaseErrorMessage: error.message })
        case 'ERR_POSTGRES_EXPECTED_REQUEST':
        case 'ERR_POSTGRES_EXPECTED_STATEMENT':
        case 'ERR_POSTGRES_INVALID_BACKEND_KEY_DATA':
        case 'ERR_POSTGRES_INVALID_MESSAGE':
        case 'ERR_POSTGRES_INVALID_MESSAGE_LENGTH':
        case 'ERR_POSTGRES_UNEXPECTED_MESSAGE':
            return withNumber({ reason: 'SQL_INTERNAL_ERROR', databaseErrorCode, databaseErrorMessage: error.message, errorType: 'engine internal' })
        case 'ERR_POSTGRES_SERVER_ERROR':
            return withNumber({ reason: 'SQL_UNKNOWN', databaseErrorCode, databaseErrorMessage: error.message })
        default:
            return withNumber({ reason: 'SQL_UNKNOWN', databaseErrorCode, databaseErrorMessage: error.message })
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
    return getStringProperty(error, 'code')
}

function getBunPostgresDatabaseErrorCode(error: BunSqlError): string | undefined {
    const code = getStringProperty(error, 'code')
    return code && !isPostgresSqlState(code) ? code : undefined
}

function getBunPostgresDatabaseErrorNumber(error: BunSqlError): TsSqlDatabaseErrorNumber | undefined {
    const code = getStringProperty(error, 'code')
    if (isPostgresSqlState(code)) {
        return code
    }

    const errno = getStringOrNumberProperty(error, 'errno')
    return errno !== code ? errno : undefined
}

function withDatabaseErrorNumber(reason: TsSqlErrorReason, databaseErrorNumber: TsSqlDatabaseErrorNumber | undefined): TsSqlErrorReason {
    if (databaseErrorNumber === undefined) {
        return reason
    }
    return { ...reason, databaseErrorNumber } as TsSqlErrorReason
}

function getBunPostgresTooManyParametersDetails(message: string): {
    parameterErrorType: 'too many'
    expectedParameterCount?: number
} {
    const maximum = /maximum of (\d+) parameters?/i.exec(message)
    return {
        parameterErrorType: 'too many',
        expectedParameterCount: numberValue(maximum?.[1]),
    }
}

function getStringProperty(error: BunSqlError, property: string): string | undefined {
    const value = (error as unknown as Record<string, unknown>)[property]
    return typeof value === 'string' ? value : undefined
}

function getStringOrNumberProperty(error: BunSqlError, property: string): string | number | undefined {
    const value = (error as unknown as Record<string, unknown>)[property]
    return typeof value === 'string' || typeof value === 'number' ? value : undefined
}

function numberValue(value: string | undefined): number | undefined {
    if (value === undefined) {
        return undefined
    }
    const number = Number(value)
    return Number.isFinite(number) ? number : undefined
}
