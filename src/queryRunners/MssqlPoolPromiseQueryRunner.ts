import type { BeginTransactionOpts, DatabaseType, QueryRunner } from './QueryRunner.js'
import type { ConnectionPool, Transaction } from 'mssql'
import { MssqlPoolQueryRunner, type MssqlPoolQueryRunnerConfig } from './MssqlPoolQueryRunner.js'
import { AbstractPoolQueryRunner } from './AbstractPoolQueryRunner.js'
import { TsSqlProcessingError, type TsSqlErrorReason } from '../TsSqlError.js'
import { queryRunnerParamBindings } from '../utils/queryRunnerParams.js'

/** The options of MssqlPoolPromiseQueryRunner */
export interface MssqlPoolPromiseQueryRunnerConfig {
    /** See MssqlPoolQueryRunnerConfig */
    typesByName?: MssqlPoolQueryRunnerConfig['typesByName']
}

/**
 * The query runner of SQL Server through `mssql`, over the promise of a `ConnectionPool` (what `connect()` returns):
 * each query runs on a MssqlPoolQueryRunner over the pool once it's connected.
 */
export class MssqlPoolPromiseQueryRunner extends AbstractPoolQueryRunner {
    readonly database: DatabaseType
    /** The promise of the `ConnectionPool` of mssql the query runner was created with */
    readonly promisePool: Promise<ConnectionPool>
    private config?: MssqlPoolPromiseQueryRunnerConfig | undefined

    constructor(promisePool: Promise<ConnectionPool>, config?: MssqlPoolPromiseQueryRunnerConfig) {
        super()
        this.promisePool = promisePool
        this.database = 'sqlServer'
        this.config = config
    }

    useDatabase(database: DatabaseType): void {
        if (database !== 'sqlServer') {
            throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_DATABASE', database }, 'Unsupported database: ' + database + '. MssqlPoolPromiseQueryRunner only supports sqlServer databases')
        }
    }
    getNativeRunner(): Promise<ConnectionPool> {
        return this.promisePool
    }
    override getCurrentNativeConnection(): Transaction | undefined {
        return super.getCurrentNativeConnection() as any
    }
    addParam(params: any[], value: any): string {
        // The same binding MockQueryRunner uses to imitate this query runner
        return queryRunnerParamBindings.MssqlPoolPromiseQueryRunner(params, value)
    }
    /** SQL Server has no access mode for a transaction */
    protected override getTransactionAccessMode(opts: BeginTransactionOpts): string | undefined {
        const accessMode = opts[1]
        if (accessMode) {
            throw new TsSqlProcessingError({ reason: 'TRANSACTION_ACCESS_MODE_NOT_SUPPORTED', accessMode }, this.database + " doesn't support the transactions access mode: " + accessMode)
        }
        return undefined
    }
    protected createQueryRunner(): Promise<QueryRunner> {
        return this.promisePool.then(pool => new MssqlPoolQueryRunner(pool, this.config))
    }
    protected releaseQueryRunner(_queryRunner: QueryRunner): void {
        // Do nothing
    }
    
    override getErrorReason(error: unknown): TsSqlErrorReason {
        return MssqlPoolQueryRunner.getErrorReason(error)
    }
    override isSqlError(error: unknown): boolean {
        return MssqlPoolQueryRunner.isSqlError(error)
    }
    
    static getErrorReason(error: unknown): TsSqlErrorReason {
        return MssqlPoolQueryRunner.getErrorReason(error)
    }
    static isSqlError(error: unknown): boolean {
        return MssqlPoolQueryRunner.isSqlError(error)
    }

}