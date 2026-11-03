import { AbstractQueryRunner } from './AbstractQueryRunner.js'
import type { BeginTransactionOpts, QueryRunner } from './QueryRunner.js'
import { TsSqlQueryExecutionError } from '../TsSqlError.js'
import { TransactionOutcome } from '../utils/transactionOutcome.js'

export abstract class ManagedTransactionQueryRunner extends AbstractQueryRunner {
    /** Whether the database rolled the current transaction back by itself */
    protected readonly transactionOutcome: TransactionOutcome = new TransactionOutcome()

    executeInTransaction<T>(fn: () => Promise<T>, outermostQueryRunner: QueryRunner, opts: BeginTransactionOpts = []): Promise<T> {
        return outermostQueryRunner.executeBeginTransaction(opts).then(() => {
            let result = fn()
            return result.then((r) => {
                return outermostQueryRunner.executeCommit(opts as any).then(() => {
                    return r
                })
            }).catch((e) => {
                return outermostQueryRunner.executeRollback(opts as any).then(() => {
                    throw e
                }, (innerError) => {
                    if (e instanceof TsSqlQueryExecutionError) {
                        e.attachRollbackError(innerError)
                    }
                    // Throw the innermost error
                    throw e
                })
            })
        })
    }

    /**
     * Whether the database still has the transaction open, asked after one of its statements failed; undefined when
     * the query runner can't tell. Some errors make the database roll the whole transaction back by itself (a
     * deadlock, a conflict clause that rolls back): the statements that follow would run outside any transaction,
     * each one committed at once.
     */
    protected isTransactionOpenInTheDatabase(): boolean | undefined | Promise<boolean | undefined> {
        return undefined
    }
    /** Rejects a statement of a transaction the database already rolled back, before it is sent */
    protected rejectWhenRolledBackByTheDatabase(): Promise<never> | undefined {
        if (this.isTransactionActive() && this.transactionOutcome.isRolledBackByTheDatabase()) {
            return this.createRejectedPromise(this.transactionOutcome.rolledBackError())
        }
        return undefined
    }
    /** A statement failed: inside a transaction, it checks whether the database rolled the transaction back with it */
    protected statementOfTheTransactionFailed<T>(error: unknown): Promise<T> {
        if (!this.isTransactionActive()) {
            return this.createRejectedPromise(error)
        }
        this.transactionOutcome.statementFailed(error, true)
        let open
        try {
            open = this.isTransactionOpenInTheDatabase()
        } catch {
            return this.createRejectedPromise(error)
        }
        return this.createResolvedPromise(open).then((open) => {
            if (open === false && this.isTransactionActive()) {
                this.transactionOutcome.rolledBackByTheDatabase(error)
            }
            throw error
        }, () => {
            throw error
        })
    }
}
