import type { TsSqlDatabaseErrorCode, TsSqlDatabaseErrorNumber, TsSqlErrorReason } from '../../TsSqlError.js'
import {
    SQLITE_ERROR_CODE_NAMES,
    SQLITE_ERROR_CODE_NUMBERS,
} from './SqliteErrorCodes.js'

/** An error raised by SQLite, as the mapper of a driver hands it to `getSqliteEngineErrorReason`. */
export interface SqliteEngineError {
    /** The name of the SQLite result code (`SQLITE_CONSTRAINT_UNIQUE`); it decides the reason, with the message. */
    code?: string | undefined
    /** The database error code to report in the reason; when absent, `code` is used. */
    databaseErrorCode?: TsSqlDatabaseErrorCode | undefined
    /** The database error number to report in the reason; when absent, the number of `code` is used. */
    databaseErrorNumber?: TsSqlDatabaseErrorNumber | undefined
    /**
     * The message of the error; without a code that decides, the reason is read from it, and so are the names it
     * carries.
     */
    message?: string | undefined
}

/**
 * Gives the reason of an error raised by SQLite, from its result code and its message, with the database error number
 * given or, when there is none, the number of the code.
 */
export function getSqliteEngineErrorReason(error: SqliteEngineError): TsSqlErrorReason {
    const databaseErrorNumber = error.databaseErrorNumber ?? getSqliteErrorCodeNumber(error.code)
    return withDatabaseErrorNumber(getSqliteEngineErrorReasonInternal(error), databaseErrorNumber)
}

/**
 * Gives the reason of the error without the database error number. The families of codes come first (constraint, I/O,
 * can't open, read only, abort, busy, locked, corrupt, notice, warning), then single codes; when the code doesn't
 * decide, the message is read with `getSqliteEngineMessageReason`; a plain `SQLITE_ERROR` left gives
 * `SQL_INVALID_SQL_STATEMENT`, and anything else `SQL_UNKNOWN`.
 */
