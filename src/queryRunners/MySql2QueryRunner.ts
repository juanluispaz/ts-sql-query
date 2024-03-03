import type { DatabaseType } from "./QueryRunner"
import type { Connection, QueryError, ResultSetHeader, RowDataPacket } from "mysql2"
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
    executeBeginTransaction(): Promise<void> {
        if (this.transactionLevel >= 1) {
            throw new Error("MySql doesn't support nested transactions. This error is thrown to avoid MariaDB silently finishing the previous transaction")
        }
        return new Promise((resolve, reject) => {
            this.connection.beginTransaction((error: QueryError | null) => {
                if (error) {
                    reject(error)
                } else {
                    this.transactionLevel++
                    if (this.transactionLevel >= 2) {
                        reject(new Error("MySql doesn't support nested transactions. The previous transaction was silently finished"))
                    } else {
                        resolve()
                    }
                }
            })
        })
    }
    executeCommit(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.connection.commit((error: QueryError | null) => {
                if (error) {
                    // Transaction count only modified when commit successful, in case of error there is still an open transaction 
                    reject(error)
                } else {
                    this.transactionLevel--
                    if (this.transactionLevel < 0) {
                        this.transactionLevel = 0
                    }
                    resolve()
                }
            })
        })
    }
    executeRollback(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.connection.rollback((error?: QueryError | null) => {
                this.transactionLevel--
                if (this.transactionLevel < 0) {
                    this.transactionLevel = 0
                }
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