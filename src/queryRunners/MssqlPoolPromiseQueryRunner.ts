import type { BeginTransactionOpts, DatabaseType, QueryRunner } from './QueryRunner.js'
import type { ConnectionPool, Transaction } from 'mssql'
import { MssqlPoolQueryRunner, type MssqlPoolQueryRunnerConfig } from './MssqlPoolQueryRunner.js'
import { ManagedTransactionPoolQueryRunner } from './ManagedTransactionPoolQueryRunner.js'
import { TsSqlProcessingError, type TsSqlErrorReason } from '../TsSqlError.js'
import { queryRunnerParamBindings } from '../utils/queryRunnerParams.js'

export interface MssqlPoolPromiseQueryRunnerConfig {
    /** See MssqlPoolQueryRunnerConfig */
    typesByName?: MssqlPoolQueryRunnerConfig['typesByName']
}

export class MssqlPoolPromiseQueryRunner extends ManagedTransactionPoolQueryRunner {
    readonly database: DatabaseType
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
    protected override validateTransactionOpts(opts: BeginTransactionOpts): void {
        super.validateTransactionOpts(opts)
        const accessMode = opts[1]
        if (accessMode) {
            throw new TsSqlProcessingError({ reason: 'TRANSACTION_ACCESS_MODE_NOT_SUPPORTED', accessMode }, this.database + " doesn't support the transactions access mode: " + accessMode)
        }
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