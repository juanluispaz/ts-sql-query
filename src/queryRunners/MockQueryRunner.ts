import type { BeginTransactionOpts, CommitOpts, DatabaseType, PromiseProvider, QueryRunner, QueryType, RollbackOpts } from "./QueryRunner"

export type MockQueryExecutor = (type: QueryType | 'isTransactionActive', query: string, params: any[], index: number) => any

export interface MockQueryRunnerConfig {
    database?: DatabaseType
    promise?: PromiseProvider
}

export class MockQueryRunner implements QueryRunner {
    private count = 0
    readonly queryExecutor: MockQueryExecutor
    readonly database: DatabaseType
    readonly promise: PromiseProvider

    constructor(queryExecutor: MockQueryExecutor, databaseOrConfig: DatabaseType | MockQueryRunnerConfig = 'noopDB') {
        this.queryExecutor = queryExecutor
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

    getCurrentNativeTransaction(): unknown {
        return undefined
    }

    execute<RESULT>(fn: (connection: unknown, transaction?: unknown) => Promise<RESULT>): Promise<RESULT> {
        return fn(null)
    }

    executeSelectOneRow(query: string, params: any[] = []): Promise<any> {
        try {
            const index = this.count++
            const result = this.queryExecutor('selectOneRow', query, params, index)
            if (!isPlainObjectOrNoValue(result)) {
                throw new Error('Invalid test case result for a selectOneRow with index ' + index + '. Your mock function provided to the MockQueryRunner must returns null, undefined or a plain object')
            }
            return this.promise.resolve(result)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeSelectManyRows(query: string, params: any[] = []): Promise<any[]> {
        try {
            const index = this.count++
            let result = this.queryExecutor('selectManyRows', query, params, index)
            if (result === undefined || result === null) {
                result = []
            }
            if (!Array.isArray(result)) {
                throw new Error('Invalid test case result for a selectManyRows with index ' + index + '. Your mock function provided to the MockQueryRunner must returns null, undefined or an Array of plain object')
            }
            for (let i = 0; i < result.length; i++) {
                if (!isPlainObject(result[i])) {
                    throw new Error('Invalid test case result for a selectManyRows with index ' + index + '. The returned array by the mock function provided to the MockQueryRunner contains a no plain object at position ' + i)
                }
            }
            return this.promise.resolve(result)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeSelectOneColumnOneRow(query: string, params: any[] = []): Promise<any> {
        // undefined result means no value returned by the database
        try {
            return this.promise.resolve(this.queryExecutor('selectOneColumnOneRow', query, params, this.count++))
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeSelectOneColumnManyRows(query: string, params: any[] = []): Promise<any[]> {
        try {
            const index = this.count++
            let result = this.queryExecutor('selectOneColumnManyRows', query, params, index)
            if (result === undefined || result === null) {
                result = []
            }
            if (!Array.isArray(result)) {
                throw new Error('Invalid test case result for a selectOneColumnManyRows with index ' + index + '. Your mock function provided to the MockQueryRunner must returns null, undefined or an Array')
            }
            return this.promise.resolve(result)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeInsert(query: string, params: any[] = []): Promise<number> {
        try {
            const index = this.count++
            let result = this.queryExecutor('insert', query, params, index)
            if (result === undefined || result === null) {
                result = 1
            }
            if (typeof result !== 'number') {
                throw new Error('Invalid test case result for an insert with index ' + index + '. Your mock function provided to the MockQueryRunner must returns null, undefined or a number')
            }
            return this.promise.resolve(result)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
        try {
            return this.promise.resolve(this.queryExecutor('insertReturningLastInsertedId', query, params, this.count++))
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeInsertReturningMultipleLastInsertedId(query: string, params: any[] = []): Promise<any[]> {
        try {
            const index = this.count++
            let result = this.queryExecutor('insertReturningMultipleLastInsertedId', query, params, index)
            if (result === undefined || result === null) {
                result = []
            }
            if (!Array.isArray(result)) {
                throw new Error('Invalid test case result for an insertReturningMultipleLastInsertedId with index ' + index + '. Your mock function provided to the MockQueryRunner must returns null, undefined or an Array')
            }
            return this.promise.resolve(result)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeInsertReturningOneRow(query: string, params: any[] = []): Promise<any> {
        try {
            const index = this.count++
            const result = this.queryExecutor('insertReturningOneRow', query, params, index)
            if (!isPlainObjectOrNoValue(result)) {
                throw new Error('Invalid test case result for a insertReturningOneRow with index ' + index + '. Your mock function provided to the MockQueryRunner must returns null, undefined or a plain object')
            }
            return this.promise.resolve(result)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeInsertReturningManyRows(query: string, params: any[] = []): Promise<any[]> {
        try {
            const index = this.count++
            let result = this.queryExecutor('insertReturningManyRows', query, params, index)
            if (result === undefined || result === null) {
                result = []
            }
            if (!Array.isArray(result)) {
                throw new Error('Invalid test case result for a insertReturningManyRows with index ' + index + '. Your mock function provided to the MockQueryRunner must returns null, undefined or an Array of plain object')
            }
            for (let i = 0; i < result.length; i++) {
                if (!isPlainObject(result[i])) {
                    throw new Error('Invalid test case result for a insertReturningManyRows with index ' + index + '. The returned array by the mock function provided to the MockQueryRunner contains a no plain object at position ' + i)
                }
            }
            return this.promise.resolve(result)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeInsertReturningOneColumnOneRow(query: string, params: any[] = []): Promise<any> {
        // undefined result means no value returned by the database
        try {
            return this.promise.resolve(this.queryExecutor('insertReturningOneColumnOneRow', query, params, this.count++))
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeInsertReturningOneColumnManyRows(query: string, params: any[] = []): Promise<any[]> {
        try {
            const index = this.count++
            let result = this.queryExecutor('insertReturningOneColumnManyRows', query, params, index)
            if (result === undefined || result === null) {
                result = []
            }
            if (!Array.isArray(result)) {
                throw new Error('Invalid test case result for a insertReturningOneColumnManyRows with index ' + index + '. Your mock function provided to the MockQueryRunner must returns null, undefined or an Array')
            }
            return this.promise.resolve(result)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeUpdate(query: string, params: any[] = []): Promise<number> {
        try {
            const index = this.count++
            let result = this.queryExecutor('update', query, params, index)
            if (result === undefined || result === null) {
                result = 0
            }
            if (typeof result !== 'number') {
                throw new Error('Invalid test case result for an update with index ' + index + '. Your mock function provided to the MockQueryRunner must returns null, undefined or a number')
            }
            return this.promise.resolve(result)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeUpdateReturningOneRow(query: string, params: any[] = []): Promise<any> {
        try {
            const index = this.count++
            const result = this.queryExecutor('updateReturningOneRow', query, params, index)
            if (!isPlainObjectOrNoValue(result)) {
                throw new Error('Invalid test case result for a updateReturningOneRow with index ' + index + '. Your mock function provided to the MockQueryRunner must returns null, undefined or a plain object')
            }
            return this.promise.resolve(result)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeUpdateReturningManyRows(query: string, params: any[] = []): Promise<any[]> {
        try {
            const index = this.count++
            let result = this.queryExecutor('updateReturningManyRows', query, params, index)
            if (result === undefined || result === null) {
                result = []
            }
            if (!Array.isArray(result)) {
                throw new Error('Invalid test case result for a updateReturningManyRows with index ' + index + '. Your mock function provided to the MockQueryRunner must returns null, undefined or an Array of plain object')
            }
            for (let i = 0; i < result.length; i++) {
                if (!isPlainObject(result[i])) {
                    throw new Error('Invalid test case result for a updateReturningManyRows with index ' + index + '. The returned array by the mock function provided to the MockQueryRunner contains a no plain object at position ' + i)
                }
            }
            return this.promise.resolve(result)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeUpdateReturningOneColumnOneRow(query: string, params: any[] = []): Promise<any> {
        // undefined result means no value returned by the database
        try {
            return this.promise.resolve(this.queryExecutor('updateReturningOneColumnOneRow', query, params, this.count++))
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeUpdateReturningOneColumnManyRows(query: string, params: any[] = []): Promise<any[]> {
        try {
            const index = this.count++
            let result = this.queryExecutor('updateReturningOneColumnManyRows', query, params, index)
            if (result === undefined || result === null) {
                result = []
            }
            if (!Array.isArray(result)) {
                throw new Error('Invalid test case result for a updateReturningOneColumnManyRows with index ' + index + '. Your mock function provided to the MockQueryRunner must returns null, undefined or an Array')
            }
            return this.promise.resolve(result)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeDelete(query: string, params: any[] = []): Promise<number> {
        try {
            const index = this.count++
            let result = this.queryExecutor('delete', query, params, index)
            if (result === undefined || result === null) {
                result = 0
            }
            if (typeof result !== 'number') {
                throw new Error('Invalid test case result for a delete with index ' + index + '. Your mock function provided to the MockQueryRunner must returns null, undefined or a number')
            }
            return this.promise.resolve(result)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeDeleteReturningOneRow(query: string, params: any[] = []): Promise<any> {
        try {
            const index = this.count++
            const result = this.queryExecutor('deleteReturningOneRow', query, params, index)
            if (!isPlainObjectOrNoValue(result)) {
                throw new Error('Invalid test case result for a deleteReturningOneRow with index ' + index + '. Your mock function provided to the MockQueryRunner must returns null, undefined or a plain object')
            }
            return this.promise.resolve(result)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeDeleteReturningManyRows(query: string, params: any[] = []): Promise<any[]> {
        try {
            const index = this.count++
            let result = this.queryExecutor('deleteReturningManyRows', query, params, index)
            if (result === undefined || result === null) {
                result = []
            }
            if (!Array.isArray(result)) {
                throw new Error('Invalid test case result for a deleteReturningManyRows with index ' + index + '. Your mock function provided to the MockQueryRunner must returns null, undefined or an Array of plain object')
            }
            for (let i = 0; i < result.length; i++) {
                if (!isPlainObject(result[i])) {
                    throw new Error('Invalid test case result for a deleteReturningManyRows with index ' + index + '. The returned array by the mock function provided to the MockQueryRunner contains a no plain object at position ' + i)
                }
            }
            return this.promise.resolve(result)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeDeleteReturningOneColumnOneRow(query: string, params: any[] = []): Promise<any> {
        // undefined result means no value returned by the database
        try {
            return this.promise.resolve(this.queryExecutor('deleteReturningOneColumnOneRow', query, params, this.count++))
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeDeleteReturningOneColumnManyRows(query: string, params: any[] = []): Promise<any[]> {
        try {
            const index = this.count++
            let result = this.queryExecutor('deleteReturningOneColumnManyRows', query, params, index)
            if (result === undefined || result === null) {
                result = []
            }
            if (!Array.isArray(result)) {
                throw new Error('Invalid test case result for a deleteReturningOneColumnManyRows with index ' + index + '. Your mock function provided to the MockQueryRunner must returns null, undefined or an Array')
            }
            return this.promise.resolve(result)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeProcedure(query: string, params: any[] = []): Promise<void> {
        try {
            const index = this.count++
            const result = this.queryExecutor('executeProcedure', query, params, index)
            if (result !== undefined && result !== null) {
                throw new Error('Invalid test case result for an executeProcedure with index ' + index + '. Your mock function provided to the MockQueryRunner must returns null or undefined')
            }
            return this.promise.resolve(undefined)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeFunction(query: string, params: any[] = []): Promise<any> {
        try {
            return this.promise.resolve(this.queryExecutor('executeFunction', query, params, this.count++))
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeBeginTransaction(opts: BeginTransactionOpts = []): Promise<void> {
        try {
            const index = this.count++
            const result = this.queryExecutor('beginTransaction', 'begin transaction', opts, index)
            if (result !== undefined && result !== null) {
                throw new Error('Invalid test case result for a beginTransaction with index ' + index + '. Your mock function provided to the MockQueryRunner must returns null or undefined')
            }
            return this.promise.resolve(undefined)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeCommit(opts: CommitOpts = []): Promise<void> {
        try {
            const index = this.count++
            const result = this.queryExecutor('commit', 'commit', opts, index)
            if (result !== undefined && result !== null) {
                throw new Error('Invalid test case result for a commit with index ' + index + '. Your mock function provided to the MockQueryRunner must returns null or undefined')
            }
            return this.promise.resolve(undefined)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeRollback(opts: RollbackOpts = []): Promise<void> {
        try {
            const index = this.count++
            const result = this.queryExecutor('rollback', 'rollback', opts || [], index)
            if (result !== undefined && result !== null) {
                throw new Error('Invalid test case result for a commit with index ' + index + '. Your mock function provided to the MockQueryRunner must returns null or undefined')
            }
            return this.promise.resolve(undefined)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    isTransactionActive(): boolean {
        const index = this.count++
        let result = this.queryExecutor('isTransactionActive', '', [], index)
        if (result !== undefined && result !== null) {
            result = false
        }
        if (typeof result !== 'boolean') {
            throw new Error('Invalid test case result for an isTransactionActive with index ' + index + '. Your mock function provided to the MockQueryRunner must returns null, undefined, or a boolean')
        }
        return result
    }
    executeDatabaseSchemaModification(query: string, params: any[] = []): Promise<void> {
        try {
            const index = this.count++
            const result = this.queryExecutor('executeDatabaseSchemaModification', query, params, index)
            if (result !== undefined && result !== null) {
                throw new Error('Invalid test case result for a executeDatabaseSchemaModification with index ' + index + '. Your mock function provided to the MockQueryRunner must returns null or undefined')
            }
            return this.promise.resolve(undefined)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    executeConnectionConfiguration(query: string, params: any[] = []): Promise<void> {
        try {
            const index = this.count++
            const result = this.queryExecutor('executeConnectionConfiguration', query, params, index)
            if (result !== undefined && result !== null) {
                throw new Error('Invalid test case result for a executeConnectionConfiguration with index ' + index + '. Your mock function provided to the MockQueryRunner must returns null or undefined')
            }
            return this.promise.resolve(undefined)
        } catch (e) {
            return this.promise.reject(e)
        }
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
        if (this.database !== 'oracle') {
            throw new Error('Unsupported output parameters')
        }
        const index = params.length
        if (name) {
            params.push({dir: 3003 /*oracledb.BIND_OUT*/, as: name}) // See https://github.com/oracle/node-oracledb/blob/master/lib/oracledb.js
        } else {
            params.push({dir: 3003 /*oracledb.BIND_OUT*/}) // See https://github.com/oracle/node-oracledb/blob/master/lib/oracledb.js
        }
        return ':' + index
    }

    executeInTransaction<T>(fn: () => Promise<T>, outermostQueryRunner: QueryRunner, opts: BeginTransactionOpts = []): Promise<T> {
        return outermostQueryRunner.executeBeginTransaction(opts).then(() => {
            let result = fn()
            return result.then((r) => {
                return outermostQueryRunner.executeCommit(opts as any).then(() => {
                    return r
                })
            }, (e) => {
                return outermostQueryRunner.executeRollback(opts as any).then(() => {
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
    createRejectedPromise<RESULT = any>(error: any): Promise<RESULT> {
        return this.promise.reject(error)
    }

    isMocked(): boolean {
        return true
    }
    lowLevelTransactionManagementSupported(): boolean {
        return true
    }
    nestedTransactionsSupported(): boolean {
        return true
    }
}

function isPlainObject(value: any): boolean {
	if (!value && typeof value !== 'object') {
		return false
	}

	const prototype = Object.getPrototypeOf(value)
	return prototype === null || prototype === Object.prototype
}

function isPlainObjectOrNoValue(value: any): boolean {
    if (value === null || value === undefined) {
        return true
    }

	if (typeof value !== 'object') {
		return false
	}

	const prototype = Object.getPrototypeOf(value)
	return prototype === null || prototype === Object.prototype
}
