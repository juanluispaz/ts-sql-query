import { TsSqlError, TsSqlProcessingError, type TsSqlErrorReason } from '../TsSqlError.js'
import { SqlTransactionQueryRunner } from './SqlTransactionQueryRunner.js'
import { getGivenSqlConnection, type GivenSqlConnection } from '../utils/givenSqlConnection.js'
import { PostgresTransactionOutcome } from '../utils/postgreSql/postgresTransactionOutcome.js'
import type { BeginTransactionOpts, DatabaseType, QueryRunner } from './QueryRunner.js'
import type { Sql, ReservedSql, TransactionSql, Parameter } from 'postgres'
import { getPostgresJsErrorReason, isPostgresJsError } from './connectorErrorMappers/PostgresErrorMapper.js'
import { isPostgreSqlZonedParam, postgreSqlDriverParams, postgreSqlParamType } from '../utils/postgreSql/postgreSqlParamTypes.js'
import { queryRunnerParamBindings } from '../utils/queryRunnerParams.js'
import { isProcessInUtc, rejectSessionNotInDatabaseZone, type SessionTimeZone } from '../utils/processTimeZone.js'
import { postgreSqlOptionsTimeZone } from '../utils/postgreSql/postgreSqlSessionTimeZone.js'
import { existingParamContextOf } from '../internal/QueryContextImpl.js'

export interface PostgresQueryRunnerConfig {
    /**
     * The type each parameter of a type name (the name given to a custom type, or a built-in one) is sent with, in every
     * position: the oid of a PostgreSQL type, like `1700` for numeric, or a function that gives the parameter, like
     * `value => sql.typed.money(value)` for a type declared in the `types` option of postgres.js
     */
    typesByName?: { readonly [typeName: string]: number | ((value: any) => Parameter<any>) } | undefined
}

export class PostgresQueryRunner extends SqlTransactionQueryRunner {
    database: DatabaseType
    readonly connection: Sql
    transaction?: TransactionSql | undefined
    lowLevelTransaction?: ReservedSql | undefined
    private readonly givenConnection: GivenSqlConnection
    protected override readonly transactionOutcome = new PostgresTransactionOutcome()
    private config?: PostgresQueryRunnerConfig | undefined
    /** The zone the configuration of postgres.js gives the session, checked for each query */
    private readonly sessionTimeZone: SessionTimeZone | undefined

