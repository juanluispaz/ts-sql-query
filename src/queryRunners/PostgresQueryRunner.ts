import { TsSqlProcessingError } from '../TsSqlError.js'
import { AbstractQueryRunner } from './AbstractQueryRunner.js'
import type { BeginTransactionOpts, CommitOpts, DatabaseType, QueryRunner, RollbackOpts } from './QueryRunner.js'
import type { Sql, TransactionSql } from 'postgres'

export class PostgresQueryRunner extends AbstractQueryRunner {
    database: DatabaseType
    readonly connection: Sql
    transaction?: TransactionSql

    constructor(connection: Sql) {
        super()
        this.connection = connection
        this.database = 'postgreSql'
    }
    useDatabase(database: DatabaseType): void {
        if (database !== 'postgreSql') {
            throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_DATABASE', database }, 'Unsupported database: ' + database + '. PostgresQueryRunner only supports postgreSql databases')
        }
    }
    getNativeRunner(): Sql {
        return this.connection
    }
    getCurrentNativeTransaction(): TransactionSql | undefined {
        return this.transaction
    }
    execute<RESULT>(fn: (connection: unknown, transaction?: unknown) => Promise<RESULT>): Promise<RESULT> {
        return fn(this.connection, this.transaction)
    }
    protected executeQueryReturning(query: string, params: any[]): Promise<any[]> {
        return (this.transaction || this.connection).unsafe(query, params).then((result) => {
            // then is called to ensure the query is executed
            return result
        })
    }
    protected executeMutation(query: string, params: any[]): Promise<number> {
        return (this.transaction || this.connection).unsafe(query, params).then((result) => {
            // then is called to ensure the query is executed
            return result.count
        })
    }
    executeBeginTransaction(_opts: BeginTransactionOpts = []): Promise<void> {
        return Promise.reject(new TsSqlProcessingError({ reason: 'LOW_LEVEL_TRANSACTION_NOT_SUPPORTED' }, 'Low level transaction management is not supported by PostgresQueryRunner'))
    }
    executeCommit(_opts: CommitOpts = []): Promise<void> {
        return Promise.reject(new TsSqlProcessingError({ reason: 'LOW_LEVEL_TRANSACTION_NOT_SUPPORTED' }, 'Low level transaction management is not supported by PostgresQueryRunner'))
    }
    executeRollback(_opts: RollbackOpts = []): Promise<void> {
        return Promise.reject(new TsSqlProcessingError({ reason: 'LOW_LEVEL_TRANSACTION_NOT_SUPPORTED' }, 'Low level transaction management is not supported by PostgresQueryRunner'))
    }
    isTransactionActive(): boolean {
        return !!this.transaction
    }
    addParam(params: any[], value: any): string {
        params.push(value)
        return '$' + params.length
    }
    executeInTransaction<T>(fn: () => Promise<T>, _outermostQueryRunner: QueryRunner, opts: BeginTransactionOpts = []): Promise<T> {
        if (this.transaction) {
            throw new TsSqlProcessingError({ reason: 'NESTED_TRANSACTION_NOT_SUPPORTED' }, 'Nested transactions is not supported by PostgresQueryRunner')
        }
        let options
        try {
            options = this.createBeginTransactionOptions(opts)
        } catch (error) {
            return this.createRejectedPromise(error)
        }
        const callback = (transaction: TransactionSql) => {
            if (this.transaction) {
                throw new TsSqlProcessingError({ reason: 'FORBIDDEN_CONCURRENT_USAGE' }, 'Forbidden concurrent usage of the query runner was detected when it tried to start a transaction')
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
    lowLevelTransactionManagementSupported(): boolean {
        return false
    }
    getTransactionLevel(opts: BeginTransactionOpts): string | undefined {
        const level = opts?.[0]
        if (!level || level === 'read uncommitted' || level === 'read committed' || level === 'repeatable read' || level === 'serializable') {
            return level
        }
        throw new TsSqlProcessingError({ reason: 'TRANSACTION_LEVEL_NOT_SUPPORTED', transactionLevel: level }, this.database + " doesn't support the transactions level: " + level)
    }
    getTransactionAccessMode(opts: BeginTransactionOpts): string | undefined {
        const accessMode = opts?.[1]
        if (!accessMode || accessMode === 'read write' || accessMode === 'read only') {
            return accessMode
        }
        throw new TsSqlProcessingError({ reason: 'TRANSACTION_ACCESS_MODE_NOT_SUPPORTED', accessMode }, this.database + " doesn't support the transactions access mode: " + accessMode)
    }
    createBeginTransactionOptions(opts: BeginTransactionOpts): string | undefined {
        let sql
        let level = this.getTransactionLevel(opts)
        if (level) {
            sql = 'isolation level ' + level
        }
        const accessMode = this.getTransactionAccessMode(opts)
        if (accessMode) {
            if (sql) {
                sql += ', '
            }
            sql += accessMode
        }
        return sql
    }
}
