import type { DatabaseType } from "./QueryRunner"
import type { Connection, UpsertResult } from 'mariadb'
import { PromiseBasedQueryRunner } from "./PromiseBasedQueryRunner"

export class MariaDBQueryRunner extends PromiseBasedQueryRunner {
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
    executeBeginTransaction(): Promise<void> {
        return this.connection.beginTransaction()
    }
    executeCommit(): Promise<void> {
        return this.connection.commit()
    }
    executeRollback(): Promise<void> {
        return this.connection.rollback()
    }
    addParam(params: any[], value: any): string {
        params.push(value)
        return '?'
    }
}