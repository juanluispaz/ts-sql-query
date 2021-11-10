import type { DatabaseType } from "./QueryRunner"
import type { Connection, ResultSet } from 'any-db'
import * as begin  from 'any-db-transaction'
import { PromiseBasedQueryRunner } from "./PromiseBasedQueryRunner"

export class AnyDBQueryRunner extends PromiseBasedQueryRunner {
    readonly database: DatabaseType

    readonly connection: Connection
    transaction?: begin.Transaction

    constructor(connection: Connection) {
        super()
        this.connection = connection
        switch (this.connection.adapter.name) {
            case 'mssql':
                this.database = 'sqlServer'
                break
            case 'mysql':
                this.database = 'mySql'
                break
            case 'postgres':
                this.database = 'postgreSql'
                break
            case 'sqlite3':
                this.database = 'sqlite'
                break
            default:
                throw new Error('Unknown any-db adapter of name ' + this.connection.adapter.name)
        }
    }

    useDatabase(database: DatabaseType): void {
        if (database !== this.database) {
            if (this.database === 'mySql' && database === 'mariaDB') {
                // @ts-ignore
                this.database = database
            } else if (this.database === 'mariaDB' && database === 'mySql') {
                // @ts-ignore
                this.database = database
            } else if (this.database === 'mySql' || this.database === 'mariaDB') {
                throw new Error('Unsupported database: ' + database + '. The current connection used in AnyDBQueryRunner only supports mySql or mariaDB databases')
            } else {
                throw new Error('Unsupported database: ' + database + '. The current connection used in AnyDBQueryRunner only supports ' + this.database + ' databases')
            }
        }
    }

    getNativeRunner(): Connection {
        return this.connection
    }

    getCurrentNativeTransaction(): begin.Transaction | undefined {
        return this.transaction
    }

    execute<RESULT>(fn: (connection: unknown, transaction?: unknown) => Promise<RESULT>): Promise<RESULT> {
        return fn(this.connection, this.transaction)
    }

    protected executeQueryReturning(query: string, params: any[]): Promise<any[]> {
        return this.query(query, params).then(result => result.rows)
    }
    protected executeMutation(query: string, params: any[]): Promise<number> {
        return this.query(query, params).then(result => result.rowCount)
    }
    protected executeMutationReturning(query: string, params: any[]): Promise<any[]> {
        if (this.database !== 'sqlite') {
            return super.executeMutationReturning(query, params)
        }
        throw new Error('Unsupported returning clause on queries for sqlite on AnyDBQueryRunner')
    }
    executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
        const database = this.database
        if (database === 'sqlite' || database === 'mariaDB' || database === 'mySql') {
            if (this.containsInsertReturningClause(query, params)) {
                if (database == 'sqlite') {
                    throw new Error ("AnyDBQueryRunner doesn't support insert with the returning clause for sqlite. Enable the compatibility mode in the ts-sql-query connection object to avoid using the returning clause")
                }
                return super.executeInsertReturningLastInsertedId(query, params)
            }

            return this.query(query, params).then(result => result.lastInsertId)
        }
        
        return super.executeInsertReturningLastInsertedId(query, params)
    }
    executeInsertReturningMultipleLastInsertedId(query: string, params: any[] = []): Promise<any> {
        if (this.database !== 'sqlite') {
            return super.executeInsertReturningMultipleLastInsertedId(query, params)
        }
        if (this.containsInsertReturningClause(query, params)) {
            throw new Error ("AnyDBQueryRunner doesn't support insert with the returning clause for sqlite")
        }
        throw new Error("Unsupported executeInsertReturningMultipleLastInsertedId on queries for sqlite on AnyDBQueryRunner")
    }
    executeBeginTransaction(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.transaction) {
                reject(new Error('Already in an transaction, you can only use one transaction'))
                return
            }
            begin(this.connection, (error, transaction) => {
                if (error) {
                    reject(error)
                } else {
                    this.transaction = transaction
                    resolve()
                }
            })
        })
    }
    executeCommit(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.transaction) {
                reject(new Error('Not in an transaction, you cannot commit the transaction'))
                return
            }
            this.transaction.commit((error) => {
                if (error) {
                    // Transaction count only modified when commit successful, in case of error there is still an open transaction 
                    reject(error)
                } else {
                    this.transaction = undefined
                    resolve()
                }
            })
        })
    }
    executeRollback(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.transaction) {
                reject(new Error('Not in an transaction, you cannot rollback the transaction'))
                return
            }
            this.transaction.rollback((error) => {
                this.transaction = undefined
                if (error) {
                    reject(error)
                } else {
                    resolve()
                }
            })
        })
    }
    isTransactionActive(): boolean {
        return !!this.transaction
    }
    addParam(params: any[], value: any): string {
        const index = params.length
        let result
        switch (this.connection.adapter.name) {
            case 'mssql':
                result = '@' + index
                break
            case 'mysql':
                result = '?'
                break
            case 'postgres':
                result = '$' + (index + 1)
                break
            case 'sqlite3':
                result = '?'
                break
            default:
                throw new Error('Unknown any-db adapter of name ' + this.connection.adapter.name)
        }
        params.push(value)
        return result

    }
    protected query(query: string, params?: any[]): Promise<ResultSet> {
        let queryParams: any = params
        if (params && this.connection.adapter.name === 'mssql') {
            // transform positional params to named ones, this avoid the any-db transformation
            queryParams = {}
            for (let i = 0, length = params.length; i < length; i++) {
                queryParams[i] = params[i]
            }
        }
        return new Promise((resolve, reject) => {
            const queryable = this.transaction || this.connection
            queryable.query(query, queryParams, (error, result) => {
                if (error) {
                    reject(error)
                } else {
                    resolve(result)
                }
            })
        })
    }
}