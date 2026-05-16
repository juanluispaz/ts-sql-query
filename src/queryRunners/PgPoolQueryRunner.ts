import type { DatabaseType, QueryRunner } from './QueryRunner.js'
import type { Pool, PoolClient } from 'pg'
import { PgQueryRunner } from './PgQueryRunner.js'
import { ManagedTransactionPoolQueryRunner } from './ManagedTransactionPoolQueryRunner.js'
import { TsSqlProcessingError, type TsSqlErrorReason } from '../TsSqlError.js'

export interface PgPoolQueryRunnerConfig {
    allowNestedTransactions?: boolean | undefined
}

export class PgPoolQueryRunner extends ManagedTransactionPoolQueryRunner {
    readonly database: DatabaseType
    readonly pool: Pool
    private config?: PgPoolQueryRunnerConfig | undefined

    constructor(pool: Pool, config?: PgPoolQueryRunnerConfig) {
        super()
        this.pool = pool
        this.database = 'postgreSql'
        this.config = config
    }

    useDatabase(database: DatabaseType): void {
        if (database !== 'postgreSql') {
            throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_DATABASE', database }, 'Unsupported database: ' + database + '. PgPoolQueryRunner only supports postgreSql databases')
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
    override nestedTransactionsSupported(): boolean {
        return !!this.config?.allowNestedTransactions
    }

    override getErrorReason(error: unknown): TsSqlErrorReason {
        return PgQueryRunner.getErrorReason(error)
    }
    override isSqlError(error: unknown): boolean {
        return PgQueryRunner.isSqlError(error)
    }
    
    static getErrorReason(error: unknown): TsSqlErrorReason {
        return PgQueryRunner.getErrorReason(error)
    }
    static isSqlError(error: unknown): boolean {
        return PgQueryRunner.isSqlError(error)
    }

}