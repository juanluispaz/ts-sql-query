import type { BeginTransactionOpts, CommitOpts, DatabaseType, ExecutableQueryType, PromiseProvider, QueryType, RollbackOpts } from './QueryRunner.js'
import { TsSqlError, TsSqlProcessingError } from '../TsSqlError.js'
import { AbstractQueryRunner } from './AbstractQueryRunner.js'
import { getQueryContext } from '../QueryContext.js'
import { databaseParamBinding, oracleOutParam, queryRunnerDatabases, queryRunnerParamBindings, type ParamBinding } from '../utils/queryRunnerParams.js'
import type { DataTypeClass } from '../TypeAdapter.js'
import type { DataTypeName } from '../typeSystem/dataTypeNames.js'

/**
 * The function of a MockQueryRunner: it receives each query, and each statement of a transaction, with its type, its
 * SQL, its params (the options of a statement of a transaction) and its index (0 for the first one), and returns what
 * the database would give for it, in the shape of its type (see MockQueryRunner); throwing is the database failing.
 */
export type MockQueryExecutor = (type: QueryType, query: string, params: any[], index: number) => any

/** The query runners of the library that talk to a database, by the name of their class */
export type QueryRunnerName =
    | 'BetterSqlite3QueryRunner' | 'BunSqliteQueryRunner' | 'NodeSqliteQueryRunner' | 'BunSqlSqliteQueryRunner' | 'Sqlite3WasmOO1QueryRunner'
    | 'PgQueryRunner' | 'PgPoolQueryRunner' | 'BunSqlPostgresQueryRunner' | 'PostgresQueryRunner' | 'PgLiteQueryRunner'
    | 'MySql2QueryRunner' | 'MySql2PoolQueryRunner' | 'BunSqlMySqlQueryRunner' | 'MariaDBQueryRunner' | 'MariaDBPoolQueryRunner'
    | 'MssqlPoolQueryRunner' | 'MssqlPoolPromiseQueryRunner'
    | 'OracleDBQueryRunner' | 'OracleDBPoolQueryRunner' | 'OracleDBPoolPromiseQueryRunner'

/**
 * The function of a MockQueryRunner that answers every query as a database without rows: no row, no rows, no row
 * changed, and a count of 0 for the count of a page. The one of a MockQueryRunner created without a function, and so
 * of `NoopQueryRunner`.
 */
export function noopQueryExecutor(type: QueryType, query: string, params: any[]): any {
    if (type === 'insert') {
        return 0
    }
    if (type === 'selectOneColumnOneRow' && getQueryContext(query, params).isSelectPageCount) {
        // The count of a page of no rows: the query can't find out by other means
        return 0
    }
    return undefined
}

/** The options of MockQueryRunner */
export interface MockQueryRunnerConfig {
    /** The database; with queryRunner, the default one of that query runner when omitted */
    database?: DatabaseType | undefined
    /**
     * The query runner of the library whose parameters the mock imitates: it adds each parameter as that query runner
     * does (the placeholder, the cast in it and the value sent), so your function receives the SQL and the params the
     * real query runner would send. Without it, the mock writes the placeholders of the database.
     */
    queryRunner?: QueryRunnerName | undefined
    /** The provider of the promises, like `SynchronousPromise`; the global `Promise` by default */
    promise?: PromiseProvider | undefined
    /** Whether a transaction can begin inside another one; true by default */
    allowNestedTransactions?: boolean | undefined
}

/**
 * A query runner that takes the place of the database in tests: each query, and each statement of a transaction, goes
 * to executeMockedQuery, which returns what the database would give. By default it calls the function given to the
 * constructor (queryExecutor), or, without one, noopQueryExecutor, which answers as a database without rows; a subclass
 * overrides executeMockedQuery to answer by itself. The value is checked against the
 * shape of its type of query, and one of another shape is rejected with `INVALID_MOCKED_VALUE`, with the type of the
 * query and its index:
 * - `selectOneRow` and the `...ReturningOneRow`: a plain object, or null or undefined without a row;
 * - `selectManyRows` and the `...ReturningManyRows`: an array of plain objects, null or undefined being no rows;
 * - `selectOneColumnManyRows`, the `...ReturningOneColumnManyRows` and `insertReturningMultipleLastInsertedId`: an
 *   array, null or undefined being no rows;
 * - `selectOneColumnOneRow`, the `...ReturningOneColumnOneRow`, `insertReturningLastInsertedId` and
 *   `executeFunction`: any value, undefined being no row;
 * - `insert`: a number, 1 when null or undefined; `update` and `delete`: a number, 0 when null or undefined;
 * - `executeProcedure`, `executeDatabaseSchemaModification`, `executeConnectionConfiguration`, `beginTransaction`,
 *   `commit` and `rollback`: null or undefined.
 *
 * Past that check, the value goes through what the result of a real database goes through: the type adapters, the
 * check of the mandatory columns (`MANDATORY_VALUE_NOT_RECEIVED_FROM_DATABASE` when a row the function gives lacks a
 * column the query requires), the aggregated arrays.
 *
 * The transactions begun and not ended are counted, so isTransactionActive and the checks of the connection work as on
 * a real database (`NOT_IN_TRANSACTION` on a commit outside one). An error is a SQL error (isSqlError) when it is a
 * `TsSqlError`; to treat another one as such, extend the class and override isSqlError.
 */
