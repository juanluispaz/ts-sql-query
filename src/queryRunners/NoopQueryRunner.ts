import type { PromiseProvider, UnwrapPromiseTuple } from "../utils/PromiseProvider"
import type { DatabaseType, QueryRunner } from "./QueryRunner"

export interface NoopQueryRunnerConfig {
    database?: DatabaseType
    promise?: PromiseProvider
}

export class NoopQueryRunner implements QueryRunner {
    readonly database: DatabaseType
    readonly promise: PromiseProvider
    private transactionLevel = 0

    constructor(databaseOrConfig: DatabaseType | NoopQueryRunnerConfig = 'noopDB') {
        if (typeof databaseOrConfig === 'string') {
            databaseOrConfig = { database: databaseOrConfig }
        }
        this.database = databaseOrConfig.database || 'noopDB'
        this.promise = databaseOrConfig.promise || Promise
    }

    useDatabase(database: DatabaseType): void {
        // @ts-ignore
        this.database = database
    }

    getNativeRunner(): unknown {
        return null
    }

    execute<RESULT>(fn: (connection: unknown, transaction?: unknown) => Promise<RESULT>): Promise<RESULT> {
        return fn(null)
    }

    executeSelectOneRow(_query: string, _params: any[] = []): Promise<any> {
        return this.promise.resolve(undefined)
    }
    executeSelectManyRows(_query: string, _params: any[] = []): Promise<any[]> {
        return this.promise.resolve([])
    }
    executeSelectOneColumnOneRow(_query: string, _params: any[] = []): Promise<any> {
        return this.promise.resolve(undefined)
    }
    executeSelectOneColumnManyRows(_query: string, _params: any[] = []): Promise<any[]> {
        return this.promise.resolve([])
    }
    executeInsert(_query: string, _params: any[] = []): Promise<number> {
        return this.promise.resolve(0)
    }
    executeInsertReturningLastInsertedId(_query: string, _params: any[] = []): Promise<any> {
        return this.promise.resolve(undefined)
    }
    executeInsertReturningMultipleLastInsertedId(_query: string, _params: any[] = []): Promise<any> {
        return this.promise.resolve([])
    }
    executeUpdate(_query: string, _params: any[] = []): Promise<number> {
        return this.promise.resolve(0)
    }
    executeUpdateReturningOneRow(_query: string, _params: any[] = []): Promise<any> {
        return this.promise.resolve(undefined)
    }
    executeUpdateReturningManyRows(_query: string, _params: any[] = []): Promise<any[]> {
        return this.promise.resolve([])
    }
    executeUpdateReturningOneColumnOneRow(_query: string, _params: any[] = []): Promise<any> {
        return this.promise.resolve(undefined)
    }
    executeUpdateReturningOneColumnManyRows(_query: string, _params: any[] = []): Promise<any[]> {
        return this.promise.resolve([])
    }
    executeDelete(_query: string, _params: any[] = []): Promise<number> {
        return this.promise.resolve(0)
    }
    executeDeleteReturningOneRow(_query: string, _params: any[] = []): Promise<any> {
        return this.promise.resolve(undefined)
    }
    executeDeleteReturningManyRows(_query: string, _params: any[] = []): Promise<any[]> {
        return this.promise.resolve([])
    }
    executeDeleteReturningOneColumnOneRow(_query: string, _params: any[] = []): Promise<any> {
        return this.promise.resolve(undefined)
    }
    executeDeleteReturningOneColumnManyRows(_query: string, _params: any[] = []): Promise<any[]> {
        return this.promise.resolve([])
    }
    executeProcedure(_query: string, _params: any[] = []): Promise<void> {
        return this.promise.resolve()
    }
    executeFunction(_query: string, _params: any[] = []): Promise<any> {
        return this.promise.resolve(undefined)
    }
    executeBeginTransaction(): Promise<void> {
        this.transactionLevel++
        return this.promise.resolve()
    }
    executeCommit(): Promise<void> {
        this.transactionLevel--
        return this.promise.resolve()
    }
    executeRollback(): Promise<void> {
        this.transactionLevel--
        return this.promise.resolve()
    }
    isTransactionActive(): boolean {
        return this.transactionLevel > 0
    }
    executeDatabaseSchemaModification(_query: string, _params: any[] = []): Promise<void> {
        return this.promise.resolve()
    }
    addParam(params: any[], value: any): string {
        const index = params.length
        let result
        switch (this.database) {
            case 'mariaDB':
                result = '?'
                break
            case 'mySql':
                result = '?'
                break
            case 'noopDB':
                result = '$' + index
                break
            case 'oracle':
                result = ':' + index
                break
            case 'postgreSql':
                result = '$' + (index + 1)
                break
            case 'sqlite':
                result = '?'
                break
            case 'sqlServer':
                result = '@' + index
                break
            default:
                throw new Error('Unknown database ' + this.database)
        }
        params.push(value)
        return result
    }
    addOutParam(params: any[], name: string): string {
        const index = params.length
        params.push({ out_param_with_name: name })
        return ':' + index
    }
    executeInTransaction<P extends Promise<any>[]>(fn: () => [...P], outermostQueryRunner: QueryRunner): Promise<UnwrapPromiseTuple<P>>
    executeInTransaction<T>(fn: () => Promise<T>, outermostQueryRunner: QueryRunner): Promise<T>
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
    createResolvedPromise<RESULT>(result: RESULT): Promise<RESULT> {
        return this.promise.resolve(result) 
    }
    createAllPromise<P extends Promise<any>[]>(promises: [...P]): Promise<UnwrapPromiseTuple<P>> {
        return this.promise.all(promises) as any
    }
    isMocked(): boolean {
        return false
    }
}