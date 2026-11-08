import type { BeginTransactionOpts, DatabaseType, PromiseProvider } from './QueryRunner.js'
import type { DatabaseSync } from 'node:sqlite'
import { SqlTransactionQueryRunner } from './SqlTransactionQueryRunner.js'
import { TsSqlError, TsSqlProcessingError, type TsSqlErrorReason } from '../TsSqlError.js'
import { getNodeSqliteErrorReason, isNodeSqliteError } from './connectorErrorMappers/NodeSqliteErrorMapper.js'
import type { TypeCategory } from '../TypeAdapter.js'
import { queryRunnerParamBindings } from '../utils/queryRunnerParams.js'
import { sqliteFunctionListQuery, sqliteFunctionsToRegister } from '../utils/sqliteFunctions.js'
import type { SqliteFunctionsOptions } from '../connections/SqliteConfiguration.js'

export interface NodeSqliteQueryRunnerConfig {
    promise?: PromiseProvider | undefined
    /** The connection is in a transaction that something else began, and that something else ends: none begins on it */
    forUseInTransaction?: boolean | undefined
}

export class NodeSqliteQueryRunner extends SqlTransactionQueryRunner {
    readonly database: DatabaseType
    readonly connection: DatabaseSync
    readonly promise: PromiseProvider
    private config?: NodeSqliteQueryRunnerConfig | undefined

    constructor(connection: DatabaseSync, config?: NodeSqliteQueryRunnerConfig) {
        super()
        this.connection = connection
        this.database = 'sqlite'
        this.promise = config?.promise || Promise
        this.config = config
    }

    useDatabase(database: DatabaseType): void {
        if (database !== 'sqlite') {
            throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_DATABASE', database }, 'Unsupported database: ' + database + '. NodeSqliteQueryRunner only supports sqlite databases')
        }
    }

    getNativeRunner(): DatabaseSync {
        return this.connection
    }

    getCurrentNativeConnection(): DatabaseSync | undefined {
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
            const rows = this.connection.prepare(query).all(...params)
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
            const changes = this.connection.prepare(query).run(...params).changes
            return this.promise.resolve(Number(changes))
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
            const result = this.connection.prepare(query).run(...params)
            // A suppressed `on conflict do nothing` inserts no row; `lastInsertRowid`
            // then still holds the previous statement's id, so fall back to null (the
            // same absence the RETURNING path reports) when nothing was inserted.
            return this.promise.resolve(Number(result.changes) === 0 ? null : result.lastInsertRowid)
        } catch (e) {
            return this.statementOfTheTransactionFailed(e)
        }
    }
    /** SQLite leaves autocommit mode while a transaction is open */
    protected override isTransactionOpenInTheDatabase(_error: unknown): boolean {
        return this.connection.isTransaction
    }
    override executeBeginTransaction(opts?: BeginTransactionOpts): Promise<void> {
        if (this.config?.forUseInTransaction) {
            return this.rejectBeginInsideAManagedTransaction()
        }
        return super.executeBeginTransaction(opts)
    }
    addParam(params: any[], value: any, type: string, typeCategory: TypeCategory, forceTypeCast: boolean): string {
        // The same binding MockQueryRunner uses to imitate this query runner
        return queryRunnerParamBindings.NodeSqliteQueryRunner(params, value, type, typeCategory, forceTypeCast)
    }
    override createResolvedPromise<RESULT>(result: RESULT | PromiseLike<RESULT>): Promise<RESULT> {
        return this.promise.resolve(result)
    }
    override createRejectedPromise<RESULT = any>(error: any): Promise<RESULT> {
        return this.promise.reject(error)
    }
    override getErrorReason(error: unknown): TsSqlErrorReason {
        return NodeSqliteQueryRunner.getErrorReason(error)
    }
    override isSqlError(error: unknown): boolean {
        return NodeSqliteQueryRunner.isSqlError(error)
    }

    static getErrorReason(error: unknown): TsSqlErrorReason {
        if (error instanceof TsSqlError) {
            return error.errorReason
        }
        return getNodeSqliteErrorReason(error)
    }

    static isSqlError(error: unknown): boolean {
        return error instanceof TsSqlError || isNodeSqliteError(error)
    }
}

/**
 * Registers on the database the SQL functions the library may write on SQLite, so they are always available: the
 * functions of SQLite's decimal extension and the library's own ones (tsq_) the decimal strategies of
 * SqliteConnection write, uuid, uuid_str and uuid_blob for the uuid strategy 'uuid-extension' (uuid() generates a
 * version 7 UUID), and ci_replace (for replaceAllInsensitiveFunction = 'ci_replace'). Every function but uuid() is
 * registered as deterministic, so it can be used in an index on an expression. A function the database already has with
 * the same name and number of arguments (a loaded extension, like SQLite's decimal or uuid extension, or one you
 * registered before) is left as it is: the call reads the functions of the database (pragma function_list) once,
 * before registering. options.skip names functions not to register.
 *
 * It needs the function and aggregate methods of node:sqlite (Node 22.16 or later, 24, 26).
 */
export function registerSqliteFunctions(db: DatabaseSync, options?: SqliteFunctionsOptions): void {
    if (typeof db.function !== 'function' || typeof db.aggregate !== 'function') {
        throw new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name: 'db', value: db }, 'registerSqliteFunctions needs the function and aggregate methods of node:sqlite, which this version of Node doesn\'t have')
    }
    const toRegister = sqliteFunctionsToRegister(() => db.prepare(sqliteFunctionListQuery).all(), options)
    for (const sqlFunction of toRegister.scalar) {
        db.function(sqlFunction.name, { deterministic: sqlFunction.deterministic }, sqlFunction.fn as (...args: any[]) => any)
    }
    for (const sqlFunction of toRegister.aggregate) {
        const inverse = sqlFunction.inverse
        db.aggregate<any>(sqlFunction.name, {
            deterministic: true,
            start: null,
            step: sqlFunction.step,
            ...(inverse ? { inverse: inverse } : {}),
            result: sqlFunction.result as (state: any) => any,
        })
    }
}
