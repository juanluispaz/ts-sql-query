/// <reference types="bun-types" />

import { TsSqlProcessingError } from '../TsSqlError.js'
import { SqlTransactionQueryRunner } from './SqlTransactionQueryRunner.js'
import type { BeginTransactionOpts, DatabaseType, QueryRunner } from './QueryRunner.js'
import type { SQL, TransactionSQL, ReservedSQL } from 'bun'

export abstract class AbstractBunSqlQueryRunner extends SqlTransactionQueryRunner {
    database: DatabaseType
    readonly connection: SQL
    transaction?: TransactionSQL
    lowLevelTransaction?: ReservedSQL

    constructor(connection: SQL, database: DatabaseType) {
        super()
        this.connection = connection
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
    getCurrentNativeTransaction(): TransactionSQL | ReservedSQL | undefined {
        return this.transaction || this.lowLevelTransaction
    }
    private getSql(): SQL | TransactionSQL | ReservedSQL {
        return this.transaction || this.lowLevelTransaction || this.connection
    }
    execute<RESULT>(fn: (connection: unknown, transaction?: unknown) => Promise<RESULT>): Promise<RESULT> {
        return fn(this.connection, this.transaction || this.lowLevelTransaction)
    }
    protected executeQueryReturning(query: string, params: any[]): Promise<any[]> {
        return this.getSql().unsafe(query, params).then((result) => {
            // then is called to ensure the query is executed
            return result
        })
    }
    protected executeMutation(query: string, params: any[]): Promise<number> {
        return this.getSql().unsafe(query, params).then((result) => {
            // then is called to ensure the query is executed
            return result.count
        })
    }
    executeBeginTransactionQuery(query: string, params: any[]): Promise<number> {
        return this.connection.reserve().then((reserved) => {
            return reserved.unsafe(query, params).then(
                (result) => {
                    if (this.transaction || this.lowLevelTransaction) {
                        const error = new TsSqlProcessingError({ reason: 'FORBIDDEN_CONCURRENT_USAGE' }, 'Forbidden concurrent usage of the query runner was detected when it tried to start a transaction')
                        return reserved.unsafe('rollback', []).then(
                            () => {
                                reserved.release()
                                return this.createRejectedPromise(error)
                            },
                            () => {
                                reserved.release()
                                return this.createRejectedPromise(error)
                            }
                        )
                    }
                    this.lowLevelTransaction = reserved
                    return result.count
                },
                (error) => {
                    reserved.release()
                    return this.createRejectedPromise(error)
                }
            )
        })

    }
    executeCommitQuery(query: string, params: any[]): Promise<number> {
        const transaction = this.lowLevelTransaction
        if (!transaction) {
            return this.createRejectedPromise(new TsSqlProcessingError({ reason: 'NOT_IN_TRANSACTION' }, 'Not in a low level transaction, you cannot commit the transaction'))
        }

        return transaction.unsafe(query, params).then(
            (result) => {
                this.lowLevelTransaction = undefined
                transaction.release()
                return result.count
            },
            (error) => {
                return this.createRejectedPromise(error)
            }
        )
    }
    executeRollbackQuery(query: string, params: any[]): Promise<number> {
        const transaction = this.lowLevelTransaction
        if (!transaction) {
            return this.createRejectedPromise(new TsSqlProcessingError({ reason: 'NOT_IN_TRANSACTION' }, 'Not in a low level transaction, you cannot rollback the transaction'))
        }

        return transaction.unsafe(query, params).then(
            (result) => {
                this.lowLevelTransaction = undefined
                transaction.release()
                return result.count
            },
            (error) => {
                this.lowLevelTransaction = undefined
                transaction.release()
                return this.createRejectedPromise(error)
            }
        )
    }
    isTransactionActive(): boolean {
        return !!this.transaction || !!this.lowLevelTransaction || super.isTransactionActive()
    }
    addParam(params: any[], value: any): string {
        params.push(value)
        return '$' + params.length
    }
    executeInTransaction<T>(fn: () => Promise<T>, _outermostQueryRunner: QueryRunner, opts: BeginTransactionOpts = []): Promise<T> {
        if (this.transaction || this.lowLevelTransaction) {
            return this.createRejectedPromise(new TsSqlProcessingError({ reason: 'NESTED_TRANSACTION_NOT_SUPPORTED' }, 'Nested transactions are not supported by ' + this.constructor.name))
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
            return result.finally(() => {
                this.transaction = undefined
            })
        }
        if (options) {
            return this.connection.begin(options, callback) as Promise<T>
        } else {
            return this.connection.begin(callback) as Promise<T>
        }
    }
}