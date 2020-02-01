import { QueryRunner, DatabaseType } from "./QueryRunner"
import { Database, Integer } from 'better-sqlite3'

export class BetterSqlite3QueryRunner implements QueryRunner {
    readonly sqlite: true = true
    readonly database: DatabaseType
    readonly connection: Database

    constructor(connection: Database) {
        this.connection = connection
        this.database = 'sqlite'
    }

    getNativeConnection(): Database {
        return this.connection
    }

    executeSelectOneRow(query: string, params: any[] = []): Promise<any> {
        try {
            const rows = this.connection.prepare(query).safeIntegers(true).all(params)
            if (rows.length > 1) {
                Promise.reject(new Error('Too many rows, expected only zero or one row'))
            }
            const row = rows[0]
            for (var prop in row) {
                row[prop] = toStringInt(row[prop])
            }
            return Promise.resolve(row)
        } catch (e) {
            return Promise.reject(e)
        }
    }
    executeSelectManyRows(query: string, params: any[] = []): Promise<any[]> {
        try {
            const rows = this.connection.prepare(query).safeIntegers(true).all(params)
            for (var i = 0, length = rows.length; i < length; i++) {
                const row = rows[i]
                for (var prop in row) {
                    row[prop] = toStringInt(row[prop])
                }
            }
            return Promise.resolve(rows)
        } catch (e) {
            return Promise.reject(e)
        }
    }
    executeSelectOneColumnOneRow(query: string, params: any[] = []): Promise<any> {
        try {
            const rows = this.connection.prepare(query).safeIntegers(true).all(params)
            if (rows.length > 1) {
                return Promise.reject(new Error('Too many rows, expected only zero or one row'))
            }
            const row = rows[0]
            if (row) {
                const columns = Object.getOwnPropertyNames(row)
                if (columns.length > 1) {
                    return Promise.reject(new Error('Too many columns, expected only one column'))
                }
                return Promise.resolve(row[columns[0]])
            }
            return Promise.resolve(undefined)
        } catch (e) {
            return Promise.reject(e)
        }
    }
    executeSelectOneColumnManyRows(query: string, params: any[] = []): Promise<any[]> {
        try {
            const rows = this.connection.prepare(query).safeIntegers(true).all(params)
            const result = []
            for (let i = 0, length = rows.length; i < length; i++) {
                const row = rows[i]
                const columns = Object.getOwnPropertyNames(row)
                if (columns.length > 1) {
                    return Promise.reject(new Error('Too many columns, expected only one column'))
                }
                result.push(toStringInt(row[columns[0]]))
            }
            return Promise.resolve(result)
        } catch (e) {
            return Promise.reject(e)
        }
    }
    executeInsert(query: string, params: any[] = []): Promise<number> {
        try {
            return Promise.resolve(this.connection.prepare(query).run(params).changes)
        } catch (e) {
            return Promise.reject(e)
        }
    }
    executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
        try {
            return Promise.resolve(toStringInt(this.connection.prepare(query).safeIntegers(true).run(params).lastInsertRowid))
        } catch (e) {
            return Promise.reject(e)
        }
    }
    executeInsertReturningMultipleLastInsertedId(_query: string, _params: any[] = []): Promise<any> {
        throw new Error('Unsupported executeInsertReturningLastInsertedId for this database')
    }
    executeUpdate(query: string, params: any[] = []): Promise<number> {
        try {
            return Promise.resolve(this.connection.prepare(query).run(params).changes)
        } catch (e) {
            return Promise.reject(e)
        }
    }
    executeDelete(query: string, params: any[] = []): Promise<number> {
        try {
            return Promise.resolve(this.connection.prepare(query).run(params).changes)
        } catch (e) {
            return Promise.reject(e)
        }
    }
    executeProcedure(query: string, params: any[] = []): Promise<void> {
        try {
            this.connection.prepare(query).run(params)
            return Promise.resolve(undefined)
        } catch (e) {
            return Promise.reject(e)
        }
    }
    executeFunction(query: string, params: any[] = []): Promise<any> {
        try {
            const rows = this.connection.prepare(query).safeIntegers(true).all(params)
            if (rows.length > 1) {
                return Promise.reject(new Error('Too many rows, expected only zero or one row'))
            }
            const row = rows[0]
            if (row) {
                const columns = Object.getOwnPropertyNames(row)
                if (columns.length > 1) {
                    return Promise.reject(new Error('Too many columns, expected only one column'))
                }
                return Promise.resolve(row[columns[0]])
            }
            return Promise.resolve(undefined)
        } catch (e) {
            return Promise.reject(e)
        }
    }
    executeBeginTransaction(): Promise<void> {
        try {
            this.connection.prepare('begin').run()
            return Promise.resolve(undefined)
        } catch (e) {
            return Promise.reject(e)
        }
    }
    executeCommit(): Promise<void> {
        try {
            this.connection.prepare('commit').run()
            return Promise.resolve(undefined)
        } catch (e) {
            return Promise.reject(e)
        }
    }
    executeRollback(): Promise<void> {
        try {
            this.connection.prepare('rollback').run()
            return Promise.resolve(undefined)
        } catch (e) {
            return Promise.reject(e)
        }
    }
    executeDatabaseSchemaModification(query: string, params: any[] = []): Promise<void> {
        try {
            this.connection.prepare(query).run(params)
            return Promise.resolve(undefined)
        } catch (e) {
            return Promise.reject(e)
        }
    }
    addParam(params: any[], value: any): string {
        const index = params.length
        params.push(value)
        return '$' + index
    }
    addOutParam(_params: any[], _name: string): string {
        throw new Error('Unsupported output parameters')
    }
}

function toStringInt(value: any) {
    if (Integer.isInstance(value)) {
        if (value.isSafe()) {
            return value.toNumber()
        } else {
            return value.toString()
        }
    }
    return value
}