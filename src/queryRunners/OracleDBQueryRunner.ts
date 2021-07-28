import type { DatabaseType } from "./QueryRunner"
import type { Connection } from 'oracledb'
import { OUT_FORMAT_OBJECT, BIND_OUT } from 'oracledb'
import { PromiseBasedQueryRunner } from "./PromiseBasedQueryRunner"
import { processOutBinds } from "./OracleUtils"

export class OracleDBQueryRunner extends PromiseBasedQueryRunner {
    readonly database: DatabaseType
    readonly connection: Connection
    private transactionLevel = 0

    constructor(connection: Connection) {
        super()
        this.connection = connection
        this.database = 'oracle'
    }

    useDatabase(database: DatabaseType): void {
        if (database !== 'oracle') {
            throw new Error('Unsupported database: ' + database + '. OracleDBQueryRunner only supports oracle databases')
        }
    }

    getNativeRunner(): Connection {
        return this.connection
    }

    execute<RESULT>(fn: (connection: unknown, transaction?: unknown) => Promise<RESULT>): Promise<RESULT> {
        return fn(this.connection)
    }

    protected executeQueryReturning(query: string, params: any[]): Promise<any[]> {
        return this.connection.execute(query, params, {outFormat: OUT_FORMAT_OBJECT}).then((result) => result.rows || [])
    }
    protected executeMutation(query: string, params: any[]): Promise<number> {
        return this.connection.execute(query, params).then((result) => result.rowsAffected || 0)
    }
    protected executeMutationReturning(query: string, params: any[] = []): Promise<any[]> {
        return this.connection.execute(query, params).then((result) => {
            return processOutBinds(params, result.outBinds)
        })
    }
    executeBeginTransaction(): Promise<void> {
        this.transactionLevel++
        // Oracle automatically begins the transaction
        return Promise.resolve()
    }
    executeCommit(): Promise<void> {
        this.transactionLevel--
        return this.connection.commit()
    }
    executeRollback(): Promise<void> {
        this.transactionLevel--
        return this.connection.rollback()
    }
    isTransactionActive(): boolean {
        return this.transactionLevel > 0
    }
    addParam(params: any[], value: any): string {
        const index = params.length
        params.push(value)
        return ':' + index
    }
    addOutParam(params: any[], name: string): string {
        const index = params.length
        if (name) {
            params.push({dir: BIND_OUT, as: name})
        } else {
            params.push({dir: BIND_OUT})
        }
        return ':' + index
    }
}
