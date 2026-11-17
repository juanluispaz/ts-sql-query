/// <reference types="bun-types" />

import { TsSqlProcessingError } from '../TsSqlError.js'
import { SqlTransactionQueryRunner } from './SqlTransactionQueryRunner.js'
import { getGivenSqlConnection, type GivenSqlConnection } from '../utils/givenSqlConnection.js'
import type { BeginTransactionOpts, DatabaseType, QueryRunner } from './QueryRunner.js'
import type { SQL, TransactionSQL, ReservedSQL } from 'bun'
import type { DataTypeClass } from '../TypeAdapter.js'
import type { DataTypeName } from '../typeSystem/dataTypeNames.js'

/**
 * The base of the query runners of Bun SQL (`SQL` of `bun`), over a pool, a reserved connection or a transaction of
 * Bun SQL. Bun SQL begins and ends a transaction by itself in the function it receives (`begin`): executeInTransaction
 * runs the transaction there; a transaction begun with connection.beginTransaction() runs on a connection reserved
 * from the pool.
 */
export abstract class AbstractBunSqlQueryRunner extends SqlTransactionQueryRunner {
    /** The database the SQL is written for */
    protected currentDatabase: DatabaseType
    /** The `SQL` of Bun the query runner was created with: a pool, a reserved connection or a transaction */
    readonly connection: SQL
    /** The transaction of Bun SQL that executeInTransaction runs in, while it runs */
    transaction?: TransactionSQL | undefined
    /** The connection reserved from the pool for a transaction begun with executeBeginTransaction, until it ends */
    lowLevelTransaction?: ReservedSQL | undefined
    /** What the `SQL` given to the constructor is: a pool, a reserved connection or a transaction */
    protected readonly givenConnection: GivenSqlConnection

