// mysql2 (MySql2QueryRunner, MySql2PoolQueryRunner): the errors mysql2 raises
// itself, without a server error number.

import { getMySql2ErrorReason, isMySql2Error } from '../../../../src/queryRunners/connectorErrorMappers/MySql2ErrorMapper.js'
import { describeSyntheticErrors, driverError } from './syntheticErrors.js'

const connection = 'mysql2/lib/base/connection.js'
const handshake = 'mysql2/lib/commands/client_handshake.js'
const authSwitch = 'mysql2/lib/commands/auth_switch.js'
const poolCluster = 'mysql2/lib/pool_cluster.js'
const promise = 'mysql2/promise.js'

describeSyntheticErrors('mysql2', () => ({ getErrorReason: (error) => getMySql2ErrorReason(error, 'mySql'), isError: isMySql2Error }), [
    { name: 'no-connections-available', source: 'mysql2/lib/base/pool.js', error: () => driverError('No connections available.'), expected: { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'pool' } },
    { name: 'queue-limit-reached', source: 'mysql2/lib/base/pool.js', error: () => driverError('Queue limit reached.'), expected: { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'pool' } },
    { name: 'cluster-pool-not-found', source: poolCluster, error: () => driverError('Pool does Not exist.', { code: 'POOL_NOEXIST' }), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'pool error', databaseErrorCode: 'POOL_NOEXIST' } },
    { name: 'cluster-pool-offline', source: poolCluster, error: () => driverError('Pool does Not have online node.', { code: 'POOL_NONEONLINE' }), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'pool error' } },
    { name: 'connect-timeout', source: connection, error: () => driverError('connect ETIMEDOUT', { errorno: 'ETIMEDOUT', code: 'ETIMEDOUT', syscall: 'connect', fatal: true }), expected: { reason: 'SQL_TIMEOUT', timeoutType: 'connection', databaseErrorCode: 'ETIMEDOUT' } },
    { name: 'query-inactivity-timeout', source: 'mysql2/lib/commands/query.js', error: () => driverError('Query inactivity timeout', { errorno: 'PROTOCOL_SEQUENCE_TIMEOUT', code: 'PROTOCOL_SEQUENCE_TIMEOUT', syscall: 'query' }), expected: { reason: 'SQL_TIMEOUT', timeoutType: 'statement' } },
    { name: 'server-without-ssl', source: handshake, error: () => driverError('Server does not support secure connection', { code: 'HANDSHAKE_NO_SSL_SUPPORT', fatal: true }), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration' } },
    { name: 'tls-negotiation-failure', source: handshake, error: () => driverError('self-signed certificate', { code: 'HANDSHAKE_SSL_ERROR', fatal: true }), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration' } },
    { name: 'unknown-charset', source: 'mysql2/lib/connection_config.js', error: () => driverError("Unknown charset 'UTF9'", {}, TypeError), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration' } },
    { name: 'unknown-auth-plugin', source: authSwitch + ' (code added by ' + handshake + ')', error: () => driverError("Server requests authentication using unknown plugin auth_gssapi_client. See TODO: add plugins doco here on how to configure or author authentication plugins.", { code: 'AUTH_SWITCH_PLUGIN_ERROR', fatal: true }), expected: { reason: 'SQL_AUTHENTICATION_ERROR' } },
    { name: 'clear-password-disabled', source: authSwitch, error: () => driverError('Server requested authentication using mysql_clear_password, which sends the password in plaintext over the network and is disabled by default. To enable it, set the `enableCleartextPlugin` option to `true` in your connection configuration, or provide a custom `mysql_clear_password` auth plugin via the `authPlugins` option. Only use this over a secure connection (TLS/SSL).', { code: 'MYSQL_CLEAR_PASSWORD_NOT_ENABLED', fatal: true }), expected: { reason: 'SQL_AUTHENTICATION_ERROR' } },
    { name: 'auth-more-data-without-plugin', source: authSwitch, error: () => driverError('AuthPluginMoreData received but no auth plugin instance found'), expected: { reason: 'SQL_AUTHENTICATION_ERROR' } },
    { name: 'callback-on-promise-client', source: 'mysql2/lib/promise/connection.js', error: () => driverError('Callback function is not available with promise clients.'), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'api misuse' } },
    { name: 'no-promise-implementation', source: promise, error: () => driverError("no Promise implementation available.Use promise-enabled node version or pass userland Promise implementation as parameter, for example: { Promise: require('bluebird') }"), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'api misuse' } },
    { name: 'column-named-like-a-private-property', source: 'mysql2/lib/helpers.js', error: () => driverError("The field name (__proto__) can't be the same as an object's private property."), expected: { reason: 'SQL_INVALID_SQL_STATEMENT', statementErrorType: 'invalid identifier' } },
    { name: 'values-not-an-array', source: connection, error: () => driverError('Bind parameters must be array if namedPlaceholders parameter is not enabled', {}, TypeError), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid binding' } },
    { name: 'undefined-value', source: connection, error: () => driverError('Bind parameters must not contain undefined. To pass SQL NULL specify JS null', {}, TypeError), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid value' } },
    { name: 'error-without-a-known-shape', source: 'any Error', error: () => driverError('x', { code: 'SOMETHING' }), expected: { reason: 'UNKNOWN' }, notSqlError: true },
    // A packet the protocol didn't expect is a driver / server condition, not a misuse of the API
    { name: 'unexpected-eof-packet', source: 'mysql2/lib/commands/query.js (protocolError)', error: () => driverError('Expected EOF packet', { code: 'PROTOCOL_ERROR', fatal: true }), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'engine internal' } },
    { name: 'packet-without-command', source: connection, error: () => driverError('Unexpected packet while no commands in the queue', { code: 'PROTOCOL_UNEXPECTED_PACKET', fatal: true }), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'engine internal' } },
    { name: 'unexpected-handshake-packet', source: handshake, error: () => driverError('Unexpected packet during handshake phase', { code: 'HANDSHAKE_UNKNOWN_ERROR', fatal: true }), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'engine internal' } },
    { name: 'unknown-length-coded-tag', source: 'mysql2/lib/packets/packet.js', error: () => driverError('Should not reach here: 251'), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'engine internal' } },
])
