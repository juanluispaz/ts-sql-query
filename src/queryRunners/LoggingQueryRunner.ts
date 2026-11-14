import type { QueryRunner, QueryType } from './QueryRunner.js'
import { InterceptorQueryRunner } from './InterceptorQueryRunner.js'

/**
 * The functions a LoggingQueryRunner calls around each query, each one optional. The timestamps are in nanoseconds,
 * from an arbitrary origin: what matters is the difference between the two.
 */
export interface QueryLogger {
    /** Called before the query runs, with the instant it begins */
    onQuery?: ((queryType: QueryType, query: string, params: any[], timestamps: { startedAt: bigint }) => void) | undefined;
    /** Called when the query ends, with its result and the instants it began and ended */
    onQueryResult?: ((queryType: QueryType, query: string, params: any[], result: any, timestamps: { startedAt: bigint, endedAt: bigint }) => void) | undefined;
    /** Called when the query fails, with its error and the instants it began and ended */
    onQueryError?: ((queryType: QueryType, query: string, params: any[], error: any, timestamps: { startedAt: bigint, endedAt: bigint }) => void) | undefined;
}

/** The current instant in nanoseconds, from an arbitrary origin */
export function now(): bigint {
    if (typeof process !== 'undefined') {
        return process.hrtime.bigint()
    } else {
        return BigInt(Math.floor(performance.now() * 1000 * 1000))
    }
}

/**
 * A query runner that wraps another and logs each query, with the instant it began and, when it ends, the instant it
 * ended. Each query goes to logQuery before it runs, and to logQueryResult or logQueryError when it ends; by default
 * they call the functions of the logger given to the constructor. A class that extends it overrides them to log by
 * itself (to a tracer, a metrics system), and is created without a logger. An InterceptorQueryRunner whose payload is
 * the instant the query began.
 */
export class LoggingQueryRunner<T extends QueryRunner> extends InterceptorQueryRunner<bigint, T> {
    /** The functions logQuery, logQueryResult and logQueryError call by default; without one, nothing is called */
    readonly logger: QueryLogger

    /** A query runner that logs with the functions of the logger */
    constructor(logger: QueryLogger, queryRunner: T)
    /** A query runner whose logQuery, logQueryResult and logQueryError a subclass overrides */
    constructor(queryRunner: T)
    constructor(loggerOrQueryRunner: QueryLogger | T, maybeQueryRunner?: T) {
        if (maybeQueryRunner) {
            super(maybeQueryRunner)
            this.logger = loggerOrQueryRunner as QueryLogger
        } else {
            super(loggerOrQueryRunner as T)
            this.logger = noLogger
        }
    }

    onQuery(queryType: QueryType, query: string, params: any[]): bigint {
        const startedAt = now()
        this.logQuery(queryType, query, params, { startedAt })
        return startedAt
    }
    onQueryResult(queryType: QueryType, query: string, params: any[], result: any, startedAt: bigint): void {
        this.logQueryResult(queryType, query, params, result, { startedAt, endedAt: now() })
    }
    onQueryError(queryType: QueryType, query: string, params: any[], error: any, startedAt: bigint): void {
        this.logQueryError(queryType, query, params, error, { startedAt, endedAt: now() })
    }

    /** Logs a query before it runs; by default with onQuery of the logger */
    protected logQuery(queryType: QueryType, query: string, params: any[], timestamps: { startedAt: bigint }): void {
        const onQuery = this.logger.onQuery
        if (onQuery) {
            onQuery(queryType, query, params, timestamps)
        }
    }
    /** Logs a query that ended, with its result; by default with onQueryResult of the logger */
    protected logQueryResult(queryType: QueryType, query: string, params: any[], result: any, timestamps: { startedAt: bigint, endedAt: bigint }): void {
        const onQueryResult = this.logger.onQueryResult
        if (onQueryResult) {
            onQueryResult(queryType, query, params, result, timestamps)
        }
    }
    /** Logs a query that failed, with its error; by default with onQueryError of the logger */
    protected logQueryError(queryType: QueryType, query: string, params: any[], error: any, timestamps: { startedAt: bigint, endedAt: bigint }): void {
        const onQueryError = this.logger.onQueryError
        if (onQueryError) {
            onQueryError(queryType, query, params, error, timestamps)
        }
    }
}

/** The logger of a LoggingQueryRunner created without one: it calls nothing */
const noLogger: QueryLogger = {}
