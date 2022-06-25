import type { QueryRunner } from "./QueryRunner"
import { LoggingQueryRunner } from "./LoggingQueryRunner"

export interface ConsoleLogQueryRunnerOpts {
    logResults?: boolean;
    logTimestamps?: boolean;
    logDurations?: boolean;
}

export class ConsoleLogQueryRunner<T extends QueryRunner> extends LoggingQueryRunner<T> {
    constructor(queryRunner: T, opts?: ConsoleLogQueryRunnerOpts) {
        const logEnd = opts?.logResults || opts?.logDurations || opts?.logTimestamps;
        super({
            onQuery: (queryType, query, params, timestamps) => {
                const ts = opts?.logTimestamps ? `[${timestamps.startedAt}]` : '';
                console.log(`${ts} ${queryType}`, query, params);
            },
            onQueryResult: logEnd ? (queryType, query, params, result, timestamps) => {
                const ts = opts?.logTimestamps ? `[${timestamps.endedAt}]` : '';
                const duration = opts?.logDurations ? `[Took ${(timestamps.endedAt - timestamps.startedAt)}ns]` : '';
                console.log(`${ts}${duration} ${queryType}`, { query, params, result })
            } : undefined,
            onQueryError: logEnd ? (queryType, query, params, error, timestamps) => {
                const ts = opts?.logTimestamps ? `[${timestamps.endedAt}]` : '';
                const duration = opts?.logDurations ? `[Took ${(timestamps.endedAt - timestamps.startedAt)}ns]` : '';
                console.log(`${ts}${duration} ${queryType}`, { query, params, error })
            } : undefined
        }, queryRunner)
    }
}