    /** connection: the client of a pool, a connection reserved from it, or a transaction begun with it */
    constructor(connection: Sql | TransactionSql | ReservedSql, config?: PostgresQueryRunnerConfig) {
        super()
        requirePostgresJsOptions(connection)
        this.sessionTimeZone = postgresJsSessionTimeZone(connection)
        // Only a pool client is asked to reserve or begin (see givenConnection)
        this.connection = connection as Sql
        this.givenConnection = getGivenSqlConnection(connection)
        this.database = 'postgreSql'
        this.config = config
    }
    useDatabase(database: DatabaseType): void {
        if (database !== 'postgreSql') {
            throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_DATABASE', database }, 'Unsupported database: ' + database + '. PostgresQueryRunner only supports postgreSql databases')
        }
    }
    getNativeRunner(): Sql {
        return this.connection
    }
    getCurrentNativeConnection(): TransactionSql | ReservedSql | undefined {
        return this.transaction || this.lowLevelTransaction
    }
    private getSql(): Sql | TransactionSql | ReservedSql {
        return this.transaction || this.lowLevelTransaction || this.connection
    }
    execute<RESULT>(fn: (connection: unknown) => Promise<RESULT>): Promise<RESULT> {
        const transaction = this.transaction || this.lowLevelTransaction
        if (transaction) {
            return fn(transaction)
        }
        if (this.givenConnection !== 'pool') {
            // A connection the caller reserved, or a transaction the caller began: it already is a dedicated one
            return fn(this.connection)
        }
        // Outside a transaction, a connection reserved for fn alone
        return this.connection.reserve().then(reserved => fn(reserved).finally(() => reserved.release()))
    }
    /**
     * The params as they are given to postgres.js: a parameter of a type name in typesByName is sent with the type
     * declared there, and one whose type the database must receive (forceTypeCast) with the oid of its PostgreSQL
     * type, so the SQL needs no cast; the other params go untyped. A date or time goes as the text of
     * postgreSqlDriverParams. The params of the query are not changed.
     */
    private driverParams(sql: Sql | TransactionSql | ReservedSql, params: any[]): any[] {
        const typesByName = this.config?.typesByName
        const values = postgreSqlDriverParams(params)
        let result: any[] | undefined = values === params ? undefined : values
        for (let i = 0, length = params.length; i < length; i++) {
            const value = values[i]
            const param = existingParamContextOf(params, i)
            const type = param?.requestedType
            const declared = typesByName && type !== undefined && Object.hasOwn(typesByName, type) ? typesByName[type] : undefined
            let typed: Parameter<any> | undefined
            if (typeof declared === 'function') {
                typed = declared(value)
            } else if (declared !== undefined) {
                typed = sql.typed(value, declared)
            } else if (param?.forceTypeCast || isPostgreSqlZonedParam(params, i)) {
                const paramType = postgreSqlParamType(type, param?.requestedCustomType, value, isPostgreSqlZonedParam(params, i))
                if (paramType) {
                    typed = sql.typed(value, paramType.oid)
                }
            }
            if (typed !== undefined) {
                if (!result) {
                    result = values.slice()
                }
                result[i] = typed
            }
        }
        return result ?? params
    }
    private executeUnsafe<RESULT>(query: string, params: any[], getResult: (result: any) => RESULT): Promise<RESULT> {
        const rejected = this.rejectWhenRolledBackByTheDatabase()
        if (rejected) {
            return rejected
        }
        const sql = this.getSql()
        let driverParams
        try {
            driverParams = this.driverParams(sql, params)
        } catch (error) {
            // A function of typesByName failed: nothing was sent
            return this.createRejectedPromise(error)
        }
        // then is called to ensure the query is executed
        return sql.unsafe(query, driverParams).then(getResult, (error) => this.statementOfTheTransactionFailed(error))
    }
    protected executeQueryReturning(query: string, params: any[]): Promise<any[]> {
        return rejectSessionNotInDatabaseZone(this.sessionTimeZone, params) || this.executeUnsafe(query, params, (result) => result)
    }
    protected executeMutation(query: string, params: any[]): Promise<number> {
        return rejectSessionNotInDatabaseZone(this.sessionTimeZone, params) || this.executeUnsafe(query, params, (result) => result.count)
    }
    override executeBeginTransactionQuery(query: string, params: any[]): Promise<number> {
        return this.reserveForTransaction().then((reserved) => {
            return reserved.unsafe(query, params).then(
                (result) => {
                    if (this.lowLevelTransaction) {
                        const error = new TsSqlProcessingError({ reason: 'FORBIDDEN_CONCURRENT_USAGE' }, 'Forbidden concurrent usage of the query runner was detected when it tried to start a transaction')
                        return reserved.unsafe('rollback', []).then(
                            () => {
                                this.releaseReserved(reserved)
                                return this.createRejectedPromise(error)
                            },
                            () => {
                                this.releaseReserved(reserved)
                                return this.createRejectedPromise(error)
                            }
                        )
                    }
                    this.lowLevelTransaction = reserved
                    return result.count
                },
                (error) => {
                    this.releaseReserved(reserved)
                    return this.createRejectedPromise(error)
                }
            )
        })

    }
    override executeCommitQuery(query: string, params: any[]): Promise<number> {
        const transaction = this.lowLevelTransaction
        if (!transaction) {
            return this.createRejectedPromise(new TsSqlProcessingError({ reason: 'NOT_IN_TRANSACTION' }, 'Not in a low level transaction, you cannot commit the transaction'))
        }

        return transaction.unsafe(query, params).then(
            (result) => {
                // The connection is kept when the commit fails, for the rollback that follows
                this.transactionOutcome.checkCommit(result.command)
                this.lowLevelTransaction = undefined
                this.releaseReserved(transaction)
                return result.count
            },
            (error) => {
                return this.createRejectedPromise(error)
            }
        )
    }
    override executeRollbackQuery(query: string, params: any[]): Promise<number> {
        const transaction = this.lowLevelTransaction
        if (!transaction) {
            return this.createRejectedPromise(new TsSqlProcessingError({ reason: 'NOT_IN_TRANSACTION' }, 'Not in a low level transaction, you cannot rollback the transaction'))
        }
        return transaction.unsafe(query, params).then(
            (result) => {
                this.lowLevelTransaction = undefined
                this.releaseReserved(transaction)
                return result.count
            },
            (error) => {
                this.lowLevelTransaction = undefined
                this.releaseReserved(transaction)
                return this.createRejectedPromise(error)
            }
        )
    }
    protected override rollbackAlreadyDoneByTheDatabase(): void {
        const transaction = this.lowLevelTransaction
        if (transaction) {
            this.lowLevelTransaction = undefined
            this.releaseReserved(transaction)
        }
    }
    private reserveForTransaction(): Promise<ReservedSql> {
        if (this.givenConnection === 'transaction') {
            return this.createRejectedPromise(new TsSqlProcessingError({ reason: 'NESTED_TRANSACTION_NOT_SUPPORTED' }, this.constructor.name + ' was created with a transaction of postgres.js, and a transaction can\'t begin inside it'))
        }
        if (this.givenConnection === 'reserved') {
            return this.createResolvedPromise(this.connection as unknown as ReservedSql)
        }
        return this.connection.reserve()
    }
    private releaseReserved(reserved: ReservedSql): void {
        // A connection the caller reserved is theirs to release
        if (reserved !== (this.connection as unknown)) {
            reserved.release()
        }
    }
    override isTransactionActive(): boolean {
        return !!this.transaction || !!this.lowLevelTransaction || super.isTransactionActive()
    }
    addParam(params: any[], value: any): string {
        // The same binding MockQueryRunner uses to imitate this query runner
        return queryRunnerParamBindings.PostgresQueryRunner(params, value)
    }
    // The driver begins and commits a transaction by itself, in the function it receives. On a reserved connection it
    // can't, and the transaction goes through executeBeginTransaction and executeCommit.
    override executeInTransactionCallsBeginAndCommit(): boolean {
        return this.givenConnection === 'reserved'
    }
    override executeInTransaction<T>(fn: () => Promise<T>, outermostQueryRunner: QueryRunner, opts: BeginTransactionOpts = []): Promise<T> {
        if (this.givenConnection === 'reserved') {
            // A reserved connection of postgres.js can't begin(): the transaction is begun and committed on it with SQL
            return super.executeInTransaction(fn, outermostQueryRunner, opts)
        }
        if (this.transaction || this.lowLevelTransaction) {
            return this.createRejectedPromise(new TsSqlProcessingError({ reason: 'NESTED_TRANSACTION_NOT_SUPPORTED' }, 'Nested transactions are not supported by PostgresQueryRunner'))
        }
        if (this.givenConnection === 'transaction') {
            return this.createRejectedPromise(new TsSqlProcessingError({ reason: 'NESTED_TRANSACTION_NOT_SUPPORTED' }, 'PostgresQueryRunner was created with a transaction of postgres.js, and a transaction can\'t begin inside it'))
        }
        let options
        try {
            options = this.createBeginTransactionOptions(opts)
        } catch (error) {
            return this.createRejectedPromise(error)
        }
        // postgres.js begins and commits the transaction. When one of its statements failed, PostgreSQL would answer
        // the commit with ROLLBACK: the transaction fails with that, caused by the statement that failed, as the
        // transactions of the other query runners, and postgres.js rolls it back
        const callback = (transaction: TransactionSql) => {
            if (this.transaction || this.lowLevelTransaction) {
                return this.createRejectedPromise(new TsSqlProcessingError({ reason: 'FORBIDDEN_CONCURRENT_USAGE' }, 'Forbidden concurrent usage of the query runner was detected when it tried to start a transaction'))
            }
            this.transaction = transaction
            let result = fn()
            return result.then((value) => {
                const error = this.transactionOutcome.failureOfTheTransaction()
                if (error) {
                    throw error
                }
                return value
            }).finally(() => {
                this.transaction = undefined
                this.transactionOutcome.transactionEnded()
            })
        }
        if (options) {
            return this.connection.begin(options, callback) as Promise<T>
        } else {
            return this.connection.begin(callback) as Promise<T>
        }
    }
    override getErrorReason(error: unknown): TsSqlErrorReason {
        return PostgresQueryRunner.getErrorReason(error)
    }
    override isSqlError(error: unknown): boolean {
        return PostgresQueryRunner.isSqlError(error)
    }