function getSqliteEngineErrorReasonInternal(error: SqliteEngineError): TsSqlErrorReason {
    const code = error.code || ''
    const databaseErrorCode = error.databaseErrorCode ?? (code || undefined)
    const databaseErrorMessage = error.message || undefined
    const message = error.message || ''
    const upper = message.toUpperCase()

    if (code === 'SQLITE_CONSTRAINT_DATATYPE' || (code === 'SQLITE_CONSTRAINT' && /^cannot store \w+ value in \w+ column /i.test(message))) {
        return { reason: 'SQL_INVALID_VALUE', errorType: 'invalid value', columnName: extractColumnPathLastSegment(message), databaseErrorCode, databaseErrorMessage }
    }
    if (code.startsWith('SQLITE_CONSTRAINT')) {
        return getSqliteConstraintReason(code, message, databaseErrorCode, databaseErrorMessage)
    }
    if (code.startsWith('SQLITE_IOERR')) {
        return getSqliteIoErrorReason(code, databaseErrorCode, databaseErrorMessage)
    }
    if (code.startsWith('SQLITE_CANTOPEN')) {
        return { reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration', databaseErrorCode, databaseErrorMessage }
    }
    if (code.startsWith('SQLITE_READONLY')) {
        return { reason: 'SQL_READ_ONLY_VIOLATION', databaseErrorCode, databaseErrorMessage }
    }
    if (code === 'SQLITE_ABORT_ROLLBACK') {
        return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'aborted' }
    }
    if (code.startsWith('SQLITE_ABORT')) {
        return { reason: 'SQL_TIMEOUT', timeoutType: 'cancelled', databaseErrorCode, databaseErrorMessage }
    }
    if (code === 'SQLITE_BUSY_SNAPSHOT') {
        return { reason: 'TRANSACTION_ERROR', databaseErrorCode, databaseErrorMessage, transactionErrorType: 'serialization failure' }
    }
    if (code.startsWith('SQLITE_BUSY')) {
        return { reason: 'SQL_TIMEOUT', timeoutType: 'database file busy', databaseErrorCode, databaseErrorMessage }
    }
    if (code.startsWith('SQLITE_LOCKED')) {
        return { reason: 'SQL_TIMEOUT', timeoutType: 'lock', databaseErrorCode, databaseErrorMessage }
    }
    if (code.startsWith('SQLITE_CORRUPT')) {
        return getSqliteCorruptionReason(code, databaseErrorCode, databaseErrorMessage)
    }
    if (code.startsWith('SQLITE_NOTICE')) {
        return { reason: 'SQL_INTERNAL_ERROR', errorType: 'engine internal', databaseErrorCode, databaseErrorMessage }
    }
    if (code.startsWith('SQLITE_WARNING')) {
        return { reason: 'SQL_INTERNAL_ERROR', errorType: 'engine internal', databaseErrorCode, databaseErrorMessage }
    }

    switch (code) {
        case 'SQLITE_OK':
        case 'SQLITE_ROW':
        case 'SQLITE_DONE':
        case 'SQLITE_OK_LOAD_PERMANENTLY':
            return { reason: 'SQL_INTERNAL_ERROR', errorType: 'engine internal', databaseErrorCode, databaseErrorMessage }
        case 'SQLITE_INTERNAL':
            return { reason: 'SQL_INTERNAL_ERROR', errorType: 'engine internal', databaseErrorCode, databaseErrorMessage }
        case 'SQLITE_NOTFOUND':
            return { reason: 'SQL_INTERNAL_ERROR', errorType: 'engine internal', databaseErrorCode, databaseErrorMessage }
        case 'SQLITE_EMPTY':
        case 'SQLITE_FORMAT':
            return { reason: 'SQL_INTERNAL_ERROR', errorType: 'engine internal', databaseErrorCode, databaseErrorMessage }
        case 'SQLITE_ERROR_MISSING_COLLSEQ':
            return { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'collation', objectName: extractSqliteMissingCollationName(message), databaseErrorCode, databaseErrorMessage }
        case 'SQLITE_ERROR_RETRY':
            return { reason: 'SQL_INTERNAL_ERROR', errorType: 'engine internal', databaseErrorCode, databaseErrorMessage }
        case 'SQLITE_ERROR_SNAPSHOT':
            return { reason: 'TRANSACTION_ERROR', transactionErrorType: 'invalid state', databaseErrorCode, databaseErrorMessage }
        case 'SQLITE_TOOBIG':
            if (upper.includes('STATEMENT TOO LONG')) {
                return { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'statement length', databaseErrorCode, databaseErrorMessage }
            }
            return { reason: 'SQL_INVALID_VALUE', errorType: 'too long', columnName: extractColumnPathLastSegment(message), databaseErrorCode, databaseErrorMessage }
        case 'SQLITE_MISMATCH':
            return { reason: 'SQL_INVALID_VALUE', errorType: 'invalid value', columnName: extractColumnPathLastSegment(message), databaseErrorCode, databaseErrorMessage }
        case 'SQLITE_RANGE':
            return { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid index', databaseErrorCode, databaseErrorMessage }
        case 'SQLITE_MISUSE':
            if (upper.includes('DATABASE HANDLE IS CLOSED') || upper.includes('DATABASE IS CLOSED')) {
                return { reason: 'SQL_CONNECTION_ERROR', errorType: 'connection lost', databaseErrorCode, databaseErrorMessage }
            }
            return { reason: 'SQL_INTERNAL_ERROR', errorType: 'api misuse', databaseErrorCode, databaseErrorMessage }
        case 'SQLITE_INTERRUPT':
            return { reason: 'SQL_TIMEOUT', timeoutType: 'cancelled', databaseErrorCode, databaseErrorMessage }
        case 'SQLITE_NOMEM':
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'memory', databaseErrorCode, databaseErrorMessage }
        case 'SQLITE_FULL':
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'disk', databaseErrorCode, databaseErrorMessage }
        case 'SQLITE_NOLFS':
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'file size', databaseErrorCode, databaseErrorMessage }
        case 'SQLITE_PROTOCOL':
            return { reason: 'SQL_TIMEOUT', timeoutType: 'lock', databaseErrorCode, databaseErrorMessage }
        case 'SQLITE_NOTADB':
            return { reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration', databaseErrorCode, databaseErrorMessage }
        case 'SQLITE_AUTH':
        case 'SQLITE_AUTH_USER':
            return { reason: 'SQL_AUTHORIZATION_ERROR', databaseErrorCode, databaseErrorMessage }
        case 'SQLITE_PERM':
            return { reason: 'SQL_PERMISSION_DENIED', databaseErrorCode, databaseErrorMessage }
        case 'SQLITE_SCHEMA':
            return { reason: 'SQL_OBJECT_STATE_ERROR', objectType: 'schema', objectStateErrorType: 'invalid state', databaseErrorCode, databaseErrorMessage }
    }

    const reasonByMessage = getSqliteEngineMessageReason(upper, message, databaseErrorCode, databaseErrorMessage)
    if (reasonByMessage) {
        return reasonByMessage
    }

    if (code === 'SQLITE_ERROR') {
        return { reason: 'SQL_INVALID_SQL_STATEMENT', databaseErrorCode, databaseErrorMessage }
    }

    return { reason: 'SQL_UNKNOWN', databaseErrorCode, databaseErrorMessage }
}

