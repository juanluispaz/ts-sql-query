/// <reference types="bun-types" />

import { TsSqlError, TsSqlProcessingError, type TsSqlErrorReason } from '../TsSqlError.js'
import { AbstractBunSqlQueryRunner } from './AbstractBunSqlQueryRunner.js'
import { SQL } from 'bun'
import { PostgresTransactionOutcome } from '../utils/postgreSql/postgresTransactionOutcome.js'
import { getBunSqlPostgresErrorReason, isBunSqlPostgresError } from './connectorErrorMappers/BunSqlPostgresErrorMapper.js'
import { queryRunnerParamBindings } from '../utils/queryRunnerParams.js'
import { postgreSqlDriverParams } from '../utils/postgreSql/postgreSqlParamTypes.js'

export interface BunSqlPostgresQueryRunnerConfig {
    /**
     * The cast, like `'numeric'`, written after the placeholder of a parameter of each type name (the name given to a
     * custom type, or a built-in one) where the library writes a cast, instead of the one of its category
     */
    typesByName?: { readonly [typeName: string]: string } | undefined
}

export class BunSqlPostgresQueryRunner extends AbstractBunSqlQueryRunner {
    protected override readonly transactionOutcome = new PostgresTransactionOutcome()
    private config?: BunSqlPostgresQueryRunnerConfig | undefined

    constructor(connection: SQL, config?: BunSqlPostgresQueryRunnerConfig) {
        super(connection, 'postgreSql')
        this.config = config
        const adapter = connection.options.adapter
        if (!(adapter == undefined || adapter == 'postgres')) {
            throw new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name: 'adapter', value: adapter }, 'BunSqlPostgresQueryRunner only supports Bun.SQL connections using the postgres adapter')
        }
    }
    protected override driverParams(params: any[]): any[] {
        return postgreSqlDriverParams(params)
    }
    override addParam(params: any[], value: any): string {
        // The same binding MockQueryRunner uses to imitate this query runner
        return queryRunnerParamBindings.BunSqlPostgresQueryRunner(params, value, this.config?.typesByName)
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
