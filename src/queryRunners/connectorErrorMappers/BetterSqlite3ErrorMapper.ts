import BetterSqlite3 from 'better-sqlite3'
import type { TsSqlErrorReason } from '../../TsSqlError.js'
import { getSqliteEngineErrorReason } from '../databaseErrorMappers/SqliteErrorMapper.js'

/** An error better-sqlite3 raises with the SQLite result code of the engine (its `SqliteError` class). */
type BetterSqlite3SqliteError = InstanceType<typeof BetterSqlite3.SqliteError>
/** An error better-sqlite3 raises itself, without a SQLite result code, recognised by its message. */
type BetterSqlite3DriverError = Error
/** An error of better-sqlite3: one with the SQLite result code of the engine, or one of the driver. */
type BetterSqlite3Error = BetterSqlite3SqliteError | BetterSqlite3DriverError

/**
 * Gives the `TsSqlErrorReason` of an error raised through better-sqlite3; `UNKNOWN` when it isn't an error of that
 * driver.
 */
export function getBetterSqlite3ErrorReason(error: unknown): TsSqlErrorReason {
    if (!isBetterSqlite3Error(error)) {
        return { reason: 'UNKNOWN' }
    }
    return getBetterSqlite3DriverOrEngineErrorReason(error)
}

/**
 * Tells whether the error comes from better-sqlite3: a `SqliteError`, or an `Error` whose message is one the driver
 * raises.
 */
export function isBetterSqlite3Error(error: unknown): error is BetterSqlite3Error {
    if (error instanceof BetterSqlite3.SqliteError) {
        return true
    }
    if (!(error instanceof Error)) {
        return false
    }
    return !!getBetterSqlite3DriverErrorReason(error)
}

/**
 * Gives the reason of an error of better-sqlite3: the engine's for a `SqliteError`, otherwise the one of the driver's
 * message, or `SQL_UNKNOWN` when the message isn't known.
 */
function getBetterSqlite3DriverOrEngineErrorReason(error: BetterSqlite3Error): TsSqlErrorReason {
    if (error instanceof BetterSqlite3.SqliteError) {
        return getBetterSqlite3SqliteErrorReason(error)
    }
    return getBetterSqlite3DriverErrorReason(error) || { reason: 'SQL_UNKNOWN', databaseErrorMessage: error.message || undefined }
}

/**
 * Gives the reason of a `SqliteError`, mapping its SQLite result code and message with `getSqliteEngineErrorReason`.
 */
function getBetterSqlite3SqliteErrorReason(error: BetterSqlite3SqliteError): TsSqlErrorReason {
    return getSqliteEngineErrorReason({ code: error.code, message: error.message })
}

/**
 * Gives the reason of an error better-sqlite3 raises itself, recognised by its exact message (configuration, closed
 * connection, busy connection, parameters, values out of range, memory, misuse of the API); `undefined` when the
 * message isn't one of them. The messages about the parameters are mapped with `getSqliteEngineErrorReason`.
 */
function getBetterSqlite3DriverErrorReason(error: BetterSqlite3DriverError): TsSqlErrorReason | undefined {
    const message = error.message || ''
    const upper = message.toUpperCase()
    const databaseErrorMessage = message || undefined
    const fromBetterSqlite3Stack = isBetterSqlite3Stack(error)

    if (!message) {
        return undefined
    }

    if (message === 'Cannot open database because the directory does not exist'
        || message === 'Cannot save backup because the directory does not exist'
        || message === 'In-memory/temporary databases cannot be readonly') {
        return { reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration', databaseErrorMessage }
    }
    if (message === 'The database connection is not open') {
        return { reason: 'SQL_CONNECTION_ERROR', errorType: 'connection lost', databaseErrorMessage }
    }
    if (message === 'This database connection is busy executing a query'
        || message === 'This statement is busy executing a query') {
        return { reason: 'FORBIDDEN_CONCURRENT_USAGE', databaseErrorMessage }
    }
    if (isBetterSqlite3InvalidParameterMessage(message)) {
        return getSqliteEngineErrorReason({ message })
    }
    if (message === 'The bound string, buffer, or bigint is too big') {
        return { reason: 'SQL_INVALID_VALUE', errorType: 'too long', databaseErrorMessage }
    }
    if (isBetterSqlite3TooBigReturnedValueMessage(message)) {
        return { reason: 'SQL_INVALID_VALUE', errorType: 'out of range', databaseErrorMessage }
    }
    if (isBetterSqlite3InvalidReturnedValueMessage(message)) {
        return { reason: 'SQL_INVALID_VALUE', errorType: 'invalid value', databaseErrorMessage }
    }
    if (message === 'Out of memory' || message === 'Array overflow (too many rows returned)') {
        return { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'memory', databaseErrorMessage }
    }
    if (message === 'Too many active database iterators') {
        return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorMessage }
    }
    if (isBetterSqlite3ApiMisuseMessage(message, fromBetterSqlite3Stack)) {
        return { reason: 'SQL_INTERNAL_ERROR', errorType: 'api misuse', databaseErrorMessage }
    }
    if (upper === 'AN UNEXPECTED ERROR OCCURED WHILE TRYING TO BIND PARAMETERS') {
        return { reason: 'SQL_UNKNOWN', databaseErrorMessage }
    }
    return undefined
}

/**
 * Tells whether the stack of the error passes through the better-sqlite3 package, with a separator of Unix or of
 * Windows.
 */
