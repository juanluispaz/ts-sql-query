import type { QueryRunner } from "./QueryRunner"
import { LoggingQueryRunner } from "./LoggingQueryRunner"

export type TimeGranularity = 'ms' | 'us' | 'ns'

export interface ConsoleLogQueryRunnerOpts {
    timeGranularity?: TimeGranularity
    logTimestamps?: boolean
    logDurations?: boolean
    logResults?: boolean
    paramsAsObject?: boolean
    includeLogPhase?: boolean
}

export class ConsoleLogQueryRunner<T extends QueryRunner> extends LoggingQueryRunner<T> {
    constructor(queryRunner: T, opts?: ConsoleLogQueryRunnerOpts) {
        const logEnd = opts?.logResults || opts?.logDurations || opts?.logTimestamps
        const timeGranularity = opts?.timeGranularity ?? 'ms'
        super({
            onQuery: (queryType, query, params, timestamps) => {
                const phase = opts?.includeLogPhase ? ' (onQuery)' : ''
                const ts = opts?.logTimestamps
                    ? `[${formatDuration(timestamps.startedAt, timeGranularity)}] `
                    : ''
                const separator = opts?.logTimestamps ? ' ' : ''
                if (opts?.paramsAsObject) {
                    console.log(`${ts}${separator}${queryType}${phase}`, { query, params })
                } else {
                    console.log(`${ts}${separator}${queryType}${phase}`, query, params)
                }
            },
            onQueryResult: logEnd ? (queryType, query, params, result, timestamps) => {
                const phase = opts?.includeLogPhase ? ' (onQueryResult)' : ''
                const ts = opts?.logTimestamps
                    ? `[${formatDuration(timestamps.endedAt, timeGranularity)}]`
                    : ''
                const duration = opts?.logDurations
                    ? `[Took ${
                        formatDuration( timestamps.endedAt - timestamps.startedAt, timeGranularity)
                    }${timeGranularity}]`
                    : ''
                const separator = opts?.logTimestamps ||  opts?.logDurations ? ' ' : ''
                if ( opts?.logResults) {
                    if (opts?.paramsAsObject) {
                        console.log(`${ts}${duration}${separator}${queryType}${phase}`, { query, params })
                    } else {
                        console.log(`${ts}${duration}${separator}${queryType}${phase}`, query, params)
                    }
                } else {
                    if (opts?.paramsAsObject) {
                        console.log(`${ts}${duration}${separator}${queryType}${phase}`, { query, params, result })
                    } else {
                        console.log(`${ts}${duration}${separator}${queryType}${phase}`, query, params, result)
                    }
                }
            } : undefined,
            onQueryError: logEnd ? (queryType, query, params, error, timestamps) => {
                const phase = opts?.includeLogPhase ? ' (onQueryError)' : ''
                const ts = opts?.logTimestamps
                    ? `[${formatDuration(timestamps.endedAt, timeGranularity)}]`
                    : ''
                const duration = opts?.logDurations
                    ? `[Took ${
                        formatDuration( timestamps.endedAt - timestamps.startedAt, timeGranularity)
                    }${timeGranularity}]`
                    : ''
                const separator = opts?.logTimestamps ||  opts?.logDurations ? ' ' : ''
                if (opts?.paramsAsObject) {
                    console.log(`${ts}${duration}${separator}${queryType}${phase}`, { query, params, error })
                } else {
                    console.log(`${ts}${duration}${separator}${queryType}${phase}`, query, params, error)
                }
            } : undefined
        }, queryRunner)
    }
}

const formatDuration = (durationNS: bigint, granularity: TimeGranularity) => {
    switch (granularity) {
        case 'ns': return durationNS
        case 'us': return durationNS/1000n
        case 'ms': return durationNS/1000000n
    }
}
