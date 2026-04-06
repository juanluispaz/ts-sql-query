import { PrismaClientInitializationError, PrismaClientKnownRequestError, PrismaClientRustPanicError, PrismaClientUnknownRequestError, PrismaClientValidationError } from '@prisma/client/runtime/library'
import { TsSqlError, TsSqlProcessingError, type TsSqlDatabaseErrorCode, type TsSqlErrorReason } from '../TsSqlError.js'
import { AbstractQueryRunner } from './AbstractQueryRunner.js'
import type { BeginTransactionOpts, CommitOpts, DatabaseType, QueryRunner, RollbackOpts } from './QueryRunner.js'

interface RawPrismaClient {
    $executeRawUnsafe<_T = any>(query: string, ...values: any[]): Promise<number>
    $queryRawUnsafe<T = any>(query: string, ...values: any[]): Promise<T>;
    $transaction(arg: any, options?: any): Promise<any>
}

export interface PrismaConfig {
    interactiveTransactionsOptions?: { maxWait?: number, timeout?: number },
    forUseInTransaction?: boolean
}

// Prisma surfaces a Prisma-specific error model (`Pxxxx`, `meta`, `message`) instead of
// consistently exposing the native database/driver error. Recent Prisma versions improve
// driver integration, but this experimental runner intentionally maps only Prisma's public
// error surface and uses raw-message heuristics as a best-effort fallback.
export class PrismaQueryRunner extends AbstractQueryRunner {
    readonly database: DatabaseType;
    readonly connection: RawPrismaClient
    private transaction?: RawPrismaClient
    readonly config?: PrismaConfig

