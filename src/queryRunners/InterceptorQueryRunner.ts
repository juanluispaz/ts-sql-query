import type { BeginTransactionOpts, CommitOpts, ExecutableQueryType, QueryRunner, QueryType, RollbackOpts } from './QueryRunner.js'
import { ChainedQueryRunner } from './ChainedQueryRunner.js'

/**
 * A query runner that wraps another and calls your code around each query and each statement of a transaction:
 * onQuery before it runs, and onQueryResult or onQueryError when it ends. What onQuery returns, the payload, reaches
 * the other two, so data of a query (like when it began) goes from one call to the next without being kept anywhere
 * else. A statement of a transaction has an empty query, and its options as the params.
 *
 * When the driver begins and ends a transaction by itself (executeInTransactionCallsBeginAndCommit is false), the
 * begin, the commit and the rollback are shown as if they had run: onQuery and onQueryResult one after the other.
 */
export abstract class InterceptorQueryRunner<PAYLOAD, T extends QueryRunner = QueryRunner> extends ChainedQueryRunner<T> {
    /** Called before the query runs; what it returns reaches onQueryResult or onQueryError */
    abstract onQuery(queryType: QueryType, query: string, params: any[]): PAYLOAD
    /** Called when the query ends, with its result */
    abstract onQueryResult(queryType: QueryType, query: string, params: any[], result: any, payload: PAYLOAD): void
    /** Called when the query fails, with its error; the error reaches the caller afterwards */
    abstract onQueryError(queryType: QueryType, query: string, params: any[], error: any, payload: PAYLOAD): void

    override executeQuery(queryType: ExecutableQueryType, query: string, params: any[]): Promise<any> {
        const payload = this.onQuery(queryType, query, params)
        return this.queryRunner.executeQuery(queryType, query, params).then(r => {
            this.onQueryResult(queryType, query, params, r, payload)
            return r
        }, e => {
            this.onQueryError(queryType, query, params, e, payload)
            throw e
        })
    }
    override executeBeginTransaction(opts: BeginTransactionOpts = []): Promise<void> {
        const payload = this.onQuery('beginTransaction', '', opts)
        return this.queryRunner.executeBeginTransaction(opts).then(r => {
            this.onQueryResult('beginTransaction', '', opts, r, payload)
            return r
        }, e => {
            this.onQueryError('beginTransaction', '', opts, e, payload)
            throw e
        })
    }
    override executeCommit(opts: CommitOpts = []): Promise<void> {
        const payload = this.onQuery('commit', '', opts)
        return this.queryRunner.executeCommit(opts).then(r => {
            this.onQueryResult('commit', '', opts, r, payload)
            return r
        }, e => {
            this.onQueryError('commit', '', opts, e, payload)
            throw e
        })
    }
    override executeRollback(opts: RollbackOpts = []): Promise<void> {
        const payload = this.onQuery('rollback', '', opts)
        return this.queryRunner.executeRollback(opts).then(r => {
            this.onQueryResult('rollback', '', opts, r, payload)
            return r
        }, e => {
            this.onQueryError('rollback', '', opts, e, payload)
            throw e
        })
    }
    override executeInTransaction<R>(fn: () => Promise<R>, outermostQueryRunner: QueryRunner, opts: BeginTransactionOpts = []): Promise<R> {
        if (this.queryRunner.executeInTransactionCallsBeginAndCommit) {
            return this.queryRunner.executeInTransaction(fn, outermostQueryRunner, opts)
        }
        // The driver begins and ends the transaction by itself: show its statements as if they had run
        let begun = false
        return this.queryRunner.executeInTransaction(() => {
            begun = true
            this.statementShown('beginTransaction', opts)
            return fn()
        }, outermostQueryRunner, opts).then((r) => {
            try {
                this.statementShown('commit', opts)
            } catch {
                // The transaction already ended as it did
            }
            return r
        }, (e) => {
            if (!begun) {
                // The transaction was refused: there is nothing to roll back
                throw e
            }
            try {
                this.statementShown('rollback', opts)
            } catch {
                // The error of the transaction is the one given
            }
            throw e
        })
    }
    /** A statement of a transaction the driver ran by itself, shown as if it had run through this query runner */
    private statementShown(queryType: 'beginTransaction' | 'commit' | 'rollback', params: any[]): void {
        const payload = this.onQuery(queryType, '', params)
        this.onQueryResult(queryType, '', params, undefined, payload)
    }
}
