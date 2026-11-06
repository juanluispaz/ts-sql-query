import { ManagedTransactionQueryRunner } from './ManagedTransactionQueryRunner.js'
import type { BeginTransactionOpts, CommitOpts, RollbackOpts } from './QueryRunner.js'
import { TsSqlProcessingError } from "../TsSqlError.js"
import { databaseIsolationLevel } from '../utils/transactionIsolationLevel.js'

export abstract class DelegatedSetTransactionQueryRunner extends ManagedTransactionQueryRunner {
    private transactionLevel = 0
    executeBeginTransaction(opts: BeginTransactionOpts = []): Promise<void> {
        const transactionLevel = this.transactionLevel
        if (!this.nestedTransactionsSupported() && transactionLevel >= 1) {
            return this.createRejectedPromise(new TsSqlProcessingError({ reason: 'NESTED_TRANSACTION_NOT_SUPPORTED' }, this.database + " doesn't support nested transactions (using " + this.constructor.name + ")"))
        }


        let sql: string | undefined
        // Validate before begin the transaction
        try {
            sql = this.createSetTransactionQuery(opts)
        } catch (error) {
            return this.createRejectedPromise(error)
        }

        // `SET TRANSACTION` must be the statement that opens the next transaction, so it
        // is issued on the connection before `BEGIN`.
        const afterSetTransaction = sql
            ? this.doSetTransaction(sql, opts).then(() => this.doBeginTransaction(opts))
            : this.doBeginTransaction(opts)
        return afterSetTransaction.then(() => {
            this.transactionLevel++
            if (this.transactionLevel !== transactionLevel + 1) {
                throw new TsSqlProcessingError({ reason: 'FORBIDDEN_CONCURRENT_USAGE' }, 'Forbidden concurrent usage of the query runner was detected when it tried to start a transaction.')
            }
            return undefined
        })
    }
    abstract doBeginTransaction(opts: BeginTransactionOpts): Promise<void>
    doSetTransaction(sql: string, _opts: BeginTransactionOpts): Promise<void> {
        return this.executeMutation(sql, []).then(() => undefined)
    }
    executeCommit(opts: CommitOpts = []): Promise<void> {
        if (this.transactionLevel <= 0 && this.validateIntransaction()) {
            return this.createRejectedPromise(new TsSqlProcessingError({ reason: 'NOT_IN_TRANSACTION' }, 'Not in an transaction, you cannot commit the transaction'))
        }
        if (this.transactionOutcome.isRolledBackByTheDatabase()) {
            return this.createRejectedPromise(this.transactionOutcome.rolledBackError())
        }

        return this.doCommit(opts).then(() => {
            // Transaction count only modified when commit successful, in case of error there is still an open transaction 
            this.transactionOutcome.transactionEnded()
            this.transactionLevel--
            if (this.transactionLevel < 0) {
                this.transactionLevel = 0
            }
            return undefined
        })
    }
    abstract doCommit(opts: CommitOpts): Promise<void>
    executeRollback(opts: RollbackOpts = []): Promise<void> {
        if (this.transactionLevel <= 0 && this.validateIntransaction()) {
            return this.createRejectedPromise(new TsSqlProcessingError({ reason: 'NOT_IN_TRANSACTION' }, 'Not in an transaction, you cannot rollback the transaction'))
        }
        if (this.transactionOutcome.rollbackAlreadyDone()) {
            this.transactionLevel--
            if (this.transactionLevel < 0) {
                this.transactionLevel = 0
            }
            return this.createResolvedPromise(undefined)
        }

        return this.doRollback(opts).then(() => {
            this.transactionLevel--
            if (this.transactionLevel < 0) {
                this.transactionLevel = 0
            }
            return undefined
        }, (error) => {
            this.transactionLevel--
            if (this.transactionLevel < 0) {
                this.transactionLevel = 0
            }
            throw error
        })
    }
    abstract doRollback(opts: RollbackOpts): Promise<void>
    validateIntransaction(): boolean {
        return true
    }
    isTransactionActive(): boolean {
        return this.transactionLevel > 0
    }
    createSetTransactionQuery(opts: BeginTransactionOpts): string | undefined {
        const level = this.getTransactionLevel(opts)
        const accessMode = this.getTransactionAccessMode(opts)
        if (!level && !accessMode) {
            return undefined
        }

        let sql = 'set transaction'
        if (level) {
            sql += ' isolation level ' + level
        }
        if (accessMode) {
            sql += level ? ', ' : ' '
            sql += accessMode
        }
        return sql
    }
    getTransactionLevel(opts: BeginTransactionOpts): string | undefined {
        return databaseIsolationLevel(this.database, opts[0])
    }
    getTransactionAccessMode(opts: BeginTransactionOpts): string | undefined {
        const accessMode = opts[1]
        if (this.database === 'sqlite' && accessMode) {
            throw new TsSqlProcessingError({ reason: 'TRANSACTION_ACCESS_MODE_NOT_SUPPORTED', accessMode }, this.database + " doesn't support the transactions access mode: " + accessMode)
        }
        if (!accessMode || accessMode === 'read write' || accessMode === 'read only') {
            return accessMode
        }
        throw new TsSqlProcessingError({ reason: 'TRANSACTION_ACCESS_MODE_NOT_SUPPORTED', accessMode }, this.database + " doesn't support the transactions access mode: " + accessMode)
    }
}
