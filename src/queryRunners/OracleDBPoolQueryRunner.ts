import type { DatabaseType, QueryRunner } from './QueryRunner.js'
import type { Pool, Connection } from 'oracledb'
import oracledb from 'oracledb'
import { OracleDBQueryRunner, type OracleDBQueryRunnerConfig } from './OracleDBQueryRunner.js'
import { AbstractPoolQueryRunner } from './AbstractPoolQueryRunner.js'
import { TsSqlProcessingError, type TsSqlErrorReason } from '../TsSqlError.js'
import { queryRunnerParamBindings } from '../utils/queryRunnerParams.js'

/** The options of OracleDBPoolQueryRunner, the ones of OracleDBQueryRunner that apply to a pool */
export interface OracleDBPoolQueryRunnerConfig {
    /** See OracleDBQueryRunnerConfig */
    typesByName?: OracleDBQueryRunnerConfig['typesByName']
    /** See OracleDBQueryRunnerConfig */
    returningMaxSize?: OracleDBQueryRunnerConfig['returningMaxSize']
}

/**
 * The query runner of Oracle through `oracledb`, over a `Pool`: each query takes a connection of the pool, and a
 * transaction keeps one until it ends.
 */
export class OracleDBPoolQueryRunner extends AbstractPoolQueryRunner {
    readonly database: DatabaseType
    /** The `Pool` of oracledb the query runner was created with */
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
    addParam(params: any[], value: any): string {
        // The same binding MockQueryRunner uses to imitate this query runner
        return queryRunnerParamBindings.OracleDBPoolQueryRunner(params, value)
    }
    override addOutParam(params: any[], name: string): string {
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
