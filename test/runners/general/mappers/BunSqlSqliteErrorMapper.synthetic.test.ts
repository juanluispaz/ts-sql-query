// Bun SQL's sqlite adapter (BunSqlSqliteQueryRunner): the engine's extended
// result codes an in-memory database can't raise, and the errors the adapter
// raises on its own. Engine errors and the adapter's own coded ones are
// SQL.SQLiteError (`code` + `errno`, errno 0 for the adapter's ERR_SQLITE_*
// codes); the rest are plain Errors. Bun only.

import type { SyntheticErrorMapper } from './syntheticErrors.js'
import { TEST_RUNTIME } from '../../../lib/testRunner.js'
import { describeSyntheticErrors, driverError } from './syntheticErrors.js'

const adapter = 'Bun SQL sqlite adapter (Bun 1.4)'

interface BunSqlErrorClasses {
    SQLiteError: new (message: string, options: { code: string, errno: number }) => Error
    SQLError: new (message: string) => Error
}

let classes: BunSqlErrorClasses | undefined

async function loadMapper(): Promise<SyntheticErrorMapper> {
    const { getBunSqlSqliteErrorReason, isBunSqlSqliteError } = await import('../../../../src/queryRunners/connectorErrorMappers/BunSqlSqliteErrorMapper.js')
    const { SQL } = await import('bun')
    classes = SQL as unknown as BunSqlErrorClasses
    return { getErrorReason: getBunSqlSqliteErrorReason, isError: isBunSqlSqliteError }
}

function sqliteError(message: string, code: string, errno: number): Error {
    return new classes!.SQLiteError(message, { code, errno })
}

describeSyntheticErrors('Bun SQL sqlite', loadMapper, [
    { name: 'write-io-error', source: adapter + ' (toSQLiteError) + SQLite result codes', error: () => sqliteError('disk I/O error', 'SQLITE_IOERR_WRITE', 778), expected: { reason: 'SQL_IO_ERROR', ioErrorType: 'write', databaseErrorCode: 'SQLITE_IOERR_WRITE', databaseErrorNumber: 778 } },
    { name: 'database-busy', source: adapter + ' (toSQLiteError) + SQLite result codes', error: () => sqliteError('database is locked', 'SQLITE_BUSY', 5), expected: { reason: 'SQL_TIMEOUT', timeoutType: 'database file busy', databaseErrorCode: 'SQLITE_BUSY', databaseErrorNumber: 5 } },
    { name: 'query-cancelled', source: adapter + ' (queryCancelledError)', error: () => sqliteError('Query cancelled', 'ERR_SQLITE_QUERY_CANCELLED', 0), expected: { reason: 'SQL_TIMEOUT', timeoutType: 'cancelled', databaseErrorCode: 'ERR_SQLITE_QUERY_CANCELLED' } },
    { name: 'not-a-tagged-call', source: adapter + ' (notTaggedCallError)', error: () => sqliteError('Query not called as a tagged template literal', 'ERR_SQLITE_NOT_TAGGED_CALL', 0), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid binding', databaseErrorCode: 'ERR_SQLITE_NOT_TAGGED_CALL' } },
    { name: 'adapter-code-unknown-to-the-mapper', source: adapter + ' (error)', error: () => sqliteError('a condition the adapter reports with its own code', 'ERR_SQLITE_SOMETHING_NEW', 0), expected: { reason: 'SQL_UNKNOWN', databaseErrorCode: 'ERR_SQLITE_SOMETHING_NEW' } },
    { name: 'generic-sql-error', source: 'Bun SQL (SQL.SQLError)', error: () => new classes!.SQLError('an error of the SQL client'), expected: { reason: 'SQL_UNKNOWN' } },
    { name: 'connection-closed-without-code', source: adapter + ' (message only)', error: () => driverError('Connection closed'), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'connection lost' } },
    { name: 'reserve-not-supported', source: adapter, error: () => driverError('This adapter doesn\'t support connection reservation'), expected: { reason: 'SQL_FEATURE_NOT_SUPPORTED' } },
    { name: 'transaction-mode-not-supported', source: adapter, error: () => driverError('SQLite doesn\'t support \'READ WRITE\' transaction mode. Use DEFERRED, IMMEDIATE, or EXCLUSIVE.'), expected: { reason: 'SQL_FEATURE_NOT_SUPPORTED' } },
    { name: 'error-without-a-known-shape', source: 'any Error', error: () => driverError('x', { code: 'SOMETHING' }), expected: { reason: 'UNKNOWN' }, notSqlError: true },
    // A query on a transaction or savepoint scope that already ended
    { name: 'transaction-already-ended', source: adapter + ' (invalidTransactionStateError)', error: () => sqliteError('cannot run a query after its transaction or savepoint ended', 'ERR_SQLITE_INVALID_TRANSACTION_STATE', 0), expected: { reason: 'TRANSACTION_ERROR', transactionErrorType: 'invalid state', databaseErrorCode: 'ERR_SQLITE_INVALID_TRANSACTION_STATE' } },
], TEST_RUNTIME === 'bun')
