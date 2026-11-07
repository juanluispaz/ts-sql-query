import type { DatabaseType, QueryRunner } from './QueryRunner.js'
import type { Pool, PoolConnection } from 'mariadb'
import { MariaDBQueryRunner } from './MariaDBQueryRunner.js'
import { ManagedTransactionPoolQueryRunner } from './ManagedTransactionPoolQueryRunner.js'
import { TsSqlProcessingError, type TsSqlErrorReason } from '../TsSqlError.js'
import type { TypeCategory } from '../TypeAdapter.js'
import { setQueryParamType } from './QueryRunner.js'

export class MariaDBPoolQueryRunner extends ManagedTransactionPoolQueryRunner {
    readonly database: DatabaseType
    readonly pool: Pool

    constructor(pool: Pool, database: 'mariaDB' | 'mySql' = 'mariaDB') {
        super()
        this.pool = pool
        this.database = database
    }

    useDatabase(database: DatabaseType): void {
        if (database !== 'mariaDB' && database !== 'mySql') {
            throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_DATABASE', database }, 'Unsupported database: ' + database + '. MariaDBQueryRunner only supports mariaDB or mySql databases')
        } else {
            // @ts-ignore
            this.database = database
        }
    }
    getNativeRunner(): unknown {
        return this.pool
    }
    override getCurrentNativeConnection(): PoolConnection | undefined {
        return super.getCurrentNativeConnection() as PoolConnection | undefined
    }
    addParam(params: any[], value: any, type: string, typeCategory: TypeCategory): string {
        setQueryParamType(params, params.length, type, typeCategory)
        params.push(value)
        return '?'
    }
    protected createQueryRunner(): Promise<QueryRunner> {
        return this.pool.getConnection().then(mariaDBConnection => new MariaDBQueryRunner(mariaDBConnection, this.database as any))
    }
    protected releaseQueryRunner(queryRunner: QueryRunner): void {
        (queryRunner.getNativeRunner() as PoolConnection).release()
    }

    override getErrorReason(error: unknown): TsSqlErrorReason {
        return MariaDBQueryRunner.getErrorReason(error, this.database)
    }
    override isSqlError(error: unknown): boolean {
        return MariaDBQueryRunner.isSqlError(error)
    }

    static getErrorReason(error: unknown, database?: DatabaseType): TsSqlErrorReason {
        return MariaDBQueryRunner.getErrorReason(error, database)
    }
    static isSqlError(error: unknown): boolean {
        return MariaDBQueryRunner.isSqlError(error)
    }

}
