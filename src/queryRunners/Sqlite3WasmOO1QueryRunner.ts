import type { DatabaseType, PromiseProvider } from './QueryRunner.js'
import type { Database, SQLite3Error } from '@sqlite.org/sqlite-wasm'
import { SqlTransactionQueryRunner } from './SqlTransactionQueryRunner.js'
import { TsSqlError, TsSqlProcessingError, type TsSqlDatabaseErrorCode, type TsSqlDatabaseErrorNumber, type TsSqlErrorReason } from '../TsSqlError.js'
import { getSqliteEngineErrorReason, getSqliteErrorCodeName } from './databaseErrorMappers/SqliteErrorMapper.js'

export interface Sqlite3WasmOO1QueryRunnerConfig {
    promise?: PromiseProvider
}

export class Sqlite3WasmOO1QueryRunner extends SqlTransactionQueryRunner {
    readonly database: DatabaseType
    readonly connection: Database
    readonly promise: PromiseProvider

    constructor(connection: Database, config?: Sqlite3WasmOO1QueryRunnerConfig) {
        super()
        this.connection = connection
        this.database = 'sqlite'
        this.promise = config?.promise || Promise
    }

    useDatabase(database: DatabaseType): void {
        if (database !== 'sqlite') {
            throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_DATABASE', database }, 'Unsupported database: ' + database + '. Sqlite3WasmOO1QueryRunner only supports sqlite databases')
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
            const rows = this.connection.selectObjects(query, params)
            return this.promise.resolve(rows)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    protected executeMutation(query: string, params: any[]): Promise<number> {
        try {
            this.connection.exec({sql: query, bind: params})
            return this.promise.resolve(this.connection.changes())
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
        if (this.containsInsertReturningClause(query, params)) {
            return super.executeInsertReturningLastInsertedId(query, params)
        }

        try {
            this.connection.exec({sql: query, bind: params})
            const id = this.connection.selectValue('select last_insert_rowid()')
            return this.promise.resolve(id)
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
        return Sqlite3WasmOO1QueryRunner.getErrorReason(error)
    }
    isSqlError(error: unknown): boolean {
        return Sqlite3WasmOO1QueryRunner.isSqlError(error)
    }

    static getErrorReason(error: unknown): TsSqlErrorReason {
        if (error instanceof TsSqlError) {
            return error.errorReason
        }
        if (!isSqlite3WasmError(error)) {
            return { reason: 'UNKNOWN' }
        }
        return getSqlite3WasmErrorReason(error)
    }

    static isSqlError(error: unknown): boolean {
        return error instanceof TsSqlError || isSqlite3WasmError(error)
    }
}

type Sqlite3WasmDbError = SQLite3Error & Error & {
    resultCode: number
}

function getSqlite3WasmErrorReason(error: Sqlite3WasmDbError): TsSqlErrorReason {
    const databaseErrorCode = getSqlite3WasmDatabaseErrorCode(error)
    const databaseErrorNumber = getSqlite3WasmDatabaseErrorNumber(error)
    const databaseErrorMessage = error.message || undefined
    const message = normalizeSqlite3WasmErrorMessage(error.message || '')
    const upper = message.toUpperCase()

    if (upper.includes('OPERATION IS ILLEGAL WHEN STATEMENT IS LOCKED')) {
        return { reason: 'FORBIDDEN_CONCURRENT_USAGE', databaseErrorCode, databaseErrorNumber, databaseErrorMessage }
    }
    if (upper.includes('DB HAS BEEN CLOSED.') || upper.includes('STMT HAS BEEN CLOSED.')) {
        return { reason: 'SQL_CONNECTION_ERROR', errorType: 'connection lost', databaseErrorCode, databaseErrorNumber, databaseErrorMessage }
    }
    if (upper.includes('INVALID BIND() PARAMETER NAME:')) {
        return getSqliteEngineErrorReason({ databaseErrorCode, databaseErrorNumber, message })
    }
    if (upper.includes('THIS STATEMENT HAS NO BINDABLE PARAMETERS.')) {
        return getSqliteEngineErrorReason({ databaseErrorCode, databaseErrorNumber, message })
    }
    if (upper.includes('INVALID BIND() ARGUMENTS.')) {
        return getSqliteEngineErrorReason({ databaseErrorCode, databaseErrorNumber, message })
    }
    if (upper.includes('UNSUPPORTED BIND() ARGUMENT TYPE:')) {
        return getSqliteEngineErrorReason({ databaseErrorCode, databaseErrorNumber, message })
    }
    if (upper.includes('BIND INDEX') && upper.includes('IS OUT OF RANGE.')) {
        return getSqliteEngineErrorReason({ databaseErrorCode, databaseErrorNumber, message })
    }
    if (upper.includes('WHEN BINDING AN ARRAY, AN INDEX ARGUMENT IS NOT PERMITTED.')) {
        return getSqliteEngineErrorReason({ databaseErrorCode, databaseErrorNumber, message })
    }
    if (upper.includes('WHEN BINDING AN OBJECT, AN INDEX ARGUMENT IS NOT PERMITTED.')) {
        return getSqliteEngineErrorReason({ databaseErrorCode, databaseErrorNumber, message })
    }
    if (upper.includes('BIGINT VALUE IS TOO BIG TO STORE WITHOUT PRECISION LOSS:')) {
        return { reason: 'SQL_INVALID_VALUE', errorType: 'out of range', databaseErrorCode, databaseErrorNumber, databaseErrorMessage }
    }
    if (upper.includes('INTEGER IS OUT OF RANGE FOR JS INTEGER RANGE:')) {
        return { reason: 'SQL_INVALID_VALUE', errorType: 'out of range', databaseErrorCode, databaseErrorNumber, databaseErrorMessage }
    }
    if (upper.includes('EXEC() REQUIRES AN SQL STRING.') || upper.includes('CANNOT PREPARE EMPTY SQL.')) {
        return { reason: 'SQL_INTERNAL_ERROR', errorType: 'api misuse', databaseErrorCode, databaseErrorNumber, databaseErrorMessage }
    }

    return withOriginalSqlite3WasmErrorMessage(
        getSqliteEngineErrorReason({ code: getSqlite3WasmErrorCode(error), databaseErrorCode, databaseErrorNumber, message }),
        databaseErrorMessage
    )
}

function normalizeSqlite3WasmErrorMessage(message: string): string {
    return message
        .replace(/^SQLITE_[A-Z0-9_]+:\s*sqlite3 result code\s+-?\d+:\s*/i, '')
        .replace(/^SQLITE_[A-Z0-9_]+:\s*/i, '')
}

function withOriginalSqlite3WasmErrorMessage(errorReason: TsSqlErrorReason, databaseErrorMessage: string | undefined): TsSqlErrorReason {
    if (!databaseErrorMessage) {
        return errorReason
    }
    return { ...errorReason, databaseErrorMessage } as TsSqlErrorReason
}

function isSqlite3WasmError(error: unknown): error is Sqlite3WasmDbError {
    return !!error && error instanceof Error && (
        (error as Sqlite3WasmDbError).name === 'SQLite3Error'
        || typeof (error as Sqlite3WasmDbError).resultCode === 'number'
    )
}

function getPrimaryResultCode(resultCode: number): number {
    return resultCode & 0xff
}

function getSqlite3WasmErrorCode(error: Sqlite3WasmDbError): string | undefined {
    return getSqliteErrorCodeName(error.resultCode) || getSqliteErrorCodeName(getPrimaryResultCode(error.resultCode))
}

function getSqlite3WasmDatabaseErrorCode(error: Sqlite3WasmDbError): TsSqlDatabaseErrorCode | undefined {
    return getSqlite3WasmErrorCode(error)
}

function getSqlite3WasmDatabaseErrorNumber(error: Sqlite3WasmDbError): TsSqlDatabaseErrorNumber | undefined {
    return typeof error.resultCode === 'number' ? error.resultCode : undefined
}
