import { QueryRunner, DatabaseType } from "./QueryRunner"
import { QueryRunnerSupportedDB } from "./QueryRunnerSupportedDB"

export class ChainedQueryRunner<T extends QueryRunner & QueryRunnerSupportedDB> implements QueryRunner {
    queryRunner: T
    // Supported databases
    readonly mariaDB: T['mariaDB']
    readonly mySql: T['mySql']
    readonly noopDB: T['noopDB']
    readonly oracle: T['oracle']
    readonly postgreSql: T['postgreSql']
    readonly sqlite: T['sqlite']
    readonly sqlServer: T['sqlServer']
    readonly database: DatabaseType

    constructor(queryRunner: T) {
        this.queryRunner = queryRunner
        this.mariaDB = queryRunner.mariaDB
        this.mySql = queryRunner.mySql
        this.noopDB = queryRunner.noopDB
        this.oracle = queryRunner.oracle
        this.postgreSql = queryRunner.postgreSql
        this.sqlite = queryRunner.sqlite
        this.sqlServer = queryRunner.sqlServer
        this.database = queryRunner.database
    }

    getNativeConnection(): unknown {
        return this.queryRunner.getNativeConnection()
    }

    executeSelectOneRow(query: string, params: any[]): Promise<any> {
        return this.queryRunner.executeSelectOneRow(query, params)
    }
    executeSelectManyRows(query: string, params: any[]): Promise<any[]> {
        return this.queryRunner.executeSelectManyRows(query, params)
    }
    executeSelectOneColumnOneRow(query: string, params: any[]): Promise<any> {
        return this.queryRunner.executeSelectOneColumnOneRow(query, params)
    }
    executeSelectOneColumnManyRows(query: string, params: any[]): Promise<any[]> {
        return this.queryRunner.executeSelectOneColumnManyRows(query, params)
    }
    executeInsert(query: string, params: any[]): Promise<number> {
        return this.queryRunner.executeInsert(query, params)
    }
    executeInsertReturningLastInsertedId(query: string, params: any[]): Promise<any> {
        return this.queryRunner.executeInsertReturningLastInsertedId(query, params)
    }
    executeUpdate(query: string, params: any[]): Promise<number> {
        return this.queryRunner.executeUpdate(query, params)
    }
    executeDelete(query: string, params: any[]): Promise<number> {
        return this.queryRunner.executeDelete(query, params)
    }
    executeProcedure(query: string, params: any[]): Promise<void> {
        return this.queryRunner.executeProcedure(query, params)
    }
    executeFunction(query: string, params: any[]): Promise<any> {
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
    addParam(params: any[], value: any): string {
        return this.queryRunner.addParam(params, value)
    }
    addOutParam(params: any[], name: string): string {
        return this.queryRunner.addOutParam(params, name)
    }
}