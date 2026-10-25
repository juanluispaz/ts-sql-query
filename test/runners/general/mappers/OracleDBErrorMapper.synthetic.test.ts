// oracledb (OracleDBQueryRunner, OracleDBPoolQueryRunner): the NJS-, DPI- and
// wrapped ORA- errors the driver raises itself. A Thin mode driver error has
// `code` and `isRecoverable`; a Thick mode ODPI-C error also has `errorNum` 0
// and `offset`; an ORA- error the driver treats as a dropped connection keeps
// its `errorNum` but gets the NJS-500 code and message in front of its own.

import { getOracleDBErrorReason, isOracleDBError } from '../../../../src/queryRunners/connectorErrorMappers/OracleDBErrorMapper.js'
import { describeSyntheticErrors, driverError, type SyntheticErrorCase } from './syntheticErrors.js'

const errors = 'oracledb/lib/errors.js'
const odpi = 'ODPI-C error messages (oracledb Thick mode binary)'

/** A Thin mode driver error, as `errors.getErr()` builds it. */
function njs(code: string, text: string): Error {
    return driverError(code + ': ' + text, { code, isRecoverable: code === 'NJS-500' })
}

/** A Thick mode ODPI-C error. */
function dpi(code: string, text: string): Error {
    return driverError(code + ': ' + text, { code, errorNum: 0, offset: 0, isRecoverable: false })
}

/** An ORA- error the Thin driver received and `errors.transformErr()` rewrote as NJS-500. */
function droppedConnection(errorNum: number, text: string): Error {
    const ora = 'ORA-' + String(errorNum).padStart(5, '0')
    const original = ora + ': ' + text + '\nHelp: https://docs.oracle.com/error-help/db/' + ora.toLowerCase() + '/'
    return driverError('NJS-500: connection to Oracle Database was closed or broken\n' + original, { code: 'NJS-500', errorNum, offset: 0, isRecoverable: true })
}

const droppedConnectionErrors: ReadonlyArray<readonly [number, string]> = [
    [600, 'internal error code, arguments: [kdsgrp1], [], [], [], [], [], [], [], [], [], [], []'],
    [603, 'ORACLE server session terminated by fatal error'],
    [1012, 'not logged on'],
    [1041, 'internal error. hostdef extension doesn\'t exist'],
    [1089, 'immediate shutdown or close in progress - no operations are permitted'],
    [3113, 'end-of-file on communication channel'],
    [3114, 'not connected to ORACLE'],
    [3135, 'connection lost contact'],
    [4030, 'out of process memory when trying to allocate 16328 bytes (koh-kghu sessi,pmucalm coll)'],
    [12537, 'TNS:connection closed'],
]

const droppedConnectionCases: SyntheticErrorCase[] = droppedConnectionErrors.map(([errorNum, text]) => ({
    name: 'dropped-connection-ora-' + String(errorNum).padStart(5, '0'),
    source: 'oracledb/lib/errors.js (adjustErrorXref), oracledb/lib/thin/protocol/protocol.js',
    error: () => droppedConnection(errorNum, text),
    expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'connection lost', databaseErrorCode: 'NJS-500' },
}))

