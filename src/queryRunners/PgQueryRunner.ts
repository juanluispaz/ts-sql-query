import type { DatabaseType } from "./QueryRunner"
import type { ClientBase } from 'pg'
import { SqlTransactionQueryRunner } from "./SqlTransactionQueryRunner"

export interface PgQueryRunnerConfig {
    allowNestedTransactions?: boolean
}

export class PgQueryRunner extends SqlTransactionQueryRunner {
    readonly database: DatabaseType
    readonly connection: ClientBase
    private config?: PgQueryRunnerConfig

    constructor(connection: ClientBase, config?: PgQueryRunnerConfig) {
        super()
        this.connection = connection
        this.database = 'postgreSql'
        this.config = config
    }

    useDatabase(database: DatabaseType): void {
        if (database !== 'postgreSql') {
            throw new Error('Unsupported database: ' + database + '. PgQueryRunner only supports postgreSql databases')
        }
    }

    getNativeRunner(): ClientBase {
        return this.connection
    }

    getCurrentNativeTransaction(): undefined {
        return undefined
    }

    execute<RESULT>(fn: (connection: unknown, transaction?: unknown) => Promise<RESULT>): Promise<RESULT> {
        return fn(this.connection)
    }

    protected executeQueryReturning(query: string, params: any[]): Promise<any[]> {
        return this.connection.query(query, params).then((result) => result.rows)
    }
    protected executeMutation(query: string, params: any[]): Promise<number> {
        return this.connection.query(query, params).then((result) => result.rowCount || 0)
    }
    addParam(params: any[], value: any): string {
        params.push(value)
        return '$' + params.length
    }
    nestedTransactionsSupported(): boolean {
        return !!this.config?.allowNestedTransactions
    }
}