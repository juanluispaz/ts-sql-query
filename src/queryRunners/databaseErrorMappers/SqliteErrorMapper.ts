import type { TsSqlDatabaseErrorCode, TsSqlErrorReason } from '../../TsSqlError.js'

export interface SqliteEngineError {
    code?: string
    databaseErrorCode?: TsSqlDatabaseErrorCode
    message?: string
}

const SQLITE_ERROR_CODE_NAMES = new Map<number, string>([
    [0, 'SQLITE_OK'],
    [1, 'SQLITE_ERROR'],
    [2, 'SQLITE_INTERNAL'],
    [3, 'SQLITE_PERM'],
    [4, 'SQLITE_ABORT'],
    [5, 'SQLITE_BUSY'],
    [6, 'SQLITE_LOCKED'],
    [7, 'SQLITE_NOMEM'],
    [8, 'SQLITE_READONLY'],
    [9, 'SQLITE_INTERRUPT'],
    [10, 'SQLITE_IOERR'],
    [11, 'SQLITE_CORRUPT'],
    [12, 'SQLITE_NOTFOUND'],
    [13, 'SQLITE_FULL'],
    [14, 'SQLITE_CANTOPEN'],
    [15, 'SQLITE_PROTOCOL'],
    [16, 'SQLITE_EMPTY'],
    [17, 'SQLITE_SCHEMA'],
    [18, 'SQLITE_TOOBIG'],
    [19, 'SQLITE_CONSTRAINT'],
    [20, 'SQLITE_MISMATCH'],
    [21, 'SQLITE_MISUSE'],
    [22, 'SQLITE_NOLFS'],
    [23, 'SQLITE_AUTH'],
    [24, 'SQLITE_FORMAT'],
    [25, 'SQLITE_RANGE'],
    [26, 'SQLITE_NOTADB'],
    [27, 'SQLITE_NOTICE'],
    [28, 'SQLITE_WARNING'],
    [100, 'SQLITE_ROW'],
    [101, 'SQLITE_DONE'],
    [256, 'SQLITE_OK_LOAD_PERMANENTLY'],
    [257, 'SQLITE_ERROR_MISSING_COLLSEQ'],
    [261, 'SQLITE_BUSY_RECOVERY'],
    [262, 'SQLITE_LOCKED_SHAREDCACHE'],
    [264, 'SQLITE_READONLY_RECOVERY'],
    [266, 'SQLITE_IOERR_READ'],
    [267, 'SQLITE_CORRUPT_VTAB'],
    [270, 'SQLITE_CANTOPEN_NOTEMPDIR'],
    [275, 'SQLITE_CONSTRAINT_CHECK'],
    [279, 'SQLITE_AUTH_USER'],
    [283, 'SQLITE_NOTICE_RECOVER_WAL'],
    [284, 'SQLITE_WARNING_AUTOINDEX'],
    [513, 'SQLITE_ERROR_RETRY'],
    [516, 'SQLITE_ABORT_ROLLBACK'],
    [517, 'SQLITE_BUSY_SNAPSHOT'],
    [518, 'SQLITE_LOCKED_VTAB'],
    [520, 'SQLITE_READONLY_CANTLOCK'],
    [522, 'SQLITE_IOERR_SHORT_READ'],
    [523, 'SQLITE_CORRUPT_SEQUENCE'],
    [526, 'SQLITE_CANTOPEN_ISDIR'],
    [531, 'SQLITE_CONSTRAINT_COMMITHOOK'],
    [539, 'SQLITE_NOTICE_RECOVER_ROLLBACK'],
    [769, 'SQLITE_ERROR_SNAPSHOT'],
    [773, 'SQLITE_BUSY_TIMEOUT'],
    [776, 'SQLITE_READONLY_ROLLBACK'],
    [778, 'SQLITE_IOERR_WRITE'],
    [779, 'SQLITE_CORRUPT_INDEX'],
    [782, 'SQLITE_CANTOPEN_FULLPATH'],
    [787, 'SQLITE_CONSTRAINT_FOREIGNKEY'],
    [1032, 'SQLITE_READONLY_DBMOVED'],
    [1034, 'SQLITE_IOERR_FSYNC'],
    [1038, 'SQLITE_CANTOPEN_CONVPATH'],
    [1043, 'SQLITE_CONSTRAINT_FUNCTION'],
    [1288, 'SQLITE_READONLY_CANTINIT'],
    [1290, 'SQLITE_IOERR_DIR_FSYNC'],
    [1294, 'SQLITE_CANTOPEN_DIRTYWAL'],
    [1299, 'SQLITE_CONSTRAINT_NOTNULL'],
    [1544, 'SQLITE_READONLY_DIRECTORY'],
    [1546, 'SQLITE_IOERR_TRUNCATE'],
    [1550, 'SQLITE_CANTOPEN_SYMLINK'],
    [1555, 'SQLITE_CONSTRAINT_PRIMARYKEY'],
    [1802, 'SQLITE_IOERR_FSTAT'],
    [1811, 'SQLITE_CONSTRAINT_TRIGGER'],
    [2058, 'SQLITE_IOERR_UNLOCK'],
    [2067, 'SQLITE_CONSTRAINT_UNIQUE'],
    [2314, 'SQLITE_IOERR_RDLOCK'],
    [2323, 'SQLITE_CONSTRAINT_VTAB'],
    [2570, 'SQLITE_IOERR_DELETE'],
    [2579, 'SQLITE_CONSTRAINT_ROWID'],
    [2826, 'SQLITE_IOERR_BLOCKED'],
    [2835, 'SQLITE_CONSTRAINT_PINNED'],
    [3082, 'SQLITE_IOERR_NOMEM'],
    [3091, 'SQLITE_CONSTRAINT_DATATYPE'],
    [3338, 'SQLITE_IOERR_ACCESS'],
    [3594, 'SQLITE_IOERR_CHECKRESERVEDLOCK'],
    [3850, 'SQLITE_IOERR_LOCK'],
    [4106, 'SQLITE_IOERR_CLOSE'],
    [4362, 'SQLITE_IOERR_DIR_CLOSE'],
    [4618, 'SQLITE_IOERR_SHMOPEN'],
    [4874, 'SQLITE_IOERR_SHMSIZE'],
    [5130, 'SQLITE_IOERR_SHMLOCK'],
    [5386, 'SQLITE_IOERR_SHMMAP'],
    [5642, 'SQLITE_IOERR_SEEK'],
    [5898, 'SQLITE_IOERR_DELETE_NOENT'],
    [6154, 'SQLITE_IOERR_MMAP'],
    [6410, 'SQLITE_IOERR_GETTEMPPATH'],
    [6666, 'SQLITE_IOERR_CONVPATH'],
    [6922, 'SQLITE_IOERR_VNODE'],
    [7178, 'SQLITE_IOERR_AUTH'],
    [7434, 'SQLITE_IOERR_BEGIN_ATOMIC'],
    [7690, 'SQLITE_IOERR_COMMIT_ATOMIC'],
    [7946, 'SQLITE_IOERR_ROLLBACK_ATOMIC'],
    [8202, 'SQLITE_IOERR_DATA'],
    [8458, 'SQLITE_IOERR_CORRUPTFS'],
])

