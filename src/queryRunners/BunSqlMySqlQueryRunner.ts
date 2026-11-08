/// <reference types="bun-types" />

import { TsSqlError, TsSqlProcessingError, type TsSqlErrorReason } from '../TsSqlError.js'
import { AbstractBunSqlQueryRunner } from './AbstractBunSqlQueryRunner.js'
import type { BeginTransactionOpts, DatabaseType } from './QueryRunner.js'
import { SQL, type TransactionSQL } from 'bun'
import { getBunSqlMySqlErrorReason, isBunSqlMySqlAnyError } from './connectorErrorMappers/BunSqlMySqlErrorMapper.js'
import { isTransactionOpenAfterMySqlError } from '../utils/mySqlTransactionRollback.js'
import type { TypeCategory } from '../TypeAdapter.js'
import { setQueryParamType } from './QueryRunner.js'

export class BunSqlMySqlQueryRunner extends AbstractBunSqlQueryRunner {
    constructor(connection: SQL, database: 'mySql' | 'mariaDB' = 'mySql') {
        super(connection, database)
        const adapter = connection.options.adapter
        if (!(adapter === 'mysql' || adapter === 'mariadb')) {
            throw new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name: 'adapter', value: adapter }, 'BunSqlMySqlQueryRunner only supports Bun.SQL connections using the mysql or mariadb adapter')
        }
        // Without foundRows an UPDATE counts only the rows whose values changed, not the rows it matched,
        // so the update count (and the min/max checks of executeUpdate) would be wrong.
        const foundRows = connection.options.foundRows
        if (foundRows !== true) {
            throw new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name: 'foundRows', value: foundRows }, 'BunSqlMySqlQueryRunner requires a Bun.SQL connection created with foundRows: true (or ?foundRows=true in the connection URL)')
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
        return this.rejectWhenRolledBackByTheDatabase() || sql.unsafe(query, params).then((result) => {
            return result.affectedRows
        }, (error) => this.statementOfTheTransactionFailed(error))
    }
    override executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
        if (this.containsInsertReturningClause(query, params)) {
            return super.executeInsertReturningLastInsertedId(query, params)
        }

        const sql = this.transaction || this.lowLevelTransaction || this.connection
        // A suppressed `insert ignore` inserts no row and reports insert id 0: fall back to null (the same absence
        // the RETURNING path reports) when nothing was inserted.
        return this.rejectWhenRolledBackByTheDatabase() || sql.unsafe(query, params).then((result) => result.affectedRows === 0 ? null : result.lastInsertRowid, (error) => this.statementOfTheTransactionFailed(error))
    }
    protected override isTransactionOpenInTheDatabase(error: unknown): boolean | undefined {
        return isTransactionOpenAfterMySqlError(this.getErrorReason(error))
    }
    override addParam(params: any[], value: any, type: string, typeCategory: TypeCategory, forceTypeCast: boolean): string {
        setQueryParamType(params, params.length, type, typeCategory, forceTypeCast)
        params.push(value)
        return '?'
    }
    override createBeginTransactionOptions(opts: BeginTransactionOpts): string | undefined {
        // MySQL/MariaDB only accept the access mode in START TRANSACTION; the isolation
        // level is set beforehand on the same connection (see beginNativeTransaction).
        this.getTransactionLevel(opts)
        return this.getTransactionAccessMode(opts)
    }
    protected override beginNativeTransaction<T>(opts: BeginTransactionOpts, options: string | undefined, callback: (transaction: TransactionSQL) => Promise<T>): Promise<T> {
        const level = this.getTransactionLevel(opts)
        if (!level) {
            return super.beginNativeTransaction(opts, options, callback)
        }
        // SET TRANSACTION applies only to the next transaction started on that connection,
        // so the level must be set on the connection the transaction then runs on.
        return this.connection.reserve().then((reserved) => {
            return reserved.unsafe('set transaction isolation level ' + level).then(() => {
                return (options ? reserved.begin(options, callback) : reserved.begin(callback)) as Promise<T>
            }).finally(() => {
                reserved.release()
            })
        })
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
