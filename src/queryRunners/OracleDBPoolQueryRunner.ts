import type { DatabaseType, QueryRunner } from './QueryRunner.js'
import type { Pool, Connection } from 'oracledb'
import oracledb from 'oracledb'
import { OracleDBQueryRunner } from './OracleDBQueryRunner.js'
import { ManagedTransactionPoolQueryRunner } from './ManagedTransactionPoolQueryRunner.js'
import { TsSqlProcessingError, type TsSqlErrorReason } from '../TsSqlError.js'
import type { TypeCategory } from '../TypeAdapter.js'
import { setQueryParamType } from './QueryRunner.js'

export class OracleDBPoolQueryRunner extends ManagedTransactionPoolQueryRunner {
    readonly database: DatabaseType
    readonly pool: Pool

    constructor(pool: Pool) {
        super()
        this.pool = pool
        this.database = 'oracle'
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
    addParam(params: any[], value: any, type: string, typeCategory: TypeCategory): string {
        setQueryParamType(params, params.length, type, typeCategory)
        const index = params.length
        params.push(value)
        return ':' + index
    }
    override addOutParam(params: any[], name: string, type: string, typeCategory: TypeCategory): string {
        setQueryParamType(params, params.length, type, typeCategory)
        const index = params.length
        if (name) {
            params.push({dir: oracledb.BIND_OUT, as: name})
        } else {
            params.push({dir: oracledb.BIND_OUT})
        }
        return ':' + index
    }
    protected createQueryRunner(): Promise<QueryRunner> {
        return this.pool.getConnection().then(connection => new OracleDBQueryRunner(connection))
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
