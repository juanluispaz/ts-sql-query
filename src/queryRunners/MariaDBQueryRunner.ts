import type { BeginTransactionOpts, CommitOpts, DatabaseType, RollbackOpts } from './QueryRunner.js'
import type { Connection } from 'mariadb'
import { DelegatedSetTransactionQueryRunner } from './DelegatedSetTransactionQueryRunner.js'
import { TsSqlError, TsSqlProcessingError, type TsSqlDatabaseErrorNumber, type TsSqlErrorReason } from '../TsSqlError.js'
import { getMySqlMariaDbEngineErrorReason, getMySqlMariaDbErrorCodeName, getMySqlMariaDbErrorNumberFromCode, isMySqlMariaDbEngineError } from './databaseErrorMappers/MySqlMariaDbErrorMapper.js'

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

const MARIADB_DRIVER_ERROR_CODE_NUMBERS = new Map<string, number>([
    ['ER_CONNECTION_ALREADY_CLOSED', 45001],
    ['ER_MYSQL_CHANGE_USER_BUG', 45003],
    ['ER_CMD_NOT_EXECUTED_DESTROYED', 45004],
    ['ER_NULL_CHAR_ESCAPEID', 45005],
    ['ER_NULL_ESCAPEID', 45006],
    ['ER_NOT_IMPLEMENTED_FORMAT', 45007],
    ['ER_NODE_NOT_SUPPORTED_TLS', 45008],
    ['ER_SOCKET_UNEXPECTED_CLOSE', 45009],
    ['ER_UNEXPECTED_PACKET', 45011],
    ['ER_CONNECTION_TIMEOUT', 45012],
    ['ER_CMD_CONNECTION_CLOSED', 45013],
    ['ER_CHANGE_USER_BAD_PACKET', 45014],
    ['ER_PING_BAD_PACKET', 45015],
    ['ER_MISSING_PARAMETER', 45016],
    ['ER_PARAMETER_UNDEFINED', 45017],
    ['ER_PLACEHOLDER_UNDEFINED', 45018],
    ['ER_SOCKET', 45019],
    ['ER_EOF_EXPECTED', 45020],
    ['ER_LOCAL_INFILE_DISABLED', 45021],
    ['ER_LOCAL_INFILE_NOT_READABLE', 45022],
    ['ER_SERVER_SSL_DISABLED', 45023],
    ['ER_AUTHENTICATION_BAD_PACKET', 45024],
    ['ER_AUTHENTICATION_PLUGIN_NOT_SUPPORTED', 45025],
    ['ER_SOCKET_TIMEOUT', 45026],
    ['ER_POOL_ALREADY_CLOSED', 45027],
    ['ER_GET_CONNECTION_TIMEOUT', 45028],
    ['ER_SETTING_SESSION_ERROR', 45029],
    ['ER_INITIAL_SQL_ERROR', 45030],
    ['ER_BATCH_WITH_NO_VALUES', 45031],
    ['ER_RESET_BAD_PACKET', 45032],
    ['ER_WRONG_IANA_TIMEZONE', 45033],
    ['ER_LOCAL_INFILE_WRONG_FILENAME', 45034],
    ['ER_ADD_CONNECTION_CLOSED_POOL', 45035],
    ['ER_WRONG_AUTO_TIMEZONE', 45036],
    ['ER_CLOSING_POOL', 45037],
    ['ER_TIMEOUT_NOT_SUPPORTED', 45038],
    ['ER_INITIAL_TIMEOUT_ERROR', 45039],
    ['ER_DUPLICATE_FIELD', 45040],
    ['ER_PING_TIMEOUT', 45042],
    ['ER_BAD_PARAMETER_VALUE', 45043],
    ['ER_CANNOT_RETRIEVE_RSA_KEY', 45044],
    ['ER_MINIMUM_NODE_VERSION_REQUIRED', 45045],
    ['ER_MAX_ALLOWED_PACKET', 45046],
    ['ER_NOT_SUPPORTED_AUTH_PLUGIN', 45047],
    ['ER_COMPRESSION_NOT_SUPPORTED', 45048],
    ['ER_UNDEFINED_SQL', 45049],
    ['ER_PARSING_PRECISION', 45050],
    ['ER_PREPARE_CLOSED', 45051],
    ['ER_MISSING_SQL_PARAMETER', 45052],
    ['ER_MISSING_SQL_FILE', 45053],
    ['ER_SQL_FILE_ERROR', 45054],
    ['ER_MISSING_DATABASE_PARAMETER', 45055],
    ['ER_SELF_SIGNED', 45056],
    ['ER_SELF_SIGNED_NO_PWD', 45057],
    ['ER_PRIVATE_FIELDS_USE', 45058],
    ['ER_TLS_IDENTITY_ERROR', 45059],
    ['ER_POOL_NOT_INITIALIZED', 45060],
    ['ER_POOL_NO_CONNECTION', 45061],
    ['ER_SELF_SIGNED_BAD_PLUGIN', 45062],
    ['ER_SELF_SIGNED_SHA256', 45063],
])

