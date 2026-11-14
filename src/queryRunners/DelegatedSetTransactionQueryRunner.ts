import { ManagedTransactionQueryRunner } from './ManagedTransactionQueryRunner.js'
import type { BeginTransactionOpts } from './QueryRunner.js'

/**
 * A query runner over one connection of a driver that begins, commits and rolls back a transaction with methods of its
 * own (beginTransactionInTheDriver, doCommit and doRollback). The isolation level and the access mode, which those
 * methods don't take, go before in a `set transaction` statement, which applies to the next transaction.
 */
export abstract class DelegatedSetTransactionQueryRunner extends ManagedTransactionQueryRunner {
    protected doBeginTransaction(opts: BeginTransactionOpts): Promise<void> {
        // It throws, before anything is sent, for an option the database doesn't offer
        const sql = this.createSetTransactionQuery(opts)
        if (!sql) {
            return this.beginTransactionInTheDriver(opts)
        }
        return this.doSetTransaction(sql, opts).then(() => this.beginTransactionInTheDriver(opts))
    }
    /** Begins the transaction with the method of the driver */
    protected abstract beginTransactionInTheDriver(opts: BeginTransactionOpts): Promise<void>
    /** Runs the `set transaction` statement */
    protected doSetTransaction(sql: string, _opts: BeginTransactionOpts): Promise<void> {
        return this.executeMutation(sql, []).then(nothing)
    }
    /** The `set transaction` statement with the isolation level and the access mode, or undefined without them */
    protected createSetTransactionQuery(opts: BeginTransactionOpts): string | undefined {
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
}

/**
 * Gives undefined: the result of a statement that gives nothing, passed to `then` without creating a function on each
 * call
 */
function nothing(): undefined {
    return undefined
}
