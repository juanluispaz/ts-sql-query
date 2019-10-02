import { AbstractPoolQueryRunner } from "./AbstractPoolQueryRunner"
import { DatabaseType, QueryRunner } from "./QueryRunner"
import * as ConnectionPool from 'tedious-connection-pool'
import { TediousQueryRunner } from "./TediousQueryRunner"

export abstract class TediousPoolQueryRunner extends AbstractPoolQueryRunner {
    readonly sqlServer: true = true
    database: DatabaseType
    readonly pool: ConnectionPool

    constructor(pool: ConnectionPool) {
        super()
        this.pool = pool
        this.database = 'sqlServer'
    }

    getNativeConnection(): unknown {
        return this.pool
    }
    addParam(params: any[], value: any): string {
        const index = params.length
        params.push(value)
        return '@' + index
    }
    addOutParam(_params: any[], _name: string): string {
        throw new Error('Unsupported output parameters')
    }
    protected createQueryRunner(): Promise<QueryRunner> {
        return new Promise((resolve, reject) => {
            this.pool.acquire((error, sqlServerConnection) => {
                if (error) {
                    reject(error)
                } else {
                    resolve(new TediousQueryRunner(sqlServerConnection))
                }
            })
        })
    }
    protected releaseQueryRunner(queryRunner: QueryRunner): void {
        (queryRunner.getNativeConnection() as ConnectionPool.PooledConnection).release()
    }

}