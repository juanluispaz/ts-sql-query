import type { DatabaseType } from './QueryRunner.js'
import { DatabaseError, type ClientBase } from 'pg'
import { SqlTransactionQueryRunner } from './SqlTransactionQueryRunner.js'
import { TsSqlError, TsSqlProcessingError, type TsSqlDatabaseErrorNumber, type TsSqlErrorReason } from '../TsSqlError.js'
import { getPostgresEngineErrorReason, isPostgresSqlState } from './databaseErrorMappers/PostgresErrorMapper.js'

type PgDriverError = Error & {
    code?: string | undefined
    errno?: string | number | undefined
    sqlState?: string | undefined
}

export interface PgQueryRunnerConfig {
    allowNestedTransactions?: boolean | undefined
}

export class PgQueryRunner extends SqlTransactionQueryRunner {
    readonly database: DatabaseType
    readonly connection: ClientBase
    private config?: PgQueryRunnerConfig | undefined

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
    override nestedTransactionsSupported(): boolean {
        return !!this.config?.allowNestedTransactions
    }
    override getErrorReason(error: unknown): TsSqlErrorReason {
        return PgQueryRunner.getErrorReason(error)
    }
    override isSqlError(error: unknown): boolean {
        return PgQueryRunner.isSqlError(error)
    }

    static getErrorReason(error: unknown): TsSqlErrorReason {
        if (error instanceof TsSqlError) {
            return error.errorReason
        }
        if (!isPgError(error)) {
            return { reason: 'UNKNOWN' }
        }
        const engineReason = getPgEngineErrorReason(error)
        if (engineReason) {
            return engineReason
        }
        return getPgDriverErrorReason(error) || { reason: 'UNKNOWN' }
    }

    static isSqlError(error: unknown): boolean {
        return error instanceof TsSqlError || isPgError(error)
    }

}

function getPgEngineErrorReason(error: PgDriverError): TsSqlErrorReason | undefined {
    const sqlState = getPgSqlState(error)
    if (!sqlState && !(error instanceof DatabaseError)) {
        return undefined
    }
    return getPostgresEngineErrorReason({
        sqlState,
        databaseErrorCode: sqlState ? undefined : getStringProperty(error, 'code') || getStringProperty(error, 'sqlState'),
        databaseErrorNumber: sqlState || undefined,
        message: getPgErrorMessage(error),
        schemaName: getStringProperty(error, 'schema') || getStringProperty(error, 'schemaName'),
        tableName: getStringProperty(error, 'table') || getStringProperty(error, 'tableName'),
        columnName: getStringProperty(error, 'column') || getStringProperty(error, 'columnName'),
        typeName: getStringProperty(error, 'dataType') || getStringProperty(error, 'dataTypeName'),
        constraintName: getStringProperty(error, 'constraint') || getStringProperty(error, 'constraintName'),
    })
}

function getPgDriverErrorReason(error: PgDriverError): TsSqlErrorReason | undefined {
    const reason = getPgDriverErrorReasonWithoutNumber(error)
    return reason && withDatabaseErrorNumber(reason, getPgDriverDatabaseErrorNumber(error))
}

