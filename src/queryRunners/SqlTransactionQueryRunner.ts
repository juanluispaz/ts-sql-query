import { TsSqlProcessingError } from '../TsSqlError.js'
import { ManagedTransactionQueryRunner } from './ManagedTransactionQueryRunner.js'
import type { BeginTransactionOpts, CommitOpts, RollbackOpts } from './QueryRunner.js'

export abstract class SqlTransactionQueryRunner extends ManagedTransactionQueryRunner {
    private transactionLevel = 0
    executeBeginTransaction(opts: BeginTransactionOpts = []): Promise<void> {
        const transactionLevel = this.transactionLevel
        if (!this.nestedTransactionsSupported() && this.isTransactionActive()) {
            return this.createRejectedPromise(new TsSqlProcessingError({ reason: 'NESTED_TRANSACTION_NOT_SUPPORTED' }, this.database + " doesn't support nested transactions (using " + this.constructor.name + ")"))
        }

        let sql
        try {
            sql = this.createBeginTransactionQuery(opts)
        } catch (error) {
            return this.createRejectedPromise(error)
        }
        return this.executeBeginTransactionQuery(sql, []).then(() => {
            this.transactionLevel++
            if (this.transactionLevel !== transactionLevel + 1) {
                throw new TsSqlProcessingError({ reason: 'FORBIDDEN_CONCURRENT_USAGE' }, 'Forbidden concurrent usage of the query runner was detected when it tried to start a transaction.')
            }
            return undefined
        })
    }
    executeBeginTransactionQuery(query: string, params: any[]): Promise<number> {
        return this.executeMutation(query, params);
    }
    executeCommit(_opts: CommitOpts = []): Promise<void> {
        if (!this.isTransactionActive()) {
            return Promise.reject(new TsSqlProcessingError({ reason: 'NOT_IN_TRANSACTION' }, 'Not in an transaction, you cannot commit the transaction'))
        }

        return this.executeCommitQuery('commit', []).then(() => {
            // Transaction count only modified when commit successful, in case of error there is still an open transaction 
            this.transactionLevel--
            if (this.transactionLevel < 0) {
                this.transactionLevel = 0
            }
            return undefined
        })
    }
    executeCommitQuery(query: string, params: any[]): Promise<number> {
        return this.executeMutation(query, params);
    }
    executeRollback(_opts: RollbackOpts = []): Promise<void> {
        if (!this.isTransactionActive()) {
            return Promise.reject(new TsSqlProcessingError({ reason: 'NOT_IN_TRANSACTION' }, 'Not in an transaction, you cannot rollback the transaction'))
        }

        return this.executeRollbackQuery('rollback', []).then(() => {
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
    executeRollbackQuery(query: string, params: any[]): Promise<number> {
        return this.executeMutation(query, params);
    }
    isTransactionActive(): boolean {
        return this.transactionLevel > 0
    }
    getTransactionLevel(opts: BeginTransactionOpts): string | undefined {
        const level = opts[0]
        if (this.database === 'sqlite' && level) {
            throw new TsSqlProcessingError({ reason: 'TRANSACTION_LEVEL_NOT_SUPPORTED', transactionLevel: level }, this.database + " doesn't support the transactions level: " + level)
        }
        if (!level || level === 'read uncommitted' || level === 'read committed' || level === 'repeatable read' || level === 'serializable') {
            return level
        }
        throw new TsSqlProcessingError({ reason: 'TRANSACTION_LEVEL_NOT_SUPPORTED', transactionLevel: level }, this.database + " doesn't support the transactions level: " + level)
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
    createBeginTransactionQuery(opts: BeginTransactionOpts): string {
        let sql = 'begin transaction'
        const level = this.getTransactionLevel(opts)
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
    createBeginTransactionOptions(opts: BeginTransactionOpts): string | undefined {
        let sql
        let level = this.getTransactionLevel(opts)
        if (level) {
            sql = 'isolation level ' + level
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
