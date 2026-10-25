// bun:sqlite (BunSqliteQueryRunner): the engine's extended result codes an
// in-memory database can't raise, and the errors bun:sqlite throws on its own.
// bun:sqlite's SQLiteError can't be constructed from JavaScript; its
// `instanceof` checks `name === 'SQLiteError'`, so an Error carrying that name
// and the fields bun:sqlite sets (code, errno, byteOffset) is one. Bun only.

import type { SyntheticErrorMapper } from './syntheticErrors.js'
import { TEST_RUNTIME } from '../../../lib/testRunner.js'
import { describeSyntheticErrors, driverError } from './syntheticErrors.js'

const bunSqlite = 'bun:sqlite (Bun 1.4)'

async function loadMapper(): Promise<SyntheticErrorMapper> {
    const { getBunSqliteErrorReason, isBunSqliteError } = await import('../../../../src/queryRunners/connectorErrorMappers/BunSqliteErrorMapper.js')
    return { getErrorReason: getBunSqliteErrorReason, isError: isBunSqliteError }
}

/** An engine error: bun:sqlite enables extended result codes; errno is the extended number. */
function sqliteError(message: string, code: string, errno?: number): Error {
    return driverError(message, { name: 'SQLiteError', code, ...(errno === undefined ? {} : { errno }), byteOffset: -1 })
}

describeSyntheticErrors('bun:sqlite', loadMapper, [
    { name: 'write-io-error', source: bunSqlite + ' + SQLite result codes', error: () => sqliteError('disk I/O error', 'SQLITE_IOERR_WRITE', 778), expected: { reason: 'SQL_IO_ERROR', ioErrorType: 'write', databaseErrorCode: 'SQLITE_IOERR_WRITE', databaseErrorNumber: 778 } },
    { name: 'stale-snapshot', source: bunSqlite + ' + SQLite result codes', error: () => sqliteError('database is locked', 'SQLITE_BUSY_SNAPSHOT', 517), expected: { reason: 'TRANSACTION_ERROR', transactionErrorType: 'serialization failure', databaseErrorCode: 'SQLITE_BUSY_SNAPSHOT', databaseErrorNumber: 517 } },
    { name: 'engine-error-without-errno', source: bunSqlite + ' + SQLite result codes', error: () => sqliteError('database or disk is full', 'SQLITE_FULL'), expected: { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'disk', databaseErrorCode: 'SQLITE_FULL', databaseErrorNumber: 13 } },
    { name: 'read-only-anonymous-database', source: bunSqlite, error: () => driverError('Cannot open an anonymous database in read-only mode.'), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration' } },
    { name: 'misspelled-readonly-option', source: bunSqlite, error: () => driverError('Misspelled option "readOnly" should be "readonly"', {}, TypeError), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration' } },
    { name: 'filename-not-a-string', source: bunSqlite, error: () => driverError('Expected \'filename\' to be a string, got \'number\'', {}, TypeError), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration' } },
    { name: 'database-locked-without-code', source: bunSqlite + ' (message only)', error: () => driverError('database is locked'), expected: { reason: 'SQL_TIMEOUT', timeoutType: 'database file busy' } },
    { name: 'statement-finalized', source: bunSqlite, error: () => driverError('Statement has finalized'), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'api misuse' } },
    { name: 'invalid-database-handle', source: bunSqlite, error: () => driverError('Invalid database handle'), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'api misuse' } },
    { name: 'empty-query', source: bunSqlite, error: () => driverError('SQL query cannot be empty.'), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'api misuse' } },
    { name: 'missing-named-parameter', source: bunSqlite + ' (strict mode)', error: () => driverError('Missing parameter "a"'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'missing', parameterName: 'a' } },
    { name: 'bindings-not-an-object-or-array', source: bunSqlite, error: () => driverError('Expected bindings to be an object or array', {}, TypeError), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid binding' } },
    { name: 'expected-object-or-array', source: bunSqlite, error: () => driverError('Expected object or array', {}, TypeError), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid binding' } },
    { name: 'expected-array', source: bunSqlite, error: () => driverError('Expected array', {}, TypeError), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid binding' } },
    { name: 'unbindable-value', source: bunSqlite, error: () => driverError('Binding expected string, TypedArray, boolean, number, bigint or null', {}, TypeError), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid type' } },
    { name: 'expected-string', source: bunSqlite, error: () => driverError('Expected string', {}, TypeError), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid type' } },
    { name: 'bigint-out-of-range', source: bunSqlite, error: () => driverError('BigInt value 18446744073709551616 is out of range', {}, RangeError), expected: { reason: 'SQL_INVALID_VALUE', errorType: 'out of range' } },
    { name: 'out-of-memory', source: 'Bun ERR_MEMORY_ALLOCATION_FAILED', error: () => driverError('Out of memory', {}, RangeError), expected: { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'memory' } },
    { name: 'error-without-a-known-shape', source: 'any Error', error: () => driverError('x', { code: 'SOMETHING' }), expected: { reason: 'UNKNOWN' }, notSqlError: true },
    // db.prepare(1): a misuse of bun:sqlite's own API
    { name: 'sql-not-a-string', source: bunSqlite, error: () => driverError('Expected SQL string'), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'api misuse' } },
], TEST_RUNTIME === 'bun')
