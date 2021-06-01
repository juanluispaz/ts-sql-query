import type { DatabaseType } from "./QueryRunner"
import type { Connection, UpsertResult } from 'mariadb'
import { PromiseBasedQueryRunner } from "./PromiseBasedQueryRunner"
import { UnwrapPromiseTuple } from "../utils/PromiseProvider"

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

    executeSelectOneRow(query: string, params: any[] = []): Promise<any> {
        return this.connection.query({ sql: query, bigNumberStrings: true }, params).then((result: any[]) => {
            if (result.length > 1) {
                throw new Error('Too many rows, expected only zero or one row')
            }
            return result[0]
        })
    }
    executeSelectManyRows(query: string, params: any[] = []): Promise<any[]> {
        return this.connection.query({ sql: query, bigNumberStrings: true }, params)
    }
    executeSelectOneColumnOneRow(query: string, params: any[] = []): Promise<any> {
        return this.connection.query({ sql: query, rowsAsArray: true, bigNumberStrings: true }, params).then((result: any[][]) => {
            if (result.length > 1) {
                throw new Error('Too many rows, expected only zero or one row')
            }
            const row = result[0]
            if (row) {
                if (row.length > 1) {
                    throw new Error('Too many columns, expected only one column')
                }
                return row[0]
            } else {
                return undefined
            }
        })
    }
    executeSelectOneColumnManyRows(query: string, params: any[] = []): Promise<any[]> {
        return this.connection.query({ sql: query, rowsAsArray: true, bigNumberStrings: true }, params).then((result: any[][]) => result.map((row) => {
            if (row.length > 1) {
                throw new Error('Too many columns, expected only one column')
            }
            return row[0]
        }))
    }
    executeInsert(query: string, params: any[] = []): Promise<number> {
        return this.connection.query({ sql: query, bigNumberStrings: true }, params).then((result: UpsertResult) => result.affectedRows)
    }
    executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
        return this.connection.query({ sql: query, bigNumberStrings: true }, params).then((result: UpsertResult) => result.insertId)
    }
    executeInsertReturningMultipleLastInsertedId(_query: string, _params: any[] = []): Promise<any> {
        throw new Error('Unsupported executeInsertReturningMultipleLastInsertedId for this database')
    }
    executeUpdate(query: string, params: any[] = []): Promise<number> {
        return this.connection.query({ sql: query, bigNumberStrings: true }, params).then((result: UpsertResult) => result.affectedRows)
    }
    executeDelete(query: string, params: any[] = []): Promise<number> {
        return this.connection.query({ sql: query, bigNumberStrings: true }, params).then((result: UpsertResult) => result.affectedRows)
    }
    executeProcedure(query: string, params: any[] = []): Promise<void> {
        return this.connection.query({ sql: query, bigNumberStrings: true }, params).then(() => undefined)
    }
    executeFunction(query: string, params: any[] = []): Promise<any> {
        return this.connection.query({ sql: query, rowsAsArray: true, bigNumberStrings: true }, params).then((result: any[][]) => {
            if (result.length > 1) {
                throw new Error('Too many rows, expected only zero or one row')
            }
            const row = result[0]
            if (row) {
                if (row.length > 1) {
                    throw new Error('Too many columns, expected only one column')
                }
                return row[0]
            } else {
                return undefined
            }
        })
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
    executeDatabaseSchemaModification(query: string, params: any[] = []): Promise<void> {
        return this.connection.query({ sql: query, bigNumberStrings: true }, params).then(() => undefined)
    }
    addParam(params: any[], value: any): string {
        params.push(value)
        return '?'
    }
    createResolvedPromise<RESULT>(result: RESULT): Promise<RESULT> {
        return Promise.resolve(result) 
    }
    createAllPromise<P extends Promise<any>[]>(promises: [...P]): Promise<UnwrapPromiseTuple<P>> {
        return Promise.all(promises) as any
    }
}