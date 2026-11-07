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
const build = 'postgres/src/build.js'
const pool = 'postgres/src/pool.js'
const query = 'postgres/src/query.js'
const startup = 'postgres/src/startup.js'
const protocol = 'postgres/src/protocol.js'
const cf = 'postgres/src/cf.js'
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
    { name: 'unsupported-channel-binding', source: index, error: () => driverError('channel_binding always is not supported'), expected: { reason: 'INVALID_CONFIGURATION', name: 'channel_binding', value: 'always' } },
    { name: 'cancelled-before-sent', source: index, error: () => generic('57014', 'canceling statement due to user request'), expected: { reason: 'SQL_TIMEOUT', timeoutType: 'cancelled', databaseErrorCode: 'query_canceled', databaseErrorNumber: '57014' } },
    { name: 'socket-timeout', source: node, error: () => driverError('connect ETIMEDOUT 10.0.0.1:5432', { code: 'ETIMEDOUT', errno: -60, syscall: 'connect' }), expected: { reason: 'SQL_TIMEOUT', timeoutType: 'connection', databaseErrorCode: 'ETIMEDOUT', databaseErrorNumber: -60 } },
    { name: 'undefined-value', source: types, error: () => generic('UNDEFINED_VALUE', 'Undefined values are not allowed'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid value', databaseErrorCode: 'UNDEFINED_VALUE' } },
    { name: 'too-many-parameters', source: connection, error: () => generic('MAX_PARAMETERS_EXCEEDED', 'Max number of parameters (65534) exceeded'), expected: { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'parameters', limit: 65533, databaseErrorCode: 'MAX_PARAMETERS_EXCEEDED' } },
    { name: 'not-tagged-call', source: types, error: () => generic('NOT_TAGGED_CALL', 'Query not called as a tagged template literal'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid binding', databaseErrorCode: 'NOT_TAGGED_CALL' } },
    { name: 'unsafe-transaction', source: connection, error: () => generic('UNSAFE_TRANSACTION', 'Only use sql.begin, sql.reserved or max: 1'), expected: { reason: 'TRANSACTION_ERROR', transactionErrorType: 'unsupported operation', databaseErrorCode: 'UNSAFE_TRANSACTION' } },
    { name: 'copy-in-progress', source: connection, error: () => generic('COPY_IN_PROGRESS', 'You cannot execute queries during copy'), expected: { reason: 'FORBIDDEN_CONCURRENT_USAGE', databaseErrorCode: 'COPY_IN_PROGRESS' } },
    { name: 'sasl-signature-mismatch', source: connection, error: () => generic('SASL_SIGNATURE_MISMATCH', 'The server did not return the correct signature'), expected: { reason: 'SQL_AUTHENTICATION_ERROR', databaseErrorCode: 'SASL_SIGNATURE_MISMATCH' } },
    { name: 'no-columns', source: build, error: () => generic('NO_COLUMNS', 'The insert helper got no columns'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid value', databaseErrorCode: 'NO_COLUMNS' } },
    { name: 'identifier-without-parts', source: index, error: () => generic('NO_PARTS', 'sql.identifier needs at least one part'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'missing', databaseErrorCode: 'NO_PARTS' } },
    { name: 'batch-not-an-array', source: index, error: () => generic('BATCH_NOT_ARRAY', 'sql.batch takes an array of queries'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid type', databaseErrorCode: 'BATCH_NOT_ARRAY' } },
    { name: 'batch-item-not-a-query', source: index, error: () => generic('BATCH_NOT_QUERY', 'Item 0 of the batch is not a query'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid type', databaseErrorCode: 'BATCH_NOT_QUERY' } },
    { name: 'batch-item-already-run', source: index, error: () => generic('BATCH_EXECUTED', 'Item 0 of the batch has already run'), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'api misuse', databaseErrorCode: 'BATCH_EXECUTED' } },
    { name: 'batch-item-unsupported', source: index, error: () => generic('BATCH_UNSUPPORTED', 'Item 0 of the batch is a cursor, stream, forEach or describe'), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'api misuse', databaseErrorCode: 'BATCH_UNSUPPORTED' } },
    { name: 'array-helper-removed', source: index, error: () => generic('ARRAY_REMOVED', 'sql.array() is removed in v4, pass the array as it is'), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'api misuse', databaseErrorCode: 'ARRAY_REMOVED' } },
    { name: 'type-not-found', source: types, error: () => generic('TYPE_NOT_FOUND', 'The type rt_missing does not exist'), expected: { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode: 'TYPE_NOT_FOUND' } },
    { name: 'type-by-name-without-fetch-types', source: index, error: () => generic('TYPE_NOT_FOUND', 'Custom types given by name need fetch_types to look them up'), expected: { reason: 'SQL_OBJECT_NOT_FOUND', databaseErrorCode: 'TYPE_NOT_FOUND' } },
    { name: 'unsafe-transaction-on-an-ended-lease', source: pool, error: () => generic('UNSAFE_TRANSACTION', 'The transaction has ended'), expected: { reason: 'TRANSACTION_ERROR', transactionErrorType: 'unsupported operation', databaseErrorCode: 'UNSAFE_TRANSACTION' } },
    { name: 'nested-transaction-mode', source: index, error: () => generic('NESTED_TRANSACTION_MODE', 'A nested transaction runs in a savepoint, which can not change the transaction mode'), expected: { reason: 'TRANSACTION_ERROR', transactionErrorType: 'unsupported operation', databaseErrorCode: 'NESTED_TRANSACTION_MODE' } },
    { name: 'nested-transaction-prepared', source: index, error: () => generic('NESTED_TRANSACTION_MODE', 'A nested transaction can not be prepared, only the outermost one'), expected: { reason: 'TRANSACTION_ERROR', transactionErrorType: 'unsupported operation', databaseErrorCode: 'NESTED_TRANSACTION_MODE' } },
    { name: 'commit-answered-rollback', source: index, error: () => generic('TRANSACTION_ROLLED_BACK', 'The server rolled back the transaction instead of committing it'), expected: { reason: 'TRANSACTION_ERROR', transactionErrorType: 'transaction rolled back', databaseErrorCode: 'TRANSACTION_ROLLED_BACK' } },
    { name: 'sasl-nonce-mismatch', source: startup, error: () => generic('SASL_NONCE_MISMATCH', 'The server nonce does not start with the client nonce'), expected: { reason: 'SQL_AUTHENTICATION_ERROR', databaseErrorCode: 'SASL_NONCE_MISMATCH' } },
    { name: 'sasl-mechanism-not-supported', source: startup, error: () => generic('SASL_MECHANISM_NOT_SUPPORTED', 'The server offered no supported SASL mechanism'), expected: { reason: 'SQL_AUTHENTICATION_ERROR', databaseErrorCode: 'SASL_MECHANISM_NOT_SUPPORTED' } },
    { name: 'channel-binding-required', source: startup, error: () => generic('CHANNEL_BINDING_REQUIRED', 'channel_binding is require, but the server did not offer it'), expected: { reason: 'SQL_AUTHENTICATION_ERROR', databaseErrorCode: 'CHANNEL_BINDING_REQUIRED' } },
    { name: 'authentication-incomplete', source: startup, error: () => generic('AUTHENTICATION_INCOMPLETE', 'The server was ready before it accepted the authentication'), expected: { reason: 'SQL_AUTHENTICATION_ERROR', databaseErrorCode: 'AUTHENTICATION_INCOMPLETE' } },
    { name: 'auth-type-not-implemented', source: startup, error: () => generic('AUTH_TYPE_NOT_IMPLEMENTED', 'Authentication type 7 is not supported'), expected: { reason: 'SQL_AUTHENTICATION_ERROR', databaseErrorCode: 'AUTH_TYPE_NOT_IMPLEMENTED' } },
    { name: 'connect-timeout', source: connection, error: () => connectionError('CONNECT_TIMEOUT'), expected: { reason: 'SQL_TIMEOUT', timeoutType: 'connection', databaseErrorCode: 'CONNECT_TIMEOUT' } },
    { name: 'queue-timeout', source: pool, error: () => generic('QUEUE_TIMEOUT', 'Waited more than 1 seconds for a connection'), expected: { reason: 'SQL_TIMEOUT', timeoutType: 'connection', databaseErrorCode: 'QUEUE_TIMEOUT' } },
    // The cancel postgres.js sent is the cause (here, the server's answer to it)
    { name: 'query-timeout', source: query, error: () => Object.assign(generic('QUERY_TIMEOUT', 'The query did not finish within query_timeout (1 seconds)'), { cause: new PostgresError({ message: 'canceling statement due to user request', severity: 'ERROR', code: '57014' }) }), expected: { reason: 'SQL_TIMEOUT', timeoutType: 'statement', databaseErrorCode: 'QUERY_TIMEOUT' } },
    // What a query sees when the server didn't answer its cancel: the connection destroyed, caused by CANCEL_UNANSWERED
    { name: 'connection-destroyed-after-an-unanswered-cancel', source: connection, error: () => Object.assign(connectionError('CONNECTION_DESTROYED'), { cause: generic('CANCEL_UNANSWERED', 'The server did not answer within cancel_timeout (5 seconds) after a query was canceled, so whether it ran is unknown') }), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'connection lost', databaseErrorCode: 'CONNECTION_DESTROYED' } },
    { name: 'cancel-unanswered', source: connection, error: () => generic('CANCEL_UNANSWERED', 'The server did not answer within cancel_timeout (5 seconds) after a query was canceled, so whether it ran is unknown'), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'connection lost', databaseErrorCode: 'CANCEL_UNANSWERED' } },
    { name: 'ssl-not-supported', source: startup, error: () => generic('SSL_NOT_SUPPORTED', 'The server does not support SSL connections'), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration', databaseErrorCode: 'SSL_NOT_SUPPORTED' } },
    { name: 'ssl-negotiation-not-supported', source: cf, error: () => generic('SSL_NEGOTIATION_NOT_SUPPORTED', 'sslnegotiation: direct needs ALPN, which Cloudflare Workers sockets do not offer'), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration', databaseErrorCode: 'SSL_NEGOTIATION_NOT_SUPPORTED' } },
    { name: 'tls-handshake-failed', source: cf, error: () => generic('TLS_HANDSHAKE_FAILED', 'The TLS connection to db.example.com:5432 was lost before the server answered.'), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration', databaseErrorCode: 'TLS_HANDSHAKE_FAILED' } },
    // Built without Errors.generic: the message has no code in front
    { name: 'nul-character-in-a-connection-parameter', source: protocol, error: () => driverError('The connection parameter application_name contains a NUL character', { code: 'NUL_CHARACTER' }), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration', databaseErrorCode: 'NUL_CHARACTER' } },
    { name: 'protocol-error', source: protocol, error: () => driverError('The server sent a message with an invalid length (2)', { code: 'PROTOCOL_ERROR' }), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'engine internal', databaseErrorCode: 'PROTOCOL_ERROR' } },
    { name: 'statement-pending', source: connection, error: () => generic('STATEMENT_PENDING', 'A statement was used before its description arrived'), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'engine internal', databaseErrorCode: 'STATEMENT_PENDING' } },
    { name: 'connection-ended', source: pool, error: () => connectionError('CONNECTION_ENDED'), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'connection lost', databaseErrorCode: 'CONNECTION_ENDED' } },
    { name: 'backend-message-not-supported', source: errors, error: () => driverError('NegotiateProtocolVersion (B) is not supported', { code: 'MESSAGE_NOT_SUPPORTED', name: 'NegotiateProtocolVersion' }), expected: { reason: 'SQL_FEATURE_NOT_SUPPORTED', databaseErrorCode: 'MESSAGE_NOT_SUPPORTED' } },
    { name: 'self-signed-certificate', source: 'Node.js tls', error: () => driverError('self-signed certificate in certificate chain', { code: 'SELF_SIGNED_CERT_IN_CHAIN' }), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration', databaseErrorCode: 'SELF_SIGNED_CERT_IN_CHAIN' } },
    { name: 'ssl-version-mismatch', source: 'Node.js tls (OpenSSL)', error: () => driverError('C0F7A2F701000000:error:0A00010B:SSL routines:ssl3_get_record:wrong version number', { code: 'ERR_SSL_WRONG_VERSION_NUMBER' }), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration', databaseErrorCode: 'ERR_SSL_WRONG_VERSION_NUMBER' } },
    { name: 'error-without-a-known-shape', source: 'any Error', error: () => driverError('x', { code: 'SOMETHING' }), expected: { reason: 'UNKNOWN' }, notSqlError: true },
])
