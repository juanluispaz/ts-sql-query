/// <reference types="bun-types" />

import { TsSqlProcessingError } from '../TsSqlError.js'
import { SqlTransactionQueryRunner } from './SqlTransactionQueryRunner.js'
import { getGivenSqlConnection, type GivenSqlConnection } from '../utils/givenSqlConnection.js'
import type { BeginTransactionOpts, DatabaseType, QueryRunner } from './QueryRunner.js'
import type { SQL, TransactionSQL, ReservedSQL } from 'bun'

export abstract class AbstractBunSqlQueryRunner extends SqlTransactionQueryRunner {
    database: DatabaseType
    readonly connection: SQL
    transaction?: TransactionSQL | undefined
    lowLevelTransaction?: ReservedSQL | undefined
    private readonly givenConnection: GivenSqlConnection

    constructor(connection: SQL, database: DatabaseType) {
        super()
        this.connection = connection
        this.givenConnection = getGivenSqlConnection(connection)
        this.database = database
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
    addParam(params: any[], value: any): string {
        params.push(value)
        return '$' + params.length
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
    protected beginNativeTransaction<T>(_opts: BeginTransactionOpts, options: string | undefined, callback: (transaction: TransactionSQL) => Promise<T>): Promise<T> {
        if (options) {
            return this.connection.begin(options, callback) as Promise<T>
        } else {
            return this.connection.begin(callback) as Promise<T>
        }
    }
}