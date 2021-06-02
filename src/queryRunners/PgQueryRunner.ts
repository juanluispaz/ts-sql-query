import type { DatabaseType } from "./QueryRunner"
import type { ClientBase } from 'pg'
import { PromiseBasedWithSqlTransactionQueryRunner } from "./PromiseBasedWithSqlTransactionQueryRunner"

export class PgQueryRunner extends PromiseBasedWithSqlTransactionQueryRunner {
    readonly database: DatabaseType
    readonly connection: ClientBase

    constructor(connection: ClientBase) {
        super()
        this.connection = connection
        this.database = 'postgreSql'
    }

    useDatabase(database: DatabaseType): void {
        if (database !== 'postgreSql') {
            throw new Error('Unsupported database: ' + database + '. PgQueryRunner only supports postgreSql databases')
        }
    }

    getNativeRunner(): ClientBase {
        return this.connection
    }

    execute<RESULT>(fn: (connection: unknown, transaction?: unknown) => Promise<RESULT>): Promise<RESULT> {
        return fn(this.connection)
    }

    protected executeQueryReturning(query: string, params: any[]): Promise<any[]> {
        return this.connection.query(query, params).then((result) => result.rows)
    }
    protected executeMutation(query: string, params: any[]): Promise<number> {
        return this.connection.query(query, params).then((result) => result.rowCount)
    }
    addParam(params: any[], value: any): string {
        params.push(value)
        return '$' + params.length
    }
}