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
    interactiveTransactions: boolean,
    interactiveTransactionsOptions?: { maxWait?: number, timeout?: number, isolationLevel?: string },
    forUseInTransaction?: boolean
}

export class PrismaQueryRunner extends AbstractQueryRunner {
    readonly database: DatabaseType;
    readonly connection: RawPrismaClient
    readonly transaction?: RawPrismaClient
    readonly config: PrismaConfig
    private transactionLevel = 0

    constructor(connection: RawPrismaClient, config: PrismaConfig = {interactiveTransactions: false}) {
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
        if (config.forUseInTransaction) {
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
        if (this.config.interactiveTransactions) {
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
            }, this.config.interactiveTransactionsOptions)
        }

        this.transactionLevel++
        try {
            let promises = fn()
            const unwrap = !Array.isArray(promises)
            if (!Array.isArray(promises)) {
                promises = [promises]
            }
            let result = this.connection.$transaction(promises)
            if (unwrap) {
                result = result.then(([value]) => {
                    return value
                })
            }
            return result
        } finally {
            this.transactionLevel--
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
                result = '@P' + (index  + 1)
                break
            default:
                throw new Error('Unknown database ' + this.database)
        }
        params.push(value)
        return result
    }
    createResolvedPromise<RESULT>(result: RESULT): Promise<RESULT> {
        if (this.transaction) {
            Promise.resolve(result)
        }
        if (this.transactionLevel <= 0) {
            return Promise.resolve(result)
        } else {
            return new ResolvedPrismaPromise(result) as any
        }
    }
    executeCombined<R1, R2>(fn1: () => Promise<R1>, fn2: () => Promise<R2>): Promise<[R1, R2]> {
        if (this.transaction) {
            return fn1().then((r1) => {
                return fn2().then((r2) => {
                    return [r1, r2]
                })
            })
        }

        if (this.transactionLevel <= 0) {
            this.transactionLevel++
            let p1, p2
            try {
                p1 = fn1()
                p2 = fn2()
            } finally {
                this.transactionLevel--
            }

            return this.connection.$transaction([
                p1,
                p2
            ]) as any
        }

        return new CombinedPrismaPromise(fn1() as any, fn2() as any) as any
    }
    protected wrapPrismaPromise(promise: Promise<any>): Promise<any> {
        if (this.transaction) {
            // Use a real Promise instead of Prisma proxy to avoid issues due then with one param is not properly managed
            return new Promise((resolve, reject) => {
                promise.then(resolve, reject)
            })
        }
        if (this.transactionLevel <= 0) {
            return promise
        } else {
            return new PrismaPromise(promise as any) as any
        }
    }
}

class PrismaPromise {
    onfulfilled?: any
    onrejected?: any
    onfinally?: any
    next: PrismaPromise

    constructor(next: PrismaPromise) {
        this.next = next
    }

    then(onfulfilled?: any, onrejected?: any, transactionId?: any): PrismaPromise {
        // Note: Prisma 4 doesn't require transactionId, it can be removed
        if (transactionId !== undefined) {
            if (this.onfinally) {
                return this.next.then((r: any) => {
                    this.onfinally()
                    return r
                }, (e: any) => {
                    this.onfinally()
                    throw e
                }, transactionId).then(onfulfilled, onrejected)
            } else {
                return this.next.then(this.onfulfilled || ((r: any) => {
                    return r
                }), this.onrejected || ((e: any) => {
                    throw e
                }), transactionId).then(onfulfilled, onrejected)
            }
        }
        this.onfulfilled = onfulfilled
        this.onrejected = onrejected
        return new PrismaPromise(this)
    }
    catch(onrejected?: any): PrismaPromise {
        this.onrejected = onrejected
        return new PrismaPromise(this)
    }
    finally(onfinally?: any): PrismaPromise {
        this.onfinally = onfinally
        return new PrismaPromise(this)
    }
    requestTransaction(transactionId: any, lock: any): PrismaPromise {
        return this.next.requestTransaction(transactionId, lock).then((result: any) => {
            if (typeof result === 'function') {
                return () => {
                    if (this.onfinally) {
                        return result().finally(this.onfinally)
                    } else {
                        return result().then(this.onfulfilled, this.onrejected)
                    }
                }
            } else {
                // Prisma 4
                if (this.onfinally) {
                    return Promise.resolve(result).finally(this.onfinally)
                } else {
                    return Promise.resolve(result).then(this.onfulfilled, this.onrejected)
                }
            }
        })
    }
    [Symbol.toStringTag] = "PrismaPromise"
}