/**
 * Gives the limit the message of a resource error names, or `undefined` when it names none. The forms read: "variable
 * number must be between ?1 and ?32766", "at most 64 tables in a join", "too many FROM clause terms, max: 200", "too
 * many references to "x": max 65535", "Expression tree is too large (maximum depth 1000)".
 */
function extractSqliteLimit(message: string): number | undefined {
    const limit = /\?1 and \?(\d+)|at most (\d+)|max:? (\d+)|maximum depth (\d+)/i.exec(message)
    return limit ? Number(limit[1] ?? limit[2] ?? limit[3] ?? limit[4]) : undefined
}

/** Gives the name of the SQLite result code with that number, or `undefined` when it isn't known. */
export function getSqliteErrorCodeName(errorCode: number): string | undefined {
    return SQLITE_ERROR_CODE_NAMES.get(errorCode)
}

/**
 * Gives the number of the SQLite result code with that name, or `undefined` when there is no name or it isn't known.
 */
export function getSqliteErrorCodeNumber(errorCode: string | undefined): number | undefined {
    if (!errorCode) {
        return undefined
    }
    return SQLITE_ERROR_CODE_NUMBERS.get(errorCode)
}

/**
 * Gives the database error code, the name of the result code, for a numeric SQLite result code; `undefined` when there
 * is no number or it isn't known.
 */
export function getSqliteDatabaseErrorCodeFromNumeric(errorCode: number | undefined): TsSqlDatabaseErrorCode | undefined {
    if (typeof errorCode !== 'number') {
        return undefined
    }
    return getSqliteErrorCodeName(errorCode)
}

/**
 * Gives the database error number for a numeric SQLite result code: the number itself, or `undefined` when there is
 * none.
 */
export function getSqliteDatabaseErrorNumberFromNumeric(errorCode: number | undefined): TsSqlDatabaseErrorNumber | undefined {
    return typeof errorCode === 'number' ? errorCode : undefined
}

/** Gives the reason with the database error number added, or the same reason when there is no number. */
function withDatabaseErrorNumber(reason: TsSqlErrorReason, databaseErrorNumber: TsSqlDatabaseErrorNumber | undefined): TsSqlErrorReason {
    if (databaseErrorNumber === undefined) {
        return reason
    }
    return { ...reason, databaseErrorNumber } as TsSqlErrorReason
}

/**
 * Gives the reason of an `SQLITE_IOERR` code: a lack of memory or disk, a corruption, an authorization error, or an
 * `SQL_IO_ERROR` with the type of I/O error of `getSqliteIoErrorType`.
 */
function getSqliteIoErrorReason(code: string, databaseErrorCode: TsSqlDatabaseErrorCode | undefined, databaseErrorMessage?: string): TsSqlErrorReason {
    switch (code) {
        case 'SQLITE_IOERR_NOMEM':
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'memory', databaseErrorCode, databaseErrorMessage }
        case 'SQLITE_IOERR_SHMSIZE':
            return { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'disk', databaseErrorCode, databaseErrorMessage }
        case 'SQLITE_IOERR_DATA':
            return { reason: 'SQL_DATABASE_CORRUPTED', corruptionType: 'checksum', databaseErrorCode, databaseErrorMessage }
        case 'SQLITE_IOERR_CORRUPTFS':
            return { reason: 'SQL_DATABASE_CORRUPTED', corruptionType: 'filesystem', databaseErrorCode, databaseErrorMessage }
        case 'SQLITE_IOERR_AUTH':
            return { reason: 'SQL_AUTHORIZATION_ERROR', databaseErrorCode, databaseErrorMessage }
        default:
            return { reason: 'SQL_IO_ERROR', ioErrorType: getSqliteIoErrorType(code), databaseErrorCode, databaseErrorMessage }
    }
}

