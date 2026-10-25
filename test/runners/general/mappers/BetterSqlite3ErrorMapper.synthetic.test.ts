// better-sqlite3 (BetterSqlite3QueryRunner): the engine's extended result codes
// an in-memory database can't raise, carried by the package's SqliteError, and
// the plain Error / TypeError / RangeError the addon throws on its own.

import BetterSqlite3 from 'better-sqlite3'
import { getBetterSqlite3ErrorReason, isBetterSqlite3Error } from '../../../../src/queryRunners/connectorErrorMappers/BetterSqlite3ErrorMapper.js'
import { describeSyntheticErrors, driverError } from './syntheticErrors.js'

const sqliteErrorClass = 'better-sqlite3/lib/sqlite-error.js'
const database = 'better-sqlite3/lib/database.js'
const macros = 'better-sqlite3/src/util/macros.cpp'
const binder = 'better-sqlite3/src/util/binder.cpp'
const dataConverter = 'better-sqlite3/src/util/data-converter.cpp'

/** better-sqlite3 enables extended result codes: `code` is the extended name, no errno. */
function sqliteError(message: string, code: string): Error {
    return new BetterSqlite3.SqliteError(message, code)
}

/** A stack whose frames come from the package, as the addon's argument checks leave it. */
const betterSqlite3Stack = 'TypeError: Expected first argument to be a string\n    at Database.prepare (/app/node_modules/better-sqlite3/lib/methods/wrappers.js:5:21)'

describeSyntheticErrors('better-sqlite3', () => ({ getErrorReason: getBetterSqlite3ErrorReason, isError: isBetterSqlite3Error }), [
    { name: 'write-io-error', source: sqliteErrorClass + ' + SQLite result codes', error: () => sqliteError('disk I/O error', 'SQLITE_IOERR_WRITE'), expected: { reason: 'SQL_IO_ERROR', ioErrorType: 'write', databaseErrorCode: 'SQLITE_IOERR_WRITE', databaseErrorNumber: 778 } },
    { name: 'database-busy', source: sqliteErrorClass + ' + SQLite result codes', error: () => sqliteError('database is locked', 'SQLITE_BUSY'), expected: { reason: 'SQL_TIMEOUT', timeoutType: 'database file busy', databaseErrorCode: 'SQLITE_BUSY', databaseErrorNumber: 5 } },
    { name: 'corrupted-index', source: sqliteErrorClass + ' + SQLite result codes', error: () => sqliteError('database disk image is malformed', 'SQLITE_CORRUPT_INDEX'), expected: { reason: 'SQL_DATABASE_CORRUPTED', corruptionType: 'index', databaseErrorCode: 'SQLITE_CORRUPT_INDEX', databaseErrorNumber: 779 } },
    { name: 'directory-does-not-exist', source: database, error: () => driverError('Cannot open database because the directory does not exist', {}, TypeError), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration' } },
    { name: 'connection-busy', source: macros, error: () => driverError('This database connection is busy executing a query', {}, TypeError), expected: { reason: 'FORBIDDEN_CONCURRENT_USAGE' } },
    { name: 'bound-value-too-big', source: binder, error: () => driverError('The bound string, buffer, or bigint is too big', {}, RangeError), expected: { reason: 'SQL_INVALID_VALUE', errorType: 'too long' } },
    { name: 'function-returned-too-big-bigint', source: dataConverter, error: () => driverError('User-defined function f() returned a bigint that was too big', {}, RangeError), expected: { reason: 'SQL_INVALID_VALUE', errorType: 'out of range' } },
    { name: 'function-returned-invalid-value', source: dataConverter, error: () => driverError('User-defined function f() returned an invalid value', {}, TypeError), expected: { reason: 'SQL_INVALID_VALUE', errorType: 'invalid value' } },
    { name: 'out-of-memory', source: binder, error: () => driverError('Out of memory'), expected: { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'memory' } },
    { name: 'too-many-iterators', source: 'better-sqlite3/src/util/query-macros.cpp', error: () => driverError('Too many active database iterators', {}, RangeError), expected: { reason: 'SQL_RESOURCE_LIMIT_REACHED' } },
    { name: 'sql-without-statements', source: 'better-sqlite3/src/objects/statement.cpp', error: () => driverError('The supplied SQL string contains no statements', {}, RangeError), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'api misuse' } },
    { name: 'argument-check-from-the-package', source: macros, error: () => driverError('Expected first argument to be a string', { stack: betterSqlite3Stack }, TypeError), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'api misuse' } },
    { name: 'argument-check-from-elsewhere', source: 'any TypeError', error: () => driverError('Expected first argument to be a string', { stack: 'TypeError: Expected first argument to be a string\n    at main (/app/src/index.js:1:1)' }, TypeError), expected: { reason: 'UNKNOWN' }, notSqlError: true },
    { name: 'unexpected-bind-failure', source: binder, error: () => driverError('An unexpected error occured while trying to bind parameters'), expected: { reason: 'SQL_UNKNOWN' } },
    { name: 'error-without-a-known-shape', source: 'any Error', error: () => driverError('x', { code: 'SOMETHING' }), expected: { reason: 'UNKNOWN' }, notSqlError: true },
])
