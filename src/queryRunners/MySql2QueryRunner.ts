import type { BeginTransactionOpts, CommitOpts, DatabaseType, RollbackOpts } from './QueryRunner.js'
import type { Connection, QueryError, ResultSetHeader, RowDataPacket } from 'mysql2'
import { DelegatedSetTransactionQueryRunner } from './DelegatedSetTransactionQueryRunner.js'
import { TsSqlError, TsSqlProcessingError, type TsSqlErrorReason } from '../TsSqlError.js'
import { getMySqlMariaDbEngineErrorReason, isMySqlMariaDbEngineError } from './databaseErrorMappers/MySqlMariaDbErrorMapper.js'

export class MySql2QueryRunner extends DelegatedSetTransactionQueryRunner {
    readonly database: DatabaseType
    readonly connection: Connection

    constructor(connection: Connection, database: 'mariaDB' | 'mySql' = 'mySql') {
        super()
        this.connection = connection
        this.database = database
    }

    useDatabase(database: DatabaseType): void {
        if (database !== 'mariaDB' && database !== 'mySql') {
            throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_DATABASE', database }, 'Unsupported database: ' + database + '. MySql2QueryRunner only supports mySql or mariaDB databases')
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
        return new Promise((resolve, reject) => {
            this.connection.query(query, params, (error: QueryError | null, results: RowDataPacket[]) => {
                if (error) {
                    reject(error)
                } else {
                    resolve(results)
                }
            })
        })
    }
    protected executeMutation(query: string, params: any[]): Promise<number> {
        return new Promise((resolve, reject) => {
            this.connection.query(query, params, (error: QueryError | null, results: ResultSetHeader) => {
                if (error) {
                    reject(error)
                } else {
                    resolve(results.affectedRows)
                }
            })
        })
    }
    executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
        if (this.containsInsertReturningClause(query, params)) {
            return super.executeInsertReturningLastInsertedId(query, params)
        }
        
        return new Promise((resolve, reject) => {
            this.connection.query(query, params, (error: QueryError | null, results: ResultSetHeader) => {
                if (error) {
                    reject(error)
                } else {
                    resolve(results.insertId)
                }
            })
        })
    }
    doBeginTransaction(_opts: BeginTransactionOpts): Promise<void> {
        return new Promise((resolve, reject) => {
            this.connection.beginTransaction((error: QueryError | null) => {
                if (error) {
                    reject(error)
                } else {
                    resolve(undefined)
                }
            })
        })
    }
    doCommit(_opts: CommitOpts): Promise<void> {
        return new Promise((resolve, reject) => {
            this.connection.commit((error: QueryError | null) => {
                if (error) {
                    reject(error)
                } else {
                    resolve(undefined)
                }
            })
        })
    }
    doRollback(_opts: RollbackOpts): Promise<void> {
        return new Promise((resolve, reject) => {
            this.connection.rollback((error: QueryError | null) => {
                if (error) {
                    reject(error)
                } else {
                    resolve(undefined)
                }
            })
        })
    }
    addParam(params: any[], value: any): string {
        params.push(value)
        return '?'
    }
    getErrorReason(error: unknown): TsSqlErrorReason {
        return MySql2QueryRunner.getErrorReason(error)
    }
    isSqlError(error: unknown): boolean {
        return MySql2QueryRunner.isSqlError(error)
    }

    static getErrorReason(error: unknown): TsSqlErrorReason {
        if (error instanceof TsSqlError) {
            return error.errorReason
        }
        if (!isMySql2Error(error)) {
            return { reason: 'UNKNOWN' }
        }
        return getMySql2ErrorReason(error)
    }

    static isSqlError(error: unknown): boolean {
        return error instanceof TsSqlError || isMySql2Error(error)
    }
}

function getMySql2ErrorReason(error: QueryError): TsSqlErrorReason {
    const message = error.message || ''

    return getKnownMySql2DriverErrorReason(error, message)
        || getMySqlMariaDbEngineErrorReason({
            errno: error.errno,
            code: error.code,
            sqlState: error.sqlState,
            databaseErrorCode: getMySql2DatabaseErrorCode(error),
            message,
        })
}

function getKnownMySql2DriverErrorReason(error: QueryError, message = error.message || ''): TsSqlErrorReason | undefined {
    const code = error.code || ''
    const databaseErrorCode = getMySql2DatabaseErrorCode(error)
    const databaseErrorMessage = message || undefined

    if (message === 'Pool is closed.' || code === 'POOL_CLOSED') {
        return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'pool error' }
    }
    if (message === 'No connections available.' || message === 'Queue limit reached.' || code === 'POOL_ENQUEUELIMIT') {
        return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode, databaseErrorMessage, resourceType: 'pool' }
    }
    if (message === "Can't add new command when connection is in closed state" || message === "Can't write in closed state") {
        return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'connection lost' }
    }
    if (code === 'ECONNREFUSED' || code === 'ECONNRESET' || code === 'EPIPE' || code === 'PROTOCOL_CONNECTION_LOST') {
        return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'connection lost' }
    }
    if (code === 'ETIMEDOUT' || code === 'PROTOCOL_SEQUENCE_TIMEOUT') {
        return { reason: 'SQL_TIMEOUT', databaseErrorCode, databaseErrorMessage, timeoutType: 'connection' }
    }
    if (isMySql2InvalidParameterMessage(message)) {
        return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode, databaseErrorMessage }
    }

    return undefined
}

function isMySql2Error(error: unknown): error is QueryError {
    return !!error && error instanceof Error && (
        isMySqlMariaDbEngineError(error)
        || typeof (error as QueryError).code === 'string'
        || isMySql2DriverMessage((error as Error).message || '')
        || isMySql2InvalidParameterMessage((error as Error).message || '')
    )
}

function isMySql2InvalidParameterMessage(message: string): boolean {
    return message === 'Bind parameters must be array if namedPlaceholders parameter is not enabled'
        || message === 'Bind parameters must not contain undefined'
        || message === 'Bind parameters must not contain undefined. To pass SQL NULL specify JS null'
        || message === 'Bind parameters must not contain function(s). To pass the body of a function as a string call .toString() first'
}

function isMySql2DriverMessage(message: string): boolean {
    return message === 'Pool is closed.'
        || message === 'No connections available.'
        || message === 'Queue limit reached.'
        || message === "Can't add new command when connection is in closed state"
        || message === "Can't write in closed state"
}

function getMySql2DatabaseErrorCode(error: QueryError): string | number | undefined {
    return error.errno ?? error.code
}
