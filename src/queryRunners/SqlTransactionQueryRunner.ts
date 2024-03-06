import { ManagedTransactionQueryRunner } from "./ManagedTransactionQueryRunner"
import { BeginTransactionOpts, CommitOpts, RollbackOpts } from "./QueryRunner"

export abstract class SqlTransactionQueryRunner extends ManagedTransactionQueryRunner {
    private transactionLevel = 0
    executeBeginTransaction(opts: BeginTransactionOpts): Promise<void> {
        const transactionLevel = this.transactionLevel
        if (!this.nestedTransactionsSupported() && transactionLevel >= 1) {
            return this.createRejectedPromise(new Error(this.database + " doesn't support nested transactions (using " + this.constructor.name + ")"))
        }

        let sql
        try {
            sql = this.createBeginTransactionQuery(opts)
        } catch (error) {
            return this.createRejectedPromise(error)
        }
        return this.executeMutation(sql, []).then(() => {
            this.transactionLevel++
            if (this.transactionLevel !== transactionLevel + 1) {
                throw new Error('Forbidden concurrent usage of the query runner was detected when it tried to start a transaction.')
            }
            return undefined
        })
    }
    executeCommit(_opts: CommitOpts): Promise<void> {
        if (this.transactionLevel <= 0) {
            return this.createRejectedPromise(new Error('You are not in a transaction'))
        }

        return this.executeMutation('commit', []).then(() => {
            // Transaction count only modified when commit successful, in case of error there is still an open transaction 
            this.transactionLevel--
            if (this.transactionLevel < 0) {
                this.transactionLevel = 0
            }
            return undefined
        })
    }
    executeRollback(_opts: RollbackOpts): Promise<void> {
        if (this.transactionLevel <= 0) {
            return this.createRejectedPromise(new Error('You are not in a transaction'))
        }

        return this.executeMutation('rollback', []).then(() => {
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
    isTransactionActive(): boolean {
        return this.transactionLevel > 0
    }
    getTransactionLevel(opts: BeginTransactionOpts): string | undefined {
        const level = opts?.[0]
        if (this.database === 'sqlite' && level) {
            throw new Error(this.database + " doesn't support the transactions level: " + level)
        }
        if (!level || level === 'read uncommitted' || level === 'read committed' || level === 'repeatable read' || level === 'serializable') {
            return level
        }
        throw new Error(this.database + " doesn't support the transactions level: " + level)
    }
    getTransactionAccessMode(opts: BeginTransactionOpts): string | undefined {
        const accessMode = opts?.[1]
        if (this.database === 'sqlite' && accessMode) {
            throw new Error(this.database + " doesn't support the transactions access mode: " + accessMode)
        }
        if (!accessMode || accessMode === 'read write' || accessMode === 'read only') {
            return accessMode
        }
        throw new Error(this.database + " doesn't support the transactions access mode: " + accessMode)
    }
    createBeginTransactionQuery(opts: BeginTransactionOpts): string {
        let sql = 'begin transaction'
        let level = this.getTransactionLevel(opts)
        if (level) {
            sql += ' isolation level ' + level
        }
        const accessMode = this.getTransactionAccessMode(opts)
        if (accessMode) {
            if (sql) {
                sql += ', '
            }
            sql += accessMode
        }
        return sql
    }
}