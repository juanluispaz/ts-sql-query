import type { DatabaseType, QueryRunner } from './QueryRunner.js'
import type { Pool, Connection } from 'oracledb'
import { BIND_OUT } from 'oracledb'
import { OracleDBQueryRunner } from './OracleDBQueryRunner.js'
import { ManagedTransactionPoolQueryRunner } from './ManagedTransactionPoolQueryRunner.js'
import { TsSqlProcessingError, type TsSqlErrorReason } from '../TsSqlError.js'

export class OracleDBPoolPromiseQueryRunner extends ManagedTransactionPoolQueryRunner {
    readonly database: DatabaseType
    readonly promisePool: Promise<Pool>

    constructor(promisePool: Promise<Pool>) {
        super()
        this.promisePool = promisePool
        this.database = 'oracle'
    }

    useDatabase(database: DatabaseType): void {
        if (database !== 'oracle') {
            throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_DATABASE', database }, 'Unsupported database: ' + database + '. OracleDBPoolPromiseQueryRunner only supports oracle databases')
        }
    }
    getNativeRunner(): Promise<Pool> {
        return this.promisePool
    }
    addParam(params: any[], value: any): string {
        const index = params.length
        params.push(value)
        return ':' + index
    }
    addOutParam(params: any[], name: string): string {
        const index = params.length
        if (name) {
            params.push({dir: BIND_OUT, as: name})
        } else {
            params.push({dir: BIND_OUT})
        }
        return ':' + index
    }
    protected createQueryRunner(): Promise<QueryRunner> {
        return this.promisePool.then(pool => pool.getConnection()).then(connection => new OracleDBQueryRunner(connection))
    }
    protected releaseQueryRunner(queryRunner: QueryRunner): void {
        (queryRunner.getNativeRunner() as Connection).close()
    }
        
    getErrorReason(error: unknown): TsSqlErrorReason {
        return OracleDBQueryRunner.getErrorReason(error)
    }
    isSqlError(error: unknown): boolean {
        return OracleDBQueryRunner.isSqlError(error)
    }
        
    static getErrorReason(error: unknown): TsSqlErrorReason {
        return OracleDBQueryRunner.getErrorReason(error)
    }
    static isSqlError(error: unknown): boolean {
        return OracleDBQueryRunner.isSqlError(error)
    }

}