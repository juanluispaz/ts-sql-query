import { TsSqlError, TsSqlProcessingError, type TsSqlErrorReason } from '../TsSqlError.js'
import { AbstractQueryRunner } from './AbstractQueryRunner.js'
import type { BeginTransactionOpts, CommitOpts, DatabaseType, QueryRunner, RollbackOpts } from './QueryRunner.js'
import { getPrismaErrorReason, isPrismaError } from './connectorErrorMappers/PrismaErrorMapper.js'

interface RawPrismaClient {
    $executeRawUnsafe<_T = any>(query: string, ...values: any[]): Promise<number>
    $queryRawUnsafe<T = any>(query: string, ...values: any[]): Promise<T>;
    $transaction(arg: any, options?: any): Promise<any>
}

export interface PrismaConfig {
    interactiveTransactionsOptions?: { maxWait?: number, timeout?: number } | undefined,
    forUseInTransaction?: boolean | undefined
}

// Prisma surfaces a Prisma-specific error model (`Pxxxx`, `meta`, `message`) instead of
// consistently exposing the native database/driver error. Recent Prisma versions improve
// driver integration, but this experimental runner intentionally maps only Prisma's public
// error surface and uses raw-message heuristics as a best-effort fallback.
export class PrismaQueryRunner extends AbstractQueryRunner {
    readonly database: DatabaseType;
    readonly connection: RawPrismaClient
    private transaction?: RawPrismaClient | undefined
    readonly config?: PrismaConfig | undefined

