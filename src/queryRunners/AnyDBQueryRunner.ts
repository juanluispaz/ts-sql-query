import { QueryRunner, DatabaseType } from "./QueryRunner"
import { Connection, ResultSet } from 'any-db'
import * as begin  from 'any-db-transaction'

export class AnyDBQueryRunner implements QueryRunner {
    // Supported databases
    readonly mariaDB: true = true
    readonly mySql: true = true
    readonly postgreSql: true = true
    readonly sqlite: true = true
    readonly sqlServer: true = true
    readonly database: DatabaseType

    readonly connection: Connection
    transaction?: begin.Transaction

    constructor(connection: Connection) {
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

    getNativeConnection(): Connection {
        return this.connection
    }

    executeSelectOneRow(query: string, params: any[]): Promise<any> {
        return this.query(query, params).then((result) => {
            if (result.rows.length > 1) {
                throw new Error('Too many rows, expected only zero or one row')
            }
            result.rows[0]
        })
    }
    executeSelectManyRows(query: string, params: any[]): Promise<any[]> {
        return this.query(query, params).then((result) => result.rows)
    }
    executeSelectOneColumnOneRow(query: string, params: any[]): Promise<any> {
        return this.query(query, params).then((result) => {
            if (result.rows.length > 1) {
                throw new Error('Too many rows, expected only zero or one row')
            }
            const row = result.rows[0]
            if (row) {
                const columns = Object.getOwnPropertyNames(row)
                if (columns.length > 1) {
                    throw new Error('Too many columns, expected only one column')
                }
                return row[columns[0]]
            }
            return undefined
        })
    }
    executeSelectOneColumnManyRows(query: string, params: any[]): Promise<any[]> {
        return this.query(query, params).then((result) => result.rows.map((row) => {
            const columns = Object.getOwnPropertyNames(row)
            if (columns.length > 1) {
                throw new Error('Too many columns, expected only one column')
            }
            return row[columns[0]]
        }))
    }
    executeInsert(query: string, params: any[]): Promise<number> {
        return this.query(query, params).then((result) => result.rowCount)
    }
    executeInsertReturningLastInsertedId(query: string, params: any[]): Promise<any> {
        const adapterName = this.connection.adapter.name
        if (adapterName !== 'mssql' && adapterName !== 'postgreSql') {
            throw new Error('Unsupported executeInsertReturningLastInsertedId for this database')
        }
        return this.query(query, params).then((result) => {
            return result.rows.map((row) => {
                const columns = Object.getOwnPropertyNames(row)
                if (columns.length > 1) {
                    throw new Error('Too many columns, expected only one column')
                }
                return row[columns[0]]
            })
        })
    }
    executeInsertReturningMultipleLastInsertedId(query: string, params: any[]): Promise<any> {
        return this.query(query, params).then((result) => {
            if (result.lastInsertId !== undefined) {
                return result.lastInsertId
            }
            if (result.rows.length > 1) {
                throw new Error('Too many rows, expected only zero or one row')
            }
            const row = result.rows[0]
            if (row) {
                const columns = Object.getOwnPropertyNames(row)
                if (columns.length > 1) {
                    throw new Error('Too many columns, expected only one column')
                }
                return row[columns[0]]
            }
            throw new Error('Unable to find the last inserted id')
        })
    }
    executeUpdate(query: string, params: any[]): Promise<number> {
        return this.query(query, params).then((result) => result.rowCount)
    }
    executeDelete(query: string, params: any[]): Promise<number> {
        return this.query(query, params).then((result) => result.rowCount)
    }
    executeProcedure(query: string, params: any[]): Promise<void> {
        return this.query(query, params).then(() => undefined)
    }
    executeFunction(query: string, params: any[]): Promise<any> {
        return this.query(query, params).then((result) => {
            if (result.rows.length > 1) {
                throw new Error('Too many rows, expected only zero or one row')
            }
            const row = result.rows[0]
            if (row) {
                const columns = Object.getOwnPropertyNames(row)
                if (columns.length > 1) {
                    throw new Error('Too many columns, expected only one column')
                }
                return row[columns[0]]
            }
            return undefined
        })
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
                if (error) {
                    reject(error)
                } else {
                    this.transaction = undefined
                    resolve()
                }
            })
        })
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
                result = '$' + index
                break
            default:
                throw new Error('Unknown any-db adapter of name ' + this.connection.adapter.name)
        }
        params.push(value)
        return result

    }
    addOutParam(_params: any[], _name: string): string {
        throw new Error('Unsupported output parameters')
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