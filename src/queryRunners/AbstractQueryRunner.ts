import type { QueryRunner, DatabaseType, BeginTransactionOpts, CommitOpts, RollbackOpts, ExecutableQueryType, PromiseProvider } from './QueryRunner.js'
import type { TsSqlErrorReason } from "../TsSqlError.js"
import { TsSqlError, TsSqlProcessingError, TsSqlQueryExecutionError } from "../TsSqlError.js"
import { databaseIsolationLevel } from '../utils/transactionIsolationLevel.js'

/**
 * The base of every query runner of the library: what all of them do the same way. The promises of the provider
 * (`promise`, the global `Promise` unless a subclass sets another), a transaction run with the begin, commit and
 * rollback of the outermost query runner, the capabilities a query runner has by default, and the reason of an error
 * that is already a `TsSqlError`.
 *
 * A query runner of a driver extends one of its subclasses: `ManagedTransactionQueryRunner` (one connection of the
 * driver; `SqlTransactionQueryRunner` when the transaction begins with SQL, `DelegatedSetTransactionQueryRunner` when the
 * driver begins it) or `AbstractPoolQueryRunner` (a pool, a connection taken for each query or for each transaction).
 */
export abstract class AbstractQueryRunner implements QueryRunner {
    /** The provider of the promises the query runner gives; a subclass with a synchronous provider sets its own */
    protected promise: PromiseProvider = Promise

    abstract readonly database: DatabaseType
    abstract useDatabase(database: DatabaseType): void
    abstract getNativeRunner(): unknown
    abstract getCurrentNativeConnection(): unknown
    abstract execute<RESULT>(fn: (connection: unknown) => Promise<RESULT>): Promise<RESULT>
    abstract executeQuery(queryType: ExecutableQueryType, query: string, params: any[]): Promise<any>
    abstract executeBeginTransaction(opts?: BeginTransactionOpts): Promise<void>
    abstract executeCommit(opts?: CommitOpts): Promise<void>
    abstract executeRollback(opts?: RollbackOpts): Promise<void>
    abstract isTransactionActive(): boolean
    abstract addParam(params: any[], value: any): string

    /** Out parameters only exist on Oracle: a query runner of another database rejects them */
    addOutParam(_params: any[], _name: string): string {
        throw new TsSqlProcessingError({ reason: 'OUT_PARAMS_NOT_SUPPORTED' }, 'Unsupported output parameters')
    }

    /**
     * Begins the transaction through the outermost query runner, runs fn, and commits when its promise resolves or
     * rolls back when it rejects, or when the commit fails (the transaction is still open then). When the rollback
     * fails too, the first error is the one given, with the error of the rollback attached when it is a
     * `TsSqlQueryExecutionError`.
     */
    executeInTransaction<T>(fn: () => Promise<T>, outermostQueryRunner: QueryRunner, opts: BeginTransactionOpts = []): Promise<T> {
        return outermostQueryRunner.executeBeginTransaction(opts).then(() => {
            return fn().then((r) => {
                // The commit and the rollback receive the options of the begin: the context of the query rides on them
                return outermostQueryRunner.executeCommit(opts as any).then(() => r)
            }).catch((e) => {
                return outermostQueryRunner.executeRollback(opts as any).then(() => {
                    throw e
                }, (rollbackError) => {
                    // SynchronousPromise also calls this function when the one above throws e
                    if (e instanceof TsSqlQueryExecutionError && rollbackError !== e) {
                        e.attachRollbackError(rollbackError)
                    }
                    throw e
                })
            })
        })
    }

    get isMocked(): boolean {
        return false
    }
    get lowLevelTransactionManagementSupported(): boolean {
        return true
    }
    get executeInTransactionCallsBeginAndCommit(): boolean {
        return true
    }
    get nestedTransactionsSupported(): boolean {
        return false
    }

    createResolvedPromise<RESULT>(result: RESULT | PromiseLike<RESULT>): Promise<RESULT> {
        return this.promise.resolve(result)
    }
    createRejectedPromise<RESULT = any>(error: any): Promise<RESULT> {
        return this.promise.reject(error)
    }
    executeCombined<R1, R2>(fn1: () => Promise<R1>, fn2: () => Promise<R2>): Promise<[R1, R2]> {
        return fn1().then((r1) => {
            return fn2().then((r2) => [r1, r2])
        })
    }

    /** The reason of a `TsSqlError`; a query runner of a driver reads the reason of the errors of its driver */
    getErrorReason(error: unknown): TsSqlErrorReason {
        if (error instanceof TsSqlError) {
            return error.errorReason
        }
        return { reason: 'UNKNOWN' }
    }
    isSqlError(_error: unknown): boolean {
        return true
    }

    /**
     * The isolation level of a transaction as the database writes it, undefined for the one of the database; throws
     * when the database doesn't offer it
     */
    protected getTransactionLevel(opts: BeginTransactionOpts): string | undefined {
        return databaseIsolationLevel(this.database, opts[0])
    }
    /** The access mode of a transaction, undefined for the one of the database; throws when the database doesn't offer it */
    protected getTransactionAccessMode(opts: BeginTransactionOpts): string | undefined {
        const accessMode = opts[1]
        if (!accessMode) {
            return undefined
        }
        if (this.database !== 'sqlite' && (accessMode === 'read write' || accessMode === 'read only')) {
            return accessMode
        }
        throw new TsSqlProcessingError({ reason: 'TRANSACTION_ACCESS_MODE_NOT_SUPPORTED', accessMode }, this.database + " doesn't support the transactions access mode: " + accessMode)
    }
}
