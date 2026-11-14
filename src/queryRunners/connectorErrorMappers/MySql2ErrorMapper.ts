import type { TsSqlDatabaseErrorNumber, TsSqlErrorReason } from '../../TsSqlError.js'
import type { DatabaseType } from '../QueryRunner.js'
import { getMySqlMariaDbEngineErrorReason, getMySqlMariaDbErrorCodeName, getMySqlMariaDbErrorNumberFromCode, isMySqlMariaDbEngineErrorCode } from '../databaseErrorMappers/MySqlMariaDbErrorMapper.js'

/**
 * An error raised through mysql2: an `Error` that may carry the error number of the server, a code (the name of the
 * error, a Node error code or a number), the SQLSTATE, the message of the server and the system call that failed.
 */
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

/**
 * Gives the `TsSqlErrorReason` of an error raised through mysql2 (`database` picks the names and numbers of the error
 * codes of MySQL or MariaDB); `UNKNOWN` when it isn't an error of that driver.
 */
export function getMySql2ErrorReason(error: unknown, database?: DatabaseType): TsSqlErrorReason {
    if (!isMySql2Error(error)) {
        return { reason: 'UNKNOWN' }
    }
    return getMySql2DriverOrEngineErrorReason(error, database)
}

/**
 * Tells whether the error comes from mysql2: an `Error` from the server, with a code the driver gives, or with a
 * message the driver raises.
 */
export function isMySql2Error(error: unknown): error is MySql2DriverError {
    return !!error && error instanceof Error && (
        isMySql2EngineError(error)
        || isMySql2KnownDriverError(error)
        || isMySql2DriverMessage(getMySql2ErrorMessage(error))
    )
}

/**
 * Gives the reason of an error of mysql2: the driver's when its code or message is known, otherwise the engine's,
 * mapped with `getMySqlMariaDbEngineErrorReason`, when it comes from the server, otherwise `UNKNOWN`; with the number
 * of the error added.
 */
