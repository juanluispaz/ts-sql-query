// Bun SQL's mysql adapter (BunSqlMySqlQueryRunner, MySQL and MariaDB): the
// errors Bun raises itself, without a server error number. Bun only.

import type { SyntheticErrorMapper } from './syntheticErrors.js'
import { TEST_RUNTIME } from '../../../lib/testRunner.js'
import { describeSyntheticErrors, driverError } from './syntheticErrors.js'

const docs = 'bun-types docs/runtime/sql.mdx (MySQL Errors)'
const shared = 'bun internal/sql/shared.ts'
const pool = 'bun internal/sql/pool.ts'
const mysql = 'bun internal/sql/mysql.ts'
const native = 'bun native MySQL client'

let bunSql: typeof import('bun').SQL | undefined

async function loadMapper(): Promise<SyntheticErrorMapper> {
    bunSql = (await import('bun')).SQL
    const { getBunSqlMySqlErrorReason, isBunSqlMySqlAnyError } = await import('../../../../src/queryRunners/connectorErrorMappers/BunSqlMySqlErrorMapper.js')
    return { getErrorReason: (error) => getBunSqlMySqlErrorReason(error, 'mySql'), isError: isBunSqlMySqlAnyError }
}

/** What the adapter's error(code, message) builds: a MySQLError with Bun's code, no errno nor SQLSTATE */
const mysqlError = (code: string, message: string) => () => new bunSql!.MySQLError(message, { code, errno: undefined, sqlState: undefined })

describeSyntheticErrors('Bun SQL mysql', loadMapper, [
    { name: 'connect-timeout', source: docs, error: mysqlError('ERR_MYSQL_CONNECTION_TIMEOUT', 'Connection timeout after 30s'), expected: { reason: 'SQL_TIMEOUT', timeoutType: 'connection', databaseErrorCode: 'ERR_MYSQL_CONNECTION_TIMEOUT' } },
    { name: 'idle-timeout', source: docs, error: mysqlError('ERR_MYSQL_IDLE_TIMEOUT', 'Idle timeout reached after 10s'), expected: { reason: 'SQL_TIMEOUT', timeoutType: 'connection' } },
    { name: 'query-cancelled', source: shared, error: mysqlError('ERR_MYSQL_QUERY_CANCELLED', 'Query cancelled'), expected: { reason: 'SQL_TIMEOUT', timeoutType: 'cancelled' } },
    { name: 'not-tagged-call', source: shared, error: mysqlError('ERR_MYSQL_NOT_TAGGED_CALL', 'Query not called as a tagged template literal'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid binding' } },
    { name: 'wrong-parameter-count', source: docs, error: mysqlError('ERR_MYSQL_WRONG_NUMBER_OF_PARAMETERS_PROVIDED', 'Wrong number of parameters provided'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'wrong count' } },
    { name: 'authentication-failed', source: docs, error: mysqlError('ERR_MYSQL_AUTHENTICATION_FAILED', 'Authentication failed'), expected: { reason: 'SQL_AUTHENTICATION_ERROR' } },
    { name: 'unsupported-auth-plugin', source: docs, error: mysqlError('ERR_MYSQL_UNSUPPORTED_AUTH_PLUGIN', 'Unsupported auth plugin: auth_gssapi_client'), expected: { reason: 'SQL_AUTHENTICATION_ERROR' } },
    { name: 'unsupported-protocol-version', source: docs, error: mysqlError('ERR_MYSQL_UNSUPPORTED_PROTOCOL_VERSION', 'Unsupported protocol version: 9'), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration' } },
    { name: 'unsafe-transaction', source: pool, error: mysqlError('ERR_MYSQL_UNSAFE_TRANSACTION', 'Only use sql.begin, sql.reserved or max: 1'), expected: { reason: 'TRANSACTION_ERROR', transactionErrorType: 'unsupported operation' } },
    { name: 'query-after-transaction-ended', source: pool, error: mysqlError('ERR_MYSQL_INVALID_TRANSACTION_STATE', 'cannot run a query after its transaction or savepoint ended'), expected: { reason: 'TRANSACTION_ERROR', transactionErrorType: 'invalid state' } },
    { name: 'local-infile', source: native, error: mysqlError('ERR_MYSQL_LOCAL_INFILE_NOT_SUPPORTED', 'LOCAL INFILE is not supported'), expected: { reason: 'SQL_FEATURE_NOT_SUPPORTED' } },
    { name: 'unsupported-column-type', source: docs, error: mysqlError('ERR_MYSQL_UNSUPPORTED_COLUMN_TYPE', 'Unsupported column type: 242'), expected: { reason: 'SQL_FEATURE_NOT_SUPPORTED' } },
    { name: 'unexpected-packet', source: docs, error: mysqlError('ERR_MYSQL_UNEXPECTED_PACKET', 'Unexpected packet'), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'engine internal' } },
    { name: 'unknown-error', source: docs, error: mysqlError('ERR_MYSQL_UNKNOWN_ERROR', 'Unknown error'), expected: { reason: 'SQL_UNKNOWN' } },
    { name: 'sql-error-of-no-adapter', source: 'bun internal/sql/errors.ts', error: () => new bunSql!.SQLError('Connection closed'), expected: { reason: 'SQL_UNKNOWN', databaseErrorMessage: 'Connection closed' } },
    { name: 'run-misuse', source: native, error: () => driverError('run must be called with 2 arguments connection and target', {}, TypeError), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'api misuse' } },
    { name: 'array-value', source: mysql, error: () => driverError("MySQL doesn't support arrays"), expected: { reason: 'SQL_FEATURE_NOT_SUPPORTED' } },
    { name: 'distributed-name-with-quote', source: pool, error: () => driverError('Distributed transaction name cannot contain single quotes.'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid value' } },
    { name: 'tls-option', source: native, error: () => driverError('tls must be a boolean or an object', {}, TypeError), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration' } },
    { name: 'simple-query-with-parameters', source: native, error: () => driverError('simple query cannot have parameters'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'not bindable' } },
    { name: 'query-too-long', source: native, error: () => driverError('query is too long'), expected: { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'statement length' } },
    { name: 'boxed-number-value', source: native, error: () => driverError('Cannot bind NumberObject to query parameter. Use a primitive number instead.', {}, TypeError), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid type' } },
    { name: 'failed-to-connect', source: native + ' (earlier Bun releases)', error: () => driverError('failed to connect to mysql'), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'connection lost' } },
    { name: 'error-without-a-known-shape', source: 'any Error', error: () => driverError('x', { code: 'SOMETHING' }), expected: { reason: 'UNKNOWN' }, notSqlError: true },
    // Codes Bun 1.4 documents that have no mapping of their own
    { name: 'connection-closed-before-handshake', source: docs, error: mysqlError('ERR_MYSQL_CONNECTION_FAILED', 'Connection closed before the handshake completed'), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'connection lost' } },
    { name: 'public-key-retrieval-not-allowed', source: docs, error: mysqlError('ERR_MYSQL_PUBLIC_KEY_RETRIEVAL_NOT_ALLOWED', 'Public key retrieval is not allowed'), expected: { reason: 'SQL_AUTHENTICATION_ERROR' } },
    { name: 'malformed-packet', source: docs, error: mysqlError('ERR_MYSQL_MALFORMED_PACKET', 'Malformed packet'), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'engine internal' } },
], TEST_RUNTIME === 'bun')
