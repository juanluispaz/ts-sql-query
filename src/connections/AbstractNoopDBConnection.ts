import { NoopDBSqlBuilder } from "../sqlBuilders/NoopDBSqlBuilder"
import { NoopDB } from "../databases/NoopDB"
import { TypeUnsafeDB } from "../databases/TypeUnsafeDB"
import { AbstractAdvancedConnection } from "./AbstractAdvancedConnection"
import { TypeSafeDB } from "../databases/TypeSafeDB"
import { QueryRunner } from "../queryRunners/QueryRunner"
import { ChainedQueryRunner } from "../queryRunners/ChainedQueryRunner";
import { QueryRunnerSupportedDB } from "../queryRunners/QueryRunnerSupportedDB"

export abstract class AbstractNoopDBConnection<DB extends NoopDB & (TypeUnsafeDB | TypeSafeDB), NAME, SQL_BUILDER extends NoopDBSqlBuilder> extends AbstractAdvancedConnection<DB & NoopDB, NAME, SQL_BUILDER> implements NoopDB {
    __NoopDB: 'NoopDB' = 'NoopDB'

    constructor(queryRunner: QueryRunner & {noopDB: true}, sqlBuilder: SQL_BUILDER) {
        super(new NoopIterceptQueryRunner(queryRunner), sqlBuilder)
    }

    get lastQuery(): string {
        return (this.queryRunner as NoopIterceptQueryRunner<any>).lastQuery
    }
    get lastParams(): any[] {
        return (this.queryRunner as NoopIterceptQueryRunner<any>).lastParams
    }

}

class NoopIterceptQueryRunner<T extends QueryRunner & QueryRunnerSupportedDB> extends ChainedQueryRunner<T> {
    lastQuery: string = ''
    lastParams: any[] = []
    readonly noopDB: true = true

    constructor(queryRunner: T) {
        super(queryRunner)
    }
    getNativeConnection(): unknown {
        return this.queryRunner.getNativeConnection()
    }
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