import type { BeginTransactionOpts, CommitOpts, DatabaseType, RollbackOpts } from './QueryRunner.js'
import type { Connection, QueryError, ResultSetHeader, RowDataPacket } from 'mysql2'
import { DelegatedSetTransactionQueryRunner } from './DelegatedSetTransactionQueryRunner.js'
import { TsSqlError, TsSqlProcessingError, type TsSqlDatabaseErrorNumber, type TsSqlErrorReason } from '../TsSqlError.js'
import { getMySqlMariaDbEngineErrorReason, getMySqlMariaDbErrorCodeName, getMySqlMariaDbErrorNumberFromCode, isMySqlMariaDbEngineErrorCode } from './databaseErrorMappers/MySqlMariaDbErrorMapper.js'

type MySql2DriverError = Error & {
    errno?: number | undefined
    code?: string | number | undefined
    sqlState?: string | undefined
    sqlMessage?: string | undefined
    syscall?: string | undefined
}

const MYSQL2_NETWORK_ERROR_CODES = new Set([
    'ECONNREFUSED',
    'ECONNRESET',
    'EPIPE',
    'ENOTFOUND',
    'EAI_AGAIN',
    'EHOSTUNREACH',
    'ENETUNREACH',
    'ECONNABORTED',
])

const MYSQL2_TIMEOUT_ERROR_CODES = new Set([
    'ETIMEDOUT',
    'ESOCKETTIMEDOUT',
])

const MYSQL2_DRIVER_ERROR_CODES = new Set([
    'PROTOCOL_CONNECTION_LOST',
    'PROTOCOL_ERROR',
    'PROTOCOL_UNEXPECTED_PACKET',
    'PROTOCOL_SEQUENCE_TIMEOUT',
    'HANDSHAKE_NO_SSL_SUPPORT',
    'HANDSHAKE_SSL_ERROR',
    'HANDSHAKE_UNKNOWN_ERROR',
    'AUTH_SWITCH_PLUGIN_ERROR',
    'MYSQL_CLEAR_PASSWORD_NOT_ENABLED',
    'POOL_NOEXIST',
    'POOL_NONEONLINE',
])

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
    override executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
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
    override getErrorReason(error: unknown): TsSqlErrorReason {
        return MySql2QueryRunner.getErrorReason(error, this.database)
    }
    override isSqlError(error: unknown): boolean {
        return MySql2QueryRunner.isSqlError(error)
    }

    static getErrorReason(error: unknown, database?: DatabaseType): TsSqlErrorReason {
        if (error instanceof TsSqlError) {
            return error.errorReason
        }
        if (!isMySql2Error(error)) {
            return { reason: 'UNKNOWN' }
        }
        return getMySql2ErrorReason(error, database)
    }

    static isSqlError(error: unknown): boolean {
        return error instanceof TsSqlError || isMySql2Error(error)
    }
}

function getMySql2ErrorReason(error: MySql2DriverError, database?: DatabaseType): TsSqlErrorReason {
    const message = getMySql2ErrorMessage(error)

    const reason = getKnownMySql2DriverErrorReason(error, message, database)
        || (isMySql2EngineError(error) ? getMySqlMariaDbEngineErrorReason({
            database,
            errno: getMySql2ErrorNumber(error),
            code: getMySql2EngineErrorCode(error),
            sqlState: getMySql2SqlState(error),
            databaseErrorCode: getMySql2DatabaseErrorCode(error, database),
            databaseErrorNumber: getMySql2DatabaseErrorNumber(error, database),
            message,
        }) : { reason: 'UNKNOWN' })

    return withDatabaseErrorNumber(reason, getMySql2DatabaseErrorNumber(error, database))
}

