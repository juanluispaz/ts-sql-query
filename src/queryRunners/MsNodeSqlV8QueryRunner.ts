import { PromiseBasedQueryRunner } from "./PromiseBasedQueryRunner"
import type { DatabaseType } from "./QueryRunner"

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

export class MsNodeSqlV8QueryRunner<CONNECTION extends Connection> extends PromiseBasedQueryRunner {
    readonly database: DatabaseType
    readonly connection: CONNECTION

    constructor(connection: CONNECTION) {
        super()
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

    execute<RESULT>(fn: (connection: unknown, transaction?: unknown) => Promise<RESULT>): Promise<RESULT> {
        return fn(this.connection)
    }

    protected executeQueryReturning(query: string, params: any[]): Promise<any[]> {
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
    protected executeMutation(query: string, params: any[]): Promise<number> {
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
    addParam(params: any[], value: any): string {
        const index = params.length
        params.push(value)
        return '@' + index
    }
}