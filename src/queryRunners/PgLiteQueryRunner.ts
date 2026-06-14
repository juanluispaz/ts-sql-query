import type { DatabaseType } from './QueryRunner.js'
import type { PGlite } from '@electric-sql/pglite'
import { SqlTransactionQueryRunner } from './SqlTransactionQueryRunner.js'
import { TsSqlError, TsSqlProcessingError, type TsSqlErrorReason } from '../TsSqlError.js'
import { getPgLiteErrorReason, isPgLiteError } from './connectorErrorMappers/PgLiteErrorMapper.js'

export interface PgQueryRunnerConfig {
    allowNestedTransactions?: boolean | undefined
}

export class PgLiteQueryRunner extends SqlTransactionQueryRunner {
    readonly database: DatabaseType
    readonly connection: PGlite
    private config?: PgQueryRunnerConfig | undefined

    constructor(connection: PGlite, config?: PgQueryRunnerConfig) {
        super()
        this.connection = connection
        this.database = 'postgreSql'
        this.config = config
    }

    useDatabase(database: DatabaseType): void {
        if (database !== 'postgreSql') {
            throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_DATABASE', database }, 'Unsupported database: ' + database + '. PgLiteQueryRunner only supports postgreSql databases')
        }
    }

    getNativeRunner(): PGlite {
        return this.connection
    }

    getCurrentNativeTransaction(): undefined {
        return undefined
    }

    execute<RESULT>(fn: (connection: unknown, transaction?: unknown) => Promise<RESULT>): Promise<RESULT> {
        return fn(this.connection)
    }

    protected executeQueryReturning(query: string, params: any[]): Promise<any[]> {
        return this.connection.query(query, params).then((result) => result.rows)
    }
    protected executeMutation(query: string, params: any[]): Promise<number> {
        return this.connection.query(query, params).then((result) => result.affectedRows || 0)
    }
    addParam(params: any[], value: any): string {
        params.push(value)
        return '$' + params.length
    }
    override nestedTransactionsSupported(): boolean {
        return !!this.config?.allowNestedTransactions
    }
    override getErrorReason(error: unknown): TsSqlErrorReason {
        return PgLiteQueryRunner.getErrorReason(error)
    }
    override isSqlError(error: unknown): boolean {
        return PgLiteQueryRunner.isSqlError(error)
    }

    static getErrorReason(error: unknown): TsSqlErrorReason {
        if (error instanceof TsSqlError) {
            return error.errorReason
        }
        return getPgLiteErrorReason(error)
    }

    static isSqlError(error: unknown): boolean {
        return error instanceof TsSqlError || isPgLiteError(error)
    }

}