export class MockQueryRunner extends AbstractQueryRunner {
    /** The function that gives the result of each query by default: the one given, or noopQueryExecutor */
    readonly queryExecutor: MockQueryExecutor
    private count = 0
    private transactionDepth = 0
    private currentDatabase: DatabaseType
    private readonly allowNestedTransactions: boolean
    private readonly paramBinding: ParamBinding | undefined
    private readonly queryRunnerName: QueryRunnerName | undefined

    /** A mock that answers every query as a database without rows, unless a subclass overrides executeMockedQuery */
    constructor(config?: MockQueryRunnerConfig)
    /** A mock whose function gives the result of each query */
    constructor(queryExecutor: MockQueryExecutor, config?: MockQueryRunnerConfig)
    constructor(queryExecutorOrConfig?: MockQueryExecutor | MockQueryRunnerConfig, maybeConfig?: MockQueryRunnerConfig) {
        super()
        let config: MockQueryRunnerConfig
        if (typeof queryExecutorOrConfig === 'function') {
            this.queryExecutor = queryExecutorOrConfig
            config = maybeConfig || {}
        } else {
            this.queryExecutor = noopQueryExecutor
            config = queryExecutorOrConfig || {}
        }
        const queryRunner = config.queryRunner
        this.queryRunnerName = queryRunner
        if (queryRunner) {
            const binding = queryRunnerParamBindings[queryRunner]
            if (!binding) {
                throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_QUERY' }, 'Unknown query runner to imitate: ' + queryRunner)
            }
            const databases = queryRunnerDatabases[queryRunner]
            this.currentDatabase = config.database || databases[0]!
            if (!databases.includes(this.currentDatabase)) {
                throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_DATABASE', database: this.currentDatabase }, queryRunner + ' doesn\'t support the database ' + this.currentDatabase)
            }
            this.paramBinding = binding
        } else {
            this.currentDatabase = config.database || 'noopDB'
            // The placeholders of the database, found when a parameter is added: an unknown database fails there
            this.paramBinding = undefined
        }
        if (config.promise) {
            this.promise = config.promise
        }
        this.allowNestedTransactions = config.allowNestedTransactions ?? true
    }

    get database(): DatabaseType {
        return this.currentDatabase
    }

    /**
     * Sets the index of the next query back to 0, and forgets the transactions begun: for a mock used by several test
     * cases, each one with its own sequence of results
     */
    reset(): void {
        this.count = 0
        this.transactionDepth = 0
    }

    useDatabase(database: DatabaseType): void {
        if (this.queryRunnerName && !queryRunnerDatabases[this.queryRunnerName].includes(database)) {
            throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_DATABASE', database }, 'Unsupported database: ' + database + '. ' + this.queryRunnerName + ', which the mock imitates, doesn\'t support it')
        }
        this.currentDatabase = database
    }
    getNativeRunner(): unknown {
        return null
    }
    getCurrentNativeConnection(): unknown {
        return undefined
    }
    execute<RESULT>(fn: (connection: unknown) => Promise<RESULT>): Promise<RESULT> {
        return fn(null)
    }

    /**
     * What the database would give for the query, or the statement of a transaction (with its SQL, `begin transaction`,
     * `commit` or `rollback`, and its options as the params), with its index (0 for the first one); throwing is the
     * database failing. By default it calls queryExecutor; override it to answer in a subclass
     */
    protected executeMockedQuery(type: QueryType, query: string, params: any[], index: number): any {
        return this.queryExecutor(type, query, params, index)
    }

    executeQuery(queryType: ExecutableQueryType, query: string, params: any[]): Promise<any> {
        let result
        try {
            const index = this.count++
            result = checkedResult(queryType, this.executeMockedQuery(queryType, query, params, index), index)
        } catch (e) {
            return this.createRejectedPromise(e)
        }
        return this.createResolvedPromise(result)
    }
    executeBeginTransaction(opts: BeginTransactionOpts = []): Promise<void> {
        try {
            const index = this.count++
            checkedResult('beginTransaction', this.executeMockedQuery('beginTransaction', 'begin transaction', opts, index), index)
        } catch (e) {
            return this.createRejectedPromise(e)
        }
        this.transactionDepth++
        return this.createResolvedPromise(undefined)
    }
    executeCommit(opts: CommitOpts = []): Promise<void> {
        try {
            const index = this.count++
            checkedResult('commit', this.executeMockedQuery('commit', 'commit', opts, index), index)
        } catch (e) {
            return this.createRejectedPromise(e)
        }
        if (this.transactionDepth > 0) {
            this.transactionDepth--
        }
        return this.createResolvedPromise(undefined)
    }
    executeRollback(opts: RollbackOpts = []): Promise<void> {
        try {
            const index = this.count++
            checkedResult('rollback', this.executeMockedQuery('rollback', 'rollback', opts, index), index)
        } catch (e) {
            return this.createRejectedPromise(e)
        }
        if (this.transactionDepth > 0) {
            this.transactionDepth--
        }
        return this.createResolvedPromise(undefined)
    }
    isTransactionActive(): boolean {
        return this.transactionDepth > 0
    }

    /** Adds the parameter as the query runner imitated (queryRunner) does, or with the placeholders of the database */
    addParam(params: any[], value: any, type: DataTypeName | DataTypeClass | undefined): string {
        const paramBinding = this.paramBinding
        if (paramBinding) {
            return paramBinding(params, value, type)
        }
        return databaseParamBinding(this.currentDatabase)(params, value, type)
    }
    /** An out parameter, as oracledb receives it: only on Oracle */
    override addOutParam(params: any[], name: string, type: DataTypeName | DataTypeClass | undefined): string {
        if (this.currentDatabase !== 'oracle') {
            return super.addOutParam(params, name, type)
        }
        return oracleOutParam(params, name, type)
    }

    override get isMocked(): boolean {
        return true
    }
    override get nestedTransactionsSupported(): boolean {
        return this.allowNestedTransactions
    }
    /** A `TsSqlError`: what a real database gives is recognised by its query runner; an error of the application isn't */
    override isSqlError(error: unknown): boolean {
        return error instanceof TsSqlError
    }
}

