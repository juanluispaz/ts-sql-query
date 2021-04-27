import type { QueryRunner } from "./QueryRunner"
import { ChainedQueryRunner } from "./ChainedQueryRunner"

/**
 * Log every query with `console.log` or a user-provided logging function,
 * then pass it on to the next query runner.
 */
export class ConsoleLogQueryRunner<T extends QueryRunner> extends ChainedQueryRunner<T> {
    private log: (message?: any, ...optionalParams: any[]) => void;

    constructor(queryRunner: T, logFunction?: (message?: any, ...optionalParams: any[]) => void) {
        super(queryRunner)
        if (logFunction !== undefined) {
            this.log = logFunction;
        } else {
            this.log = console.log;
        }
    }

    executeSelectOneRow(query: string, params: any[] = []): Promise<any> {
        this.log('executeSelectOneRow:', query, params)
        return this.queryRunner.executeSelectOneRow(query, params)
    }
    executeSelectManyRows(query: string, params: any[] = []): Promise<any[]> {
        this.log('executeSelectManyRows:', query, params)
        return this.queryRunner.executeSelectManyRows(query, params)
    }
    executeSelectOneColumnOneRow(query: string, params: any[] = []): Promise<any> {
        this.log('executeSelectOneColumnOneRow:', query, params)
        return this.queryRunner.executeSelectOneColumnOneRow(query, params)
    }
    executeSelectOneColumnManyRows(query: string, params: any[] = []): Promise<any[]> {
        this.log('executeSelectOneColumnManyRows:', query, params)
        return this.queryRunner.executeSelectOneColumnManyRows(query, params)
    }
    executeInsert(query: string, params: any[] = []): Promise<number> {
        this.log('executeInsert:', query, params)
        return this.queryRunner.executeInsert(query, params)
    }
    executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
        this.log('executeInsertReturningLastInsertedId:', query, params)
        return this.queryRunner.executeInsertReturningLastInsertedId(query, params)
    }
    executeInsertReturningMultipleLastInsertedId(query: string, params: any[] = []): Promise<any> {
        this.log('executeInsertReturningMultipleLastInsertedId:', query, params)
        return this.queryRunner.executeInsertReturningMultipleLastInsertedId(query, params)
    }
    executeUpdate(query: string, params: any[] = []): Promise<number> {
        this.log('executeUpdate:', query, params)
        return this.queryRunner.executeUpdate(query, params)
    }
    executeDelete(query: string, params: any[] = []): Promise<number> {
        this.log('executeDelete:', query, params)
        return this.queryRunner.executeDelete(query, params)
    }
    executeProcedure(query: string, params: any[] = []): Promise<void> {
        this.log('executeProcedure:', query, params)
        return this.queryRunner.executeProcedure(query, params)
    }
    executeFunction(query: string, params: any[] = []): Promise<any> {
        this.log('executeFunction:', query, params)
        return this.queryRunner.executeFunction(query, params)
    }
    executeBeginTransaction(): Promise<void> {
        this.log('executeBeginTransaction:', undefined, undefined)
        return this.queryRunner.executeBeginTransaction()
    }
    executeCommit(): Promise<void> {
        this.log('executeCommit:', undefined, undefined)
        return this.queryRunner.executeCommit()
    }
    executeRollback(): Promise<void> {
        this.log('executeRollback:', undefined, undefined)
        return this.queryRunner.executeRollback()
    }
    executeDatabaseSchemaModification(query: string, params: any[] = []): Promise<void> {
        this.log('executeDatabaseSchemaModification:', query, params)
        return this.queryRunner.executeDatabaseSchemaModification(query, params)
    }
}