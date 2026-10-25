// The SQLite engine mapping every SQLite connector shares, called with what a
// connector hands it: the extended result-code name (`code`), its number and
// the engine's message (sqlite3_errmsg / sqlite3_errstr). Covers the result
// codes no test can provoke on an in-memory database (I/O, corruption, busy,
// locked, full, ...) and the messages a connector forwards without a code.

import type { SqliteEngineError } from '../../../../src/queryRunners/databaseErrorMappers/SqliteErrorMapper.js'
import { getSqliteEngineErrorReason } from '../../../../src/queryRunners/databaseErrorMappers/SqliteErrorMapper.js'
import { describeSyntheticErrors } from './syntheticErrors.js'

const rescode = 'SQLite result codes (sqlite.org/rescode.html)'
const engine = 'SQLite engine message'
const betterSqlite3 = 'better-sqlite3/src/util/binder.cpp'
const wasm = '@sqlite.org/sqlite-wasm dist/index.mjs'

/** What a connector passes for an engine error: the extended code, its number and the message. */
function coded(code: string, databaseErrorNumber: number, message: string): () => SqliteEngineError {
    return () => ({ code, databaseErrorCode: code, databaseErrorNumber, message })
}

/** A message a connector forwards without a result code. */
function messageOnly(message: string): () => SqliteEngineError {
    return () => ({ message })
}

