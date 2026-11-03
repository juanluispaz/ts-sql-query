import type { DatabaseType, PromiseProvider } from './QueryRunner.js'
import type { Database } from '@sqlite.org/sqlite-wasm'
import { SqlTransactionQueryRunner } from './SqlTransactionQueryRunner.js'
import { TsSqlError, TsSqlProcessingError, type TsSqlErrorReason } from '../TsSqlError.js'
import { getSqlite3WasmOO1ErrorReason, isSqlite3WasmOO1Error } from './connectorErrorMappers/Sqlite3WasmOO1ErrorMapper.js'

export interface Sqlite3WasmOO1QueryRunnerConfig {
    promise?: PromiseProvider | undefined
}

export class Sqlite3WasmOO1QueryRunner extends SqlTransactionQueryRunner {
    readonly database: DatabaseType
    readonly connection: Database
    readonly promise: PromiseProvider

    constructor(connection: Database, config?: Sqlite3WasmOO1QueryRunnerConfig) {
        super()
        this.connection = connection
        this.database = 'sqlite'
        this.promise = config?.promise || Promise
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
        const rejected = this.rejectWhenRolledBackByTheDatabase()
        if (rejected) {
            return rejected
        }
        try {
            const rows = this.connection.selectObjects(query, params)
            return this.promise.resolve(rows)
        } catch (e) {
            return this.statementOfTheTransactionFailed(e)
        }
    }
    protected executeMutation(query: string, params: any[]): Promise<number> {
        const rejected = this.rejectWhenRolledBackByTheDatabase()
        if (rejected) {
            return rejected
        }
        try {
            this.connection.exec({sql: query, bind: params})
            return this.promise.resolve(this.connection.changes())
        } catch (e) {
            return this.statementOfTheTransactionFailed(e)
        }
    }
    override executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
        if (this.containsInsertReturningClause(query, params)) {
            return super.executeInsertReturningLastInsertedId(query, params)
        }

        const rejected = this.rejectWhenRolledBackByTheDatabase()
        if (rejected) {
            return rejected
        }
        try {
            this.connection.exec({sql: query, bind: params})
            // A suppressed `on conflict do nothing` inserts no row; `last_insert_rowid()`
            // then still holds the previous statement's id, so fall back to null (the
            // same absence the RETURNING path reports) when nothing was inserted.
            if (this.connection.changes() === 0) {
                return this.promise.resolve(null)
            }
            const id = this.connection.selectValue('select last_insert_rowid()')
            return this.promise.resolve(id)
        } catch (e) {
            return this.statementOfTheTransactionFailed(e)
        }
    }
    /**
     * The database object doesn't tell whether SQLite left autocommit mode; SQLite only begins a transaction outside
     * another one: when the begin succeeds, there was no transaction, and the one begun is rolled back at once
     */
    protected override isTransactionOpenInTheDatabase(): boolean | undefined {
        try {
            this.connection.exec('begin')
        } catch {
            return undefined
        }
        this.connection.exec('rollback')
        return false
    }
    addParam(params: any[], value: any): string {
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
