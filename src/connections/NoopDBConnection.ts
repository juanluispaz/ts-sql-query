import type { QueryRunner } from "../queryRunners/QueryRunner"
import { NoopDBSqlBuilder } from "../sqlBuilders/NoopDBSqlBuilder"
import { NoopQueryRunner } from "../queryRunners/NoopQueryRunner"
import type { DB } from "../typeMarks/NoopDBDB"
import { AbstractAdvancedConnection } from "./AbstractAdvancedConnection"
import { ChainedQueryRunner } from "../queryRunners/ChainedQueryRunner"

export abstract class NoopDBConnection<NAME extends string> extends AbstractAdvancedConnection<DB<NAME>> {

    constructor(queryRunner: QueryRunner = new NoopQueryRunner(), sqlBuilder = new NoopDBSqlBuilder()) {
        super(new NoopIterceptQueryRunner(queryRunner), sqlBuilder)
        queryRunner.useDatabase('noopDB')
    }

    get lastQuery(): string {
        return (this.queryRunner as NoopIterceptQueryRunner<any>).lastQuery
    }
    get lastParams(): any[] {
        return (this.queryRunner as NoopIterceptQueryRunner<any>).lastParams
    }

}

class NoopIterceptQueryRunner<T extends QueryRunner> extends ChainedQueryRunner<T> {
    lastQuery: string = ''
    lastParams: any[] = []

    executeSelectOneRow(query: string, params: any[] = []): Promise<any> {
        this.lastQuery = query
        this.lastParams = params
        return this.queryRunner.executeSelectOneRow(query, params)
    }
    executeSelectManyRows(query: string, params: any[] = []): Promise<any[]> {
        this.lastQuery = query
        this.lastParams = params
        return this.queryRunner.executeSelectManyRows(query, params)
    }
    executeSelectOneColumnOneRow(query: string, params: any[] = []): Promise<any> {
        this.lastQuery = query
        this.lastParams = params
        return this.queryRunner.executeSelectOneColumnOneRow(query, params)
    }
    executeSelectOneColumnManyRows(query: string, params: any[] = []): Promise<any[]> {
        this.lastQuery = query
        this.lastParams = params
        return this.queryRunner.executeSelectOneColumnManyRows(query, params)
    }
    executeInsert(query: string, params: any[] = []): Promise<number> {
        this.lastQuery = query
        this.lastParams = params
        return this.queryRunner.executeInsert(query, params)
    }
    executeInsertReturningLastInsertedId(query: string, params: any[] = []): Promise<any> {
        this.lastQuery = query
        this.lastParams = params
        return this.queryRunner.executeInsertReturningLastInsertedId(query, params)
    }
    executeInsertReturningMultipleLastInsertedId(query: string, params: any[] = []): Promise<any> {
        this.lastQuery = query
        this.lastParams = params
        return this.queryRunner.executeInsertReturningMultipleLastInsertedId(query, params)
    }
    executeUpdate(query: string, params: any[] = []): Promise<number> {
        this.lastQuery = query
        this.lastParams = params
        return this.queryRunner.executeUpdate(query, params)
    }
    executeDelete(query: string, params: any[] = []): Promise<number> {
        this.lastQuery = query
        this.lastParams = params
        return this.queryRunner.executeDelete(query, params)
    }
    executeProcedure(query: string, params: any[] = []): Promise<void> {
        this.lastQuery = query
        this.lastParams = params
        return this.queryRunner.executeProcedure(query, params)
    }
    executeFunction(query: string, params: any[] = []): Promise<any> {
        this.lastQuery = query
        this.lastParams = params
        return this.queryRunner.executeFunction(query, params)
    }
    executeBeginTransaction(): Promise<void> {
        this.lastQuery = 'begin transaction'
        this.lastParams = []
        return this.queryRunner.executeBeginTransaction()
    }
    executeCommit(): Promise<void> {
        this.lastQuery = 'commit'
        this.lastParams = []
        return this.queryRunner.executeCommit()
    }
    executeRollback(): Promise<void> {
        this.lastQuery = 'rollback'
        this.lastParams = []
        return this.queryRunner.executeRollback()
    }
    executeDatabaseSchemaModification(query: string, params: any[] = []): Promise<void> {
        this.lastQuery = query
        this.lastParams = params
        return this.queryRunner.executeDatabaseSchemaModification(query, params)
    }
}