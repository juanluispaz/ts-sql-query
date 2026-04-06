import type { DatabaseType } from './QueryRunner.js'
import { DatabaseError, type ClientBase } from 'pg'
import { SqlTransactionQueryRunner } from './SqlTransactionQueryRunner.js'
import { TsSqlError, TsSqlProcessingError, type TsSqlErrorReason } from '../TsSqlError.js'

type PgDriverError = Error & {
    code?: string
}

export interface PgQueryRunnerConfig {
    allowNestedTransactions?: boolean
}

export class PgQueryRunner extends SqlTransactionQueryRunner {
    readonly database: DatabaseType
    readonly connection: ClientBase
    private config?: PgQueryRunnerConfig

    constructor(connection: ClientBase, config?: PgQueryRunnerConfig) {
        super()
        this.connection = connection
        this.database = 'postgreSql'
        this.config = config
    }

    useDatabase(database: DatabaseType): void {
        if (database !== 'postgreSql') {
            throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_DATABASE', database }, 'Unsupported database: ' + database + '. PgQueryRunner only supports postgreSql databases')
        }
    }

    getNativeRunner(): ClientBase {
        return this.connection
    }

    getCurrentNativeTransaction(): undefined {
        return undefined
    }

    execute<RESULT>(fn: (connection: unknown, transaction?: unknown) => Promise<RESULT>): Promise<RESULT> {
        return fn(this.connection)
    }

    protected executeQueryReturning(query: string, params: any[]): Promise<any[]> {
        return this.connection.query(query, params).then((result) => result.rows)
    }
    protected executeMutation(query: string, params: any[]): Promise<number> {
        return this.connection.query(query, params).then((result) => result.rowCount || 0)
    }
    addParam(params: any[], value: any): string {
        params.push(value)
        return '$' + params.length
    }
    nestedTransactionsSupported(): boolean {
        return !!this.config?.allowNestedTransactions
    }
    getErrorReason(error: unknown): TsSqlErrorReason {
        return PgQueryRunner.getErrorReason(error)
    }
    isSqlError(error: unknown): boolean {
        return PgQueryRunner.isSqlError(error)
    }

    static getErrorReason(error: unknown): TsSqlErrorReason {
        if (error instanceof TsSqlError) {
            return error.errorReason
        }
        if (!isPgError(error)) {
            return { reason: 'UNKNOWN' }
        }
        if (error instanceof DatabaseError) {
            return getPgErrorReason(error)
        }
        return getPgDriverErrorReason(error)
    }

    static isSqlError(error: unknown): boolean {
        return error instanceof TsSqlError || isPgError(error)
    }

}

function getPgErrorReason(error: DatabaseError): TsSqlErrorReason {
    const code = error.code
    if (!code) {
        return { reason: 'SQL_UNKNOWN' }
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
            return { reason: 'SQL_AMBIGUOUS_IDENTIFIER', databaseErrorCode: code, databaseErrorMessage: error.message, identifier: error.column || extractQuotedName(error.message) }
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
        case '08P01':
            if (isPgInvalidParameterError(error.message)) {
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

function getConstraintViolation(error: DatabaseError, constraintType?: 'unique' | 'not null' | 'foreign key' | 'check' | 'exclusion'): TsSqlErrorReason {
    return {
        reason: 'SQL_CONSTRAINT_VIOLATED',
        databaseErrorCode: error.code,
        databaseErrorMessage: error.message,
        constraintType,
        constraintName: error.constraint,
        tableName: error.table,
        columnName: error.column,
    }
}

function getPgDriverErrorReason(error: PgDriverError): TsSqlErrorReason {
    const code = error.code
    if (code === 'ECONNRESET' || code === 'EPIPE') {
        return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode: code, databaseErrorMessage: error.message, errorType: 'connection lost' }
    }
    if (code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT') {
        return { reason: 'SQL_TIMEOUT', databaseErrorCode: code, databaseErrorMessage: error.message, timeoutType: 'connection' }
    }
    if (error.message === 'Query read timeout') {
        return { reason: 'SQL_TIMEOUT', databaseErrorCode: code, databaseErrorMessage: error.message, timeoutType: 'statement' }
    }
    if (error.message === 'timeout expired') {
        return { reason: 'SQL_TIMEOUT', databaseErrorCode: code, databaseErrorMessage: error.message, timeoutType: 'connection' }
    }
    if (isPgInvalidParameterError(error.message)) {
        return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode: code, databaseErrorMessage: error.message }
    }
    return { reason: 'SQL_UNKNOWN', databaseErrorCode: code, databaseErrorMessage: error.message }
}

function isPgError(error: unknown): error is DatabaseError | PgDriverError {
    if (!(error instanceof Error)) {
        return false
    }
    if (error instanceof DatabaseError) {
        return true
    }
    const code = (error as PgDriverError).code
    return code === 'ECONNRESET'
        || code === 'EPIPE'
        || code === 'ETIMEDOUT'
        || code === 'ESOCKETTIMEDOUT'
        || error.message === 'Query read timeout'
        || error.message === 'timeout expired'
        || isPgInvalidParameterError(error.message)
}

function isPgInvalidParameterError(message: string): boolean {
    const lower = message.toLowerCase()
    return lower.includes('bind message supplies')
        || lower.includes('there is no parameter $')
}

function getInvalidValueForColumn(error: DatabaseError, errorType?: 'out of range' | 'too long' | 'invalid value'): TsSqlErrorReason {
    return {
        reason: 'SQL_INVALID_VALUE_FOR_COLUMN',
        databaseErrorCode: error.code,
        databaseErrorMessage: error.message,
        errorType,
        tableName: error.table,
        columnName: error.column,
        typeName: error.dataType,
    }
}

function getObjectNotFound(error: DatabaseError, objectType?: 'schema' | 'table' | 'table or view' | 'column' | 'routine' | 'database'): TsSqlErrorReason {
    return {
        reason: 'SQL_OBJECT_NOT_FOUND',
        databaseErrorCode: error.code,
        databaseErrorMessage: error.message,
        objectType,
        schemaName: error.schema,
        tableName: error.table,
        columnName: error.column,
        objectName: getObjectName(error),
    }
}

function getObjectAlreadyExists(error: DatabaseError, objectType?: 'schema' | 'table' | 'table or view' | 'column' | 'routine' | 'database'): TsSqlErrorReason {
    return {
        reason: 'SQL_OBJECT_ALREADY_EXISTS',
        databaseErrorCode: error.code,
        databaseErrorMessage: error.message,
        objectType,
        schemaName: error.schema,
        tableName: error.table,
        columnName: error.column,
        objectName: getObjectName(error),
    }
}

function getObjectName(error: DatabaseError): string | undefined {
    return error.table
        || error.column
        || error.constraint
        || extractQuotedName(error.message)
}

function get57014TimeoutType(error: DatabaseError): 'statement' | 'cancelled' {
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
