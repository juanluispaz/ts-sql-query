import { AbstractPoolQueryRunner } from "./AbstractPoolQueryRunner"
import { DatabaseType, QueryRunner } from "./QueryRunner"
import { Pool, PoolConnection } from "mysql2"
import { MySql2QueryRunner } from "./MySql2QueryRunner"

export abstract class MySql2PoolQueryRunner extends AbstractPoolQueryRunner {
    readonly mySql: true = true
    readonly mariaDB: true = true
    database: DatabaseType
    readonly pool: Pool

    constructor(pool: Pool, database: 'mariaDB' | 'mySql' = 'mySql') {
        super()
        this.pool = pool
        this.database = database
    }

    getNativeConnection(): unknown {
        return this.pool
    }
    addParam(params: any[], value: any): string {
        params.push(value)
        return '?'
    }
    addOutParam(_params: any[], _name: string): string {
        throw new Error('Unsupported output parameters')
    }
    protected async createQueryRunner(): Promise<QueryRunner> {
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
        (queryRunner.getNativeConnection() as PoolConnection).release()
    }

}