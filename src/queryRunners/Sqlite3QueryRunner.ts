import { QueryRunner, DatabaseType } from "./QueryRunner"
import { Database } from 'sqlite3'

export class Sqlite3QueryRunner implements QueryRunner {
    readonly database: DatabaseType
    readonly connection: Database

    constructor(connection: Database) {
        this.connection = connection
        this.database = 'sqlite'
    }

    useDatabase(database: DatabaseType): void {
        if (database !== 'sqlite') {
            throw new Error('Unsupported database: ' + database + '. Sqlite3QueryRunner only supports sqlite databases')
        }
    }

    getNativeRunner(): Database {
        return this.connection
    }

    execute<RESULT>(fn: (connection: unknown, transaction?: unknown) => Promise<RESULT>): Promise<RESULT> {
        return fn(this.connection)
    }

    executeSelectOneRow(query: string, params: any[] = []): Promise<any> {
        return new Promise((resolve, reject) => {
            this.connection.all(query, params, function (error, rows) {
                if (error) {
                    reject(error)
                } else {
                    if (rows.length > 1) {
                        reject(new Error('Too many rows, expected only zero or one row'))
                        return
                    }
                    resolve(rows[0])
                }
            })
        })
    }
    executeSelectManyRows(query: string, params: any[] = []): Promise<any[]> {
        return new Promise((resolve, reject) => {
            this.connection.all(query, params, function (error, rows) {
                if (error) {
                    reject(error)
                } else {
                    resolve(rows)
                }
            })
        })
    }
    executeSelectOneColumnOneRow(query: string, params: any[] = []): Promise<any> {
        return new Promise((resolve, reject) => {
            this.connection.all(query, params, function (error, rows) {
                if (error) {
                    reject(error)
                } else {
                    if (rows.length > 1) {
                        reject(new Error('Too many rows, expected only zero or one row'))
                        return
                    }
                    const row = rows[0]
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
    executeSelectOneColumnManyRows(query: string, params: any[] = []): Promise<any[]> {
        return new Promise((resolve, reject) => {
            this.connection.all(query, params, function (error, rows) {
                if (error) {
                    reject(error)
                } else {
                    const result = []
                    for (let i = 0, length = rows.length; i < length; i++) {
                        const row = rows[i]
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
    executeInsert(query: string, params: any[] = []): Promise<number> {
        return new Promise((resolve, reject) => {
            this.connection.run(query, params, function (error) {
                if (error) {
                    reject(error)
                } else {
                    resolve(this.changes)
                }
            })
        })
    }
    executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
        return new Promise((resolve, reject) => {
            this.connection.run(query, params, function (error) {
                if (error) {
                    reject(error)
                } else {
                    resolve(this.lastID)
                }
            })
        })
    }
    executeInsertReturningMultipleLastInsertedId(_query: string, _params: any[] = []): Promise<any> {
        throw new Error('Unsupported executeInsertReturningLastInsertedId for this database')
    }
    executeUpdate(query: string, params: any[] = []): Promise<number> {
        return new Promise((resolve, reject) => {
            this.connection.run(query, params, function (error) {
                if (error) {
                    reject(error)
                } else {
                    resolve(this.changes)
                }
            })
        })
    }
    executeDelete(query: string, params: any[] = []): Promise<number> {
        return new Promise((resolve, reject) => {
            this.connection.run(query, params, function (error) {
                if (error) {
                    reject(error)
                } else {
                    resolve(this.changes)
                }
            })
        })
    }
    executeProcedure(query: string, params: any[] = []): Promise<void> {
        return new Promise((resolve, reject) => {
            this.connection.run(query, params, function (error) {
                if (error) {
                    reject(error)
                } else {
                    resolve(undefined)
                }
            })
        })
    }
    executeFunction(query: string, params: any[] = []): Promise<any> {
        return new Promise((resolve, reject) => {
            this.connection.all(query, params, function (error, rows) {
                if (error) {
                    reject(error)
                } else {
                    if (rows.length > 1) {
                        reject(new Error('Too many rows, expected only zero or one row'))
                        return
                    }
                    const row = rows[0]
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
            this.connection.run('begin', function (error) {
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
            this.connection.run('commit', function (error) {
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
            this.connection.run('rollback', function (error) {
                if (error) {
                    reject(error)
                } else {
                    resolve()
                }
            })
        })
    }
    executeDatabaseSchemaModification(query: string, params: any[] = []): Promise<void> {
        return new Promise((resolve, reject) => {
            this.connection.run(query, params, function (error) {
                if (error) {
                    reject(error)
                } else {
                    resolve(undefined)
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