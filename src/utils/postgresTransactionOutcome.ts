import type { TsSqlError } from '../TsSqlError.js'
import { TransactionOutcome } from './transactionOutcome.js'

/**
 * PostgreSQL leaves a transaction failed when one of its statements fails, even if the error is caught: the statements
 * that follow are rejected, and the commit is answered ROLLBACK, not an error. A PostgreSQL query runner follows its
 * transaction with this, so that such a commit fails, caused by the first statement that failed, and so that the
 * rollback that follows sends nothing (there is no transaction left, PostgreSQL would only warn about it).
 */
export class PostgresTransactionOutcome extends TransactionOutcome {
    /** Checks the answer to the commit: it throws when the database rolled the transaction back instead */
    checkCommit(command: unknown): void {
        if (command === 'ROLLBACK') {
            this.rolledBackByTheDatabase()
            throw this.rolledBackError()
        }
        this.transactionEnded()
    }

    /**
     * The commit of a transaction one of whose statements failed is answered ROLLBACK: a driver that commits by itself
     * and takes that answer as a success is made to roll it back instead
     */
    override failureOfTheTransaction(): TsSqlError | undefined {
        return this.firstFailedStatement === undefined ? super.failureOfTheTransaction() : this.rolledBackError()
    }
}
