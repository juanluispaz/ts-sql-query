import type { DatabaseType } from './QueryRunner.js'
import type { Database } from 'sqlite3'
import { SqlTransactionQueryRunner } from './SqlTransactionQueryRunner.js'
import { TsSqlError, TsSqlProcessingError, type TsSqlDatabaseErrorCode, type TsSqlDatabaseErrorNumber, type TsSqlErrorReason } from '../TsSqlError.js'
import { getSqliteEngineErrorReason, getSqliteErrorCodeName, getSqliteErrorCodeNumber } from './databaseErrorMappers/SqliteErrorMapper.js'

export class Sqlite3QueryRunner extends SqlTransactionQueryRunner {
    readonly database: DatabaseType
    readonly connection: Database

    constructor(connection: Database) {
        super()
        this.connection = connection
        this.database = 'sqlite'
    }

    useDatabase(database: DatabaseType): void {
        if (database !== 'sqlite') {
            throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_DATABASE', database }, 'Unsupported database: ' + database + '. Sqlite3QueryRunner only supports sqlite databases')
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
        return new Promise((resolve, reject) => {
            this.connection.all(query, params, function (error, rows) {
                if (error) {
                    reject(error)
                } else {
                    resolve(rows)
                }
            })
        })
    }
    protected executeMutation(query: string, params: any[]): Promise<number> {
        return new Promise((resolve, reject) => {
            this.connection.run(query, params, function (error) {
                if (error) {
                    reject(error)
                } else {
                    resolve(this.changes)
                }
            })
        })
    }
    override executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
        if (this.containsInsertReturningClause(query, params)) {
            return super.executeInsertReturningLastInsertedId(query, params)
        }

        return new Promise((resolve, reject) => {
            this.connection.run(query, params, function (error) {
                if (error) {
                    reject(error)
                } else {
                    resolve(this.lastID)
                }
            })
        })
    }
    override executeInsertReturningMultipleLastInsertedId(query: string, params: any[] = []): Promise<any> {
        if (this.containsInsertReturningClause(query, params)) {
            return super.executeInsertReturningMultipleLastInsertedId(query, params)
        }
        throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_QUERY' }, "Unsupported executeInsertReturningMultipleLastInsertedId on queries thar doesn't include the returning clause")
    }
    addParam(params: any[], value: any): string {
        params.push(value)
        return '?'
    }
    override getErrorReason(error: unknown): TsSqlErrorReason {
        return Sqlite3QueryRunner.getErrorReason(error)
    }
    override isSqlError(error: unknown): boolean {
        return Sqlite3QueryRunner.isSqlError(error)
    }

    static getErrorReason(error: unknown): TsSqlErrorReason {
        if (error instanceof TsSqlError) {
            return error.errorReason
        }
        if (!isSqlite3Error(error)) {
            return { reason: 'UNKNOWN' }
        }
        return getSqlite3ErrorReason(error)
    }

    static isSqlError(error: unknown): boolean {
        return error instanceof TsSqlError || isSqlite3Error(error)
    }
}

type Sqlite3Error = Error & {
    errno?: number | undefined
    code?: string | undefined
}

function getSqlite3ErrorReason(error: Sqlite3Error): TsSqlErrorReason {
    const databaseErrorCode = getSqlite3DatabaseErrorCode(error)
    const databaseErrorNumber = getSqlite3DatabaseErrorNumber(error)
    const databaseErrorMessage = error.message || undefined
    const message = error.message || ''
    const upper = message.toUpperCase()

    if (upper.includes('DATABASE IS NOT OPEN')
            || upper.includes('DATABASE IS CLOSING')
            || upper.includes('DATABASE IS CLOSED')
            || upper.includes('DATABASE HANDLE IS CLOSED')) {
        return { reason: 'SQL_CONNECTION_ERROR', errorType: 'connection lost', databaseErrorCode, databaseErrorNumber, databaseErrorMessage }
    }
    if (upper.includes('DATA TYPE IS NOT SUPPORTED')) {
        return { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid type', databaseErrorCode, databaseErrorNumber, databaseErrorMessage }
    }
    if (upper.includes('STATEMENT IS ALREADY FINALIZED')) {
        return { reason: 'SQL_INTERNAL_ERROR', errorType: 'api misuse', databaseErrorCode, databaseErrorNumber, databaseErrorMessage }
    }
    if (upper.includes('SQL QUERY EXPECTED') || upper.includes('CALLBACK EXPECTED')) {
        return { reason: 'SQL_INTERNAL_ERROR', errorType: 'api misuse', databaseErrorCode, databaseErrorNumber, databaseErrorMessage }
    }

    return getSqliteEngineErrorReason({ code: getSqlite3ErrorCode(error), databaseErrorCode, databaseErrorNumber, message })
}

function getSqlite3DatabaseErrorCode(error: Sqlite3Error): TsSqlDatabaseErrorCode | undefined {
    const code = getSqlite3ErrorCode(error)
    if (code) {
        return code
    }
    if (typeof error.errno === 'number') {
        return getSqliteErrorCodeName(error.errno)
    }
    return undefined
}

function getSqlite3DatabaseErrorNumber(error: Sqlite3Error): TsSqlDatabaseErrorNumber | undefined {
    if (typeof error.errno === 'number') {
        return error.errno
    }
    return getSqliteErrorCodeNumber(getSqlite3ErrorCode(error))
}

function getSqlite3ErrorCode(error: Sqlite3Error): string | undefined {
    if (error.code && error.code !== 'UNKNOWN') {
        return error.code
    }
    if (typeof error.errno === 'number') {
        return getSqliteErrorCodeName(error.errno)
    }
    return undefined
}

function isSqlite3Error(error: unknown): error is Sqlite3Error {
    return !!error && error instanceof Error && (
        isSqlite3CodedError(error)
        || isSqlite3DriverMessage(error.message || '')
    )
}

function isSqlite3CodedError(error: unknown): error is Sqlite3Error {
    const sqliteError = error as Sqlite3Error
    if (typeof sqliteError.code === 'string') {
        return sqliteError.code.startsWith('SQLITE_')
            || (sqliteError.code === 'UNKNOWN' && typeof sqliteError.errno === 'number')
    }
    return typeof sqliteError.errno === 'number' && !!getSqliteErrorCodeName(sqliteError.errno)
}

function isSqlite3DriverMessage(message: string): boolean {
    const upper = message.toUpperCase()
    return upper.includes('DATABASE IS NOT OPEN')
        || upper.includes('DATABASE IS CLOSING')
        || upper.includes('DATABASE IS CLOSED')
        || upper.includes('DATABASE HANDLE IS CLOSED')
        || upper.includes('DATA TYPE IS NOT SUPPORTED')
        || upper.includes('STATEMENT IS ALREADY FINALIZED')
        || upper.includes('SQL QUERY EXPECTED')
        || upper.includes('CALLBACK EXPECTED')
}
