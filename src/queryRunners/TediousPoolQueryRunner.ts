import type { DatabaseType, QueryRunner } from "./QueryRunner"
import type * as ConnectionPool from 'tedious-connection-pool'
import { AbstractPoolQueryRunner } from "./AbstractPoolQueryRunner"
import { TediousQueryRunner } from "./TediousQueryRunner"

export class TediousPoolQueryRunner extends AbstractPoolQueryRunner {
    readonly database: DatabaseType
    readonly pool: ConnectionPool

    constructor(pool: ConnectionPool) {
        super()
        this.pool = pool
        this.database = 'sqlServer'
    }

    useDatabase(database: DatabaseType): void {
        if (database !== 'sqlServer') {
            throw new Error('Unsupported database: ' + database + '. TediousPoolQueryRunner only supports sqlServer databases')
        }
    }
    getNativeRunner(): unknown {
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
    createResolvedPromise<RESULT>(result: RESULT): Promise<RESULT> {
        return Promise.resolve(result) 
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
        (queryRunner.getNativeRunner() as ConnectionPool.PooledConnection).release()
    }

}