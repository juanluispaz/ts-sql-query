import type { DatabaseType } from "./QueryRunner"
import type { Database } from 'sqlite'
import { PromiseBasedWithSqlTransactionQueryRunner } from "./PromiseBasedWithSqlTransactionQueryRunner"

export class SqliteQueryRunner extends PromiseBasedWithSqlTransactionQueryRunner {
    readonly database: DatabaseType
    readonly connection: Database

    constructor(connection: Database) {
        super()
        this.connection = connection
        this.database = 'sqlite'
    }

    useDatabase(database: DatabaseType): void {
        if (database !== 'sqlite') {
            throw new Error('Unsupported database: ' + database + '. SqliteQueryRunner only supports sqlite databases')
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
        return this.connection.all(query, params)
    }
    protected executeMutation(query: string, params: any[]): Promise<number> {
        return this.connection.run(query, params).then(result => result.changes!)
    }
    executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
        if (this.containsInsertReturningClause(query, params)) {
            return super.executeInsertReturningLastInsertedId(query, params)
        }
        
        return this.connection.run(query, params).then(result => result.lastID)
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