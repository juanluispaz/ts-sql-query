// The PostgreSQL engine mapper shared by every PostgreSQL connector, called
// with what a connector hands it: no SQLSTATE at all, a SQLSTATE no error
// should carry, and SQLSTATEs the catalog doesn't list (a newer server, or a
// RAISE ... USING ERRCODE), which the class of the code decides.

import { getPostgresEngineErrorReason } from '../../../../src/queryRunners/databaseErrorMappers/PostgresErrorMapper.js'
import type { PostgresEngineError } from '../../../../src/queryRunners/databaseErrorMappers/PostgresErrorMapper.js'
import { describeSyntheticErrors } from './syntheticErrors.js'

const appendixA = 'PostgreSQL Appendix A, SQLSTATE classes'

function engineError(sqlState: string | undefined, message: string): PostgresEngineError {
    return { sqlState, databaseErrorNumber: sqlState, message }
}

describeSyntheticErrors('postgres engine', () => ({ getErrorReason: error => getPostgresEngineErrorReason(error as PostgresEngineError), isError: () => true }), [
    { name: 'without-sqlstate', source: 'a connector error without a SQLSTATE', error: () => engineError(undefined, 'something the driver said'), expected: { reason: 'SQL_UNKNOWN', databaseErrorMessage: 'something the driver said' } },
    { name: 'successful-completion', source: appendixA + ' (00)', error: () => engineError('00000', 'nothing went wrong'), expected: { reason: 'SQL_INTERNAL_ERROR', errorType: 'engine internal', databaseErrorCode: 'successful_completion', databaseErrorNumber: '00000' } },
    { name: 'more-parameters-than-the-protocol-counts', source: 'PostgreSQL src/backend/tcop/postgres.c', error: () => engineError('08P01', 'bind message supplies 0 parameters, but prepared statement "" requires 65536'), expected: { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'parameters', limit: 65535, databaseErrorNumber: '08P01' } },
    { name: 'bind-message-with-fewer-parameters', source: 'PostgreSQL src/backend/tcop/postgres.c', error: () => engineError('08P01', 'bind message supplies 1 parameters, but prepared statement "" requires 2'), expected: { reason: 'SQL_INVALID_PARAMETER', parameterErrorType: 'wrong count', actualParameterCount: 1, expectedParameterCount: 2 } },
    { name: 'too-many-select-columns', source: 'PostgreSQL src/backend/parser/parse_target.c', error: () => engineError('54011', 'target lists can have at most 1664 entries'), expected: { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'statement elements', limit: 1664 } },
    { name: 'too-many-function-arguments', source: 'PostgreSQL src/backend/parser/parse_func.c', error: () => engineError('54023', 'cannot pass more than 100 arguments to a function'), expected: { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'statement elements', limit: 100 } },
    { name: 'statement-too-complex', source: 'PostgreSQL src/backend/tcop/postgres.c', error: () => engineError('54001', 'stack depth limit exceeded'), expected: { reason: 'SQL_RESOURCE_LIMIT_REACHED', resourceType: 'statement complexity' } },
    { name: 'protocol-violation', source: 'PostgreSQL src/backend/tcop/postgres.c', error: () => engineError('08P01', 'invalid frontend message type 0'), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'connection lost', databaseErrorCode: 'protocol_violation', databaseErrorNumber: '08P01' } },
    { name: 'unlisted-invalid-transaction-state', source: appendixA + ' (25)', error: () => engineError('25P99', 'transaction in an unexpected state'), expected: { reason: 'TRANSACTION_ERROR', transactionErrorType: 'invalid state', databaseErrorNumber: '25P99' } },
    { name: 'unlisted-savepoint-exception', source: appendixA + ' (3B)', error: () => engineError('3BP99', 'savepoint in an unexpected state'), expected: { reason: 'TRANSACTION_ERROR', transactionErrorType: 'invalid savepoint', databaseErrorNumber: '3BP99' } },
    { name: 'unlisted-transaction-rollback', source: appendixA + ' (40)', error: () => engineError('40P99', 'transaction rolled back'), expected: { reason: 'TRANSACTION_ERROR', transactionErrorType: 'transaction rolled back', databaseErrorNumber: '40P99' } },
    { name: 'unlisted-syntax-or-access-rule', source: appendixA + ' (42)', error: () => engineError('42P99', 'statement not allowed'), expected: { reason: 'SQL_INVALID_SQL_STATEMENT', databaseErrorNumber: '42P99' } },
    { name: 'unlisted-insufficient-resources', source: appendixA + ' (53)', error: () => engineError('53P99', 'out of a resource'), expected: { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorNumber: '53P99' } },
    { name: 'unlisted-program-limit-exceeded', source: appendixA + ' (54)', error: () => engineError('54P99', 'limit exceeded'), expected: { reason: 'SQL_RESOURCE_LIMIT_REACHED', databaseErrorNumber: '54P99' } },
    { name: 'unlisted-object-not-in-prerequisite-state', source: appendixA + ' (55)', error: () => engineError('55P99', 'object not ready'), expected: { reason: 'SQL_OBJECT_STATE_ERROR', objectStateErrorType: 'invalid state', databaseErrorNumber: '55P99' } },
    { name: 'unlisted-operator-intervention', source: appendixA + ' (57)', error: () => engineError('57P99', 'terminating connection'), expected: { reason: 'SQL_CONNECTION_ERROR', errorType: 'connection lost', databaseErrorNumber: '57P99' } },
    { name: 'unknown-class', source: appendixA + ' (a class PostgreSQL does not define)', error: () => engineError('ZZ999', 'custom failure'), expected: { reason: 'SQL_UNKNOWN', databaseErrorNumber: 'ZZ999', databaseErrorMessage: 'custom failure' } },
])
