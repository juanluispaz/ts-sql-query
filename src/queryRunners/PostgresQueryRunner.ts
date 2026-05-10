import { TsSqlError, TsSqlProcessingError, type TsSqlErrorReason } from '../TsSqlError.js'
import { SqlTransactionQueryRunner } from './SqlTransactionQueryRunner.js'
import type { BeginTransactionOpts, DatabaseType, QueryRunner } from './QueryRunner.js'
import type { Sql, TransactionSql, ReservedSql } from 'postgres'
import { getPostgresEngineErrorReason, isPostgresSqlState } from './databaseErrorMappers/PostgresErrorMapper.js'

type PostgresJsConnectionError = Error & {
    code?: string
}
type PostgresJsDatabaseError = InstanceType<Sql['PostgresError']>
type PostgresJsError = PostgresJsDatabaseError | PostgresJsConnectionError

export class PostgresQueryRunner extends SqlTransactionQueryRunner {
    database: DatabaseType
    readonly connection: Sql
    transaction?: TransactionSql
    lowLevelTransaction?: ReservedSql

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
    getCurrentNativeTransaction(): TransactionSql | ReservedSql | undefined {
        return this.transaction || this.lowLevelTransaction
    }
    private getSql(): Sql | TransactionSql | ReservedSql {
        return this.transaction || this.lowLevelTransaction || this.connection
    }
    execute<RESULT>(fn: (connection: unknown, transaction?: unknown) => Promise<RESULT>): Promise<RESULT> {
        return fn(this.connection, this.transaction || this.lowLevelTransaction)
    }
    protected executeQueryReturning(query: string, params: any[]): Promise<any[]> {
        return this.getSql().unsafe(query, params).then((result) => {
            // then is called to ensure the query is executed
            return result
        })
    }
    protected executeMutation(query: string, params: any[]): Promise<number> {
        return this.getSql().unsafe(query, params).then((result) => {
            // then is called to ensure the query is executed
            return result.count
        })
    }
    executeBeginTransactionQuery(query: string, params: any[]): Promise<number> {
        return this.connection.reserve().then((reserved) => {
            return reserved.unsafe(query, params).then(
                (result) => {
                    if (this.transaction || this.lowLevelTransaction) {
                        const error = new TsSqlProcessingError({ reason: 'FORBIDDEN_CONCURRENT_USAGE' }, 'Forbidden concurrent usage of the query runner was detected when it tried to start a transaction')
                        return reserved.unsafe('rollback', []).then(
                            () => {
                                reserved.release()
                                return this.createRejectedPromise(error)
                            },
                            () => {
                                reserved.release()
                                return this.createRejectedPromise(error)
                            }
                        )
                    }
                    this.lowLevelTransaction = reserved
                    return result.count
                },
                (error) => {
                    reserved.release()
                    return this.createRejectedPromise(error)
                }
            )
        })

    }
    executeCommitQuery(query: string, params: any[]): Promise<number> {
        const transaction = this.lowLevelTransaction
        if (!transaction) {
            return this.createRejectedPromise(new TsSqlProcessingError({ reason: 'NOT_IN_TRANSACTION' }, 'Not in a low level transaction, you cannot commit the transaction'))
        }

        return transaction.unsafe(query, params).then(
            (result) => {
                this.lowLevelTransaction = undefined
                transaction.release()
                return result.count
            },
            (error) => {
                return this.createRejectedPromise(error)
            }
        )
    }
    executeRollbackQuery(query: string, params: any[]): Promise<number> {
        const transaction = this.lowLevelTransaction
        if (!transaction) {
            return this.createRejectedPromise(new TsSqlProcessingError({ reason: 'NOT_IN_TRANSACTION' }, 'Not in a low level transaction, you cannot rollback the transaction'))
        }

        return transaction.unsafe(query, params).then(
            (result) => {
                this.lowLevelTransaction = undefined
                transaction.release()
                return result.count
            },
            (error) => {
                this.lowLevelTransaction = undefined
                transaction.release()
                return this.createRejectedPromise(error)
            }
        )
    }
    isTransactionActive(): boolean {
        return !!this.transaction || !!this.lowLevelTransaction || super.isTransactionActive()
    }
    addParam(params: any[], value: any): string {
        params.push(value)
        return '$' + params.length
    }
    executeInTransaction<T>(fn: () => Promise<T>, _outermostQueryRunner: QueryRunner, opts: BeginTransactionOpts = []): Promise<T> {
        if (this.transaction || this.lowLevelTransaction) {
            return this.createRejectedPromise(new TsSqlProcessingError({ reason: 'NESTED_TRANSACTION_NOT_SUPPORTED' }, 'Nested transactions are not supported by PostgresQueryRunner'))
        }
        let options
        try {
            options = this.createBeginTransactionOptions(opts)
        } catch (error) {
            return this.createRejectedPromise(error)
        }
        const callback = (transaction: TransactionSql) => {
            if (this.transaction || this.lowLevelTransaction) {
                return this.createRejectedPromise(new TsSqlProcessingError({ reason: 'FORBIDDEN_CONCURRENT_USAGE' }, 'Forbidden concurrent usage of the query runner was detected when it tried to start a transaction'))
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
        return { reason: 'SQL_UNKNOWN', databaseErrorMessage: error.message }
    }

    if (isPostgresSqlState(code)) {
        return getPostgresEngineErrorReason({
            sqlState: code,
            databaseErrorCode: code,
            message: error.message,
            schemaName: getSchemaName(error),
            tableName: getTableName(error),
            columnName: getColumnName(error),
            typeName: getTypeName(error),
            constraintName: getConstraintName(error),
        })
    }

    switch (code) {
        case 'CONNECTION_DESTROYED':
        case 'CONNECTION_CLOSED':
        case 'CONNECTION_ENDED':
            return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode: code, databaseErrorMessage: error.message, errorType: 'connection lost' }
        case 'ECONNRESET':
        case 'EPIPE':
        case 'ECONNREFUSED':
        case 'ENOTFOUND':
        case 'EAI_AGAIN':
        case 'EHOSTUNREACH':
            return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode: code, databaseErrorMessage: error.message, errorType: 'connection lost' }
        case 'UNDEFINED_VALUE':
            return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode: code, databaseErrorMessage: error.message, parameterErrorType: 'invalid value' }
        case 'MAX_PARAMETERS_EXCEEDED':
            return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode: code, databaseErrorMessage: error.message, parameterErrorType: 'too many' }
        case 'NOT_TAGGED_CALL':
            return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode: code, databaseErrorMessage: error.message, parameterErrorType: 'invalid binding' }
        case 'UNSAFE_TRANSACTION':
            return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode: code, databaseErrorMessage: error.message }
        case 'SASL_SIGNATURE_MISMATCH':
        case 'AUTH_TYPE_NOT_IMPLEMENTED':
            return { reason: 'SQL_AUTHENTICATION_ERROR', databaseErrorCode: code, databaseErrorMessage: error.message }
        case 'CONNECT_TIMEOUT':
            return { reason: 'SQL_TIMEOUT', databaseErrorCode: code, databaseErrorMessage: error.message, timeoutType: 'connection' }
        case 'MESSAGE_NOT_SUPPORTED':
            return { reason: 'SQL_FEATURE_NOT_SUPPORTED', databaseErrorCode: code, databaseErrorMessage: error.message }
        default:
            return { reason: 'SQL_UNKNOWN', databaseErrorCode: code, databaseErrorMessage: error.message }
    }
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
        || code === 'ECONNRESET'
        || code === 'EPIPE'
        || code === 'ECONNREFUSED'
        || code === 'ENOTFOUND'
        || code === 'EAI_AGAIN'
        || code === 'EHOSTUNREACH'
        || code === 'MESSAGE_NOT_SUPPORTED'
        || code === 'NOT_TAGGED_CALL'
        || code === 'UNDEFINED_VALUE'
        || code === 'MAX_PARAMETERS_EXCEEDED'
        || code === 'SASL_SIGNATURE_MISMATCH'
        || code === 'UNSAFE_TRANSACTION'
        || code === 'AUTH_TYPE_NOT_IMPLEMENTED'
}

function asDatabaseError(error: PostgresJsError): PostgresJsDatabaseError | undefined {
    return error.name === 'PostgresError' ? error as PostgresJsDatabaseError : undefined
}

function stringValue(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined
}
