import { UnwrapPromiseTuple } from "../utils/PromiseProvider";
import { AbstractQueryRunner } from "./AbstractQueryRunner";
import { DatabaseType, QueryRunner } from "./QueryRunner"

interface RawPrismaClient {
    $executeRaw<_T = any>(query: string, ...values: any[]): Promise<number>
    $queryRaw<T = any>(query: string, ...values: any[]): Promise<T>;
    $transaction(arg: any[]): Promise<any[]>
}

export class PrismaQueryRunner extends AbstractQueryRunner {
    readonly database: DatabaseType;
    readonly connection: RawPrismaClient
    private transactionLevel = 0

    constructor(connection: RawPrismaClient) {
        super()
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
    getNativeRunner(): unknown {
        return this.connection
    }
    execute<RESULT>(fn: (connection: unknown, transaction?: unknown) => Promise<RESULT>): Promise<RESULT> {
        return fn(this.connection)
    }
    protected executeQueryReturning(query: string, params: any[]): Promise<any[]> {
        return this.wrapPrismaPromise(this.connection.$queryRaw<any[]>(query, ...params))
    }
    protected executeMutation(query: string, params: any[]): Promise<number> {
        return this.wrapPrismaPromise(this.connection.$executeRaw(query, ...params))
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
        return Promise.reject(new Error('Long running transactions are not supported by Prisma. See https://github.com/prisma/prisma/issues/1844'))
    }
    executeCommit(): Promise<void> {
        return Promise.reject(new Error('Long running transactions are not supported by Prisma. See https://github.com/prisma/prisma/issues/1844'))
    }
    executeRollback(): Promise<void> {
        return Promise.reject(new Error('Long running transactions are not supported by Prisma. See https://github.com/prisma/prisma/issues/1844'))
    }
    isTransactionActive(): boolean {
        return this.transactionLevel > 0
    }
    executeInTransaction<P extends Promise<any>[]>(fn: () => [...P], outermostQueryRunner: QueryRunner): Promise<UnwrapPromiseTuple<P>>
    executeInTransaction<T>(fn: () => Promise<T>, outermostQueryRunner: QueryRunner): Promise<T>
    executeInTransaction(fn: () => Promise<any>[] | Promise<any>, outermostQueryRunner: QueryRunner): Promise<any>
    executeInTransaction(fn: () => Promise<any>[] | Promise<any>, _outermostQueryRunner: QueryRunner): Promise<any> {
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
        if (this.transactionLevel <= 0) {
            return Promise.resolve(result)
        } else {
            return new ResolvedPrismaPromise(result) as any
        }
    }
    executeCombined<R1, R2>(fn1: () => Promise<R1>, fn2: () => Promise<R2>): Promise<[R1, R2]> {
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

    then(onfulfilled?: any, onrejected?: any): PrismaPromise {
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
    requestTransaction(transactionId: number): PrismaPromise {
        return this.next.requestTransaction(transactionId).then((fn: () => PrismaPromise) => {
            return () => {
                if (this.onfinally) {
                    return fn().finally(this.onfinally)
                } else {
                    return fn().then(this.onfulfilled, this.onrejected)
                }
            }
        })
    }
}

class ResolvedPrismaPromise {
    onfulfilled?: any
    onrejected?: any
    onfinally?: any
    value: any

    constructor(value: any) {
        this.value = value
    }

    then(onfulfilled?: any, onrejected?: any): PrismaPromise {
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
    requestTransaction(_transactionId: number): PrismaPromise {
        return Promise.resolve(() => {
            if (this.onfinally) {
                return Promise.resolve(this.value).finally(this.onfinally)
            } else {
                return Promise.resolve(this.value).then(this.onfulfilled, this.onrejected)
            }
        }) as any
    }
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

    then(onfulfilled?: any, onrejected?: any): PrismaPromise {
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
    requestTransaction(transactionId: number): PrismaPromise {
        const rt1 = this.next1.requestTransaction(transactionId)
        const rt2 = this.next2.requestTransaction(transactionId)
        
        return Promise.all([rt1, rt2]).then(([pfn1, pfn2]) => {
            const fn1 = pfn1 as any as () => PrismaPromise
            const fn2 = pfn2 as any as () => PrismaPromise

            return () => {
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
            }
        }) as any
    }
}