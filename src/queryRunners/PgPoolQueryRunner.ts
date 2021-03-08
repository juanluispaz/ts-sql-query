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
    createResolvedPromise<RESULT>(result: RESULT): Promise<RESULT> {
        return Promise.resolve(result) 
    }
    protected createQueryRunner(): Promise<QueryRunner> {
        return this.pool.connect().then(connection => new PgQueryRunner(connection))
    }
    protected releaseQueryRunner(queryRunner: QueryRunner): void {
        (queryRunner.getNativeRunner() as PoolClient).release()
    }

}