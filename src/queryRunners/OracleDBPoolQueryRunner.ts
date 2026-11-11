import type { DatabaseType, QueryRunner } from './QueryRunner.js'
import type { Pool, Connection } from 'oracledb'
import oracledb from 'oracledb'
import { OracleDBQueryRunner, type OracleDBQueryRunnerConfig } from './OracleDBQueryRunner.js'
import { ManagedTransactionPoolQueryRunner } from './ManagedTransactionPoolQueryRunner.js'
import { TsSqlProcessingError, type TsSqlErrorReason } from '../TsSqlError.js'
import type { TypeCategory } from '../TypeAdapter.js'
import { queryRunnerParamBindings } from '../utils/queryRunnerParams.js'
import { queryParamForceTypeCast, queryParamType, queryParamTypeCategory, setParamMetadata } from '../utils/metadataSymbols.js'

export interface OracleDBPoolQueryRunnerConfig {
    /** See OracleDBQueryRunnerConfig */
    typesByName?: OracleDBQueryRunnerConfig['typesByName']
    /** See OracleDBQueryRunnerConfig */
    returningMaxSize?: OracleDBQueryRunnerConfig['returningMaxSize']
}

export class OracleDBPoolQueryRunner extends ManagedTransactionPoolQueryRunner {
    readonly database: DatabaseType
    readonly pool: Pool

    private config?: OracleDBPoolQueryRunnerConfig | undefined

    constructor(pool: Pool, config?: OracleDBPoolQueryRunnerConfig) {
        super()
        this.pool = pool
        this.database = 'oracle'
        this.config = config
    }

    useDatabase(database: DatabaseType): void {
        if (database !== 'oracle') {
            throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_DATABASE', database }, 'Unsupported database: ' + database + '. OracleDBPoolQueryRunner only supports oracle databases')
        }
    }
    getNativeRunner(): Pool {
        return this.pool
    }
    override getCurrentNativeConnection(): Connection | undefined {
        return super.getCurrentNativeConnection() as Connection | undefined
    }
    addParam(params: any[], value: any, type: string, typeCategory: TypeCategory, forceTypeCast: boolean): string {
        // The same binding MockQueryRunner uses to imitate this query runner
        return queryRunnerParamBindings.OracleDBPoolQueryRunner(params, value, type, typeCategory, forceTypeCast)
    }
    override addOutParam(params: any[], name: string, type: string, typeCategory: TypeCategory, forceTypeCast: boolean): string {
        setParamMetadata(params, params.length, queryParamType, type)
        setParamMetadata(params, params.length, queryParamTypeCategory, typeCategory)
        setParamMetadata(params, params.length, queryParamForceTypeCast, forceTypeCast)
        const index = params.length
        if (name) {
            params.push({dir: oracledb.BIND_OUT, as: name})
        } else {
            params.push({dir: oracledb.BIND_OUT})
        }
        return ':' + index
    }
    protected createQueryRunner(): Promise<QueryRunner> {
        return this.pool.getConnection().then(connection => new OracleDBQueryRunner(connection, this.config))
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