    static getErrorReason(error: unknown): TsSqlErrorReason {
        if (error instanceof TsSqlError) {
            return error.errorReason
        }
        return getPostgresJsErrorReason(error)
    }

    static isSqlError(error: unknown): boolean {
        return error instanceof TsSqlError || isPostgresJsError(error)
    }
}

/**
 * What postgres.js must not do with the values of the library, which can't be undone per query; read from the options
 * of the client (a transaction or a reserved connection doesn't expose them). Thrown when the query runner is created.
 * - A transform of the results (`transform.column.from`, `value.from`, `row.from`, or `postgres.camel`...): it renames
 *   the columns the library reads by their name, or changes their values.
 * - `infer: true`, when the process doesn't run in UTC: with it postgres.js reads a `timestamp` with the zone of the
 *   process, and the values in the database are in UTC.
 */
function requirePostgresJsOptions(connection: unknown): void {
    const options = (connection as { options?: { transform?: any, infer?: unknown } }).options
    const transform = options?.transform
    for (const name of ['column', 'value', 'row'] as const) {
        const from = transform?.[name]?.from
        if (from) {
            throw new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name: 'transform', value: transform }, 'PostgresQueryRunner requires a postgres.js client without a transform of the results (transform.' + name + '.from): the library reads each column by its name, with its value as the database gives it')
        }
    }
    // The session in the zone of the database: postgres.js sends the entries of `connection` (with the parameters of
    // the URL that aren't its own options) as settings of the session when it connects; the names of the settings
    // in any case, and `options` as the command-line options of the server (-c TimeZone=…)
    if (options?.infer === true && !isProcessInUtc()) {
        throw new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name: 'infer', value: true }, 'PostgresQueryRunner requires a postgres.js client without infer: true when the process does not run in UTC: with it postgres.js reads a timestamp with the zone of the process, and the date and time values are in UTC')
    }
}

/**
 * The zone postgres.js gives the session (see rejectSessionNotInDatabaseZone): it sends the entries of `connection`
 * (with the parameters of the URL that aren't its own options) as settings of the session when it connects; the names
 * of the settings in any case, and `options` as the command-line options of the server (-c TimeZone=…). The last one
 * that sets it; undefined when none does.
 */
function postgresJsSessionTimeZone(connection: unknown): SessionTimeZone | undefined {
    const connectionSettings = (connection as { options?: { connection?: unknown } }).options?.connection
    let session: SessionTimeZone | undefined
    if (connectionSettings && typeof connectionSettings === 'object') {
        for (const [key, value] of Object.entries(connectionSettings)) {
            const name = key.toLowerCase()
            const timeZone = name === 'timezone' ? (value === undefined || value === null ? undefined : String(value)) : name === 'options' ? postgreSqlOptionsTimeZone(value) : undefined
            if (timeZone !== undefined) {
                session = { queryRunner: 'PostgresQueryRunner', timeZone, name: 'connection', value: connectionSettings, origin: "postgres.js's connection." + key }
            }
        }
    }
    return session
}