/** Gives the type of I/O error of an extended `SQLITE_IOERR` code, `unknown` for the ones not listed. */
function getSqliteIoErrorType(code: string): 'read' | 'write' | 'fsync' | 'truncate' | 'file stat' | 'lock' | 'unlock' | 'delete' | 'file not found' | 'access' | 'shared memory' | 'seek' | 'mmap' | 'path' | 'atomic write' | 'close' | 'reserved extension' | 'unknown' {
    switch (code) {
        case 'SQLITE_IOERR_READ':
        case 'SQLITE_IOERR_SHORT_READ':
            return 'read'
        case 'SQLITE_IOERR_WRITE':
            return 'write'
        case 'SQLITE_IOERR_FSYNC':
        case 'SQLITE_IOERR_DIR_FSYNC':
            return 'fsync'
        case 'SQLITE_IOERR_TRUNCATE':
            return 'truncate'
        case 'SQLITE_IOERR_FSTAT':
            return 'file stat'
        case 'SQLITE_IOERR_LOCK':
        case 'SQLITE_IOERR_RDLOCK':
        case 'SQLITE_IOERR_CHECKRESERVEDLOCK':
            return 'lock'
        case 'SQLITE_IOERR_UNLOCK':
            return 'unlock'
        case 'SQLITE_IOERR_DELETE':
            return 'delete'
        case 'SQLITE_IOERR_DELETE_NOENT':
            return 'file not found'
        case 'SQLITE_IOERR_ACCESS':
            return 'access'
        case 'SQLITE_IOERR_SHMOPEN':
        case 'SQLITE_IOERR_SHMLOCK':
        case 'SQLITE_IOERR_SHMMAP':
            return 'shared memory'
        case 'SQLITE_IOERR_SEEK':
            return 'seek'
        case 'SQLITE_IOERR_MMAP':
            return 'mmap'
        case 'SQLITE_IOERR_GETTEMPPATH':
        case 'SQLITE_IOERR_CONVPATH':
            return 'path'
        case 'SQLITE_IOERR_BEGIN_ATOMIC':
        case 'SQLITE_IOERR_COMMIT_ATOMIC':
        case 'SQLITE_IOERR_ROLLBACK_ATOMIC':
            return 'atomic write'
        case 'SQLITE_IOERR_CLOSE':
        case 'SQLITE_IOERR_DIR_CLOSE':
            return 'close'
        case 'SQLITE_IOERR_VNODE':
            return 'reserved extension'
        default:
            return 'unknown'
    }
}

/**
 * Gives the `SQL_DATABASE_CORRUPTED` reason of an `SQLITE_CORRUPT` code, with what is corrupted: an index, a sequence,
 * a virtual table, or the database file for any other.
 */
function getSqliteCorruptionReason(code: string, databaseErrorCode: TsSqlDatabaseErrorCode | undefined, databaseErrorMessage?: string): TsSqlErrorReason {
    switch (code) {
        case 'SQLITE_CORRUPT_INDEX':
            return { reason: 'SQL_DATABASE_CORRUPTED', corruptionType: 'index', databaseErrorCode, databaseErrorMessage }
        case 'SQLITE_CORRUPT_SEQUENCE':
            return { reason: 'SQL_DATABASE_CORRUPTED', corruptionType: 'sequence', databaseErrorCode, databaseErrorMessage }
        case 'SQLITE_CORRUPT_VTAB':
            return { reason: 'SQL_DATABASE_CORRUPTED', corruptionType: 'virtual table', databaseErrorCode, databaseErrorMessage }
        default:
            return { reason: 'SQL_DATABASE_CORRUPTED', corruptionType: 'database file', databaseErrorCode, databaseErrorMessage }
    }
}

/**
 * Gives the reason the message of the error says, for when the code doesn't decide it, or `undefined` when no known
 * text is in the message. It receives the message both upper-cased, to search in it, and as it is, to read the names.
 */
