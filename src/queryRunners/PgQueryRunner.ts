import type { DatabaseType } from "./QueryRunner"
import type { ClientBase } from 'pg'
import { PromiseBasedQueryRunner } from "./PromiseBasedQueryRunner"

export class PgQueryRunner extends PromiseBasedQueryRunner {
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

    executeSelectOneRow(query: string, params: any[] = []): Promise<any> {
        return this.connection.query(query, params).then((result) => {
            if (result.rows.length > 1) {
                throw new Error('Too many rows, expected only zero or one row')
            }
            return result.rows[0]
        })
    }
    executeSelectManyRows(query: string, params: any[] = []): Promise<any[]> {
        return this.connection.query(query, params).then((result) => result.rows)
    }
    executeSelectOneColumnOneRow(query: string, params: any[] = []): Promise<any> {
        return this.connection.query({ text: query, values: params, rowMode: 'array' }).then((result) => {
            if (result.rows.length > 1) {
                throw new Error('Too many rows, expected only zero or one row')
            }
            const row = result.rows[0]
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
        return this.connection.query({ text: query, values: params, rowMode: 'array' }).then((result) => result.rows.map((row) => {
            if (row.length > 1) {
                throw new Error('Too many columns, expected only one column')
            }
            return row[0]
        }))
    }
    executeInsert(query: string, params: any[] = []): Promise<number> {
        return this.connection.query(query, params).then((result) => result.rowCount)
    }
    executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
        return this.connection.query({ text: query, values: params, rowMode: 'array' }).then((result) => {
            if (result.rows.length > 1) {
                throw new Error('Too many rows, expected only zero or one row')
            }
            const row = result.rows[0]
            if (row) {
                if (row.length > 1) {
                    throw new Error('Too many columns, expected only one column')
                }
                return row[0]
            } else {
                throw new Error('Unable to find the last inserted id')
            }
        })
    }
    executeInsertReturningMultipleLastInsertedId(query: string, params: any[] = []): Promise<any> {
        return this.connection.query({ text: query, values: params, rowMode: 'array' }).then((result) => {
            return result.rows.map((row) => {
                if (row.length > 1) {
                    throw new Error('Too many columns, expected only one column')
                }
                return row[0]
            })
        })
    }
    executeUpdate(query: string, params: any[] = []): Promise<number> {
        return this.connection.query(query, params).then((result) => result.rowCount)
    }
    executeDelete(query: string, params: any[] = []): Promise<number> {
        return this.connection.query(query, params).then((result) => result.rowCount)
    }
    executeProcedure(query: string, params: any[] = []): Promise<void> {
        return this.connection.query(query, params).then(() => undefined)
    }
    executeFunction(query: string, params: any[] = []): Promise<any> {
        return this.connection.query({ text: query, values: params, rowMode: 'array' }).then((result) => {
            if (result.rows.length > 1) {
                throw new Error('Too many rows, expected only zero or one row')
            }
            const row = result.rows[0]
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
        return this.connection.query('begin transaction').then(() => undefined)
    }
    executeCommit(): Promise<void> {
        return this.connection.query('commit').then(() => undefined)
    }
    executeRollback(): Promise<void> {
        return this.connection.query('rollback').then(() => undefined)
    }
    executeDatabaseSchemaModification(query: string, params: any[] = []): Promise<void> {
        return this.connection.query(query, params).then(() => undefined)
    }
    addParam(params: any[], value: any): string {
        params.push(value)
        return '$' + params.length
    }
}