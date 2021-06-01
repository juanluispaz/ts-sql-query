import type { PromiseProvider, UnwrapPromiseTuple } from "../utils/PromiseProvider"
import { ManagedTransactionQueryRunner } from "./ManagedTransactionQueryRunner"
import type { DatabaseType } from "./QueryRunner"

export interface ConsoleLogNoopQueryRunnerConfig {
    database?: DatabaseType
    promise?: PromiseProvider
}

export class ConsoleLogNoopQueryRunner extends ManagedTransactionQueryRunner {
    readonly database: DatabaseType
    readonly promise: PromiseProvider

    constructor(databaseOrConfig: DatabaseType | ConsoleLogNoopQueryRunnerConfig = 'noopDB') {
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

    executeSelectOneRow(query: string, params: any[] = []): Promise<any> {
        console.log('executeSelectOneRow:', query, params)
        return this.promise.resolve(undefined)
    }
    executeSelectManyRows(query: string, params: any[] = []): Promise<any[]> {
        console.log('executeSelectManyRows:', query, params)
        return this.promise.resolve([])
    }
    executeSelectOneColumnOneRow(query: string, params: any[] = []): Promise<any> {
        console.log('executeSelectOneColumnOneRow:', query, params)
        return this.promise.resolve(undefined)
    }
    executeSelectOneColumnManyRows(query: string, params: any[] = []): Promise<any[]> {
        console.log('executeSelectOneColumnManyRows:', query, params)
        return this.promise.resolve([])
    }
    executeInsert(query: string, params: any[] = []): Promise<number> {
        console.log('executeInsert:', query, params)
        return this.promise.resolve(0)
    }
    executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
        console.log('executeInsertReturningLastInsertedId:', query, params)
        return this.promise.resolve(undefined)
    }
    executeInsertReturningMultipleLastInsertedId(query: string, params: any[] = []): Promise<any> {
        console.log('executeInsertReturningMultipleLastInsertedId:', query, params)
        return this.promise.resolve([])
    }
    executeUpdate(query: string, params: any[] = []): Promise<number> {
        console.log('executeUpdate:', query, params)
        return this.promise.resolve(0)
    }
    executeDelete(query: string, params: any[] = []): Promise<number> {
        console.log('executeDelete:', query, params)
        return this.promise.resolve(0)
    }
    executeProcedure(query: string, params: any[] = []): Promise<void> {
        console.log('executeProcedure:', query, params)
        return this.promise.resolve()
    }
    executeFunction(query: string, params: any[] = []): Promise<any> {
        console.log('executeFunction:', query, params)
        return this.promise.resolve(undefined)
    }
    executeBeginTransaction(): Promise<void> {
        console.log('executeBeginTransaction:', undefined, undefined)
        return this.promise.resolve()
    }
    executeCommit(): Promise<void> {
        console.log('executeCommit:', undefined, undefined)
        return this.promise.resolve()
    }
    executeRollback(): Promise<void> {
        console.log('executeRollback:', undefined, undefined)
        return this.promise.resolve()
    }
    executeDatabaseSchemaModification(query: string, params: any[] = []): Promise<void> {
        console.log('executeDatabaseSchemaModification:', query, params)
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
        params.push({out_param_with_name: name})
        return ':' + index
    }
    createResolvedPromise<RESULT>(result: RESULT): Promise<RESULT> {
        return this.promise.resolve(result) 
    }
    createAllPromise<P extends Promise<any>[]>(promises: [...P]): Promise<UnwrapPromiseTuple<P>> {
        return this.promise.all(promises) as any
    }
}