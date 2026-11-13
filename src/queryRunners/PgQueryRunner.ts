import type { BeginTransactionOpts, DatabaseType } from './QueryRunner.js'
import type { ClientBase, CustomTypesConfig } from 'pg'
import { SqlTransactionQueryRunner } from './SqlTransactionQueryRunner.js'
import { PostgresTransactionOutcome } from '../utils/postgreSql/postgresTransactionOutcome.js'
import { TsSqlError, TsSqlProcessingError, type TsSqlErrorReason } from '../TsSqlError.js'
import { getPgErrorReason, isPgError } from './connectorErrorMappers/PgErrorMapper.js'
import { queryRunnerParamBindings } from '../utils/queryRunnerParams.js'
import { parseUtcDateTimeTextOrKeepIt } from '../utils/utcDateTimeText.js'
import { pgSessionTimeZone, requirePgTextMode } from '../utils/postgreSql/pgConfiguration.js'
import { rejectSessionNotInDatabaseZone, type SessionTimeZone } from '../utils/processTimeZone.js'
import { postgreSqlDriverParams } from '../utils/postgreSql/postgreSqlParamTypes.js'

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
    /** The parsers of the values received, given to every query of the library (see pgQueryTypes) */
    private readonly types: CustomTypesConfig
    /** The zone the options of pg give the session, checked for each query */
    private readonly sessionTimeZone: SessionTimeZone | undefined

    constructor(connection: ClientBase, config?: PgQueryRunnerConfig) {
        super()
        requirePgTextMode(connection, 'PgQueryRunner')
        this.sessionTimeZone = pgSessionTimeZone(connection, 'PgQueryRunner')
        this.connection = connection
        this.types = pgQueryTypes(connection)
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
        return this.rejectWhenRolledBackByTheDatabase() || rejectSessionNotInDatabaseZone(this.sessionTimeZone, params) || this.connection.query({ text: query, values: postgreSqlDriverParams(params), types: this.types }).then((result) => result.rows, (error) => this.statementOfTheTransactionFailed(error))
    }
    protected executeMutation(query: string, params: any[]): Promise<number> {
        return this.rejectWhenRolledBackByTheDatabase() || rejectSessionNotInDatabaseZone(this.sessionTimeZone, params) || this.connection.query({ text: query, values: postgreSqlDriverParams(params), types: this.types }).then((result) => result.rowCount || 0, (error) => this.statementOfTheTransactionFailed(error))
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
    addParam(params: any[], value: any): string {
        // The same binding MockQueryRunner uses to imitate this query runner
        return queryRunnerParamBindings.PgQueryRunner(params, value, this.config?.typesByName)
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

/**
 * The parsers pg uses for the values of a query of the library: a `date` (1082) and a `timestamp` (1114) are the Date
 * whose UTC getters are their digits, the values in the database being in UTC (the parsers of pg build that Date with
 * the zone of the process); every other type is parsed as the client parses it, with the parsers the user registered.
 */
function pgQueryTypes(connection: ClientBase): CustomTypesConfig {
    const getTypeParser = (oid: number, format?: 'text' | 'binary'): any => {
        if ((oid === 1082 || oid === 1114) && format !== 'binary') {
            return parseUtcDateTimeTextOrKeepIt
        }
        return connection.getTypeParser(oid, format as any)
    }
    return { getTypeParser: getTypeParser as CustomTypesConfig['getTypeParser'] }
}

