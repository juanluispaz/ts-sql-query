import type { DatabaseType, QueryRunner } from "./QueryRunner"
import type { Pool, PoolClient } from 'pg'
import { PromiseBasedPoolQueryRunner } from "./PromiseBasedPoolQueryRunner"
import { PgQueryRunner } from "./PgQueryRunner"

export interface PgPoolQueryRunnerConfig {
    allowNestedTransactions?: boolean
}

export class PgPoolQueryRunner extends PromiseBasedPoolQueryRunner {
    readonly database: DatabaseType
    readonly pool: Pool
    private config?: PgPoolQueryRunnerConfig

    constructor(pool: Pool, config?: PgPoolQueryRunnerConfig) {
        super()
        this.pool = pool
        this.database = 'postgreSql'
        this.config = config
    }

    useDatabase(database: DatabaseType): void {
        if (database !== 'postgreSql') {
            throw new Error('Unsupported database: ' + database + '. PgPoolQueryRunner only supports postgreSql databases')
        }
    }
    getNativeRunner(): Pool {
        return this.pool
    }
    addParam(params: any[], value: any): string {
        params.push(value)
        return '$' + params.length
    }
    protected createQueryRunner(): Promise<QueryRunner> {
        return this.pool.connect().then(connection => new PgQueryRunner(connection, this.config))
    }
    protected releaseQueryRunner(queryRunner: QueryRunner): void {
        (queryRunner.getNativeRunner() as PoolClient).release()
    }
    nestedTransactionsSupported(): boolean {
        return !!this.config?.allowNestedTransactions
    }

}