    constructor(connection: RawPrismaClient, config?: PrismaConfig) {
        super()
        this.config = config
        this.connection = connection
        let activeProvider = (connection as any)._activeProvider
        switch (activeProvider) {
            case 'postgresql':
                this.database = 'postgreSql';
                break
            case 'mysql':
                this.database = 'mySql'
                break
            case 'sqlite':
                this.database = 'sqlite'
                break
            case 'sqlserver':
                this.database = 'sqlServer'
                break
            default:
                throw new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name: 'activeProvider', value: activeProvider }, 'Unknown Prisma provider of name ' + activeProvider)
        }
        if (config?.forUseInTransaction) {
            this.transaction = connection
        }
    }
    useDatabase(database: DatabaseType): void {
        if (database !== this.database) {
            if (this.database === 'mySql' && database === 'mariaDB') {
                // @ts-ignore
                this.database = database
            } else if (this.database === 'mariaDB' && database === 'mySql') {
                // @ts-ignore
                this.database = database
            } else if (this.database === 'mySql' || this.database === 'mariaDB') {
                throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_DATABASE', database }, 'Unsupported database: ' + database + '. The current connection used in PrismaQueryRunner only supports mySql or mariaDB databases')
            } else {
                throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_DATABASE', database }, 'Unsupported database: ' + database + '. The current connection used in PrismaQueryRunner only supports ' + this.database + ' databases')
            }
        }
    }
    getNativeRunner(): RawPrismaClient {
        return this.connection
    }
    getCurrentNativeTransaction(): RawPrismaClient | undefined {
        return this.transaction
    }
    execute<RESULT>(fn: (connection: unknown, transaction?: unknown) => Promise<RESULT>): Promise<RESULT> {
        return fn(this.connection, this.transaction)
    }
    protected executeQueryReturning(query: string, params: any[]): Promise<any[]> {
        const connection = this.transaction || this.connection
        const result = connection.$queryRawUnsafe<any[]>(query, ...params)
        return this.wrapPrismaPromise(result)
    }
    protected executeMutation(query: string, params: any[]): Promise<number> {
        const connection = this.transaction || this.connection
        const result = connection.$executeRawUnsafe<any[]>(query, ...params)
        return this.wrapPrismaPromise(result)
    }
    executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
        if (this.database === 'mySql' || this.database === 'mariaDB') {
            if (this.containsInsertReturningClause(query, params)) {
                return super.executeInsertReturningLastInsertedId(query, params)
            }

            return this.executeCombined(
                () => this.executeInsert(query, params), 
                () => this.executeSelectOneColumnOneRow('select last_insert_id()', [])
            ).then(([_count, id]) => id)
        }
        if (this.database === 'sqlite') {
            if (this.containsInsertReturningClause(query, params)) {
                return super.executeInsertReturningLastInsertedId(query, params)
            }

            return this.executeCombined(
                () => this.executeInsert(query, params), 
                () => this.executeSelectOneColumnOneRow('select last_insert_rowid()', [])
            ).then(([_count, id]) => id)
        }
        
        return super.executeInsertReturningLastInsertedId(query, params)
    }
    executeBeginTransaction(_opts: BeginTransactionOpts = []): Promise<void> {
        return Promise.reject(new TsSqlProcessingError({ reason: 'LOW_LEVEL_TRANSACTION_NOT_SUPPORTED' }, 'Low level transaction management is not supported by Prisma.'))
    }
    executeCommit(_opts: CommitOpts = []): Promise<void> {
        return Promise.reject(new TsSqlProcessingError({ reason: 'LOW_LEVEL_TRANSACTION_NOT_SUPPORTED' }, 'Low level transaction management is not supported by Prisma.'))
    }
    executeRollback(_opts: RollbackOpts = []): Promise<void> {
        return Promise.reject(new TsSqlProcessingError({ reason: 'LOW_LEVEL_TRANSACTION_NOT_SUPPORTED' }, 'Low level transaction management is not supported by Prisma.'))
    }
    isTransactionActive(): boolean {
        return !!this.transaction
    }
    executeInTransaction<T>(fn: () => Promise<T>, _outermostQueryRunner: QueryRunner, opts: BeginTransactionOpts = []): Promise<T> {
        if (this.transaction) {
            return Promise.reject(new TsSqlProcessingError({ reason: 'NESTED_TRANSACTION_NOT_SUPPORTED' }, this.database + " doesn't support nested transactions (using " + this.constructor.name + ")"))
        }

        const level = opts?.[0]
        const accessMode = opts?.[1]
        if (accessMode) {
            return Promise.reject(new TsSqlProcessingError({ reason: 'TRANSACTION_ACCESS_MODE_NOT_SUPPORTED', accessMode }, this.database + " doesn't support the transactions access mode: " + accessMode + " (using " + this.constructor.name + ")"))
        }
        if (this.database === 'sqlite' && level && level !== 'serializable') {
            return Promise.reject(new TsSqlProcessingError({ reason: 'TRANSACTION_LEVEL_NOT_SUPPORTED', transactionLevel: level }, this.database + " doesn't support the transactions level: " + level))
        }
        
        let isolationLevel
        if (!level) {
        } else if (level === 'read uncommitted') {
            isolationLevel = 'ReadUncommitted'
        } else if (level === 'read committed') {
            isolationLevel = 'ReadCommitted'
        } else if (level === 'repeatable read') {
            isolationLevel = 'RepeatableRead'
        } else if (level === 'snapshot') {
            if (this.database !== 'sqlServer') {
                return Promise.reject(new TsSqlProcessingError({ reason: 'TRANSACTION_LEVEL_NOT_SUPPORTED', transactionLevel: level }, this.database + " doesn't support the transactions level: " + level))
            }
            isolationLevel = 'Snapshot'
        } else if (level === 'serializable') {
            isolationLevel = 'Serializable'
        } else {
            return Promise.reject(new TsSqlProcessingError({ reason: 'TRANSACTION_LEVEL_NOT_SUPPORTED', transactionLevel: level }, this.database + " doesn't support the transactions level: " + level))
        }

        return this.connection.$transaction((interactiveTransactions: RawPrismaClient) => {
            if (this.transaction) {
                throw new TsSqlProcessingError({ reason: 'FORBIDDEN_CONCURRENT_USAGE' }, 'Forbidden concurrent usage of the query runner was detected when it tried to start a transaction.')
            }
            this.transaction = interactiveTransactions
            return fn().finally(() => {
                this.transaction = undefined
            })
        }, {...this.config?.interactiveTransactionsOptions, isolationLevel})
    }
    addParam(params: any[], value: any): string {
        const index = params.length
        let result
        switch (this.database) {
            case 'mariaDB':
                result = '?'
                break
            case 'mySql':
                result = '?'
                break
            case 'noopDB':
                result = '$' + index
                break
            case 'oracle':
                result = ':' + index
                break
            case 'postgreSql':
                result = '$' + (index + 1)
                break
            case 'sqlite':
                result = '?'
                break
            case 'sqlServer':
                result = '@P' + (index  + 1)
                break
            default:
                throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_DATABASE', database: this.database }, 'Unknown database ' + this.database)
        }
        params.push(value)
        return result
    }
    getErrorReason(error: unknown): TsSqlErrorReason {
        return PrismaQueryRunner.getErrorReason(error)
    }
    isSqlError(error: unknown): boolean {
        return PrismaQueryRunner.isSqlError(error)
    }
    static getErrorReason(error: unknown): TsSqlErrorReason {
        if (error instanceof TsSqlError) {
            return error.errorReason
        }
        if (error instanceof PrismaClientKnownRequestError) {
            return getPrismaKnownRequestErrorReason(error)
        }
        if (error instanceof PrismaClientInitializationError) {
            return getPrismaInitializationErrorReason(error)
        }
        if (error instanceof PrismaClientValidationError) {
            return getPrismaValidationErrorReason(error)
        }
        if (error instanceof PrismaClientUnknownRequestError) {
            return getPrismaUnknownRequestErrorReason(error)
        }
        if (error instanceof PrismaClientRustPanicError) {
            return getPrismaRustPanicErrorReason(error)
        }
        return { reason: 'UNKNOWN' }
    }
    static isSqlError(error: unknown): boolean {
        return error instanceof TsSqlError
            || error instanceof PrismaClientKnownRequestError
            || error instanceof PrismaClientInitializationError
            || error instanceof PrismaClientValidationError
            || error instanceof PrismaClientUnknownRequestError
            || error instanceof PrismaClientRustPanicError
    }
    lowLevelTransactionManagementSupported(): boolean {
        return false
    }
    protected wrapPrismaPromise(promise: Promise<any>): Promise<any> {
        // Use a real Promise instead of Prisma proxy to avoid issues due then with one param is not properly managed
        return new Promise((resolve, reject) => {
            promise.then(resolve, reject)
        })
    }
}

