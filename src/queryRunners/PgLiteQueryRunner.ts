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
        if (value instanceof Date) {
            // PGlite's in-process parameter serializer cannot bind a JS `Date`: for a
            // parameter whose type it infers as text (a placeholder without a `::cast`)
            // it rejects it with `Invalid input for string type`. As a best-effort
            // workaround this runner serializes the `Date` to an ISO 8601 string before
            // binding it, mirroring what the wire-protocol drivers (`pg`, `postgres`)
            // send. This is an opinionated workaround that may change without backwards
            // compatibility once https://github.com/electric-sql/pglite/issues/1021 is fixed.
            params.push(value.toISOString())
        } else {
            params.push(value)
        }
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
