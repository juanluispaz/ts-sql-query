import type { DatabaseType } from './QueryRunner.js'
import type { ClientBase } from 'pg'
import { SqlTransactionQueryRunner } from './SqlTransactionQueryRunner.js'
import { PostgresTransactionOutcome } from '../utils/postgresTransactionOutcome.js'
import { TsSqlError, TsSqlProcessingError, type TsSqlErrorReason } from '../TsSqlError.js'
import { getPgErrorReason, isPgError } from './connectorErrorMappers/PgErrorMapper.js'

export interface PgQueryRunnerConfig {
    allowNestedTransactions?: boolean | undefined
}

export class PgQueryRunner extends SqlTransactionQueryRunner {
    readonly database: DatabaseType
    private readonly outcome = new PostgresTransactionOutcome()
    readonly connection: ClientBase
    private config?: PgQueryRunnerConfig | undefined

    constructor(connection: ClientBase, config?: PgQueryRunnerConfig) {
        super()
        this.connection = connection
        this.database = 'postgreSql'
        this.config = config
    }

    useDatabase(database: DatabaseType): void {
        if (database !== 'postgreSql') {
            throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_DATABASE', database }, 'Unsupported database: ' + database + '. PgQueryRunner only supports postgreSql databases')
        }
    }

    getNativeRunner(): ClientBase {
        return this.connection
    }

    getCurrentNativeConnection(): ClientBase | undefined {
        return this.isTransactionActive() ? this.connection : undefined
    }

    execute<RESULT>(fn: (connection: unknown) => Promise<RESULT>): Promise<RESULT> {
        return fn(this.connection)
    }

    protected executeQueryReturning(query: string, params: any[]): Promise<any[]> {
        return this.connection.query(query, params).then((result) => result.rows, (error) => {
            this.outcome.statementFailed(error, this.isTransactionActive())
            throw error
        })
    }
    protected executeMutation(query: string, params: any[]): Promise<number> {
        return this.connection.query(query, params).then((result) => result.rowCount || 0, (error) => {
            this.outcome.statementFailed(error, this.isTransactionActive())
            throw error
        })
    }
    override executeCommitQuery(query: string, params: any[]): Promise<number> {
        return this.connection.query(query, params).then((result) => {
            this.outcome.checkCommit(result.command)
            return 0
        })
    }
    override executeRollbackQuery(query: string, params: any[]): Promise<number> {
        if (this.outcome.rollbackAlreadyDone()) {
            return this.createResolvedPromise(0)
        }
        return this.executeMutation(query, params).finally(() => this.outcome.transactionEnded())
    }
    addParam(params: any[], value: any): string {
        params.push(value)
        return '$' + params.length
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
        if (error instanceof TsSqlError) {
            return error.errorReason
        }
        return getPgErrorReason(error)
    }

    static isSqlError(error: unknown): boolean {
        return error instanceof TsSqlError || isPgError(error)
    }

}
