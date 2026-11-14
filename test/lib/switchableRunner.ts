// The seam that lets a SINGLE test run against the mock on a cell whose real
// backend is enabled — the machinery behind `ctx.mockOnlyConnection()`.
//
// It sits BELOW the CaptureInterceptor and ABOVE the two runners:
//
//     ctx.conn  ->  CaptureInterceptor  ->  SwitchableQueryRunner  ->  real
//                                                                  \-> mock
//
// Everything the test reads out of `ctx` keeps working across the switch
// because the interceptor above it never moves: `ctx.lastSql` / `ctx.history`
// observe the mock-backed queries exactly as they observe the real ones, and
// every connection built from the live interceptor (`ctx.withConnection`,
// `ctx.withFaultInjection`, the per-database `withXxx` factories in
// `test/db/<db>/runners.ts`) inherits the active target with no extra
// plumbing.
//
// Why a hand-written delegator instead of extending `ChainedQueryRunner`:
// that class holds its delegate in a `readonly queryRunner` PROPERTY, and
// TypeScript forbids a subclass from re-declaring a base property as an
// accessor — so there is no type-safe way to make the base's delegate
// swappable. Delegating explicitly here keeps `src/` untouched and the
// mutation confined to one field.

import type { TsSqlErrorReason } from '../../src/TsSqlError.js'
import type { BeginTransactionOpts, CommitOpts, DatabaseType, ExecutableQueryType, QueryRunner, RollbackOpts } from '../../src/queryRunners/QueryRunner.js'

export class SwitchableQueryRunner implements QueryRunner {
    /** The runner every call currently delegates to. */
    private target: QueryRunner
    private readonly defaultRunner: QueryRunner
    private readonly mockRunner: QueryRunner

    /**
     * `defaultRunner` is what the cell normally talks to — the real
     * driver-backed runner on an enabled cell, the mock otherwise. On a
     * mock-only cell both arguments are the same object and switching is a
     * no-op.
     */
    constructor(defaultRunner: QueryRunner, mockRunner: QueryRunner) {
        this.defaultRunner = defaultRunner
        this.mockRunner = mockRunner
        this.target = defaultRunner
    }

    /** Route every subsequent call to the mock. */
    useMock(): void {
        this.target = this.mockRunner
    }

    /** Route every subsequent call back to the cell's normal runner. */
    useDefault(): void {
        this.target = this.defaultRunner
    }

    /** True while the mock is the active target. */
    get mockActive(): boolean {
        return this.target === this.mockRunner
    }

    get database(): DatabaseType {
        return this.target.database
    }
    useDatabase(database: DatabaseType): void {
        return this.target.useDatabase(database)
    }
    getNativeRunner(): unknown {
        return this.target.getNativeRunner()
    }
    getCurrentNativeConnection(): unknown {
        return this.target.getCurrentNativeConnection()
    }
    execute<RESULT>(fn: (connection: unknown) => Promise<RESULT>): Promise<RESULT> {
        return this.target.execute(fn)
    }
    executeQuery(queryType: ExecutableQueryType, query: string, params: any[]): Promise<any> {
        return this.target.executeQuery(queryType, query, params)
    }
    executeBeginTransaction(opts: BeginTransactionOpts = []): Promise<void> {
        return this.target.executeBeginTransaction(opts)
    }
    executeCommit(opts: CommitOpts = []): Promise<void> {
        return this.target.executeCommit(opts)
    }
    executeRollback(opts: RollbackOpts = []): Promise<void> {
        return this.target.executeRollback(opts)
    }
    isTransactionActive(): boolean {
        return this.target.isTransactionActive()
    }
    executeInTransaction<T>(fn: () => Promise<T>, outermostQueryRunner: QueryRunner, opts: BeginTransactionOpts = []): Promise<T> {
        return this.target.executeInTransaction(fn, outermostQueryRunner, opts)
    }
    addParam(params: any[], value: any): string {
        return this.target.addParam(params, value)
    }
    addOutParam(params: any[], name: string): string {
        return this.target.addOutParam(params, name)
    }
    createResolvedPromise<RESULT>(result: RESULT | PromiseLike<RESULT>): Promise<RESULT> {
        return this.target.createResolvedPromise(result)
    }
    createRejectedPromise<RESULT = any>(error: any): Promise<RESULT> {
        return this.target.createRejectedPromise(error)
    }
    executeCombined<R1, R2>(fn1: () => Promise<R1>, fn2: () => Promise<R2>): Promise<[R1, R2]> {
        return this.target.executeCombined(fn1, fn2)
    }
    get isMocked(): boolean {
        return this.target.isMocked
    }
    get lowLevelTransactionManagementSupported(): boolean {
        return this.target.lowLevelTransactionManagementSupported
    }
    get executeInTransactionCallsBeginAndCommit(): boolean {
        return this.target.executeInTransactionCallsBeginAndCommit
    }
    get nestedTransactionsSupported(): boolean {
        return this.target.nestedTransactionsSupported
    }
    getErrorReason(error: unknown): TsSqlErrorReason {
        return this.target.getErrorReason(error)
    }
    isSqlError(error: unknown): boolean {
        return this.target.isSqlError(error)
    }
}
