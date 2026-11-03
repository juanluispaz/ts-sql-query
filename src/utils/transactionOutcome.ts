import { TsSqlError } from '../TsSqlError.js'

/**
 * Follows a transaction the database can roll back by itself, with no rollback asked for: a deadlock, an error that
 * dooms the transaction, a conflict clause that rolls it back. The statements that would follow run outside any
 * transaction, each one committed at once, and the commit would find nothing to commit. A query runner that can tell
 * the database rolled the transaction back reports it here; from then on, the statements that follow and the commit
 * fail without being sent, caused by the statement that ended the transaction, and the rollback sends nothing.
 */
export class TransactionOutcome {
    protected firstFailedStatement: unknown
    private endingStatement: unknown
    private rolledBack = false

    /** A statement of the transaction failed */
    statementFailed(error: unknown, inTransaction: boolean): void {
        if (inTransaction && this.firstFailedStatement === undefined) {
            this.firstFailedStatement = error
        }
    }

    /** The database rolled the transaction back, when the statement given failed (or the first one that failed) */
    rolledBackByTheDatabase(endingStatement?: unknown): void {
        this.rolledBack = true
        if (this.endingStatement === undefined) {
            this.endingStatement = endingStatement
        }
    }

    isRolledBackByTheDatabase(): boolean {
        return this.rolledBack
    }

    /** The error a statement or the commit of the transaction the database rolled back fails with */
    rolledBackError(): TsSqlError {
        const message = 'The database rolled back the transaction, because a statement of the transaction failed: nothing of the transaction was saved'
        const reason = { reason: 'TRANSACTION_ERROR', transactionErrorType: 'transaction rolled back' } as const
        const cause = this.endingStatement === undefined ? this.firstFailedStatement : this.endingStatement
        return cause === undefined ? new TsSqlError(reason, message) : new TsSqlError(reason, message, cause)
    }

    /**
     * For a transaction the driver commits: the error to end the transaction's function with, so the driver rolls it
     * back instead of committing it
     */
    failureOfTheTransaction(): TsSqlError | undefined {
        return this.rolledBack ? this.rolledBackError() : undefined
    }

    /** Whether the database already rolled the transaction back, so the rollback has nothing to send; ends the transaction */
    rollbackAlreadyDone(): boolean {
        const done = this.rolledBack
        this.transactionEnded()
        return done
    }

    /** The transaction ended: nothing of it is kept for the next one */
    transactionEnded(): void {
        this.firstFailedStatement = undefined
        this.endingStatement = undefined
        this.rolledBack = false
    }
}