function getPrismaKnownRequestErrorReason(error: PrismaClientKnownRequestError): TsSqlErrorReason {
    const databaseErrorCode = getPrismaKnownRequestDatabaseErrorCode(error)
    const databaseErrorMessage = error.message || undefined
    const meta = error.meta
    const message = error.message || ''

    switch (error.code) {
        case 'P1000':
            return { reason: 'SQL_AUTHENTICATION_ERROR', databaseErrorCode, databaseErrorMessage }
        case 'P1001':
            return { reason: 'SQL_CONNECTION_ERROR', errorType: 'temporarily unavailable', databaseErrorCode, databaseErrorMessage }
        case 'P1002':
        case 'P1008':
            return { reason: 'SQL_TIMEOUT', databaseErrorCode, databaseErrorMessage }
        case 'P1003':
            return { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'database', objectName: getPrismaMetaString(meta, 'db'), databaseErrorCode, databaseErrorMessage }
        case 'P1009':
            return { reason: 'SQL_OBJECT_ALREADY_EXISTS', objectType: 'database', objectName: getPrismaMetaString(meta, 'db'), databaseErrorCode, databaseErrorMessage }
        case 'P1010':
            return { reason: 'SQL_AUTHORIZATION_ERROR', databaseErrorCode, databaseErrorMessage }
        case 'P1011':
            return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage }
        case 'P1017':
            return { reason: 'SQL_CONNECTION_ERROR', errorType: 'connection lost', databaseErrorCode, databaseErrorMessage }
        case 'P2000':
            return {
                reason: 'SQL_INVALID_VALUE_FOR_COLUMN',
                errorType: 'too long',
                columnName: getPrismaMetaString(meta, 'column_name') || getPrismaMetaString(meta, 'column'),
                databaseErrorCode,
                databaseErrorMessage,
            }
        case 'P2002': {
            const target = getPrismaMetaStringArray(meta, 'target')
            const singleTarget = getPrismaMetaString(meta, 'target')
            return {
                reason: 'SQL_CONSTRAINT_VIOLATED',
                constraintType: 'unique',
                constraintName: singleTarget && target.length === 0 ? singleTarget : undefined,
                columnName: target.length === 1 ? target[0] : undefined,
                databaseErrorCode,
                databaseErrorMessage,
            }
        }
        case 'P2003':
            return {
                reason: 'SQL_CONSTRAINT_VIOLATED',
                constraintType: 'foreign key',
                columnName: getPrismaMetaString(meta, 'field_name'),
                databaseErrorCode,
                databaseErrorMessage,
            }
        case 'P2004':
            return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode, databaseErrorMessage }
        case 'P2010':
            return getPrismaRawQueryErrorReason(error, databaseErrorCode, databaseErrorMessage)
        case 'P2011':
            return {
                reason: 'SQL_CONSTRAINT_VIOLATED',
                constraintType: 'not null',
                constraintName: getPrismaMetaString(meta, 'constraint'),
                databaseErrorCode,
                databaseErrorMessage,
            }
        case 'P2012':
        case 'P2013':
        case 'P2019':
        case 'P2029':
            return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode, databaseErrorMessage }
        case 'P2014':
            return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode, databaseErrorMessage }
        case 'P2020':
        case 'P2033':
            return { reason: 'SQL_INVALID_VALUE_FOR_COLUMN', errorType: 'out of range', databaseErrorCode, databaseErrorMessage }
        case 'P2021': {
            const tableName = getPrismaMetaString(meta, 'table')
            return {
                reason: 'SQL_OBJECT_NOT_FOUND',
                objectType: 'table or view',
                objectName: tableName,
                tableName,
                databaseErrorCode,
                databaseErrorMessage,
            }
        }
        case 'P2022': {
            const columnName = getPrismaMetaString(meta, 'column')
            return {
                reason: 'SQL_OBJECT_NOT_FOUND',
                objectType: 'column',
                objectName: columnName,
                columnName,
                databaseErrorCode,
                databaseErrorMessage,
            }
        }
        case 'P2023':
            return { reason: 'SQL_INVALID_VALUE_FOR_COLUMN', errorType: 'invalid value', databaseErrorCode, databaseErrorMessage }
        case 'P2024':
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'pool', databaseErrorCode, databaseErrorMessage }
        case 'P2028':
            return getPrismaTransactionApiErrorReason(databaseErrorCode, databaseErrorMessage, message)
        case 'P2030':
            return { reason: 'SQL_FEATURE_NOT_SUPPORTED', databaseErrorCode, databaseErrorMessage }
        case 'P2034':
            if (message.toLowerCase().includes('deadlock')) {
                return { reason: 'SQL_DEADLOCK_DETECTED', databaseErrorCode, databaseErrorMessage }
            }
            return { reason: 'SQL_SERIALIZATION_FAILURE', databaseErrorCode, databaseErrorMessage }
        case 'P2036':
            return { reason: 'SQL_UNKNOWN', databaseErrorCode, databaseErrorMessage }
        case 'P2037':
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'connections', databaseErrorCode, databaseErrorMessage }
        default:
            return { reason: 'SQL_UNKNOWN', databaseErrorCode, databaseErrorMessage }
    }
}

