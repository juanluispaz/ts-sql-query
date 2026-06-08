/// <reference types="bun-types" />

import { TsSqlError, TsSqlProcessingError, type TsSqlErrorReason } from '../TsSqlError.js'
import { AbstractBunSqlQueryRunner } from './AbstractBunSqlQueryRunner.js'
import { SQL } from 'bun'
import { getBunSqlPostgresErrorReason, isBunSqlPostgresError } from './connectorErrorMappers/BunSqlPostgresErrorMapper.js'

export class BunSqlPostgresQueryRunner extends AbstractBunSqlQueryRunner {
    constructor(connection: SQL) {
        super(connection, 'postgreSql')
        const adapter = connection.options.adapter
        if (!(adapter == undefined || adapter == 'postgres')) {
            throw new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name: 'adapter', value: adapter }, 'BunSqlPostgresQueryRunner only supports Bun.SQL connections using the postgres adapter')
        }
    }
    override addParam(params: any[], value: any): string {
        if (value instanceof Date) {
            // Bun.SQL's PostgreSQL adapter serializes a JS `Date` via `Date#toString()`
            // (e.g. `"Mon Jan 15 2024 …"`), which PostgreSQL rejects with `invalid input
            // syntax for type date|timestamp`. As a best-effort workaround this runner
            // serializes the `Date` to an ISO 8601 string before binding it. This is an
            // opinionated workaround that may change without backwards compatibility once
            // the upstream bug (https://github.com/oven-sh/bun/issues/29010) is fixed.
            return super.addParam(params, value.toISOString())
        }
        return super.addParam(params, value)
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