class ResolvedPrismaPromise {
    onfulfilled?: any
    onrejected?: any
    onfinally?: any
    value: any

    constructor(value: any) {
        this.value = value
    }

    then(onfulfilled?: any, onrejected?: any, transactionId?: any): PrismaPromise {
        // Note: Prisma 4 doesn't require transactionId, it can be removed
        if (transactionId !== undefined) {
            if (this.onfinally) {
                return Promise.resolve(this.value).finally(this.onfinally).then(onfulfilled, onrejected) as any
            } else {
                return Promise.resolve(this.value).then(this.onfulfilled, this.onrejected).then(onfulfilled, onrejected) as any
            }
        }
        this.onfulfilled = onfulfilled
        this.onrejected = onrejected
        return new PrismaPromise(this as any)
    }
    catch(onrejected?: any): PrismaPromise {
        this.onrejected = onrejected
        return new PrismaPromise(this as any)
    }
    finally(onfinally?: any): PrismaPromise {
        this.onfinally = onfinally
        return new PrismaPromise(this as any)
    }
    requestTransaction(_transactionId: any, _lock: any): PrismaPromise {
        return Promise.resolve(() => {
            if (this.onfinally) {
                return Promise.resolve(this.value).finally(this.onfinally)
            } else {
                return Promise.resolve(this.value).then(this.onfulfilled, this.onrejected)
            }
        }) as any
    }
    [Symbol.toStringTag] = "PrismaPromise"
}

class CombinedPrismaPromise {
    onfulfilled?: any
    onrejected?: any
    onfinally?: any
    next1: PrismaPromise
    next2: PrismaPromise

    constructor(next1: PrismaPromise, next2: PrismaPromise) {
        this.next1 = next1
        this.next2 = next2
    }

    then(onfulfilled?: any, onrejected?: any, transactionId?: any): PrismaPromise {
        // Note: Prisma 4 doesn't require transactionId, it can be removed
        if (transactionId !== undefined) {
            if (this.onfinally) {
                return Promise.all([
                    this.next1.then((r: any) => {
                        return r
                    }, (e: any) => {
                        throw e
                    }, transactionId),
                    this.next2.then((r: any) => {
                        return r
                    }, (e: any) => {
                        throw e
                    }, transactionId)
                ]).finally(this.onfinally).then(onfulfilled, onrejected) as any
            } else {
                return Promise.all([
                    this.next1.then((r: any) => {
                        return r
                    }, (e: any) => {
                        throw e
                    }, transactionId),
                    this.next2.then((r: any) => {
                        return r
                    }, (e: any) => {
                        throw e
                    }, transactionId)
                ]).then(this.onfulfilled, this.onrejected).then(onfulfilled, onrejected) as any
            }
        }
        this.onfulfilled = onfulfilled
        this.onrejected = onrejected
        return new PrismaPromise(this as any)
    }
    catch(onrejected?: any): PrismaPromise {
        this.onrejected = onrejected
        return new PrismaPromise(this as any)
    }
    finally(onfinally?: any): PrismaPromise {
        this.onfinally = onfinally
        return new PrismaPromise(this as any)
    }
    requestTransaction(transactionId: any, lock: any): PrismaPromise {
        const rt1 = this.next1.requestTransaction(transactionId, lock)
        const rt2 = this.next2.requestTransaction(transactionId, lock)
        
        return Promise.all([rt1, rt2]).then(([pfn1, pfn2]) => {
            if (typeof pfn1 === 'function') {
                const fn1 = pfn1 as any as () => PrismaPromise
                const fn2 = pfn2 as any as () => PrismaPromise

                return (() => {
                    if (this.onfinally) {
                        return Promise.all([
                            fn1(),
                            fn2()
                        ]).finally(this.onfinally)
                    } else {
                        return Promise.all([
                            fn1(),
                            fn2()
                        ]).then(this.onfulfilled, this.onrejected)
                    }
                }) as any
            } else {
                // Prisma 4
                if (this.onfinally) {
                    return Promise.all([
                        pfn1,
                        pfn2
                    ]).finally(this.onfinally)
                } else {
                    return Promise.all([
                        pfn1,
                        pfn2
                    ]).then(this.onfulfilled, this.onrejected)
                }
            }
        }) as any
    }
    [Symbol.toStringTag] = "PrismaPromise"
}