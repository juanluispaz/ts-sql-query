import type { BeginTransactionOpts, DatabaseType, PromiseProvider } from './QueryRunner.js'
import type { Database, Sqlite3Static, SqlValue } from '@sqlite.org/sqlite-wasm'
import { SqlTransactionQueryRunner } from './SqlTransactionQueryRunner.js'
import { TsSqlError, TsSqlProcessingError, type TsSqlErrorReason } from '../TsSqlError.js'
import { getSqlite3WasmOO1ErrorReason, isSqlite3WasmOO1Error } from './connectorErrorMappers/Sqlite3WasmOO1ErrorMapper.js'
import { queryRunnerParamBindings } from '../utils/queryRunnerParams.js'
import { sqliteFunctionListQuery, sqliteFunctionsToRegister } from '../utils/sqlite/sqliteFunctions.js'
import type { SqliteFunctionsOptions } from '../connections/SqliteConfiguration.js'
import { sqliteDriverParams } from '../utils/sqlite/sqliteParamTypes.js'

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
            const rows = this.connection.selectObjects(query, sqliteDriverParams(params))
            return this.promise.resolve(rows)
        } catch (e) {
            return this.promise.reject(e)
        }
    }
    protected executeMutation(query: string, params: any[]): Promise<number> {
        try {
            this.connection.exec({sql: query, bind: sqliteDriverParams(params)})
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
            this.connection.exec({sql: query, bind: sqliteDriverParams(params)})
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
    addParam(params: any[], value: any): string {
        // The same binding MockQueryRunner uses to imitate this query runner
        return queryRunnerParamBindings.Sqlite3WasmOO1QueryRunner(params, value)
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

/**
 * Registers on the database the SQL functions the library may write on SQLite, so they are always available: the
 * functions of SQLite's decimal extension and the library's own ones (tsq_) the decimal strategies of
 * SqliteConnection write, uuid, uuid_str and uuid_blob for the uuid strategy 'uuid-extension' (uuid() generates a
 * version 7 UUID), and ci_replace (for replaceAllInsensitiveFunction = 'ci_replace'). Every function but uuid() is
 * registered as deterministic, so it can be used in an index on an expression. A decimal function or a ci_replace the
 * database already has with the same name and number of arguments (a loaded extension, like SQLite's decimal
 * extension, or one you registered before) is left as it is: the call reads the functions of the database (pragma
 * function_list) once, before registering. The uuid functions are always registered, replacing the ones the database
 * has (the uuid extension some platforms ship generates version 4 UUIDs). options.skip names functions not to register,
 * also to keep the uuid functions the database has.
 *
 * The functions are also marked innocuous (they have no side effects), so a database with trusted_schema off still
 * uses them in its schema. sqlite3 is the module the database was created with: an aggregate keeps its state in the
 * aggregate context of SQLite.
 */
export function registerSqliteFunctions(db: Database, sqlite3: Sqlite3Static, options?: SqliteFunctionsOptions): void {
    const toRegister = sqliteFunctionsToRegister(() => db.selectObjects(sqliteFunctionListQuery), options)
    for (const sqlFunction of toRegister.scalar) {
        const fn = sqlFunction.fn
        db.createFunction(sqlFunction.name, (_ctxPtr: number, ...args: SqlValue[]) => fn(...args) as SqlValue, {
            arity: sqlFunction.arity,
            deterministic: sqlFunction.deterministic,
            innocuous: sqlFunction.deterministic,
        })
    }
    for (const sqlFunction of toRegister.aggregate) {
        // The state of each aggregation, by the address of its aggregate context
        const states = new Map<number, unknown>()
        const stateKey = (ctxPtr: number, create: boolean) => Number(sqlite3.capi.sqlite3_js_aggregate_context(ctxPtr, create ? 1 : 0))
        const step = sqlFunction.step
        const inverse = sqlFunction.inverse
        const result = sqlFunction.result
        const options = {
            name: sqlFunction.name,
            arity: sqlFunction.arity,
            deterministic: true,
            innocuous: true,
            xStep: (ctxPtr: number, value: SqlValue) => {
                const key = stateKey(ctxPtr, true)
                states.set(key, step(states.get(key) ?? null, value))
            },
            xFinal: (ctxPtr: number): SqlValue => {
                // Without rows SQLite gives no aggregate context, and the state is null
                const key = stateKey(ctxPtr, false)
                const state = key ? states.get(key) ?? null : null
                states.delete(key)
                return result(state) as SqlValue
            },
        }
        if (inverse) {
            db.createFunction({
                ...options,
                xValue: (ctxPtr: number): SqlValue => {
                    const key = stateKey(ctxPtr, false)
                    return result(key ? states.get(key) ?? null : null) as SqlValue
                },
                xInverse: (ctxPtr: number, value: SqlValue) => {
                    const key = stateKey(ctxPtr, true)
                    states.set(key, inverse(states.get(key) ?? null, value))
                },
            })
        } else {
            db.createFunction(options)
        }
    }
}
