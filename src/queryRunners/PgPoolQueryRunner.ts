import type { DatabaseType, QueryRunner } from './QueryRunner.js'
import type { Pool, PoolClient } from 'pg'
import { PgQueryRunner } from './PgQueryRunner.js'
import { ManagedTransactionPoolQueryRunner } from './ManagedTransactionPoolQueryRunner.js'
import { TsSqlProcessingError, type TsSqlErrorReason } from '../TsSqlError.js'
import type { TypeCategory } from '../TypeAdapter.js'
import { setQueryParamType } from './QueryRunner.js'
import { postgreSqlPlaceholder } from '../utils/postgreSqlParamTypes.js'

export interface PgPoolQueryRunnerConfig {
    allowNestedTransactions?: boolean | undefined
    /**
     * The cast, like `'numeric'`, written after the placeholder of a parameter of each type name (the name given to a
     * custom type, or a built-in one) where the library writes a cast, instead of the one of its category
     */
    typesByName?: { readonly [typeName: string]: string } | undefined
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
    override getCurrentNativeConnection(): PoolClient | undefined {
        return super.getCurrentNativeConnection() as PoolClient | undefined
    }
    addParam(params: any[], value: any, type: string, typeCategory: TypeCategory, forceTypeCast: boolean): string {
        // pg can't send a parameter with its type: the type goes as a cast in the placeholder
        const index = params.length
        setQueryParamType(params, index, type, typeCategory, forceTypeCast)
        params.push(value)
        return postgreSqlPlaceholder(index, value, type, typeCategory, forceTypeCast, this.config?.typesByName)
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