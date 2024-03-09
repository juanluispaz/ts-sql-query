import type { BeginTransactionOpts, CommitOpts, DatabaseType, RollbackOpts } from "./QueryRunner"
import type { Connection, UpsertResult } from 'mariadb'
import { PromiseBasedWithDelegatedSetTransactionQueryRunner } from "./PromiseBasedWithDelegatedSetTransactionQueryRunner"

export class MariaDBQueryRunner extends PromiseBasedWithDelegatedSetTransactionQueryRunner {
    readonly database: DatabaseType
    readonly connection: Connection

    constructor(connection: Connection, database: 'mariaDB' | 'mySql' = 'mariaDB') {
        super()
        this.connection = connection
        this.database = database
    }

    useDatabase(database: DatabaseType): void {
        if (database !== 'mariaDB' && database !== 'mySql') {
            throw new Error('Unsupported database: ' + database + '. MariaDBQueryRunner only supports mariaDB or mySql databases')
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
        return this.connection.query({ sql: query, bigNumberStrings: true }, params)
    }
    protected executeMutation(query: string, params: any[]): Promise<number> {
        return this.connection.query({ sql: query, bigNumberStrings: true }, params).then((result: UpsertResult) => result.affectedRows)
    }
    executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
        if (this.containsInsertReturningClause(query, params)) {
            return super.executeInsertReturningLastInsertedId(query, params)
        }
        
        return this.connection.query({ sql: query, bigNumberStrings: true }, params).then((result: UpsertResult) => result.insertId)
    }
    doBeginTransaction(_opts: BeginTransactionOpts): Promise<void> {
        return this.connection.beginTransaction()
    }
    doCommit(_opts: CommitOpts): Promise<void> {
        return this.connection.commit()
    }
    doRollback(_opts: RollbackOpts): Promise<void> {
        return this.connection.rollback()
    }
    addParam(params: any[], value: any): string {
        params.push(value)
        return '?'
    }
}