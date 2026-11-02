// mariadb (MariaDBQueryRunner, MariaDBPoolQueryRunner): the connector's own
// errors (numbers 45001-45063) and the Node errors it passes through.

import { SqlError } from 'mariadb'
import { getMariaDbErrorReason, isMariaDbError } from '../../../../src/queryRunners/connectorErrorMappers/MariaDBErrorMapper.js'
import { describeSyntheticErrors, driverError } from './syntheticErrors.js'

const connection = 'mariadb/lib/connection.js'
const pool = 'mariadb/lib/pool.js'
const parser = 'mariadb/lib/cmd/parser.js'
const authentication = 'mariadb/lib/cmd/handshake/authentication.js'
const options = 'mariadb/lib/config/connection-options.js'
const node = 'Node.js net / tls error codes (mariadb/lib/connection.js socketErrorHandler)'

/** Errors.createError of mariadb/lib/misc/errors.js */
function createError(message: string, errno: number, sqlState: string | null = 'HY000', fatal = false, cause?: unknown): SqlError {
    return new SqlError(message, undefined, fatal, undefined, sqlState, errno, undefined, undefined, cause === undefined ? undefined : { cause })
}

/** Errors.createFatalError of mariadb/lib/misc/errors.js */
function createFatalError(message: string, errno: number, sqlState = '08S01'): SqlError {
    return createError(message, errno, sqlState, true)
}

/** A socket error as the connector rejects it: marked fatal, SQLSTATE HY000 */
function socketError(message: string, properties: Record<string, unknown>): Error {
    return driverError(message, { ...properties, fatal: true, sqlState: 'HY000' })
}

