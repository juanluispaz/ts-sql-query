import type { QueryType } from './QueryRunner.js'
import { MockQueryRunner } from './MockQueryRunner.js'
import { TsSqlProcessingError } from '../TsSqlError.js'

/**
 * A query runner that executes nothing: every query, and every statement of a transaction, is rejected with
 * `QUERY_NOT_ALLOWED`. For a connection made only to use its methods, like converting the types of its database
 * (`sqlDataTypeFrom`, `nativeSqlDataTypeOf`) in a generator: it writes the SQL of its database, as `NoopQueryRunner`
 * does, but nothing reaches a database. A MockQueryRunner whose executeMockedQuery rejects every query.
 */
export class NoExecutionQueryRunner extends MockQueryRunner {
    constructor() {
        super()
    }
    /** Every query and every statement of a transaction is rejected */
    protected override executeMockedQuery(_type: QueryType, query: string): never {
        throw queryNotAllowed(query)
    }
    /** The connection of the driver is never given: there is none */
    override execute<RESULT>(_fn: (connection: unknown) => Promise<RESULT>): Promise<RESULT> {
        return this.createRejectedPromise(queryNotAllowed('(the connection of the driver)'))
    }
}

/** The `QUERY_NOT_ALLOWED` error of a query, or of the connection of the driver */
function queryNotAllowed(query: string): TsSqlProcessingError {
    return new TsSqlProcessingError({ reason: 'QUERY_NOT_ALLOWED', query }, 'NoExecutionQueryRunner executes no query: ' + query)
}
