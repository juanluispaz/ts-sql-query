/**
 * Whether the Temporal of the runtime gives the values of the specification in the cases where an implementation was
 * seen to give others: a test that takes Temporal as the reference of exact values compares with it only then. Bun's
 * Temporal gives them; Node 26.1's adds and subtracts durations, totals them and computes until wrongly, Node 26.13.1
 * (the one of the CI of GitHub) rounds until and since to a calendar unit one unit up (3 years and 4 days
 * rounded half down to the month is P3Y1M, 45 months exactly rounded to the week P45M1W), and the polyfill of Node 22
 * and 24 (temporal-polyfill) rounds a total one unit off its last digit and accepts `smallestUnit: 'auto'` in until.
 */
export function isTemporalTheReference(): boolean {
    const T = globalThis.Temporal
    try {
        return T.Duration.from('-PT4H').subtract('-P20D').toString() === 'P19DT20H'
            && T.Duration.from('P38D').add('PT18.000492S').toString() === 'P38DT18.000492S'
            && T.Duration.from('P11M28DT173M').total({ unit: 'day', relativeTo: '2008-05-28' }) === 363.1201388888889
            && T.Duration.from('PT27H0.651915S').total({ unit: 'millisecond', relativeTo: '2060-02-29' }) === 97200651.915
            && T.Duration.from('P4MT6H').total({ unit: 'month', relativeTo: '1829-10-29' }) === 4.008620689655173
            && T.PlainDateTime.from('2026-04-16T03:39:39.934').since('2020-11-17T22:51:39', { largestUnit: 'year', smallestUnit: 'microsecond', roundingMode: 'ceil' }).toString() === 'P5Y4M28DT4H48M0.934S'
            && T.PlainDate.from('2024-10-29').since('2021-10-25', { largestUnit: 'year', smallestUnit: 'month', roundingMode: 'halfFloor' }).toString() === 'P3Y'
            && T.PlainDate.from('2021-01-28').until('2024-10-28', { largestUnit: 'month', smallestUnit: 'week', roundingMode: 'halfTrunc' }).toString() === 'P45M'
            && rejects(() => T.Instant.from('2024-01-01T00:00:00Z').until('2024-01-02T00:00:00Z', { smallestUnit: 'auto' } as never))
    } catch {
        return false
    }
}

function rejects(operation: () => unknown): boolean {
    try {
        operation()
        return false
    } catch {
        return true
    }
}