    constructor(connection: SQL, database: DatabaseType) {
        super()
        // The library reads each column of a row by its name: a transform that renames the columns of the results
        // (`transform: SQL.camel`, `SQL.toCamel`, a function, or `column.from`) can't be undone per query. The names it
        // sends (`column.to`, used only by the helpers of sql``) and `undefined` don't change what the library reads.
        // Bun turns a function given as `column` into `column.from`; a function kept as it was given is refused too.
        const column = (connection as { options?: { transform?: { column?: unknown } } }).options?.transform?.column
        const columnFrom = typeof column === 'function' ? column : (column as { from?: unknown } | undefined)?.from
        if (columnFrom) {
            throw new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name: 'transform', value: columnFrom }, this.constructor.name + ' requires a Bun.SQL connection without a transform that renames the columns of the results (transform.column.from, SQL.camel, SQL.toCamel...): the library reads each column by its name')
        }
        this.connection = connection
        this.givenConnection = getGivenSqlConnection(connection)
        this.currentDatabase = database
    }
    get database(): DatabaseType {
        return this.currentDatabase
    }
    useDatabase(database: DatabaseType): void {
        if (database !== this.database) {
            throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_DATABASE', database }, 'Unsupported database: ' + database + '. ' + this.constructor.name + ' only supports ' + this.database + ' databases')
        }
    }
    getNativeRunner(): SQL {
        return this.connection
    }
    getCurrentNativeConnection(): SQL | TransactionSQL | ReservedSQL | undefined {
        return this.transaction || this.lowLevelTransaction
    }
    private getSql(): SQL | TransactionSQL | ReservedSQL {
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
    /** The params as the driver receives them; the params of the query keep the value the connection handed */
    protected driverParams(params: any[]): any[] {
        return params
    }
    protected executeQueryReturning(query: string, params: any[]): Promise<any[]> {
        return this.rejectWhenRolledBackByTheDatabase() || this.getSql().unsafe(query, this.driverParams(params)).then((result) => {
            // then is called to ensure the query is executed
            return result
        }, (error) => this.statementOfTheTransactionFailed(error))
    }
    protected executeMutation(query: string, params: any[]): Promise<number> {
        return this.rejectWhenRolledBackByTheDatabase() || this.getSql().unsafe(query, this.driverParams(params)).then((result) => {
            // then is called to ensure the query is executed
            return result.count
        }, (error) => this.statementOfTheTransactionFailed(error))
    }
    override executeBeginTransactionQuery(query: string, params: any[]): Promise<number> {
        return this.reserveForTransaction().then((reserved) => {
            return reserved.unsafe(query, params).then(
                (result) => {
                    if (this.transaction || this.lowLevelTransaction) {
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
                this.checkCommit(result.command)
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
    private reserveForTransaction(): Promise<ReservedSQL> {
        if (this.givenConnection === 'transaction') {
            return this.createRejectedPromise(new TsSqlProcessingError({ reason: 'NESTED_TRANSACTION_NOT_SUPPORTED' }, this.constructor.name + ' was created with a transaction of Bun SQL, and a transaction can\'t begin inside it'))
        }
        if (this.givenConnection === 'reserved') {
            return this.createResolvedPromise(this.connection as unknown as ReservedSQL)
        }
        return this.connection.reserve()
    }
    /** Checks the answer to the commit, the transaction being committed when it doesn't throw */
    protected checkCommit(_command: unknown): void {
    }
    protected override rollbackAlreadyDoneByTheDatabase(): void {
        const transaction = this.lowLevelTransaction
        if (transaction) {
            this.lowLevelTransaction = undefined
            this.releaseReserved(transaction)
        }
    }
    private releaseReserved(reserved: ReservedSQL): void {
        // A connection the caller reserved is theirs to release
        if (reserved !== (this.connection as unknown)) {
            reserved.release()
        }
    }
    override isTransactionActive(): boolean {
        return !!this.transaction || !!this.lowLevelTransaction || super.isTransactionActive()
    }
    addParam(params: any[], value: any, _type: DataTypeName | DataTypeClass | undefined): string {
        params.push(value)
        return '$' + params.length
    }
    // The driver begins and commits a transaction by itself, in the function it receives
    override get executeInTransactionCallsBeginAndCommit(): boolean {
        return false
    }
    override executeInTransaction<T>(fn: () => Promise<T>, _outermostQueryRunner: QueryRunner, opts: BeginTransactionOpts = []): Promise<T> {
        if (this.transaction || this.lowLevelTransaction) {
            return this.createRejectedPromise(new TsSqlProcessingError({ reason: 'NESTED_TRANSACTION_NOT_SUPPORTED' }, 'Nested transactions are not supported by ' + this.constructor.name))
        }
        if (this.givenConnection === 'transaction') {
            return this.createRejectedPromise(new TsSqlProcessingError({ reason: 'NESTED_TRANSACTION_NOT_SUPPORTED' }, this.constructor.name + ' was created with a transaction of Bun SQL, and a transaction can\'t begin inside it'))
        }
        let options
        try {
            options = this.createBeginTransactionOptions(opts)
        } catch (error) {
            return this.createRejectedPromise(error)
        }
        const callback = (transaction: TransactionSQL) => {
            if (this.transaction || this.lowLevelTransaction) {
                return this.createRejectedPromise(new TsSqlProcessingError({ reason: 'FORBIDDEN_CONCURRENT_USAGE' }, 'Forbidden concurrent usage of the query runner was detected when it tried to start a transaction'))
            }
            this.transaction = transaction
            let result = fn()
            return result.then((value) => {
                // Bun SQL would commit a transaction the database already rolled back
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
        return this.beginNativeTransaction(opts, options, callback)
    }
    /**
     * Runs callback in a transaction of Bun SQL (`begin`), with the options of the transaction when there are some; a
     * subclass writes them in its own way
     */
    protected beginNativeTransaction<T>(_opts: BeginTransactionOpts, options: string | undefined, callback: (transaction: TransactionSQL) => Promise<T>): Promise<T> {
        if (options) {
            return this.connection.begin(options, callback) as Promise<T>
        } else {
            return this.connection.begin(callback) as Promise<T>
        }
    }
}