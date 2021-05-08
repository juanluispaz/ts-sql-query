import type { PromiseProvider, UnwrapPromiseTuple } from "../utils/PromiseProvider"
import { AbstractQueryRunner } from "./AbstractQueryRunner"
import type { DatabaseType } from "./QueryRunner"

export interface NoopQueryRunnerConfig {
    database?: DatabaseType
    promise?: PromiseProvider
}

export class NoopQueryRunner extends AbstractQueryRunner {
    readonly database: DatabaseType
    readonly promise: PromiseProvider

    constructor(databaseOrConfig: DatabaseType | NoopQueryRunnerConfig = 'noopDB') {
        super()
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
    executeDelete(_query: string, _params: any[] = []): Promise<number> {
        return this.promise.resolve(0)
    }
    executeProcedure(_query: string, _params: any[] = []): Promise<void> {
        return this.promise.resolve()
    }
    executeFunction(_query: string, _params: any[] = []): Promise<any> {
        return this.promise.resolve(undefined)
    }
    executeBeginTransaction(): Promise<void> {
        return this.promise.resolve()
    }
    executeCommit(): Promise<void> {
        return this.promise.resolve()
    }
    executeRollback(): Promise<void> {
        return this.promise.resolve()
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
    createResolvedPromise<RESULT>(result: RESULT): Promise<RESULT> {
        return this.promise.resolve(result) 
    }
    createAllPromise<P extends Promise<any>[]>(promises: [...P]): Promise<UnwrapPromiseTuple<P>> {
        return this.promise.all(promises) as any
    }
}