const MARIADB_DRIVER_ERROR_NUMBER_CODES = new Map(Array.from(MARIADB_DRIVER_ERROR_CODE_NUMBERS, ([code, number]) => [number, code]))
const MARIADB_DRIVER_ERROR_NUMBERS = new Set(MARIADB_DRIVER_ERROR_CODE_NUMBERS.values())

const MARIADB_NETWORK_ERROR_CODES = new Set([
    'ECONNREFUSED',
    'ECONNRESET',
    'EPIPE',
    'ENOTFOUND',
    'EAI_AGAIN',
    'EHOSTUNREACH',
    'ENETUNREACH',
    'ECONNABORTED',
])

const MARIADB_TIMEOUT_ERROR_CODES = new Set([
    'ETIMEDOUT',
    'ESOCKETTIMEDOUT',
])

const MARIADB_TLS_CONFIGURATION_ERROR_CODES = new Set([
    'ERR_TLS_CERT_ALTNAME_INVALID',
    'DEPTH_ZERO_SELF_SIGNED_CERT',
    'SELF_SIGNED_CERT_IN_CHAIN',
    'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
    'CERT_HAS_EXPIRED',
])

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

    const reason = getKnownMariaDbDriverErrorReason(error, message)
        || getMySqlMariaDbEngineErrorReason({
            errno: error.errno,
            code: error.code,
            sqlState: error.sqlState,
            databaseErrorCode: getMariaDbDatabaseErrorCode(error),
            databaseErrorNumber: getMariaDbDatabaseErrorNumber(error),
            message,
        })

    return withDatabaseErrorNumber(reason, getMariaDbDatabaseErrorNumber(error))
}

