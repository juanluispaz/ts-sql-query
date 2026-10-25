// Oracle engine errors (getOracleEngineErrorReason, behind the oracledb runners)
// the real-engine scenarios can't produce: the ORA- codes the Thin driver turns
// into NJS-500 (here as the engine reports them), and errors whose ORA- number
// no case maps, read from the message. Those are mostly wrappers whose message
// carries the error that caused them: ORA-12801 (a parallel query server
// failed), ORA-12008 (a materialized view refresh failed, possibly over a
// database link: ORA-02063).

import { getOracleEngineErrorReason, type OracleEngineError } from '../../../../src/queryRunners/databaseErrorMappers/OracleErrorMapper.js'
import { isOracleDBError } from '../../../../src/queryRunners/connectorErrorMappers/OracleDBErrorMapper.js'
import { describeSyntheticErrors, driverError } from './syntheticErrors.js'

const docs = 'Oracle Database Error Messages'

/** An ORA- error in the shape oracledb gives it: code, errorNum, offset, message with the Help link. */
function ora(errorNum: number, text: string, ...causes: string[]): Error {
    const code = 'ORA-' + String(errorNum).padStart(5, '0')
    const message = [code + ': ' + text, ...causes, 'Help: https://docs.oracle.com/error-help/db/' + code.toLowerCase() + '/'].join('\n')
    return driverError(message, { code, errorNum, offset: 0, isRecoverable: false })
}

const parallel = (cause: string): Error => ora(12801, 'error signaled in parallel query server P000, instance dbhost:FREE (1)', cause)
const refresh = (...causes: string[]): Error => ora(12008, 'error in materialized view or zonemap refresh path', ...causes)
const remote = 'ORA-02063: preceding line from RT_REMOTE'

function mapper() {
    return {
        getErrorReason: (error: unknown) => getOracleEngineErrorReason(error as OracleEngineError),
        isError: isOracleDBError,
    }
}