function getMySql2DriverOrEngineErrorReason(error: MySql2DriverError, database?: DatabaseType): TsSqlErrorReason {
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

/**
 * Gives the reason of an error mysql2 raises itself, or of Node, recognised by its code and its message (pool, closed
 * connection, network, timeouts, configuration, authentication, protocol, misuse of the API, parameters); `undefined`
 * when they aren't one of them.
 */
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
        // a packet from the server the driver didn't expect: not something the caller did
        return { reason: 'SQL_INTERNAL_ERROR', databaseErrorCode, databaseErrorMessage, errorType: 'engine internal' }
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

/** Tells whether the error comes from the server: it has an error number, a SQLSTATE or a code of the engine. */
function isMySql2EngineError(error: MySql2DriverError): boolean {
    return getMySql2ErrorNumber(error) !== undefined
        || getMySql2SqlState(error) !== undefined
        || getMySql2EngineErrorCode(error) !== undefined
}

/** Tells whether the code of the error is one mysql2 gives itself, or a code of Node for the network or a timeout. */
function isMySql2KnownDriverError(error: MySql2DriverError): boolean {
    const code = getMySql2StringCode(error)
    return isMySql2KnownDriverCode(code)
}

/** Tells whether the code is one mysql2 gives itself, or a code of Node for the network or a timeout. */
function isMySql2KnownDriverCode(code: string | undefined): boolean {
    return !!code && (
        MYSQL2_DRIVER_ERROR_CODES.has(code)
        || isMySql2NetworkErrorCode(code)
        || isMySql2TimeoutErrorCode(code)
    )
}

/**
 * Tells whether the code is a code of Node for a connection refused, reset, aborted or a host that can't be reached.
 */
function isMySql2NetworkErrorCode(code: string | undefined): boolean {
    return !!code && MYSQL2_NETWORK_ERROR_CODES.has(code)
}

/** Tells whether the code is a code of Node for a timeout of the connection. */
function isMySql2TimeoutErrorCode(code: string | undefined): boolean {
    return !!code && MYSQL2_TIMEOUT_ERROR_CODES.has(code)
}

/** Gives the message of the server (`sqlMessage`), otherwise the `message` of the error, or an empty text. */
function getMySql2ErrorMessage(error: MySql2DriverError): string {
    return error.sqlMessage || error.message || ''
}

/**
 * Tells whether the message is one mysql2 raises for bind parameters that aren't an array or contain `undefined` or a
 * function.
 */
function isMySql2InvalidParameterMessage(message: string): boolean {
    return message === 'Bind parameters must be array if namedPlaceholders parameter is not enabled'
        || message === 'Bind parameters must not contain undefined'
        || message === 'Bind parameters must not contain undefined. To pass SQL NULL specify JS null'
        || message === 'Bind parameters must not contain function(s). To pass the body of a function as a string call .toString() first'
}

/**
 * Gives the parameter error of the message: `invalid binding` when the parameters aren't an array, `invalid value`
 * otherwise.
 */
function getMySql2InvalidParameterDetails(message: string): {
    parameterErrorType?: 'invalid value' | 'invalid binding' | undefined
} {
    if (message === 'Bind parameters must be array if namedPlaceholders parameter is not enabled') {
        return { parameterErrorType: 'invalid binding' }
    }
    return { parameterErrorType: 'invalid value' }
}

/** Tells whether the message is one mysql2 raises itself. */
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

/**
 * Tells whether the message is one mysql2 raises for an invalid option of the connection: user, database, SSL, charset
 * or authentication data.
 */
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

/** Tells whether the message is one mysql2 raises during the authentication with a plugin. */
function isMySql2AuthenticationMessage(message: string): boolean {
    return message === 'AuthPluginMoreData received but no auth plugin instance found'
        || message.startsWith('Server requested authentication using mysql_clear_password, ')
        || message.startsWith('Server requests authentication using unknown plugin ')
        || /^Unexpected data in AuthMoreData packet received by .+ plugin in .+ state\.$/.test(message)
        || /^Unexpected data in AuthMoreData packet received by .+ plugin in STATE_FINAL state\.$/.test(message)
        || /^Invalid AuthMoreData packet received by .+ plugin in STATE_TOKEN_SENT state\.$/.test(message)
}

/** Tells whether the message is one mysql2 raises for a packet of the server it didn't expect. */
function isMySql2ProtocolMessage(message: string): boolean {
    return message === 'Unexpected packet during handshake phase'
        || message === 'Unexpected packet while no commands in the queue'
        || message === 'Expected EOF packet'
        || message === 'Expected EOF packet after parameters'
        || message === 'Expected EOF packet after fields'
        || /^Should not reach here: .+$/.test(message)
}

/** Tells whether the message is one mysql2 raises when a callback or a promise is used with the wrong client. */
function isMySql2PromiseOrApiMisuseMessage(message: string): boolean {
    return message === 'Callback function is not available with promise clients.'
        || message.startsWith('no Promise implementation available.')
        || message.startsWith('You have tried to call .then(), .catch(), or invoked await on the result of query that is not a promise, which is a programming error.')
}

/**
 * Tells whether the message says that the name of a column of the result is the one of a private property of an object.
 */
function isMySql2PrivateObjectPropertyMessage(message: string): boolean {
    return /^The field name \(.+\) can't be the same as an object's private property\.$/.test(message)
}

/** Gives the `code` of the error when it is a text, otherwise `undefined`. */
function getMySql2StringCode(error: MySql2DriverError): string | undefined {
    return typeof error.code === 'string' ? error.code : undefined
}

/** Gives the `code` of the error when it is the name of an error of the engine, otherwise `undefined`. */
function getMySql2EngineErrorCode(error: MySql2DriverError): string | undefined {
    const code = getMySql2StringCode(error)
    return code && isMySqlMariaDbEngineErrorCode(code) ? code : undefined
}

/** Gives the SQLSTATE of the error when it is five letters or digits, otherwise `undefined`. */
function getMySql2SqlState(error: MySql2DriverError): string | undefined {
    const sqlState = error.sqlState
    return typeof sqlState === 'string' && /^[0-9A-Z]{5}$/i.test(sqlState) ? sqlState : undefined
}

/**
 * Gives the error number of the server: the `errno`, or else the `code` when it is a positive number or a text of
 * digits; `undefined` otherwise.
 */
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

/**
 * Gives the code reported as `databaseErrorCode`: for a code of the engine or of the driver, the name the database
 * gives to its number, or the code itself; otherwise the name of the error number on the database.
 */
function getMySql2DatabaseErrorCode(error: MySql2DriverError, database?: DatabaseType): string | undefined {
    const code = getMySql2StringCode(error)
    if (code && (isMySqlMariaDbEngineErrorCode(code) || isMySql2KnownDriverCode(code))) {
        return getMySqlMariaDbErrorCodeName(getMySqlMariaDbErrorNumberFromCode(code, database), database) ?? code
    }

    const errorNumber = getMySql2ErrorNumber(error)
    return getMySqlMariaDbErrorCodeName(errorNumber, database)
}

/**
 * Gives the number reported as `databaseErrorNumber`: the error number, otherwise the number of the code on the
 * database, otherwise the SQLSTATE.
 */
function getMySql2DatabaseErrorNumber(error: MySql2DriverError, database?: DatabaseType): TsSqlDatabaseErrorNumber | undefined {
    const code = getMySql2StringCode(error)
    return getMySql2ErrorNumber(error) ?? getMySqlMariaDbErrorNumberFromCode(code, database) ?? getMySql2SqlState(error)
}

/**
 * Gives the reason with `databaseErrorNumber` set, or the reason as it is when there is no number or the reason is
 * `UNKNOWN`.
 */
function withDatabaseErrorNumber(reason: TsSqlErrorReason, databaseErrorNumber: TsSqlDatabaseErrorNumber | undefined): TsSqlErrorReason {
    if (databaseErrorNumber === undefined || reason.reason === 'UNKNOWN') {
        return reason
    }
    return { ...reason, databaseErrorNumber } as TsSqlErrorReason
}
