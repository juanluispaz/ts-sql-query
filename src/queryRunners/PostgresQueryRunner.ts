import type { UnwrapPromiseTuple } from "../utils/PromiseProvider"
import { PromiseBasedAbstractQueryRunner } from "./PromiseBasedAbstractQueryRunner"
import type { DatabaseType, QueryRunner } from "./QueryRunner"
import type { Sql, TransactionSql } from 'postgres'

export class PostgresQueryRunner extends PromiseBasedAbstractQueryRunner {
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
            throw new Error('Unsupported database: ' + database + '. PostgresQueryRunner only supports postgreSql databases')
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
    executeBeginTransaction(): Promise<void> {
        return Promise.reject(new Error('Low level transaction management is not supported by PostgresQueryRunner'))
    }
    executeCommit(): Promise<void> {
        return Promise.reject(new Error('Low level transaction management is not supported by PostgresQueryRunner'))
    }
    executeRollback(): Promise<void> {
        return Promise.reject(new Error('Low level transaction management is not supported by PostgresQueryRunner'))
    }
    isTransactionActive(): boolean {
        return !!this.transaction
    }
    addParam(params: any[], value: any): string {
        params.push(value)
        return '$' + params.length
    }
    executeInTransaction<P extends Promise<any>[]>(fn: () => [...P], outermostQueryRunner: QueryRunner): Promise<UnwrapPromiseTuple<P>>
    executeInTransaction<T>(fn: () => Promise<T>, outermostQueryRunner: QueryRunner): Promise<T>
    executeInTransaction(fn: () => Promise<any>[] | Promise<any>, outermostQueryRunner: QueryRunner): Promise<any>
    executeInTransaction(fn: () => Promise<any>[] | Promise<any>, _outermostQueryRunner: QueryRunner): Promise<any> {
        if (this.transaction) {
            throw new Error('Nested transactions is not supported by PostgresQueryRunner')
        }
        return this.connection.begin((transaction) => {
            if (this.transaction) {
                throw new Error('Forbidden concurrent usage of the query runner was detected when it tried to start a transaction')
            }
            this.transaction = transaction
            let result = fn()
            if (Array.isArray(result)) {
                result = this.createAllPromise(result)
            }
            return result.finally(() => {
                this.transaction = undefined
            })
        })
    }
    lowLevelTransactionManagementSupported(): boolean {
        return false
    }
}