describeSyntheticErrors('oracle engine', mapper, [
    // The ORA- codes oracledb treats as a dropped connection, before the driver rewrites them.
    { name: 'ora-00600', source: docs, error: () => ora(600, 'internal error code, arguments: [kdsgrp1], [], [], [], [], [], [], [], [], [], [], []'), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'engine internal', databaseErrorCode: 'ORA-00600', databaseErrorNumber: 600 } },
    { name: 'ora-00603', source: docs, error: () => ora(603, 'ORACLE server session terminated by fatal error'), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'engine internal' } },
    { name: 'ora-01012', source: docs, error: () => ora(1012, 'not logged on'), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'connection lost', databaseErrorCode: 'ORA-01012', databaseErrorNumber: 1012 } },
    { name: 'ora-01041', source: docs, error: () => ora(1041, 'internal error. hostdef extension doesn\'t exist'), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'engine internal' } },
    { name: 'ora-01089', source: docs, error: () => ora(1089, 'immediate shutdown or close in progress - no operations are permitted'), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'temporarily unavailable' } },
    { name: 'ora-03113', source: docs, error: () => ora(3113, 'end-of-file on communication channel'), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'connection lost' } },
    { name: 'ora-03114', source: docs, error: () => ora(3114, 'not connected to ORACLE'), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'connection lost' } },
    { name: 'ora-03135', source: docs, error: () => ora(3135, 'connection lost contact'), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'connection lost' } },
    { name: 'ora-04030', source: docs, error: () => ora(4030, 'out of process memory when trying to allocate 16328 bytes (koh-kghu sessi,pmucalm coll)'), expected: { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'memory' } },
    { name: 'ora-12537', source: docs, error: () => ora(12537, 'TNS:connection closed'), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'connection lost' } },

    { name: 'pl-sql-compilation-error', source: docs, error: () => ora(6550, 'line 1, column 7:', 'PLS-00201: identifier \'RT_NOPE\' must be declared', 'ORA-06550: line 1, column 7:', 'PL/SQL: Statement ignored'), expected: { reason: 'SQL_ROUTINE_ERROR', databaseErrorNumber: 6550 } },
    { name: 'invalid-identifier-without-name', source: docs, error: () => ora(904, ': invalid identifier'), expected: { reason: 'SQL_INVALID_SQL_STATEMENT', statementErrorType: 'invalid identifier' } },
    { name: 'unmapped-number', source: docs, error: () => ora(24381, 'error(s) in array DML'), expected: { reason: 'SQL_UNKNOWN', databaseErrorCode: 'ORA-24381', databaseErrorNumber: 24381 } },

    // ORA- numbers no case maps: the reason comes from the message.
    { name: 'message.unique', source: docs, error: () => ora(1452, 'cannot CREATE UNIQUE INDEX; duplicate keys found'), expected: { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'unique', databaseErrorNumber: 1452 } },
    { name: 'message.foreign-key', source: docs, error: () => ora(2266, 'unique/primary keys in table referenced by enabled foreign keys'), expected: { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'foreign key' } },
    { name: 'message.check', source: docs, error: () => ora(2293, 'cannot validate (TSAPP.RT_PROBE_CK) - check constraint violated'), expected: { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'check', constraintName: 'RT_PROBE_CK' } },
    { name: 'message.not-null', source: docs, error: () => parallel('ORA-01400: cannot insert NULL into ("TSAPP"."RT_PROBE"."NAME")'), expected: { reason: 'SQL_CONSTRAINT_VIOLATED', constraintType: 'not null', tableName: 'RT_PROBE', columnName: 'NAME', databaseErrorNumber: 12801 } },
    { name: 'message.too-long', source: docs, error: () => parallel('ORA-12899: value too large for column "TSAPP"."RT_PROBE"."NAME" (actual: 12, maximum: 10)'), expected: { reason: 'SQL_INVALID_VALUE', errorType: 'too long', tableName: 'RT_PROBE', columnName: 'NAME' } },
    { name: 'message.out-of-range', source: docs, error: () => parallel('ORA-01438: value larger than specified precision allowed for this column'), expected: { reason: 'SQL_INVALID_VALUE', errorType: 'out of range' } },
    { name: 'message.invalid-json', source: docs, error: () => parallel('ORA-40441: JSON syntax error'), expected: { reason: 'SQL_INVALID_VALUE', errorType: 'invalid json' } },
    { name: 'message.invalid-xml', source: docs, error: () => parallel('ORA-31011: XML parsing failed'), expected: { reason: 'SQL_INVALID_VALUE', errorType: 'invalid xml' } },
    { name: 'message.invalid-regular-expression', source: docs, error: () => parallel('ORA-12726: unmatched bracket in regular expression'), expected: { reason: 'SQL_INVALID_VALUE', errorType: 'invalid regular expression' } },
    { name: 'message.invalid-format', source: docs, error: () => ora(1821, 'date format not recognized'), expected: { reason: 'SQL_INVALID_VALUE', errorType: 'invalid format' } },
    { name: 'message.invalid-value', source: docs, error: () => parallel('ORA-01722: invalid number'), expected: { reason: 'SQL_INVALID_VALUE', errorType: 'invalid value' } },
    { name: 'message.table-not-found', source: docs, error: () => refresh('ORA-00942: table or view does not exist'), expected: { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'table or view' } },
    { name: 'message.sequence-not-found', source: docs, error: () => refresh('ORA-02289: sequence does not exist'), expected: { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'sequence' } },
    { name: 'message.trigger-not-found', source: docs, error: () => refresh('ORA-04080: trigger \'RT_PROBE_BI\' does not exist'), expected: { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'trigger' } },
    { name: 'message.invalid-identifier', source: docs, error: () => refresh('ORA-00904: "RT_NOPE": invalid identifier'), expected: { reason: 'SQL_OBJECT_NOT_FOUND', objectType: 'column', columnName: 'RT_NOPE' } },
    { name: 'message.already-exists', source: docs, error: () => ora(27477, '"TSAPP"."RT_JOB" already exists'), expected: { reason: 'SQL_OBJECT_ALREADY_EXISTS', objectName: 'TSAPP.RT_JOB' } },
    { name: 'message.object-has-errors', source: docs, error: () => ora(4045, 'errors during recompilation/revalidation of TSAPP.RT_V', 'ORA-04063: view "TSAPP.RT_V" has errors'), expected: { reason: 'SQL_OBJECT_STATE_ERROR', objectStateErrorType: 'invalid state', objectType: 'table or view', objectName: 'TSAPP.RT_V' } },
    { name: 'message.ambiguous', source: docs, error: () => refresh('ORA-00918: column ambiguously defined'), expected: { reason: 'SQL_AMBIGUOUS_IDENTIFIER', identifierErrorType: 'ambiguous' } },
    { name: 'message.duplicate-column', source: docs, error: () => refresh('ORA-00957: duplicate column name'), expected: { reason: 'SQL_AMBIGUOUS_IDENTIFIER', identifierType: 'column', identifierErrorType: 'duplicate' } },
    { name: 'message.more-than-one-row', source: docs, error: () => parallel('ORA-01427: single-row subquery returns more than one row'), expected: { reason: 'SQL_CARDINALITY_VIOLATION' } },
    { name: 'message.division-by-zero', source: docs, error: () => parallel('ORA-01476: divisor is equal to zero'), expected: { reason: 'SQL_DIVISION_BY_ZERO' } },
    { name: 'message.deadlock', source: docs, error: () => ora(4020, 'deadlock detected while trying to lock object TSAPP.RT_PROBE'), expected: { reason: 'TRANSACTION_ERROR', transactionErrorType: 'deadlock' } },
    { name: 'message.serialization-failure', source: docs, error: () => parallel('ORA-08177: can\'t serialize access for this transaction'), expected: { reason: 'TRANSACTION_ERROR', transactionErrorType: 'serialization failure' } },
    { name: 'message.invalid-savepoint', source: docs, error: () => refresh('ORA-01086: savepoint \'RT_SP\' never established in this session or is invalid'), expected: { reason: 'TRANSACTION_ERROR', transactionErrorType: 'invalid savepoint' } },
    { name: 'message.lock-timeout', source: docs, error: () => refresh('ORA-00054: resource busy and acquire with NOWAIT specified or timeout expired'), expected: { reason: 'SQL_TIMEOUT', timeoutType: 'lock' } },
    { name: 'message.cancelled', source: docs, error: () => parallel('ORA-01013: user requested cancel of current operation'), expected: { reason: 'SQL_TIMEOUT', timeoutType: 'cancelled' } },
    { name: 'message.read-only', source: docs, error: () => ora(1647, 'tablespace \'RT_RO\' is read-only, cannot allocate space in it'), expected: { reason: 'SQL_READ_ONLY_VIOLATION' } },
    { name: 'message.account-locked', source: docs, error: () => refresh('ORA-28000: The account is locked.', remote), expected: { reason: 'SQL_AUTHENTICATION_ERROR' } },
    { name: 'message.insufficient-privileges', source: docs, error: () => refresh('ORA-01031: insufficient privileges'), expected: { reason: 'SQL_PERMISSION_DENIED' } },
    { name: 'message.connection-lost', source: docs, error: () => refresh('ORA-03113: end-of-file on communication channel', remote), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'connection lost' } },
    { name: 'message.unresolved-connect-identifier', source: docs, error: () => refresh('ORA-12154: TNS:could not resolve the connect identifier specified'), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'invalid connection configuration' } },
    { name: 'message.no-listener', source: docs, error: () => refresh('ORA-12541: TNS:no listener'), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'temporarily unavailable' } },
    { name: 'message.connect-timeout', source: docs, error: () => refresh('ORA-12170: TNS:Connect timeout occurred'), expected: { reason: 'SQL_TIMEOUT', timeoutType: 'connection' } },
    { name: 'message.too-many-sessions', source: docs, error: () => refresh('ORA-00018: maximum number of sessions exceeded', remote), expected: { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'connections' } },
    { name: 'message.out-of-memory', source: docs, error: () => parallel('ORA-04030: out of process memory when trying to allocate 16328 bytes (koh-kghu sessi,pmucalm coll)'), expected: { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'memory' } },
    { name: 'message.temp-space', source: docs, error: () => parallel('ORA-01652: unable to extend temp segment by 128 in tablespace TEMP'), expected: { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'temp space' } },
    { name: 'message.disk', source: docs, error: () => parallel('ORA-01653: unable to extend table TSAPP.RT_PROBE by 1024 in tablespace USERS'), expected: { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'disk' } },
    { name: 'message.corrupted-block', source: docs, error: () => parallel('ORA-01578: ORACLE data block corrupted (file # 7, block # 1234)'), expected: { reason: 'SQL_DATABASE_CORRUPTED', corruptionType: 'database file' } },
    { name: 'message.internal-error', source: docs, error: () => parallel('ORA-00600: internal error code, arguments: [kxfxsStatus], [], [], []'), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'engine internal' } },
    { name: 'message.feature-not-enabled', source: docs, error: () => refresh('ORA-00439: feature not enabled: Advanced replication'), expected: { reason: 'SQL_FEATURE_NOT_SUPPORTED' } },
    { name: 'message.invalid-grouping', source: docs, error: () => refresh('ORA-00979: not a GROUP BY expression'), expected: { reason: 'SQL_INVALID_SQL_STATEMENT', statementErrorType: 'invalid grouping' } },
    { name: 'message.type-mismatch', source: docs, error: () => parallel('ORA-00932: inconsistent datatypes: expected NUMBER got DATE'), expected: { reason: 'SQL_INVALID_SQL_STATEMENT', statementErrorType: 'type mismatch' } },
    { name: 'message.syntax', source: docs, error: () => refresh('ORA-00933: SQL command not properly ended'), expected: { reason: 'SQL_SYNTAX_ERROR', databaseErrorCode: 'ORA-12008', databaseErrorNumber: 12008 } },
])
