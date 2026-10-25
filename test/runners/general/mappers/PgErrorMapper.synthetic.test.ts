// pg (PgQueryRunner, PgPoolQueryRunner): the errors pg, pg-pool and Node's
// sockets raise without a SQLSTATE.

import { getPgErrorReason, isPgError } from '../../../../src/queryRunners/connectorErrorMappers/PgErrorMapper.js'
import { describeSyntheticErrors, driverError } from './syntheticErrors.js'

const pgClient = 'pg/lib/client.js'
const pgPool = 'pg-pool/index.js'
const node = 'Node.js net / dns error codes'

describeSyntheticErrors('pg', () => ({ getErrorReason: getPgErrorReason, isError: isPgError }), [
    { name: 'socket-reset', source: node, error: () => driverError('read ECONNRESET', { code: 'ECONNRESET', errno: -54 }), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'connection lost', databaseErrorCode: 'ECONNRESET', databaseErrorNumber: -54 } },
    { name: 'host-not-found', source: node, error: () => driverError('getaddrinfo ENOTFOUND db', { code: 'ENOTFOUND' }), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'connection lost' } },
    { name: 'socket-timeout', source: node, error: () => driverError('connect ETIMEDOUT', { code: 'ETIMEDOUT' }), expected: { reason: 'SQL_TIMEOUT', timeoutType: 'connection' } },
    { name: 'expired-certificate', source: 'Node.js tls', error: () => driverError('certificate has expired', { code: 'CERT_HAS_EXPIRED' }), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration' } },
    { name: 'connect-timeout', source: pgPool, error: () => driverError('timeout exceeded when trying to connect'), expected: { reason: 'SQL_TIMEOUT', timeoutType: 'connection' } },
    { name: 'connection-timeout', source: pgClient, error: () => driverError('Connection terminated due to connection timeout'), expected: { reason: 'SQL_TIMEOUT', timeoutType: 'connection' } },
    { name: 'server-without-ssl', source: pgClient, error: () => driverError('The server does not support SSL connections'), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration' } },
    { name: 'password-not-a-string', source: 'pg/lib/crypto/sasl.js', error: () => driverError('Password must be a string'), expected: { reason: 'SQL_AUTHENTICATION_ERROR' } },
    { name: 'sasl-failure', source: 'pg/lib/crypto/sasl.js', error: () => driverError('SASL: SCRAM-SERVER-FINAL-MESSAGE: server signature does not match'), expected: { reason: 'SQL_AUTHENTICATION_ERROR' } },
    { name: 'sasl-buffer-misuse', source: 'pg/lib/crypto/utils-webcrypto.js', error: () => driverError('Buffers cannot be empty'), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'engine internal' } },
    { name: 'null-query', source: pgClient, error: () => driverError('Client was passed a null or undefined query'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid value' } },
    { name: 'query-without-text', source: 'pg/lib/query.js', error: () => driverError('A query must have either text or a name. Supplying neither is unsupported.'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'missing' } },
    { name: 'prepared-statement-name-reused', source: 'pg/lib/query.js', error: () => driverError('Prepared statements must be unique - \'select 1\' was used for a different statement'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid value' } },
    { name: 'values-not-an-array', source: 'pg/lib/query.js', error: () => driverError('Query values must be an array'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid type' } },
    { name: 'missing-callback', source: pgPool, error: () => driverError('Callback is required'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'missing' } },
    { name: 'wrong-argument-count', source: 'pg-native', error: () => driverError('Must supply 2 arguments'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'wrong count', expectedParameterCount: 2 } },
    { name: 'circular-value', source: 'pg/lib/utils.js', error: () => driverError('circular reference detected while preparing "{"a":{}}" for query'), expected: { reason: 'SQL_INVALID_VALUE', errorType: 'invalid value' } },
    { name: 'connection-terminated', source: pgClient, error: () => driverError('Connection terminated unexpectedly'), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'connection lost' } },
    { name: 'client-not-queryable', source: pgClient, error: () => driverError('Client has encountered a connection error and is not queryable'), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'connection lost' } },
    { name: 'native-connection-lost', source: 'pg-native (libpq)', error: () => driverError('server closed the connection unexpectedly'), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'connection lost' } },
    { name: 'pool-ended', source: pgPool, error: () => driverError('Cannot use a pool after calling end on the pool'), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'pool error' } },
    { name: 'client-released-twice', source: pgPool, error: () => driverError('Release called on client which has already been released to the pool.'), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'pool error' } },
    { name: 'unexpected-backend-message', source: pgClient, error: () => driverError('Received unexpected commandComplete message from backend.'), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'engine internal' } },
    { name: 'unknown-authentication-message', source: 'pg-protocol/dist/parser.js', error: () => driverError('Unknown authenticationOk message type 99'), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'engine internal' } },
    { name: 'binary-mode', source: 'pg/lib/query.js', error: () => driverError('Binary mode not supported yet'), expected: { reason: 'SQL_FEATURE_NOT_SUPPORTED' } },
    { name: 'native-password-failure', source: 'pg-native (libpq)', error: () => driverError('FATAL:  password authentication failed for user "app"'), expected: { reason: 'SQL_AUTHENTICATION_ERROR' } },
    { name: 'native-hba-refusal', source: 'pg-native (libpq)', error: () => driverError('FATAL:  no pg_hba.conf entry for host "10.0.0.1"'), expected: { reason: 'SQL_AUTHORIZATION_ERROR' } },
    { name: 'native-server-message', source: 'pg-native (libpq)', error: () => driverError('ERROR:  something the server said'), expected: { reason: 'SQL_UNKNOWN' } },
    { name: 'error-without-a-known-shape', source: 'any Error', error: () => driverError('x', { code: 'SOMETHING' }), expected: { reason: 'UNKNOWN' }, notSqlError: true },
])