function getPgDriverErrorReasonWithoutNumber(error: PgDriverError): TsSqlErrorReason | undefined {
    const code = getStringProperty(error, 'code')
    const message = getPgErrorMessage(error)
    const databaseErrorCode = code || getStringProperty(error, 'sqlState')
    const databaseErrorMessage = message || undefined
    const lower = message.toLowerCase()

    if (code === 'ECONNRESET' || code === 'EPIPE' || code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'EAI_AGAIN' || code === 'EHOSTUNREACH') {
        return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'connection lost' }
    }
    if (code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT') {
        return { reason: 'SQL_TIMEOUT', databaseErrorCode, databaseErrorMessage, timeoutType: 'connection' }
    }
    if (isPgInvalidConnectionConfigurationCode(code)) {
        return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'invalid connection configuration' }
    }

    if (message === 'Query read timeout') {
        return { reason: 'SQL_TIMEOUT', databaseErrorCode, databaseErrorMessage, timeoutType: 'statement' }
    }
    if (message === 'timeout expired' || message === 'timeout exceeded when trying to connect' || message === 'Connection terminated due to connection timeout') {
        return { reason: 'SQL_TIMEOUT', databaseErrorCode, databaseErrorMessage, timeoutType: 'connection' }
    }

    if (message === 'The server does not support SSL connections' || message === 'There was an error establishing an SSL connection') {
        return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'invalid connection configuration' }
    }
    if (message === 'Password must be a string' || lower.startsWith('sasl:') || lower.startsWith('sasl channel binding:')) {
        return { reason: 'SQL_AUTHENTICATION_ERROR', databaseErrorCode, databaseErrorMessage }
    }

    if (isPgInvalidParameterError(message)) {
        return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode, databaseErrorMessage, ...getPgInvalidParameterDetails(message) }
    }
    if (message === 'Client was passed a null or undefined query') {
        return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode, databaseErrorMessage, parameterErrorType: 'invalid value' }
    }
    if (message === 'A query must have either text or a name. Supplying neither is unsupported.') {
        return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode, databaseErrorMessage, parameterErrorType: 'missing' }
    }
    if (message.startsWith('Prepared statements must be unique - ')) {
        return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode, databaseErrorMessage, parameterErrorType: 'invalid value' }
    }
    if (message === 'Query values must be an array' || message === 'Parameters must be an array' || message === 'Passing a function as the first parameter to pool.query is not supported') {
        return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode, databaseErrorMessage, parameterErrorType: 'invalid type' }
    }
    if (message === 'Callback is required' || message === 'Must provide a connection callback') {
        return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode, databaseErrorMessage, parameterErrorType: 'missing' }
    }
    if (isPgWrongArgumentCountError(message)) {
        return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode, databaseErrorMessage, ...getPgWrongArgumentCountDetails(message) }
    }

    if (message.startsWith('circular reference detected while preparing ')) {
        return { reason: 'SQL_INVALID_VALUE', databaseErrorCode, databaseErrorMessage, errorType: 'invalid value' }
    }

    if (message === 'Connection terminated' || message === 'Connection terminated unexpectedly'
        || message === 'Client has encountered a connection error and is not queryable'
        || message === 'Client was closed and is not queryable'
        || message === 'Must be connected to start reader'
        || message === 'Must be connected to start writer'
        || isPgNativeConnectionMessage(lower)) {
        return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'connection lost' }
    }
    if (message === 'Cannot use a pool after calling end on the pool'
        || message === 'Release called on client which has already been released to the pool.'
        || message === 'Called end on pool more than once') {
        return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'pool error' }
    }

    if (message.startsWith('Received unexpected ') && message.endsWith(' message from backend.')) {
        return { reason: 'SQL_INTERNAL_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'engine internal' }
    }
    if (message.startsWith('Unknown authenticationOk message type ')
        || message.startsWith('unrecognized command status: ')
        || message.startsWith('Unrecognized read status: ')
        || message === 'Unable to set non-blocking to true'
        || message === 'Something went wrong dispatching the query'
        || message === 'Unable to allocate cancel struct'
        || message === 'unexpected condition'
        || isPgSaslInternalError(message)) {
        return { reason: 'SQL_INTERNAL_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'engine internal' }
    }
    if (message === 'Binary mode not supported yet') {
        return { reason: 'SQL_FEATURE_NOT_SUPPORTED', databaseErrorCode, databaseErrorMessage }
    }

    if (lower.startsWith('fatal:') && lower.includes('password authentication failed')) {
        return { reason: 'SQL_AUTHENTICATION_ERROR', databaseErrorCode, databaseErrorMessage }
    }
    if (lower.startsWith('fatal:') && lower.includes('no pg_hba.conf entry')) {
        return { reason: 'SQL_AUTHORIZATION_ERROR', databaseErrorCode, databaseErrorMessage }
    }
    if (message.startsWith('ERROR:') || message.startsWith('FATAL:') || message.startsWith('PANIC:')) {
        return { reason: 'SQL_UNKNOWN', databaseErrorCode, databaseErrorMessage }
    }

    return undefined
}

function isPgError(error: unknown): error is DatabaseError | PgDriverError {
    if (!(error instanceof Error)) {
        return false
    }
    return !!getPgEngineErrorReason(error) || !!getPgDriverErrorReason(error)
}

function getPgSqlState(error: PgDriverError): string | undefined {
    const code = getStringProperty(error, 'code')
    if (isPostgresSqlState(code)) {
        return code
    }
    const sqlState = getStringProperty(error, 'sqlState')
    return isPostgresSqlState(sqlState) ? sqlState : undefined
}

function getPgDriverDatabaseErrorNumber(error: PgDriverError): TsSqlDatabaseErrorNumber | undefined {
    const sqlState = getPgSqlState(error)
    if (sqlState) {
        return sqlState
    }

    const code = getStringProperty(error, 'code')
    const errno = getStringOrNumberProperty(error, 'errno')
    return errno !== code ? errno : undefined
}

function getPgErrorMessage(error: PgDriverError): string {
    return error.message || getStringProperty(error, 'messagePrimary') || ''
}

function isPgInvalidConnectionConfigurationCode(code: string | undefined): boolean {
    return code === 'CERT_HAS_EXPIRED'
        || code === 'DEPTH_ZERO_SELF_SIGNED_CERT'
        || code === 'SELF_SIGNED_CERT_IN_CHAIN'
        || code === 'ERR_TLS_CERT_ALTNAME_INVALID'
        || code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'
}

function isPgNativeConnectionMessage(lower: string): boolean {
    return lower.startsWith('connection to server')
        || lower.includes('could not connect')
        || lower.includes('server closed the connection unexpectedly')
        || lower.includes('no connection to the server')
        || lower.includes('connection not open')
}

function isPgSaslInternalError(message: string): boolean {
    return message === 'first argument must be a Buffer'
        || message === 'second argument must be a Buffer'
        || message === 'Buffer lengths must match'
        || message === 'Buffers cannot be empty'
}

function isPgInvalidParameterError(message: string): boolean {
    const lower = message.toLowerCase()
    return lower.includes('bind message supplies')
        || lower.includes('there is no parameter $')
}

function isPgWrongArgumentCountError(message: string): boolean {
    return /^Must supply \d+ arguments?$/i.test(message)
}

function getPgWrongArgumentCountDetails(message: string): {
    parameterErrorType: 'wrong count'
    expectedParameterCount?: number | undefined
} {
    const expected = /^Must supply (\d+) arguments?$/i.exec(message)
    return {
        parameterErrorType: 'wrong count',
        expectedParameterCount: expected ? Number(expected[1]) : undefined,
    }
}

function getPgInvalidParameterDetails(message: string): {
    parameterErrorType: 'missing' | 'wrong count' | 'invalid binding'
    parameterIndex?: number | undefined
    expectedParameterCount?: number | undefined
    actualParameterCount?: number | undefined
} {
    const missingIndex = /there is no parameter \$(\d+)/i.exec(message)
    if (missingIndex) {
        return { parameterErrorType: 'missing', parameterIndex: Number(missingIndex[1]) }
    }

    const wrongCount = /bind message supplies (\d+) parameters?, but prepared statement .+ requires (\d+)/i.exec(message)
    if (wrongCount) {
        return {
            parameterErrorType: 'wrong count',
            actualParameterCount: Number(wrongCount[1]),
            expectedParameterCount: Number(wrongCount[2]),
        }
    }

    if (message.toLowerCase().includes('bind message supplies')) {
        return { parameterErrorType: 'wrong count' }
    }

    return { parameterErrorType: 'invalid binding' }
}

function getStringProperty(error: PgDriverError, property: string): string | undefined {
    const value = (error as unknown as Record<string, unknown>)[property]
    return typeof value === 'string' ? value : undefined
}

function getStringOrNumberProperty(error: PgDriverError, property: string): string | number | undefined {
    const value = (error as unknown as Record<string, unknown>)[property]
    return typeof value === 'string' || typeof value === 'number' ? value : undefined
}

function withDatabaseErrorNumber(reason: TsSqlErrorReason, databaseErrorNumber: TsSqlDatabaseErrorNumber | undefined): TsSqlErrorReason {
    if (databaseErrorNumber === undefined) {
        return reason
    }
    return { ...reason, databaseErrorNumber } as TsSqlErrorReason
}
