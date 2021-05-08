import { UnwrapPromiseTuple } from "../utils/PromiseProvider"
import type { QueryRunner, DatabaseType } from "./QueryRunner"

export abstract class AbstractQueryRunner implements QueryRunner {
    abstract readonly database: DatabaseType
    abstract useDatabase(database: DatabaseType): void
    abstract getNativeRunner(): unknown
    abstract execute<RESULT>(fn: (connection: unknown, transaction?: unknown) => Promise<RESULT>): Promise<RESULT>
    abstract executeSelectOneRow(query: string, params?: any[]): Promise<any>
    abstract executeSelectManyRows(query: string, params?: any[]): Promise<any[]>
    abstract executeSelectOneColumnOneRow(query: string, params?: any[]): Promise<any>
    abstract executeSelectOneColumnManyRows(query: string, params?: any[]): Promise<any[]>
    abstract executeInsert(query: string, params?: any[]): Promise<number>
    abstract executeInsertReturningLastInsertedId(query: string, params?: any[]): Promise<any>
    abstract executeInsertReturningMultipleLastInsertedId(query: string, params?: any[]): Promise<any[]>
    abstract executeUpdate(query: string, params?: any[]): Promise<number>
    abstract executeDelete(query: string, params?: any[]): Promise<number>
    abstract executeProcedure(query: string, params?: any[]): Promise<void>
    abstract executeFunction(query: string, params?: any[]): Promise<any>
    abstract executeBeginTransaction(): Promise<void>
    abstract executeCommit(): Promise<void>
    abstract executeRollback(): Promise<void>
    abstract executeDatabaseSchemaModification(query: string, params?: any[]): Promise<void>
    abstract addParam(params: any[], value: any): string
    abstract addOutParam(params: any[], name: string): string
    abstract createResolvedPromise<RESULT>(result: RESULT): Promise<RESULT>
    abstract createAllPromise<P extends Promise<any>[]>(promises: [...P]): Promise<UnwrapPromiseTuple<P>>
    executeInTransaction<T>(fn: () => Promise<T>, outermostQueryRunner: QueryRunner): Promise<T>
    executeInTransaction<P extends Promise<any>[]>(fn: () => [...P], outermostQueryRunner: QueryRunner): Promise<UnwrapPromiseTuple<P>>
    executeInTransaction(fn: () => Promise<any>[] | Promise<any>, outermostQueryRunner: QueryRunner): Promise<any>
    executeInTransaction(fn: () => Promise<any>[] | Promise<any>, outermostQueryRunner: QueryRunner): Promise<any> {
        return outermostQueryRunner.executeBeginTransaction().then(() => {
            let result = fn()
            if (Array.isArray(result)) {
                result = this.createAllPromise(result)
            }
            return result.then((r) => {
                return outermostQueryRunner.executeCommit().then(() => {
                    return r
                })
            }, (e) => {
                return outermostQueryRunner.executeRollback().then(() => {
                    throw e
                }, () => {
                    // Throw the innermost error
                    throw e
                })
            })
        })
    }
    executeCombined<R1, R2>(fn1: () => Promise<R1>, fn2: () => Promise<R2>): Promise<[R1, R2]> {
        return fn1().then((r1) => {
            return fn2().then((r2) => {
                return [r1, r2]
            })
        })
    }
}