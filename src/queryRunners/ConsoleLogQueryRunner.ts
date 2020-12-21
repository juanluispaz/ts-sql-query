import type { QueryRunner } from "./QueryRunner"
import { ChainedQueryRunner } from "./ChainedQueryRunner"

export class ConsoleLogQueryRunner<T extends QueryRunner> extends ChainedQueryRunner<T> {
    constructor(queryRunner: T) {
        super(queryRunner)
    }

    executeSelectOneRow(query: string, params: any[] = []): Promise<any> {
        console.log('executeSelectOneRow:', query, params)
        return this.queryRunner.executeSelectOneRow(query, params)
    }
    executeSelectManyRows(query: string, params: any[] = []): Promise<any[]> {
        console.log('executeSelectManyRows:', query, params)
        return this.queryRunner.executeSelectManyRows(query, params)
    }
    executeSelectOneColumnOneRow(query: string, params: any[] = []): Promise<any> {
        console.log('executeSelectOneColumnOneRow:', query, params)
        return this.queryRunner.executeSelectOneColumnOneRow(query, params)
    }
    executeSelectOneColumnManyRows(query: string, params: any[] = []): Promise<any[]> {
        console.log('executeSelectOneColumnManyRows:', query, params)
        return this.queryRunner.executeSelectOneColumnManyRows(query, params)
    }
    executeInsert(query: string, params: any[] = []): Promise<number> {
        console.log('executeInsert:', query, params)
        return this.queryRunner.executeInsert(query, params)
    }
    executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
        console.log('executeInsertReturningLastInsertedId:', query, params)
        return this.queryRunner.executeInsertReturningLastInsertedId(query, params)
    }
    executeInsertReturningMultipleLastInsertedId(query: string, params: any[] = []): Promise<any> {
        console.log('executeInsertReturningMultipleLastInsertedId:', query, params)
        return this.queryRunner.executeInsertReturningMultipleLastInsertedId(query, params)
    }
    executeUpdate(query: string, params: any[] = []): Promise<number> {
        console.log('executeUpdate:', query, params)
        return this.queryRunner.executeUpdate(query, params)
    }
    executeDelete(query: string, params: any[] = []): Promise<number> {
        console.log('executeDelete:', query, params)
        return this.queryRunner.executeDelete(query, params)
    }
    executeProcedure(query: string, params: any[] = []): Promise<void> {
        console.log('executeProcedure:', query, params)
        return this.queryRunner.executeProcedure(query, params)
    }
    executeFunction(query: string, params: any[] = []): Promise<any> {
        console.log('executeFunction:', query, params)
        return this.queryRunner.executeFunction(query, params)
    }
    executeBeginTransaction(): Promise<void> {
        console.log('executeBeginTransaction:', undefined, undefined)
        return this.queryRunner.executeBeginTransaction()
    }
    executeCommit(): Promise<void> {
        console.log('executeCommit:', undefined, undefined)
        return this.queryRunner.executeCommit()
    }
    executeRollback(): Promise<void> {
        console.log('executeRollback:', undefined, undefined)
        return this.queryRunner.executeRollback()
    }
    executeDatabaseSchemaModification(query: string, params: any[] = []): Promise<void> {
        console.log('executeDatabaseSchemaModification:', query, params)
        return this.queryRunner.executeDatabaseSchemaModification(query, params)
    }
}