describeSyntheticErrors('SQLite engine', () => ({ getErrorReason: e => getSqliteEngineErrorReason(e as SqliteEngineError), isError: () => true }), [
    // I/O errors
    { name: 'io-read', source: rescode, error: coded('SQLITE_IOERR_READ', 266, 'disk I/O error'), expected: { reason: 'SQL_IO_ERROR', ioErrorType: 'read', databaseErrorCode: 'SQLITE_IOERR_READ', databaseErrorNumber: 266 } },
    { name: 'io-short-read', source: rescode, error: coded('SQLITE_IOERR_SHORT_READ', 522, 'disk I/O error'), expected: { reason: 'SQL_IO_ERROR', ioErrorType: 'read' } },
    { name: 'io-write', source: rescode, error: coded('SQLITE_IOERR_WRITE', 778, 'disk I/O error'), expected: { reason: 'SQL_IO_ERROR', ioErrorType: 'write' } },
    { name: 'io-fsync', source: rescode, error: coded('SQLITE_IOERR_FSYNC', 1034, 'disk I/O error'), expected: { reason: 'SQL_IO_ERROR', ioErrorType: 'fsync' } },
    { name: 'io-dir-fsync', source: rescode, error: coded('SQLITE_IOERR_DIR_FSYNC', 1290, 'disk I/O error'), expected: { reason: 'SQL_IO_ERROR', ioErrorType: 'fsync' } },
    { name: 'io-truncate', source: rescode, error: coded('SQLITE_IOERR_TRUNCATE', 1546, 'disk I/O error'), expected: { reason: 'SQL_IO_ERROR', ioErrorType: 'truncate' } },
    { name: 'io-fstat', source: rescode, error: coded('SQLITE_IOERR_FSTAT', 1802, 'disk I/O error'), expected: { reason: 'SQL_IO_ERROR', ioErrorType: 'file stat' } },
    { name: 'io-lock', source: rescode, error: coded('SQLITE_IOERR_LOCK', 3850, 'disk I/O error'), expected: { reason: 'SQL_IO_ERROR', ioErrorType: 'lock' } },
    { name: 'io-unlock', source: rescode, error: coded('SQLITE_IOERR_UNLOCK', 2058, 'disk I/O error'), expected: { reason: 'SQL_IO_ERROR', ioErrorType: 'unlock' } },
    { name: 'io-delete', source: rescode, error: coded('SQLITE_IOERR_DELETE', 2570, 'disk I/O error'), expected: { reason: 'SQL_IO_ERROR', ioErrorType: 'delete' } },
    { name: 'io-delete-noent', source: rescode, error: coded('SQLITE_IOERR_DELETE_NOENT', 5898, 'disk I/O error'), expected: { reason: 'SQL_IO_ERROR', ioErrorType: 'file not found' } },
    { name: 'io-access', source: rescode, error: coded('SQLITE_IOERR_ACCESS', 3338, 'disk I/O error'), expected: { reason: 'SQL_IO_ERROR', ioErrorType: 'access' } },
    { name: 'io-shared-memory', source: rescode, error: coded('SQLITE_IOERR_SHMOPEN', 4618, 'disk I/O error'), expected: { reason: 'SQL_IO_ERROR', ioErrorType: 'shared memory' } },
    { name: 'io-seek', source: rescode, error: coded('SQLITE_IOERR_SEEK', 5642, 'disk I/O error'), expected: { reason: 'SQL_IO_ERROR', ioErrorType: 'seek' } },
    { name: 'io-mmap', source: rescode, error: coded('SQLITE_IOERR_MMAP', 6154, 'disk I/O error'), expected: { reason: 'SQL_IO_ERROR', ioErrorType: 'mmap' } },
    { name: 'io-temp-path', source: rescode, error: coded('SQLITE_IOERR_GETTEMPPATH', 6410, 'disk I/O error'), expected: { reason: 'SQL_IO_ERROR', ioErrorType: 'path' } },
    { name: 'io-atomic-write', source: rescode, error: coded('SQLITE_IOERR_COMMIT_ATOMIC', 7690, 'disk I/O error'), expected: { reason: 'SQL_IO_ERROR', ioErrorType: 'atomic write' } },
    { name: 'io-close', source: rescode, error: coded('SQLITE_IOERR_CLOSE', 4106, 'disk I/O error'), expected: { reason: 'SQL_IO_ERROR', ioErrorType: 'close' } },
    { name: 'io-vnode', source: rescode, error: coded('SQLITE_IOERR_VNODE', 6922, 'disk I/O error'), expected: { reason: 'SQL_IO_ERROR', ioErrorType: 'reserved extension' } },
    { name: 'io-primary', source: rescode, error: coded('SQLITE_IOERR', 10, 'disk I/O error'), expected: { reason: 'SQL_IO_ERROR', ioErrorType: 'unknown' } },
    { name: 'io-out-of-memory', source: rescode, error: coded('SQLITE_IOERR_NOMEM', 3082, 'out of memory'), expected: { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'memory' } },
    { name: 'io-shm-size', source: rescode, error: coded('SQLITE_IOERR_SHMSIZE', 4874, 'disk I/O error'), expected: { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'disk' } },
    { name: 'io-checksum', source: rescode, error: coded('SQLITE_IOERR_DATA', 8202, 'disk I/O error'), expected: { reason: 'SQL_DATABASE_CORRUPTED', corruptionType: 'checksum' } },
    { name: 'io-corrupt-filesystem', source: rescode, error: coded('SQLITE_IOERR_CORRUPTFS', 8458, 'disk I/O error'), expected: { reason: 'SQL_DATABASE_CORRUPTED', corruptionType: 'filesystem' } },
    { name: 'io-auth', source: rescode, error: coded('SQLITE_IOERR_AUTH', 7178, 'disk I/O error'), expected: { reason: 'SQL_AUTHORIZATION_ERROR' } },
    // Corruption
    { name: 'corrupt', source: rescode, error: coded('SQLITE_CORRUPT', 11, 'database disk image is malformed'), expected: { reason: 'SQL_DATABASE_CORRUPTED', corruptionType: 'database file', databaseErrorNumber: 11 } },
    { name: 'corrupt-index', source: rescode, error: coded('SQLITE_CORRUPT_INDEX', 779, 'database disk image is malformed'), expected: { reason: 'SQL_DATABASE_CORRUPTED', corruptionType: 'index' } },
    { name: 'corrupt-sequence', source: rescode, error: coded('SQLITE_CORRUPT_SEQUENCE', 523, 'database disk image is malformed'), expected: { reason: 'SQL_DATABASE_CORRUPTED', corruptionType: 'sequence' } },
    { name: 'corrupt-vtab', source: rescode, error: coded('SQLITE_CORRUPT_VTAB', 267, 'database disk image is malformed'), expected: { reason: 'SQL_DATABASE_CORRUPTED', corruptionType: 'virtual table' } },
    // Abort, busy, locked
    { name: 'abort-rollback', source: rescode, error: coded('SQLITE_ABORT_ROLLBACK', 516, 'abort due to ROLLBACK'), expected: { reason: 'TRANSACTION_ERROR', transactionErrorType: 'aborted' } },
    { name: 'abort', source: rescode, error: coded('SQLITE_ABORT', 4, 'query aborted'), expected: { reason: 'SQL_TIMEOUT', timeoutType: 'cancelled' } },
    { name: 'busy-snapshot', source: rescode, error: coded('SQLITE_BUSY_SNAPSHOT', 517, 'database is locked'), expected: { reason: 'TRANSACTION_ERROR', transactionErrorType: 'serialization failure' } },
    { name: 'busy-recovery', source: rescode, error: coded('SQLITE_BUSY_RECOVERY', 261, 'database is locked'), expected: { reason: 'SQL_TIMEOUT', timeoutType: 'database file busy' } },
    { name: 'busy-timeout', source: rescode, error: coded('SQLITE_BUSY_TIMEOUT', 773, 'database is locked'), expected: { reason: 'SQL_TIMEOUT', timeoutType: 'database file busy' } },
    { name: 'locked-shared-cache', source: rescode, error: coded('SQLITE_LOCKED_SHAREDCACHE', 262, 'database table is locked'), expected: { reason: 'SQL_TIMEOUT', timeoutType: 'lock' } },
    { name: 'locked-vtab', source: rescode, error: coded('SQLITE_LOCKED_VTAB', 518, 'database table is locked'), expected: { reason: 'SQL_TIMEOUT', timeoutType: 'lock' } },
    { name: 'protocol', source: rescode, error: coded('SQLITE_PROTOCOL', 15, 'locking protocol'), expected: { reason: 'SQL_TIMEOUT', timeoutType: 'lock' } },
    // Opening the database
    { name: 'cantopen-isdir', source: rescode, error: coded('SQLITE_CANTOPEN_ISDIR', 526, 'unable to open database file'), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration' } },
    { name: 'readonly-dbmoved', source: rescode, error: coded('SQLITE_READONLY_DBMOVED', 1032, 'attempt to write a readonly database'), expected: { reason: 'SQL_READ_ONLY_VIOLATION' } },
    // Codes the engine uses internally or never returns as an error
    { name: 'notice', source: rescode, error: coded('SQLITE_NOTICE_RECOVER_WAL', 283, 'notification message'), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'engine internal' } },
    { name: 'warning', source: rescode, error: coded('SQLITE_WARNING_AUTOINDEX', 284, 'warning message'), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'engine internal' } },
    { name: 'done', source: rescode, error: coded('SQLITE_DONE', 101, 'no more rows available'), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'engine internal' } },
    { name: 'internal', source: rescode, error: coded('SQLITE_INTERNAL', 2, 'unknown error'), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'engine internal' } },
    { name: 'notfound', source: rescode, error: coded('SQLITE_NOTFOUND', 12, 'unknown operation'), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'engine internal' } },
    { name: 'empty', source: rescode, error: coded('SQLITE_EMPTY', 16, 'unknown error'), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'engine internal' } },
    { name: 'error-retry', source: rescode, error: coded('SQLITE_ERROR_RETRY', 513, 'SQL logic error'), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'engine internal' } },
    { name: 'error-snapshot', source: rescode, error: coded('SQLITE_ERROR_SNAPSHOT', 769, 'SQL logic error'), expected: { reason: 'TRANSACTION_ERROR', transactionErrorType: 'invalid state' } },
    // Misuse, interrupt, resources, access, schema
    { name: 'misuse-on-closed-database', source: 'sqlite3/src/database.cc', error: coded('SQLITE_MISUSE', 21, 'Database is closed'), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'connection lost' } },
    { name: 'misuse', source: rescode, error: coded('SQLITE_MISUSE', 21, 'bad parameter or other API misuse'), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'api misuse' } },
    { name: 'interrupt', source: rescode, error: coded('SQLITE_INTERRUPT', 9, 'interrupted'), expected: { reason: 'SQL_TIMEOUT', timeoutType: 'cancelled' } },
    { name: 'nomem', source: rescode, error: coded('SQLITE_NOMEM', 7, 'out of memory'), expected: { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'memory' } },
    { name: 'full', source: rescode, error: coded('SQLITE_FULL', 13, 'database or disk is full'), expected: { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'disk' } },
    { name: 'nolfs', source: rescode, error: coded('SQLITE_NOLFS', 22, 'large file support is disabled'), expected: { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'file size' } },
    { name: 'auth', source: rescode, error: coded('SQLITE_AUTH', 23, 'not authorized'), expected: { reason: 'SQL_AUTHORIZATION_ERROR' } },
    { name: 'perm', source: rescode, error: coded('SQLITE_PERM', 3, 'access permission denied'), expected: { reason: 'SQL_PERMISSION_DENIED' } },
    { name: 'schema', source: rescode, error: coded('SQLITE_SCHEMA', 17, 'database schema has changed'), expected: { reason: 'SQL_OBJECT_STATE_ERROR', objectType: 'schema', objectStateErrorType: 'invalid state' } },
    // Constraint sub-codes without a constraint type
    { name: 'constraint-commithook', source: rescode, error: coded('SQLITE_CONSTRAINT_COMMITHOOK', 531, 'constraint failed'), expected: { reason: 'SQL_CONSTRAINT_VIOLATED' } },
    { name: 'constraint-function', source: rescode, error: coded('SQLITE_CONSTRAINT_FUNCTION', 1043, 'constraint failed'), expected: { reason: 'SQL_CONSTRAINT_VIOLATED' } },
    { name: 'constraint-vtab', source: rescode, error: coded('SQLITE_CONSTRAINT_VTAB', 2323, 'constraint failed'), expected: { reason: 'SQL_CONSTRAINT_VIOLATED' } },
    { name: 'constraint-pinned', source: rescode, error: coded('SQLITE_CONSTRAINT_PINNED', 2835, 'constraint failed'), expected: { reason: 'SQL_CONSTRAINT_VIOLATED' } },
    // Messages
    { name: 'no-transaction', source: engine + ' (without the commit / rollback verb)', error: messageOnly('no transaction is active'), expected: { reason: 'NOT_IN_TRANSACTION' } },
    { name: 'statements-in-progress', source: engine, error: coded('SQLITE_ERROR', 1, 'cannot VACUUM - SQL statements in progress'), expected: { reason: 'FORBIDDEN_CONCURRENT_USAGE' } },
    { name: 'table-locked-without-code', source: engine, error: messageOnly('database table is locked: t'), expected: { reason: 'SQL_TIMEOUT', timeoutType: 'database file busy' } },
    { name: 'too-many-variables', source: engine, error: coded('SQLITE_ERROR', 1, 'too many SQL variables'), expected: { reason: 'SQL_RESOURCE_LIMIT_REACHED' } },
    { name: 'too-big-without-code', source: engine, error: messageOnly('string or blob too big'), expected: { reason: 'SQL_INVALID_VALUE', errorType: 'too long' } },
    { name: 'datatype-mismatch-without-code', source: engine, error: messageOnly('datatype mismatch'), expected: { reason: 'SQL_INVALID_VALUE', errorType: 'invalid value' } },
    { name: 'user-defined-function-error', source: engine, error: coded('SQLITE_ERROR', 1, 'user-defined function raised exception'), expected: { reason: 'SQL_ROUTINE_ERROR' } },
    { name: 'malformed-schema', source: engine, error: coded('SQLITE_ERROR', 1, 'malformed database schema (t)'), expected: { reason: 'SQL_DATABASE_CORRUPTED', corruptionType: 'database file' } },
    { name: 'bind-or-column-index-out-of-range', source: 'sqlite3_errstr(SQLITE_RANGE) in older SQLite releases', error: messageOnly('bind or column index out of range'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid index' } },
    { name: 'bind-index-out-of-range', source: wasm, error: messageOnly('Bind index 3 is out of range.'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid index', parameterIndex: 3 } },
    { name: 'missing-named-parameter', source: betterSqlite3, error: messageOnly('Missing named parameter "a"'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'missing', parameterName: 'a' } },
    { name: 'unbindable-type', source: betterSqlite3, error: messageOnly('SQLite3 can only bind numbers, strings, bigints, buffers, and null'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid type' } },
    { name: 'invalid-parameter-name', source: wasm, error: messageOnly('Invalid bind() parameter name: $x'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid name', parameterName: '$x' } },
    { name: 'no-bindable-parameters', source: wasm, error: messageOnly('This statement has no bindable parameters.'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'not bindable' } },
    { name: 'already-bound', source: betterSqlite3, error: messageOnly('This statement already has bound parameters'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'already bound' } },
    { name: 'named-parameters-in-two-objects', source: betterSqlite3, error: messageOnly('You cannot specify named parameters in two different objects'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid binding' } },
    // Fallbacks
    { name: 'sql-error-with-an-unknown-message', source: rescode, error: coded('SQLITE_ERROR', 1, 'a message the mapper has no pattern for'), expected: { reason: 'SQL_INVALID_SQL_STATEMENT', databaseErrorCode: 'SQLITE_ERROR', databaseErrorNumber: 1 } },
    { name: 'unknown-message-without-code', source: engine, error: messageOnly('a message the mapper has no pattern for'), expected: { reason: 'SQL_UNKNOWN' } },
])
