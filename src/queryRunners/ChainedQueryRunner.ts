import type { TsSqlErrorReason } from '../TsSqlError.js'
import type { QueryRunner, DatabaseType, BeginTransactionOpts, CommitOpts, RollbackOpts, ExecutableQueryType } from './QueryRunner.js'
import type { DataTypeClass } from '../TypeAdapter.js'
import type { DataTypeName } from '../typeSystem/dataTypeNames.js'

/**
 * A query runner that passes everything to another one, queryRunner: the base of a query runner that wraps another to
 * add something of its own (log the queries, intercept them), overriding only what it changes.
 */
export class ChainedQueryRunner<T extends QueryRunner> implements QueryRunner {
    /** The query runner this one wraps */
    readonly queryRunner: T

    constructor(queryRunner: T) {
        this.queryRunner = queryRunner
    }

    get database(): DatabaseType {
        return this.queryRunner.database
    }
    useDatabase(database: DatabaseType): void {
        return this.queryRunner.useDatabase(database)
    }
    getNativeRunner(): unknown {
        return this.queryRunner.getNativeRunner()
    }
    getCurrentNativeConnection(): unknown {
        return this.queryRunner.getCurrentNativeConnection()
    }
    execute<RESULT>(fn: (connection: unknown) => Promise<RESULT>): Promise<RESULT> {
        return this.queryRunner.execute(fn)
    }
    executeQuery(queryType: ExecutableQueryType, query: string, params: any[]): Promise<any> {
        return this.queryRunner.executeQuery(queryType, query, params)
    }
    executeBeginTransaction(opts: BeginTransactionOpts = []): Promise<void> {
        return this.queryRunner.executeBeginTransaction(opts)
    }
    executeCommit(opts: CommitOpts = []): Promise<void> {
        return this.queryRunner.executeCommit(opts)
    }
    executeRollback(opts: RollbackOpts = []): Promise<void> {
        return this.queryRunner.executeRollback(opts)
    }
    executeInTransaction<T>(fn: () => Promise<T>, outermostQueryRunner: QueryRunner, opts: BeginTransactionOpts = []): Promise<T> {
        return this.queryRunner.executeInTransaction(fn, outermostQueryRunner, opts)
    }
    isTransactionActive(): boolean {
        return this.queryRunner.isTransactionActive()
    }
    addParam(params: any[], value: any, type: DataTypeName | DataTypeClass | undefined): string {
        return this.queryRunner.addParam(params, value, type)
    }
    addOutParam(params: any[], name: string, type: DataTypeName | DataTypeClass | undefined): string {
        return this.queryRunner.addOutParam(params, name, type)
    }
    createResolvedPromise<RESULT>(result: RESULT | PromiseLike<RESULT>): Promise<RESULT> {
        return this.queryRunner.createResolvedPromise(result)
    }
    createRejectedPromise<RESULT = any>(error: any): Promise<RESULT> {
        return this.queryRunner.createRejectedPromise(error)
    }
    executeCombined<R1, R2>(fn1: () => Promise<R1>, fn2: () => Promise<R2>): Promise<[R1, R2]> {
        return this.queryRunner.executeCombined(fn1, fn2)
    }
    get isMocked(): boolean {
        return this.queryRunner.isMocked
    }
    get lowLevelTransactionManagementSupported(): boolean {
        return this.queryRunner.lowLevelTransactionManagementSupported
    }
    get executeInTransactionCallsBeginAndCommit(): boolean {
        return this.queryRunner.executeInTransactionCallsBeginAndCommit
    }
    get nestedTransactionsSupported(): boolean {
        return this.queryRunner.nestedTransactionsSupported
    }
    getErrorReason(error: unknown): TsSqlErrorReason {
        return this.queryRunner.getErrorReason(error)
    }
    isSqlError(error: unknown): boolean {
        return this.queryRunner.isSqlError(error)
    }
}
