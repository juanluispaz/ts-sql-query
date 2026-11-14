import type { BeginTransactionOpts, CommitOpts, ExecutableQueryType, QueryRunner, RollbackOpts } from './QueryRunner.js'
import { TsSqlProcessingError } from "../TsSqlError.js"
import { AbstractQueryRunner } from './AbstractQueryRunner.js'

/**
 * The base of a query runner over a pool of a driver. Outside a transaction, each query takes a connection of the pool,
 * runs on the query runner of that connection (createQueryRunner), and gives it back (releaseQueryRunner) when it
 * ends. A transaction keeps the connection of its first statement until it ends: the transaction begins on that
 * connection with the statement, not before, so a transaction without statements takes no connection.
 */
export abstract class AbstractPoolQueryRunner extends AbstractQueryRunner {
    private currentQueryRunner?: QueryRunner | undefined
    private transactionLevel = 0
    private transactionOpts?: BeginTransactionOpts | undefined

    execute<RESULT>(fn: (connection: unknown) => Promise<RESULT>): Promise<RESULT> {
        return this.getQueryRunner().then(queryRunner => queryRunner.execute(fn)).finally(() => this.releaseIfNeeded())
    }
    executeQuery(queryType: ExecutableQueryType, query: string, params: any[]): Promise<any> {
        if (queryType === 'executeConnectionConfiguration' && !this.isTransactionActive()) {
            return this.createRejectedPromise(new TsSqlProcessingError({ reason: 'NOT_IN_TRANSACTION' }, "You are trying to configure a connection when you didn't request a dedicated connection. Begin a transaction to get a dedicated connection"))
        }
        return this.getQueryRunner().then(queryRunner => queryRunner.executeQuery(queryType, query, params)).finally(() => this.releaseIfNeeded())
    }
    executeBeginTransaction(opts: BeginTransactionOpts = []): Promise<void> {
        if (!this.nestedTransactionsSupported && this.transactionLevel >= 1) {
            return this.createRejectedPromise(new TsSqlProcessingError({ reason: 'NESTED_TRANSACTION_NOT_SUPPORTED' }, this.database + " doesn't support nested transactions (using " + this.constructor.name + ")"))
        }
        if (this.transactionLevel <= 0) {
            // The transaction begins on the connection the first query takes from the pool; the options are
            // validated now so an unsupported one fails here, like on the other query runners
            try {
                this.getTransactionLevel(opts)
                this.getTransactionAccessMode(opts)
            } catch (error) {
                return this.createRejectedPromise(error)
            }
            this.transactionLevel = 1
            this.transactionOpts = opts
            return this.createResolvedPromise(undefined)
        } else {
            return this.getQueryRunner().then(queryRunner => queryRunner.executeBeginTransaction(opts)).then(() => {
                this.transactionLevel++
            })
        }
    }
    executeCommit(opts: CommitOpts = []): Promise<void> {
        if (this.transactionLevel <= 0) {
            return this.createRejectedPromise(new TsSqlProcessingError({ reason: 'NOT_IN_TRANSACTION' }, 'Not in a transaction, you cannot commit the transaction'))
        }
        if (this.currentQueryRunner) {
            return this.currentQueryRunner.executeCommit(opts).then(() => {
                // Only a commit that worked ends the transaction and gives the connection back: after an error it is still open
                this.transactionEnded()
                this.releaseIfNeeded()
            })
        }
        this.transactionEnded()
        return this.createResolvedPromise(undefined)
    }
    executeRollback(opts: RollbackOpts = []): Promise<void> {
        if (this.transactionLevel <= 0) {
            return this.createRejectedPromise(new TsSqlProcessingError({ reason: 'NOT_IN_TRANSACTION' }, 'Not in a transaction, you cannot rollback the transaction'))
        }
        if (this.currentQueryRunner) {
            return this.currentQueryRunner.executeRollback(opts).finally(() => {
                this.transactionEnded()
                this.releaseIfNeeded()
            })
        }
        this.transactionEnded()
        return this.createResolvedPromise(undefined)
    }
    isTransactionActive(): boolean {
        return this.transactionLevel > 0
    }
    private transactionEnded(): void {
        this.transactionLevel--
        if (this.transactionLevel <= 0) {
            this.transactionLevel = 0
            this.transactionOpts = undefined
        }
    }

    /** The connection of the transaction, once its first statement took one from the pool */
    getCurrentNativeConnection(): unknown {
        if (!this.currentQueryRunner) {
            return undefined
        }
        return this.currentQueryRunner.getCurrentNativeConnection()
    }

    /** Takes a connection of the pool and gives the query runner over it */
    protected abstract createQueryRunner(): Promise<QueryRunner>
    /** Gives the connection of the query runner back to the pool */
    protected abstract releaseQueryRunner(queryRunner: QueryRunner): void

    /**
     * The query runner of the connection the query runs on: the one of the transaction, or one taken from the pool
     * (and, inside a transaction, the transaction begun on it)
     */
    private getQueryRunner(): Promise<QueryRunner> {
        if (!this.currentQueryRunner) {
            return this.createQueryRunner().then(queryRunner => {
                if (this.currentQueryRunner) {
                    this.releaseQueryRunner(queryRunner)
                    throw new TsSqlProcessingError({ reason: 'FORBIDDEN_CONCURRENT_USAGE' }, 'Forbidden concurrent usage of the query runner was detected when it tried to get a database connection from the pool')
                }
                this.currentQueryRunner = queryRunner
                if (this.transactionLevel > 0) {
                    return this.currentQueryRunner.executeBeginTransaction(this.transactionOpts).then(() => {
                        return queryRunner
                    }, (error) => {
                        // No transaction began on this connection: give it back, so the rollback the caller
                        // issues next has nothing to roll back on it
                        if (this.currentQueryRunner === queryRunner) {
                            this.currentQueryRunner = undefined
                        }
                        this.releaseQueryRunner(queryRunner)
                        throw error
                    })
                }
                return queryRunner
            })
        }
        return this.createResolvedPromise(this.currentQueryRunner)
    }
    /** Outside a transaction, gives the connection back to the pool */
    private releaseIfNeeded(): void {
        if (this.transactionLevel <= 0 && this.currentQueryRunner) {
            this.releaseQueryRunner(this.currentQueryRunner)
            this.currentQueryRunner = undefined
        }
    }
}
