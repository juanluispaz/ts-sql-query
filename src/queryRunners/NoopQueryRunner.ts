import { databaseParamBinding } from '../utils/queryRunnerParams.js'
import type { BeginTransactionOpts, CommitOpts, DatabaseType, PromiseProvider, QueryRunner, RollbackOpts } from './QueryRunner.js'
import { TsSqlError, type TsSqlErrorReason } from '../TsSqlError.js';
import { getQueryContext } from '../QueryContext.js'

export interface NoopQueryRunnerConfig {
    database?: DatabaseType
    promise?: PromiseProvider
    allowNestedTransactions?: boolean
}

export class NoopQueryRunner implements QueryRunner {
    readonly database: DatabaseType
    readonly promise: PromiseProvider
    private transactionLevel = 0
    private allowNestedTransactions: boolean

    constructor(databaseOrConfig: DatabaseType | NoopQueryRunnerConfig = 'noopDB') {
        if (typeof databaseOrConfig === 'string') {
            databaseOrConfig = { database: databaseOrConfig }
        }
        this.database = databaseOrConfig.database || 'noopDB'
        this.promise = databaseOrConfig.promise || Promise
        this.allowNestedTransactions = !!databaseOrConfig.allowNestedTransactions
    }

    useDatabase(database: DatabaseType): void {
        // @ts-ignore
        this.database = database
    }

    getNativeRunner(): unknown {
        return null
    }

    getCurrentNativeConnection(): unknown {
        return undefined
    }

    execute<RESULT>(fn: (connection: unknown) => Promise<RESULT>): Promise<RESULT> {
        return fn(null)
    }

