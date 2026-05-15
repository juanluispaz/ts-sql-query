/// <reference types="bun-types" />

import { TsSqlError, TsSqlProcessingError, type TsSqlErrorReason } from '../TsSqlError.js'
import { AbstractBunSqlQueryRunner } from './AbstractBunSqlQueryRunner.js'
import type { BeginTransactionOpts, DatabaseType } from './QueryRunner.js'
import { getMySqlMariaDbEngineErrorReason, getMySqlMariaDbErrorCodeName, isMySqlMariaDbEngineErrorCode } from './databaseErrorMappers/MySqlMariaDbErrorMapper.js'
import { SQL } from 'bun'

type BunSqlMySqlError = InstanceType<typeof SQL.MySQLError>
type BunSqlError = InstanceType<typeof SQL.SQLError>

export class BunSqlMySqlQueryRunner extends AbstractBunSqlQueryRunner {
    constructor(connection: SQL, database: 'mySql' | 'mariaDB' = 'mySql') {
        super(connection, database)
        const adapter = connection.options.adapter
        if (!(adapter === 'mysql' || adapter === 'mariadb')) {
            throw new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name: 'adapter', value: adapter }, 'BunSqlMySqlQueryRunner only supports Bun.SQL connections using the mysql or mariadb adapter')
        }
    }
    useDatabase(database: DatabaseType): void {
        if (database !== 'mySql' && database !== 'mariaDB') {
            throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_DATABASE', database }, 'Unsupported database: ' + database + '. BunSqlMySqlQueryRunner only supports mySql or mariaDB databases')
        }
        this.database = database
    }
    protected executeMutation(query: string, params: any[]): Promise<number> {
        const sql = this.transaction || this.lowLevelTransaction || this.connection
        return sql.unsafe(query, params).then((result) => {
            return result.affectedRows
        })
    }
    executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
        if (this.containsInsertReturningClause(query, params)) {
            return super.executeInsertReturningLastInsertedId(query, params)
        }

        const sql = this.transaction || this.lowLevelTransaction || this.connection
        return sql.unsafe(query, params).then((result) => result.lastInsertRowid)
    }
    addParam(params: any[], value: any): string {
        params.push(value)
        return '?'
    }
    createBeginTransactionQuery(opts: BeginTransactionOpts): string {
        const level = this.getTransactionLevel(opts)
        const accessMode = this.getTransactionAccessMode(opts)
        let sql = ''
        if (level) {
            sql += 'set transaction isolation level ' + level + '; '
        }
        sql += 'start transaction'
        if (accessMode) {
            sql += ' ' + accessMode
        }
        return sql
    }
    getErrorReason(error: unknown): TsSqlErrorReason {
        return BunSqlMySqlQueryRunner.getErrorReason(error, this.database)
    }
    isSqlError(error: unknown): boolean {
        return BunSqlMySqlQueryRunner.isSqlError(error)
    }

    static getErrorReason(error: unknown, database?: DatabaseType): TsSqlErrorReason {
        if (error instanceof TsSqlError) {
            return error.errorReason
        }
        if (isBunSqlMySqlError(error)) {
            return getBunSqlMySqlErrorReason(error, database)
        }
        if (isBunSqlError(error)) {
            return { reason: 'SQL_UNKNOWN', databaseErrorMessage: error.message || undefined }
        }
        if (isBunSqlMySqlDriverError(error)) {
            return getBunSqlMySqlDriverErrorReason(error)
        }
        return { reason: 'UNKNOWN' }
    }

    static isSqlError(error: unknown): boolean {
        return error instanceof TsSqlError || isBunSqlMySqlError(error) || isBunSqlError(error) || isBunSqlMySqlDriverError(error)
    }
}

function getBunSqlMySqlErrorReason(error: BunSqlMySqlError, database?: DatabaseType): TsSqlErrorReason {
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

function getKnownBunSqlMySqlConnectorErrorReason(error: BunSqlMySqlError): TsSqlErrorReason | undefined {
    switch (error.code) {
        case 'ERR_MYSQL_CONNECTION_CLOSED':
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
        case 'ERR_MYSQL_INVALID_STATE':
            return withBunSqlMySqlErrorMetadata({ reason: 'SQL_INTERNAL_ERROR', errorType: 'engine internal' }, error)
        case 'ERR_MYSQL_UNKNOWN_ERROR':
            return withBunSqlMySqlErrorMetadata({ reason: 'SQL_UNKNOWN' }, error)
    }

    return undefined
}

function getBunSqlMySqlEngineErrorCode(error: BunSqlMySqlError, database?: DatabaseType): string | undefined {
    const code = error.code || undefined
    const errorNumber = getBunSqlMySqlErrorNumber(error)

    if (errorNumber !== undefined && isBunSqlMySqlGenericServerErrorCode(code)) {
        return getMySqlMariaDbErrorCodeName(errorNumber, database) ?? code
    }
    return code
}

function getBunSqlMySqlErrorNumber(error: BunSqlMySqlError): number | undefined {
    return typeof error.errno === 'number' && error.errno > 0 ? error.errno : undefined
}

function isBunSqlMySqlEngineError(error: BunSqlMySqlError): boolean {
    return getBunSqlMySqlErrorNumber(error) !== undefined
        || !!error.sqlState
        || isMySqlMariaDbEngineErrorCode(error.code)
        || isBunSqlMySqlGenericServerErrorCode(error.code)
}

function isBunSqlMySqlGenericServerErrorCode(code: string | undefined): boolean {
    return code === 'ERR_MYSQL_SERVER_ERROR' || code === 'ERR_MYSQL_SYNTAX_ERROR'
}

function withBunSqlMySqlErrorMetadata(reason: TsSqlErrorReason, error: BunSqlMySqlError): TsSqlErrorReason {
    return withErrorMetadata(reason, error)
}

function getBunSqlMySqlDriverErrorReason(error: Error): TsSqlErrorReason {
    return getKnownBunSqlMySqlDriverErrorReason(error) || { reason: 'SQL_UNKNOWN', databaseErrorMessage: error.message || undefined }
}

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
            return withErrorMetadata({ reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorMessage }, error)
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

function getErrorStringCode(error: Error): string | undefined {
    const code = (error as { code?: unknown }).code
    return typeof code === 'string' && code ? code : undefined
}

function getErrorNumber(error: Error): number | undefined {
    const errno = (error as { errno?: unknown }).errno
    return typeof errno === 'number' && errno > 0 ? errno : undefined
}

function isBunSqlMySqlDriverError(error: unknown): error is Error {
    return error instanceof Error && !!getKnownBunSqlMySqlDriverErrorReason(error)
}

function isBunSqlMySqlError(error: unknown): error is BunSqlMySqlError {
    return error instanceof SQL.MySQLError
}

function isBunSqlError(error: unknown): error is BunSqlError {
    return error instanceof SQL.SQLError
}
