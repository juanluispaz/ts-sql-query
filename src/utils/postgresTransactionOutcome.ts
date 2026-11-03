import { TsSqlError } from '../TsSqlError.js'

/**
 * PostgreSQL leaves a transaction failed when one of its statements fails, even if the error is caught: the statements
 * that follow are rejected, and the commit is answered ROLLBACK, not an error. A PostgreSQL query runner follows its
 * transaction with this, so that such a commit fails, caused by the statement that failed, and so that the rollback
 * that follows sends nothing (there is no transaction left, PostgreSQL would only warn about it).
 */
export class PostgresTransactionOutcome {
    private failedStatement: unknown
    private rolledBackByTheDatabase = false

    /** A statement failed: the first one of the transaction is the cause when the transaction is rolled back */
    statementFailed(error: unknown, inTransaction: boolean): void {
        if (inTransaction && this.failedStatement === undefined) {
            this.failedStatement = error
        }
    }

    /** Checks the answer to the commit: it throws when the database rolled the transaction back instead */
    checkCommit(command: unknown): void {
        if (command === 'ROLLBACK') {
            this.rolledBackByTheDatabase = true
            throw this.rolledBackError()
        }
        this.transactionEnded()
    }

    /** Whether the database already rolled the transaction back, so the rollback has nothing to send; ends the transaction */
    rollbackAlreadyDone(): boolean {
        const done = this.rolledBackByTheDatabase
        this.transactionEnded()
        return done
    }

    /**
     * For a transaction the driver commits: the error to end the transaction's function with, so the driver rolls it
     * back, when one of its statements failed; ends the transaction
     */
    failureOfTheTransaction(): TsSqlError | undefined {
        const error = this.failedStatement === undefined ? undefined : this.rolledBackError()
        this.transactionEnded()
        return error
    }

    private rolledBackError(): TsSqlError {
        const message = 'The database rolled back the transaction instead of committing it: a statement of the transaction failed'
        const reason = { reason: 'TRANSACTION_ERROR', transactionErrorType: 'transaction rolled back' } as const
        return this.failedStatement === undefined ? new TsSqlError(reason, message) : new TsSqlError(reason, message, this.failedStatement)
    }

    /** The transaction ended: nothing of it is kept for the next one */
    transactionEnded(): void {
        this.failedStatement = undefined
        this.rolledBackByTheDatabase = false
    }
}
