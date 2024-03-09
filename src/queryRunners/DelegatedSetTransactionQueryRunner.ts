import { ManagedTransactionQueryRunner } from "./ManagedTransactionQueryRunner"
import { BeginTransactionOpts, CommitOpts, RollbackOpts } from "./QueryRunner"

export abstract class DelegatedSetTransactionQueryRunner extends ManagedTransactionQueryRunner {
    private transactionLevel = 0
    executeBeginTransaction(opts: BeginTransactionOpts = []): Promise<void> {
        const transactionLevel = this.transactionLevel
        if (!this.nestedTransactionsSupported() && transactionLevel >= 1) {
            return this.createRejectedPromise(new Error(this.database + " doesn't support nested transactions (using " + this.constructor.name + ")"))
        }


        let sql: string | undefined
        // Validate before begin the transaction
        try {
            sql = this.createSetTransactionQuery(opts)
        } catch (error) {
            return this.createRejectedPromise(error)
        }

        return this.doBeginTransaction(opts).then(() => {
            this.transactionLevel++
            if (this.transactionLevel !== transactionLevel + 1) {
                throw new Error('Forbidden concurrent usage of the query runner was detected when it tried to start a transaction.')
            }
            if (!sql) {
                return undefined
            } else {
                return this.doSetTransaction(sql, opts)
            }
        })
    }
    abstract doBeginTransaction(opts: BeginTransactionOpts): Promise<void>
    doSetTransaction(sql: string, _opts: BeginTransactionOpts): Promise<void> {
        return this.executeMutation(sql, []).then(() => undefined)
    }
    executeCommit(opts: CommitOpts = []): Promise<void> {
        if (this.transactionLevel <= 0 && this.validateIntransaction()) {
            return Promise.reject(new Error('Not in an transaction, you cannot commit the transaction'))
        }

        return this.doCommit(opts).then(() => {
            // Transaction count only modified when commit successful, in case of error there is still an open transaction 
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
            return Promise.reject(new Error('Not in an transaction, you cannot rollback the transaction'))
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
            if (sql) {
                sql += ', '
            }
            sql += accessMode
        }
        return sql
    }
    getTransactionLevel(opts: BeginTransactionOpts): string | undefined {
        const level = opts[0]
        if (this.database === 'sqlite' && level) {
            throw new Error(this.database + " doesn't support the transactions level: " + level)
        }
        if (!level || level === 'read uncommitted' || level === 'read committed' || level === 'repeatable read' || level === 'serializable') {
            return level
        }
        throw new Error(this.database + " doesn't support the transactions level: " + level)
    }
    getTransactionAccessMode(opts: BeginTransactionOpts): string | undefined {
        const accessMode = opts[1]
        if (this.database === 'sqlite' && accessMode) {
            throw new Error(this.database + " doesn't support the transactions access mode: " + accessMode)
        }
        if (!accessMode || accessMode === 'read write' || accessMode === 'read only') {
            return accessMode
        }
        throw new Error(this.database + " doesn't support the transactions access mode: " + accessMode)
    }
}