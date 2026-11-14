import type { DatabaseType, QueryRunner } from './QueryRunner.js'
import type { Pool, PoolClient } from 'pg'
import { PgQueryRunner } from './PgQueryRunner.js'
import { requirePgTextMode } from '../utils/postgreSql/pgConfiguration.js'
import { AbstractPoolQueryRunner } from './AbstractPoolQueryRunner.js'
import { TsSqlProcessingError, type TsSqlErrorReason } from '../TsSqlError.js'
import { queryRunnerParamBindings } from '../utils/queryRunnerParams.js'

/** The options of PgPoolQueryRunner */
export interface PgPoolQueryRunnerConfig {
    /** Accept a transaction begun inside another one; rejected with `NESTED_TRANSACTION_NOT_SUPPORTED` by default */
    allowNestedTransactions?: boolean | undefined
    /**
     * The cast, like `'numeric'`, written after the placeholder of a parameter of each type name (the name given to a
     * custom type, or a built-in one) where the library writes a cast, instead of the one of its type
     */
    typesByName?: { readonly [typeName: string]: string } | undefined
}

/**
 * The query runner of PostgreSQL through `pg`, over a `Pool`: each query takes a client of the pool, and a
 * transaction keeps one until it ends.
 */
export class PgPoolQueryRunner extends AbstractPoolQueryRunner {
    readonly database: DatabaseType
    /** The `Pool` of pg the query runner was created with */
    readonly pool: Pool
    private config?: PgPoolQueryRunnerConfig | undefined

    constructor(pool: Pool, config?: PgPoolQueryRunnerConfig) {
        super()
        requirePgTextMode(pool, 'PgPoolQueryRunner')
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
    override getCurrentNativeConnection(): PoolClient | undefined {
        return super.getCurrentNativeConnection() as PoolClient | undefined
    }
    addParam(params: any[], value: any): string {
        // The same binding MockQueryRunner uses to imitate this query runner
        return queryRunnerParamBindings.PgPoolQueryRunner(params, value, this.config?.typesByName)
    }
    protected createQueryRunner(): Promise<QueryRunner> {
        return this.pool.connect().then(connection => {
            try {
                return new PgQueryRunner(connection, this.config)
            } catch (error) {
                // A client the pool gives in the binary mode (pg.defaults.binary) is given back
                connection.release()
                throw error
            }
        })
    }
    protected releaseQueryRunner(queryRunner: QueryRunner): void {
        (queryRunner.getNativeRunner() as PoolClient).release()
    }
    override get nestedTransactionsSupported(): boolean {
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