import { QueryRunner, DatabaseType } from "./QueryRunner"

// Depends of msnodesqlv8
// Redefine type definitios to avoid depenedency problems in linux where this package is not available

export interface Connection {
    query(sql: string, params?: any[], cb?: QueryCb): Query
    beginTransaction(cb?: StatusCb): void
    commit(cb?: StatusCb): void
    rollback(cb?: StatusCb): void
}

export interface Query {
    on(name: string, cb: SubmittedEventCb): void
    on(name: string, cb: EventCb): void
    on(name: string, cb: EventColumnCb): void
}

export interface QueryCb { (err?: Error, rows?: any[], more?: boolean): void
}
export interface StatusCb { (err?: Error): void
}
export interface EventCb { (data: any): void
}
export interface SubmittedEventCb { (sql: string, params:any[]): void
}
export interface EventColumnCb { (colIndex: number, data:any, more:boolean): void
}

export class MsNodeSqlV8QueryRunner<CONNECTION extends Connection> implements QueryRunner {
    readonly database: DatabaseType
    readonly connection: CONNECTION

    constructor(connection: CONNECTION) {
        this.connection = connection
        this.database = 'sqlServer'
    }

    useDatabase(database: DatabaseType): void {
        if (database !== 'sqlServer') {
            throw new Error('Unsupported database: ' + database + '. MsNodeSqlV8QueryRunner only supports sqlServer databases')
        }
    }

    getNativeRunner(): CONNECTION {
        return this.connection
    }

    executeSelectOneRow(query: string, params: any[] = []): Promise<any> {
        return new Promise((resolve, reject) => {
            this.connection.query(query, params, function (error, rows) {
                if (error) {
                    reject(error)
                } else if (!rows) {
                    resolve(undefined)
                } else if (rows.length > 1) {
                    reject(new Error('Too many rows, expected only zero or one row'))
                } else {
                    resolve(rows[0])
                }
            })
        })
    }
    executeSelectManyRows(query: string, params: any[] = []): Promise<any[]> {
        return new Promise((resolve, reject) => {
            this.connection.query(query, params, function (error, rows) {
                if (error) {
                    reject(error)
                } else if (!rows) {
                    resolve([])
                } else {
                    resolve(rows)
                }
            })
        })
    }
    executeSelectOneColumnOneRow(query: string, params: any[] = []): Promise<any> {
        return new Promise((resolve, reject) => {
            this.connection.query(query, params, function (error, rows) {
                if (error) {
                    reject(error)
                } else if (!rows) {
                    resolve(undefined)
                } else if (rows.length > 1) {
                    reject(new Error('Too many rows, expected only zero or one row'))
                } else {
                    const row = rows[0]
                    if (row) {
                        const columns = Object.getOwnPropertyNames(row)
                        if (columns.length > 1) {
                            throw new Error('Too many columns, expected only one column')
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
            this.connection.query(query, params, function (error, rows) {
                if (error) {
                    reject(error)
                } else if (!rows) {
                    resolve([])
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
            let rowCount = 0
            this.connection.query(query, params, function (error) {
                if (error) {
                    reject(error)
                } else {
                    resolve(rowCount)
                }
            }).on('rowcount', function (count: number) {
                rowCount = count
             })
        })
    }
    executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
        return new Promise((resolve, reject) => {
            this.connection.query(query, params, function (error, rows) {
                if (error) {
                    reject(error)
                } else if (!rows) {
                    resolve(new Error('Unable to find the last inserted id'))
                } else if (rows.length > 1) {
                    reject(new Error('Too many rows, expected only zero or one row'))
                } else {
                    const row = rows[0]
                    if (row) {
                        const columns = Object.getOwnPropertyNames(row)
                        if (columns.length > 1) {
                            throw new Error('Too many columns, expected only one column')
                        }
                        resolve(row[columns[0]])
                        return
                    }
                    resolve(new Error('Unable to find the last inserted id'))
                }
            })
        })
    }
    executeInsertReturningMultipleLastInsertedId(query: string, params: any[] = []): Promise<any> {
        return new Promise((resolve, reject) => {
            this.connection.query(query, params, function (error, rows) {
                if (error) {
                    reject(error)
                } else if (!rows) {
                    resolve(new Error('Unable to find the last inserted id'))
                } else {
                    const result = rows.map((row) => {
                        const columns = Object.getOwnPropertyNames(row)
                        if (columns.length > 1) {
                            throw new Error('Too many columns, expected only one column')
                        }
                        return row[columns[0]]
                    })
                    resolve(result)
                }
            })
        })
    }
    executeUpdate(query: string, params: any[] = []): Promise<number> {
        return new Promise((resolve, reject) => {
            let rowCount = 0
            this.connection.query(query, params, function (error) {
                if (error) {
                    reject(error)
                } else {
                    resolve(rowCount)
                }
            }).on('rowcount', function (count: number) {
                rowCount = count
             })
        })
    }
    executeDelete(query: string, params: any[] = []): Promise<number> {
        return new Promise((resolve, reject) => {
            let rowCount = 0
            this.connection.query(query, params, function (error) {
                if (error) {
                    reject(error)
                } else {
                    resolve(rowCount)
                }
            }).on('rowcount', function (count: number) {
                rowCount = count
             })
        })
    }
    executeProcedure(query: string, params: any[] = []): Promise<void> {
        return new Promise((resolve, reject) => {
            this.connection.query(query, params, function (error) {
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
            this.connection.query(query, params, function (error, rows) {
                if (error) {
                    reject(error)
                } else if (!rows) {
                    resolve(undefined)
                } else if (rows.length > 1) {
                    reject(new Error('Too many rows, expected only zero or one row'))
                } else {
                    const row = rows[0]
                    if (row) {
                        const columns = Object.getOwnPropertyNames(row)
                        if (columns.length > 1) {
                            throw new Error('Too many columns, expected only one column')
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
            this.connection.beginTransaction(function (error) {
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
            this.connection.commit(function (error) {
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
            this.connection.rollback(function (error) {
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
            this.connection.query(query, params, function (error) {
                if (error) {
                    reject(error)
                } else {
                    resolve(undefined)
                }
            })
        })
    }
    addParam(params: any[], value: any): string {
        const index = params.length
        params.push(value)
        return '@' + index
    }
    addOutParam(_params: any[], _name: string): string {
        throw new Error('Unsupported output parameters')
    }
}