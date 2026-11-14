import type { BeginTransactionOpts, CommitOpts, RollbackOpts } from './QueryRunner.js'
import { NoopQueryRunner } from './NoopQueryRunner.js'
import { TsSqlProcessingError } from '../TsSqlError.js'

/**
 * A query runner that executes nothing: every query, and every statement of a transaction, is rejected with
 * `QUERY_NOT_ALLOWED`. For a connection made only to use its methods, like converting the types of its database
 * (`sqlDataTypeFrom`, `nativeSqlDataTypeOf`) in a generator: it writes the SQL of its database, as `NoopQueryRunner`
 * does, but nothing reaches a database.
 */
export class NoExecutionQueryRunner extends NoopQueryRunner {
    private reject<RESULT>(query: string): Promise<RESULT> {
        return this.promise.reject(new TsSqlProcessingError({ reason: 'QUERY_NOT_ALLOWED', query }, 'NoExecutionQueryRunner executes no query: ' + query))
    }

    override execute<RESULT>(_fn: (connection: unknown) => Promise<RESULT>): Promise<RESULT> {
        return this.reject('(the connection of the driver)')
    }
    override executeSelectOneRow(query: string, _params: any[] = []): Promise<any> {
        return this.reject(query)
    }
    override executeSelectManyRows(query: string, _params: any[] = []): Promise<any[]> {
        return this.reject(query)
    }
    override executeSelectOneColumnOneRow(query: string, _params: any[] = []): Promise<any> {
        return this.reject(query)
    }
    override executeSelectOneColumnManyRows(query: string, _params: any[] = []): Promise<any[]> {
        return this.reject(query)
    }
    override executeInsert(query: string, _params: any[] = []): Promise<number> {
        return this.reject(query)
    }
    override executeInsertReturningLastInsertedId(query: string, _params: any[] = []): Promise<any> {
        return this.reject(query)
    }
    override executeInsertReturningMultipleLastInsertedId(query: string, _params: any[] = []): Promise<any> {
        return this.reject(query)
    }
    override executeInsertReturningOneRow(query: string, _params: any[] = []): Promise<any> {
        return this.reject(query)
    }
    override executeInsertReturningManyRows(query: string, _params: any[] = []): Promise<any[]> {
        return this.reject(query)
    }
    override executeInsertReturningOneColumnOneRow(query: string, _params: any[] = []): Promise<any> {
        return this.reject(query)
    }
    override executeInsertReturningOneColumnManyRows(query: string, _params: any[] = []): Promise<any[]> {
        return this.reject(query)
    }
    override executeUpdate(query: string, _params: any[] = []): Promise<number> {
        return this.reject(query)
    }
    override executeUpdateReturningOneRow(query: string, _params: any[] = []): Promise<any> {
        return this.reject(query)
    }
    override executeUpdateReturningManyRows(query: string, _params: any[] = []): Promise<any[]> {
        return this.reject(query)
    }
    override executeUpdateReturningOneColumnOneRow(query: string, _params: any[] = []): Promise<any> {
        return this.reject(query)
    }
    override executeUpdateReturningOneColumnManyRows(query: string, _params: any[] = []): Promise<any[]> {
        return this.reject(query)
    }
    override executeDelete(query: string, _params: any[] = []): Promise<number> {
        return this.reject(query)
    }
    override executeDeleteReturningOneRow(query: string, _params: any[] = []): Promise<any> {
        return this.reject(query)
    }
    override executeDeleteReturningManyRows(query: string, _params: any[] = []): Promise<any[]> {
        return this.reject(query)
    }
    override executeDeleteReturningOneColumnOneRow(query: string, _params: any[] = []): Promise<any> {
        return this.reject(query)
    }
    override executeDeleteReturningOneColumnManyRows(query: string, _params: any[] = []): Promise<any[]> {
        return this.reject(query)
    }
    override executeProcedure(query: string, _params: any[] = []): Promise<void> {
        return this.reject(query)
    }
    override executeFunction(query: string, _params: any[] = []): Promise<any> {
        return this.reject(query)
    }
    override executeBeginTransaction(_opts: BeginTransactionOpts = []): Promise<void> {
        return this.reject('begin transaction')
    }
    override executeCommit(_opts: CommitOpts = []): Promise<void> {
        return this.reject('commit')
    }
    override executeRollback(_opts: RollbackOpts = []): Promise<void> {
        return this.reject('rollback')
    }
    override executeDatabaseSchemaModification(query: string, _params: any[] = []): Promise<void> {
        return this.reject(query)
    }
    override executeConnectionConfiguration(query: string, _params: any[] = []): Promise<void> {
        return this.reject(query)
    }
}
