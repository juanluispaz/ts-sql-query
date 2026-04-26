/// <reference types="bun-types" />

import type { DatabaseType, PromiseProvider } from './QueryRunner.js'
import { type Database, SQLiteError } from 'bun:sqlite'
import { SqlTransactionQueryRunner } from './SqlTransactionQueryRunner.js'
import { TsSqlError, TsSqlProcessingError, type TsSqlDatabaseErrorCode, type TsSqlErrorReason } from "../TsSqlError.js"

export interface BunSqliteQueryRunnerConfig {
    promise?: PromiseProvider
}

export class BunSqliteQueryRunner extends SqlTransactionQueryRunner {
    readonly database: DatabaseType
    readonly connection: Database
    readonly promise: PromiseProvider

    constructor(connection: Database, config?: BunSqliteQueryRunnerConfig) {
        super()
        this.connection = connection
        this.database = 'sqlite'
        this.promise = config?.promise || Promise
    }

    useDatabase(database: DatabaseType): void {
        if (database !== 'sqlite') {
            throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_DATABASE', database }, 'Unsupported database: ' + database + '. BunSqliteQueryRunner only supports sqlite databases')
        }
    }

    getNativeRunner(): Database {
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
            return this.promise.resolve(this.connection.prepare(query).run(...params).changes)
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
        return BunSqliteQueryRunner.getErrorReason(error)
    }
    isSqlError(error: unknown): boolean {
        return BunSqliteQueryRunner.isSqlError(error)
    }

    static getErrorReason(error: unknown): TsSqlErrorReason {
        if (error instanceof TsSqlError) {
            return error.errorReason
        }
        if (!isBunSqliteError(error)) {
            return { reason: 'UNKNOWN' }
        }
        return getBunSqliteErrorReason(error)
    }

    static isSqlError(error: unknown): boolean {
        return error instanceof TsSqlError || isBunSqliteError(error)
    }
}

type BunSqliteSqliteError = InstanceType<typeof SQLiteError>
type BunSqliteDriverError = TypeError
type BunSqliteError = BunSqliteSqliteError | BunSqliteDriverError

function getBunSqliteErrorReason(error: BunSqliteError): TsSqlErrorReason {
    if (error instanceof SQLiteError) {
        return getBunSqliteSqliteErrorReason(error)
    }
    return getBunSqliteDriverErrorReason(error)
}