    constructor(connection: RawPrismaClient, config?: PrismaConfig) {
        super()
        this.config = config
        this.connection = connection
        let activeProvider = (connection as any)._activeProvider
        switch (activeProvider) {
            case 'postgresql':
                this.database = 'postgreSql';
                break
            case 'mysql':
                this.database = 'mySql'
                break
            case 'sqlite':
                this.database = 'sqlite'
                break
            case 'sqlserver':
                this.database = 'sqlServer'
                break
            default:
                throw new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name: 'activeProvider', value: activeProvider }, 'Unknown Prisma provider of name ' + activeProvider)
        }
        if (config?.forUseInTransaction) {
            this.transaction = connection
        }
    }
    useDatabase(database: DatabaseType): void {
        if (database !== this.database) {
            if (this.database === 'mySql' && database === 'mariaDB') {
                // @ts-ignore
                this.database = database
            } else if (this.database === 'mariaDB' && database === 'mySql') {
                // @ts-ignore
                this.database = database
            } else if (this.database === 'mySql' || this.database === 'mariaDB') {
                throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_DATABASE', database }, 'Unsupported database: ' + database + '. The current connection used in PrismaQueryRunner only supports mySql or mariaDB databases')
            } else {
                throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_DATABASE', database }, 'Unsupported database: ' + database + '. The current connection used in PrismaQueryRunner only supports ' + this.database + ' databases')
            }
        }
    }
    getNativeRunner(): RawPrismaClient {
        return this.connection
    }
    getCurrentNativeTransaction(): RawPrismaClient | undefined {
        return this.transaction
    }
    execute<RESULT>(fn: (connection: unknown, transaction?: unknown) => Promise<RESULT>): Promise<RESULT> {
        return fn(this.connection, this.transaction)
    }
    protected executeQueryReturning(query: string, params: any[]): Promise<any[]> {
        const connection = this.transaction || this.connection
        const result = connection.$queryRawUnsafe<any[]>(query, ...params)
        return this.wrapPrismaPromise(result)
    }
    protected executeMutation(query: string, params: any[]): Promise<number> {
        const connection = this.transaction || this.connection
        const result = connection.$executeRawUnsafe<any[]>(query, ...params)
        return this.wrapPrismaPromise(result)
    }
    override executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
        if (this.database === 'mySql' || this.database === 'mariaDB') {
            if (this.containsInsertReturningClause(query, params)) {
                return super.executeInsertReturningLastInsertedId(query, params)
            }

            return this.executeCombined(
                () => this.executeInsert(query, params),
                () => this.executeSelectOneColumnOneRow('select last_insert_id()', [])
            ).then(([_count, id]) => id)
        }
        if (this.database === 'sqlite') {
            if (this.containsInsertReturningClause(query, params)) {
                return super.executeInsertReturningLastInsertedId(query, params)
            }

            return this.executeCombined(
                () => this.executeInsert(query, params),
                () => this.executeSelectOneColumnOneRow('select last_insert_rowid()', [])
            ).then(([_count, id]) => id)
        }

        return super.executeInsertReturningLastInsertedId(query, params)
    }
    executeBeginTransaction(_opts: BeginTransactionOpts = []): Promise<void> {
        return Promise.reject(new TsSqlProcessingError({ reason: 'LOW_LEVEL_TRANSACTION_NOT_SUPPORTED' }, 'Low level transaction management is not supported by Prisma.'))
    }
    executeCommit(_opts: CommitOpts = []): Promise<void> {
        return Promise.reject(new TsSqlProcessingError({ reason: 'LOW_LEVEL_TRANSACTION_NOT_SUPPORTED' }, 'Low level transaction management is not supported by Prisma.'))
    }
    executeRollback(_opts: RollbackOpts = []): Promise<void> {
        return Promise.reject(new TsSqlProcessingError({ reason: 'LOW_LEVEL_TRANSACTION_NOT_SUPPORTED' }, 'Low level transaction management is not supported by Prisma.'))
    }
    isTransactionActive(): boolean {
        return !!this.transaction
    }
    executeInTransaction<T>(fn: () => Promise<T>, _outermostQueryRunner: QueryRunner, opts: BeginTransactionOpts = []): Promise<T> {
        if (this.transaction) {
            return Promise.reject(new TsSqlProcessingError({ reason: 'NESTED_TRANSACTION_NOT_SUPPORTED' }, this.database + " doesn't support nested transactions (using " + this.constructor.name + ")"))
        }

        const level = opts?.[0]
        const accessMode = opts?.[1]
        if (accessMode) {
            return Promise.reject(new TsSqlProcessingError({ reason: 'TRANSACTION_ACCESS_MODE_NOT_SUPPORTED', accessMode }, this.database + " doesn't support the transactions access mode: " + accessMode + " (using " + this.constructor.name + ")"))
        }
        if (this.database === 'sqlite' && level && level !== 'serializable') {
            return Promise.reject(new TsSqlProcessingError({ reason: 'TRANSACTION_LEVEL_NOT_SUPPORTED', transactionLevel: level }, this.database + " doesn't support the transactions level: " + level))
        }

        let isolationLevel
        if (!level) {
        } else if (level === 'read uncommitted') {
            isolationLevel = 'ReadUncommitted'
        } else if (level === 'read committed') {
            isolationLevel = 'ReadCommitted'
        } else if (level === 'repeatable read') {
            isolationLevel = 'RepeatableRead'
        } else if (level === 'snapshot') {
            if (this.database !== 'sqlServer') {
                return Promise.reject(new TsSqlProcessingError({ reason: 'TRANSACTION_LEVEL_NOT_SUPPORTED', transactionLevel: level }, this.database + " doesn't support the transactions level: " + level))
            }
            isolationLevel = 'Snapshot'
        } else if (level === 'serializable') {
            isolationLevel = 'Serializable'
        } else {
            return Promise.reject(new TsSqlProcessingError({ reason: 'TRANSACTION_LEVEL_NOT_SUPPORTED', transactionLevel: level }, this.database + " doesn't support the transactions level: " + level))
        }

        return this.connection.$transaction((interactiveTransactions: RawPrismaClient) => {
            if (this.transaction) {
                throw new TsSqlProcessingError({ reason: 'FORBIDDEN_CONCURRENT_USAGE' }, 'Forbidden concurrent usage of the query runner was detected when it tried to start a transaction.')
            }
            this.transaction = interactiveTransactions
            return fn().finally(() => {
                this.transaction = undefined
            })
        }, {...this.config?.interactiveTransactionsOptions, isolationLevel})
    }
    override executeCombined<R1, R2>(fn1: () => Promise<R1>, fn2: () => Promise<R2>): Promise<[R1, R2]> {
        if (this.transaction) {
            return super.executeCombined(fn1, fn2)
        }

        const result = this.connection.$transaction((interactiveTransactions: RawPrismaClient) => {
            if (this.transaction) {
                throw new TsSqlProcessingError({ reason: 'FORBIDDEN_CONCURRENT_USAGE' }, 'Forbidden concurrent usage of the query runner was detected when it tried to execute combined queries.')
            }
            this.transaction = interactiveTransactions
            return super.executeCombined(fn1, fn2).finally(() => {
                this.transaction = undefined
            })
        }, this.config?.interactiveTransactionsOptions)
        return this.wrapPrismaPromise(result)
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
                result = '@P' + (index  + 1)
                break
            default:
                throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_DATABASE', database: this.database }, 'Unknown database ' + this.database)
        }
        params.push(value)
        return result
    }
    override getErrorReason(error: unknown): TsSqlErrorReason {
        return PrismaQueryRunner.getErrorReason(error)
    }
    override isSqlError(error: unknown): boolean {
        return PrismaQueryRunner.isSqlError(error)
    }
    static getErrorReason(error: unknown): TsSqlErrorReason {
        if (error instanceof TsSqlError) {
            return error.errorReason
        }
        return getPrismaErrorReason(error)
    }
    static isSqlError(error: unknown): boolean {
        return error instanceof TsSqlError || isPrismaError(error)
    }
    override lowLevelTransactionManagementSupported(): boolean {
        return false
    }
    protected wrapPrismaPromise(promise: Promise<any>): Promise<any> {
        // Use a real Promise instead of Prisma proxy to avoid issues due then with one param is not properly managed
        return new Promise((resolve, reject) => {
            promise.then(resolve, reject)
        })
    }
}
