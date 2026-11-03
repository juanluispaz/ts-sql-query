/// <reference types="bun-types" />

import { TsSqlError, TsSqlProcessingError, type TsSqlErrorReason } from '../TsSqlError.js'
import { AbstractBunSqlQueryRunner } from './AbstractBunSqlQueryRunner.js'
import { SQL } from 'bun'
import { PostgresTransactionOutcome } from '../utils/postgresTransactionOutcome.js'
import { getBunSqlPostgresErrorReason, isBunSqlPostgresError } from './connectorErrorMappers/BunSqlPostgresErrorMapper.js'

export class BunSqlPostgresQueryRunner extends AbstractBunSqlQueryRunner {
    protected override readonly transactionOutcome = new PostgresTransactionOutcome()

    constructor(connection: SQL) {
        super(connection, 'postgreSql')
        const adapter = connection.options.adapter
        if (!(adapter == undefined || adapter == 'postgres')) {
            throw new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name: 'adapter', value: adapter }, 'BunSqlPostgresQueryRunner only supports Bun.SQL connections using the postgres adapter')
        }
    }
    protected override checkCommit(command: unknown): void {
        this.transactionOutcome.checkCommit(command)
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
