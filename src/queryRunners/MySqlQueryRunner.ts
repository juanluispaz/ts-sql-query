import { QueryRunner, DatabaseType } from "./QueryRunner"
import { Connection } from "mysql"

export class MySqlQueryRunner implements QueryRunner {
    readonly mySql: true = true
    readonly mariaDB: true = true
    readonly database: DatabaseType
    readonly connection: Connection

    constructor(connection: Connection, database: 'mariaDB' | 'mySql' = 'mySql') {
        this.connection = connection
        this.database = database
    }

    getNativeConnection(): Connection {
        return this.connection
    }

    executeSelectOneRow(query: string, params: any[]): Promise<any> {
        return new Promise((resolve, reject) => {
            this.connection.query(query, params, (error, results) => {
                if (error) {
                    reject(error)
                } else {
                    if (results.length > 1) {
                        reject(new Error('Too many rows, expected only zero or one row'))
                        return
                    }
                    resolve(results[0])
                }
            })
        })
    }
    executeSelectManyRows(query: string, params: any[]): Promise<any[]> {
        return new Promise((resolve, reject) => {
            this.connection.query(query, params, (error, results) => {
                if (error) {
                    reject(error)
                } else {
                    resolve(results)
                }
            })
        })
    }
    executeSelectOneColumnOneRow(query: string, params: any[]): Promise<any> {
        return new Promise((resolve, reject) => {
            this.connection.query(query, params, (error, results) => {
                if (error) {
                    reject(error)
                } else {
                    if (results.length > 1) {
                        reject(new Error('Too many rows, expected only zero or one row'))
                        return
                    }
                    const row = results[0]
                    if (row) {
                        const columns = Object.getOwnPropertyNames(row)
                        if (columns.length > 1) {
                            reject(Error('Too many columns, expected only one column'))
                            return
                        }
                        resolve(row[columns[0]])
                        return
                    }
                    resolve(undefined)
                }
            })
        })
    }
    executeSelectOneColumnManyRows(query: string, params: any[]): Promise<any[]> {
        return new Promise((resolve, reject) => {
            this.connection.query(query, params, (error, results) => {
                if (error) {
                    reject(error)
                } else {
                    const result = []
                    for (let i = 0, length = results.length; i < length; i++) {
                        const row = results[i]
                        const columns = Object.getOwnPropertyNames(row)
                        if (columns.length > 1) {
                            reject(new Error('Too many columns, expected only one column'))
                            return
                        }
                        result.push(row[columns[0]])
                    }
                    resolve(result)
                }
            })
        })
    }
    executeInsert(query: string, params: any[]): Promise<number> {
        return new Promise((resolve, reject) => {
            this.connection.query(query, params, (error, results) => {
                if (error) {
                    reject(error)
                } else {
                    resolve(results.affectedRows)
                }
            })
        })
    }
    executeInsertReturningLastInsertedId(query: string, params: any[]): Promise<any> {
        return new Promise((resolve, reject) => {
            this.connection.query(query, params, (error, results) => {
                if (error) {
                    reject(error)
                } else {
                    resolve(results.insertId)
                }
            })
        })
    }
    executeUpdate(query: string, params: any[]): Promise<number> {
        return new Promise((resolve, reject) => {
            this.connection.query(query, params, (error, results) => {
                if (error) {
                    reject(error)
                } else {
                    resolve(results.affectedRows)
                }
            })
        })
    }
    executeDelete(query: string, params: any[]): Promise<number> {
        return new Promise((resolve, reject) => {
            this.connection.query(query, params, (error, results) => {
                if (error) {
                    reject(error)
                } else {
                    resolve(results.affectedRows)
                }
            })
        })
    }
    executeProcedure(query: string, params: any[]): Promise<void> {
        return new Promise((resolve, reject) => {
            this.connection.query(query, params, (error) => {
                if (error) {
                    reject(error)
                } else {
                    resolve(undefined)
                }
            })
        })
    }
    executeFunction(query: string, params: any[]): Promise<any> {
        return new Promise((resolve, reject) => {
            this.connection.query(query, params, (error, results) => {
                if (error) {
                    reject(error)
                } else {
                    if (results.length > 1) {
                        reject(new Error('Too many rows, expected only zero or one row'))
                        return
                    }
                    const row = results[0]
                    if (row) {
                        const columns = Object.getOwnPropertyNames(row)
                        if (columns.length > 1) {
                            reject(Error('Too many columns, expected only one column'))
                            return
                        }
                        resolve(row[columns[0]])
                        return
                    }
                    resolve(undefined)
                }
            })
        })
    }
    executeBeginTransaction(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.connection.beginTransaction((error) => {
                if (error) {
                    reject(error)
                } else {
                    resolve()
                }
            })
        })
    }
    executeCommit(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.connection.commit((error) => {
                if (error) {
                    reject(error)
                } else {
                    resolve()
                }
            })
        })
    }
    executeRollback(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.connection.rollback((error) => {
                if (error) {
                    reject(error)
                } else {
                    resolve()
                }
            })
        })
    }
    addParam(params: any[], value: any): string {
        params.push(value)
        return '?'
    }
    addOutParam(_params: any[], _name: string): string {
        throw new Error('Unsupported output parameters')
    }
}