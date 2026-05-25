/// <reference types="bun-types" />

import { TsSqlError, TsSqlProcessingError, type TsSqlErrorReason } from '../TsSqlError.js'
import { AbstractBunSqlQueryRunner } from './AbstractBunSqlQueryRunner.js'
import { SQL } from 'bun'
import { getBunSqlSqliteErrorReason, isBunSqlSqliteError } from './connectorErrorMappers/BunSqlSqliteErrorMapper.js'

export class BunSqlSqliteQueryRunner extends AbstractBunSqlQueryRunner {
    constructor(connection: SQL) {
        super(connection, 'sqlite')
        const adapter = connection.options.adapter
        if (adapter !== 'sqlite') {
            throw new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name: 'adapter', value: adapter }, 'BunSqlSqliteQueryRunner only supports Bun.SQL connections using the sqlite adapter')
        }
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
    override executeInsert(query: string, params: any[] = []): Promise<number> {
        const sql = this.transaction || this.lowLevelTransaction || this.connection
        return sql.unsafe(query, params).then((result) => {
            const count = result.count
            if (count !== 0 || !this.requiresInsertSelectCountWorkaround(query, params)) {
                return count
            }

            // Workaround for https://github.com/oven-sh/bun/issues/30811
            return sql.unsafe('select changes() as changes', []).then((rows) => {
                const changes = (rows[0] as { changes?: number | bigint | null } | undefined)?.changes
                if (changes === undefined || changes === null) {
                    return count
                }
                return Number(changes)
            })
        })
    }
    override executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
        if (this.containsInsertReturningClause(query, params)) {
            return super.executeInsertReturningLastInsertedId(query, params)
        }

        const sql = this.transaction || this.lowLevelTransaction || this.connection
        return sql.unsafe(query, params).then((result) => result.lastInsertRowid)
    }
    override addParam(params: any[], value: any): string {
        params.push(value)
        return '$' + params.length
    }
    private requiresInsertSelectCountWorkaround(query: string, params: any[]): boolean {
        return /\bselect\b/i.test(query) && !this.containsInsertReturningClause(query, params)
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
