import type { DatabaseType, QueryRunner } from './QueryRunner.js'
import type { Pool, Connection } from 'oracledb'
import oracledb from 'oracledb'
import { OracleDBQueryRunner, type OracleDBQueryRunnerConfig } from './OracleDBQueryRunner.js'
import { ManagedTransactionPoolQueryRunner } from './ManagedTransactionPoolQueryRunner.js'
import { TsSqlProcessingError, type TsSqlErrorReason } from '../TsSqlError.js'
import type { TypeCategory } from '../TypeAdapter.js'
import { setQueryParamType } from './QueryRunner.js'
import { requireOracleSessionInDatabaseZone } from '../utils/processTimeZone.js'
import { queryRunnerParamBindings } from '../utils/queryRunnerParams.js'

export interface OracleDBPoolPromiseQueryRunnerConfig {
    /** See OracleDBQueryRunnerConfig */
    typesByName?: OracleDBQueryRunnerConfig['typesByName']
    /** See OracleDBQueryRunnerConfig */
    returningMaxSize?: OracleDBQueryRunnerConfig['returningMaxSize']
}

export class OracleDBPoolPromiseQueryRunner extends ManagedTransactionPoolQueryRunner {
    readonly database: DatabaseType
    readonly promisePool: Promise<Pool>

    private config?: OracleDBPoolPromiseQueryRunnerConfig | undefined

    constructor(promisePool: Promise<Pool>, config?: OracleDBPoolPromiseQueryRunnerConfig) {
        super()
        requireOracleSessionInDatabaseZone('OracleDBPoolPromiseQueryRunner')
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
    addParam(params: any[], value: any, type: string, typeCategory: TypeCategory, forceTypeCast: boolean): string {
        // The same binding MockQueryRunner uses to imitate this query runner
        return queryRunnerParamBindings.OracleDBPoolPromiseQueryRunner(params, value, type, typeCategory, forceTypeCast)
    }
    override addOutParam(params: any[], name: string, type: string, typeCategory: TypeCategory, forceTypeCast: boolean): string {
        setQueryParamType(params, params.length, type, typeCategory, forceTypeCast)
        const index = params.length
        if (name) {
            params.push({dir: oracledb.BIND_OUT, as: name})
        } else {
            params.push({dir: oracledb.BIND_OUT})
        }
        return ':' + index
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
