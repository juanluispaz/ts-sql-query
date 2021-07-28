import type { DatabaseType } from "./QueryRunner"
import type { Connection, QueryError, OkPacket, RowDataPacket } from "mysql2"
import { PromiseBasedQueryRunner } from "./PromiseBasedQueryRunner"

export class MySql2QueryRunner extends PromiseBasedQueryRunner {
    readonly database: DatabaseType
    readonly connection: Connection
    private transactionLevel = 0

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
            this.connection.query(query, params, (error: QueryError | null, results: OkPacket) => {
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
            this.connection.query(query, params, (error: QueryError | null, results: OkPacket) => {
                if (error) {
                    reject(error)
                } else {
                    resolve(results.insertId)
                }
            })
        })
    }
    executeInsertReturningMultipleLastInsertedId(_query: string, _params: any[] = []): Promise<any> {
        throw new Error('Unsupported executeInsertReturningMultipleLastInsertedId for this database')
    }
    executeBeginTransaction(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.connection.beginTransaction((error: QueryError | null) => {
                if (error) {
                    reject(error)
                } else {
                    this.transactionLevel++
                    resolve()
                }
            })
        })
    }
    executeCommit(): Promise<void> {
        this.transactionLevel--
        return new Promise((resolve, reject) => {
            this.connection.commit((error: QueryError | null) => {
                if (error) {
                    reject(error)
                } else {
                    resolve()
                }
            })
        })
    }
    executeRollback(): Promise<void> {
        this.transactionLevel--
        return new Promise((resolve, reject) => {
            this.connection.rollback((error?: QueryError | null) => {
                if (error) {
                    reject(error)
                } else {
                    resolve()
                }
            })
        })
    }
    isTransactionActive(): boolean {
        return this.transactionLevel > 0
    }
    addParam(params: any[], value: any): string {
        params.push(value)
        return '?'
    }
}