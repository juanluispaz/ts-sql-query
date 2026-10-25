// @electric-sql/pglite (PgLiteQueryRunner): the errors PGlite raises itself,
// without a SQLSTATE. Some of them are thrown as plain strings.

import { getPgLiteErrorReason, isPgLiteError } from '../../../../src/queryRunners/connectorErrorMappers/PgLiteErrorMapper.js'
import { describeSyntheticErrors, driverError } from './syntheticErrors.js'

const pglite = '@electric-sql/pglite src/pglite.ts'
const live = '@electric-sql/pglite src/live/index.ts'
const tarUtils = '@electric-sql/pglite src/fs/tarUtils.ts'
const initdb = '@electric-sql/pglite src/initdb.ts'

describeSyntheticErrors('pglite', () => ({ getErrorReason: getPgLiteErrorReason, isError: isPgLiteError }), [
    { name: 'invalid-boolean-parameter', source: '@electric-sql/pglite src/types.ts', error: () => driverError('Invalid input for boolean type'), expected: { reason: 'SQL_INVALID_VALUE', errorType: 'invalid value', typeName: 'boolean' } },
    { name: 'transaction-closed', source: '@electric-sql/pglite src/base.ts', error: () => driverError('Transaction is closed'), expected: { reason: 'TRANSACTION_ERROR', transactionErrorType: 'invalid state' } },
    { name: 'blob-read-without-blob', source: pglite, error: () => driverError('No /dev/blob File or Blob provided to read from'), expected: { reason: 'SQL_IO_ERROR', ioErrorType: 'read' } },
    { name: 'blob-seek-without-blob', source: pglite, error: () => driverError('No /dev/blob File or Blob provided to llseek'), expected: { reason: 'SQL_IO_ERROR', ioErrorType: 'seek' } },
    { name: 'extension-bundle-not-found', source: '@electric-sql/pglite src/extensionUtils.ts', error: () => driverError('Extension bundle not found: /app/vector.tar.gz'), expected: { reason: 'SQL_IO_ERROR', ioErrorType: 'file not found' } },
    { name: 'compression-not-supported', source: tarUtils, error: () => driverError('Compression not supported in this environment'), expected: { reason: 'SQL_FEATURE_NOT_SUPPORTED' } },
    { name: 'decompression-not-supported', source: tarUtils, error: () => driverError('Unsupported environment for decompression'), expected: { reason: 'SQL_FEATURE_NOT_SUPPORTED' } },
    { name: 'invalid-data-dir', source: '@electric-sql/pglite src/fs/index.ts', error: () => driverError('Invalid dataDir, must be a valid path'), expected: { reason: 'SQL_CONFIGURATION_ERROR', configurationErrorType: 'runtime parameter' } },
    { name: 'invalid-fs-bundle-size', source: pglite, error: () => driverError('Invalid FS bundle size: 1024 !== 2048'), expected: { reason: 'SQL_CONFIGURATION_ERROR', configurationErrorType: 'runtime parameter' } },
    { name: 'unknown-fs-package', source: pglite, error: () => driverError('Unknown package: pglite.data'), expected: { reason: 'SQL_CONFIGURATION_ERROR', configurationErrorType: 'runtime parameter' } },
    { name: 'load-tarball-over-existing-database', source: pglite, error: () => driverError('Database already exists, cannot load from tarball'), expected: { reason: 'SQL_CONFIGURATION_ERROR', configurationErrorType: 'runtime parameter' } },
    { name: 'initdb-failed', source: pglite, error: () => driverError('INITDB failed to initialize: initdb: error: invalid locale settings'), expected: { reason: 'SQL_CONFIGURATION_ERROR', configurationErrorType: 'runtime parameter' } },
    { name: 'bad-startup-argument-substitution', source: '@electric-sql/pglite src/argsParser.ts', error: () => driverError('Bad substitution: ${'), expected: { reason: 'SQL_CONFIGURATION_ERROR', configurationErrorType: 'runtime parameter' } },
    { name: 'live-offset-without-limit', source: live, error: () => driverError('offset and limit must be provided together'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'wrong count' } },
    { name: 'live-offset-not-a-number', source: live, error: () => driverError('offset and limit must be numbers'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid type' } },
    { name: 'live-offset-on-non-windowed-query', source: live, error: () => driverError('offset and limit cannot be provided for non-windowed queries'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid binding' } },
    { name: 'live-changes-without-key', source: live, error: () => driverError('key is required for changes queries'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'missing' } },
    { name: 'live-incremental-without-key', source: live, error: () => driverError('key is required for incremental queries'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'missing' } },
    { name: 'live-query-no-longer-active', source: live, error: () => driverError('Live query is no longer active and cannot be subscribed to'), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'api misuse' } },
    { name: 'unhandled-cmd', source: pglite, error: () => driverError('Unhandled cmd'), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'engine internal' } },
    { name: 'initdb-assertion-failed', source: initdb, error: () => driverError('Assertion failed'), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'engine internal' } },
    { name: 'single-mode-already-running', source: pglite, error: () => driverError('PGlite single mode already running'), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'engine internal' } },
    { name: 'failed-to-initialize', source: pglite, error: () => driverError('PGlite failed to initialize properly'), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'engine internal' } },
    { name: 'unknown-authentication-message', source: 'pg-protocol src/parser.ts (bundled in @electric-sql/pglite)', error: () => driverError('Unknown authenticationOk message type 99'), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'engine internal' } },
    { name: 'unhandled-pclose-string', source: pglite, error: () => 'Unhandled pclose 7', expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'engine internal' } },
    { name: 'unexpected-popen-mode-string', source: initdb, error: () => 'Unexpected popen mode value x', expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'engine internal' } },
    { name: 'unprocessable-startup-packet', source: pglite, error: () => driverError('Cannot process startup packet + 0,0,0,8'), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'engine internal' } },
    { name: 'error-without-a-known-shape', source: 'any Error', error: () => driverError('x', { code: 'SOMETHING' }), expected: { reason: 'UNKNOWN' }, notSqlError: true },
])
