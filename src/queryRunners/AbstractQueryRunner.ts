import { UnwrapPromiseTuple } from "../utils/PromiseProvider"
import type { QueryRunner, DatabaseType } from "./QueryRunner"

export abstract class AbstractQueryRunner implements QueryRunner {
    abstract readonly database: DatabaseType
    abstract useDatabase(database: DatabaseType): void
    abstract getNativeRunner(): unknown
    abstract execute<RESULT>(fn: (connection: unknown, transaction?: unknown) => Promise<RESULT>): Promise<RESULT>

    executeSelectOneRow(query: string, params: any[] = []): Promise<any> {
        return this.executeQueryReturning(query, params).then((rows) => {
            if (rows.length > 1) {
                throw new Error('Too many rows, expected only zero or one row')
            }
            return rows[0]
        })
    }
    executeSelectManyRows(query: string, params: any[] = []): Promise<any[]> {
        return this.executeQueryReturning(query, params)
    }
    executeSelectOneColumnOneRow(query: string, params: any[] = []): Promise<any> {
        return this.executeQueryReturning(query, params).then((rows) => {
            if (rows.length > 1) {
                throw new Error('Too many rows, expected only zero or one row')
            }
            const row = rows[0]
            if (row) {
                const columns = Object.getOwnPropertyNames(row)
                if (columns.length > 1) {
                    throw new Error('Too many columns, expected only one column')
                }
                return row[columns[0]!] // Value in the row of the first column without care about the name
            }
            return undefined
        })
    }
    executeSelectOneColumnManyRows(query: string, params: any[] = []): Promise<any[]> {
        return this.executeQueryReturning(query, params).then((rows) => rows.map((row) => {
            const columns = Object.getOwnPropertyNames(row)
            if (columns.length > 1) {
                throw new Error('Too many columns, expected only one column')
            }
            return row[columns[0]!] // Value in the row of the first column without care about the name
        }))
    }
    executeInsert(query: string, params: any[] = []): Promise<number> {
        return this.executeMutation(query, params)
    }
    executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
        return this.executeMutationReturning(query, params).then((rows) => {
            if (rows.length > 1) {
                throw new Error('Too many rows, expected only zero or one row')
            }
            const row = rows[0]
            if (row) {
                const columns = Object.getOwnPropertyNames(row)
                if (columns.length > 1) {
                    throw new Error('Too many columns, expected only one column')
                }
                return row[columns[0]!] // Value in the row of the first column without care about the name
            }
            throw new Error('Unable to find the last inserted id')
        })
    }
    executeInsertReturningMultipleLastInsertedId(query: string, params: any[] = []): Promise<any> {
        return this.executeMutationReturning(query, params).then((rows) => {
            return rows.map((row) => {
                const columns = Object.getOwnPropertyNames(row)
                if (columns.length > 1) {
                    throw new Error('Too many columns, expected only one column')
                }
                return row[columns[0]!] // Value in the row of the first column without care about the name
            })
        })
    }
    executeUpdate(query: string, params: any[] = []): Promise<number> {
        return this.executeMutation(query, params)
    }
    executeDelete(query: string, params: any[] = []): Promise<number> {
        return this.executeMutation(query, params)
    }
    executeProcedure(query: string, params: any[] = []): Promise<void> {
        return this.executeMutation(query, params).then(() => undefined)
    }
    executeFunction(query: string, params: any[] = []): Promise<any> {
        return this.executeQueryReturning(query, params).then((rows) => {
            if (rows.length > 1) {
                throw new Error('Too many rows, expected only zero or one row')
            }
            const row = rows[0]
            if (row) {
                const columns = Object.getOwnPropertyNames(row)
                if (columns.length > 1) {
                    throw new Error('Too many columns, expected only one column')
                }
                return row[columns[0]!] // Value in the row of the first column without care about the name
            }
            return undefined
        })
    }
    executeDatabaseSchemaModification(query: string, params: any[] = []): Promise<void> {
        return this.executeMutation(query, params).then(() => undefined)
    }

    protected abstract executeQueryReturning(query: string, params: any[]): Promise<any[]>
    protected abstract executeMutation(query: string, params: any[]): Promise<number>
    protected containsInsertReturningClause(query: string, params: any[]) {
        const p = params as any
        if (p._containsInsertReturningClause === true) {
            return true
        } else if (p._containsInsertReturningClause === false) {
            return false
        } else {
            return /\sreturning\s/.test(query)
        }
    }
    protected executeMutationReturning(query: string, params: any[]): Promise<any[]> {
        return this.executeQueryReturning(query, params)
    }

    abstract executeBeginTransaction(): Promise<void>
    abstract executeCommit(): Promise<void>
    abstract executeRollback(): Promise<void>
    abstract isTransactionActive(): boolean
    abstract addParam(params: any[], value: any): string
    addOutParam(_params: any[], _name: string): string {
        throw new Error('Unsupported output parameters')
    }
    abstract createResolvedPromise<RESULT>(result: RESULT): Promise<RESULT>
    abstract executeInTransaction<P extends Promise<any>[]>(fn: () => [...P], outermostQueryRunner: QueryRunner): Promise<UnwrapPromiseTuple<P>>
    abstract executeInTransaction<T>(fn: () => Promise<T>, outermostQueryRunner: QueryRunner): Promise<T>
    abstract executeInTransaction(fn: () => Promise<any>[] | Promise<any>, outermostQueryRunner: QueryRunner): Promise<any>
    abstract executeCombined<R1, R2>(fn1: () => Promise<R1>, fn2: () => Promise<R2>): Promise<[R1, R2]>
}