describeSyntheticErrors('oracledb', () => ({ getErrorReason: getOracleDBErrorReason, isError: isOracleDBError }), [
    { name: 'not-a-driver-error', source: 'any Error', error: () => driverError('Cannot read properties of undefined (reading \'execute\')', {}, TypeError), expected: { reason: 'UNKNOWN' }, notSqlError: true },

    { name: 'invalid-parameter-value', source: errors, error: () => njs('NJS-005', 'invalid value for parameter 2'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid value', databaseErrorCode: 'NJS-005' } },
    { name: 'wrong-argument-count', source: errors, error: () => njs('NJS-009', 'invalid number of function parameters: 4 provided but expected between 1 and 3'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'wrong count', actualParameterCount: 4 } },
    { name: 'wrong-bind-count', source: errors, error: () => njs('NJS-098', '2 bind placeholders were used in the SQL statement but 1 bind values were provided'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'wrong count', expectedParameterCount: 2, actualParameterCount: 1 } },
    { name: 'missing-bind-value', source: errors, error: () => njs('NJS-137', 'a bind variable replacement value for placeholder ":ID" was not provided'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'missing', parameterName: 'ID' } },
    { name: 'invalid-bind-data-type', source: errors, error: () => njs('NJS-012', 'encountered invalid bind data type in parameter 2'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid type' } },
    { name: 'invalid-bind-object', source: errors, error: () => njs('NJS-044', 'bind object must contain one of the following attributes: "dir", "type", "maxSize", or "val"'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid binding' } },
    { name: 'bind-in-ddl', source: odpi, error: () => dpi('DPI-1059', 'bind variables are not supported in DDL statements'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'not bindable', databaseErrorCode: 'DPI-1059' } },
    { name: 'collection-index-out-of-range', source: 'oracledb/lib/thin/dbObject.js', error: () => njs('NJS-131', 'given index [5] must be in the range of [0] to [3]'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid index', parameterIndex: 5 } },

    { name: 'concurrent-operations-disabled', source: errors, error: () => njs('NJS-081', 'concurrent operations on a connection are disabled'), expected: { reason: 'FORBIDDEN_CONCURRENT_USAGE', databaseErrorCode: 'NJS-081' } },

    ...droppedConnectionCases,

    { name: 'pool-queue-timeout', source: errors, error: () => njs('NJS-040', 'connection request timeout. Request exceeded "queueTimeout" of 60000'), expected: { reason: 'SQL_TIMEOUT', timeoutType: 'connection', databaseErrorCode: 'NJS-040' } },
    { name: 'pool-queue-full', source: errors, error: () => njs('NJS-076', 'connection request rejected. Pool queue length "queueMax" 500 reached'), expected: { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'pool' } },
    { name: 'out-of-memory', source: odpi, error: () => dpi('DPI-1001', 'out of memory'), expected: { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'memory', databaseErrorCode: 'DPI-1001' } },
    { name: 'not-implemented-in-thin-mode', source: errors, error: () => njs('NJS-089', 'getting a SODA database is not supported by node-oracledb in Thin mode'), expected: { reason: 'SQL_FEATURE_NOT_SUPPORTED' } },
    { name: 'delete-from-varray', source: 'oracledb/lib/thin/dbObject.js', error: () => njs('NJS-133', 'cannot delete elements of a VARRAY'), expected: { reason: 'SQL_FEATURE_NOT_SUPPORTED' } },
    { name: 'result-set-for-non-query', source: errors, error: () => njs('NJS-019', 'ResultSet cannot be returned for non-query statements'), expected: { reason: 'SQL_INVALID_SQL_STATEMENT', statementErrorType: 'invalid statement context' } },
    { name: 'nan-bind-value', source: errors, error: () => njs('NJS-105', 'value is not a number (NaN) and cannot be used in Oracle Database numbers'), expected: { reason: 'SQL_INVALID_VALUE', errorType: 'invalid value' } },
    { name: 'number-not-representable', source: errors, error: () => njs('NJS-115', 'value cannot be represented as an Oracle Database number'), expected: { reason: 'SQL_INVALID_VALUE', errorType: 'out of range' } },
    { name: 'object-attribute-too-long', source: errors, error: () => njs('NJS-142', 'value too large for attribute NAME of object TSAPP.PERSON_T (actual: 40, maximum: 30)'), expected: { reason: 'SQL_INVALID_VALUE', errorType: 'too long' } },
    { name: 'invalid-result-set', source: errors, error: () => njs('NJS-018', 'invalid ResultSet'), expected: { reason: 'SQL_OBJECT_STATE_ERROR', objectStateErrorType: 'invalid state', objectType: 'cursor' } },
    { name: 'object-not-a-collection', source: errors, error: () => njs('NJS-146', 'object TSAPP.PERSON_T is not a collection'), expected: { reason: 'SQL_OBJECT_STATE_ERROR', objectStateErrorType: 'wrong object type' } },
    { name: 'no-sessionless-transaction', source: 'oracledb/lib/thin/connection.js', error: () => njs('NJS-172', 'No sessionless transaction is active'), expected: { reason: 'NOT_IN_TRANSACTION', databaseErrorCode: 'NJS-172' } },
    { name: 'sessionless-transaction-already-active', source: 'oracledb/lib/thin/connection.js', error: () => njs('NJS-171', 'Suspend, commit or rollback the currently active sessionless transaction before beginning or resuming another one.'), expected: { reason: 'TRANSACTION_ERROR', transactionErrorType: 'active transaction' } },
    { name: 'access-token-expired', source: errors, error: () => njs('NJS-087', 'access token has expired'), expected: { reason: 'SQL_AUTHENTICATION_ERROR' } },
    { name: 'nls-environment-unreadable', source: odpi, error: () => dpi('DPI-1052', 'unable to get NLS environment variable'), expected: { reason: 'SQL_CONFIGURATION_ERROR', configurationErrorType: 'runtime parameter' } },
    { name: 'created-with-compilation-errors', source: 'oracledb/lib/connection.js (result.warning)', error: () => driverError('NJS-700: creation succeeded with compilation errors\nORA-24344: success with compilation error\nHelp: https://docs.oracle.com/error-help/db/ora-24344/', { code: 'NJS-700', errorNum: 24344 }), expected: { reason: 'SQL_ROUTINE_ERROR', databaseErrorCode: 'NJS-700' } },
    { name: 'os-error', source: odpi, error: () => dpi('DPI-1075', 'OS error: No such file or directory'), expected: { reason: 'SQL_IO_ERROR', ioErrorType: 'unknown' } },
    { name: 'invalid-handle', source: odpi, error: () => dpi('DPI-1002', 'invalid dpiStmt handle'), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'api misuse' } },
    { name: 'object-attribute-not-found', source: odpi, error: () => dpi('DPI-1022', 'attribute AGE is not part of object type TSAPP.PERSON_T'), expected: { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'column', columnName: 'AGE', databaseErrorCode: 'DPI-1022' } },

    // A bind value whose name has no placeholder in the statement: an unknown name, not a missing value.
    { name: 'bind-name-not-in-statement', source: errors, error: () => njs('NJS-097', 'no bind placeholder named ":ID" was found in the statement text'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'invalid name', parameterName: 'ID' } },
    // getDbObjectClass() on a type that doesn't exist; Thick mode reports it as NJS-129 with the OCI-22303 below.
    { name: 'object-type-not-found', source: 'oracledb/lib/thin/connection.js', error: () => njs('NJS-129', 'invalid object type name: "TSAPP.NOPE_T"'), expected: { reason: 'SQL_OBJECT_NOT_FOUND' } },
    // A configuration provider hook failed while createPool() / getConnection() resolved the connection settings.
    { name: 'configuration-hook-failed', source: 'oracledb/lib/oracledb.js', error: () => njs('NJS-169', 'External function call failed.'), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration' } },
    // Protocol failures inside the driver, not a misuse of its API.
    { name: 'unexpected-message-type', source: errors, error: () => njs('NJS-103', 'unexpected message type 99 received at position 10 of packet 3'), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'engine internal' } },
    { name: 'malformed-packet', source: errors, error: () => njs('NJS-509', 'internal error: invalid packet type or malformed packet received'), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'engine internal' } },
    // The wallet file named by the connection settings, read by the Thin driver with fs.readFile().
    { name: 'wallet-file-missing', source: 'oracledb/lib/thin/sqlnet/sessionAtts.js', error: () => driverError('ENOENT: no such file or directory, open \'/opt/oracle/wallet/ewallet.pem\'', { errno: -2, code: 'ENOENT', syscall: 'open', path: '/opt/oracle/wallet/ewallet.pem' }), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration' } },
])
