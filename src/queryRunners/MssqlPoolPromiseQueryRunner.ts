import type { DatabaseType, QueryRunner } from "./QueryRunner"
import type { ConnectionPool } from 'mssql'
import { AbstractPoolQueryRunner } from "./AbstractPoolQueryRunner"
import { MssqlPoolQueryRunner } from "./MssqlPoolQueryRunner"

export class MssqlPoolPromiseQueryRunner extends AbstractPoolQueryRunner {
    readonly database: DatabaseType
    readonly promisePool: Promise<ConnectionPool>

    constructor(promisePool: Promise<ConnectionPool>) {
        super()
        this.promisePool = promisePool
        this.database = 'sqlServer'
    }

    useDatabase(database: DatabaseType): void {
        if (database !== 'sqlServer') {
            throw new Error('Unsupported database: ' + database + '. MssqlPoolPromiseQueryRunner only supports sqlServer databases')
        }
    }
    getNativeRunner(): unknown {
        return this.promisePool
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
        return this.promisePool.then(pool => new MssqlPoolQueryRunner(pool))
    }
    protected releaseQueryRunner(_queryRunner: QueryRunner): void {
        // Do nothing
    }

}