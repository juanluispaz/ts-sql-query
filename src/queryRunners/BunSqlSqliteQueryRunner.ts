/// <reference types="bun-types" />

import { TsSqlError, TsSqlProcessingError, type TsSqlErrorReason } from '../TsSqlError.js'
import { AbstractBunSqlQueryRunner } from './AbstractBunSqlQueryRunner.js'
import { SQL, type TransactionSQL } from 'bun'
import { getBunSqlSqliteErrorReason, isBunSqlSqliteError } from './connectorErrorMappers/BunSqlSqliteErrorMapper.js'

export class BunSqlSqliteQueryRunner extends AbstractBunSqlQueryRunner {
    constructor(connection: SQL) {
        super(connection, 'sqlite')
        const adapter = connection.options.adapter
        if (adapter !== 'sqlite') {
            throw new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name: 'adapter', value: adapter }, 'BunSqlSqliteQueryRunner only supports Bun.SQL connections using the sqlite adapter')
        }
    }
    // SQLite has a single connection, which Bun SQL doesn't reserve: the transaction begun with beginTransaction runs
    // on it
    override getCurrentNativeConnection(): SQL | TransactionSQL | undefined {
        return this.transaction || (this.isTransactionActive() ? this.connection : undefined)
    }
    override execute<RESULT>(fn: (connection: unknown) => Promise<RESULT>): Promise<RESULT> {
        return fn(this.transaction || this.connection)
    }
    override executeBeginTransactionQuery(query: string, params: any[]): Promise<number> {
        return this.connection.unsafe(query, params).then((result) => result.count)
    }
    override executeCommitQuery(query: string, params: any[]): Promise<number> {
        return this.connection.unsafe(query, params).then((result) => result.count)
    }
    override executeRollbackQuery(query: string, params: any[]): Promise<number> {
        return this.connection.unsafe(query, params).then((result) => result.count)
    }
    override executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
        if (this.containsInsertReturningClause(query, params)) {
            return super.executeInsertReturningLastInsertedId(query, params)
        }

        const sql = this.transaction || this.lowLevelTransaction || this.connection
        // A suppressed `on conflict do nothing` inserts no row; `lastInsertRowid`
        // then still holds the previous statement's id, so fall back to null (the
        // same absence the RETURNING path reports) when nothing was inserted.
        return sql.unsafe(query, params).then((result) => result.count === 0 ? null : result.lastInsertRowid)
    }
    override addParam(params: any[], value: any): string {
        params.push(value)
        return '?' + params.length
    }
    override getErrorReason(error: unknown): TsSqlErrorReason {
        return BunSqlSqliteQueryRunner.getErrorReason(error)
    }
    override isSqlError(error: unknown): boolean {
        return BunSqlSqliteQueryRunner.isSqlError(error)
    }

    static getErrorReason(error: unknown): TsSqlErrorReason {
        if (error instanceof TsSqlError) {
            return error.errorReason
        }
        return getBunSqlSqliteErrorReason(error)
    }

    static isSqlError(error: unknown): boolean {
        return error instanceof TsSqlError || isBunSqlSqliteError(error)
    }
}
