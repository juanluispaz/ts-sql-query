import type { DatabaseType, PromiseProvider } from './QueryRunner.js'
import type { DatabaseSync } from 'node:sqlite'
import { SqlTransactionQueryRunner } from './SqlTransactionQueryRunner.js'
import { TsSqlError, TsSqlProcessingError, type TsSqlDatabaseErrorCode, type TsSqlDatabaseErrorNumber, type TsSqlErrorReason } from '../TsSqlError.js'
import { getSqliteEngineErrorReason, getSqliteErrorCodeName } from './databaseErrorMappers/SqliteErrorMapper.js'

export interface NodeSqliteQueryRunnerConfig {
    promise?: PromiseProvider
}

export class NodeSqliteQueryRunner extends SqlTransactionQueryRunner {
    readonly database: DatabaseType
    readonly connection: DatabaseSync
    readonly promise: PromiseProvider

    constructor(connection: DatabaseSync, config?: NodeSqliteQueryRunnerConfig) {
        super()
        this.connection = connection
        this.database = 'sqlite'
        this.promise = config?.promise || Promise
    }

    useDatabase(database: DatabaseType): void {
        if (database !== 'sqlite') {
            throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_DATABASE', database }, 'Unsupported database: ' + database + '. NodeSqliteQueryRunner only supports sqlite databases')
        }
    }

    getNativeRunner(): DatabaseSync {
        return this.connection
    }

    getCurrentNativeTransaction(): undefined {
        return undefined
    }

    execute<RESULT>(fn: (connection: unknown, transaction?: unknown) => Promise<RESULT>): Promise<RESULT> {
        return fn(this.connection)
    }

