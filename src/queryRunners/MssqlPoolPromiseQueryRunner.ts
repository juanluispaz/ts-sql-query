import { AbstractPoolQueryRunner } from "./AbstractPoolQueryRunner"
import { DatabaseType, QueryRunner } from "./QueryRunner"
import { ConnectionPool } from 'mssql'
import { MssqlPoolQueryRunner } from "./MssqlPoolQueryRunner"

export class MssqlPoolPromiseQueryRunner extends AbstractPoolQueryRunner {
    readonly sqlServer: true = true
    database: DatabaseType
    readonly promisePool: Promise<ConnectionPool>

    constructor(promisePool: Promise<ConnectionPool>) {
        super()
        this.promisePool = promisePool
        this.database = 'sqlServer'
    }

    getNativeConnection(): unknown {
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
    protected async createQueryRunner(): Promise<QueryRunner> {
        const pool = await this.promisePool
        return new MssqlPoolQueryRunner(pool)
    }
    protected releaseQueryRunner(_queryRunner: QueryRunner): void {
        // Do nothing
    }

}