export function getSqliteEngineErrorReason(error: SqliteEngineError): TsSqlErrorReason {
    const code = error.code || ''
    const databaseErrorCode = error.databaseErrorCode ?? (code || undefined)
    const databaseErrorMessage = error.message || undefined
    const message = error.message || ''
    const upper = message.toUpperCase()

    if (code === 'SQLITE_CONSTRAINT_DATATYPE') {
        return { reason: 'SQL_INVALID_VALUE_FOR_COLUMN', errorType: 'invalid value', columnName: extractColumnPathLastSegment(message), databaseErrorCode, databaseErrorMessage }
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
    if (code.startsWith('SQLITE_ABORT')) {
        return { reason: 'SQL_TIMEOUT', timeoutType: 'cancelled', databaseErrorCode, databaseErrorMessage }
    }
    if (code === 'SQLITE_BUSY_SNAPSHOT') {
        return { reason: 'SQL_SERIALIZATION_FAILURE', databaseErrorCode, databaseErrorMessage }
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
        return { reason: 'SQL_DIAGNOSTIC_EVENT', eventType: 'notice', databaseErrorCode, databaseErrorMessage }
    }
    if (code.startsWith('SQLITE_WARNING')) {
        return { reason: 'SQL_DIAGNOSTIC_EVENT', eventType: 'warning', databaseErrorCode, databaseErrorMessage }
    }

    switch (code) {
        case 'SQLITE_OK':
        case 'SQLITE_ROW':
        case 'SQLITE_DONE':
        case 'SQLITE_OK_LOAD_PERMANENTLY':
            return { reason: 'SQL_INTERNAL_ERROR', errorType: 'unexpected non-error result code', databaseErrorCode, databaseErrorMessage }
        case 'SQLITE_INTERNAL':
            return { reason: 'SQL_INTERNAL_ERROR', errorType: 'engine internal', databaseErrorCode, databaseErrorMessage }
        case 'SQLITE_NOTFOUND':
            return { reason: 'SQL_INTERNAL_ERROR', errorType: 'engine internal', databaseErrorCode, databaseErrorMessage }
        case 'SQLITE_EMPTY':
        case 'SQLITE_FORMAT':
            return { reason: 'SQL_INTERNAL_ERROR', errorType: 'unused result code', databaseErrorCode, databaseErrorMessage }
        case 'SQLITE_ERROR_MISSING_COLLSEQ':
            return { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'collation', objectName: extractSqliteMissingCollationName(message), databaseErrorCode, databaseErrorMessage }
        case 'SQLITE_ERROR_RETRY':
            return { reason: 'SQL_INTERNAL_ERROR', errorType: 'retry requested', databaseErrorCode, databaseErrorMessage }
        case 'SQLITE_ERROR_SNAPSHOT':
            return { reason: 'SQL_SNAPSHOT_NOT_AVAILABLE', databaseErrorCode, databaseErrorMessage }
        case 'SQLITE_TOOBIG':
            return { reason: 'SQL_INVALID_VALUE_FOR_COLUMN', errorType: 'too long', columnName: extractColumnPathLastSegment(message), databaseErrorCode, databaseErrorMessage }
        case 'SQLITE_MISMATCH':
            return { reason: 'SQL_INVALID_VALUE_FOR_COLUMN', errorType: 'invalid value', columnName: extractColumnPathLastSegment(message), databaseErrorCode, databaseErrorMessage }
        case 'SQLITE_RANGE':
            return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode, databaseErrorMessage }
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
            return { reason: 'SQL_SCHEMA_CHANGED', databaseErrorCode, databaseErrorMessage }
    }

    const reasonByMessage = getSqliteEngineMessageReason(upper, message, databaseErrorCode, databaseErrorMessage)
    if (reasonByMessage) {
        return reasonByMessage
    }

    return { reason: 'SQL_UNKNOWN', databaseErrorCode, databaseErrorMessage }
}

