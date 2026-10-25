// mssql (MssqlPoolQueryRunner, MssqlPoolPromiseQueryRunner): the errors
// mssql, tedious and tarn raise on their own (connection, pool, transaction
// state, prepared statements, invalid arguments, timeouts), and a server
// error reaching a transaction through the tedious error it wraps.

import mssqlModule from 'mssql'
import { TimeoutError } from 'tarn'
import { getMssqlErrorReason, isMssqlError } from '../../../../src/queryRunners/connectorErrorMappers/MssqlErrorMapper.js'
import { describeSyntheticErrors, driverError } from './syntheticErrors.js'

// mssql is CommonJS: its classes take an Error to wrap (copying its code,
// keeping it as originalError) or a message, and a code of their own.
type MssqlErrorClass = new (message: Error | string, code?: string) => Error
const mssql = ((mssqlModule as any).default ?? mssqlModule) as Record<'ConnectionError' | 'MSSQLError' | 'PreparedStatementError' | 'RequestError' | 'TransactionError', MssqlErrorClass>
const { ConnectionError, MSSQLError, PreparedStatementError, RequestError, TransactionError } = mssql

const baseTransaction = 'mssql/lib/base/transaction.js'
const baseRequest = 'mssql/lib/base/request.js'
const basePreparedStatement = 'mssql/lib/base/prepared-statement.js'
const basePool = 'mssql/lib/base/connection-pool.js'
const tediousRequest = 'mssql/lib/tedious/request.js'
const tediousPool = 'mssql/lib/tedious/connection-pool.js'
const tediousTransaction = 'mssql/lib/tedious/transaction.js'
const msnodesqlv8Request = 'mssql/lib/msnodesqlv8/request.js'
const tediousConnection = 'tedious/lib/connection.js'

// tedious' ConnectionError and RequestError are plain Errors carrying a code.
function tediousError(message: string, code?: string): Error {
    return driverError(message, code === undefined ? {} : { code })
}

// A server error as tedious' token handler builds it (code EREQUEST plus the
// fields of the server's ERROR token).
function tediousServerError(number: number, message: string): Error {
    return driverError(message, { code: 'EREQUEST', number, state: 1, class: 16, serverName: 'db', procName: '', lineNumber: 1 })
}

const notBegun = 'Transaction has not begun. Call begin() first.'
const sentClientRequest = 'Requests can only be made in the LoggedIn state, not the SentClientRequest state'

