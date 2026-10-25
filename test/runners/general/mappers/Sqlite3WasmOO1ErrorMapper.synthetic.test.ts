// @sqlite.org/sqlite-wasm OO1 (Sqlite3WasmOO1QueryRunner): the engine's extended
// result codes an in-memory database can't raise, and the errors the OO1 API
// throws on its own. Both are SQLite3Error: an engine error carries its result
// code and a "SQLITE_X: sqlite3 result code N: <errmsg>" message (the OO1 DB
// enables extended result codes); one the API raises by itself carries
// SQLITE_ERROR (1) and just its message.

import { getSqlite3WasmOO1ErrorReason, isSqlite3WasmOO1Error } from '../../../../src/queryRunners/connectorErrorMappers/Sqlite3WasmOO1ErrorMapper.js'
import { describeSyntheticErrors, driverError } from './syntheticErrors.js'

const wasm = '@sqlite.org/sqlite-wasm dist/index.mjs'

/** The SQLite3Error checkSqlite3Rc() throws for a failed engine call. */
function engineError(codeName: string, resultCode: number, errmsg: string): Error {
    return driverError(codeName + ': sqlite3 result code ' + resultCode + ': ' + errmsg, { name: 'SQLite3Error', resultCode })
}

/** The SQLite3Error toss3() throws for a misuse the OO1 API detects itself. */
function apiError(message: string): Error {
    return driverError(message, { name: 'SQLite3Error', resultCode: 1 })
}

describeSyntheticErrors('sqlite-wasm OO1', () => ({ getErrorReason: getSqlite3WasmOO1ErrorReason, isError: isSqlite3WasmOO1Error }), [
    { name: 'write-io-error', source: wasm + ' (checkSqlite3Rc) + SQLite result codes', error: () => engineError('SQLITE_IOERR_WRITE', 778, 'disk I/O error'), expected: { reason: 'SQL_IO_ERROR', ioErrorType: 'write', databaseErrorCode: 'SQLITE_IOERR_WRITE', databaseErrorNumber: 778 } },
    { name: 'extended-code-unknown-to-the-mapper', source: wasm + ' (checkSqlite3Rc) + SQLite result codes', error: () => engineError('SQLITE_IOERR_IN_PAGE', 8714, 'disk I/O error'), expected: { reason: 'SQL_IO_ERROR', ioErrorType: 'unknown', databaseErrorCode: 'SQLITE_IOERR', databaseErrorNumber: 8714 } },
    { name: 'statement-locked', source: wasm + ' (affirmNotLockedByExec)', error: () => apiError('Operation is illegal when statement is locked: bind()'), expected: { reason: 'FORBIDDEN_CONCURRENT_USAGE', databaseErrorCode: 'SQLITE_ERROR', databaseErrorNumber: 1 } },
    { name: 'invalid-parameter-name', source: wasm + ' (affirmParamIndex)', error: () => apiError('Invalid bind() parameter name: $x'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid name', parameterName: '$x' } },
    { name: 'statement-without-parameters', source: wasm + ' (Stmt.bind)', error: () => apiError('This statement has no bindable parameters.'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'not bindable' } },
    { name: 'invalid-bind-arguments', source: wasm + ' (Stmt.bind)', error: () => apiError('Invalid bind() arguments.'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid binding' } },
    { name: 'unsupported-bind-type', source: wasm + ' (bindOne)', error: () => apiError('Unsupported bind() argument type: symbol'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid type' } },
    { name: 'bind-index-out-of-range', source: wasm + ' (affirmParamIndex)', error: () => apiError('Bind index 3 is out of range.'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid index', parameterIndex: 3 } },
    { name: 'index-with-array-binding', source: wasm + ' (Stmt.bind)', error: () => apiError('When binding an array, an index argument is not permitted.'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid binding' } },
    { name: 'index-with-object-binding', source: wasm + ' (Stmt.bind)', error: () => apiError('When binding an object, an index argument is not permitted.'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid binding' } },
    { name: 'bigint-too-big-to-bind', source: wasm + ' (bindOne)', error: () => apiError('BigInt value is too big to store without precision loss: 18446744073709551616'), expected: { reason: 'SQL_INVALID_VALUE', errorType: 'out of range' } },
    { name: 'exec-without-sql', source: wasm + ' (DB.exec)', error: () => apiError('exec() requires an SQL string.'), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'api misuse' } },
    { name: 'error-without-a-known-shape', source: 'any Error', error: () => driverError('x', { code: 'SOMETHING' }), expected: { reason: 'UNKNOWN' }, notSqlError: true },
    // Reading an integer column beyond the safe integer range (a build without BigInt support): the
    // value the database holds can't reach JavaScript without losing precision
    { name: 'integer-beyond-safe-range-read', source: wasm + ' (__stmtGetColumn)', error: () => apiError('Integer is out of range for JS integer range: 9007199254740994'), expected: { reason: 'PRECISION_LOST_RECEIVING_VALUE_FROM_DATABASE' } },
])
