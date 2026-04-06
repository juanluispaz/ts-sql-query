import { TsSqlError, TsSqlProcessingError, type TsSqlErrorReason } from '../TsSqlError.js'
import { AbstractQueryRunner } from './AbstractQueryRunner.js'
import type { BeginTransactionOpts, CommitOpts, DatabaseType, QueryRunner, RollbackOpts } from './QueryRunner.js'
import type { Sql, TransactionSql } from 'postgres'

type PostgresJsConnectionError = Error & {
    code?: string
}
type PostgresJsDatabaseError = InstanceType<Sql['PostgresError']>
type PostgresJsError = PostgresJsDatabaseError | PostgresJsConnectionError

export class PostgresQueryRunner extends AbstractQueryRunner {
    database: DatabaseType
    readonly connection: Sql
    transaction?: TransactionSql

    constructor(connection: Sql) {
        super()
        this.connection = connection
        this.database = 'postgreSql'
    }
    useDatabase(database: DatabaseType): void {
        if (database !== 'postgreSql') {
            throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_DATABASE', database }, 'Unsupported database: ' + database + '. PostgresQueryRunner only supports postgreSql databases')
        }
    }
    getNativeRunner(): Sql {
        return this.connection
    }
    getCurrentNativeTransaction(): TransactionSql | undefined {
        return this.transaction
    }
    execute<RESULT>(fn: (connection: unknown, transaction?: unknown) => Promise<RESULT>): Promise<RESULT> {
        return fn(this.connection, this.transaction)
    }
    protected executeQueryReturning(query: string, params: any[]): Promise<any[]> {
        return (this.transaction || this.connection).unsafe(query, params).then((result) => {
            // then is called to ensure the query is executed
            return result
        })
    }
    protected executeMutation(query: string, params: any[]): Promise<number> {
        return (this.transaction || this.connection).unsafe(query, params).then((result) => {
            // then is called to ensure the query is executed
            return result.count
        })
    }
    executeBeginTransaction(_opts: BeginTransactionOpts = []): Promise<void> {
        return Promise.reject(new TsSqlProcessingError({ reason: 'LOW_LEVEL_TRANSACTION_NOT_SUPPORTED' }, 'Low level transaction management is not supported by PostgresQueryRunner'))
    }
    executeCommit(_opts: CommitOpts = []): Promise<void> {
        return Promise.reject(new TsSqlProcessingError({ reason: 'LOW_LEVEL_TRANSACTION_NOT_SUPPORTED' }, 'Low level transaction management is not supported by PostgresQueryRunner'))
    }
    executeRollback(_opts: RollbackOpts = []): Promise<void> {
        return Promise.reject(new TsSqlProcessingError({ reason: 'LOW_LEVEL_TRANSACTION_NOT_SUPPORTED' }, 'Low level transaction management is not supported by PostgresQueryRunner'))
    }
    isTransactionActive(): boolean {
        return !!this.transaction
    }
    addParam(params: any[], value: any): string {
        params.push(value)
        return '$' + params.length
    }
    executeInTransaction<T>(fn: () => Promise<T>, _outermostQueryRunner: QueryRunner, opts: BeginTransactionOpts = []): Promise<T> {
        if (this.transaction) {
            throw new TsSqlProcessingError({ reason: 'NESTED_TRANSACTION_NOT_SUPPORTED' }, 'Nested transactions is not supported by PostgresQueryRunner')
        }
        let options
        try {
            options = this.createBeginTransactionOptions(opts)
        } catch (error) {
            return this.createRejectedPromise(error)
        }
        const callback = (transaction: TransactionSql) => {
            if (this.transaction) {
                throw new TsSqlProcessingError({ reason: 'FORBIDDEN_CONCURRENT_USAGE' }, 'Forbidden concurrent usage of the query runner was detected when it tried to start a transaction')
            }
            this.transaction = transaction
            let result = fn()
            return result.finally(() => {
                this.transaction = undefined
            })
        }
        if (options) {
            return this.connection.begin(options, callback) as Promise<T>
        } else {
            return this.connection.begin(callback) as Promise<T>
        }
    }
    lowLevelTransactionManagementSupported(): boolean {
        return false
    }
    getTransactionLevel(opts: BeginTransactionOpts): string | undefined {
        const level = opts?.[0]
        if (!level || level === 'read uncommitted' || level === 'read committed' || level === 'repeatable read' || level === 'serializable') {
            return level
        }
        throw new TsSqlProcessingError({ reason: 'TRANSACTION_LEVEL_NOT_SUPPORTED', transactionLevel: level }, this.database + " doesn't support the transactions level: " + level)
    }
    getTransactionAccessMode(opts: BeginTransactionOpts): string | undefined {
        const accessMode = opts?.[1]
        if (!accessMode || accessMode === 'read write' || accessMode === 'read only') {
            return accessMode
        }
        throw new TsSqlProcessingError({ reason: 'TRANSACTION_ACCESS_MODE_NOT_SUPPORTED', accessMode }, this.database + " doesn't support the transactions access mode: " + accessMode)
    }
    createBeginTransactionOptions(opts: BeginTransactionOpts): string | undefined {
        let sql
        let level = this.getTransactionLevel(opts)
        if (level) {
            sql = 'isolation level ' + level
        }
        const accessMode = this.getTransactionAccessMode(opts)
        if (accessMode) {
            if (sql) {
                sql += ', '
            }
            sql += accessMode
        }
        return sql
    }
    getErrorReason(error: unknown): TsSqlErrorReason {
        return PostgresQueryRunner.getErrorReason(error)
    }
    isSqlError(error: unknown): boolean {
        return PostgresQueryRunner.isSqlError(error)
    }

