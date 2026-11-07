import { TsSqlError, TsSqlProcessingError, type TsSqlErrorReason } from '../TsSqlError.js'
import { SqlTransactionQueryRunner } from './SqlTransactionQueryRunner.js'
import { getGivenSqlConnection, type GivenSqlConnection } from '../utils/givenSqlConnection.js'
import { PostgresTransactionOutcome } from '../utils/postgresTransactionOutcome.js'
import type { BeginTransactionOpts, DatabaseType, QueryRunner } from './QueryRunner.js'
import type { Sql, ReservedSql, TransactionSql } from 'postgres'
import { getPostgresJsErrorReason, isPostgresJsError } from './connectorErrorMappers/PostgresErrorMapper.js'
import type { TypeCategory } from '../TypeAdapter.js'
import { setQueryParamType } from './QueryRunner.js'

export class PostgresQueryRunner extends SqlTransactionQueryRunner {
    database: DatabaseType
    readonly connection: Sql
    transaction?: TransactionSql | undefined
    lowLevelTransaction?: ReservedSql | undefined
    private readonly givenConnection: GivenSqlConnection
    protected override readonly transactionOutcome = new PostgresTransactionOutcome()

    /** connection: the client of a pool, a connection reserved from it, or a transaction begun with it */
    constructor(connection: Sql | TransactionSql | ReservedSql) {
        super()
        // Only a pool client is asked to reserve or begin (see givenConnection)
        this.connection = connection as Sql
        this.givenConnection = getGivenSqlConnection(connection)
        this.database = 'postgreSql'
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
    protected executeQueryReturning(query: string, params: any[]): Promise<any[]> {
        return this.rejectWhenRolledBackByTheDatabase() || this.getSql().unsafe(query, params).then((result) => {
            // then is called to ensure the query is executed
            return result
        }, (error) => this.statementOfTheTransactionFailed(error))
    }
    protected executeMutation(query: string, params: any[]): Promise<number> {
        return this.rejectWhenRolledBackByTheDatabase() || this.getSql().unsafe(query, params).then((result) => {
            // then is called to ensure the query is executed
            return result.count
        }, (error) => this.statementOfTheTransactionFailed(error))
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
    addParam(params: any[], value: any, type: string, typeCategory: TypeCategory): string {
        setQueryParamType(params, params.length, type, typeCategory)
        params.push(value)
        return '$' + params.length
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
