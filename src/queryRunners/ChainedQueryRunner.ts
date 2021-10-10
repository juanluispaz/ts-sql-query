import { UnwrapPromiseTuple } from "../utils/PromiseProvider"
import type { QueryRunner, DatabaseType } from "./QueryRunner"

export class ChainedQueryRunner<T extends QueryRunner> implements QueryRunner {
    readonly queryRunner: T
    get database(): DatabaseType {
        return this.queryRunner.database
    }

    constructor(queryRunner: T) {
        this.queryRunner = queryRunner
    }

    useDatabase(database: DatabaseType): void {
        return this.queryRunner.useDatabase(database)
    }

    getNativeRunner(): unknown {
        return this.queryRunner.getNativeRunner()
    }

    execute<RESULT>(fn: (connection: unknown, transaction?: unknown) => Promise<RESULT>): Promise<RESULT> {
        return this.execute(fn)
    }

    executeSelectOneRow(query: string, params: any[] = []): Promise<any> {
        return this.queryRunner.executeSelectOneRow(query, params)
    }
    executeSelectManyRows(query: string, params: any[] = []): Promise<any[]> {
        return this.queryRunner.executeSelectManyRows(query, params)
    }
    executeSelectOneColumnOneRow(query: string, params: any[] = []): Promise<any> {
        return this.queryRunner.executeSelectOneColumnOneRow(query, params)
    }
    executeSelectOneColumnManyRows(query: string, params: any[] = []): Promise<any[]> {
        return this.queryRunner.executeSelectOneColumnManyRows(query, params)
    }
    executeInsert(query: string, params: any[] = []): Promise<number> {
        return this.queryRunner.executeInsert(query, params)
    }
    executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
        return this.queryRunner.executeInsertReturningLastInsertedId(query, params)
    }
    executeInsertReturningMultipleLastInsertedId(query: string, params: any[] = []): Promise<any> {
        return this.queryRunner.executeInsertReturningMultipleLastInsertedId(query, params)
    }
    executeUpdate(query: string, params: any[] = []): Promise<number> {
        return this.queryRunner.executeUpdate(query, params)
    }
    executeUpdateReturningOneRow(query: string, params: any[] = []): Promise<any> {
        return this.queryRunner.executeUpdateReturningOneRow(query, params)
    }
    executeUpdateReturningManyRows(query: string, params: any[] = []): Promise<any[]> {
        return this.queryRunner.executeUpdateReturningManyRows(query, params)
    }
    executeUpdateReturningOneColumnOneRow(query: string, params: any[] = []): Promise<any> {
        return this.queryRunner.executeUpdateReturningOneColumnOneRow(query, params)
    }
    executeUpdateReturningOneColumnManyRows(query: string, params: any[] = []): Promise<any[]> {
        return this.queryRunner.executeUpdateReturningOneColumnManyRows(query, params)
    }
    executeDelete(query: string, params: any[] = []): Promise<number> {
        return this.queryRunner.executeDelete(query, params)
    }
    executeDeleteReturningOneRow(query: string, params: any[] = []): Promise<any> {
        return this.queryRunner.executeDeleteReturningOneRow(query, params)
    }
    executeDeleteReturningManyRows(query: string, params: any[] = []): Promise<any[]> {
        return this.queryRunner.executeDeleteReturningManyRows(query, params)
    }
    executeDeleteReturningOneColumnOneRow(query: string, params: any[] = []): Promise<any> {
        return this.queryRunner.executeDeleteReturningOneColumnOneRow(query, params)
    }
    executeDeleteReturningOneColumnManyRows(query: string, params: any[] = []): Promise<any[]> {
        return this.queryRunner.executeDeleteReturningOneColumnManyRows(query, params)
    }
    executeProcedure(query: string, params: any[] = []): Promise<void> {
        return this.queryRunner.executeProcedure(query, params)
    }
    executeFunction(query: string, params: any[] = []): Promise<any> {
        return this.queryRunner.executeFunction(query, params)
    }
    executeBeginTransaction(): Promise<void> {
        return this.queryRunner.executeBeginTransaction()
    }
    executeCommit(): Promise<void> {
        return this.queryRunner.executeCommit()
    }
    executeRollback(): Promise<void> {
        return this.queryRunner.executeRollback()
    }
    isTransactionActive(): boolean {
        return this.queryRunner.isTransactionActive()
    }
    executeInTransaction<P extends Promise<any>[]>(fn: () => [...P], outermostQueryRunner: QueryRunner): Promise<UnwrapPromiseTuple<P>>
    executeInTransaction<T>(fn: () => Promise<T>, outermostQueryRunner: QueryRunner): Promise<T>
    executeInTransaction(fn: () => Promise<any>[] | Promise<any>, outermostQueryRunner: QueryRunner): Promise<any>
    executeInTransaction(fn: () => Promise<any>[] | Promise<any>, outermostQueryRunner: QueryRunner): Promise<any> {
        return this.queryRunner.executeInTransaction(fn, outermostQueryRunner)
    }
    executeDatabaseSchemaModification(query: string, params: any[] = []): Promise<void> {
        return this.queryRunner.executeDatabaseSchemaModification(query, params)
    }
    addParam(params: any[], value: any): string {
        return this.queryRunner.addParam(params, value)
    }
    addOutParam(params: any[], name: string): string {
        return this.queryRunner.addOutParam(params, name)
    }
    createResolvedPromise<RESULT>(result: RESULT): Promise<RESULT> {
        return this.queryRunner.createResolvedPromise(result) 
    }
    executeCombined<R1, R2>(fn1: () => Promise<R1>, fn2: () => Promise<R2>): Promise<[R1, R2]> {
        return this.queryRunner.executeCombined(fn1, fn2)
    }
    isMocked(): boolean {
        return this.queryRunner.isMocked()
    }
}