/** The value the function gave, checked against the shape of its type of query, with null or undefined as its default */
function checkedResult(queryType: QueryType, result: any, index: number): any {
    switch (queryType) {
        case 'selectOneRow':
        case 'insertReturningOneRow':
        case 'updateReturningOneRow':
        case 'deleteReturningOneRow':
            if (!isPlainObjectOrNoValue(result)) {
                throw invalidResult(queryType, result, index, 'null, undefined or a plain object')
            }
            return result
        case 'selectManyRows':
        case 'insertReturningManyRows':
        case 'updateReturningManyRows':
        case 'deleteReturningManyRows':
            if (result === undefined || result === null) {
                return []
            }
            if (!Array.isArray(result)) {
                throw invalidResult(queryType, result, index, 'null, undefined or an array of plain objects')
            }
            for (let i = 0, length = result.length; i < length; i++) {
                if (!isPlainObject(result[i])) {
                    throw invalidResult(queryType, result, index, 'null, undefined or an array of plain objects, and the array has something else at the position ' + i)
                }
            }
            return result
        case 'selectOneColumnManyRows':
        case 'insertReturningMultipleLastInsertedId':
        case 'insertReturningOneColumnManyRows':
        case 'updateReturningOneColumnManyRows':
        case 'deleteReturningOneColumnManyRows':
            if (result === undefined || result === null) {
                return []
            }
            if (!Array.isArray(result)) {
                throw invalidResult(queryType, result, index, 'null, undefined or an array')
            }
            return result
        case 'selectOneColumnOneRow':
        case 'insertReturningLastInsertedId':
        case 'insertReturningOneColumnOneRow':
        case 'updateReturningOneColumnOneRow':
        case 'deleteReturningOneColumnOneRow':
        case 'executeFunction':
            // undefined is no row
            return result
        case 'insert':
        case 'update':
        case 'delete':
            if (result === undefined || result === null) {
                // An insert without a result inserted its row
                return queryType === 'insert' ? 1 : 0
            }
            if (typeof result !== 'number') {
                throw invalidResult(queryType, result, index, 'null, undefined or a number')
            }
            return result
        default:
            // executeProcedure, executeDatabaseSchemaModification, executeConnectionConfiguration and the statements of a transaction
            if (result !== undefined && result !== null) {
                throw invalidResult(queryType, result, index, 'null or undefined')
            }
            return undefined
    }
}

/** The error of a value of the function of the mock that hasn't the shape its type of query asks for */
function invalidResult(queryType: QueryType, value: any, index: number, expected: string): TsSqlProcessingError {
    return new TsSqlProcessingError({ reason: 'INVALID_MOCKED_VALUE', value, index, queryType }, 'Invalid result of the mock for the query ' + queryType + ' with index ' + index + ': the function of the MockQueryRunner must return ' + expected)
}

/** Whether the value is a plain object, like a row: an object whose prototype is Object.prototype or null */
function isPlainObject(value: any): boolean {
    if (!value || typeof value !== 'object') {
        return false
    }
    const prototype = Object.getPrototypeOf(value)
    return prototype === null || prototype === Object.prototype
}

/** Whether the value is a plain object, null or undefined: what a query of one row may give */
function isPlainObjectOrNoValue(value: any): boolean {
    if (value === null || value === undefined) {
        return true
    }
    return isPlainObject(value)
}
