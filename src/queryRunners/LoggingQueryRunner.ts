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
 * A query runner that wraps another and gives each query to a logger: an object with the functions to call before the
 * query runs and when it ends, with the instant it began and the one it ended. An InterceptorQueryRunner whose payload
 * is the instant the query began.
 */
export class LoggingQueryRunner<T extends QueryRunner> extends InterceptorQueryRunner<bigint, T> {
    /** The functions called around each query */
    readonly logger: QueryLogger

    constructor(logger: QueryLogger, queryRunner: T) {
        super(queryRunner)
        this.logger = logger
    }

    onQuery(queryType: QueryType, query: string, params: any[]): bigint {
        const startedAt = now()
        const onQuery = this.logger.onQuery
        if (onQuery) {
            onQuery(queryType, query, params, { startedAt })
        }
        return startedAt
    }
    onQueryResult(queryType: QueryType, query: string, params: any[], result: any, startedAt: bigint): void {
        const onQueryResult = this.logger.onQueryResult
        if (onQueryResult) {
            onQueryResult(queryType, query, params, result, { startedAt, endedAt: now() })
        }
    }
    onQueryError(queryType: QueryType, query: string, params: any[], error: any, startedAt: bigint): void {
        const onQueryError = this.logger.onQueryError
        if (onQueryError) {
            onQueryError(queryType, query, params, error, { startedAt, endedAt: now() })
        }
    }
}
