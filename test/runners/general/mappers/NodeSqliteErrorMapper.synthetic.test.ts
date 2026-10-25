// node:sqlite (NodeSqliteQueryRunner): the engine's extended result codes an
// in-memory database can't raise (ERR_SQLITE_ERROR + errcode / errstr), and the
// errors the module throws on its own, each with its Node.js error code. The
// messages are the ones Node.js 26 and Bun 1.4 throw.

import { getNodeSqliteErrorReason, isNodeSqliteError } from '../../../../src/queryRunners/connectorErrorMappers/NodeSqliteErrorMapper.js'
import { describeSyntheticErrors, driverError } from './syntheticErrors.js'

const nodeSqlite = 'node:sqlite (Node.js src/node_sqlite.cc)'
const nodeErrors = 'Node.js lib/internal/errors.js'

/** An engine error: node:sqlite enables extended result codes and copies sqlite3_errstr() to errstr. */
function engineError(message: string, errcode: number, errstr: string): Error {
    return driverError(message, { code: 'ERR_SQLITE_ERROR', errcode, errstr })
}

describeSyntheticErrors('node:sqlite', () => ({ getErrorReason: getNodeSqliteErrorReason, isError: isNodeSqliteError }), [
    { name: 'write-io-error', source: nodeSqlite + ' + SQLite result codes', error: () => engineError('disk I/O error', 778, 'disk I/O error'), expected: { reason: 'SQL_IO_ERROR', ioErrorType: 'write', databaseErrorCode: 'SQLITE_IOERR_WRITE', databaseErrorNumber: 778 } },
    { name: 'stale-snapshot', source: nodeSqlite + ' + SQLite result codes', error: () => engineError('database is locked', 517, 'database is locked'), expected: { reason: 'TRANSACTION_ERROR', transactionErrorType: 'serialization failure', databaseErrorCode: 'SQLITE_BUSY_SNAPSHOT', databaseErrorNumber: 517 } },
    { name: 'module-error-without-result-code', source: nodeSqlite, error: () => driverError('a condition node:sqlite reports without a result code', { code: 'ERR_SQLITE_ERROR' }), expected: { reason: 'SQL_UNKNOWN', databaseErrorCode: 'ERR_SQLITE_ERROR' } },
    { name: 'allocation-failure-without-message', source: nodeErrors, error: () => driverError('', { code: 'ERR_MEMORY_ALLOCATION_FAILED' }), expected: { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'memory', databaseErrorCode: 'ERR_MEMORY_ALLOCATION_FAILED' } },
    { name: 'allocation-failure', source: nodeErrors, error: () => driverError('Failed to allocate memory', { code: 'ERR_MEMORY_ALLOCATION_FAILED' }), expected: { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'memory' } },
    { name: 'statement-finalized', source: nodeSqlite, error: () => driverError('statement has been finalized', { code: 'ERR_INVALID_STATE' }), expected: { reason: 'SQL_OBJECT_STATE_ERROR', objectType: 'prepared statement', objectStateErrorType: 'invalid state', databaseErrorCode: 'ERR_INVALID_STATE' } },
    { name: 'iterator-invalidated', source: nodeSqlite, error: () => driverError('iterator was invalidated', { code: 'ERR_INVALID_STATE' }), expected: { reason: 'SQL_OBJECT_STATE_ERROR', objectType: 'cursor', objectStateErrorType: 'invalid state' } },
    { name: 'database-already-open', source: nodeSqlite, error: () => driverError('database is already open', { code: 'ERR_INVALID_STATE' }), expected: { reason: 'SQL_OBJECT_STATE_ERROR', objectType: 'database', objectStateErrorType: 'invalid state' } },
    { name: 'session-closed', source: nodeSqlite, error: () => driverError('session is not open', { code: 'ERR_INVALID_STATE' }), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'api misuse' } },
    { name: 'unknown-named-parameter', source: nodeSqlite, error: () => driverError('Unknown named parameter \'b\'', { code: 'ERR_INVALID_STATE' }), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid name', parameterName: 'b' } },
    { name: 'ambiguous-bare-named-parameter', source: nodeSqlite, error: () => driverError('Cannot create bare named parameter \'a\' because of conflicting names \':a\' and \'$a\'.', { code: 'ERR_INVALID_STATE' }), expected: { reason: 'SQL_AMBIGUOUS_IDENTIFIER', identifier: 'a', identifierType: 'parameter', identifierErrorType: 'ambiguous' } },
    { name: 'column-name-unavailable', source: nodeSqlite, error: () => driverError('Cannot get name of column 0', { code: 'ERR_INVALID_STATE' }), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'engine internal' } },
    { name: 'extension-loading-disabled', source: nodeSqlite, error: () => driverError('extension loading is not allowed', { code: 'ERR_INVALID_STATE' }), expected: { reason: 'SQL_CONFIGURATION_ERROR', configurationErrorType: 'runtime parameter' } },
    { name: 'value-not-bindable', source: nodeSqlite, error: () => driverError('Provided value cannot be bound to SQLite parameter 1.', { code: 'ERR_INVALID_ARG_TYPE' }, TypeError), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid type', parameterIndex: 1 } },
    { name: 'bigint-too-large-to-bind', source: nodeSqlite, error: () => driverError('BigInt value is too large to bind.', { code: 'ERR_INVALID_ARG_VALUE' }, TypeError), expected: { reason: 'SQL_INVALID_VALUE', errorType: 'out of range' } },
    { name: 'negative-limit-option', source: nodeSqlite, error: () => driverError('The "options.limits.length" argument must be non-negative.', { code: 'ERR_OUT_OF_RANGE' }, RangeError), expected: { reason: 'SQL_CONFIGURATION_ERROR', configurationErrorType: 'runtime parameter' } },
    { name: 'integer-beyond-safe-range-read', source: nodeSqlite, error: () => driverError('Value is too large to be represented as a JavaScript number: 9007199254740993', { code: 'ERR_OUT_OF_RANGE' }, RangeError), expected: { reason: 'PRECISION_LOST_RECEIVING_VALUE_FROM_DATABASE', value: '9007199254740993', typeName: '' } },
    { name: 'argument-out-of-range', source: nodeErrors + ' (ERR_OUT_OF_RANGE)', error: () => driverError('The value of "index" is out of range. It must be >= 1 && <= 2. Received 3', { code: 'ERR_OUT_OF_RANGE' }, RangeError), expected: { reason: 'SQL_INVALID_VALUE', errorType: 'out of range' } },
    { name: 'option-of-the-wrong-type', source: nodeSqlite, error: () => driverError('The "options.readOnly" argument must be a boolean.', { code: 'ERR_INVALID_ARG_TYPE' }, TypeError), expected: { reason: 'SQL_CONFIGURATION_ERROR', configurationErrorType: 'runtime parameter' } },
    { name: 'url-not-a-file', source: nodeSqlite, error: () => driverError('The URL must be of scheme file:', { code: 'ERR_INVALID_URL_SCHEME' }, TypeError), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration' } },
    { name: 'path-with-null-bytes', source: nodeSqlite, error: () => driverError('The "path" argument must be a string, Uint8Array, or URL without null bytes.', { code: 'ERR_INVALID_ARG_TYPE' }, TypeError), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration' } },
    { name: 'sql-not-a-string', source: nodeSqlite, error: () => driverError('The "sql" argument must be a string.', { code: 'ERR_INVALID_ARG_TYPE' }, TypeError), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'api misuse' } },
    { name: 'illegal-constructor', source: nodeSqlite, error: () => driverError('Illegal constructor', { code: 'ERR_ILLEGAL_CONSTRUCTOR' }), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'api misuse' } },
    { name: 'expanded-sql-over-limit', source: nodeSqlite, error: () => driverError('Expanded SQL text would exceed configured limits', { code: 'ERR_SQLITE_ERROR' }), expected: { reason: 'SQL_RESOURCE_LIMIT_REACHED' } },
    { name: 'statement-not-created', source: nodeSqlite, error: () => driverError('Failed to create StatementSync', { code: 'ERR_SQLITE_ERROR' }), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'engine internal' } },
    { name: 'extension-blocked-by-permission-model', source: nodeSqlite, error: () => driverError('Cannot load SQLite extensions when the permission model is enabled.', { code: 'ERR_LOAD_SQLITE_EXTENSION' }), expected: { reason: 'SQL_PERMISSION_DENIED' } },
    { name: 'extension-not-loadable', source: nodeSqlite, error: () => driverError('dlopen(/opt/ext/x.dylib, 0x000A): tried: \'/opt/ext/x.dylib\' (no such file)', { code: 'ERR_LOAD_SQLITE_EXTENSION' }), expected: { reason: 'SQL_EXTERNAL_DATA_SOURCE_ERROR' } },
    { name: 'authorizer-returned-a-non-integer', source: nodeSqlite, error: () => driverError('Authorizer callback must return an integer authorization code', {}, TypeError), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'api misuse' } },
    { name: 'error-without-a-known-shape', source: 'any Error', error: () => driverError('x', { code: 'SOMETHING' }), expected: { reason: 'UNKNOWN' }, notSqlError: true },
    // Bun's node:sqlite on a SQLite built without extension loading: the build can't load any extension
    { name: 'extension-loading-not-compiled-in', source: 'node:sqlite under Bun 1.4', error: () => driverError('the loaded SQLite library was built with SQLITE_OMIT_LOAD_EXTENSION.\nnote: on macOS, install a full SQLite (e.g. `brew install sqlite`) and call `require("bun:sqlite").Database.setCustomSQLite(path)` before opening a database.', { code: 'ERR_LOAD_SQLITE_EXTENSION' }), expected: { reason: 'SQL_FEATURE_NOT_SUPPORTED' } },
])
