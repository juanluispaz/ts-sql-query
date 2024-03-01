import { UnwrapPromiseTuple } from "../utils/PromiseProvider"
import { AbstractQueryRunner } from "./AbstractQueryRunner"
import { DatabaseType, QueryRunner } from "./QueryRunner"

interface RawPrismaClient2 {
    $executeRaw<_T = any>(query: string, ...values: any[]): Promise<number>
    $queryRaw<T = any>(query: string, ...values: any[]): Promise<T>
    $transaction(arg: any, options?: any): Promise<any>
}

interface RawPrismaClient3 {
    $executeRawUnsafe<_T = any>(query: string, ...values: any[]): Promise<number>
    $queryRawUnsafe<T = any>(query: string, ...values: any[]): Promise<T>;
    $transaction(arg: any, options?: any): Promise<any>
}

type RawPrismaClient = RawPrismaClient2 | RawPrismaClient3

function isPrisma3(connection: any): connection is RawPrismaClient3 {
    return connection.$executeRawUnsafe
}

export interface PrismaConfig {
    interactiveTransactionsOptions?: { maxWait?: number, timeout?: number, isolationLevel?: string },
    forUseInTransaction?: boolean
}

export class PrismaQueryRunner extends AbstractQueryRunner {
    readonly database: DatabaseType;
    readonly connection: RawPrismaClient
    readonly transaction?: RawPrismaClient
    readonly config?: PrismaConfig
    private transactionLevel = 0

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
        try {
            if (connection.$transaction as any) {
                this.transaction = undefined
            }
        } catch {
            // This is running in an interactiveTransaction
            this.transaction = connection
            this.transactionLevel = 1
        }
        if (config?.forUseInTransaction) {
            this.transactionLevel = 1
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
        let result
        if (isPrisma3(connection)) {
            result = connection.$queryRawUnsafe<any[]>(query, ...params)
        } else {
            result = connection.$queryRaw<any[]>(query, ...params)
        }
        return this.wrapPrismaPromise(result)
    }
    protected executeMutation(query: string, params: any[]): Promise<number> {
        const connection = this.transaction || this.connection
        let result
        if (isPrisma3(connection)) {
            result = connection.$executeRawUnsafe<any[]>(query, ...params)
        } else {
            result = connection.$executeRaw<any[]>(query, ...params)
        }
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
    executeBeginTransaction(): Promise<void> {
        if (isPrisma3(this.connection)) {
            return Promise.reject(new Error('Low level transaction management is not supported by Prisma.'))
        }
        return Promise.reject(new Error('Long running transactions are not supported by Prisma. See https://github.com/prisma/prisma/issues/1844'))
    }
    executeCommit(): Promise<void> {
        if (isPrisma3(this.connection)) {
            return Promise.reject(new Error('Low level transaction management is not supported by Prisma.'))
        }
        return Promise.reject(new Error('Long running transactions are not supported by Prisma. See https://github.com/prisma/prisma/issues/1844'))
    }
    executeRollback(): Promise<void> {
        if (isPrisma3(this.connection)) {
            return Promise.reject(new Error('Low level transaction management is not supported by Prisma.'))
        }
        return Promise.reject(new Error('Long running transactions are not supported by Prisma. See https://github.com/prisma/prisma/issues/1844'))
    }
    isTransactionActive(): boolean {
        return this.transactionLevel > 0
    }
    executeInTransaction<P extends Promise<any>[]>(fn: () => [...P], outermostQueryRunner: QueryRunner): Promise<UnwrapPromiseTuple<P>>
    executeInTransaction<T>(fn: () => Promise<T>, outermostQueryRunner: QueryRunner): Promise<T>
    executeInTransaction(fn: () => Promise<any>[] | Promise<any>, outermostQueryRunner: QueryRunner): Promise<any>
    executeInTransaction(fn: () => Promise<any>[] | Promise<any>, _outermostQueryRunner: QueryRunner): Promise<any> {
        if (this.transaction) {
            throw new Error('Nested interactive transaction is not supported by Prisma')
        }
        return this.connection.$transaction((interactiveTransactions: RawPrismaClient) => {
            // @ts-ignore
            this.transaction = interactiveTransactions
            this.transactionLevel++
            const promises = fn()
            let result
            if (Array.isArray(promises)) {
                result = Promise.all(promises)
            } else {
                result = promises
            }
            return result.finally(() => {
                this.transactionLevel--
                // @ts-ignore
                this.transaction = undefined
            })
        }, this.config?.interactiveTransactionsOptions)
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