    executeSelectOneRow(_query: string, _params: any[] = []): Promise<any> {
        return this.promise.resolve(undefined)
    }
    executeSelectManyRows(_query: string, _params: any[] = []): Promise<any[]> {
        return this.promise.resolve([])
    }
    executeSelectOneColumnOneRow(query: string, params: any[] = []): Promise<any> {
        // The count of a page of no rows: the query can't find out by other means
        return this.promise.resolve(getQueryContext(query, params).isSelectPageCount ? 0 : undefined)
    }
    executeSelectOneColumnManyRows(_query: string, _params: any[] = []): Promise<any[]> {
        return this.promise.resolve([])
    }
    executeInsert(_query: string, _params: any[] = []): Promise<number> {
        return this.promise.resolve(0)
    }
    executeInsertReturningLastInsertedId(_query: string, _params: any[] = []): Promise<any> {
        return this.promise.resolve(undefined)
    }
    executeInsertReturningMultipleLastInsertedId(_query: string, _params: any[] = []): Promise<any> {
        return this.promise.resolve([])
    }
    executeInsertReturningOneRow(_query: string, _params: any[] = []): Promise<any> {
        return this.promise.resolve(undefined)
    }
    executeInsertReturningManyRows(_query: string, _params: any[] = []): Promise<any[]> {
        return this.promise.resolve([])
    }
    executeInsertReturningOneColumnOneRow(_query: string, _params: any[] = []): Promise<any> {
        return this.promise.resolve(undefined)
    }
    executeInsertReturningOneColumnManyRows(_query: string, _params: any[] = []): Promise<any[]> {
        return this.promise.resolve([])
    }
    executeUpdate(_query: string, _params: any[] = []): Promise<number> {
        return this.promise.resolve(0)
    }
    executeUpdateReturningOneRow(_query: string, _params: any[] = []): Promise<any> {
        return this.promise.resolve(undefined)
    }
    executeUpdateReturningManyRows(_query: string, _params: any[] = []): Promise<any[]> {
        return this.promise.resolve([])
    }
    executeUpdateReturningOneColumnOneRow(_query: string, _params: any[] = []): Promise<any> {
        return this.promise.resolve(undefined)
    }
    executeUpdateReturningOneColumnManyRows(_query: string, _params: any[] = []): Promise<any[]> {
        return this.promise.resolve([])
    }
    executeDelete(_query: string, _params: any[] = []): Promise<number> {
        return this.promise.resolve(0)
    }
    executeDeleteReturningOneRow(_query: string, _params: any[] = []): Promise<any> {
        return this.promise.resolve(undefined)
    }
    executeDeleteReturningManyRows(_query: string, _params: any[] = []): Promise<any[]> {
        return this.promise.resolve([])
    }
    executeDeleteReturningOneColumnOneRow(_query: string, _params: any[] = []): Promise<any> {
        return this.promise.resolve(undefined)
    }
    executeDeleteReturningOneColumnManyRows(_query: string, _params: any[] = []): Promise<any[]> {
        return this.promise.resolve([])
    }
    executeProcedure(_query: string, _params: any[] = []): Promise<void> {
        return this.promise.resolve()
    }
    executeFunction(_query: string, _params: any[] = []): Promise<any> {
        return this.promise.resolve(undefined)
    }
    executeBeginTransaction(_opts: BeginTransactionOpts =[]): Promise<void> {
        this.transactionLevel++
        return this.promise.resolve()
    }
    executeCommit(_opts: CommitOpts = []): Promise<void> {
        if (this.transactionLevel > 0) {
            this.transactionLevel--
        }
        return this.promise.resolve()
    }
    executeRollback(_opts: RollbackOpts = []): Promise<void> {
        if (this.transactionLevel > 0) {
            this.transactionLevel--
        }
        return this.promise.resolve()
    }
    isTransactionActive(): boolean {
        return this.transactionLevel > 0
    }
    executeDatabaseSchemaModification(_query: string, _params: any[] = []): Promise<void> {
        return this.promise.resolve()
    }
    executeConnectionConfiguration(_query: string, _params: any[] = []): Promise<void> {
        return this.promise.resolve()
    }
    addParam(params: any[], value: any): string {
        // The placeholders of the database, as MockQueryRunner writes them
        return databaseParamBinding(this.database)(params, value)
    }
    addOutParam(params: any[], name: string): string {
        const index = params.length
        params.push({ out_param_with_name: name })
        return ':' + index
    }
    executeInTransaction<T>(fn: () => Promise<T>, outermostQueryRunner: QueryRunner, opts: BeginTransactionOpts = []): Promise<T> {
        return outermostQueryRunner.executeBeginTransaction(opts).then(() => {
            let result = fn()
            return result.then((r) => {
                return outermostQueryRunner.executeCommit(opts as any).then(() => {
                    return r
                })
            }, (e) => {
                return outermostQueryRunner.executeRollback(opts as any).then(() => {
                    throw e
                }, () => {
                    // Throw the innermost error
                    throw e
                })
            })
        })
    }
    executeCombined<R1, R2>(fn1: () => Promise<R1>, fn2: () => Promise<R2>): Promise<[R1, R2]> {
        return fn1().then((r1) => {
            return fn2().then((r2) => {
                return [r1, r2]
            })
        })
    }
    createResolvedPromise<RESULT>(result: RESULT | PromiseLike<RESULT>): Promise<RESULT> {
        return this.promise.resolve(result) 
    }
    createRejectedPromise<RESULT = any>(error: any): Promise<RESULT> {
        return this.promise.reject(error)
    }
    isMocked(): boolean {
        return false
    }
    lowLevelTransactionManagementSupported(): boolean {
        return true
    }
    executeInTransactionCallsBeginAndCommit(): boolean {
        return true
    }
    nestedTransactionsSupported(): boolean {
        return this.allowNestedTransactions
    }
    getErrorReason(error: unknown): TsSqlErrorReason {
        if (error instanceof TsSqlError) {
            return error.errorReason
        }
        return { reason: 'UNKNOWN'}
    }
    isSqlError(_error: unknown): boolean {
        return true
    }
}