function getKnownMySql2DriverErrorReason(error: MySql2DriverError, message = getMySql2ErrorMessage(error), database?: DatabaseType): TsSqlErrorReason | undefined {
    const code = getMySql2StringCode(error)
    const databaseErrorCode = getMySql2DatabaseErrorCode(error, database)
    const databaseErrorMessage = message || undefined

    if (message === 'Pool is closed.') {
        return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'pool error' }
    }
    if (message === 'No connections available.' || message === 'Queue limit reached.') {
        return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode, databaseErrorMessage, resourceType: 'pool' }
    }
    if (code === 'POOL_NOEXIST' || code === 'POOL_NONEONLINE') {
        return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'pool error' }
    }
    if (message === "Can't add new command when connection is in closed state" || message === "Can't write in closed state") {
        return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'connection lost' }
    }
    if (code === 'PROTOCOL_CONNECTION_LOST' || isMySql2NetworkErrorCode(code)) {
        return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'connection lost' }
    }
    if (isMySql2TimeoutErrorCode(code)) {
        return { reason: 'SQL_TIMEOUT', databaseErrorCode, databaseErrorMessage, timeoutType: 'connection' }
    }
    if (code === 'PROTOCOL_SEQUENCE_TIMEOUT') {
        return { reason: 'SQL_TIMEOUT', databaseErrorCode, databaseErrorMessage, timeoutType: 'statement' }
    }
    if (code === 'HANDSHAKE_NO_SSL_SUPPORT' || code === 'HANDSHAKE_SSL_ERROR' || isMySql2InvalidConnectionConfigurationMessage(message)) {
        return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'invalid connection configuration' }
    }
    if (code === 'AUTH_SWITCH_PLUGIN_ERROR' || code === 'MYSQL_CLEAR_PASSWORD_NOT_ENABLED' || isMySql2AuthenticationMessage(message)) {
        return { reason: 'SQL_AUTHENTICATION_ERROR', databaseErrorCode, databaseErrorMessage }
    }
    if (code === 'PROTOCOL_ERROR' || code === 'PROTOCOL_UNEXPECTED_PACKET' || code === 'HANDSHAKE_UNKNOWN_ERROR' || isMySql2ProtocolMessage(message)) {
        return { reason: 'SQL_INTERNAL_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'api misuse' }
    }
    if (isMySql2PromiseOrApiMisuseMessage(message)) {
        return { reason: 'SQL_INTERNAL_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'api misuse' }
    }
    if (isMySql2PrivateObjectPropertyMessage(message)) {
        return { reason: 'SQL_INVALID_SQL_STATEMENT', databaseErrorCode, databaseErrorMessage, statementErrorType: 'invalid identifier' }
    }
    if (isMySql2InvalidParameterMessage(message)) {
        return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode, databaseErrorMessage, ...getMySql2InvalidParameterDetails(message) }
    }

    return undefined
}

function isMySql2Error(error: unknown): error is MySql2DriverError {
    return !!error && error instanceof Error && (
        isMySql2EngineError(error)
        || isMySql2KnownDriverError(error)
        || isMySql2DriverMessage(getMySql2ErrorMessage(error))
    )
}

function isMySql2EngineError(error: MySql2DriverError): boolean {
    return getMySql2ErrorNumber(error) !== undefined
        || getMySql2SqlState(error) !== undefined
        || getMySql2EngineErrorCode(error) !== undefined
}

function isMySql2KnownDriverError(error: MySql2DriverError): boolean {
    const code = getMySql2StringCode(error)
    return isMySql2KnownDriverCode(code)
}

function isMySql2KnownDriverCode(code: string | undefined): boolean {
    return !!code && (
        MYSQL2_DRIVER_ERROR_CODES.has(code)
        || isMySql2NetworkErrorCode(code)
        || isMySql2TimeoutErrorCode(code)
    )
}

function isMySql2NetworkErrorCode(code: string | undefined): boolean {
    return !!code && MYSQL2_NETWORK_ERROR_CODES.has(code)
}

function isMySql2TimeoutErrorCode(code: string | undefined): boolean {
    return !!code && MYSQL2_TIMEOUT_ERROR_CODES.has(code)
}

function getMySql2ErrorMessage(error: MySql2DriverError): string {
    return error.sqlMessage || error.message || ''
}

function isMySql2InvalidParameterMessage(message: string): boolean {
    return message === 'Bind parameters must be array if namedPlaceholders parameter is not enabled'
        || message === 'Bind parameters must not contain undefined'
        || message === 'Bind parameters must not contain undefined. To pass SQL NULL specify JS null'
        || message === 'Bind parameters must not contain function(s). To pass the body of a function as a string call .toString() first'
}

function getMySql2InvalidParameterDetails(message: string): {
    parameterErrorType?: 'invalid value' | 'invalid binding' | undefined
} {
    if (message === 'Bind parameters must be array if namedPlaceholders parameter is not enabled') {
        return { parameterErrorType: 'invalid binding' }
    }
    return { parameterErrorType: 'invalid value' }
}

function isMySql2DriverMessage(message: string): boolean {
    return message === 'Pool is closed.'
        || message === 'No connections available.'
        || message === 'Queue limit reached.'
        || message === "Can't add new command when connection is in closed state"
        || message === "Can't write in closed state"
        || isMySql2InvalidConnectionConfigurationMessage(message)
        || isMySql2AuthenticationMessage(message)
        || isMySql2ProtocolMessage(message)
        || isMySql2PromiseOrApiMisuseMessage(message)
        || isMySql2InvalidParameterMessage(message)
        || isMySql2PrivateObjectPropertyMessage(message)
}

