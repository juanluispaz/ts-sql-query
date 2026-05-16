import type { DatabaseType } from './QueryRunner.js'
import type { PGlite } from '@electric-sql/pglite'
import { SqlTransactionQueryRunner } from './SqlTransactionQueryRunner.js'
import { TsSqlError, TsSqlProcessingError, type TsSqlErrorReason } from '../TsSqlError.js'
import { getPostgresEngineErrorReason, isPostgresSqlState } from './databaseErrorMappers/PostgresErrorMapper.js'

type PgLiteDatabaseError = Error & {
    code?: string | undefined
    severity?: string | undefined
    detail?: string | undefined
    hint?: string | undefined
    position?: string | undefined
    internalPosition?: string | undefined
    internalQuery?: string | undefined
    where?: string | undefined
    schema?: string | undefined
    table?: string | undefined
    column?: string | undefined
    dataType?: string | undefined
    constraint?: string | undefined
    file?: string | undefined
    line?: string | undefined
    routine?: string | undefined
}

export interface PgQueryRunnerConfig {
    allowNestedTransactions?: boolean | undefined
}

export class PgLiteQueryRunner extends SqlTransactionQueryRunner {
    readonly database: DatabaseType
    readonly connection: PGlite
    private config?: PgQueryRunnerConfig | undefined

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
    override nestedTransactionsSupported(): boolean {
        return !!this.config?.allowNestedTransactions
    }
    override getErrorReason(error: unknown): TsSqlErrorReason {
        return PgLiteQueryRunner.getErrorReason(error)
    }
    override isSqlError(error: unknown): boolean {
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
                databaseErrorNumber: error.code,
                message: error.message,
                schemaName: error.schema,
                tableName: error.table,
                columnName: error.column,
                typeName: error.dataType,
                constraintName: error.constraint,
            })
        }
        return getPgLiteErrorReason(error) || { reason: 'UNKNOWN' }
    }

    static isSqlError(error: unknown): boolean {
        return error instanceof TsSqlError || isPgError(error)
    }

}

function isPgError(error: unknown): error is PgLiteDatabaseError | Error | string {
    return isPgLiteDatabaseError(error) || !!getPgLiteErrorReason(error)
}

function isPgLiteDatabaseError(error: unknown): error is PgLiteDatabaseError {
    if (!(error instanceof Error)) {
        return false
    }
    const code = (error as PgLiteDatabaseError).code
    return isPostgresSqlState(code)
}

function getPgLiteErrorReason(error: unknown): TsSqlErrorReason | undefined {
    const message = getPgLiteErrorMessage(error)
    if (!message) {
        return undefined
    }
    const databaseErrorMessage = message

    if (message === 'PGlite is closing' || message === 'PGlite is closed') {
        return { reason: 'SQL_CONNECTION_ERROR', databaseErrorMessage, errorType: 'connection lost' }
    }

    const invalidInput = /^Invalid input for (string|boolean|date|bytea) type$/.exec(message)
    if (invalidInput) {
        return { reason: 'SQL_INVALID_VALUE', databaseErrorMessage, errorType: 'invalid value', typeName: invalidInput[1] }
    }

    if (message === 'Transaction is closed') {
        return { reason: 'TRANSACTION_ERROR', databaseErrorMessage, transactionErrorType: 'invalid state' }
    }

    if (message === 'No /dev/blob File or Blob provided to read from') {
        return { reason: 'SQL_IO_ERROR', databaseErrorMessage, ioErrorType: 'read' }
    }
    if (message === 'No /dev/blob File or Blob provided to llseek') {
        return { reason: 'SQL_IO_ERROR', databaseErrorMessage, ioErrorType: 'seek' }
    }
    if (message.startsWith('Extension bundle not found: ')) {
        return { reason: 'SQL_IO_ERROR', databaseErrorMessage, ioErrorType: 'file not found' }
    }

    if (message === 'Compression not supported in this environment' || message === 'Unsupported environment for decompression') {
        return { reason: 'SQL_FEATURE_NOT_SUPPORTED', databaseErrorMessage }
    }

    if (message === 'Invalid dataDir, must be a valid path'
        || message.startsWith('Invalid FS bundle size: ')
        || message.startsWith('Unknown package: ')
        || message === 'Database already exists, cannot load from tarball'
        || message.startsWith('INITDB failed to initialize: ')
        || message.startsWith('Bad substitution: ')) {
        return { reason: 'SQL_CONFIGURATION_ERROR', databaseErrorMessage, configurationErrorType: 'runtime parameter' }
    }

    if (message === 'offset and limit must be provided together') {
        return { reason: 'SQL_INVALID_PARAMETER', databaseErrorMessage, parameterErrorType: 'wrong count' }
    }
    if (message === 'offset and limit must be numbers') {
        return { reason: 'SQL_INVALID_PARAMETER', databaseErrorMessage, parameterErrorType: 'invalid type' }
    }
    if (message === 'offset and limit cannot be provided for non-windowed queries') {
        return { reason: 'SQL_INVALID_PARAMETER', databaseErrorMessage, parameterErrorType: 'invalid binding' }
    }
    if (message === 'key is required for changes queries' || message === 'key is required for incremental queries') {
        return { reason: 'SQL_INVALID_PARAMETER', databaseErrorMessage, parameterErrorType: 'missing' }
    }
    if (message === 'Live query is no longer active and cannot be subscribed to') {
        return { reason: 'SQL_INTERNAL_ERROR', databaseErrorMessage, errorType: 'api misuse' }
    }

    if (message === 'Unhandled cmd'
        || message === 'Assertion failed'
        || message === 'PGlite single mode already running'
        || message === 'PGlite failed to initialize properly'
        || message.startsWith('Unknown authenticationOk message type ')
        || message.startsWith('Unhandled pclose ')
        || message.startsWith('Unexpected popen mode value ')
        || message.startsWith('Cannot process startup packet + ')) {
        return { reason: 'SQL_INTERNAL_ERROR', databaseErrorMessage, errorType: 'engine internal' }
    }

    return undefined
}

function getPgLiteErrorMessage(error: unknown): string | undefined {
    if (error instanceof Error) {
        return error.message
    }
    return typeof error === 'string' ? error : undefined
}
