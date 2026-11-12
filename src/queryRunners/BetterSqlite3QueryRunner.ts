import type { BeginTransactionOpts, DatabaseType, PromiseProvider } from './QueryRunner.js'
import type { Database } from 'better-sqlite3'
import { SqlTransactionQueryRunner } from './SqlTransactionQueryRunner.js'
import { TsSqlError, TsSqlProcessingError, type TsSqlErrorReason } from "../TsSqlError.js"
import { getBetterSqlite3ErrorReason, isBetterSqlite3Error } from './connectorErrorMappers/BetterSqlite3ErrorMapper.js'
import type { TypeCategory } from '../TypeAdapter.js'
import { queryRunnerParamBindings } from '../utils/queryRunnerParams.js'
import { sqliteFunctionListQuery, sqliteFunctionsToRegister } from '../utils/sqlite/sqliteFunctions.js'
import type { SqliteFunctionsOptions } from '../connections/SqliteConfiguration.js'
import { sqliteDriverParams } from '../utils/sqlite/sqliteParamTypes.js'

export interface BetterSqlite3QueryRunnerConfig {
    promise?: PromiseProvider
    /** The connection is in a transaction that something else began, and that something else ends: none begins on it */
    forUseInTransaction?: boolean | undefined
}

export class BetterSqlite3QueryRunner extends SqlTransactionQueryRunner {
    readonly database: DatabaseType
    readonly connection: Database
    readonly promise: PromiseProvider
    private config?: BetterSqlite3QueryRunnerConfig | undefined

    constructor(connection: Database, config?: BetterSqlite3QueryRunnerConfig) {
        super()
        this.connection = connection
        this.database = 'sqlite'
        this.promise = config?.promise || Promise
        this.config = config
    }

    useDatabase(database: DatabaseType): void {
        if (database !== 'sqlite') {
            throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_DATABASE', database }, 'Unsupported database: ' + database + '. BetterSqlite3QueryRunner only supports sqlite databases')
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
            const rows = this.connection.prepare(query).all(this.bindParams(params))
            return this.promise.resolve(rows)
        } catch (e) {
            return this.statementOfTheTransactionFailed(e)
        }
    }
    override executeDatabaseSchemaModification(query: string, params: any[] = []): Promise<void> {
        // A script of several statements, without params, runs whole with exec: a prepared statement rejects more than one
        if (params.length > 0) {
            return super.executeDatabaseSchemaModification(query, params)
        }
        const rejected = this.rejectWhenRolledBackByTheDatabase()
        if (rejected) {
            return rejected
        }
        try {
            this.connection.exec(query)
            return this.promise.resolve(undefined)
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
            return this.promise.resolve(this.connection.prepare(query).run(this.bindParams(params)).changes)
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
            const result = this.connection.prepare(query).run(this.bindParams(params))
            // A suppressed `on conflict do nothing` inserts no row; `lastInsertRowid`
            // then still holds the previous statement's id, so fall back to null (the
            // same absence the RETURNING path reports) when nothing was inserted.
            return this.promise.resolve(result.changes === 0 ? null : result.lastInsertRowid)
        } catch (e) {
            return this.statementOfTheTransactionFailed(e)
        }
    }
    /** SQLite leaves autocommit mode while a transaction is open */
    protected override isTransactionOpenInTheDatabase(_error: unknown): boolean {
        return this.connection.inTransaction
    }
    override executeBeginTransaction(opts?: BeginTransactionOpts): Promise<void> {
        if (this.config?.forUseInTransaction) {
            return this.rejectBeginInsideAManagedTransaction()
        }
        return super.executeBeginTransaction(opts)
    }
    addParam(params: any[], value: any, type: string, typeCategory: TypeCategory, forceTypeCast: boolean): string {
        // The same binding MockQueryRunner uses to imitate this query runner
        return queryRunnerParamBindings.BetterSqlite3QueryRunner(params, value, type, typeCategory, forceTypeCast)
    }
    /**
     * The params as better-sqlite3 binds them: an array binds only the anonymous `?` parameters, so the numbered `?NNN`
     * placeholders this runner emits are bound from an object keyed by their number; a boolean goes as 1 or 0.
     */
    protected bindParams(params: any[]): Record<number, any> {
        const driverParams = sqliteDriverParams(params)
        const result: Record<number, any> = {}
        for (let i = 0, length = driverParams.length; i < length; i++) {
            result[i + 1] = driverParams[i]
        }
        return result
    }
    override createResolvedPromise<RESULT>(result: RESULT | PromiseLike<RESULT>): Promise<RESULT> {
        return this.promise.resolve(result)
    }
    override createRejectedPromise<RESULT = any>(error: any): Promise<RESULT> {
        return this.promise.reject(error)
    }
    override getErrorReason(error: unknown): TsSqlErrorReason {
        return BetterSqlite3QueryRunner.getErrorReason(error)
    }
    override isSqlError(error: unknown): boolean {
        return BetterSqlite3QueryRunner.isSqlError(error)
    }

    static getErrorReason(error: unknown): TsSqlErrorReason {
        if (error instanceof TsSqlError) {
            return error.errorReason
        }
        return getBetterSqlite3ErrorReason(error)
    }

    static isSqlError(error: unknown): boolean {
        return error instanceof TsSqlError || isBetterSqlite3Error(error)
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
 */
export function registerSqliteFunctions(db: Database, options?: SqliteFunctionsOptions): void {
    const toRegister = sqliteFunctionsToRegister(() => db.prepare(sqliteFunctionListQuery).all(), options)
    for (const sqlFunction of toRegister.scalar) {
        const fn = sqlFunction.fn
        // better-sqlite3 gives a blob back from a Buffer, and takes the number of arguments from the length of the function
        const wrapped = (...args: unknown[]) => {
            const result = fn(...args)
            return result instanceof Uint8Array && !Buffer.isBuffer(result) ? Buffer.from(result.buffer, result.byteOffset, result.byteLength) : result
        }
        Object.defineProperty(wrapped, 'length', { value: sqlFunction.arity })
        db.function(sqlFunction.name, { deterministic: sqlFunction.deterministic }, wrapped)
    }
    for (const sqlFunction of toRegister.aggregate) {
        const inverse = sqlFunction.inverse
        db.aggregate<any>(sqlFunction.name, {
            deterministic: true,
            start: null,
            step: sqlFunction.step,
            ...(inverse ? { inverse: inverse } : {}),
            result: sqlFunction.result,
        })
    }
}
