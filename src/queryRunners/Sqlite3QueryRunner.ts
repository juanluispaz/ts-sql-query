import type { DatabaseType } from './QueryRunner.js'
import type { Database } from 'sqlite3'
import { SqlTransactionQueryRunner } from './SqlTransactionQueryRunner.js'
import { TsSqlError, TsSqlProcessingError, type TsSqlDatabaseErrorCode, type TsSqlErrorReason } from '../TsSqlError.js'
import { getSqliteEngineErrorReason, getSqliteErrorCodeName } from './databaseErrorMappers/SqliteErrorMapper.js'

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
    executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
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
    executeInsertReturningMultipleLastInsertedId(query: string, params: any[] = []): Promise<any> {
        if (this.containsInsertReturningClause(query, params)) {
            return super.executeInsertReturningMultipleLastInsertedId(query, params)
        }
        throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_QUERY' }, "Unsupported executeInsertReturningMultipleLastInsertedId on queries thar doesn't include the returning clause")
    }
    addParam(params: any[], value: any): string {
        params.push(value)
        return '?'
    }
    getErrorReason(error: unknown): TsSqlErrorReason {
        return Sqlite3QueryRunner.getErrorReason(error)
    }
    isSqlError(error: unknown): boolean {
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
    errno?: number
    code?: string
}

function getSqlite3ErrorReason(error: Sqlite3Error): TsSqlErrorReason {
    const databaseErrorCode = getSqlite3DatabaseErrorCode(error)
    const databaseErrorMessage = error.message || undefined
    const message = error.message || ''
    const upper = message.toUpperCase()

    if (upper.includes('DATABASE IS NOT OPEN') || upper.includes('DATABASE IS CLOSING')) {
        return { reason: 'SQL_CONNECTION_ERROR', errorType: 'connection lost', databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('DATA TYPE IS NOT SUPPORTED')) {
        return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode, databaseErrorMessage }
    }

    return getSqliteEngineErrorReason({ code: getSqlite3ErrorCode(error), databaseErrorCode, message })
}

function getSqlite3DatabaseErrorCode(error: Sqlite3Error): TsSqlDatabaseErrorCode | undefined {
    if (error.code) {
        return error.code
    }
    if (typeof error.errno === 'number') {
        return getSqliteErrorCodeName(error.errno) || error.errno
    }
    return undefined
}

function getSqlite3ErrorCode(error: Sqlite3Error): string | undefined {
    if (error.code) {
        return error.code
    }
    if (typeof error.errno === 'number') {
        return getSqliteErrorCodeName(error.errno)
    }
    return undefined
}

function isSqlite3Error(error: unknown): error is Sqlite3Error {
    return !!error && error instanceof Error && (
        typeof (error as Sqlite3Error).code === 'string'
        || typeof (error as Sqlite3Error).errno === 'number'
        || isSqlite3DriverMessage(error.message || '')
    )
}

function isSqlite3DriverMessage(message: string): boolean {
    const upper = message.toUpperCase()
    return upper.includes('DATABASE IS NOT OPEN')
        || upper.includes('DATABASE IS CLOSING')
        || upper.includes('DATA TYPE IS NOT SUPPORTED')
}
