import type { DatabaseType } from './QueryRunner.js'
import type { PGlite } from '@electric-sql/pglite'
import { SqlTransactionQueryRunner } from './SqlTransactionQueryRunner.js'
import { TsSqlError, TsSqlProcessingError, type TsSqlErrorReason } from '../TsSqlError.js'
import { getPostgresEngineErrorReason, isPostgresSqlState } from './databaseErrorMappers/PostgresErrorMapper.js'

type PgLiteDatabaseError = Error & {
    code?: string
    severity?: string
    detail?: string
    hint?: string
    position?: string
    internalPosition?: string
    internalQuery?: string
    where?: string
    schema?: string
    table?: string
    column?: string
    dataType?: string
    constraint?: string
    file?: string
    line?: string
    routine?: string
}

type PgDriverError = Error & {
    code?: string
}

export interface PgQueryRunnerConfig {
    allowNestedTransactions?: boolean
}

export class PgLiteQueryRunner extends SqlTransactionQueryRunner {
    readonly database: DatabaseType
    readonly connection: PGlite
    private config?: PgQueryRunnerConfig

    constructor(connection: PGlite, config?: PgQueryRunnerConfig) {
        super()
        this.connection = connection
        this.database = 'postgreSql'
        this.config = config
    }

    useDatabase(database: DatabaseType): void {
        if (database !== 'postgreSql') {
            throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_DATABASE', database }, 'Unsupported database: ' + database + '. PgLiteQueryRunner only supports postgreSql databases')
        }
    }

    getNativeRunner(): PGlite {
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
        return this.connection.query(query, params).then((result) => result.affectedRows || 0)
    }
    addParam(params: any[], value: any): string {
        params.push(value)
        return '$' + params.length
    }
    nestedTransactionsSupported(): boolean {
        return !!this.config?.allowNestedTransactions
    }
    getErrorReason(error: unknown): TsSqlErrorReason {
        return PgLiteQueryRunner.getErrorReason(error)
    }
    isSqlError(error: unknown): boolean {
        return PgLiteQueryRunner.isSqlError(error)
    }

    static getErrorReason(error: unknown): TsSqlErrorReason {
        if (error instanceof TsSqlError) {
            return error.errorReason
        }
        if (!isPgError(error)) {
            return { reason: 'UNKNOWN' }
        }
        if (isPgLiteDatabaseError(error)) {
            return getPostgresEngineErrorReason({
                sqlState: error.code,
                databaseErrorCode: error.code,
                message: error.message,
                schemaName: error.schema,
                tableName: error.table,
                columnName: error.column,
                typeName: error.dataType,
                constraintName: error.constraint,
            })
        }
        return getPgDriverErrorReason(error)
    }

    static isSqlError(error: unknown): boolean {
        return error instanceof TsSqlError || isPgError(error)
    }

}

function getPgDriverErrorReason(error: PgDriverError): TsSqlErrorReason {
    const code = error.code
    if (code === 'ECONNRESET' || code === 'EPIPE' || code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'EAI_AGAIN' || code === 'EHOSTUNREACH') {
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

function isPgError(error: unknown): error is PgLiteDatabaseError | PgDriverError {
    if (!(error instanceof Error)) {
        return false
    }
    if (isPgLiteDatabaseError(error)) {
        return true
    }
    const code = (error as PgDriverError).code
    return code === 'ECONNRESET'
        || code === 'EPIPE'
        || code === 'ECONNREFUSED'
        || code === 'ENOTFOUND'
        || code === 'EAI_AGAIN'
        || code === 'EHOSTUNREACH'
        || code === 'ETIMEDOUT'
        || code === 'ESOCKETTIMEDOUT'
        || error.message === 'Query read timeout'
        || error.message === 'timeout expired'
        || isPgInvalidParameterError(error.message)
}

function isPgLiteDatabaseError(error: unknown): error is PgLiteDatabaseError {
    if (!(error instanceof Error)) {
        return false
    }
    const code = (error as PgLiteDatabaseError).code
    return isPostgresSqlState(code)
}

function isPgInvalidParameterError(message: string): boolean {
    const lower = message.toLowerCase()
    return lower.includes('bind message supplies')
        || lower.includes('there is no parameter $')
}