export function getSqliteErrorCodeName(errorCode: number): string | undefined {
    return SQLITE_ERROR_CODE_NAMES.get(errorCode)
}

export function getSqliteDatabaseErrorCodeFromNumeric(errorCode: number | undefined): TsSqlDatabaseErrorCode | undefined {
    if (typeof errorCode !== 'number') {
        return undefined
    }
    return getSqliteErrorCodeName(errorCode) || errorCode
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

function getSqliteIoErrorType(code: string): 'read' | 'write' | 'fsync' | 'truncate' | 'file stat' | 'lock' | 'unlock' | 'delete' | 'file not found' | 'access' | 'shared memory' | 'seek' | 'mmap' | 'path' | 'atomic write' | 'reserved extension' | 'unknown' {
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
    if (upper.includes('CANNOT START A TRANSACTION WITHIN A TRANSACTION')) {
        return { reason: 'NESTED_TRANSACTION_NOT_SUPPORTED', databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('CANNOT COMMIT') && upper.includes('NO TRANSACTION IS ACTIVE')) {
        return { reason: 'NOT_IN_TRANSACTION', databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('CANNOT ROLLBACK') && upper.includes('NO TRANSACTION IS ACTIVE')) {
        return { reason: 'NOT_IN_TRANSACTION', databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('SQL STATEMENTS IN PROGRESS')) {
        return { reason: 'FORBIDDEN_CONCURRENT_USAGE', databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('BIND OR COLUMN INDEX OUT OF RANGE')) {
        return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('WRONG NUMBER OF ARGUMENTS TO FUNCTION')) {
        return { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode, databaseErrorMessage }
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
    if (upper.includes('TABLE ') && upper.includes(' ALREADY EXISTS')) {
        return { reason: 'SQL_OBJECT_ALREADY_EXISTS', objectType: 'table or view', objectName: extractObjectAlreadyExistsName(message), databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('VIEW ') && upper.includes(' ALREADY EXISTS')) {
        return { reason: 'SQL_OBJECT_ALREADY_EXISTS', objectType: 'table or view', objectName: extractObjectAlreadyExistsName(message), databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('INDEX ') && upper.includes(' ALREADY EXISTS')) {
        return { reason: 'SQL_OBJECT_ALREADY_EXISTS', objectName: extractObjectAlreadyExistsName(message), databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('AMBIGUOUS COLUMN NAME:')) {
        return { reason: 'SQL_AMBIGUOUS_IDENTIFIER', identifier: extractAfterColon(message), databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('NEAR "') && upper.includes('SYNTAX ERROR')) {
        return { reason: 'SQL_SYNTAX_ERROR', databaseErrorCode, databaseErrorMessage }
    }
    if (upper.includes('INCOMPLETE INPUT')) {
        return { reason: 'SQL_SYNTAX_ERROR', databaseErrorCode, databaseErrorMessage }
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
        return { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'commit hook', databaseErrorCode, databaseErrorMessage }
    }
    if (code === 'SQLITE_CONSTRAINT_FUNCTION') {
        return { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'function', databaseErrorCode, databaseErrorMessage }
    }
    if (code === 'SQLITE_CONSTRAINT_TRIGGER') {
        return { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'trigger', databaseErrorCode, databaseErrorMessage }
    }
    if (code === 'SQLITE_CONSTRAINT_VTAB') {
        return { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'virtual table', databaseErrorCode, databaseErrorMessage }
    }
    if (code === 'SQLITE_CONSTRAINT_PINNED') {
        return { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'pinned row', databaseErrorCode, databaseErrorMessage }
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
    const match = /(?:table|view|index)\s+(.+?)\s+already exists/i.exec(message)
    if (match) {
        return match[1]?.replace(/^["'`[]|["'`\]]$/g, '')
    }
    return undefined
}
