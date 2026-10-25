// Bun SQL's postgres adapter (BunSqlPostgresQueryRunner): the errors Bun
// raises itself, with its own `ERR_POSTGRES_*` code and no SQLSTATE in
// `errno`. Bun only: the mapper and the error classes come from 'bun'.

import type { SyntheticErrorMapper } from './syntheticErrors.js'
import { TEST_RUNTIME } from '../../../lib/testRunner.js'
import { describeSyntheticErrors, driverError } from './syntheticErrors.js'

const bunDocs = 'Bun SQL docs (bun-types/docs/runtime/sql.mdx, error codes)'
const bunBinary = 'Bun SQL postgres adapter (message in the bun binary)'

let SQL: typeof import('bun').SQL

async function loadMapper(): Promise<SyntheticErrorMapper> {
    SQL = (await import('bun')).SQL
    const { getBunSqlPostgresErrorReason, isBunSqlPostgresError } = await import('../../../../src/queryRunners/connectorErrorMappers/BunSqlPostgresErrorMapper.js')
    return { getErrorReason: getBunSqlPostgresErrorReason, isError: isBunSqlPostgresError }
}

// The errors Bun raises itself carry its code and no errno.
function bunError(code: string, message: string): Error {
    return new SQL.PostgresError(message, { code })
}

