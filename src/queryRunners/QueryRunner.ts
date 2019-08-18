export interface QueryRunner {
    readonly database: DatabaseType
    getNativeConnection(): unknown
    executeSelectOneRow(query: string, params: any[]): Promise<any>
    executeSelectManyRows(query: string, params: any[]): Promise<any[]>
    executeSelectOneColumnOneRow(query: string, params: any[]): Promise<any>
    executeSelectOneColumnManyRows(query: string, params: any[]): Promise<any[]>
    executeInsert(query: string, params: any[]): Promise<number>
    executeInsertReturningLastInsertedId(query: string, params: any[]): Promise<any>
    executeUpdate(query: string, params: any[]): Promise<number>
    executeDelete(query: string, params: any[]): Promise<number>
    executeProcedure(query: string, params: any[]): Promise<void>
    executeFunction(query: string, params: any[]): Promise<any>
    executeBeginTransaction(): Promise<void>
    executeCommit(): Promise<void>
    executeRollback(): Promise<void>
    addParam(params: any[], value: any): string
    addOutParam(params: any[], name: string): string
}

export type DatabaseType = 'mariaDB' | 'mySql' | 'noopDB' | 'oracle' | 'postgreSql' | 'sqlite' | 'sqlServer'