function getPrismaInitializationErrorReason(error: PrismaClientInitializationError): TsSqlErrorReason {
    const databaseErrorCode = error.errorCode
    const databaseErrorMessage = error.message || undefined

    switch (error.errorCode) {
        case 'P1000':
            return { reason: 'SQL_AUTHENTICATION_ERROR', databaseErrorCode, databaseErrorMessage }
        case 'P1001':
            return { reason: 'SQL_CONNECTION_ERROR', errorType: 'temporarily unavailable', databaseErrorCode, databaseErrorMessage }
        case 'P1002':
        case 'P1008':
            return { reason: 'SQL_TIMEOUT', databaseErrorCode, databaseErrorMessage }
        case 'P1003':
            return { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'database', databaseErrorCode, databaseErrorMessage }
        case 'P1009':
            return { reason: 'SQL_OBJECT_ALREADY_EXISTS', objectType: 'database', databaseErrorCode, databaseErrorMessage }
        case 'P1010':
            return { reason: 'SQL_AUTHORIZATION_ERROR', databaseErrorCode, databaseErrorMessage }
        case 'P1011':
            return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage }
        case 'P1017':
            return { reason: 'SQL_CONNECTION_ERROR', errorType: 'connection lost', databaseErrorCode, databaseErrorMessage }
        default:
            return { reason: 'SQL_UNKNOWN', databaseErrorCode, databaseErrorMessage }
    }
}