function getKnownMariaDbDriverErrorReason(error: SqlError, message = error.sqlMessage || error.message || ''): TsSqlErrorReason | undefined {
    const code = getMariaDbStringCode(error)
    const driverCode = getMariaDbDriverErrorCode(error)
    const databaseErrorCode = getMariaDbDatabaseErrorCode(error)
    const databaseErrorMessage = message || undefined

    switch (driverCode) {
        case 'ER_POOL_ALREADY_CLOSED':
        case 'ER_ADD_CONNECTION_CLOSED_POOL':
        case 'ER_CLOSING_POOL':
        case 'ER_POOL_NOT_INITIALIZED':
            return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'pool error' }
        case 'ER_POOL_NO_CONNECTION':
            return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'temporarily unavailable' }
        case 'ER_GET_CONNECTION_TIMEOUT':
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode, databaseErrorMessage, resourceType: 'pool' }

        case 'ER_CONNECTION_TIMEOUT':
        case 'ER_SOCKET_TIMEOUT':
        case 'ER_PING_TIMEOUT':
            return { reason: 'SQL_TIMEOUT', databaseErrorCode, databaseErrorMessage, timeoutType: 'connection' }
        case 'ER_CONNECTION_ALREADY_CLOSED':
        case 'ER_CMD_NOT_EXECUTED_DESTROYED':
        case 'ER_SOCKET_UNEXPECTED_CLOSE':
        case 'ER_CMD_CONNECTION_CLOSED':
        case 'ER_SOCKET':
            return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'connection lost' }
        case 'ER_SERVER_SSL_DISABLED':
        case 'ER_SELF_SIGNED':
        case 'ER_SELF_SIGNED_NO_PWD':
        case 'ER_TLS_IDENTITY_ERROR':
            return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'invalid connection configuration' }

        case 'ER_AUTHENTICATION_BAD_PACKET':
        case 'ER_AUTHENTICATION_PLUGIN_NOT_SUPPORTED':
        case 'ER_CANNOT_RETRIEVE_RSA_KEY':
        case 'ER_NOT_SUPPORTED_AUTH_PLUGIN':
        case 'ER_SELF_SIGNED_BAD_PLUGIN':
        case 'ER_SELF_SIGNED_SHA256':
            return { reason: 'SQL_AUTHENTICATION_ERROR', databaseErrorCode, databaseErrorMessage }

        case 'ER_MISSING_PARAMETER':
        case 'ER_PARAMETER_UNDEFINED':
        case 'ER_PLACEHOLDER_UNDEFINED':
        case 'ER_BATCH_WITH_NO_VALUES':
        case 'ER_BAD_PARAMETER_VALUE':
        case 'ER_UNDEFINED_SQL':
        case 'ER_MISSING_SQL_PARAMETER':
        case 'ER_MISSING_DATABASE_PARAMETER':
            return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode, databaseErrorMessage, ...getMariaDbInvalidParameterDetails(driverCode, message) }

        case 'ER_NULL_CHAR_ESCAPEID':
        case 'ER_NULL_ESCAPEID':
        case 'ER_PRIVATE_FIELDS_USE':
            return { reason: 'SQL_INVALID_SQL_STATEMENT', databaseErrorCode, databaseErrorMessage, statementErrorType: 'invalid identifier' }
        case 'ER_DUPLICATE_FIELD':
            return { reason: 'SQL_AMBIGUOUS_IDENTIFIER', databaseErrorCode, databaseErrorMessage, identifier: extractMariaDbQuotedName(message), identifierErrorType: 'duplicate' }
        case 'ER_PREPARE_CLOSED':
            return { reason: 'SQL_OBJECT_STATE_ERROR', databaseErrorCode, databaseErrorMessage, objectType: 'prepared statement', objectStateErrorType: 'invalid state' }

        case 'ER_LOCAL_INFILE_NOT_READABLE':
        case 'ER_SQL_FILE_ERROR':
            return { reason: 'SQL_IO_ERROR', databaseErrorCode, databaseErrorMessage, ioErrorType: 'read' }
        case 'ER_MISSING_SQL_FILE':
            return { reason: 'SQL_IO_ERROR', databaseErrorCode, databaseErrorMessage, ioErrorType: 'file not found' }
        case 'ER_LOCAL_INFILE_WRONG_FILENAME':
            return { reason: 'SQL_IO_ERROR', databaseErrorCode, databaseErrorMessage, ioErrorType: 'access' }
        case 'ER_LOCAL_INFILE_DISABLED':
            return { reason: 'SQL_PERMISSION_DENIED', databaseErrorCode, databaseErrorMessage }

        case 'ER_SETTING_SESSION_ERROR':
        case 'ER_INITIAL_SQL_ERROR':
        case 'ER_WRONG_IANA_TIMEZONE':
        case 'ER_WRONG_AUTO_TIMEZONE':
        case 'ER_INITIAL_TIMEOUT_ERROR':
            return { reason: 'SQL_CONFIGURATION_ERROR', databaseErrorCode, databaseErrorMessage, configurationErrorType: 'runtime parameter' }

        case 'ER_NOT_IMPLEMENTED_FORMAT':
        case 'ER_NODE_NOT_SUPPORTED_TLS':
        case 'ER_MYSQL_CHANGE_USER_BUG':
        case 'ER_TIMEOUT_NOT_SUPPORTED':
        case 'ER_MINIMUM_NODE_VERSION_REQUIRED':
        case 'ER_COMPRESSION_NOT_SUPPORTED':
            return { reason: 'SQL_FEATURE_NOT_SUPPORTED', databaseErrorCode, databaseErrorMessage }

        case 'ER_PARSING_PRECISION':
            return { reason: 'SQL_INVALID_VALUE', databaseErrorCode, databaseErrorMessage, errorType: 'out of range' }
        case 'ER_MAX_ALLOWED_PACKET':
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode, databaseErrorMessage }

        case 'ER_UNEXPECTED_PACKET':
        case 'ER_CHANGE_USER_BAD_PACKET':
        case 'ER_PING_BAD_PACKET':
        case 'ER_RESET_BAD_PACKET':
        case 'ER_EOF_EXPECTED':
            return { reason: 'SQL_INTERNAL_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'api misuse' }
    }

    if (message === 'pool is closed' || message === 'pool is already closed' || message === 'Cannot add request to pool, pool is closed' || message === 'pool is ending, connection request aborted') {
        return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'pool error' }
    }
    if (isMariaDbNetworkErrorCode(code)) {
        return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'connection lost' }
    }
    if (isMariaDbTimeoutErrorCode(code)) {
        return { reason: 'SQL_TIMEOUT', databaseErrorCode, databaseErrorMessage, timeoutType: 'connection' }
    }
    if (isMariaDbTlsConfigurationErrorCode(code) || isMariaDbInvalidConnectionConfigurationMessage(message)) {
        return { reason: 'SQL_CONNECTION_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'invalid connection configuration' }
    }
    if (isMariaDbPlainDriverFeatureNotSupportedMessage(message)) {
        return { reason: 'SQL_FEATURE_NOT_SUPPORTED', databaseErrorCode, databaseErrorMessage }
    }

    return undefined
}

