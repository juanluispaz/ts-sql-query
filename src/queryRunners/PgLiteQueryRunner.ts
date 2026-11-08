import type { BeginTransactionOpts, DatabaseType } from './QueryRunner.js'
import type { PGlite, Transaction } from '@electric-sql/pglite'
import { SqlTransactionQueryRunner } from './SqlTransactionQueryRunner.js'
import { PostgresTransactionOutcome } from '../utils/postgresTransactionOutcome.js'
import { TsSqlError, TsSqlProcessingError, type TsSqlErrorReason } from '../TsSqlError.js'
import { getPgLiteErrorReason, isPgLiteError } from './connectorErrorMappers/PgLiteErrorMapper.js'
import type { TypeCategory } from '../TypeAdapter.js'
import { setQueryParamType } from './QueryRunner.js'
import { getParamForceTypeCastAt, getParamTypeAt, getParamTypeCategoryAt } from '../utils/queryParamsMetadata.js'
import { postgreSqlParamType } from '../utils/postgreSqlParamTypes.js'

export interface PgLiteQueryRunnerConfig {
    allowNestedTransactions?: boolean | undefined
    /**
     * The oid of the PostgreSQL type, like `1700` for numeric, each parameter of a type name (the name given to a custom
     * type, or a built-in one) is sent with, in every position
     */
    typesByName?: { readonly [typeName: string]: number } | undefined
    /** The connection is in a transaction that something else began, and that something else ends: none begins on it */
    forUseInTransaction?: boolean | undefined
}

export class PgLiteQueryRunner extends SqlTransactionQueryRunner {
    readonly database: DatabaseType
    protected override readonly transactionOutcome = new PostgresTransactionOutcome()
    readonly connection: PGlite
    private config?: PgLiteQueryRunnerConfig | undefined

    /** connection: the database, or the transaction of db.transaction(...), the only one that can run a statement inside it */
    constructor(connection: PGlite | Transaction, config?: PgLiteQueryRunnerConfig) {
        super()
        // Only a database is asked to begin (see executeBeginTransaction)
        this.connection = connection as PGlite
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

    getCurrentNativeConnection(): PGlite | undefined {
        return this.isTransactionActive() ? this.connection : undefined
    }

    execute<RESULT>(fn: (connection: unknown) => Promise<RESULT>): Promise<RESULT> {
        return fn(this.connection)
    }

    /**
     * The query options with the types of the params, when one has a type: a parameter of a type name in typesByName is
     * sent with the type declared there, and one whose type the database must receive (forceTypeCast) with the oid of
     * its PostgreSQL type, so the SQL needs no cast; the other params go untyped (0).
     */
    private queryOptions(params: any[]): { paramTypes: number[] } | undefined {
        const typesByName = this.config?.typesByName
        let paramTypes: number[] | undefined = undefined
        for (let i = 0, length = params.length; i < length; i++) {
            const type = getParamTypeAt(params, i)
            let oid = typesByName && type !== undefined && Object.hasOwn(typesByName, type) ? typesByName[type] : undefined
            if (oid === undefined && getParamForceTypeCastAt(params, i)) {
                oid = postgreSqlParamType(type, getParamTypeCategoryAt(params, i), params[i])?.oid
            }
            if (oid !== undefined) {
                if (!paramTypes) {
                    paramTypes = new Array(length).fill(0)
                }
                paramTypes[i] = oid
            }
        }
        return paramTypes ? { paramTypes } : undefined
    }
    protected executeQueryReturning(query: string, params: any[]): Promise<any[]> {
        return this.rejectWhenRolledBackByTheDatabase() || this.connection.query(query, params, this.queryOptions(params)).then((result) => result.rows, (error) => this.statementOfTheTransactionFailed(error))
    }
    protected executeMutation(query: string, params: any[]): Promise<number> {
        return this.rejectWhenRolledBackByTheDatabase() || this.connection.query(query, params, this.queryOptions(params)).then((result) => result.affectedRows || 0, (error) => this.statementOfTheTransactionFailed(error))
    }
    override executeCommitQuery(query: string, params: any[]): Promise<number> {
        return this.connection.query(query, params).then((result) => {
            this.transactionOutcome.checkCommit(result.command)
            return 0
        })
    }
    override executeBeginTransaction(opts?: BeginTransactionOpts): Promise<void> {
        if (this.config?.forUseInTransaction || typeof this.connection.transaction !== 'function') {
            return this.rejectBeginInsideAManagedTransaction()
        }
        return super.executeBeginTransaction(opts)
    }
    addParam(params: any[], value: any, type: string, typeCategory: TypeCategory, forceTypeCast: boolean): string {
        // PGlite sends the parameter with its type (see queryOptions): the placeholder needs no cast
        setQueryParamType(params, params.length, type, typeCategory, forceTypeCast)
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