    protected executeQueryReturning(query: string, params: any[]): Promise<any[]> {
        try {
            const rows = this.connection.prepare(query).all(...params)
            return this.promise.resolve(rows)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    protected executeMutation(query: string, params: any[]): Promise<number> {
        try {
            const changes = this.connection.prepare(query).run(...params).changes
            return this.promise.resolve(Number(changes))
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
        if (this.containsInsertReturningClause(query, params)) {
            return super.executeInsertReturningLastInsertedId(query, params)
        }

        try {
            return this.promise.resolve(this.connection.prepare(query).run(...params).lastInsertRowid)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    addParam(params: any[], value: any): string {
        if (typeof value === 'boolean') {
            params.push(Number(value))
        } else {
            params.push(value)
        }
        return '?'
    }
    createResolvedPromise<RESULT>(result: RESULT): Promise<RESULT> {
        return this.promise.resolve(result)
    }
    createRejectedPromise<RESULT = any>(error: any): Promise<RESULT> {
        return this.promise.reject(error)
    }
    getErrorReason(error: unknown): TsSqlErrorReason {
        return NodeSqliteQueryRunner.getErrorReason(error)
    }
    isSqlError(error: unknown): boolean {
        return NodeSqliteQueryRunner.isSqlError(error)
    }

    static getErrorReason(error: unknown): TsSqlErrorReason {
        if (error instanceof TsSqlError) {
            return error.errorReason
        }
        if (!isNodeSqliteError(error)) {
            return { reason: 'UNKNOWN' }
        }
        return getNodeSqliteErrorReason(error)
    }

    static isSqlError(error: unknown): boolean {
        return error instanceof TsSqlError || isNodeSqliteError(error)
    }
}

type NodeSqliteError = Error & {
    code?: string
    errcode?: number
    errstr?: string
}
type NodeSqliteEngineError = NodeSqliteError & {
    code: string
    errcode: number
}

function getNodeSqliteErrorReason(error: NodeSqliteError): TsSqlErrorReason {
    if (isNodeSqliteEngineError(error)) {
        return getNodeSqliteEngineErrorReason(error)
    }
    const driverReason = getNodeSqliteDriverErrorReason(error)
    if (driverReason) {
        return driverReason
    }
    const databaseErrorMessage = error.message || undefined
    return {
        reason: 'SQL_UNKNOWN',
        databaseErrorCode: getNodeSqliteDatabaseErrorCode(error),
        databaseErrorMessage,
    }
}

function getNodeSqliteEngineErrorReason(error: NodeSqliteEngineError): TsSqlErrorReason {
    const sqliteCode = getNodeSqliteSqliteErrorCode(error)
    return getSqliteEngineErrorReason({
        code: sqliteCode,
        databaseErrorCode: sqliteCode || getNodeSqliteDatabaseErrorCode(error),
        databaseErrorNumber: getNodeSqliteDatabaseErrorNumber(error),
        message: error.message,
    })
}

function getNodeSqliteDriverErrorReason(error: NodeSqliteError): TsSqlErrorReason | undefined {
    const message = error.message || ''
    const normalizedMessage = normalizeMessage(message)
    const upper = normalizedMessage.toUpperCase()
    const code = error.code
    const databaseErrorCode = getNodeSqliteDatabaseErrorCode(error)
    const databaseErrorMessage = message || undefined

    if (!normalizedMessage) {
        if (code === 'ERR_MEMORY_ALLOCATION_FAILED') {
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'memory', databaseErrorCode }
        }
        return undefined
    }

    if (code === 'ERR_INVALID_STATE') {
        if (upper.includes('DATABASE IS NOT OPEN')) {
            return { reason: 'SQL_CONNECTION_ERROR', errorType: 'connection lost', databaseErrorCode, databaseErrorMessage }
        }
        if (upper.includes('STATEMENT HAS BEEN FINALIZED')) {
            return { reason: 'SQL_OBJECT_STATE_ERROR', objectType: 'prepared statement', objectStateErrorType: 'invalid state', databaseErrorCode, databaseErrorMessage }
        }
        if (upper.includes('ITERATOR WAS INVALIDATED')) {
            return { reason: 'SQL_OBJECT_STATE_ERROR', objectType: 'cursor', objectStateErrorType: 'invalid state', databaseErrorCode, databaseErrorMessage }
        }
        if (upper.includes('DATABASE IS ALREADY OPEN')) {
            return { reason: 'SQL_OBJECT_STATE_ERROR', objectType: 'database', objectStateErrorType: 'invalid state', databaseErrorCode, databaseErrorMessage }
        }
        if (upper.includes('SESSION IS NOT OPEN')) {
            return { reason: 'SQL_INTERNAL_ERROR', errorType: 'api misuse', databaseErrorCode, databaseErrorMessage }
        }
        if (upper.startsWith('UNKNOWN NAMED PARAMETER ')) {
            return { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid name', parameterName: extractSingleQuotedName(message), databaseErrorCode, databaseErrorMessage }
        }
        if (upper.startsWith('CANNOT CREATE BARE NAMED PARAMETER ')) {
            return { reason: 'SQL_AMBIGUOUS_IDENTIFIER', identifier: extractSingleQuotedName(message), identifierType: 'parameter', identifierErrorType: 'ambiguous', databaseErrorCode, databaseErrorMessage }
        }
        if (upper.includes('CANNOT GET NAME OF COLUMN')) {
            return { reason: 'SQL_INTERNAL_ERROR', errorType: 'engine internal', databaseErrorCode, databaseErrorMessage }
        }
        if (upper.includes('EXTENSION LOADING IS NOT ALLOWED') || upper.includes('CANNOT ENABLE EXTENSION LOADING')) {
            return { reason: 'SQL_CONFIGURATION_ERROR', configurationErrorType: 'runtime parameter', databaseErrorCode, databaseErrorMessage }
        }
    }

    if (code === 'ERR_INVALID_ARG_TYPE' && /^Provided value cannot be bound to SQLite parameter \d+\.$/.test(normalizedMessage)) {
        return { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid type', parameterIndex: extractParameterIndex(message), databaseErrorCode, databaseErrorMessage }
    }
    if (code === 'ERR_INVALID_ARG_VALUE' && upper === 'BIGINT VALUE IS TOO LARGE TO BIND.') {
        return { reason: 'SQL_INVALID_VALUE', errorType: 'out of range', databaseErrorCode, databaseErrorMessage }
    }
    if (code === 'ERR_OUT_OF_RANGE') {
        if (isNodeSqliteConfigurationMessage(normalizedMessage)) {
            return { reason: 'SQL_CONFIGURATION_ERROR', configurationErrorType: 'runtime parameter', databaseErrorCode, databaseErrorMessage }
        }
        if (upper.includes('TOO LARGE TO BE REPRESENTED AS A JAVASCRIPT NUMBER') || upper.includes('OUT OF RANGE')) {
            return { reason: 'SQL_INVALID_VALUE', errorType: 'out of range', databaseErrorCode, databaseErrorMessage }
        }
    }
    if ((code === 'ERR_INVALID_ARG_TYPE' || code === 'ERR_INVALID_ARG_VALUE') && isNodeSqliteConfigurationMessage(normalizedMessage)) {
        return { reason: 'SQL_CONFIGURATION_ERROR', configurationErrorType: 'runtime parameter', databaseErrorCode, databaseErrorMessage }
    }
    if (code === 'ERR_INVALID_URL_SCHEME') {
        return { reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration', databaseErrorCode, databaseErrorMessage }
    }
    if (code === 'ERR_INVALID_ARG_TYPE' && isNodeSqliteInvalidConnectionMessage(normalizedMessage)) {
        return { reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration', databaseErrorCode, databaseErrorMessage }
    }
    if ((code === 'ERR_INVALID_ARG_TYPE' || code === 'ERR_INVALID_ARG_VALUE') && isNodeSqliteApiMisuseMessage(normalizedMessage)) {
        return { reason: 'SQL_INTERNAL_ERROR', errorType: 'api misuse', databaseErrorCode, databaseErrorMessage }
    }
    if ((code === 'ERR_CONSTRUCT_CALL_REQUIRED' && upper === 'CANNOT CALL CONSTRUCTOR WITHOUT `NEW`') || (code === 'ERR_ILLEGAL_CONSTRUCTOR' && upper === 'ILLEGAL CONSTRUCTOR')) {
        return { reason: 'SQL_INTERNAL_ERROR', errorType: 'api misuse', databaseErrorCode, databaseErrorMessage }
    }
    if (code === 'ERR_SQLITE_ERROR') {
        if (upper === 'EXPANDED SQL TEXT WOULD EXCEED CONFIGURED LIMITS') {
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode, databaseErrorMessage }
        }
        if (upper === 'FAILED TO CREATE SQLTAGSTORE' || upper === 'FAILED TO CREATE STATEMENTSYNC') {
            return { reason: 'SQL_INTERNAL_ERROR', errorType: 'engine internal', databaseErrorCode, databaseErrorMessage }
        }
    }
    if (code === 'ERR_LOAD_SQLITE_EXTENSION') {
        if (upper.includes('PERMISSION MODEL IS ENABLED')) {
            return { reason: 'SQL_PERMISSION_DENIED', databaseErrorCode, databaseErrorMessage }
        }
        return { reason: 'SQL_EXTERNAL_DATA_SOURCE_ERROR', databaseErrorCode, databaseErrorMessage }
    }
    if (code === 'ERR_MEMORY_ALLOCATION_FAILED') {
        return { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'memory', databaseErrorCode, databaseErrorMessage }
    }
    if (upper === 'AUTHORIZER CALLBACK MUST RETURN AN INTEGER AUTHORIZATION CODE' || upper === 'AUTHORIZER CALLBACK RETURNED A INVALID AUTHORIZATION CODE') {
        return { reason: 'SQL_INTERNAL_ERROR', errorType: 'api misuse', databaseErrorCode, databaseErrorMessage }
    }

    return undefined
}

function isNodeSqliteError(error: unknown): error is NodeSqliteError {
    if (!(error instanceof Error)) {
        return false
    }
    if (isNodeSqliteEngineError(error)) {
        return true
    }
    if (isNodeSqliteCodedError(error)) {
        return true
    }
    return !!getNodeSqliteDriverErrorReason(error)
}

function isNodeSqliteEngineError(error: unknown): error is NodeSqliteEngineError {
    const sqliteError = error as NodeSqliteError
    return !!sqliteError
        && typeof sqliteError.errcode === 'number'
        && typeof sqliteError.code === 'string'
        && sqliteError.code.startsWith('ERR_SQLITE_')
}

function isNodeSqliteCodedError(error: NodeSqliteError): boolean {
    return typeof error.code === 'string' && error.code.startsWith('ERR_SQLITE_')
}

function getNodeSqliteSqliteErrorCode(error: NodeSqliteError): string | undefined {
    return typeof error.errcode === 'number' ? getSqliteErrorCodeName(error.errcode) : undefined
}

function getNodeSqliteDatabaseErrorCode(error: NodeSqliteError): TsSqlDatabaseErrorCode | undefined {
    return getNodeSqliteSqliteErrorCode(error) || error.code
}

function getNodeSqliteDatabaseErrorNumber(error: NodeSqliteError): TsSqlDatabaseErrorNumber | undefined {
    return typeof error.errcode === 'number' ? error.errcode : undefined
}

function normalizeMessage(message: string): string {
    return message.replace(/\s+/g, ' ').trim()
}

function isNodeSqliteConfigurationMessage(message: string): boolean {
    return message === 'Limit value must be a non-negative integer or Infinity.'
        || message === 'Limit value must be non-negative.'
        || /^The "options(?:\.(?:open|readOnly|enableForeignKeyConstraints|enableDoubleQuotedStringLiterals|allowExtension|timeout|readBigInts|returnArrays|allowBareNamedParameters|allowUnknownNamedParameters|defensive|limits(?:\.[^"]+)?|useBigIntArguments|varargs|deterministic|directOnly|inverse|table|db|dbName|start|step|rate|source|target|progress|onConflict|filter))?" argument must be (?:a |an )?.+\.$/.test(message)
}

function isNodeSqliteInvalidConnectionMessage(message: string): boolean {
    return message === 'The "path" argument must be a string, Uint8Array, or URL without null bytes.'
}

function isNodeSqliteApiMisuseMessage(message: string): boolean {
    switch (message) {
        case 'The "path" argument must be a string.':
        case 'The "sql" argument must be a string.':
        case 'The "name" argument must be a string.':
        case 'The "function" argument must be a function.':
        case 'The "dbName" argument must be a string.':
        case 'The "buffer" argument must be a Uint8Array.':
        case 'The "buffer" argument must not be empty.':
        case 'The "sourceDb" argument must be an object.':
        case 'The "changeset" argument must be a Uint8Array.':
        case 'The "allow" argument must be a boolean.':
        case 'The "active" argument must be a boolean.':
        case 'The "callback" argument must be a function or null.':
        case 'The "allowBareNamedParameters" argument must be a boolean.':
        case 'The "enabled" argument must be a boolean.':
        case 'The "readBigInts" argument must be a boolean.':
        case 'The "returnArrays" argument must be a boolean.':
        case 'This method can only be called on SQLTagStore instances.':
        case 'First argument must be an array of strings (template literal).':
        case 'Template literal parts must be strings.':
            return true
    }
    return false
}

function extractSingleQuotedName(message: string): string | undefined {
    const match = /'([^']+)'/.exec(message)
    return match?.[1]
}

function extractParameterIndex(message: string): number | undefined {
    const match = /parameter\s+(\d+)/i.exec(message)
    if (!match?.[1]) {
        return undefined
    }
    const index = Number(match[1])
    return Number.isFinite(index) ? index : undefined
}
