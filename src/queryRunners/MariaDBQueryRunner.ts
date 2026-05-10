import type { BeginTransactionOpts, CommitOpts, DatabaseType, RollbackOpts } from './QueryRunner.js'
import type { Connection } from 'mariadb'
import { DelegatedSetTransactionQueryRunner } from './DelegatedSetTransactionQueryRunner.js'
import { TsSqlError, TsSqlProcessingError, type TsSqlErrorReason } from '../TsSqlError.js'
import { getMySqlMariaDbEngineErrorReason, isMySqlMariaDbEngineError } from './databaseErrorMappers/MySqlMariaDbErrorMapper.js'

type UpsertResult = {
    affectedRows: number
    insertId: number | bigint
}

type SqlError = Error & {
    errno?: number
    code?: string
    sqlState?: string
    sqlMessage?: string
}

export class MariaDBQueryRunner extends DelegatedSetTransactionQueryRunner {
    readonly database: DatabaseType
    readonly connection: Connection

    constructor(connection: Connection, database: 'mariaDB' | 'mySql' = 'mariaDB') {
        super()
        this.connection = connection
        this.database = database
    }

    useDatabase(database: DatabaseType): void {
        if (database !== 'mariaDB' && database !== 'mySql') {
            throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_DATABASE', database }, 'Unsupported database: ' + database + '. MariaDBQueryRunner only supports mariaDB or mySql databases')
        } else {
            // @ts-ignore
            this.database = database
        }
    }

    getNativeRunner(): Connection {
        return this.connection
    }

    getCurrentNativeTransaction(): undefined {
        return undefined
    }

    execute<RESULT>(fn: (connection: unknown, transaction?: unknown) => Promise<RESULT>): Promise<RESULT> {
        return fn(this.connection)
    }

    protected executeQueryReturning(query: string, params: any[]): Promise<any[]> {
        return this.connection.query({ sql: query, bigNumberStrings: true }, params)
    }
    protected executeMutation(query: string, params: any[]): Promise<number> {
        return this.connection.query({ sql: query, bigNumberStrings: true }, params).then((result: UpsertResult) => result.affectedRows)
    }
    executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
        if (this.containsInsertReturningClause(query, params)) {
            return super.executeInsertReturningLastInsertedId(query, params)
        }
        
        return this.connection.query({ sql: query, bigNumberStrings: true }, params).then((result: UpsertResult) => result.insertId)
    }
    doBeginTransaction(_opts: BeginTransactionOpts): Promise<void> {
        return this.connection.beginTransaction()
    }
    doCommit(_opts: CommitOpts): Promise<void> {
        return this.connection.commit()
    }
    doRollback(_opts: RollbackOpts): Promise<void> {
        return this.connection.rollback()
    }
    addParam(params: any[], value: any): string {
        params.push(value)
        return '?'
    }
    getErrorReason(error: unknown): TsSqlErrorReason {
        return MariaDBQueryRunner.getErrorReason(error)
    }
    isSqlError(error: unknown): boolean {
        return MariaDBQueryRunner.isSqlError(error)
    }

    static getErrorReason(error: unknown): TsSqlErrorReason {
        if (error instanceof TsSqlError) {
            return error.errorReason
        }
        if (!isMariaDbError(error)) {
            return { reason: 'UNKNOWN' }
        }
        return getMariaDbErrorReason(error)
    }

    static isSqlError(error: unknown): boolean {
        return error instanceof TsSqlError || isMariaDbError(error)
    }
}

function getMariaDbErrorReason(error: SqlError): TsSqlErrorReason {
    const message = error.sqlMessage || error.message || ''

    return getKnownMariaDbDriverErrorReason(error, message)
        || getMySqlMariaDbEngineErrorReason({
            errno: error.errno,
            code: error.code,
            sqlState: error.sqlState,
            databaseErrorCode: getMariaDbDatabaseErrorCode(error),
            message,
        })
}

function getKnownMariaDbDriverErrorReason(error: SqlError, message = error.sqlMessage || error.message || ''): TsSqlErrorReason | undefined {
    const code = error.code || ''
    const databaseErrorCode = getMariaDbDatabaseErrorCode(error)
    const databaseErrorMessage = message || undefined

    if (code === 'ER_POOL_ALREADY_CLOSED' || message === 'pool is closed' || message === 'pool is already closed' || message === 'Cannot add request to pool, pool is closed') {
        return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'pool error' }
    }
    if (message === 'pool is ending, connection request aborted' || code === 'POOL_CLOSED') {
        return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'pool error' }
    }
    if (code === 'ER_GET_CONNECTION_TIMEOUT' || code === 'ER_CANT_GET_CONNECTION') {
        return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode, databaseErrorMessage, resourceType: 'pool' }
    }
    if (code === 'ECONNREFUSED' || code === 'ECONNRESET' || code === 'EPIPE' || code === 'PROTOCOL_CONNECTION_LOST') {
        return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'connection lost' }
    }
    if (code === 'ER_SOCKET_TIMEOUT' || code === 'PROTOCOL_SEQUENCE_TIMEOUT') {
        return { reason: 'SQL_TIMEOUT', databaseErrorCode, databaseErrorMessage, timeoutType: 'connection' }
    }

    return undefined
}

function isMariaDbError(error: unknown): error is SqlError {
    return !!error && error instanceof Error && (
        isMySqlMariaDbEngineError(error)
        || typeof (error as SqlError).code === 'string'
        || isMariaDbDriverMessage((error as Error).message || '', (error as SqlError).code || '')
    )
}

function isMariaDbDriverMessage(message: string, code: string): boolean {
    return code === 'ER_POOL_ALREADY_CLOSED'
        || message === 'pool is closed'
        || message === 'pool is already closed'
        || message === 'Cannot add request to pool, pool is closed'
        || message === 'pool is ending, connection request aborted'
}

function getMariaDbDatabaseErrorCode(error: SqlError): string | number | undefined {
    return error.errno ?? error.code
}
