import type { QueryRunner, QueryType } from './QueryRunner.js'
import { InterceptorQueryRunner } from './InterceptorQueryRunner.js'
import { now } from './LoggingQueryRunner.js'

/** The unit the timestamps and the durations are written in */
export type TimeGranularity = 'ms' | 'us' | 'ns'

/**
 * The options of ConsoleLogQueryRunner: what each line written has, besides the type of the query, its SQL and its
 * params
 */
export interface ConsoleLogQueryRunnerOpts {
    /** The unit of the timestamps and the durations; milliseconds by default */
    timeGranularity?: TimeGranularity | undefined
    /** Write the instant each query begins and ends */
    logTimestamps?: boolean | undefined
    /** Write how long each query took */
    logDurations?: boolean | undefined
    /** Write the result of each query */
    logResults?: boolean | undefined
    /** Write the query and its params (and the result or the error) in one object */
    paramsAsObject?: boolean | undefined
    /** Write which call writes the line: onQuery, onQueryResult or onQueryError */
    includeLogPhase?: boolean | undefined
}

/**
 * A query runner that wraps another and writes each query with `console.log`: the type of the query, its SQL and its
 * params when it begins. With logResults, logDurations or logTimestamps, also when it ends, with its result or its
 * error.
 */
export class ConsoleLogQueryRunner<T extends QueryRunner> extends InterceptorQueryRunner<bigint, T> {
    private readonly opts: ConsoleLogQueryRunnerOpts
    private readonly logEnd: boolean
    private readonly timeGranularity: TimeGranularity

    constructor(queryRunner: T, opts: ConsoleLogQueryRunnerOpts = {}) {
        super(queryRunner)
        this.opts = opts
        this.logEnd = !!(opts.logResults || opts.logDurations || opts.logTimestamps)
        this.timeGranularity = opts.timeGranularity ?? 'ms'
    }

    onQuery(queryType: QueryType, query: string, params: any[]): bigint {
        const startedAt = now()
        const opts = this.opts
        const phase = opts.includeLogPhase ? ' (onQuery)' : ''
        const ts = opts.logTimestamps ? `[${formatDuration(startedAt, this.timeGranularity)}] ` : ''
        const separator = opts.logTimestamps ? ' ' : ''
        if (opts.paramsAsObject) {
            console.log(`${ts}${separator}${queryType}${phase}`, { query, params })
        } else {
            console.log(`${ts}${separator}${queryType}${phase}`, query, params)
        }
        return startedAt
    }
    onQueryResult(queryType: QueryType, query: string, params: any[], result: any, startedAt: bigint): void {
        if (!this.logEnd) {
            return
        }
        const opts = this.opts
        const prefix = this.endPrefix(queryType, startedAt, opts.includeLogPhase ? ' (onQueryResult)' : '')
        if (opts.logResults) {
            if (opts.paramsAsObject) {
                console.log(prefix, { query, params, result })
            } else {
                console.log(prefix, query, params, result)
            }
        } else {
            if (opts.paramsAsObject) {
                console.log(prefix, { query, params })
            } else {
                console.log(prefix, query, params)
            }
        }
    }
    onQueryError(queryType: QueryType, query: string, params: any[], error: any, startedAt: bigint): void {
        if (!this.logEnd) {
            return
        }
        const opts = this.opts
        const prefix = this.endPrefix(queryType, startedAt, opts.includeLogPhase ? ' (onQueryError)' : '')
        if (opts.paramsAsObject) {
            console.log(prefix, { query, params, error })
        } else {
            console.log(prefix, query, params, error)
        }
    }
    /** The start of the line written when a query ends: its timestamp, its duration, its type and the phase */
    private endPrefix(queryType: QueryType, startedAt: bigint, phase: string): string {
        const opts = this.opts
        const endedAt = now()
        const ts = opts.logTimestamps ? `[${formatDuration(endedAt, this.timeGranularity)}]` : ''
        const duration = opts.logDurations ? `[Took ${formatDuration(endedAt - startedAt, this.timeGranularity)}${this.timeGranularity}]` : ''
        const separator = opts.logTimestamps || opts.logDurations ? ' ' : ''
        return `${ts}${duration}${separator}${queryType}${phase}`
    }
}

/** A number of nanoseconds in the unit given, truncated */
function formatDuration(durationNS: bigint, granularity: TimeGranularity): bigint {
    switch (granularity) {
        case 'ns': return durationNS
        case 'us': return durationNS / 1000n
        case 'ms': return durationNS / 1000000n
    }
}
