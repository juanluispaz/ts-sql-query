import type { DatabaseType, QueryRunner } from './QueryRunner.js'
import type { Pool, PoolConnection } from 'mariadb'
import { MariaDBQueryRunner } from './MariaDBQueryRunner.js'
import { AbstractPoolQueryRunner } from './AbstractPoolQueryRunner.js'
import { TsSqlProcessingError, type TsSqlErrorReason } from '../TsSqlError.js'
import { queryRunnerParamBindings } from '../utils/queryRunnerParams.js'
import type { DataTypeClass } from '../TypeAdapter.js'
import type { DataTypeName } from '../typeSystem/dataTypeNames.js'

/** The options of MariaDBPoolQueryRunner */
export interface MariaDBPoolQueryRunnerConfig {
    /** The database: 'mariaDB' by default */
    database?: 'mariaDB' | 'mySql' | undefined
}

/**
 * The query runner of MariaDB and MySQL through the driver `mariadb`, over a `Pool`: each query takes a connection of
 * the pool, and a transaction keeps one until it ends.
 */
export class MariaDBPoolQueryRunner extends AbstractPoolQueryRunner {
    private currentDatabase: DatabaseType
    /** The `Pool` of mariadb the query runner was created with */
    readonly pool: Pool

    constructor(pool: Pool, config: MariaDBPoolQueryRunnerConfig = {}) {
        super()
        this.pool = pool
        this.currentDatabase = config.database || 'mariaDB'
    }

    /** The database the SQL is written for: MySQL or MariaDB, the one of the connection */
    get database(): DatabaseType {
        return this.currentDatabase
    }

    useDatabase(database: DatabaseType): void {
        if (database !== 'mariaDB' && database !== 'mySql') {
            throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_DATABASE', database }, 'Unsupported database: ' + database + '. MariaDBQueryRunner only supports mariaDB or mySql databases')
        } else {
            this.currentDatabase = database
        }
    }
    getNativeRunner(): unknown {
        return this.pool
    }
    override getCurrentNativeConnection(): PoolConnection | undefined {
        return super.getCurrentNativeConnection() as PoolConnection | undefined
    }
    addParam(params: any[], value: any, type: DataTypeName | DataTypeClass | undefined): string {
        // The same binding MockQueryRunner uses to imitate this query runner
        return queryRunnerParamBindings.MariaDBPoolQueryRunner(params, value, type)
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
