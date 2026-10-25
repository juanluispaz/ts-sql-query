// sqlite3 (Sqlite3QueryRunner): the engine's primary result codes an in-memory
// database can't raise, and the errors the addon throws on its own. sqlite3
// doesn't enable extended result codes: `errno` is the primary code, `code`
// its name ('UNKNOWN' for a number the addon has no name for), and the message
// is prefixed with that name ("SQLITE_BUSY: database is locked").

import { getSqlite3ErrorReason, isSqlite3Error } from '../../../../src/queryRunners/connectorErrorMappers/Sqlite3ErrorMapper.js'
import { describeSyntheticErrors, driverError } from './syntheticErrors.js'

const addon = 'sqlite3/src/macros.h (EXCEPTION) + src/node_sqlite3.cc (sqlite_code_string)'
const statement = 'sqlite3/src/statement.cc'

describeSyntheticErrors('sqlite3', () => ({ getErrorReason: getSqlite3ErrorReason, isError: isSqlite3Error }), [
    { name: 'io-error', source: addon + ' + SQLite result codes', error: () => driverError('SQLITE_IOERR: disk I/O error', { errno: 10, code: 'SQLITE_IOERR' }), expected: { reason: 'SQL_IO_ERROR', ioErrorType: 'unknown', databaseErrorCode: 'SQLITE_IOERR', databaseErrorNumber: 10, databaseErrorMessage: 'SQLITE_IOERR: disk I/O error' } },
    { name: 'disk-full', source: addon + ' + SQLite result codes', error: () => driverError('SQLITE_FULL: database or disk is full', { errno: 13, code: 'SQLITE_FULL' }), expected: { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'disk', databaseErrorCode: 'SQLITE_FULL', databaseErrorNumber: 13 } },
    { name: 'database-busy', source: addon + ' + SQLite result codes', error: () => driverError('SQLITE_BUSY: database is locked', { errno: 5, code: 'SQLITE_BUSY' }), expected: { reason: 'SQL_TIMEOUT', timeoutType: 'database file busy', databaseErrorCode: 'SQLITE_BUSY', databaseErrorNumber: 5 } },
    { name: 'unsupported-bind-value', source: statement, error: () => driverError('Data type is not supported'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid type' } },
    { name: 'statement-finalized', source: statement, error: () => driverError('SQLITE_MISUSE: Statement is already finalized', { errno: 21, code: 'SQLITE_MISUSE' }), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'api misuse', databaseErrorCode: 'SQLITE_MISUSE', databaseErrorNumber: 21 } },
    { name: 'sql-not-a-string', source: statement, error: () => driverError('SQL query expected', {}, TypeError), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'api misuse' } },
    { name: 'result-code-without-addon-name', source: addon, error: () => driverError('UNKNOWN: warning message', { errno: 28, code: 'UNKNOWN' }), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'engine internal', databaseErrorCode: 'SQLITE_WARNING', databaseErrorNumber: 28 } },
    { name: 'result-code-unknown-to-the-mapper', source: addon, error: () => driverError('UNKNOWN: a newer SQLite condition', { errno: 29, code: 'UNKNOWN' }), expected: { reason: 'SQL_UNKNOWN', databaseErrorNumber: 29 } },
    { name: 'error-without-a-known-shape', source: 'any Error', error: () => driverError('x', { code: 'SOMETHING' }), expected: { reason: 'UNKNOWN' }, notSqlError: true },
])
