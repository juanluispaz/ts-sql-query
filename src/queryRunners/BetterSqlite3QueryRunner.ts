import type { DatabaseType } from "./QueryRunner"
import type { Database } from 'better-sqlite3'
import type { PromiseProvider, UnwrapPromiseTuple } from "../utils/PromiseProvider"
import { Integer } from 'better-sqlite3'
import { AbstractQueryRunner } from "./AbstractQueryRunner"

export interface BetterSqlite3QueryRunnerConfig {
    promise?: PromiseProvider
}

export class BetterSqlite3QueryRunner extends AbstractQueryRunner {
    readonly database: DatabaseType
    readonly connection: Database
    readonly promise: PromiseProvider

    constructor(connection: Database, config?: BetterSqlite3QueryRunnerConfig) {
        super()
        this.connection = connection
        this.database = 'sqlite'
        this.promise = config?.promise || Promise
    }

    useDatabase(database: DatabaseType): void {
        if (database !== 'sqlite') {
            throw new Error('Unsupported database: ' + database + '. BetterSqlite3QueryRunner only supports sqlite databases')
        }
    }

    getNativeRunner(): Database {
        return this.connection
    }

    execute<RESULT>(fn: (connection: unknown, transaction?: unknown) => Promise<RESULT>): Promise<RESULT> {
        return fn(this.connection)
    }

    executeSelectOneRow(query: string, params: any[] = []): Promise<any> {
        try {
            const rows = this.connection.prepare(query).safeIntegers(true).all(params)
            if (rows.length > 1) {
                this.promise.reject(new Error('Too many rows, expected only zero or one row'))
            }
            const row = rows[0]
            for (var prop in row) {
                row[prop] = toStringInt(row[prop])
            }
            return this.promise.resolve(row)
        } catch (e) {
            return this.promise.reject(e)
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
            return this.promise.resolve(rows)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeSelectOneColumnOneRow(query: string, params: any[] = []): Promise<any> {
        try {
            const rows = this.connection.prepare(query).safeIntegers(true).all(params)
            if (rows.length > 1) {
                return this.promise.reject(new Error('Too many rows, expected only zero or one row'))
            }
            const row = rows[0]
            if (row) {
                const columns = Object.getOwnPropertyNames(row)
                if (columns.length > 1) {
                    return this.promise.reject(new Error('Too many columns, expected only one column'))
                }
                return this.promise.resolve(toStringInt(row[columns[0]!])) // Value in the row of the first column without care about the name
            }
            return this.promise.resolve(undefined)
        } catch (e) {
            return this.promise.reject(e)
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
                    return this.promise.reject(new Error('Too many columns, expected only one column'))
                }
                result.push(toStringInt(row[columns[0]!])) // Value in the row of the first column without care about the name
            }
            return this.promise.resolve(result)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeInsert(query: string, params: any[] = []): Promise<number> {
        try {
            return this.promise.resolve(this.connection.prepare(query).run(params).changes)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
        try {
            return this.promise.resolve(toStringInt(this.connection.prepare(query).safeIntegers(true).run(params).lastInsertRowid))
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeInsertReturningMultipleLastInsertedId(_query: string, _params: any[] = []): Promise<any> {
        throw new Error('Unsupported executeInsertReturningLastInsertedId for this database')
    }
    executeUpdate(query: string, params: any[] = []): Promise<number> {
        try {
            return this.promise.resolve(this.connection.prepare(query).run(params).changes)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeDelete(query: string, params: any[] = []): Promise<number> {
        try {
            return this.promise.resolve(this.connection.prepare(query).run(params).changes)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeProcedure(query: string, params: any[] = []): Promise<void> {
        try {
            this.connection.prepare(query).run(params)
            return this.promise.resolve(undefined)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeFunction(query: string, params: any[] = []): Promise<any> {
        try {
            const rows = this.connection.prepare(query).safeIntegers(true).all(params)
            if (rows.length > 1) {
                return this.promise.reject(new Error('Too many rows, expected only zero or one row'))
            }
            const row = rows[0]
            if (row) {
                const columns = Object.getOwnPropertyNames(row)
                if (columns.length > 1) {
                    return this.promise.reject(new Error('Too many columns, expected only one column'))
                }
                return this.promise.resolve(toStringInt(row[columns[0]!])) // Value in the row of the first column without care about the name
            }
            return this.promise.resolve(undefined)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeBeginTransaction(): Promise<void> {
        try {
            this.connection.prepare('begin').run()
            return this.promise.resolve(undefined)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeCommit(): Promise<void> {
        try {
            this.connection.prepare('commit').run()
            return this.promise.resolve(undefined)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeRollback(): Promise<void> {
        try {
            this.connection.prepare('rollback').run()
            return this.promise.resolve(undefined)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeDatabaseSchemaModification(query: string, params: any[] = []): Promise<void> {
        try {
            this.connection.prepare(query).run(params)
            return this.promise.resolve(undefined)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    addParam(params: any[], value: any): string {
        params.push(value)
        return '?'
    }
    addOutParam(_params: any[], _name: string): string {
        throw new Error('Unsupported output parameters')
    }
    createResolvedPromise<RESULT>(result: RESULT): Promise<RESULT> {
        return this.promise.resolve(result) 
    }
    createAllPromise<P extends Promise<any>[]>(promises: [...P]): Promise<UnwrapPromiseTuple<P>> {
        return this.promise.all(promises) as any
    }
}

function toStringInt(value: any) {
    if (Integer && Integer.isInstance(value)) {
        if (value.isSafe()) {
            return value.toNumber()
        } else {
            return value.toString()
        }
    }
    return value
}