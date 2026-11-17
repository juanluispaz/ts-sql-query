import type { DatabaseType, QueryRunner } from './QueryRunner.js'
import type { Pool, Connection } from 'oracledb'
import { OracleDBQueryRunner, type OracleDBQueryRunnerConfig } from './OracleDBQueryRunner.js'
import { AbstractPoolQueryRunner } from './AbstractPoolQueryRunner.js'
import { TsSqlProcessingError, type TsSqlErrorReason } from '../TsSqlError.js'
import { oracleOutParam, queryRunnerParamBindings } from '../utils/queryRunnerParams.js'
import type { DataTypeClass } from '../TypeAdapter.js'
import type { DataTypeName } from '../typeSystem/dataTypeNames.js'

/** The options of OracleDBPoolPromiseQueryRunner, the ones of OracleDBQueryRunner that apply to a pool */
export interface OracleDBPoolPromiseQueryRunnerConfig {
    /** See OracleDBQueryRunnerConfig */
    typesByName?: OracleDBQueryRunnerConfig['typesByName']
    /** See OracleDBQueryRunnerConfig */
    returningMaxSize?: OracleDBQueryRunnerConfig['returningMaxSize']
}

/**
 * The query runner of Oracle through `oracledb`, over the promise of a `Pool` (what `createPool()` returns): each
 * query takes a connection of the pool, and a transaction keeps one until it ends.
 */
export class OracleDBPoolPromiseQueryRunner extends AbstractPoolQueryRunner {
    readonly database: DatabaseType
    /** The promise of the `Pool` of oracledb the query runner was created with */
    readonly promisePool: Promise<Pool>

    private config?: OracleDBPoolPromiseQueryRunnerConfig | undefined

    constructor(promisePool: Promise<Pool>, config?: OracleDBPoolPromiseQueryRunnerConfig) {
        super()
        this.promisePool = promisePool
        this.database = 'oracle'
        this.config = config
    }

    useDatabase(database: DatabaseType): void {
        if (database !== 'oracle') {
            throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_DATABASE', database }, 'Unsupported database: ' + database + '. OracleDBPoolPromiseQueryRunner only supports oracle databases')
        }
    }
    getNativeRunner(): Promise<Pool> {
        return this.promisePool
    }
    override getCurrentNativeConnection(): Connection | undefined {
        return super.getCurrentNativeConnection() as Connection | undefined
    }
    addParam(params: any[], value: any, type: DataTypeName | DataTypeClass | undefined): string {
        // The same binding MockQueryRunner uses to imitate this query runner
        return queryRunnerParamBindings.OracleDBPoolPromiseQueryRunner(params, value, type)
    }
    override addOutParam(params: any[], name: string, type: DataTypeName | DataTypeClass | undefined): string {
        // The same function MockQueryRunner uses to imitate this query runner
        return oracleOutParam(params, name, type)
    }
    protected createQueryRunner(): Promise<QueryRunner> {
        return this.promisePool.then(pool => pool.getConnection()).then(connection => new OracleDBQueryRunner(connection, this.config))
    }
    protected releaseQueryRunner(queryRunner: QueryRunner): void {
        (queryRunner.getNativeRunner() as Connection).close()
    }
        
    override getErrorReason(error: unknown): TsSqlErrorReason {
        return OracleDBQueryRunner.getErrorReason(error)
    }
    override isSqlError(error: unknown): boolean {
        return OracleDBQueryRunner.isSqlError(error)
    }
        
    static getErrorReason(error: unknown): TsSqlErrorReason {
        return OracleDBQueryRunner.getErrorReason(error)
    }
    static isSqlError(error: unknown): boolean {
        return OracleDBQueryRunner.isSqlError(error)
    }

}