function isMySql2InvalidConnectionConfigurationMessage(message: string): boolean {
    return message === 'Server does not support secure connection'
        || message === '"user" connection config property must be a string'
        || message === '"database" connection config property must be a string'
        || message === 'HandshakeResponse authToken must be a Buffer when provided'
        || message === 'HandshakeResponse authPluginName must be a string when provided'
        || /^SSL profile must be an object, instead it's a .+$/.test(message)
        || /^Unknown charset '[^']+'$/.test(message)
        || /^Unknown SSL profile '[^']+'$/.test(message)
}

function isMySql2AuthenticationMessage(message: string): boolean {
    return message === 'AuthPluginMoreData received but no auth plugin instance found'
        || message.startsWith('Server requested authentication using mysql_clear_password, ')
        || message.startsWith('Server requests authentication using unknown plugin ')
        || /^Unexpected data in AuthMoreData packet received by .+ plugin in .+ state\.$/.test(message)
        || /^Unexpected data in AuthMoreData packet received by .+ plugin in STATE_FINAL state\.$/.test(message)
        || /^Invalid AuthMoreData packet received by .+ plugin in STATE_TOKEN_SENT state\.$/.test(message)
}

function isMySql2ProtocolMessage(message: string): boolean {
    return message === 'Unexpected packet during handshake phase'
        || message === 'Unexpected packet while no commands in the queue'
        || message === 'Expected EOF packet'
        || message === 'Expected EOF packet after parameters'
        || message === 'Expected EOF packet after fields'
        || /^Should not reach here: .+$/.test(message)
}

function isMySql2PromiseOrApiMisuseMessage(message: string): boolean {
    return message === 'Callback function is not available with promise clients.'
        || message.startsWith('no Promise implementation available.')
        || message.startsWith('You have tried to call .then(), .catch(), or invoked await on the result of query that is not a promise, which is a programming error.')
}

function isMySql2PrivateObjectPropertyMessage(message: string): boolean {
    return /^The field name \(.+\) can't be the same as an object's private property\.$/.test(message)
}

function getMySql2StringCode(error: MySql2DriverError): string | undefined {
    return typeof error.code === 'string' ? error.code : undefined
}

function getMySql2EngineErrorCode(error: MySql2DriverError): string | undefined {
    const code = getMySql2StringCode(error)
    return code && isMySqlMariaDbEngineErrorCode(code) ? code : undefined
}

function getMySql2SqlState(error: MySql2DriverError): string | undefined {
    const sqlState = error.sqlState
    return typeof sqlState === 'string' && /^[0-9A-Z]{5}$/i.test(sqlState) ? sqlState : undefined
}

function getMySql2ErrorNumber(error: MySql2DriverError): number | undefined {
    if (typeof error.errno === 'number' && error.errno > 0) {
        return error.errno
    }
    if (typeof error.code === 'number' && error.code > 0) {
        return error.code
    }
    if (typeof error.code === 'string' && /^\d+$/.test(error.code)) {
        const codeNumber = Number(error.code)
        return codeNumber > 0 ? codeNumber : undefined
    }
    return undefined
}

function getMySql2DatabaseErrorCode(error: MySql2DriverError, database?: DatabaseType): string | undefined {
    const code = getMySql2StringCode(error)
    if (code && (isMySqlMariaDbEngineErrorCode(code) || isMySql2KnownDriverCode(code))) {
        return getMySqlMariaDbErrorCodeName(getMySqlMariaDbErrorNumberFromCode(code, database), database) ?? code
    }

    const errorNumber = getMySql2ErrorNumber(error)
    return getMySqlMariaDbErrorCodeName(errorNumber, database)
}

function getMySql2DatabaseErrorNumber(error: MySql2DriverError, database?: DatabaseType): TsSqlDatabaseErrorNumber | undefined {
    const code = getMySql2StringCode(error)
    return getMySql2ErrorNumber(error) ?? getMySqlMariaDbErrorNumberFromCode(code, database) ?? getMySql2SqlState(error)
}

function withDatabaseErrorNumber(reason: TsSqlErrorReason, databaseErrorNumber: TsSqlDatabaseErrorNumber | undefined): TsSqlErrorReason {
    if (databaseErrorNumber === undefined || reason.reason === 'UNKNOWN') {
        return reason
    }
    return { ...reason, databaseErrorNumber } as TsSqlErrorReason
}