function isBetterSqlite3Stack(error: Error): boolean {
    const stack = error.stack || ''
    return stack.includes('node_modules/better-sqlite3/')
        || stack.includes('node_modules\\better-sqlite3\\')
}

/**
 * Tells whether the message is one better-sqlite3 raises for parameters that are missing, too many, too few or of a
 * data type it can't bind.
 */
function isBetterSqlite3InvalidParameterMessage(message: string): boolean {
    switch (message) {
        case 'Missing named parameters':
        case 'Too few parameter values were provided':
        case 'Too many parameter values were provided':
        case 'SQLite3 can only bind numbers, strings, bigints, buffers, and null':
        case 'You cannot specify named parameters in two different objects':
        case 'Named parameters can only be passed within plain objects':
        case 'This statement already has bound parameters':
            return true
    }
    return /^Missing named parameter ".+"$/.test(message)
}

/**
 * Tells whether the message says that a user-defined function or a virtual table gave back a bigint too big for SQLite.
 */
function isBetterSqlite3TooBigReturnedValueMessage(message: string): boolean {
    return /^User-defined function .+\(\) returned a bigint that was too big$/.test(message)
        || /^Virtual table module ".+" yielded a bigint that was too big$/.test(message)
}

/**
 * Tells whether the message says that a user-defined function or a virtual table gave back a value SQLite can't take.
 */
function isBetterSqlite3InvalidReturnedValueMessage(message: string): boolean {
    return /^User-defined function .+\(\) returned an invalid value$/.test(message)
        || /^Virtual table module ".+" yielded an invalid value$/.test(message)
}

/**
 * Tells whether the message is one better-sqlite3 raises when its API is misused: a wrong option or argument, a
 * statement used for something it doesn't do. The generic messages about arguments only count when the error comes from
 * the stack of better-sqlite3, because other code can raise them too.
 */
function isBetterSqlite3ApiMisuseMessage(message: string, fromBetterSqlite3Stack: boolean): boolean {
    switch (message) {
        case 'Misspelled option "readOnly" should be "readonly"':
        case 'Option "memory" was removed in v7.0.0 (use ":memory:" filename instead)':
        case 'Expected the "timeout" option to be a positive integer':
        case 'Option "timeout" cannot be greater than 2147483647':
        case 'Expected the "verbose" option to be a function':
        case 'Expected the "nativeBinding" option to be a string or addon object':
        case 'The supplied SQL string contains no statements':
        case 'The supplied SQL string contains more than one statement':
        case 'This statement does not return data. Use run() instead':
        case 'The bind() method can only be invoked once per statement object':
        case 'The pluck() method is only for statements that return data':
        case 'The expand() method is only for statements that return data':
        case 'The raw() method is only for statements that return data':
        case 'The columns() method is only for statements that return data':
        case 'Transaction function cannot return a promise':
        case 'Backup filename cannot be an empty string':
        case 'Invalid backup filename ":memory:"':
        case 'Expected the "attached" option to be a string':
        case 'The "attached" option cannot be an empty string':
        case 'Expected the "progress" option to be a function':
        case 'Expected progress callback to return a number or undefined':
        case 'User-defined function name cannot be an empty string':
        case 'User-defined functions cannot have more than 100 arguments':
        case 'Virtual table module name cannot be an empty string':
        case 'Disabled constructor':
        case 'Statements can only be constructed by the db.prepare() method':
            return true
    }
    if (isBetterSqlite3DynamicApiMisuseMessage(message)) {
        return true
    }
    return fromBetterSqlite3Stack && isBetterSqlite3GenericApiMisuseMessage(message)
}

/**
 * Tells whether the message is a misuse of the API of better-sqlite3 that names an option or a virtual table, matched
 * by pattern.
 */
function isBetterSqlite3DynamicApiMisuseMessage(message: string): boolean {
    return /^Expected the ".+" option to be (?:a boolean|a function)$/.test(message)
        || /^Missing required option ".+"$/.test(message)
        || /^Virtual table module ".+" did not return a table definition object$/.test(message)
        || /^Virtual table module ".+" (?:used|returned) a table definition without a "(?:rows|columns)" property$/.test(message)
        || /^Virtual table module ".+" (?:used|returned) a table definition with .+$/.test(message)
        || /^Virtual table module ".+" yielded something that isn't a valid row object$/.test(message)
        || /^Virtual table module ".+" yielded a row with (?:an incorrect number of columns|missing columns)$/.test(message)
        || /^Virtual table module ".+" yielded a row with an undeclared column ".+"$/.test(message)
}

/**
 * Tells whether the message is one of the generic messages about the arguments of a call that better-sqlite3 raises.
 */
function isBetterSqlite3GenericApiMisuseMessage(message: string): boolean {
    switch (message) {
        case 'Expected a first argument':
        case 'Expected first argument to be a string':
        case 'Expected first argument to be a function':
        case 'Expected first argument to be an options object':
        case 'Expected first argument to be a boolean':
        case 'Expected first argument to be a 32-bit signed integer':
        case 'Expected second argument to be a string':
        case 'Expected second argument to be an object':
        case 'Expected second argument to be an options object':
        case 'Expected second argument to be a function or a table definition object':
        case 'Expected last argument to be a function':
        case 'Expected function.length to be a positive integer':
            return true
    }
    return false
}
