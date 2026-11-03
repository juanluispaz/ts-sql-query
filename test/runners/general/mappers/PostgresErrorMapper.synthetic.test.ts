// postgres.js (PostgresQueryRunner): the errors postgres.js and Node's sockets
// raise without a SQLSTATE, and the server-error shapes a server never sends.

import postgres from 'postgres'
import { getPostgresJsErrorReason, isPostgresJsError } from '../../../../src/queryRunners/connectorErrorMappers/PostgresErrorMapper.js'
import { describeSyntheticErrors, driverError } from './syntheticErrors.js'

const errors = 'postgres/src/errors.js'
const connection = 'postgres/src/connection.js'
const index = 'postgres/src/index.js'
const subscribe = 'postgres/src/subscribe.js'
const types = 'postgres/src/types.js'
const node = 'Node.js net error codes'

// postgres.js builds it from the fields of the server's ErrorResponse: `new PostgresError({ message, code, ... })`.
const PostgresError = postgres.PostgresError as unknown as new (fields: Record<string, string>) => Error

// Errors.generic(code, message)
function generic(code: string, message: string): Error {
    return driverError(code + ': ' + message, { code })
}

// Errors.connection(code, options): errno repeats the code
function connectionError(code: string): Error {
    return driverError('write ' + code + ' localhost:5432', { code, errno: code, address: 'localhost', port: 5432 })
}

describeSyntheticErrors('postgres.js', () => ({ getErrorReason: getPostgresJsErrorReason, isError: isPostgresJsError }), [
    // The data type field ('d' in the ErrorResponse) as postgres.js 3 names it, and as postgres.js 4 does
    { name: 'data-type-name-of-postgres-js-3', source: 'postgres/src/connection.js errorFields', error: () => new PostgresError({ message: 'null value not allowed', severity: 'ERROR', code: '22004', 'data type_name': 'positive_int' }), expected: { reason: 'SQL_INVALID_VALUE', errorType: 'null not allowed', typeName: 'positive_int' } },
    { name: 'data-type-name-of-postgres-js-4', source: 'postgres/src/connection.js errorFields', error: () => new PostgresError({ message: 'null value not allowed', severity: 'ERROR', code: '22004', data_type_name: 'positive_int' }), expected: { reason: 'SQL_INVALID_VALUE', errorType: 'null not allowed', typeName: 'positive_int' } },
    { name: 'server-error-without-code', source: errors, error: () => new PostgresError({ message: 'something the server said', severity: 'ERROR' }), expected: { reason: 'SQL_UNKNOWN', databaseErrorMessage: 'something the server said' } },
    { name: 'server-error-with-a-code-that-is-not-a-sqlstate', source: errors, error: () => new PostgresError({ message: 'something the server said', severity: 'ERROR', code: 'XX' }), expected: { reason: 'SQL_UNKNOWN', databaseErrorCode: 'XX', databaseErrorMessage: 'something the server said' } },
    { name: 'unsupported-target-session-attrs', source: index, error: () => driverError('target_session_attrs any is not supported'), expected: { reason: 'INVALID_CONFIGURATION', name: 'target_session_attrs', value: 'any' } },
    { name: 'stream-renamed', source: 'postgres/src/query.js', error: () => driverError('.stream has been renamed to .forEach'), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'api misuse' } },
    { name: 'missing-publication-names', source: subscribe, error: () => driverError('Missing publication names'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'missing' } },
    { name: 'malformed-subscribe-pattern', source: subscribe, error: () => driverError('Malformed subscribe pattern: insert:'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid value' } },
    { name: 'cancelled-before-sent', source: index, error: () => generic('57014', 'canceling statement due to user request'), expected: { reason: 'SQL_TIMEOUT', timeoutType: 'cancelled', databaseErrorCode: 'query_canceled', databaseErrorNumber: '57014' } },
    { name: 'socket-timeout', source: node, error: () => driverError('connect ETIMEDOUT 10.0.0.1:5432', { code: 'ETIMEDOUT', errno: -60, syscall: 'connect' }), expected: { reason: 'SQL_TIMEOUT', timeoutType: 'connection', databaseErrorCode: 'ETIMEDOUT', databaseErrorNumber: -60 } },
    { name: 'undefined-value', source: types, error: () => generic('UNDEFINED_VALUE', 'Undefined values are not allowed'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid value', databaseErrorCode: 'UNDEFINED_VALUE' } },
    { name: 'too-many-parameters', source: connection, error: () => generic('MAX_PARAMETERS_EXCEEDED', 'Max number of parameters (65534) exceeded'), expected: { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'parameters', limit: 65533, databaseErrorCode: 'MAX_PARAMETERS_EXCEEDED' } },
    { name: 'not-tagged-call', source: types, error: () => generic('NOT_TAGGED_CALL', 'Query not called as a tagged template literal'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid binding', databaseErrorCode: 'NOT_TAGGED_CALL' } },
    { name: 'unsafe-transaction', source: connection, error: () => generic('UNSAFE_TRANSACTION', 'Only use sql.begin, sql.reserved or max: 1'), expected: { reason: 'TRANSACTION_ERROR', transactionErrorType: 'unsupported operation', databaseErrorCode: 'UNSAFE_TRANSACTION' } },
    { name: 'copy-in-progress', source: connection, error: () => generic('COPY_IN_PROGRESS', 'You cannot execute queries during copy'), expected: { reason: 'FORBIDDEN_CONCURRENT_USAGE', databaseErrorCode: 'COPY_IN_PROGRESS' } },
    { name: 'sasl-signature-mismatch', source: connection, error: () => generic('SASL_SIGNATURE_MISMATCH', 'The server did not return the correct signature'), expected: { reason: 'SQL_AUTHENTICATION_ERROR', databaseErrorCode: 'SASL_SIGNATURE_MISMATCH' } },
    { name: 'connect-timeout', source: connection, error: () => connectionError('CONNECT_TIMEOUT'), expected: { reason: 'SQL_TIMEOUT', timeoutType: 'connection', databaseErrorCode: 'CONNECT_TIMEOUT' } },
    { name: 'backend-message-not-supported', source: errors, error: () => driverError('NegotiateProtocolVersion (B) is not supported', { code: 'MESSAGE_NOT_SUPPORTED', name: 'NegotiateProtocolVersion' }), expected: { reason: 'SQL_FEATURE_NOT_SUPPORTED', databaseErrorCode: 'MESSAGE_NOT_SUPPORTED' } },
    { name: 'self-signed-certificate', source: 'Node.js tls', error: () => driverError('self-signed certificate in certificate chain', { code: 'SELF_SIGNED_CERT_IN_CHAIN' }), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration', databaseErrorCode: 'SELF_SIGNED_CERT_IN_CHAIN' } },
    { name: 'ssl-version-mismatch', source: 'Node.js tls (OpenSSL)', error: () => driverError('C0F7A2F701000000:error:0A00010B:SSL routines:ssl3_get_record:wrong version number', { code: 'ERR_SSL_WRONG_VERSION_NUMBER' }), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration', databaseErrorCode: 'ERR_SSL_WRONG_VERSION_NUMBER' } },
    { name: 'error-without-a-known-shape', source: 'any Error', error: () => driverError('x', { code: 'SOMETHING' }), expected: { reason: 'UNKNOWN' }, notSqlError: true },
])
