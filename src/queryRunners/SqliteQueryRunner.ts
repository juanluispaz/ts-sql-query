import { QueryRunner, DatabaseType } from "./QueryRunner"
import { Database } from 'sqlite'

export class SqliteQueryRunner implements QueryRunner {
    readonly database: DatabaseType
    readonly connection: Database

    constructor(connection: Database) {
        this.connection = connection
        this.database = 'sqlite'
    }

    useDatabase(database: DatabaseType): void {
        if (database !== 'sqlite') {
            throw new Error('Unsupported database: ' + database + '. SqliteQueryRunner only supports sqlite databases')
        }
    }

    getNativeConnection(): Database {
        return this.connection
    }

    executeSelectOneRow(query: string, params: any[] = []): Promise<any> {
        return this.connection.all(query, params).then((rows) => {
            if (rows.length > 1) {
                throw new Error('Too many rows, expected only zero or one row')
            }
            return rows[0]
        })
    }
    executeSelectManyRows(query: string, params: any[] = []): Promise<any[]> {
        return this.connection.all(query, params)
    }
    executeSelectOneColumnOneRow(query: string, params: any[] = []): Promise<any> {
        return this.connection.all(query, params).then((rows) => {
            if (rows.length > 1) {
                throw new Error('Too many rows, expected only zero or one row')
            }
            const row = rows[0]
            if (row) {
                const columns = Object.getOwnPropertyNames(row)
                if (columns.length > 1) {
                    throw new Error('Too many columns, expected only one column')
                }
                return row[columns[0]]
            }
            return undefined
        })
    }
    executeSelectOneColumnManyRows(query: string, params: any[] = []): Promise<any[]> {
        return this.connection.all(query, params).then((rows) => {
            return rows.map((row: any) => {
                const columns = Object.getOwnPropertyNames(row)
                if (columns.length > 1) {
                    throw new Error('Too many columns, expected only one column')
                }
                return row[columns[0]]
            })
        })
    }
    executeInsert(query: string, params: any[] = []): Promise<number> {
        return this.connection.run(query, params).then((result) => result.changes)
    }
    executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
        return this.connection.run(query, params).then((result) => result.lastID)
    }
    executeInsertReturningMultipleLastInsertedId(_query: string, _params: any[] = []): Promise<any> {
        throw new Error('Unsupported executeInsertReturningLastInsertedId for this database')
    }
    executeUpdate(query: string, params: any[] = []): Promise<number> {
        return this.connection.run(query, params).then((result) => result.changes)
    }
    executeDelete(query: string, params: any[] = []): Promise<number> {
        return this.connection.run(query, params).then((result) => result.changes)
    }
    executeProcedure(query: string, params: any[] = []): Promise<void> {
        return this.connection.run(query, params).then(() => undefined)
    }
    executeFunction(query: string, params: any[] = []): Promise<any> {
        return this.connection.all(query, params).then((rows) => {
            if (rows.length > 1) {
                throw new Error('Too many rows, expected only zero or one row')
            }
            const row = rows[0]
            if (row) {
                const columns = Object.getOwnPropertyNames(row)
                if (columns.length > 1) {
                    throw new Error('Too many columns, expected only one column')
                }
                return row[columns[0]]
            }
            return undefined
        })
    }
    executeBeginTransaction(): Promise<void> {
        return this.connection.run('begin').then(() => undefined)
    }
    executeCommit(): Promise<void> {
        return this.connection.run('commit').then(() => undefined)
    }
    executeRollback(): Promise<void> {
        return this.connection.run('rollback').then(() => undefined)
    }
    executeDatabaseSchemaModification(query: string, params: any[] = []): Promise<void> {
        return this.connection.run(query, params).then(() => undefined)
    }
    addParam(params: any[], value: any): string {
        params.push(value)
        return '?'
    }
    addOutParam(_params: any[], _name: string): string {
        throw new Error('Unsupported output parameters')
    }
}