describeSyntheticErrors('mssql', () => ({ getErrorReason: getMssqlErrorReason, isError: isMssqlError }), [
    { name: 'pool-acquire-timeout', source: 'tarn/dist/PendingOperation.js', error: () => new TimeoutError('operation timed out for an unknown reason'), expected: { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'pool', databaseErrorCode: 'TimeoutError' } },

    { name: 'transaction-not-begun', source: baseTransaction, error: () => new TransactionError(notBegun, 'ENOTBEGUN'), expected: { reason: 'NOT_IN_TRANSACTION', databaseErrorCode: 'ENOTBEGUN', databaseErrorMessage: notBegun } },
    { name: 'transaction-aborted-by-the-server', source: baseTransaction, error: () => Object.defineProperty(new TransactionError('Transaction has been aborted.', 'EABORT'), 'originalError', { enumerable: true, value: new Error('Transaction was rolled back by the server') }), expected: { reason: 'TRANSACTION_ERROR', transactionErrorType: 'aborted', databaseErrorCode: 'EABORT' } },
    { name: 'transaction-already-begun', source: baseTransaction, error: () => new TransactionError('Transaction has already begun.', 'EALREADYBEGUN'), expected: { reason: 'NESTED_TRANSACTION_NOT_SUPPORTED', databaseErrorCode: 'EALREADYBEGUN' } },
    { name: 'transaction-commit-while-a-request-runs', source: baseTransaction, error: () => new TransactionError('Can\'t commit transaction. There is a request in progress.', 'EREQINPROG'), expected: { reason: 'FORBIDDEN_CONCURRENT_USAGE', databaseErrorCode: 'EREQINPROG' } },
    { name: 'transaction-begin-cancelled', source: tediousTransaction, error: () => new TransactionError(tediousError('Canceled.', 'ECANCEL')), expected: { reason: 'SQL_TIMEOUT', timeoutType: 'cancelled', databaseErrorCode: 'ECANCEL' } },
    { name: 'transaction-commit-timeout', source: tediousTransaction, error: () => new TransactionError(tediousError('Timeout: Request failed to complete in 15000ms', 'ETIMEOUT')), expected: { reason: 'SQL_TIMEOUT', timeoutType: 'transaction', databaseErrorCode: 'ETIMEOUT' } },
    { name: 'transaction-on-a-closed-connection', source: tediousTransaction, error: () => new TransactionError(tediousError('Connection is closed.', 'ECONNCLOSED')), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'pool error', databaseErrorCode: 'ECONNCLOSED' } },
    { name: 'transaction-connection-closed-before-commit', source: tediousTransaction, error: () => new TransactionError(tediousError('Connection closed before request completed.', 'ECLOSE')), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'connection lost', databaseErrorCode: 'ECLOSE' } },
    { name: 'transaction-login-failed', source: tediousTransaction, error: () => new TransactionError(tediousError('Login failed for user \'app\'.', 'ELOGIN')), expected: { reason: 'SQL_AUTHENTICATION_ERROR', databaseErrorCode: 'ELOGIN' } },
    { name: 'transaction-server-requires-encryption', source: tediousTransaction, error: () => new TransactionError(tediousError('Server requires encryption, set \'encrypt\' config option to true.', 'EENCRYPT')), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration', databaseErrorCode: 'EENCRYPT' } },
    { name: 'transaction-unknown-tds-version', source: tediousTransaction, error: () => new TransactionError(tediousError('Server responded with unknown TDS version.', 'ETDS')), expected: { reason: 'SQL_FEATURE_NOT_SUPPORTED', databaseErrorCode: 'ETDS' } },
    { name: 'transaction-invalid-isolation-level', source: baseTransaction, error: () => new TransactionError('Invalid isolation level.'), expected: { reason: 'TRANSACTION_LEVEL_NOT_SUPPORTED', databaseErrorMessage: 'Invalid isolation level.' } },
    { name: 'transaction-without-a-connection', source: baseTransaction, error: () => new TransactionError('No connection is specified for that transaction.', 'ENOCONN'), expected: { reason: 'TRANSACTION_ERROR', transactionErrorType: 'invalid state', databaseErrorCode: 'ENOCONN' } },
    { name: 'transaction-server-error', source: tediousTransaction + ', tedious/lib/token/handler.js', error: () => new TransactionError(tediousServerError(3902, 'The COMMIT TRANSACTION request has no corresponding BEGIN TRANSACTION.')), expected: { reason: 'NOT_IN_TRANSACTION', databaseErrorCode: 'EREQUEST', databaseErrorNumber: 3902 } },

    { name: 'connect-timeout', source: tediousConnection, error: () => new ConnectionError(tediousError('Failed to connect to db:1433 in 15000ms', 'ETIMEOUT')), expected: { reason: 'SQL_TIMEOUT', timeoutType: 'connection', databaseErrorCode: 'ETIMEOUT' } },
    { name: 'instance-lookup-failed', source: tediousConnection, error: () => new ConnectionError(tediousError('Port for SQLEXPRESS not found in db', 'EINSTLOOKUP')), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration', databaseErrorCode: 'EINSTLOOKUP' } },
    { name: 'unsupported-interface', source: tediousConnection, error: () => new ConnectionError(tediousError('Server responded with unsupported interface.', 'EINTERFACENOTSUPP')), expected: { reason: 'SQL_FEATURE_NOT_SUPPORTED', databaseErrorCode: 'EINTERFACENOTSUPP' } },
    { name: 'active-directory-acknowledgement-missing', source: tediousConnection, error: () => new ConnectionError(tediousError('Did not receive Active Directory authentication acknowledgement')), expected: { reason: 'SQL_AUTHENTICATION_ERROR' } },
    { name: 'unknown-feature-acknowledged', source: tediousConnection, error: () => new ConnectionError(tediousError('Received acknowledgement for unknown feature')), expected: { reason: 'SQL_FEATURE_NOT_SUPPORTED' } },
    { name: 'connection-ended-while-connecting', source: tediousPool, error: () => new ConnectionError('The connection ended without ever completing the connection'), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'connection lost' } },
    { name: 'pool-closed-while-connecting', source: basePool, error: () => new ConnectionError('Cannot close a pool while it is connecting'), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'pool error' } },
    // tedious always gives this message the code EENCRYPT; a ConnectionError without it is not a shape the driver raises today.
    { name: 'server-requires-encryption-without-a-code', source: tediousConnection, error: () => new ConnectionError('Server requires encryption, set \'encrypt\' config option to true.'), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration' } },
    { name: 'connect-called-twice', source: tediousConnection, error: () => new ConnectionError(tediousError('`.connect` can not be called on a Connection in `Connecting` state.')), expected: { reason: 'SQL_CONNECTION_ERROR' } },

    { name: 'request-cancelled', source: tediousRequest, error: () => new RequestError('Canceled.', 'ECANCEL'), expected: { reason: 'SQL_TIMEOUT', timeoutType: 'cancelled', databaseErrorCode: 'ECANCEL' } },
    { name: 'connection-closed-before-the-request-completed', source: tediousConnection + ', ' + tediousRequest, error: () => new RequestError(tediousError('Connection closed before request completed.', 'ECLOSE'), 'EREQUEST'), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'connection lost', databaseErrorCode: 'ECLOSE' } },
    { name: 'request-without-a-connection', source: baseRequest, error: () => new RequestError('No connection is specified for that request.', 'ENOCONN'), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'pool error', databaseErrorCode: 'ENOCONN' } },
    { name: 'request-while-another-runs', source: tediousConnection + ', ' + tediousRequest, error: () => new RequestError(tediousError(sentClientRequest, 'EINVALIDSTATE'), 'EREQUEST'), expected: { reason: 'FORBIDDEN_CONCURRENT_USAGE', databaseErrorCode: 'EINVALIDSTATE' } },
    { name: 'input-without-a-type-and-value', source: baseRequest, error: () => new RequestError('Invalid number of arguments. At least 2 arguments expected.', 'EARGS'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'wrong count', databaseErrorCode: 'EARGS' } },
    { name: 'tvp-with-a-sql-variant-column', source: tediousRequest, error: () => new RequestError('Column \'v\' in TVP \'dbo.pairs\' uses sql_variant which is not supported by the tedious driver for TVP column types. Consider using a more specific data type.', 'EARGS'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid type', parameterName: 'v', databaseErrorCode: 'EARGS' } },
    { name: 'invalid-argument-of-another-wording', source: 'an mssql EARGS the mapper has no wording for', error: () => new RequestError('Invalid argument.', 'EARGS'), expected: { reason: 'SQL_INVALID_PARAMETER', databaseErrorCode: 'EARGS', databaseErrorMessage: 'Invalid argument.' } },
    { name: 'parameter-declared-twice', source: baseRequest, error: () => new RequestError('The parameter name p1 has already been declared. Parameter names must be unique', 'EDUPEPARAM'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'already bound', parameterName: 'p1', databaseErrorCode: 'EDUPEPARAM' } },
    { name: 'parameter-validation-failed', source: 'tedious/lib/request.js, ' + tediousRequest, error: () => new RequestError(tediousError('Validation failed for parameter \'p1\'. Invalid number.', 'EPARAM'), 'EPARAM'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid value', parameterName: 'p1', databaseErrorCode: 'EPARAM' } },
    { name: 'deprecated-output-type', source: baseRequest, error: () => new RequestError('Deprecated types (Text, NText, Image) are not supported as OUTPUT parameters.', 'EDEPRECATED'), expected: { reason: 'SQL_FEATURE_NOT_SUPPORTED', databaseErrorCode: 'EDEPRECATED' } },
    { name: 'json-not-parsed', source: tediousRequest, error: () => new RequestError(new Error('Failed to parse incoming JSON. Unexpected end of JSON input'), 'EJSON'), expected: { reason: 'INVALID_JSON_RECEIVED_FROM_DATABASE', typeName: 'json' } },
    { name: 'bulk-without-a-table-name', source: tediousRequest, error: () => new RequestError('Table name must be specified for bulk insert.', 'ENAME'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'missing', parameterName: 'tableName', databaseErrorCode: 'ENAME' } },
    { name: 'bulk-into-a-table-variable', source: tediousRequest, error: () => new RequestError('You can\'t use table variables for bulk insert.', 'ENAME'), expected: { reason: 'SQL_FEATURE_NOT_SUPPORTED', databaseErrorCode: 'ENAME' } },
    { name: 'bulk-into-a-missing-table', source: msnodesqlv8Request, error: () => new RequestError('Table was not found on the server.', 'ENAME'), expected: { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'table', databaseErrorCode: 'ENAME' } },
    { name: 'table-name-of-another-wording', source: 'an mssql ENAME the mapper has no wording for', error: () => new RequestError('Invalid table name.', 'ENAME'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid value', parameterName: 'tableName', databaseErrorCode: 'ENAME' } },
    { name: 'request-unknown-error', source: tediousConnection + ', ' + tediousRequest, error: () => new RequestError(tediousError('An unknown error has occurred.', 'UNKNOWN'), 'EREQUEST'), expected: { reason: 'SQL_UNKNOWN', databaseErrorCode: 'UNKNOWN' } },
    { name: 'request-error-without-a-server-number', source: 'an mssql RequestError the mapper has no code for', error: () => new RequestError(new Error('something the driver said'), 'EREQUEST'), expected: { reason: 'SQL_UNKNOWN', databaseErrorCode: 'EREQUEST', databaseErrorMessage: 'something the driver said' } },

    { name: 'prepared-statement-not-prepared', source: basePreparedStatement, error: () => new PreparedStatementError('Statement is not prepared. Call prepare() first.', 'ENOTPREPARED'), expected: { reason: 'SQL_OBJECT_STATE_ERROR', objectType: 'prepared statement', objectStateErrorType: 'invalid state', databaseErrorCode: 'ENOTPREPARED' } },
    { name: 'prepared-statement-input-without-a-type', source: basePreparedStatement, error: () => new PreparedStatementError('Invalid number of arguments. 2 arguments expected.', 'EARGS'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'wrong count', databaseErrorCode: 'EARGS' } },
    { name: 'prepared-statement-parameter-declared-twice', source: basePreparedStatement, error: () => new PreparedStatementError('The parameter name p1 has already been declared. Parameter names must be unique', 'EDUPEPARAM'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'already bound', parameterName: 'p1', databaseErrorCode: 'EDUPEPARAM' } },
    { name: 'prepared-statement-error-of-another-code', source: basePreparedStatement, error: () => new PreparedStatementError('No connection is specified for that prepared statement.', 'ENOCONN'), expected: { reason: 'SQL_UNKNOWN', databaseErrorCode: 'ENOCONN' } },

    { name: 'use-column-names-option', source: basePool, error: () => new MSSQLError('Invalid options `useColumnNames`, use `arrayRowMode` instead'), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration' } },
    { name: 'mssql-error-of-another-wording', source: 'an mssql MSSQLError the mapper has no wording for', error: () => new MSSQLError('something the driver said'), expected: { reason: 'SQL_UNKNOWN', databaseErrorMessage: 'something the driver said' } },

    { name: 'tedious-config-without-a-server', source: tediousConnection, error: () => new TypeError('The "config.server" property is required and must be of type string.'), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration' } },
    { name: 'tarn-invalid-pool-size', source: 'tarn/dist/Pool.js', error: () => new Error('Tarn: opt.max must be an integer > 0'), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'pool error' } },
    { name: 'tedious-connection-lost', source: tediousConnection, error: () => tediousError('Connection lost - read ECONNRESET', 'ESOCKET'), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'connection lost', databaseErrorCode: 'ESOCKET' } },
    { name: 'error-without-a-known-shape', source: 'any Error', error: () => driverError('x', { code: 'ECONNRESET' }), expected: { reason: 'UNKNOWN' }, notSqlError: true },

    // The current mssql wording of a rejected parameter name; the name it carries is the parameter's.
    { name: 'invalid-parameter-name', source: baseRequest, error: () => new RequestError('Invalid parameter name \'p 1\'. Parameter names may only contain identifier characters', 'EINJECT'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid name', parameterName: 'p 1', databaseErrorCode: 'EINJECT' } },
    { name: 'prepared-statement-invalid-parameter-name', source: basePreparedStatement, error: () => new PreparedStatementError('Invalid parameter name \'p 1\'. Parameter names may only contain identifier characters', 'EINJECT'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid name', parameterName: 'p 1', databaseErrorCode: 'EINJECT' } },
    // tedious refuses a request on a connection that has already ended (state Final): the connection is gone, nothing runs concurrently.
    { name: 'request-on-an-ended-connection', source: tediousConnection + ', ' + tediousRequest, error: () => new RequestError(tediousError('Requests can only be made in the LoggedIn state, not the Final state', 'EINVALIDSTATE'), 'EREQUEST'), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'connection lost', databaseErrorCode: 'EINVALIDSTATE' } },
])