function isMariaDbError(error: unknown): error is SqlError {
    return !!error && error instanceof Error && (
        isMySqlMariaDbEngineError(error)
        || isMariaDbKnownDriverError(error)
        || isMariaDbNodeError(error)
        || isMariaDbDriverMessage((error as Error).message || '')
    )
}

function isMariaDbKnownDriverError(error: SqlError): boolean {
    const driverCode = getMariaDbDriverErrorCode(error)
    return !!driverCode
}

function isMariaDbNodeError(error: SqlError): boolean {
    const code = getMariaDbStringCode(error)
    return isMariaDbNetworkErrorCode(code)
        || isMariaDbTimeoutErrorCode(code)
        || isMariaDbTlsConfigurationErrorCode(code)
}

function isMariaDbDriverMessage(message: string): boolean {
    return message === 'pool is closed'
        || message === 'pool is already closed'
        || message === 'Cannot add request to pool, pool is closed'
        || message === 'pool is ending, connection request aborted'
        || isMariaDbInvalidConnectionConfigurationMessage(message)
        || isMariaDbPlainDriverFeatureNotSupportedMessage(message)
}

function getMariaDbDatabaseErrorCode(error: SqlError): string | undefined {
    const code = getMariaDbStringCode(error)
    if (code) {
        return getMySqlMariaDbErrorCodeName(getMySqlMariaDbErrorNumberFromCode(code)) ?? code
    }
    const errorNumber = getMariaDbPositiveErrorNumber(error)
    return getMySqlMariaDbErrorCodeName(errorNumber)
}

function getMariaDbDatabaseErrorNumber(error: SqlError): TsSqlDatabaseErrorNumber | undefined {
    const code = getMariaDbStringCode(error)
    return getMariaDbPositiveErrorNumber(error)
        ?? (code ? MARIADB_DRIVER_ERROR_CODE_NUMBERS.get(code) : undefined)
        ?? getMySqlMariaDbErrorNumberFromCode(code)
        ?? error.sqlState
}

