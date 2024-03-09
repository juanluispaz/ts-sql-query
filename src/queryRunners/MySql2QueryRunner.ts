import type { BeginTransactionOpts, CommitOpts, DatabaseType, RollbackOpts } from "./QueryRunner"
import type { Connection, QueryError, ResultSetHeader, RowDataPacket } from "mysql2"
import { PromiseBasedWithDelegatedSetTransactionQueryRunner } from "./PromiseBasedWithDelegatedSetTransactionQueryRunner"

export class MySql2QueryRunner extends PromiseBasedWithDelegatedSetTransactionQueryRunner {
    readonly database: DatabaseType
    readonly connection: Connection

    constructor(connection: Connection, database: 'mariaDB' | 'mySql' = 'mySql') {
        super()
        this.connection = connection
        this.database = database
    }

    useDatabase(database: DatabaseType): void {
        if (database !== 'mariaDB' && database !== 'mySql') {
            throw new Error('Unsupported database: ' + database + '. MySql2QueryRunner only supports mySql or mariaDB databases')
        } else {
            // @ts-ignore
            this.database = database
        }
    }

    getNativeRunner(): Connection {
        return this.connection
    }
    
    getCurrentNativeTransaction(): undefined {
        return undefined
    }

    execute<RESULT>(fn: (connection: unknown, transaction?: unknown) => Promise<RESULT>): Promise<RESULT> {
        return fn(this.connection)
    }

    protected executeQueryReturning(query: string, params: any[]): Promise<any[]> {
        return new Promise((resolve, reject) => {
            this.connection.query(query, params, (error: QueryError | null, results: RowDataPacket[]) => {
                if (error) {
                    reject(error)
                } else {
                    resolve(results)
                }
            })
        })
    }
    protected executeMutation(query: string, params: any[]): Promise<number> {
        return new Promise((resolve, reject) => {
            this.connection.query(query, params, (error: QueryError | null, results: ResultSetHeader) => {
                if (error) {
                    reject(error)
                } else {
                    resolve(results.affectedRows)
                }
            })
        })
    }
    executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
        if (this.containsInsertReturningClause(query, params)) {
            return super.executeInsertReturningLastInsertedId(query, params)
        }
        
        return new Promise((resolve, reject) => {
            this.connection.query(query, params, (error: QueryError | null, results: ResultSetHeader) => {
                if (error) {
                    reject(error)
                } else {
                    resolve(results.insertId)
                }
            })
        })
    }
    doBeginTransaction(_opts: BeginTransactionOpts): Promise<void> {
        return new Promise((resolve, reject) => {
            this.connection.beginTransaction((error: QueryError | null) => {
                if (error) {
                    reject(error)
                } else {
                    resolve(undefined)
                }
            })
        })
    }
    doCommit(_opts: CommitOpts): Promise<void> {
        return new Promise((resolve, reject) => {
            this.connection.commit((error: QueryError | null) => {
                if (error) {
                    reject(error)
                } else {
                    resolve(undefined)
                }
            })
        })
    }
    doRollback(_opts: RollbackOpts): Promise<void> {
        return new Promise((resolve, reject) => {
            this.connection.beginTransaction((error: QueryError | null) => {
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
}