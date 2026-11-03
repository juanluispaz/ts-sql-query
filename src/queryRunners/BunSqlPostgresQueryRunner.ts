/// <reference types="bun-types" />

import { TsSqlError, TsSqlProcessingError, type TsSqlErrorReason } from '../TsSqlError.js'
import { AbstractBunSqlQueryRunner } from './AbstractBunSqlQueryRunner.js'
import { SQL, type TransactionSQL } from 'bun'
import type { BeginTransactionOpts } from './QueryRunner.js'
import { PostgresTransactionOutcome } from '../utils/postgresTransactionOutcome.js'
import { getBunSqlPostgresErrorReason, isBunSqlPostgresError } from './connectorErrorMappers/BunSqlPostgresErrorMapper.js'

export class BunSqlPostgresQueryRunner extends AbstractBunSqlQueryRunner {
    private readonly outcome = new PostgresTransactionOutcome()

    constructor(connection: SQL) {
        super(connection, 'postgreSql')
        const adapter = connection.options.adapter
        if (!(adapter == undefined || adapter == 'postgres')) {
            throw new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name: 'adapter', value: adapter }, 'BunSqlPostgresQueryRunner only supports Bun.SQL connections using the postgres adapter')
        }
    }
    protected override statementFailed(error: unknown): void {
        this.outcome.statementFailed(error, this.isTransactionActive())
    }
    protected override checkCommit(command: unknown): void {
        this.outcome.checkCommit(command)
    }
    protected override rollbackAlreadyDone(): boolean {
        return this.outcome.rollbackAlreadyDone()
    }
    protected override beginNativeTransaction<T>(opts: BeginTransactionOpts, options: string | undefined, callback: (transaction: TransactionSQL) => Promise<T>): Promise<T> {
        // Bun SQL would take the ROLLBACK PostgreSQL answers to the commit of a transaction a failed statement aborted
        // as a success: ending the function with an error makes Bun SQL roll it back instead, as postgres.js does
        return super.beginNativeTransaction(opts, options, (transaction) => callback(transaction).then((value) => {
            const error = this.outcome.failureOfTheTransaction()
            if (error) {
                throw error
            }
            return value
        }, (error) => {
            this.outcome.transactionEnded()
            throw error
        }))
    }
    override getErrorReason(error: unknown): TsSqlErrorReason {
        return BunSqlPostgresQueryRunner.getErrorReason(error)
    }
    override isSqlError(error: unknown): boolean {
        return BunSqlPostgresQueryRunner.isSqlError(error)
    }

    static getErrorReason(error: unknown): TsSqlErrorReason {
        if (error instanceof TsSqlError) {
            return error.errorReason
        }
        return getBunSqlPostgresErrorReason(error)
    }

    static isSqlError(error: unknown): boolean {
        return error instanceof TsSqlError || isBunSqlPostgresError(error)
    }
}
