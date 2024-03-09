import { AbstractQueryRunner } from "./AbstractQueryRunner"
import type { BeginTransactionOpts, CommitOpts, DatabaseType, QueryRunner, RollbackOpts } from "./QueryRunner"

interface RawPrismaClient {
    $executeRawUnsafe<_T = any>(query: string, ...values: any[]): Promise<number>
    $queryRawUnsafe<T = any>(query: string, ...values: any[]): Promise<T>;
    $transaction(arg: any, options?: any): Promise<any>
}

export interface PrismaConfig {
    interactiveTransactionsOptions?: { maxWait?: number, timeout?: number },
    forUseInTransaction?: boolean
}

export class PrismaQueryRunner extends AbstractQueryRunner {
    readonly database: DatabaseType;
    readonly connection: RawPrismaClient
    private transaction?: RawPrismaClient
    readonly config?: PrismaConfig

    constructor(connection: RawPrismaClient, config?: PrismaConfig) {
        super()
        this.config = config
        this.connection = connection
        switch ((connection as any)._activeProvider) {
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
                throw new Error('Unknown Prisma provider of name ' + (connection as any)._activeProvider)
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
                throw new Error('Unsupported database: ' + database + '. The current connection used in PrismaQueryRunner only supports mySql or mariaDB databases')
            } else {
                throw new Error('Unsupported database: ' + database + '. The current connection used in PrismaQueryRunner only supports ' + this.database + ' databases')
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
    executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
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
        return Promise.reject(new Error('Low level transaction management is not supported by Prisma.'))
    }
    executeCommit(_opts: CommitOpts = []): Promise<void> {
        return Promise.reject(new Error('Low level transaction management is not supported by Prisma.'))
    }
    executeRollback(_opts: RollbackOpts = []): Promise<void> {
        return Promise.reject(new Error('Low level transaction management is not supported by Prisma.'))
    }
    isTransactionActive(): boolean {
        return !!this.transaction
    }
    executeInTransaction<T>(fn: () => Promise<T>, _outermostQueryRunner: QueryRunner, opts: BeginTransactionOpts = []): Promise<T> {
        if (this.transaction) {
            return Promise.reject(new Error(this.database + " doesn't support nested transactions (using " + this.constructor.name + ")"))
        }

        const level = opts?.[0]
        const accessMode = opts?.[1]
        if (accessMode) {
            return Promise.reject(new Error(this.database + " doesn't support the transactions access mode: " + accessMode + " (using " + this.constructor.name + ")"))
        }
        if (this.database === 'sqlite' && level && level !== 'serializable') {
            return Promise.reject(new Error(this.database + " doesn't support the transactions level: " + level))
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
                return Promise.reject(new Error(this.database + " doesn't support the transactions level: " + level))
            }
            isolationLevel = 'Snapshot'
        } else if (level === 'serializable') {
            isolationLevel = 'Serializable'
        } else {
            return Promise.reject(new Error(this.database + " doesn't support the transactions level: " + level))
        }

        return this.connection.$transaction((interactiveTransactions: RawPrismaClient) => {
            if (this.transaction) {
                throw new Error('Forbidden concurrent usage of the query runner was detected when it tried to start a transaction.')
            }
            this.transaction = interactiveTransactions
            return fn().finally(() => {
                this.transaction = undefined
            })
        }, {...this.config?.interactiveTransactionsOptions, isolationLevel})
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
                throw new Error('Unknown database ' + this.database)
        }
        params.push(value)
        return result
    }
    createResolvedPromise<RESULT>(result: RESULT): Promise<RESULT> {
        return Promise.resolve(result)
    }
    createRejectedPromise<RESULT = any>(error: any): Promise<RESULT> {
        return Promise.reject(error)
    }
    executeCombined<R1, R2>(fn1: () => Promise<R1>, fn2: () => Promise<R2>): Promise<[R1, R2]> {
        return fn1().then((r1) => {
            return fn2().then((r2) => {
                return [r1, r2]
            })
        })
    }
    lowLevelTransactionManagementSupported(): boolean {
        return false
    }
    protected wrapPrismaPromise(promise: Promise<any>): Promise<any> {
        // Use a real Promise instead of Prisma proxy to avoid issues due then with one param is not properly managed
        return new Promise((resolve, reject) => {
            promise.then(resolve, reject)
        })
    }
}
