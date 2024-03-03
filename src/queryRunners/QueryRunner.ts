export interface QueryRunner {
    readonly database: DatabaseType
    useDatabase(database: DatabaseType): void
    getNativeRunner(): unknown
    getCurrentNativeTransaction(): unknown
    execute<RESULT>(fn: (connection: unknown, transaction?: unknown) => Promise<RESULT>): Promise<RESULT>
    executeSelectOneRow(query: string, params?: any[]): Promise<any>
    executeSelectManyRows(query: string, params?: any[]): Promise<any[]>
    executeSelectOneColumnOneRow(query: string, params?: any[]): Promise<any>
    executeSelectOneColumnManyRows(query: string, params?: any[]): Promise<any[]>
    executeInsert(query: string, params?: any[]): Promise<number>
    executeInsertReturningLastInsertedId(query: string, params?: any[]): Promise<any>
    executeInsertReturningMultipleLastInsertedId(query: string, params?: any[]): Promise<any[]>
    executeInsertReturningOneRow(query: string, params?: any[]): Promise<any>
    executeInsertReturningManyRows(query: string, params?: any[]): Promise<any[]>
    executeInsertReturningOneColumnOneRow(query: string, params?: any[]): Promise<any>
    executeInsertReturningOneColumnManyRows(query: string, params?: any[]): Promise<any[]>
    executeUpdate(query: string, params?: any[]): Promise<number>
    executeUpdateReturningOneRow(query: string, params?: any[]): Promise<any>
    executeUpdateReturningManyRows(query: string, params?: any[]): Promise<any[]>
    executeUpdateReturningOneColumnOneRow(query: string, params?: any[]): Promise<any>
    executeUpdateReturningOneColumnManyRows(query: string, params?: any[]): Promise<any[]>
    executeDelete(query: string, params?: any[]): Promise<number>
    executeDeleteReturningOneRow(query: string, params?: any[]): Promise<any>
    executeDeleteReturningManyRows(query: string, params?: any[]): Promise<any[]>
    executeDeleteReturningOneColumnOneRow(query: string, params?: any[]): Promise<any>
    executeDeleteReturningOneColumnManyRows(query: string, params?: any[]): Promise<any[]>
    executeProcedure(query: string, params?: any[]): Promise<void>
    executeFunction(query: string, params?: any[]): Promise<any>
    executeBeginTransaction(): Promise<void>
    executeCommit(): Promise<void>
    executeRollback(): Promise<void>
    executeInTransaction<T>(fn: () => Promise<T>, outermostQueryRunner: QueryRunner): Promise<T>
    isTransactionActive(): boolean
    executeDatabaseSchemaModification(query: string, params?: any[]): Promise<void>
    executeConnectionConfiguration(query: string, params?: any[]): Promise<void>
    addParam(params: any[], value: any): string
    addOutParam(params: any[], name: string): string
    createResolvedPromise<RESULT>(result: RESULT): Promise<RESULT>
    executeCombined<R1, R2>(fn1: () => Promise<R1>, fn2: () => Promise<R2>): Promise<[R1, R2]>
    isMocked(): boolean
    lowLevelTransactionManagementSupported(): boolean
}

export type DatabaseType = 'mariaDB' | 'mySql' | 'noopDB' | 'oracle' | 'postgreSql' | 'sqlite' | 'sqlServer'

export type QueryType = 'selectOneRow' | 'selectManyRows' | 'selectOneColumnOneRow' | 'selectOneColumnManyRows' |
    'insert' | 'insertReturningLastInsertedId' | 'insertReturningMultipleLastInsertedId' |
    'insertReturningOneRow' | 'insertReturningManyRows' | 'insertReturningOneColumnOneRow' | 'insertReturningOneColumnManyRows' |
    'update' | 'updateReturningOneRow' | 'updateReturningManyRows' | 'updateReturningOneColumnOneRow' | 'updateReturningOneColumnManyRows' |
    'delete' | 'deleteReturningOneRow' | 'deleteReturningManyRows' | 'deleteReturningOneColumnOneRow' | 'deleteReturningOneColumnManyRows' |
    'executeProcedure' | 'executeFunction' | 'beginTransaction' | 'commit' | 'rollback' | 
    'executeDatabaseSchemaModification' | 'executeConnectionConfiguration'

export type PromiseProvider = PromiseConstructorLike & {
    resolve: typeof Promise.resolve,
    reject: typeof Promise.reject,
    /* Not all providers have compatible interface, by example:
        * synchronous-promise doesn't provide an definition so detailed like the ones included in the standar library
        */
    // all: typeof Promise.all, 
    // all(values: any[]): Promise<any[]>, 
    /* Not all providers support it, by example: 
        * synchronous-promise doesn't provide an implementation of it
        */
    // race: typeof Promise.race, 
    /* So new, introduced in ES2020. Not all providers have compatible interface, by example:
        * synchronous-promise doesn't provide an definition compatible with the ones included in the standar library
        */
    // allSettled: typeof Promise.allSettled
}

export function getQueryExecutionName(query: string, params: any[]): string | undefined {
    query
    return (params as any).$metadata?.queryExecutionName
}
export function getQueryExecutionMetadata(query: string, params: any[]): unknown {
    query
    return (params as any).$metadata?.queryExecutionMetadata
}
export function getQueryExecutionStack(query: string, params: any[]): string| undefined {
    query
    const source : Error | undefined = (params as any).$source
    return source?.stack
}
export interface FunctionExecutingQueryInformation {
    functionName?: string,
    fileName?: string,
    lineNumber?: string,
    positionNumber?: string
}
export function getFunctionExecutingQuery(query: string, params: any[]): FunctionExecutingQueryInformation | undefined {
    const stack = getQueryExecutionStack(query, params)
    if (!stack) {
        return undefined
    }
    const lineRegex = /^.+?\n.+?\n\s+?at(?: async)? (.+?)(?: (?:\((.+?)\)))?\n/m
    const lineMatch = stack.match(lineRegex)
    if (!lineMatch) {
        return undefined
    }
    let functionName = lineMatch[1]
    if (!functionName) {
        return undefined
    }
    let file = lineMatch[2]
    if (!file) {
        file = functionName
        functionName = undefined
    }
    if (functionName === '<anonymous>') {
        functionName = undefined
    }
    if (file === '<anonymous>') {
        return undefined
    }
    const fileRegex = /^(.+?)(?:\:(\d+?)(?:\:(\d+?))?)?$/
    const fileMatch = file.match(fileRegex)
    if (!fileMatch) {
        return { functionName }
    }
    const result = {
        functionName,
        fileName: fileMatch[1], 
        lineNumber: fileMatch[2], 
        positionNumber: fileMatch[3]
    }
    return result
}
export function isSelectPageCountQuery(query: string, params: any[]): boolean {
    query
    return !!(params as any).$isSelectPageCountQuery
}