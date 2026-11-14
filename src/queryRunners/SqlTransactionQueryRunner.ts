import { ManagedTransactionQueryRunner } from './ManagedTransactionQueryRunner.js'
import type { BeginTransactionOpts, CommitOpts, RollbackOpts } from './QueryRunner.js'

/**
 * A query runner over one connection of a driver whose transactions begin and end with SQL: `begin transaction`, with
 * its isolation level and access mode, `commit` and `rollback`, each one run as a statement. A driver that writes
 * them in its own way overrides createBeginTransactionQuery, or the method that runs each of them.
 */
export abstract class SqlTransactionQueryRunner extends ManagedTransactionQueryRunner {
    protected doBeginTransaction(opts: BeginTransactionOpts): Promise<void> {
        return this.executeBeginTransactionQuery(this.createBeginTransactionQuery(opts), []).then(nothing)
    }
    protected doCommit(_opts: CommitOpts): Promise<void> {
        return this.executeCommitQuery('commit', []).then(nothing)
    }
    protected doRollback(_opts: RollbackOpts): Promise<void> {
        return this.executeRollbackQuery('rollback', []).then(nothing)
    }
    /** Runs the statement that begins a transaction */
    protected executeBeginTransactionQuery(query: string, params: any[]): Promise<number> {
        return this.executeMutation(query, params)
    }
    /** Runs the commit */
    protected executeCommitQuery(query: string, params: any[]): Promise<number> {
        return this.executeMutation(query, params)
    }
    /** Runs the rollback */
    protected executeRollbackQuery(query: string, params: any[]): Promise<number> {
        return this.executeMutation(query, params)
    }
    /** The statement that begins a transaction; it throws for an isolation level or an access mode the database doesn't offer */
    protected createBeginTransactionQuery(opts: BeginTransactionOpts): string {
        let sql = 'begin transaction'
        const level = this.getTransactionLevel(opts)
        if (level) {
            sql += ' isolation level ' + level
        }
        const accessMode = this.getTransactionAccessMode(opts)
        if (accessMode) {
            sql += level ? ', ' : ' '
            sql += accessMode
        }
        return sql
    }
    /**
     * The options of a transaction, `isolation level <level>, <access mode>`, for a driver that begins it with them;
     * undefined without any. It throws for one the database doesn't offer
     */
    protected createBeginTransactionOptions(opts: BeginTransactionOpts): string | undefined {
        const level = this.getTransactionLevel(opts)
        const accessMode = this.getTransactionAccessMode(opts)
        if (!level && !accessMode) {
            return undefined
        }
        let sql = level ? 'isolation level ' + level : ''
        if (accessMode) {
            if (sql) sql += ', '
            sql += accessMode
        }
        return sql
    }
}

/**
 * Gives undefined: the result of a statement that gives nothing, passed to `then` without creating a function on each
 * call
 */
function nothing(): undefined {
    return undefined
}
