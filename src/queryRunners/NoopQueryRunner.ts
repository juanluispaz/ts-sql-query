import type { DatabaseType, PromiseProvider, QueryType } from './QueryRunner.js'
import { MockQueryRunner } from './MockQueryRunner.js'
import { getQueryContext } from '../QueryContext.js'

/** The options of NoopQueryRunner */
export interface NoopQueryRunnerConfig {
    /** The database whose SQL is written; the connection tells it when omitted */
    database?: DatabaseType | undefined
    /** The provider of the promises, like `SynchronousPromise`; the global `Promise` by default */
    promise?: PromiseProvider | undefined
    /** Whether a transaction can begin inside another one; false by default */
    allowNestedTransactions?: boolean | undefined
}

/**
 * The function of a MockQueryRunner that answers every query as a database without rows: no row, no rows, no row
 * changed, and a count of 0 for the count of a page. The one of `NoopQueryRunner`.
 */
export function noopQueryExecutor(type: QueryType, query: string, params: any[]): any {
    if (type === 'insert') {
        return 0
    }
    if (type === 'selectOneColumnOneRow' && getQueryContext(query, params).isSelectPageCount) {
        // The count of a page of no rows: the query can't find out by other means
        return 0
    }
    return undefined
}

/**
 * A query runner that executes nothing and answers every query as a database without rows: a MockQueryRunner with
 * noopQueryExecutor as its function. The SQL is written for its database, so wrapped in a `ConsoleLogQueryRunner` it
 * shows the SQL each call writes.
 */
export class NoopQueryRunner extends MockQueryRunner {
    constructor(config: NoopQueryRunnerConfig = {}) {
        super(noopQueryExecutor, { database: config.database, promise: config.promise, allowNestedTransactions: config.allowNestedTransactions ?? false })
    }
}
