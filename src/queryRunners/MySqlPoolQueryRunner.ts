import type { DatabaseType, QueryRunner } from "./QueryRunner"
import type { Pool, PoolConnection } from "mysql"
import { MySqlQueryRunner } from "./MySqlQueryRunner"
import { ManagedTransactionPoolQueryRunner } from "./ManagedTransactionPoolQueryRunner"

export class MySqlPoolQueryRunner extends ManagedTransactionPoolQueryRunner {
    readonly database: DatabaseType
    readonly pool: Pool

    constructor(pool: Pool, database: 'mariaDB' | 'mySql' = 'mySql') {
        super()
        this.pool = pool
        this.database = database
    }

    useDatabase(database: DatabaseType): void {
        if (database !== 'mariaDB' && database !== 'mySql') {
            throw new Error('Unsupported database: ' + database + '. MySqlPoolQueryRunner only supports mySql or mariaDB databases')
        } else {
            // @ts-ignore
            this.database = database
        }
    }
    getNativeRunner(): Pool {
        return this.pool
    }
    addParam(params: any[], value: any): string {
        params.push(value)
        return '?'
    }
    protected createQueryRunner(): Promise<QueryRunner> {
        return new Promise((resolve, reject) => {
            this.pool.getConnection((error, mysqlConnection) => {
                if (error) {
                    reject(error)
                } else {
                    resolve(new MySqlQueryRunner(mysqlConnection, this.database as any))
                }
            })
        })
    }
    protected releaseQueryRunner(queryRunner: QueryRunner): void {
        (queryRunner.getNativeRunner() as PoolConnection).release()
    }

}