describeSyntheticErrors('mariadb', () => ({ getErrorReason: (error) => getMariaDbErrorReason(error, 'mariaDB'), isError: isMariaDbError }), [
    { name: 'statement-bigger-than-max-allowed-packet', source: 'mariadb/lib/io/packet-output-stream.js', error: () => createError('query size (16777217) is >= to max_allowed_packet (16777216)', 45046), expected: { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'statement length', limit: 16777216, databaseErrorNumber: 45046 } },
    { name: 'pool-fails-to-create-connection', source: pool, error: () => createError('Pool fails to create connection', 45061, null, false, driverError('connect ECONNREFUSED 127.0.0.1:3306', { code: 'ECONNREFUSED' })), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'temporarily unavailable', databaseErrorCode: 'ER_POOL_NO_CONNECTION', databaseErrorNumber: 45061 } },
    { name: 'pool-acquire-timeout', source: pool, error: () => createError('pool timeout: failed to retrieve a connection from pool after 10001ms', 45028), expected: { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'pool' } },
    { name: 'connect-timeout', source: connection, error: () => createFatalError('Connection timeout: failed to create socket after 1001ms', 45012), expected: { reason: 'SQL_TIMEOUT', timeoutType: 'connection', databaseErrorCode: 'ER_CONNECTION_TIMEOUT' } },
    { name: 'socket-timeout', source: connection, error: () => createFatalError('socket timeout', 45026), expected: { reason: 'SQL_TIMEOUT', timeoutType: 'connection' } },
    { name: 'server-without-ssl', source: 'mariadb/lib/cmd/handshake/auth/handshake.js', error: () => createError('Trying to connect with ssl, but ssl not enabled in the server', 45023, '08S01', true), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration' } },
    { name: 'self-signed-certificate', source: authentication, error: () => createError('self-signed certificate', 45056, '08000', true), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration' } },
    { name: 'auth-plugin-not-supported', source: authentication, error: () => createFatalError("Client does not support authentication protocol 'auth_gssapi_client' requested by server.", 45025, '08004'), expected: { reason: 'SQL_AUTHENTICATION_ERROR' } },
    { name: 'rsa-key-not-available', source: 'mariadb/lib/cmd/handshake/auth/sha256-password-auth.js', error: () => createFatalError('RSA public key is not available client side. Either set option `rsaPublicKey` to indicate public key path, or allow public key retrieval with option `allowPublicKeyRetrieval`', 45044), expected: { reason: 'SQL_AUTHENTICATION_ERROR' } },
    { name: 'placeholder-not-defined', source: 'mariadb/lib/misc/parse.js', error: () => createError("Placeholder 'id' is not defined", 45018), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'missing', parameterName: 'id' } },
    { name: 'named-parameter-not-set', source: 'mariadb/lib/cmd/execute.js', error: () => createError('Parameter named id is not set', 45017), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'missing', parameterName: 'id' } },
    { name: 'batch-without-values', source: connection, error: () => createError('Batch must have values set', 45031), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'missing' } },
    { name: 'negative-ping-timeout', source: connection, error: () => createError('Ping cannot have negative timeout value', 45043, '0A000'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid value' } },
    { name: 'sql-missing', source: connection, error: () => createError('sql parameter is mandatory', 45049, 'HY000'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'missing', parameterName: 'sql' } },
    { name: 'sql-file-missing', source: 'mariadb/lib/connection-promise.js', error: () => createError('SQL file parameter is mandatory', 45052), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'missing', parameterName: 'file' } },
    { name: 'database-missing', source: connection, error: () => createError('Database parameter is not set and no database is selected', 45055), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'missing', parameterName: 'database' } },
    { name: 'empty-identifier', source: 'mariadb/lib/misc/utils.js', error: () => createError('Cannot escape empty ID value', 45006, '0A000'), expected: { reason: 'SQL_INVALID_SQL_STATEMENT', statementErrorType: 'invalid identifier' } },
    { name: 'duplicate-result-column', source: parser, error: () => createError('Error in results, duplicate field name `id`.\n(see option `checkDuplicate`)', 45040, '42000'), expected: { reason: 'SQL_AMBIGUOUS_IDENTIFIER', identifierErrorType: 'duplicate', identifier: 'id' } },
    { name: 'prepare-closed', source: 'mariadb/lib/cmd/class/prepare-result-packet.js', error: () => createError('Execute fails, prepare command as already been closed', 45051), expected: { reason: 'SQL_OBJECT_STATE_ERROR', objectType: 'prepared statement', objectStateErrorType: 'invalid state' } },
    { name: 'local-infile-not-readable', source: parser, error: () => createError('LOCAL INFILE infileStreamFactory failed', 45022), expected: { reason: 'SQL_IO_ERROR', ioErrorType: 'read' } },
    { name: 'sql-file-not-found', source: connection, error: () => createError("SQL file parameter '/tmp/schema.sql' doesn't exists", 45053), expected: { reason: 'SQL_IO_ERROR', ioErrorType: 'file not found' } },
    { name: 'local-infile-wrong-filename', source: parser, error: () => createError("LOCAL INFILE wrong filename. '/etc/passwd' doesn't correspond to query LOAD DATA LOCAL INFILE 'data.csv' INTO TABLE t. Query cancelled. Check for malicious server / proxy", 45034), expected: { reason: 'SQL_IO_ERROR', ioErrorType: 'access' } },
    { name: 'local-infile-disabled', source: parser, error: () => createError('Cannot send local file when `permitLocalInfile` option is disabled. The server requested a local file although the capability was not advertised. Check for malicious server / proxy', 45021), expected: { reason: 'SQL_PERMISSION_DENIED' } },
    { name: 'initial-sql-failed', source: connection, error: () => createFatalError("Error executing initial sql command: (conn:12, no: 1193, SQLState: HY000) Unknown system variable 'bogus'", 45030), expected: { reason: 'SQL_CONFIGURATION_ERROR', configurationErrorType: 'runtime parameter' } },
    { name: 'iana-timezone-not-loaded', source: connection, error: () => createError("setting timezone 'Europe/Madrid' fails on server.\n look at https://mariadb.com/kb/en/mysql_tzinfo_to_sql/ to load IANA timezone. ", 45033, '08S01'), expected: { reason: 'SQL_CONFIGURATION_ERROR', configurationErrorType: 'runtime parameter' } },
    { name: 'format-not-implemented', source: connection, error: () => createError('"Connection.format intentionally not implemented. please use Connection.query(sql, values), it will be more secure and faster', 45007, '0A000'), expected: { reason: 'SQL_FEATURE_NOT_SUPPORTED' } },
    { name: 'change-user-on-mysql', source: connection, error: () => createError('method changeUser not available for MySQL server due to Bug #83472', 45003, '0A000'), expected: { reason: 'SQL_FEATURE_NOT_SUPPORTED' } },
    { name: 'unsafe-integer', source: 'mariadb/lib/cmd/decoder/binary-decoder.js', error: () => createError("value 9007199254740993 can't safely be converted to number", 45050, '42000'), expected: { reason: 'SQL_INVALID_VALUE', errorType: 'out of range' } },
    { name: 'max-allowed-packet', source: 'mariadb/lib/io/packet-output-stream.js', error: () => createError('query size (16777217) is >= to max_allowed_packet (16777216)', 45046), expected: { reason: 'SQL_RESOURCE_LIMIT_REACHED' } },
    { name: 'pool-closed-without-code', source: pool + ' (the message alone)', error: () => driverError('pool is closed'), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'pool error' } },
    { name: 'socket-timeout-from-node', source: node, error: () => socketError('connect ETIMEDOUT 10.0.0.1:3306', { code: 'ETIMEDOUT', errno: -60, syscall: 'connect' }), expected: { reason: 'SQL_TIMEOUT', timeoutType: 'connection', databaseErrorCode: 'ETIMEDOUT' } },
    { name: 'untrusted-certificate', source: node, error: () => socketError('self-signed certificate', { code: 'DEPTH_ZERO_SELF_SIGNED_CERT' }), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration' } },
    { name: 'unknown-collation', source: options, error: () => driverError("Unknown collation 'utf8mb4_bogus'", {}, RangeError), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration' } },
    { name: 'reset-not-permitted', source: connection, error: () => driverError('Reset command not permitted for server 10.1.48-MariaDB (requires server MariaDB version 10.2.4+ or MySQL 5.7.3+)'), expected: { reason: 'SQL_FEATURE_NOT_SUPPORTED' } },
    { name: 'engine-error-without-code', source: 'an engine error carrying its number but no code', error: () => driverError("Table 'app.missing' doesn't exist", { errno: 1146, sqlState: '42S02' }), expected: { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'table or view', databaseErrorCode: 'ER_NO_SUCH_TABLE', databaseErrorNumber: 1146 } },
    { name: 'error-without-a-known-shape', source: 'any Error', error: () => driverError('x', { code: 'SOMETHING' }), expected: { reason: 'UNKNOWN' }, notSqlError: true },
    // A packet the protocol didn't expect is a connector / server condition, not a misuse of the API
    { name: 'packet-without-command', source: connection, error: () => createFatalError('receiving packet from server without active commands\nconn:12(4,11)\n', 45011), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'engine internal' } },
    { name: 'eof-packet-expected', source: parser, error: () => createError('Error in protocol, expected EOF packet', 45020, '42000', true), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'engine internal' } },
])
