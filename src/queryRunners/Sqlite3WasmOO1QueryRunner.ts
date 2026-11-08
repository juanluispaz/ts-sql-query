import type { BeginTransactionOpts, DatabaseType, PromiseProvider } from './QueryRunner.js'
import type { Database } from '@sqlite.org/sqlite-wasm'
import { SqlTransactionQueryRunner } from './SqlTransactionQueryRunner.js'
import { TsSqlError, TsSqlProcessingError, type TsSqlErrorReason } from '../TsSqlError.js'
import { getSqlite3WasmOO1ErrorReason, isSqlite3WasmOO1Error } from './connectorErrorMappers/Sqlite3WasmOO1ErrorMapper.js'
import type { TypeCategory } from '../TypeAdapter.js'
import { setQueryParamType } from './QueryRunner.js'

export interface Sqlite3WasmOO1QueryRunnerConfig {
    promise?: PromiseProvider | undefined
    /** The connection is in a transaction that something else began, and that something else ends: none begins on it */
    forUseInTransaction?: boolean | undefined
}

export class Sqlite3WasmOO1QueryRunner extends SqlTransactionQueryRunner {
    readonly database: DatabaseType
    readonly connection: Database
    readonly promise: PromiseProvider
    private config?: Sqlite3WasmOO1QueryRunnerConfig | undefined

    constructor(connection: Database, config?: Sqlite3WasmOO1QueryRunnerConfig) {
        super()
        this.connection = connection
        this.database = 'sqlite'
        this.promise = config?.promise || Promise
        this.config = config
    }

    useDatabase(database: DatabaseType): void {
        if (database !== 'sqlite') {
            throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_DATABASE', database }, 'Unsupported database: ' + database + '. Sqlite3WasmOO1QueryRunner only supports sqlite databases')
        }
    }

    getNativeRunner(): Database {
        return this.connection
    }

    getCurrentNativeConnection(): Database | undefined {
        return this.isTransactionActive() ? this.connection : undefined
    }

    execute<RESULT>(fn: (connection: unknown) => Promise<RESULT>): Promise<RESULT> {
        return fn(this.connection)
    }

    protected executeQueryReturning(query: string, params: any[]): Promise<any[]> {
        try {
            const rows = this.connection.selectObjects(query, params)
            return this.promise.resolve(rows)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    protected executeMutation(query: string, params: any[]): Promise<number> {
        try {
            this.connection.exec({sql: query, bind: params})
            return this.promise.resolve(this.connection.changes())
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    override executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
        if (this.containsInsertReturningClause(query, params)) {
            return super.executeInsertReturningLastInsertedId(query, params)
        }

        try {
            this.connection.exec({sql: query, bind: params})
            // A suppressed `on conflict do nothing` inserts no row; `last_insert_rowid()`
            // then still holds the previous statement's id, so fall back to null (the
            // same absence the RETURNING path reports) when nothing was inserted.
            if (this.connection.changes() === 0) {
                return this.promise.resolve(null)
            }
            // An insert without returning: the library builds one only for a compatibilityVersion below SQLite 3.35
            // (older than any build of sqlite-wasm), or the caller hands one to the query runner. The Database gives
            // the id of the inserted row no other way (sqlite3_last_insert_rowid lives on the module, which it doesn't
            // reach), and the engine runs in the same thread, so this query adds no round trip to a server
            const id = this.connection.selectValue('select last_insert_rowid()')
            return this.promise.resolve(id)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    override executeBeginTransaction(opts?: BeginTransactionOpts): Promise<void> {
        if (this.config?.forUseInTransaction) {
            return this.rejectBeginInsideAManagedTransaction()
        }
        return super.executeBeginTransaction(opts)
    }
    addParam(params: any[], value: any, type: string, typeCategory: TypeCategory, forceTypeCast: boolean): string {
        setQueryParamType(params, params.length, type, typeCategory, forceTypeCast)
        if (typeof value === 'boolean') {
            params.push(Number(value))
        } else {
            params.push(value)
        }
        return '?' + params.length
    }    
    override createResolvedPromise<RESULT>(result: RESULT | PromiseLike<RESULT>): Promise<RESULT> {
        return this.promise.resolve(result) 
    }
    override createRejectedPromise<RESULT = any>(error: any): Promise<RESULT> {
        return this.promise.reject(error)
    }
    override getErrorReason(error: unknown): TsSqlErrorReason {
        return Sqlite3WasmOO1QueryRunner.getErrorReason(error)
    }
    override isSqlError(error: unknown): boolean {
        return Sqlite3WasmOO1QueryRunner.isSqlError(error)
    }

    static getErrorReason(error: unknown): TsSqlErrorReason {
        if (error instanceof TsSqlError) {
            return error.errorReason
        }
        return getSqlite3WasmOO1ErrorReason(error)
    }

    static isSqlError(error: unknown): boolean {
        return error instanceof TsSqlError || isSqlite3WasmOO1Error(error)
    }
}
