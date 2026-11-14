import type { DatabaseType, PromiseProvider } from './QueryRunner.js'
import { MockQueryRunner } from './MockQueryRunner.js'

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
 * A query runner that executes nothing and answers every query as a database without rows: a MockQueryRunner without
 * a function (so with noopQueryExecutor), that rejects a transaction inside another one by default. The SQL is written
 * for its database, so wrapped in a `ConsoleLogQueryRunner` it shows the SQL each call writes.
 */
export class NoopQueryRunner extends MockQueryRunner {
    constructor(config: NoopQueryRunnerConfig = {}) {
        super({ database: config.database, promise: config.promise, allowNestedTransactions: config.allowNestedTransactions ?? false })
    }
}