function getPrismaValidationErrorReason(error: PrismaClientValidationError): TsSqlErrorReason {
    return {
        reason: 'SQL_INVALID_PARAMETER',
        databaseErrorMessage: error.message || undefined,
    }
}

function getPrismaUnknownRequestErrorReason(error: PrismaClientUnknownRequestError): TsSqlErrorReason {
    return {
        reason: 'SQL_UNKNOWN',
        databaseErrorMessage: error.message || undefined,
    }
}

function getPrismaRustPanicErrorReason(error: PrismaClientRustPanicError): TsSqlErrorReason {
    return {
        reason: 'SQL_UNKNOWN',
        databaseErrorMessage: error.message || undefined,
    }
}

function getPrismaRawQueryErrorReason(error: PrismaClientKnownRequestError, databaseErrorCode: TsSqlDatabaseErrorCode | undefined, databaseErrorMessage: string | undefined): TsSqlErrorReason {
    const rawCode = getPrismaMetaString(error.meta, 'code')
    const rawMessage = getPrismaMetaString(error.meta, 'message') || databaseErrorMessage
    const lower = (rawMessage || '').toLowerCase()

    if (lower.includes('unique constraint') || lower.includes('duplicate key') || lower.includes('duplicate entry')) {
        return { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'unique', databaseErrorCode: rawCode || databaseErrorCode, databaseErrorMessage: rawMessage }
    }
    if (lower.includes('foreign key constraint')) {
        return { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'foreign key', databaseErrorCode: rawCode || databaseErrorCode, databaseErrorMessage: rawMessage }
    }
    if (lower.includes('not null constraint') || lower.includes('cannot be null') || lower.includes('null value in column')) {
        return { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'not null', databaseErrorCode: rawCode || databaseErrorCode, databaseErrorMessage: rawMessage }
    }
    if (lower.includes('check constraint')) {
        return { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'check', databaseErrorCode: rawCode || databaseErrorCode, databaseErrorMessage: rawMessage }
    }
    if (lower.includes('bind message supplies') || lower.includes('there is no parameter $') || lower.includes('wrong number of arguments to function') || lower.includes('bind or column index out of range') || lower.includes('parameter')) {
        return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode: rawCode || databaseErrorCode, databaseErrorMessage: rawMessage }
    }
    if (lower.includes('value too long') || lower.includes('data too long')) {
        return { reason: 'SQL_INVALID_VALUE_FOR_COLUMN', errorType: 'too long', databaseErrorCode: rawCode || databaseErrorCode, databaseErrorMessage: rawMessage }
    }
    if (lower.includes('out of range')) {
        return { reason: 'SQL_INVALID_VALUE_FOR_COLUMN', errorType: 'out of range', databaseErrorCode: rawCode || databaseErrorCode, databaseErrorMessage: rawMessage }
    }
    if (lower.includes('syntax error')) {
        return { reason: 'SQL_SYNTAX_ERROR', databaseErrorCode: rawCode || databaseErrorCode, databaseErrorMessage: rawMessage }
    }
    if (lower.includes('no such table') || lower.includes('does not exist')) {
        return { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode: rawCode || databaseErrorCode, databaseErrorMessage: rawMessage }
    }
    if (lower.includes('already exists')) {
        return { reason: 'SQL_OBJECT_ALREADY_EXISTS', databaseErrorCode: rawCode || databaseErrorCode, databaseErrorMessage: rawMessage }
    }
    if (lower.includes('ambiguous')) {
        return { reason: 'SQL_AMBIGUOUS_IDENTIFIER', identifier: extractQuotedIdentifier(rawMessage), databaseErrorCode: rawCode || databaseErrorCode, databaseErrorMessage: rawMessage }
    }
    if (lower.includes('deadlock')) {
        return { reason: 'SQL_DEADLOCK_DETECTED', databaseErrorCode: rawCode || databaseErrorCode, databaseErrorMessage: rawMessage }
    }
    if (lower.includes('read-only') || lower.includes('read only')) {
        return { reason: 'SQL_READ_ONLY_VIOLATION', databaseErrorCode: rawCode || databaseErrorCode, databaseErrorMessage: rawMessage }
    }
    if (lower.includes('permission denied')) {
        return { reason: 'SQL_PERMISSION_DENIED', databaseErrorCode: rawCode || databaseErrorCode, databaseErrorMessage: rawMessage }
    }
    if (lower.includes('access denied')) {
        return { reason: 'SQL_AUTHORIZATION_ERROR', databaseErrorCode: rawCode || databaseErrorCode, databaseErrorMessage: rawMessage }
    }
    if (lower.includes('timeout')) {
        return { reason: 'SQL_TIMEOUT', databaseErrorCode: rawCode || databaseErrorCode, databaseErrorMessage: rawMessage }
    }
    return { reason: 'SQL_UNKNOWN', databaseErrorCode: rawCode || databaseErrorCode, databaseErrorMessage: rawMessage }
}