    static getErrorReason(error: unknown): TsSqlErrorReason {
        if (error instanceof TsSqlError) {
            return error.errorReason
        }
        if (!isPostgresJsError(error)) {
            return { reason: 'UNKNOWN' }
        }
        return getPostgresErrorReason(error)
    }

    static isSqlError(error: unknown): boolean {
        return error instanceof TsSqlError || isPostgresJsError(error)
    }
}

function getPostgresErrorReason(error: PostgresJsError): TsSqlErrorReason {
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
        case 'CONNECTION_DESTROYED':
        case 'CONNECTION_CLOSED':
        case 'CONNECTION_ENDED':
            return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode: code, databaseErrorMessage: error.message, errorType: 'connection lost' }
        case '08P01':
            if (isPostgresInvalidParameterMessage(error.message)) {
                return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode: code, databaseErrorMessage: error.message }
            }
            return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode: code, databaseErrorMessage: error.message, errorType: 'connection lost' }
        case 'UNDEFINED_VALUE':
        case 'MAX_PARAMETERS_EXCEEDED':
            return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode: code, databaseErrorMessage: error.message }
        case 'SASL_SIGNATURE_MISMATCH':
            return { reason: 'SQL_AUTHENTICATION_ERROR', databaseErrorCode: code, databaseErrorMessage: error.message }
        case 'CONNECT_TIMEOUT':
            return { reason: 'SQL_TIMEOUT', databaseErrorCode: code, databaseErrorMessage: error.message, timeoutType: 'connection' }
        case '28P01':
        case 'AUTH_TYPE_NOT_IMPLEMENTED':
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
        case 'MESSAGE_NOT_SUPPORTED':
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

function getConstraintViolation(error: PostgresJsError, constraintType?: 'unique' | 'not null' | 'foreign key' | 'check' | 'exclusion'): TsSqlErrorReason {
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

function getInvalidValueForColumn(error: PostgresJsError, errorType?: 'out of range' | 'too long' | 'invalid value'): TsSqlErrorReason {
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

function getObjectNotFound(error: PostgresJsError, objectType?: 'schema' | 'table' | 'table or view' | 'column' | 'routine' | 'database'): TsSqlErrorReason {
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

function getObjectAlreadyExists(error: PostgresJsError, objectType?: 'schema' | 'table' | 'table or view' | 'column' | 'routine' | 'database'): TsSqlErrorReason {
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

function getObjectName(error: PostgresJsError): string | undefined {
    return getTableName(error)
        || getColumnName(error)
        || getConstraintName(error)
        || extractQuotedName(error.message)
}

function getSchemaName(error: PostgresJsError): string | undefined {
    return asDatabaseError(error)?.schema_name
}

function getTableName(error: PostgresJsError): string | undefined {
    return asDatabaseError(error)?.table_name
}

function getColumnName(error: PostgresJsError): string | undefined {
    return asDatabaseError(error)?.column_name
}

function getConstraintName(error: PostgresJsError): string | undefined {
    return asDatabaseError(error)?.constraint_name
}

function getTypeName(error: PostgresJsError): string | undefined {
    return asDatabaseError(error)?.type_name
}

function get57014TimeoutType(error: PostgresJsError): 'statement' | 'cancelled' {
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

function isPostgresJsError(error: unknown): error is PostgresJsError {
    if (!(error instanceof Error)) {
        return false
    }

    if (error.name === 'PostgresError') {
        return true
    }

    const code = (error as PostgresJsError).code
    if (typeof code !== 'string') {
        return false
    }

    return code === 'CONNECTION_DESTROYED'
        || code === 'CONNECT_TIMEOUT'
        || code === 'CONNECTION_CLOSED'
        || code === 'CONNECTION_ENDED'
        || code === 'MESSAGE_NOT_SUPPORTED'
        || code === 'NOT_TAGGED_CALL'
        || code === 'UNDEFINED_VALUE'
        || code === 'MAX_PARAMETERS_EXCEEDED'
        || code === 'SASL_SIGNATURE_MISMATCH'
        || code === 'UNSAFE_TRANSACTION'
        || code === 'AUTH_TYPE_NOT_IMPLEMENTED'
}

function isPostgresInvalidParameterMessage(message: string): boolean {
    const lower = message.toLowerCase()
    return lower.includes('bind message supplies')
        || lower.includes('there is no parameter $')
}

function asDatabaseError(error: PostgresJsError): PostgresJsDatabaseError | undefined {
    return error.name === 'PostgresError' ? error as PostgresJsDatabaseError : undefined
}

function getDatabaseErrorCode(error: PostgresJsError): string | undefined {
    return error.code
}
