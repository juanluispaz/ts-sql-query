import type { DatabaseType } from "./QueryRunner"
import type { Database } from 'sqlite3'
import { PromiseBasedWithSqlTransactionQueryRunner } from "./PromiseBasedWithSqlTransactionQueryRunner"

export class Sqlite3QueryRunner extends PromiseBasedWithSqlTransactionQueryRunner {
    readonly database: DatabaseType
    readonly connection: Database

    constructor(connection: Database) {
        super()
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

    getCurrentNativeTransaction(): undefined {
        return undefined
    }

    execute<RESULT>(fn: (connection: unknown, transaction?: unknown) => Promise<RESULT>): Promise<RESULT> {
        return fn(this.connection)
    }

    protected executeQueryReturning(query: string, params: any[]): Promise<any[]> {
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
    protected executeMutation(query: string, params: any[]): Promise<number> {
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
        if (this.containsInsertReturningClause(query, params)) {
            return super.executeInsertReturningLastInsertedId(query, params)
        }

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
    executeInsertReturningMultipleLastInsertedId(query: string, params: any[] = []): Promise<any> {
        if (this.containsInsertReturningClause(query, params)) {
            return super.executeInsertReturningMultipleLastInsertedId(query, params)
        }
        throw new Error("Unsupported executeInsertReturningMultipleLastInsertedId on queries thar doesn't include the returning clause")
    }
    addParam(params: any[], value: any): string {
        params.push(value)
        return '?'
    }
}