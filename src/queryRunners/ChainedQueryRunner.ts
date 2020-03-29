import { QueryRunner, DatabaseType } from "./QueryRunner"

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

    getNativeConnection(): unknown {
        return this.queryRunner.getNativeConnection()
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
    executeDelete(query: string, params: any[] = []): Promise<number> {
        return this.queryRunner.executeDelete(query, params)
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
    executeDatabaseSchemaModification(query: string, params: any[] = []): Promise<void> {
        return this.queryRunner.executeDatabaseSchemaModification(query, params)
    }
    addParam(params: any[], value: any): string {
        return this.queryRunner.addParam(params, value)
    }
    addOutParam(params: any[], name: string): string {
        return this.queryRunner.addOutParam(params, name)
    }
}