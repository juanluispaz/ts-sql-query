import type { QueryRunner } from "./QueryRunner"
import { LoggingQueryRunner } from "./LoggingQueryRunner"

type TimeGranularity = 'ms' | 'us' | 'ns'

export interface ConsoleLogQueryRunnerOpts {
    timeGranularity?: TimeGranularity,
    logResults?: boolean;
    logTimestamps?: boolean;
    logDurations?: boolean;
}

export class ConsoleLogQueryRunner<T extends QueryRunner> extends LoggingQueryRunner<T> {
    constructor(queryRunner: T, opts?: ConsoleLogQueryRunnerOpts) {
        const logEnd = opts?.logResults || opts?.logDurations || opts?.logTimestamps;
        const timeGranularity = opts?.timeGranularity ?? 'ms';
        super({
            onQuery: (queryType, query, params, timestamps) => {
                const ts = opts?.logTimestamps
                    ? `[${formatDuration(timestamps.startedAt, timeGranularity)}]`
                    : '';
                console.log(`${ts} ${queryType}`, query, params);
            },
            onQueryResult: logEnd ? (queryType, query, params, result, timestamps) => {
                const ts = opts?.logTimestamps
                    ? `[${formatDuration(timestamps.endedAt, timeGranularity)}]`
                    : '';
                const duration = opts?.logDurations
                    ? `[Took ${
                        formatDuration( timestamps.endedAt - timestamps.startedAt, timeGranularity)
                    }${timeGranularity}]`
                    : '';
                console.log(`${ts}${duration} ${queryType}`, { query, params, result: opts?.logResults ? result : undefined })
            } : undefined,
            onQueryError: logEnd ? (queryType, query, params, error, timestamps) => {
                const ts = opts?.logTimestamps
                    ? `[${formatDuration(timestamps.endedAt, timeGranularity)}]`
                    : '';
                const duration = opts?.logDurations
                    ? `[Took ${
                        formatDuration( timestamps.endedAt - timestamps.startedAt, timeGranularity)
                    }${timeGranularity}]`
                    : '';
                console.log(`${ts}${duration} ${queryType}`, { query, params, error })
            } : undefined
        }, queryRunner)
    }
}

const formatDuration = (durationNS: bigint, granularity: TimeGranularity) => {
    switch (granularity) {
        case 'ns': return durationNS;
        case 'us': return durationNS/BigInt("1000");
        case 'ms': return durationNS/BigInt("1000000");
    }
}