describeSyntheticErrors('bun-sql-postgres', loadMapper, [
    { name: 'base-sql-error', source: bunDocs, error: () => new SQL.SQLError('connection is in an unexpected state'), expected: { reason: 'SQL_UNKNOWN', databaseErrorMessage: 'connection is in an unexpected state' } },
    { name: 'postgres-error-without-code', source: bunDocs, error: () => new SQL.PostgresError('something Bun said', {} as { code: string }), expected: { reason: 'SQL_UNKNOWN', databaseErrorMessage: 'something Bun said' } },
    { name: 'connection-timeout', source: bunDocs, error: () => bunError('ERR_POSTGRES_CONNECTION_TIMEOUT', 'Connection timeout after 30s'), expected: { reason: 'SQL_TIMEOUT', timeoutType: 'connection', databaseErrorCode: 'ERR_POSTGRES_CONNECTION_TIMEOUT' } },
    { name: 'query-cancelled', source: bunDocs, error: () => bunError('ERR_POSTGRES_QUERY_CANCELLED', 'Query cancelled'), expected: { reason: 'SQL_TIMEOUT', timeoutType: 'cancelled', databaseErrorCode: 'ERR_POSTGRES_QUERY_CANCELLED' } },
    { name: 'syntax-error-without-sqlstate', source: bunDocs, error: () => bunError('ERR_POSTGRES_SYNTAX_ERROR', 'syntax error at or near "selec"'), expected: { reason: 'SQL_SYNTAX_ERROR', databaseErrorCode: 'ERR_POSTGRES_SYNTAX_ERROR' } },
    { name: 'not-tagged-call', source: bunDocs, error: () => bunError('ERR_POSTGRES_NOT_TAGGED_CALL', 'Query was called without a tagged call'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid binding', databaseErrorCode: 'ERR_POSTGRES_NOT_TAGGED_CALL' } },
    { name: 'too-many-parameters', source: bunBinary, error: () => bunError('ERR_POSTGRES_TOO_MANY_PARAMETERS', 'query has too many parameters - the PostgreSQL wire protocol supports a maximum of 65535 parameters per query. Try reducing your batch size.'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'too many', expectedParameterCount: 65535, databaseErrorCode: 'ERR_POSTGRES_TOO_MANY_PARAMETERS' } },
    { name: 'unsafe-transaction', source: bunDocs, error: () => bunError('ERR_POSTGRES_UNSAFE_TRANSACTION', 'BEGIN on a pool with more than one connection'), expected: { reason: 'TRANSACTION_ERROR', transactionErrorType: 'unsupported operation', databaseErrorCode: 'ERR_POSTGRES_UNSAFE_TRANSACTION' } },
    { name: 'query-after-transaction-ended', source: bunDocs, error: () => bunError('ERR_POSTGRES_INVALID_TRANSACTION_STATE', 'A query ran after its transaction ended'), expected: { reason: 'TRANSACTION_ERROR', transactionErrorType: 'invalid state', databaseErrorCode: 'ERR_POSTGRES_INVALID_TRANSACTION_STATE' } },
    { name: 'unsupported-authentication-method', source: bunDocs, error: () => bunError('ERR_POSTGRES_UNSUPPORTED_AUTHENTICATION_METHOD', 'Unsupported authentication method: GSSAPI'), expected: { reason: 'SQL_AUTHENTICATION_ERROR', databaseErrorCode: 'ERR_POSTGRES_UNSUPPORTED_AUTHENTICATION_METHOD' } },
    { name: 'tls-not-available', source: bunDocs, error: () => bunError('ERR_POSTGRES_TLS_NOT_AVAILABLE', 'The server does not support TLS'), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration', databaseErrorCode: 'ERR_POSTGRES_TLS_NOT_AVAILABLE' } },
    { name: 'invalid-binary-data', source: bunDocs, error: () => bunError('ERR_POSTGRES_INVALID_BINARY_DATA', 'Invalid binary data'), expected: { reason: 'SQL_INVALID_VALUE', errorType: 'invalid format', databaseErrorCode: 'ERR_POSTGRES_INVALID_BINARY_DATA' } },
    { name: 'invalid-byte-sequence', source: bunDocs, error: () => bunError('ERR_POSTGRES_INVALID_BYTE_SEQUENCE', 'Invalid byte sequence'), expected: { reason: 'SQL_INVALID_VALUE', errorType: 'invalid encoding', databaseErrorCode: 'ERR_POSTGRES_INVALID_BYTE_SEQUENCE' } },
    { name: 'invalid-character', source: bunDocs, error: () => bunError('ERR_POSTGRES_INVALID_CHARACTER', 'Invalid character'), expected: { reason: 'SQL_INVALID_VALUE', errorType: 'invalid value', databaseErrorCode: 'ERR_POSTGRES_INVALID_CHARACTER' } },
    { name: 'unsupported-integer-size', source: bunDocs, error: () => bunError('ERR_POSTGRES_UNSUPPORTED_INTEGER_SIZE', 'Unsupported integer size'), expected: { reason: 'SQL_INVALID_VALUE', errorType: 'out of range', databaseErrorCode: 'ERR_POSTGRES_UNSUPPORTED_INTEGER_SIZE' } },
    { name: 'unsupported-bytea-format', source: bunDocs, error: () => bunError('ERR_POSTGRES_UNSUPPORTED_BYTEA_FORMAT', 'Unsupported bytea format'), expected: { reason: 'SQL_FEATURE_NOT_SUPPORTED', databaseErrorCode: 'ERR_POSTGRES_UNSUPPORTED_BYTEA_FORMAT' } },
    { name: 'unexpected-backend-message', source: bunDocs, error: () => bunError('ERR_POSTGRES_UNEXPECTED_MESSAGE', 'Unexpected message'), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'engine internal', databaseErrorCode: 'ERR_POSTGRES_UNEXPECTED_MESSAGE' } },
    { name: 'server-error-without-sqlstate', source: bunDocs, error: () => bunError('ERR_POSTGRES_SERVER_ERROR', 'something the server said'), expected: { reason: 'SQL_UNKNOWN', databaseErrorCode: 'ERR_POSTGRES_SERVER_ERROR', databaseErrorMessage: 'something the server said' } },
    { name: 'code-from-a-later-bun', source: 'a code a later Bun adds', error: () => bunError('ERR_POSTGRES_SOMETHING_NEW', 'something new'), expected: { reason: 'SQL_UNKNOWN', databaseErrorCode: 'ERR_POSTGRES_SOMETHING_NEW', databaseErrorMessage: 'something new' } },
    { name: 'error-without-a-known-shape', source: 'any Error', error: () => driverError('x', { code: 'ERR_POSTGRES_CONNECTION_CLOSED' }), expected: { reason: 'UNKNOWN' }, notSqlError: true },
    // Codes Bun documents that the mapper reports as SQL_UNKNOWN.
    { name: 'connection-failed-before-handshake', source: bunDocs, error: () => bunError('ERR_POSTGRES_CONNECTION_FAILED', 'Connection closed before the handshake completed'), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'connection lost', databaseErrorCode: 'ERR_POSTGRES_CONNECTION_FAILED' } },
    { name: 'commit-rolled-back', source: bunDocs, error: () => bunError('ERR_POSTGRES_COMMIT_ROLLED_BACK', 'COMMIT was rolled back because the transaction was aborted'), expected: { reason: 'TRANSACTION_ERROR', transactionErrorType: 'transaction rolled back', databaseErrorCode: 'ERR_POSTGRES_COMMIT_ROLLED_BACK' } },
    { name: 'sasl-iteration-count-out-of-range', source: bunDocs, error: () => bunError('ERR_POSTGRES_SASL_ITERATION_COUNT_OUT_OF_RANGE', 'SCRAM iteration count out of range'), expected: { reason: 'SQL_AUTHENTICATION_ERROR', databaseErrorCode: 'ERR_POSTGRES_SASL_ITERATION_COUNT_OUT_OF_RANGE' } },
    { name: 'sasl-no-known-mechanism', source: bunDocs, error: () => bunError('ERR_POSTGRES_SASL_NO_KNOWN_MECHANISM', 'The server offers no SASL mechanism that Bun supports'), expected: { reason: 'SQL_AUTHENTICATION_ERROR', databaseErrorCode: 'ERR_POSTGRES_SASL_NO_KNOWN_MECHANISM' } },
    { name: 'channel-binding-required', source: bunDocs, error: () => bunError('ERR_POSTGRES_CHANNEL_BINDING_REQUIRED', 'Channel binding is required, but the login cannot be bound to the TLS connection'), expected: { reason: 'SQL_AUTHENTICATION_ERROR', databaseErrorCode: 'ERR_POSTGRES_CHANNEL_BINDING_REQUIRED' } },
    { name: 'channel-binding-failed', source: bunDocs, error: () => bunError('ERR_POSTGRES_CHANNEL_BINDING_FAILED', 'The server offers SCRAM-SHA-256-PLUS without TLS'), expected: { reason: 'SQL_AUTHENTICATION_ERROR', databaseErrorCode: 'ERR_POSTGRES_CHANNEL_BINDING_FAILED' } },
    { name: 'copy-without-stream', source: bunDocs, error: () => bunError('ERR_POSTGRES_COPY_NOT_SUPPORTED', 'COPY needs writable() or readable()'), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'api misuse', databaseErrorCode: 'ERR_POSTGRES_COPY_NOT_SUPPORTED' } },
    // A type the server sent in binary that Bun has no decoder for: unsupported, not a malformed value.
    { name: 'unknown-format-code', source: bunDocs, error: () => bunError('ERR_POSTGRES_UNKNOWN_FORMAT_CODE', 'Unknown format code'), expected: { reason: 'SQL_FEATURE_NOT_SUPPORTED', databaseErrorCode: 'ERR_POSTGRES_UNKNOWN_FORMAT_CODE' } },
], TEST_RUNTIME === 'bun')