function getSqliteEngineMessageReason(upper: string, message: string, databaseErrorCode: TsSqlDatabaseErrorCode | undefined, databaseErrorMessage?: string): TsSqlErrorReason | undefined {
    if (upper.includes('CANNOT START A TRANSACTION WITHIN A TRANSACTION') || upper.includes('BEGIN INSIDE A TRANSACTION')) {
        return { reason: 'NESTED_TRANSACTION_NOT_SUPPORTED', databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('CANNOT COMMIT') && upper.includes('NO TRANSACTION IS ACTIVE')) {
        return { reason: 'NOT_IN_TRANSACTION', databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('CANNOT ROLLBACK') && upper.includes('NO TRANSACTION IS ACTIVE')) {
        return { reason: 'NOT_IN_TRANSACTION', databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('NO TRANSACTION') || upper.includes('NOT IN A TRANSACTION')) {
        return { reason: 'NOT_IN_TRANSACTION', databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('SQL STATEMENTS IN PROGRESS')) {
        return { reason: 'FORBIDDEN_CONCURRENT_USAGE', databaseErrorCode, databaseErrorMessage }
    }
    const invalidParameterReason = getSqliteInvalidParameterMessageReason(upper, message, databaseErrorCode, databaseErrorMessage)
    if (invalidParameterReason) {
        return invalidParameterReason
    }
    if (upper.includes('ON CONFLICT CLAUSE DOES NOT MATCH ANY PRIMARY KEY OR UNIQUE CONSTRAINT')) {
        return { reason: 'SQL_INVALID_SQL_STATEMENT', statementErrorType: 'invalid reference', databaseErrorCode, databaseErrorMessage }
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
    if (upper.includes('NO SUCH COLLATION SEQUENCE:')) {
        return { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'collation', objectName: extractAfterColon(message), databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('NO SUCH INDEX:')) {
        return { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'index', objectName: extractAfterColon(message), databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('NO SUCH TRIGGER:')) {
        return { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'trigger', objectName: extractAfterColon(message), databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('UNKNOWN DATABASE')) {
        return { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'database', objectName: extractUnknownDatabaseName(message), databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('TABLE ') && upper.includes(' ALREADY EXISTS')) {
        return { reason: 'SQL_OBJECT_ALREADY_EXISTS', objectType: 'table or view', objectName: extractObjectAlreadyExistsName(message), databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('VIEW ') && upper.includes(' ALREADY EXISTS')) {
        return { reason: 'SQL_OBJECT_ALREADY_EXISTS', objectType: 'table or view', objectName: extractObjectAlreadyExistsName(message), databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('INDEX ') && upper.includes(' ALREADY EXISTS')) {
        return { reason: 'SQL_OBJECT_ALREADY_EXISTS', objectType: 'index', objectName: extractObjectAlreadyExistsName(message), databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('TRIGGER ') && upper.includes(' ALREADY EXISTS')) {
        return { reason: 'SQL_OBJECT_ALREADY_EXISTS', objectType: 'trigger', objectName: extractObjectAlreadyExistsName(message), databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('CANNOT MODIFY') && upper.includes('BECAUSE IT IS A VIEW')) {
        return { reason: 'SQL_OBJECT_STATE_ERROR', objectStateErrorType: 'wrong object type', objectType: 'table or view', objectName: extractCannotModifyObjectName(message), databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('CANNOT CREATE INDEX ON VIEW') || upper.includes('VIEWS MAY NOT BE INDEXED')) {
        return { reason: 'SQL_OBJECT_STATE_ERROR', objectStateErrorType: 'wrong object type', objectType: 'table or view', objectName: extractAfterKeyword(message, 'view'), databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('AMBIGUOUS COLUMN NAME:')) {
        return {
            reason: 'SQL_AMBIGUOUS_IDENTIFIER',
            identifier: extractAfterColon(message),
            identifierType: 'column',
            identifierErrorType: 'ambiguous',
            databaseErrorCode,
            databaseErrorMessage,
        }
    }
    if (upper.includes('DUPLICATE COLUMN NAME:')) {
        return {
            reason: 'SQL_AMBIGUOUS_IDENTIFIER',
            identifier: extractAfterColon(message),
            identifierType: 'column',
            identifierErrorType: 'duplicate',
            databaseErrorCode,
            databaseErrorMessage,
        }
    }
    if (upper.includes('NEAR "') && upper.includes('SYNTAX ERROR')) {
        return { reason: 'SQL_SYNTAX_ERROR', databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('INCOMPLETE INPUT')) {
        return { reason: 'SQL_SYNTAX_ERROR', databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('UNRECOGNIZED TOKEN:')) {
        return { reason: 'SQL_SYNTAX_ERROR', databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('DATABASE IS LOCKED') || upper.includes('DATABASE TABLE IS LOCKED')) {
        return { reason: 'SQL_TIMEOUT', timeoutType: 'database file busy', databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('CANNOT VACUUM FROM WITHIN A TRANSACTION')
        || upper.includes('CANNOT CHANGE INTO WAL MODE FROM WITHIN A TRANSACTION')) {
        return { reason: 'TRANSACTION_ERROR', transactionErrorType: 'active transaction', databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('TOO MANY SQL VARIABLES') || upper.includes('VARIABLE NUMBER MUST BE BETWEEN ?1 AND ?')) {
        return { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'parameters', limit: extractSqliteLimit(message), databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('TOO MANY COLUMNS')
        || upper.includes('TOO MANY TERMS IN COMPOUND SELECT')
        || upper.includes('TOO MANY TERMS IN ORDER BY CLAUSE')
        || upper.includes('TOO MANY TERMS IN GROUP BY CLAUSE')
        || upper.includes('TOO MANY ARGUMENTS ON FUNCTION')
        || /AT MOST \d+ TABLES IN A JOIN/.test(upper)
        || upper.includes('TOO MANY FROM CLAUSE TERMS')
        || upper.includes('TOO MANY REFERENCES TO')) {
        return { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'statement elements', limit: extractSqliteLimit(message), databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('EXPRESSION TREE IS TOO LARGE') || upper.includes('PARSER STACK OVERFLOW')) {
        return { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'statement complexity', limit: extractSqliteLimit(message), databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('NO SUCH SAVEPOINT:')) {
        return { reason: 'TRANSACTION_ERROR', transactionErrorType: 'invalid savepoint', databaseErrorCode, databaseErrorMessage }
    }
    if (upper === 'INTEGER OVERFLOW') {
        return { reason: 'SQL_INVALID_VALUE', errorType: 'out of range', databaseErrorCode, databaseErrorMessage }
    }
    if (upper.startsWith('MALFORMED JSON')) {
        return { reason: 'SQL_INVALID_VALUE', errorType: 'invalid json', databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('STRING OR BLOB TOO BIG')) {
        return { reason: 'SQL_INVALID_VALUE', errorType: 'too long', databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('DATATYPE MISMATCH')) {
        return { reason: 'SQL_INVALID_VALUE', errorType: 'invalid value', databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('SUB-SELECT RETURNS') && upper.includes('COLUMNS')) {
        return { reason: 'SQL_CARDINALITY_VIOLATION', databaseErrorCode, databaseErrorMessage }
    }
    if (isSqliteRecursiveStatementError(upper)) {
        return { reason: 'SQL_INVALID_SQL_STATEMENT', statementErrorType: 'invalid recursion', databaseErrorCode, databaseErrorMessage }
    }
    if (isSqliteGroupingStatementError(upper)) {
        return { reason: 'SQL_INVALID_SQL_STATEMENT', statementErrorType: 'invalid grouping', databaseErrorCode, databaseErrorMessage }
    }
    if (isSqliteWindowingStatementError(upper)) {
        return { reason: 'SQL_INVALID_SQL_STATEMENT', statementErrorType: 'invalid windowing', databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('USER-DEFINED FUNCTION') && (upper.includes('RAISED EXCEPTION') || upper.includes('ERROR'))) {
        return { reason: 'SQL_ROUTINE_ERROR', databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('FOREIGN KEY MISMATCH')) {
        return { reason: 'SQL_INVALID_SQL_STATEMENT', statementErrorType: 'invalid definition', databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('MALFORMED DATABASE SCHEMA') || upper.includes('DATABASE DISK IMAGE IS MALFORMED')) {
        return { reason: 'SQL_DATABASE_CORRUPTED', corruptionType: 'database file', databaseErrorCode, databaseErrorMessage }
    }
    return undefined
}

/**
 * Gives the `SQL_CONSTRAINT_VIOLATED` reason of an `SQLITE_CONSTRAINT` code, with the type of constraint and the names
 * the message carries, read from the extended code or from the message; a constraint raised by a trigger gives
 * `SQL_USER_DEFINED_ERROR`.
 */
function getSqliteConstraintReason(code: string, message: string, databaseErrorCode: TsSqlDatabaseErrorCode | undefined, databaseErrorMessage?: string): TsSqlErrorReason {
    const upper = message.toUpperCase()
    if (code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || upper.includes('FOREIGN KEY CONSTRAINT FAILED')) {
        return { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'foreign key', databaseErrorCode, databaseErrorMessage }
    }
    if (code === 'SQLITE_CONSTRAINT_NOTNULL' || upper.includes('NOT NULL CONSTRAINT FAILED:')) {
        return {
            reason: 'SQL_CONSTRAINT_VIOLATED',
            constraintType: 'not null',
            tableName: extractColumnPathTableName(message),
            columnName: extractColumnPathLastSegment(message),
            databaseErrorCode,
            databaseErrorMessage,
        }
    }
    if (code === 'SQLITE_CONSTRAINT_UNIQUE' || code === 'SQLITE_CONSTRAINT_PRIMARYKEY' || code === 'SQLITE_CONSTRAINT_ROWID' || upper.includes('UNIQUE CONSTRAINT FAILED:') || upper.includes('PRIMARY KEY')) {
        return {
            reason: 'SQL_CONSTRAINT_VIOLATED',
            constraintType: 'unique',
            tableName: extractColumnPathTableName(message),
            columnName: extractColumnPathLastSegment(message),
            databaseErrorCode,
            databaseErrorMessage,
        }
    }
    if (code === 'SQLITE_CONSTRAINT_CHECK' || upper.includes('CHECK CONSTRAINT FAILED')) {
        return {
            reason: 'SQL_CONSTRAINT_VIOLATED',
            constraintType: 'check',
            constraintName: extractAfterColon(message),
            databaseErrorCode,
            databaseErrorMessage,
        }
    }
    if (code === 'SQLITE_CONSTRAINT_COMMITHOOK') {
        return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode, databaseErrorMessage }
    }
    if (code === 'SQLITE_CONSTRAINT_FUNCTION') {
        return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode, databaseErrorMessage }
    }
    if (code === 'SQLITE_CONSTRAINT_TRIGGER') {
        // RAISE(ABORT | FAIL | ROLLBACK, message) in a trigger
        return { reason: 'SQL_USER_DEFINED_ERROR', databaseErrorCode, databaseErrorMessage }
    }
    if (code === 'SQLITE_CONSTRAINT_VTAB') {
        return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode, databaseErrorMessage }
    }
    if (code === 'SQLITE_CONSTRAINT_PINNED') {
        return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode, databaseErrorMessage }
    }
    return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode, databaseErrorMessage }
}

/** Gives the text after the first colon of the message, trimmed, or `undefined` when there is none. */
function extractAfterColon(message: string): string | undefined {
    const match = /:\s*(.+)$/.exec(message)
    if (match) {
        return match[1]?.trim()
    }
    return undefined
}

/**
 * Gives the `SQL_INVALID_PARAMETER` reason the message says, about the parameters of the statement or the values bound
 * to them, or `undefined` when the message isn't one of them. It receives the message both upper-cased and as it is.
 * Besides the messages of SQLite, it knows the ones the drivers give when they bind the values.
 */
function getSqliteInvalidParameterMessageReason(
    upper: string,
    message: string,
    databaseErrorCode: TsSqlDatabaseErrorCode | undefined,
    databaseErrorMessage?: string
): TsSqlErrorReason | undefined {
    if (upper.includes('BIND OR COLUMN INDEX OUT OF RANGE')) {
        return { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid index', databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('BIND INDEX') && upper.includes('IS OUT OF RANGE')) {
        return { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid index', parameterIndex: extractBindIndex(message), databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('WRONG NUMBER OF ARGUMENTS TO FUNCTION')) {
        return { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'wrong count', databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('SQLITE QUERY EXPECTED ') && upper.includes(' VALUES, RECEIVED ')) {
        return {
            reason: 'SQL_INVALID_PARAMETER',
            parameterErrorType: 'wrong count',
            expectedParameterCount: extractExpectedParameterCount(message),
            actualParameterCount: extractActualParameterCount(message),
            databaseErrorCode,
            databaseErrorMessage,
        }
    }
    if (upper.includes('MISSING NAMED PARAMETER "') || upper.includes('MISSING PARAMETER "')) {
        return { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'missing', parameterName: extractQuotedName(message), databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('MISSING NAMED PARAMETERS') || upper.includes('TOO FEW PARAMETER VALUES WERE PROVIDED')) {
        return { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'missing', databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('TOO MANY PARAMETER VALUES WERE PROVIDED')) {
        return { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'too many', databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('DATA TYPE IS NOT SUPPORTED')
        || upper.includes('UNSUPPORTED BIND() ARGUMENT TYPE:')
        || upper.includes('SQLITE3 CAN ONLY BIND NUMBERS, STRINGS, BIGINTS, BUFFERS, AND NULL')
        || upper.includes('BINDING EXPECTED STRING, TYPEDARRAY, BOOLEAN, NUMBER, BIGINT OR NULL')
        || upper === 'EXPECTED STRING') {
        return { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid type', databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('INVALID BIND() PARAMETER NAME:')) {
        return { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid name', parameterName: extractAfterColon(message), databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('THIS STATEMENT HAS NO BINDABLE PARAMETERS')) {
        return { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'not bindable', databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('THIS STATEMENT ALREADY HAS BOUND PARAMETERS')) {
        return { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'already bound', databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('INVALID BIND() ARGUMENTS')
        || upper.includes('EXPECTED BINDINGS TO BE AN OBJECT OR ARRAY')
        || upper.includes('EXPECTED OBJECT OR ARRAY')
        || upper === 'EXPECTED ARRAY'
        || upper.includes('WHEN BINDING AN ARRAY, AN INDEX ARGUMENT IS NOT PERMITTED')
        || upper.includes('WHEN BINDING AN OBJECT, AN INDEX ARGUMENT IS NOT PERMITTED')
        || upper.includes('YOU CANNOT SPECIFY NAMED PARAMETERS IN TWO DIFFERENT OBJECTS')
        || upper.includes('NAMED PARAMETERS CAN ONLY BE PASSED WITHIN PLAIN OBJECTS')) {
        return { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid binding', databaseErrorCode, databaseErrorMessage }
    }
    return undefined
}

/** Gives the first name of the message between double quotes, or `undefined` when there is none. */
function extractQuotedName(message: string): string | undefined {
    const match = /"([^"]+)"/.exec(message)
    return match?.[1]
}

/** Gives the number after `bind index` in the message, or `undefined` when there is none. */
function extractBindIndex(message: string): number | undefined {
    const match = /bind index\s+(\d+)/i.exec(message)
    return numberValue(match?.[1])
}

/** Gives the number of values expected, from a message like "SQLite query expected 2 values, received 1". */
function extractExpectedParameterCount(message: string): number | undefined {
    const match = /sqlite query expected\s+(\d+)\s+values,\s+received\s+(\d+)/i.exec(message)
    return numberValue(match?.[1])
}

/** Gives the number of values received, from a message like "SQLite query expected 2 values, received 1". */
function extractActualParameterCount(message: string): number | undefined {
    const match = /sqlite query expected\s+(\d+)\s+values,\s+received\s+(\d+)/i.exec(message)
    return numberValue(match?.[2])
}

/** Gives the number written in the text, or `undefined` when there is no text or it isn't a finite number. */
function numberValue(value: string | undefined): number | undefined {
    if (value === undefined) {
        return undefined
    }
    const number = Number(value)
    return Number.isFinite(number) ? number : undefined
}

/** Gives the name of the missing collation, the text after the colon of the message. */
function extractSqliteMissingCollationName(message: string): string | undefined {
    return extractAfterColon(message)
}

/**
 * Gives the name of the column of a message that ends with `table.column` after a colon: the part after the last dot of
 * the first column listed, or all of it when it has no dot.
 */
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

/**
 * Gives the name of the table of a message that ends with `table.column` after a colon: the part before the last dot of
 * the first column listed, or `undefined` when it has no dot.
 */
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

/** Gives the name of the table, view, index or trigger that already exists, without the quotes around it. */
function extractObjectAlreadyExistsName(message: string): string | undefined {
    const match = /(?:table|view|index|trigger)\s+(.+?)\s+already exists/i.exec(message)
    if (match) {
        return match[1]?.replace(/^["'`[]|["'`\]]$/g, '')
    }
    return undefined
}

/** Whether the message, upper-cased, is about an aggregate function where it isn't allowed. */
function isSqliteGroupingStatementError(upper: string): boolean {
    return upper.includes('MISUSE OF AGGREGATE FUNCTION')
        || upper.includes('AGGREGATE FUNCTIONS ARE NOT ALLOWED')
        || upper.includes('AGGREGATES PROHIBITED')
}

/** Whether the message, upper-cased, is about a window function or a window definition that isn't valid. */
function isSqliteWindowingStatementError(upper: string): boolean {
    return upper.includes('MISUSE OF WINDOW FUNCTION')
        || upper.includes('WINDOW FUNCTIONS ARE NOT ALLOWED')
        || upper.includes('NO SUCH WINDOW:')
        || upper.includes('CANNOT OVERRIDE FRAME SPECIFICATION OF WINDOW')
        || upper.includes('CANNOT OVERRIDE PARTITION CLAUSE OF WINDOW')
        || upper.includes('CANNOT OVERRIDE ORDER BY CLAUSE OF WINDOW')
        || upper.includes('UNSUPPORTED FRAME SPECIFICATION')
}

/** Whether the message, upper-cased, is about a recursive query that isn't valid or a circular reference. */
function isSqliteRecursiveStatementError(upper: string): boolean {
    return upper.includes('MULTIPLE REFERENCES TO RECURSIVE TABLE')
        || upper.includes('RECURSIVE REFERENCE IN A SUBQUERY')
        || upper.includes('RECURSIVE AGGREGATE QUERIES NOT SUPPORTED')
        || upper.includes('CIRCULAR REFERENCE:')
}

/** Gives the name after `unknown database` in the message, without the quotes around it. */
function extractUnknownDatabaseName(message: string): string | undefined {
    const match = /unknown database\s+(.+)$/i.exec(message)
    if (match) {
        return trimSqliteIdentifier(match[1])
    }
    return undefined
}

/** Gives the name of the view in a message "cannot modify ... because it is a view", without the quotes around it. */
function extractCannotModifyObjectName(message: string): string | undefined {
    const match = /cannot modify\s+(.+?)\s+because it is a view/i.exec(message)
    if (match) {
        return trimSqliteIdentifier(match[1])
    }
    return undefined
}

/**
 * Gives the text after the keyword in the message, without the quotes around it, or `undefined` when the keyword isn't
 * there.
 */
function extractAfterKeyword(message: string, keyword: string): string | undefined {
    const match = new RegExp(`${keyword}\\s+(.+)$`, 'i').exec(message)
    if (match) {
        return trimSqliteIdentifier(match[1])
    }
    return undefined
}

/** Trims the name and removes the quote, backtick or bracket at its start and at its end. */
function trimSqliteIdentifier(value: string | undefined): string | undefined {
    return value?.trim().replace(/^["'`[]|["'`\]]$/g, '')
}
