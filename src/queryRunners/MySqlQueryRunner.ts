import type { BeginTransactionOpts, DatabaseType } from "./QueryRunner"
import type { Connection } from "mysql"
import { PromiseBasedWithSqlTransactionQueryRunner } from "./PromiseBasedWithSqlTransactionQueryRunner"

export class MySqlQueryRunner extends PromiseBasedWithSqlTransactionQueryRunner {
    readonly database: DatabaseType
    readonly connection: Connection

    constructor(connection: Connection, database: 'mariaDB' | 'mySql' = 'mySql') {
        super()
        this.connection = connection
        this.database = database
    }

    useDatabase(database: DatabaseType): void {
        if (database !== 'mariaDB' && database !== 'mySql') {
            throw new Error('Unsupported database: ' + database + '. MySqlQueryRunner only supports mySql or mariaDB databases')
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
            this.connection.query(query, params, (error, results) => {
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
            this.connection.query(query, params, (error, results) => {
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
            this.connection.query(query, params, (error, results) => {
                if (error) {
                    reject(error)
                } else {
                    resolve(results.insertId)
                }
            })
        })
    }
    executeBeginTransaction(opts: BeginTransactionOpts): Promise<void> {
        return super.executeBeginTransaction(opts).then(() => {
            const setTransactionSql = this.createSetTransactionQuery(opts)
            if (setTransactionSql) {
                return this.executeMutation(setTransactionSql, []).then(() => {
                    return undefined
                })
            }
            return undefined
        })
    }
    createBeginTransactionQuery(opts: BeginTransactionOpts): string {
        let sql = 'start transaction'
        // validate transaction level
        this.getTransactionLevel(opts)
        const accessMode = this.getTransactionAccessMode(opts)
        if (accessMode) {
            sql += ' ' + accessMode
        }
        return sql
    }
    createSetTransactionQuery(opts: BeginTransactionOpts): string | undefined {
        let level = this.getTransactionLevel(opts)
        if (!level) {
            return undefined
        }
        let sql = 'set transaction isolation level ' + level
        const accessMode = this.getTransactionAccessMode(opts)
        if (accessMode) {
            if (sql) {
                sql += ', '
            }
            sql += accessMode
        }
        return sql
    }
    addParam(params: any[], value: any): string {
        params.push(value)
        return '?'
    }
}