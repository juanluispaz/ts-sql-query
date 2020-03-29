import { QueryRunner, DatabaseType } from "./QueryRunner"

export class ConsoleLogNoopQueryRunner implements QueryRunner {
    readonly database: DatabaseType

    constructor(database: DatabaseType = 'noopDB') {
        this.database = database
    }

    useDatabase(database: DatabaseType): void {
        // @ts-ignore
        this.database = database
    }

    getNativeConnection(): unknown {
        return null
    }

    executeSelectOneRow(query: string, params: any[] = []): Promise<any> {
        console.log('executeSelectOneRow:', query, params)
        return Promise.resolve(undefined)
    }
    executeSelectManyRows(query: string, params: any[] = []): Promise<any[]> {
        console.log('executeSelectManyRows:', query, params)
        return Promise.resolve([])
    }
    executeSelectOneColumnOneRow(query: string, params: any[] = []): Promise<any> {
        console.log('executeSelectOneColumnOneRow:', query, params)
        return Promise.resolve(undefined)
    }
    executeSelectOneColumnManyRows(query: string, params: any[] = []): Promise<any[]> {
        console.log('executeSelectOneColumnManyRows:', query, params)
        return Promise.resolve([])
    }
    executeInsert(query: string, params: any[] = []): Promise<number> {
        console.log('executeInsert:', query, params)
        return Promise.resolve(0)
    }
    executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
        console.log('executeInsertReturningLastInsertedId:', query, params)
        return Promise.resolve(undefined)
    }
    executeInsertReturningMultipleLastInsertedId(query: string, params: any[] = []): Promise<any> {
        console.log('executeInsertReturningMultipleLastInsertedId:', query, params)
        return Promise.resolve([])
    }
    executeUpdate(query: string, params: any[] = []): Promise<number> {
        console.log('executeUpdate:', query, params)
        return Promise.resolve(0)
    }
    executeDelete(query: string, params: any[] = []): Promise<number> {
        console.log('executeDelete:', query, params)
        return Promise.resolve(0)
    }
    executeProcedure(query: string, params: any[] = []): Promise<void> {
        console.log('executeProcedure:', query, params)
        return Promise.resolve()
    }
    executeFunction(query: string, params: any[] = []): Promise<any> {
        console.log('executeFunction:', query, params)
        return Promise.resolve(undefined)
    }
    executeBeginTransaction(): Promise<void> {
        console.log('executeBeginTransaction:', undefined, undefined)
        return Promise.resolve()
    }
    executeCommit(): Promise<void> {
        console.log('executeCommit:', undefined, undefined)
        return Promise.resolve()
    }
    executeRollback(): Promise<void> {
        console.log('executeRollback:', undefined, undefined)
        return Promise.resolve()
    }
    executeDatabaseSchemaModification(query: string, params: any[] = []): Promise<void> {
        console.log('executeDatabaseSchemaModification:', query, params)
        return Promise.resolve()
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
                result = '$' + index
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
}