import type { TsSqlDatabaseErrorCode, TsSqlDatabaseErrorNumber, TsSqlErrorReason } from '../../TsSqlError.js'
import {
    SQLITE_ERROR_CODE_NAMES,
    SQLITE_ERROR_CODE_NUMBERS,
} from './SqliteErrorCodes.js'

export interface SqliteEngineError {
    code?: string | undefined
    databaseErrorCode?: TsSqlDatabaseErrorCode | undefined
    databaseErrorNumber?: TsSqlDatabaseErrorNumber | undefined
    message?: string | undefined
}

export function getSqliteEngineErrorReason(error: SqliteEngineError): TsSqlErrorReason {
    const databaseErrorNumber = error.databaseErrorNumber ?? getSqliteErrorCodeNumber(error.code)
    return withDatabaseErrorNumber(getSqliteEngineErrorReasonInternal(error), databaseErrorNumber)
}

function getSqliteEngineErrorReasonInternal(error: SqliteEngineError): TsSqlErrorReason {
    const code = error.code || ''
    const databaseErrorCode = error.databaseErrorCode ?? (code || undefined)
    const databaseErrorMessage = error.message || undefined
    const message = error.message || ''
    const upper = message.toUpperCase()

    if (code === 'SQLITE_CONSTRAINT_DATATYPE') {
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

export function getSqliteErrorCodeName(errorCode: number): string | undefined {
    return SQLITE_ERROR_CODE_NAMES.get(errorCode)
}

export function getSqliteErrorCodeNumber(errorCode: string | undefined): number | undefined {
    if (!errorCode) {
        return undefined
    }
    return SQLITE_ERROR_CODE_NUMBERS.get(errorCode)
}

export function getSqliteDatabaseErrorCodeFromNumeric(errorCode: number | undefined): TsSqlDatabaseErrorCode | undefined {
    if (typeof errorCode !== 'number') {
        return undefined
    }
    return getSqliteErrorCodeName(errorCode)
}

export function getSqliteDatabaseErrorNumberFromNumeric(errorCode: number | undefined): TsSqlDatabaseErrorNumber | undefined {
    return typeof errorCode === 'number' ? errorCode : undefined
}

function withDatabaseErrorNumber(reason: TsSqlErrorReason, databaseErrorNumber: TsSqlDatabaseErrorNumber | undefined): TsSqlErrorReason {
    if (databaseErrorNumber === undefined) {
        return reason
    }
    return { ...reason, databaseErrorNumber } as TsSqlErrorReason
}

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
    if (upper.includes('CANNOT CREATE INDEX ON VIEW')) {
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
    if (upper.includes('TOO MANY SQL VARIABLES')
        || upper.includes('TOO MANY COLUMNS')
        || upper.includes('TOO MANY TERMS IN COMPOUND SELECT')
        || upper.includes('TOO MANY TERMS IN ORDER BY CLAUSE')
        || upper.includes('TOO MANY TERMS IN GROUP BY CLAUSE')) {
        return { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorCode, databaseErrorMessage }
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
        return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode, databaseErrorMessage }
    }
    if (code === 'SQLITE_CONSTRAINT_VTAB') {
        return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode, databaseErrorMessage }
    }
    if (code === 'SQLITE_CONSTRAINT_PINNED') {
        return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode, databaseErrorMessage }
    }
    return { reason: 'SQL_CONSTRAINT_VIOLATED', databaseErrorCode, databaseErrorMessage }
}

function extractAfterColon(message: string): string | undefined {
    const match = /:\s*(.+)$/.exec(message)
    if (match) {
        return match[1]?.trim()
    }
    return undefined
}

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

function extractQuotedName(message: string): string | undefined {
    const match = /"([^"]+)"/.exec(message)
    return match?.[1]
}

function extractBindIndex(message: string): number | undefined {
    const match = /bind index\s+(\d+)/i.exec(message)
    return numberValue(match?.[1])
}

function extractExpectedParameterCount(message: string): number | undefined {
    const match = /sqlite query expected\s+(\d+)\s+values,\s+received\s+(\d+)/i.exec(message)
    return numberValue(match?.[1])
}

function extractActualParameterCount(message: string): number | undefined {
    const match = /sqlite query expected\s+(\d+)\s+values,\s+received\s+(\d+)/i.exec(message)
    return numberValue(match?.[2])
}

function numberValue(value: string | undefined): number | undefined {
    if (value === undefined) {
        return undefined
    }
    const number = Number(value)
    return Number.isFinite(number) ? number : undefined
}

function extractSqliteMissingCollationName(message: string): string | undefined {
    return extractAfterColon(message)
}

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

function extractObjectAlreadyExistsName(message: string): string | undefined {
    const match = /(?:table|view|index|trigger)\s+(.+?)\s+already exists/i.exec(message)
    if (match) {
        return match[1]?.replace(/^["'`[]|["'`\]]$/g, '')
    }
    return undefined
}

function isSqliteGroupingStatementError(upper: string): boolean {
    return upper.includes('MISUSE OF AGGREGATE FUNCTION')
        || upper.includes('AGGREGATE FUNCTIONS ARE NOT ALLOWED')
        || upper.includes('AGGREGATES PROHIBITED')
}

function isSqliteWindowingStatementError(upper: string): boolean {
    return upper.includes('MISUSE OF WINDOW FUNCTION')
        || upper.includes('WINDOW FUNCTIONS ARE NOT ALLOWED')
        || upper.includes('NO SUCH WINDOW:')
        || upper.includes('CANNOT OVERRIDE FRAME SPECIFICATION OF WINDOW')
        || upper.includes('CANNOT OVERRIDE PARTITION CLAUSE OF WINDOW')
        || upper.includes('CANNOT OVERRIDE ORDER BY CLAUSE OF WINDOW')
}

function isSqliteRecursiveStatementError(upper: string): boolean {
    return upper.includes('MULTIPLE REFERENCES TO RECURSIVE TABLE')
        || upper.includes('RECURSIVE REFERENCE IN A SUBQUERY')
        || upper.includes('RECURSIVE AGGREGATE QUERIES NOT SUPPORTED')
        || upper.includes('CIRCULAR REFERENCE:')
}

function extractUnknownDatabaseName(message: string): string | undefined {
    const match = /unknown database\s+(.+)$/i.exec(message)
    if (match) {
        return trimSqliteIdentifier(match[1])
    }
    return undefined
}

function extractCannotModifyObjectName(message: string): string | undefined {
    const match = /cannot modify\s+(.+?)\s+because it is a view/i.exec(message)
    if (match) {
        return trimSqliteIdentifier(match[1])
    }
    return undefined
}

function extractAfterKeyword(message: string, keyword: string): string | undefined {
    const match = new RegExp(`${keyword}\\s+(.+)$`, 'i').exec(message)
    if (match) {
        return trimSqliteIdentifier(match[1])
    }
    return undefined
}

function trimSqliteIdentifier(value: string | undefined): string | undefined {
    return value?.trim().replace(/^["'`[]|["'`\]]$/g, '')
}
