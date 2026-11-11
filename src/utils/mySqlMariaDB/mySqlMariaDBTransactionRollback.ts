import type { TsSqlErrorReason } from '../../TsSqlError.js'

/**
 * Whether MySQL or MariaDB keep the transaction open after a statement of it failed for the reason given: the victim
 * of a deadlock has its whole transaction rolled back; any other error rolls back only that statement (a lock wait
 * timeout too, unless the server runs with innodb_rollback_on_timeout, which a query runner can't see without asking
 * the server). Undefined when the transaction is kept or it can't be told.
 */
export function isTransactionOpenAfterMySqlMariaDBError(reason: TsSqlErrorReason): false | undefined {
    return reason.reason === 'TRANSACTION_ERROR' && reason.transactionErrorType === 'deadlock' ? false : undefined
}
