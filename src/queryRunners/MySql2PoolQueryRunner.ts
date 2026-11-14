import type { DatabaseType, QueryRunner } from './QueryRunner.js'
import type { Pool, PoolConnection } from 'mysql2'
import { MySql2QueryRunner } from './MySql2QueryRunner.js'
import { AbstractPoolQueryRunner } from './AbstractPoolQueryRunner.js'
import { TsSqlProcessingError, type TsSqlErrorReason } from '../TsSqlError.js'
import { queryRunnerParamBindings } from '../utils/queryRunnerParams.js'

/** The options of MySql2PoolQueryRunner */
export interface MySql2PoolQueryRunnerConfig {
    /** The database: 'mySql' by default */
    database?: 'mariaDB' | 'mySql' | undefined
}

/**
 * The query runner of MySQL and MariaDB through `mysql2`, over a `Pool`: each query takes a connection of the pool,
 * and a transaction keeps one until it ends.
 */
export class MySql2PoolQueryRunner extends AbstractPoolQueryRunner {
    private currentDatabase: DatabaseType
    /** The `Pool` of mysql2 the query runner was created with */
    readonly pool: Pool

    constructor(pool: Pool, config: MySql2PoolQueryRunnerConfig = {}) {
        super()
        this.pool = pool
        this.currentDatabase = config.database || 'mySql'
    }

    /** The database the SQL is written for: MySQL or MariaDB, the one of the connection */
    get database(): DatabaseType {
        return this.currentDatabase
    }

    useDatabase(database: DatabaseType): void {
        if (database !== 'mariaDB' && database !== 'mySql') {
            throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_DATABASE', database }, 'Unsupported database: ' + database + '. MySql2PoolQueryRunner only supports mySql or mariaDB databases')
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
    addParam(params: any[], value: any): string {
        // The same binding MockQueryRunner uses to imitate this query runner
        return queryRunnerParamBindings.MySql2PoolQueryRunner(params, value)
    }
    protected createQueryRunner(): Promise<QueryRunner> {
        return new Promise((resolve, reject) => {
            this.pool.getConnection((error, mysql2Connection) => {
                if (error) {
                    reject(error)
                } else {
                    resolve(new MySql2QueryRunner(mysql2Connection, this.database as any))
                }
            })
        })
    }
    protected releaseQueryRunner(queryRunner: QueryRunner): void {
        (queryRunner.getNativeRunner() as PoolConnection).release()
    }

    override getErrorReason(error: unknown): TsSqlErrorReason {
        return MySql2QueryRunner.getErrorReason(error, this.database)
    }
    override isSqlError(error: unknown): boolean {
        return MySql2QueryRunner.isSqlError(error)
    }

    static getErrorReason(error: unknown, database?: DatabaseType): TsSqlErrorReason {
        return MySql2QueryRunner.getErrorReason(error, database)
    }
    static isSqlError(error: unknown): boolean {
        return MySql2QueryRunner.isSqlError(error)
    }

}
