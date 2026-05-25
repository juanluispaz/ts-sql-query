/// <reference types="bun-types" />

import { TsSqlError, TsSqlProcessingError, type TsSqlErrorReason } from '../TsSqlError.js'
import { AbstractBunSqlQueryRunner } from './AbstractBunSqlQueryRunner.js'
import type { BeginTransactionOpts, DatabaseType } from './QueryRunner.js'
import { SQL } from 'bun'
import { getBunSqlMySqlErrorReason, isBunSqlMySqlAnyError } from './connectorErrorMappers/BunSqlMySqlErrorMapper.js'

export class BunSqlMySqlQueryRunner extends AbstractBunSqlQueryRunner {
    constructor(connection: SQL, database: 'mySql' | 'mariaDB' = 'mySql') {
        super(connection, database)
        const adapter = connection.options.adapter
        if (!(adapter === 'mysql' || adapter === 'mariadb')) {
            throw new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name: 'adapter', value: adapter }, 'BunSqlMySqlQueryRunner only supports Bun.SQL connections using the mysql or mariadb adapter')
        }
    }
    override useDatabase(database: DatabaseType): void {
        if (database !== 'mySql' && database !== 'mariaDB') {
            throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_DATABASE', database }, 'Unsupported database: ' + database + '. BunSqlMySqlQueryRunner only supports mySql or mariaDB databases')
        }
        this.database = database
    }
    protected override executeMutation(query: string, params: any[]): Promise<number> {
        const sql = this.transaction || this.lowLevelTransaction || this.connection
        return sql.unsafe(query, params).then((result) => {
            return result.affectedRows
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
        return '?'
    }
    override createBeginTransactionQuery(opts: BeginTransactionOpts): string {
        const level = this.getTransactionLevel(opts)
        const accessMode = this.getTransactionAccessMode(opts)
        let sql = ''
        if (level) {
            sql += 'set transaction isolation level ' + level + '; '
        }
        sql += 'start transaction'
        if (accessMode) {
            sql += ' ' + accessMode
        }
        return sql
    }
    override getErrorReason(error: unknown): TsSqlErrorReason {
        return BunSqlMySqlQueryRunner.getErrorReason(error, this.database)
    }
    override isSqlError(error: unknown): boolean {
        return BunSqlMySqlQueryRunner.isSqlError(error)
    }

    static getErrorReason(error: unknown, database?: DatabaseType): TsSqlErrorReason {
        if (error instanceof TsSqlError) {
            return error.errorReason
        }
        return getBunSqlMySqlErrorReason(error, database)
    }

    static isSqlError(error: unknown): boolean {
        return error instanceof TsSqlError || isBunSqlMySqlAnyError(error)
    }
}
