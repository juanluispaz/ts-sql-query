import type { DatabaseType, QueryRunner } from "./QueryRunner"
import type { Pool, PoolClient } from 'pg'
import { AbstractPoolQueryRunner } from "./AbstractPoolQueryRunner"
import { PgQueryRunner } from "./PgQueryRunner"

export class PgPoolQueryRunner extends AbstractPoolQueryRunner {
    readonly database: DatabaseType
    readonly pool: Pool

    constructor(pool: Pool) {
        super()
        this.pool = pool
        this.database = 'postgreSql'
    }

    useDatabase(database: DatabaseType): void {
        if (database !== 'postgreSql') {
            throw new Error('Unsupported database: ' + database + '. PgPoolQueryRunner only supports postgreSql databases')
        }
    }
    getNativeRunner(): unknown {
        return this.pool
    }
    addParam(params: any[], value: any): string {
        params.push(value)
        return '$' + params.length
    }
    addOutParam(_params: any[], _name: string): string {
        throw new Error('Unsupported output parameters')
    }
    protected async createQueryRunner(): Promise<QueryRunner> {
        const connection = await this.pool.connect()
        return new PgQueryRunner(connection)
    }
    protected releaseQueryRunner(queryRunner: QueryRunner): void {
        (queryRunner.getNativeRunner() as PoolClient).release()
    }

}