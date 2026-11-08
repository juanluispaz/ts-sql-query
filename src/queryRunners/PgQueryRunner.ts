import type { BeginTransactionOpts, DatabaseType } from './QueryRunner.js'
import type { ClientBase } from 'pg'
import { SqlTransactionQueryRunner } from './SqlTransactionQueryRunner.js'
import { PostgresTransactionOutcome } from '../utils/postgresTransactionOutcome.js'
import { TsSqlError, TsSqlProcessingError, type TsSqlErrorReason } from '../TsSqlError.js'
import { getPgErrorReason, isPgError } from './connectorErrorMappers/PgErrorMapper.js'
import type { TypeCategory } from '../TypeAdapter.js'
import { queryRunnerParamBindings } from '../utils/queryRunnerParams.js'

export interface PgQueryRunnerConfig {
    allowNestedTransactions?: boolean | undefined
    /**
     * The cast, like `'numeric'`, written after the placeholder of a parameter of each type name (the name given to a
     * custom type, or a built-in one) where the library writes a cast, instead of the one of its category
     */
    typesByName?: { readonly [typeName: string]: string } | undefined
    /** The connection is in a transaction that something else began, and that something else ends: none begins on it */
    forUseInTransaction?: boolean | undefined
}

export class PgQueryRunner extends SqlTransactionQueryRunner {
    readonly database: DatabaseType
    protected override readonly transactionOutcome = new PostgresTransactionOutcome()
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
        return this.rejectWhenRolledBackByTheDatabase() || this.connection.query(query, params).then((result) => result.rows, (error) => this.statementOfTheTransactionFailed(error))
    }
    protected executeMutation(query: string, params: any[]): Promise<number> {
        return this.rejectWhenRolledBackByTheDatabase() || this.connection.query(query, params).then((result) => result.rowCount || 0, (error) => this.statementOfTheTransactionFailed(error))
    }
    override executeCommitQuery(query: string, params: any[]): Promise<number> {
        return this.connection.query(query, params).then((result) => {
            this.transactionOutcome.checkCommit(result.command)
            return 0
        })
    }
    override executeBeginTransaction(opts?: BeginTransactionOpts): Promise<void> {
        if (this.config?.forUseInTransaction) {
            return this.rejectBeginInsideAManagedTransaction()
        }
        return super.executeBeginTransaction(opts)
    }
    addParam(params: any[], value: any, type: string, typeCategory: TypeCategory, forceTypeCast: boolean): string {
        // The same binding MockQueryRunner uses to imitate this query runner
        return queryRunnerParamBindings.PgQueryRunner(params, value, type, typeCategory, forceTypeCast, this.config?.typesByName)
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