function getMariaDbPositiveErrorNumber(error: SqlError): number | undefined {
    return typeof error.errno === 'number' && error.errno > 0 ? error.errno : undefined
}

function getMariaDbStringCode(error: SqlError): string | undefined {
    return typeof error.code === 'string' ? error.code : undefined
}

function getMariaDbDriverErrorCode(error: SqlError): string | undefined {
    const code = getMariaDbStringCode(error)
    if (code && MARIADB_DRIVER_ERROR_CODE_NUMBERS.has(code)) {
        return code
    }

    const errorNumber = getMariaDbPositiveErrorNumber(error)
    if (errorNumber !== undefined && MARIADB_DRIVER_ERROR_NUMBERS.has(errorNumber)) {
        return MARIADB_DRIVER_ERROR_NUMBER_CODES.get(errorNumber)
    }

    return undefined
}

function withDatabaseErrorNumber(reason: TsSqlErrorReason, databaseErrorNumber: TsSqlDatabaseErrorNumber | undefined): TsSqlErrorReason {
    if (databaseErrorNumber === undefined || reason.reason === 'UNKNOWN') {
        return reason
    }
    return { ...reason, databaseErrorNumber } as TsSqlErrorReason
}

function isMariaDbNetworkErrorCode(code: string | undefined): boolean {
    return !!code && MARIADB_NETWORK_ERROR_CODES.has(code)
}

function isMariaDbTimeoutErrorCode(code: string | undefined): boolean {
    return !!code && MARIADB_TIMEOUT_ERROR_CODES.has(code)
}

function isMariaDbTlsConfigurationErrorCode(code: string | undefined): boolean {
    return !!code && MARIADB_TLS_CONFIGURATION_ERROR_CODES.has(code)
}

function getMariaDbInvalidParameterDetails(code: string, message: string): {
    parameterErrorType?: 'missing' | 'invalid value'
    parameterName?: string
} {
    if (code === 'ER_BAD_PARAMETER_VALUE') {
        return { parameterErrorType: 'invalid value' }
    }
    if (code === 'ER_UNDEFINED_SQL') {
        return { parameterErrorType: 'missing', parameterName: 'sql' }
    }
    if (code === 'ER_MISSING_SQL_PARAMETER') {
        return { parameterErrorType: 'missing', parameterName: 'file' }
    }
    if (code === 'ER_MISSING_DATABASE_PARAMETER') {
        return { parameterErrorType: 'missing', parameterName: 'database' }
    }
    const placeholderName = /^Placeholder '([^']+)' is not defined$/.exec(message)
    if (placeholderName) {
        return { parameterErrorType: 'missing', parameterName: placeholderName[1] }
    }
    const namedParameter = /^Parameter named ([^\s]+) is not set/.exec(message)
    if (namedParameter) {
        return { parameterErrorType: 'missing', parameterName: namedParameter[1] }
    }
    return { parameterErrorType: 'missing' }
}

function extractMariaDbQuotedName(message: string): string | undefined {
    const backtick = /`([^`]+)`/.exec(message)
    if (backtick) {
        return backtick[1]
    }
    const singleQuoted = /(^|[^A-Za-z])'([^']+)'(?![A-Za-z])/.exec(message)
    if (singleQuoted) {
        return singleQuoted[2]
    }
    const doubleQuoted = /"([^"]+)"/.exec(message)
    if (doubleQuoted) {
        return doubleQuoted[1]
    }
    return undefined
}

function isMariaDbInvalidConnectionConfigurationMessage(message: string): boolean {
    return /^Unknown charset '[^']+'$/.test(message)
        || /^Unknown collation '[^']+'/.test(message)
        || /^maxAllowedPacket must be an integer\. was '.+'$/.test(message)
        || message.startsWith('Failed to parse connectAttributes as JSON: ')
}

function isMariaDbPlainDriverFeatureNotSupportedMessage(message: string): boolean {
    return message.startsWith('Reset command not permitted for server ')
}
