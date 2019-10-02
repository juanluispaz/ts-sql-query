import { AbstractPoolQueryRunner } from "./AbstractPoolQueryRunner"
import { DatabaseType, QueryRunner } from "./QueryRunner"
import { Pool, PoolClient } from 'pg'
import { PgQueryRunner } from "./PgQueryRunner"

export abstract class PgPoolQueryRunner extends AbstractPoolQueryRunner {
    readonly postgreSql: true = true
    database: DatabaseType
    readonly pool: Pool

    constructor(pool: Pool) {
        super()
        this.pool = pool
        this.database = 'postgreSql'
    }

    getNativeConnection(): unknown {
        return this.pool
    }
    addParam(params: any[], value: any): string {
        const index = params.length
        params.push(value)
        return '$' + (index + 1)
    }
    addOutParam(_params: any[], _name: string): string {
        throw new Error('Unsupported output parameters')
    }
    protected async createQueryRunner(): Promise<QueryRunner> {
        const connection = await this.pool.connect()
        return new PgQueryRunner(connection)
    }
    protected releaseQueryRunner(queryRunner: QueryRunner): void {
        (queryRunner.getNativeConnection() as PoolClient).release()
    }

}