function getPrismaTransactionApiErrorReason(databaseErrorCode: TsSqlDatabaseErrorCode | undefined, databaseErrorMessage: string | undefined, message: string): TsSqlErrorReason {
    const lower = message.toLowerCase()
    if (lower.includes('expired transaction') || lower.includes('timeout for this transaction') || lower.includes('unable to start a transaction in the given time')) {
        return { reason: 'SQL_TIMEOUT', timeoutType: 'transaction', databaseErrorCode, databaseErrorMessage }
    }
    if (lower.includes('transaction already closed')) {
        return { reason: 'NOT_IN_TRANSACTION', databaseErrorCode, databaseErrorMessage }
    }
    return { reason: 'SQL_UNKNOWN', databaseErrorCode, databaseErrorMessage }
}

function getPrismaKnownRequestDatabaseErrorCode(error: PrismaClientKnownRequestError): TsSqlDatabaseErrorCode | undefined {
    return getPrismaMetaString(error.meta, 'code') || error.code
}

function getPrismaMetaString(meta: Record<string, unknown> | undefined, key: string): string | undefined {
    if (!meta) {
        return undefined
    }
    const value = meta[key]
    return typeof value === 'string' ? value : undefined
}

function getPrismaMetaStringArray(meta: Record<string, unknown> | undefined, key: string): string[] {
    if (!meta) {
        return []
    }
    const value = meta[key]
    if (!Array.isArray(value)) {
        return []
    }
    return value.filter((item): item is string => typeof item === 'string')
}

function extractQuotedIdentifier(message: string | undefined): string {
    if (!message) {
        return ''
    }
    const match = message.match(/["`](.*?)["`]/)
    return match?.[1] || ''
}