function getBunSqliteSqliteErrorReason(error: BunSqliteSqliteError): TsSqlErrorReason {
    const databaseErrorCode = getBunSqliteDatabaseErrorCode(error)
    const databaseErrorMessage = error.message || undefined
    const code = error.code || ''
    const message = error.message || ''
    const upper = message.toUpperCase()

    if (code.startsWith('SQLITE_CONSTRAINT')) {
        return getSqliteConstraintReason(message, databaseErrorCode, databaseErrorMessage)
    }
    if (code.startsWith('SQLITE_IOERR')) {
        return { reason: 'SQL_CONNECTION_ERROR', errorType: 'connection lost', databaseErrorCode, databaseErrorMessage }
    }
    if (code.startsWith('SQLITE_CANTOPEN')) {
        return { reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration', databaseErrorCode, databaseErrorMessage }
    }
    if (code.startsWith('SQLITE_READONLY')) {
        return { reason: 'SQL_READ_ONLY_VIOLATION', databaseErrorCode, databaseErrorMessage }
    }
    if (code.startsWith('SQLITE_ABORT')) {
        return { reason: 'SQL_TIMEOUT', timeoutType: 'cancelled', databaseErrorCode, databaseErrorMessage }
    }

    switch (code) {
        case 'SQLITE_CONSTRAINT':
            return getSqliteConstraintReason(message, databaseErrorCode, databaseErrorMessage)
        case 'SQLITE_TOOBIG':
            return { reason: 'SQL_INVALID_VALUE_FOR_COLUMN', errorType: 'too long', columnName: extractColumnPathLastSegment(message), databaseErrorCode, databaseErrorMessage }
        case 'SQLITE_MISMATCH':
            return { reason: 'SQL_INVALID_VALUE_FOR_COLUMN', errorType: 'invalid value', columnName: extractColumnPathLastSegment(message), databaseErrorCode, databaseErrorMessage }
        case 'SQLITE_RANGE':
            return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode, databaseErrorMessage }
        case 'SQLITE_MISUSE':
            if (upper.includes('DATABASE HANDLE IS CLOSED') || upper.includes('DATABASE IS CLOSED')) {
                return { reason: 'SQL_CONNECTION_ERROR', errorType: 'connection lost', databaseErrorCode, databaseErrorMessage }
            }
            break
        case 'SQLITE_BUSY':
        case 'SQLITE_BUSY_RECOVERY':
        case 'SQLITE_BUSY_SNAPSHOT':
            return { reason: 'SQL_TIMEOUT', timeoutType: 'database file busy', databaseErrorCode, databaseErrorMessage }
        case 'SQLITE_LOCKED':
        case 'SQLITE_LOCKED_SHAREDCACHE':
            return { reason: 'SQL_TIMEOUT', timeoutType: 'lock', databaseErrorCode, databaseErrorMessage }
        case 'SQLITE_READONLY':
            return { reason: 'SQL_READ_ONLY_VIOLATION', databaseErrorCode, databaseErrorMessage }
        case 'SQLITE_INTERRUPT':
        case 'SQLITE_ABORT':
            return { reason: 'SQL_TIMEOUT', timeoutType: 'cancelled', databaseErrorCode, databaseErrorMessage }
        case 'SQLITE_NOMEM':
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'memory', databaseErrorCode, databaseErrorMessage }
        case 'SQLITE_FULL':
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'disk', databaseErrorCode, databaseErrorMessage }
        case 'SQLITE_IOERR':
        case 'SQLITE_PROTOCOL':
            return { reason: 'SQL_CONNECTION_ERROR', errorType: 'connection lost', databaseErrorCode, databaseErrorMessage }
        case 'SQLITE_CANTOPEN':
        case 'SQLITE_NOTADB':
            return { reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration', databaseErrorCode, databaseErrorMessage }
        case 'SQLITE_AUTH':
            return { reason: 'SQL_AUTHORIZATION_ERROR', databaseErrorCode, databaseErrorMessage }
        case 'SQLITE_PERM':
            return { reason: 'SQL_PERMISSION_DENIED', databaseErrorCode, databaseErrorMessage }
    }

    if (upper.includes('CANNOT START A TRANSACTION WITHIN A TRANSACTION')) {
        return { reason: 'NESTED_TRANSACTION_NOT_SUPPORTED', databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('CANNOT COMMIT') && upper.includes('NO TRANSACTION IS ACTIVE')) {
        return { reason: 'NOT_IN_TRANSACTION', databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('CANNOT ROLLBACK') && upper.includes('NO TRANSACTION IS ACTIVE')) {
        return { reason: 'NOT_IN_TRANSACTION', databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('SQL STATEMENTS IN PROGRESS')) {
        return { reason: 'FORBIDDEN_CONCURRENT_USAGE', databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('BIND OR COLUMN INDEX OUT OF RANGE')) {
        return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('WRONG NUMBER OF ARGUMENTS TO FUNCTION')) {
        return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('NO SUCH TABLE:')) {
        return { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'table or view', objectName: extractAfterColon(message), databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('NO SUCH COLUMN:')) {
        const columnName = extractAfterColon(message)
        return { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'column', columnName, objectName: columnName, databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('NO SUCH FUNCTION:')) {
        return { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'routine', objectName: extractAfterColon(message), databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('TABLE ') && upper.includes(' ALREADY EXISTS')) {
        return { reason: 'SQL_OBJECT_ALREADY_EXISTS', objectType: 'table or view', objectName: extractObjectAlreadyExistsName(message), databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('VIEW ') && upper.includes(' ALREADY EXISTS')) {
        return { reason: 'SQL_OBJECT_ALREADY_EXISTS', objectType: 'table or view', objectName: extractObjectAlreadyExistsName(message), databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('INDEX ') && upper.includes(' ALREADY EXISTS')) {
        return { reason: 'SQL_OBJECT_ALREADY_EXISTS', objectName: extractObjectAlreadyExistsName(message), databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('AMBIGUOUS COLUMN NAME:')) {
        return { reason: 'SQL_AMBIGUOUS_IDENTIFIER', identifier: extractAfterColon(message), databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('NEAR "') && upper.includes('SYNTAX ERROR')) {
        return { reason: 'SQL_SYNTAX_ERROR', databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('INCOMPLETE INPUT')) {
        return { reason: 'SQL_SYNTAX_ERROR', databaseErrorCode, databaseErrorMessage }
    }

    if (code === 'SQLITE_ERROR') {
            return { reason: 'SQL_UNKNOWN', databaseErrorCode, databaseErrorMessage }
    }
    return { reason: 'SQL_UNKNOWN', databaseErrorCode, databaseErrorMessage }
}

function getBunSqliteDriverErrorReason(error: BunSqliteDriverError): TsSqlErrorReason {
    const message = error.message || ''
    const upper = message.toUpperCase()

    if (upper.includes('CANNOT OPEN DATABASE BECAUSE THE DIRECTORY DOES NOT EXIST')) {
        return { reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration' }
    }
    if (upper.includes('IN-MEMORY/TEMPORARY DATABASES CANNOT BE READONLY')) {
        return { reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration' }
    }
    if (upper.includes('DATABASE CONNECTION IS NOT OPEN')) {
        return { reason: 'SQL_CONNECTION_ERROR', errorType: 'connection lost' }
    }
    if (upper.includes('DATABASE CONNECTION IS BUSY EXECUTING A QUERY') || upper.includes('STATEMENT IS BUSY EXECUTING A QUERY')) {
        return { reason: 'FORBIDDEN_CONCURRENT_USAGE' }
    }
    if (upper.includes('MISSING NAMED PARAMETERS')) {
        return { reason: 'SQL_INVALID_PARAMETER' }
    }
    if (upper.includes('SQLITE3 CAN ONLY BIND NUMBERS, STRINGS, BIGINTS, BUFFERS, AND NULL')) {
        return { reason: 'SQL_INVALID_PARAMETER' }
    }
    if (upper.includes('YOU CANNOT SPECIFY NAMED PARAMETERS IN TWO DIFFERENT OBJECTS')) {
        return { reason: 'SQL_INVALID_PARAMETER' }
    }
    if (upper.includes('NAMED PARAMETERS CAN ONLY BE PASSED WITHIN PLAIN OBJECTS')) {
        return { reason: 'SQL_INVALID_PARAMETER' }
    }
    return { reason: 'SQL_UNKNOWN' }
}

function isBunSqliteError(error: unknown): error is BunSqliteError {
    if (error instanceof SQLiteError) {
        return true
    }
    if (!(error instanceof TypeError)) {
        return false
    }
    const message = (error.message || '').toUpperCase()
    if (message.includes('CANNOT OPEN DATABASE BECAUSE THE DIRECTORY DOES NOT EXIST')) {
        return true
    }
    if (message.includes('IN-MEMORY/TEMPORARY DATABASES CANNOT BE READONLY')) {
        return true
    }
    return message.includes('DATABASE CONNECTION IS NOT OPEN')
        || message.includes('DATABASE CONNECTION IS BUSY EXECUTING A QUERY')
        || message.includes('STATEMENT IS BUSY EXECUTING A QUERY')
        || message.includes('MISSING NAMED PARAMETERS')
        || message.includes('SQLITE3 CAN ONLY BIND NUMBERS, STRINGS, BIGINTS, BUFFERS, AND NULL')
        || message.includes('YOU CANNOT SPECIFY NAMED PARAMETERS IN TWO DIFFERENT OBJECTS')
        || message.includes('NAMED PARAMETERS CAN ONLY BE PASSED WITHIN PLAIN OBJECTS')
}

function getSqliteConstraintReason(message: string, databaseErrorCode: TsSqlDatabaseErrorCode | undefined, databaseErrorMessage?: string): TsSqlErrorReason {
    const upper = message.toUpperCase()
    if (upper.includes('UNIQUE CONSTRAINT FAILED:') || upper.includes('PRIMARY KEY')) {
        return {
            reason: 'SQL_CONSTRAINT_VIOLATED',
            constraintType: 'unique',
            tableName: extractColumnPathTableName(message),
            columnName: extractColumnPathLastSegment(message),
            databaseErrorCode,
            databaseErrorMessage,
        }
    }
    if (upper.includes('NOT NULL CONSTRAINT FAILED:')) {
        return {
            reason: 'SQL_CONSTRAINT_VIOLATED',
            constraintType: 'not null',
            tableName: extractColumnPathTableName(message),
            columnName: extractColumnPathLastSegment(message),
            databaseErrorCode,
            databaseErrorMessage,
        }
    }
    if (upper.includes('FOREIGN KEY CONSTRAINT FAILED')) {
        return { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'foreign key', databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('CHECK CONSTRAINT FAILED')) {
        return {
            reason: 'SQL_CONSTRAINT_VIOLATED',
            constraintType: 'check',
            constraintName: extractAfterColon(message),
            databaseErrorCode,
            databaseErrorMessage,
        }
    }
    return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode, databaseErrorMessage }
}

function getBunSqliteDatabaseErrorCode(error: BunSqliteSqliteError): TsSqlDatabaseErrorCode | undefined {
    return error.code
}

function extractAfterColon(message: string): string | undefined {
    const match = /:\s*(.+)$/.exec(message)
    if (match) {
        return match[1]?.trim()
    }
    return undefined
}

function extractColumnPathLastSegment(message: string): string | undefined {
    const value = extractAfterColon(message)
    if (!value) {
        return undefined
    }
    const first = value.split(',')[0]?.trim()
    if (!first) {
        return undefined
    }
    const dot = first.lastIndexOf('.')
    if (dot >= 0) {
        return first.slice(dot + 1)
    }
    return first
}

function extractColumnPathTableName(message: string): string | undefined {
    const value = extractAfterColon(message)
    if (!value) {
        return undefined
    }
    const first = value.split(',')[0]?.trim()
    if (!first) {
        return undefined
    }
    const dot = first.lastIndexOf('.')
    if (dot > 0) {
        return first.slice(0, dot)
    }
    return undefined
}

function extractObjectAlreadyExistsName(message: string): string | undefined {
    const match = /(?:table|view|index)\s+(.+?)\s+already exists/i.exec(message)
    if (match) {
        return match[1]?.replace(/^["'`[]|["'`\]]$/g, '')
    }
    return undefined
}
