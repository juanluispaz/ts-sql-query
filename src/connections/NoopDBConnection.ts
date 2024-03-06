import type { BeginTransactionOpts, CommitOpts, QueryRunner, RollbackOpts } from "../queryRunners/QueryRunner"
import { NoopDBSqlBuilder } from "../sqlBuilders/NoopDBSqlBuilder"
import { NoopQueryRunner } from "../queryRunners/NoopQueryRunner"
import type { DB } from "../typeMarks/NoopDBDB"
import { AbstractAdvancedConnection } from "./AbstractAdvancedConnection"
import { ChainedQueryRunner } from "../queryRunners/ChainedQueryRunner"
import { TransactionIsolationLevel } from "./AbstractConnection"

export abstract class NoopDBConnection<NAME extends string> extends AbstractAdvancedConnection<DB<NAME>> {

    constructor(queryRunner: QueryRunner = new NoopQueryRunner(), sqlBuilder = new NoopDBSqlBuilder()) {
        super(new NoopIterceptQueryRunner(queryRunner), sqlBuilder)
        queryRunner.useDatabase('noopDB')
    }

    isolationLevel(level: 'read uncommitted' | 'read committed' | 'repeatable read' | 'serializable', accessMode?: 'read write' | 'read only'): TransactionIsolationLevel
    isolationLevel(accessMode: 'read write' | 'read only'): TransactionIsolationLevel
    isolationLevel(level: 'read uncommitted' | 'read committed' | 'repeatable read' | 'serializable' | 'read write' | 'read only', accessMode?: 'read write' | 'read only'): TransactionIsolationLevel {
        if (level === 'read write' || level === 'read only') {
            return [undefined, accessMode] as any
        }
        if (accessMode) {
            return [level, accessMode] as any
        }
        return [level] as any
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
    executeBeginTransaction(opts: BeginTransactionOpts): Promise<void> {
        this.lastQuery = 'begin transaction'
        this.lastParams = opts || []
        return this.queryRunner.executeBeginTransaction(opts)
    }
    executeCommit(opts: CommitOpts): Promise<void> {
        this.lastQuery = 'commit'
        this.lastParams = opts || []
        return this.queryRunner.executeCommit(opts)
    }
    executeRollback(opts: RollbackOpts): Promise<void> {
        this.lastQuery = 'rollback'
        this.lastParams = opts || []
        return this.queryRunner.executeRollback(opts)
    }
    executeDatabaseSchemaModification(query: string, params: any[] = []): Promise<void> {
        this.lastQuery = query
        this.lastParams = params
        return this.queryRunner.executeDatabaseSchemaModification(query, params)
    }
}