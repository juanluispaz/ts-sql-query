// until and since of the dates and times without zone, compared with Temporal itself: the options as Temporal reads
// them (the same ones accepted and rejected), and the functions of the library on SQLite (the reference of the same
// functions on the other databases): tsq_duration_text writes the text Temporal's toString writes, and
// tsq_duration_round gives the duration of Temporal's until rounded to the calendar, over values that cross the ends of
// the months, leap days, negative durations and every mode.

import { describe, expect, test } from '../../lib/testRunner.js'
import { plainTemporalDifferenceOf } from '../../../src/utils/plainTemporalDifference.js'
import { sqliteScalarFunctions } from '../../../src/utils/sqlite/sqliteFunctions.js'

const durationText = sqliteScalarFunctions.find(f => f.name === 'tsq_duration_text')!.fn
const durationRound = sqliteScalarFunctions.find(f => f.name === 'tsq_duration_round')!.fn

const units = ['year', 'month', 'week', 'day', 'hour', 'minute', 'second', 'millisecond', 'microsecond', 'nanosecond']
const modes = ['ceil', 'floor', 'expand', 'trunc', 'halfCeil', 'halfFloor', 'halfExpand', 'halfTrunc', 'halfEven']

/** A sequence of numbers that is the same on every run */
function numbers(seed: number): (n: number) => number {
    let state = seed
    return n => {
        state = (Math.imul(state, 1103515245) + 12345) & 0x7fffffff
        return (state >>> 8) % n
    }
}

function nanosecondsOf(time: Temporal.PlainTime): bigint {
    return BigInt(time.hour) * 3_600_000_000_000n + BigInt(time.minute) * 60_000_000_000n + BigInt(time.second) * 1_000_000_000n + BigInt(time.millisecond) * 1_000_000n + BigInt(time.microsecond) * 1000n + BigInt(time.nanosecond)
}

describe('PlainTemporalDifference', () => {
    test('the-options-temporal-accepts-and-rejects', () => {
        const values = { date: Temporal.PlainDate.from('2024-01-31'), time: Temporal.PlainTime.from('10:00'), timestamp: Temporal.PlainDateTime.from('2024-01-31T10:00') }
        const others = { date: Temporal.PlainDate.from('2024-05-01'), time: Temporal.PlainTime.from('12:00'), timestamp: Temporal.PlainDateTime.from('2024-05-01T12:00') }
        const names = [undefined, 'auto', 'years', 'month', 'week', 'days', 'hour', 'minutes', 'second', 'millisecond', 'microseconds', 'nanosecond', 'fortnight']
        const differences: string[] = []
        for (const fields of ['date', 'time', 'timestamp'] as const) {
            for (const largestUnit of names) {
                for (const smallestUnit of names) {
                    for (const roundingIncrement of [undefined, 1, 2.7, 7, 15, 24, 0, '5']) {
                        for (const roundingMode of [undefined, 'halfEven', 'up']) {
                            const options: Record<string, unknown> = {}
                            if (largestUnit !== undefined) options['largestUnit'] = largestUnit
                            if (smallestUnit !== undefined && smallestUnit !== 'auto') options['smallestUnit'] = smallestUnit
                            if (roundingIncrement !== undefined) options['roundingIncrement'] = roundingIncrement
                            if (roundingMode !== undefined) options['roundingMode'] = roundingMode
                            let accepted = true
                            try {
                                (values[fields] as any).until(others[fields], options)
                            } catch {
                                accepted = false
                            }
                            if (accepted !== (plainTemporalDifferenceOf(options, fields, false) !== undefined)) {
                                differences.push(fields + ' ' + JSON.stringify(options))
                            }
                        }
                    }
                }
            }
        }
        expect(differences).toEqual([])
    })

    test('since-negates-the-mode', () => {
        expect(plainTemporalDifferenceOf({ smallestUnit: 'month', roundingMode: 'ceil' }, 'date', true)).toEqual({ largestUnit: 'month', smallestUnit: 'month', increment: 1, mode: 'floor', negated: true })
        expect(plainTemporalDifferenceOf(undefined, 'time', false)).toEqual({ largestUnit: 'hour', smallestUnit: 'nanosecond', increment: 1, mode: 'trunc', negated: false })
    })

    test('tsq-duration-text-writes-the-text-of-temporal', () => {
        const fields: Array<[number, number, number, number, bigint, string]> = [
            [0, 0, 0, 0, 0n, 'hour'],
            [1, 2, 3, 4, 5_025_500_000_000n, 'hour'],
            [-1, -2, 0, -4, -1_500_000_000n, 'hour'],
            [0, 0, 0, 0, 5_400_000_000_000n, 'minute'],
            [0, 0, 0, 0, 5_400_000_000_123n, 'second'],
            [0, 0, 0, 3, 0n, 'hour'],
            [0, 0, 0, 0, 500_000n, 'hour'],
            [0, 0, 0, 0, 90_000_000_000_000n, 'day'],
            [0, 0, 0, 0, 3_600_000_000_000n, 'day'],
            [0, 0, 0, 0, -781_200_000_000_000n, 'week'],
            [0, 0, 0, 10, 0n, 'week'],
        ]
        expect(fields.map(([years, months, weeks, days, nanoseconds, unit]) => durationText(years, months, weeks, days, nanoseconds, unit))).toEqual([
            'PT0S', 'P1Y2M3W4DT1H23M45.5S', '-P1Y2M4DT1.5S', 'PT90M', 'PT5400.000000123S', 'P3D', 'PT0.0005S', 'P1DT1H', 'PT1H', '-P1W2DT1H', 'P1W3D',
        ])
        expect(durationText(null, 0, 0, 0, 0, 'hour')).toBeNull()
    })

    test('tsq-duration-round-gives-the-duration-of-temporal', () => {
        const next = numbers(20261120)
        const differences: string[] = []
        let compared = 0
        while (compared < 4000) {
            const withTime = next(2) === 0
            const options: Record<string, unknown> = { largestUnit: ['year', 'month', 'week'][next(3)], smallestUnit: units[next(withTime ? 10 : 4)] }
            if (next(2)) options['roundingMode'] = modes[next(9)]
            if (next(3) === 0) options['roundingIncrement'] = 1 + next(5)
            const since = next(2) === 0
            const year = 2020 + next(8)
            const month = 1 + next(12)
            const first = Temporal.PlainDate.from({ year, month, day: 1 }).add({ days: next(2) === 0 ? 27 + next(4) : next(28) })
            const second = next(4) === 0 ? first.add({ days: next(40) - 20 }) : Temporal.PlainDate.from({ year: 2020 + next(8), month: 1 + next(12), day: 1 }).add({ days: next(31) })
            const time1 = withTime ? Temporal.PlainTime.from('00:00').add({ seconds: next(86400), milliseconds: next(1000) }) : Temporal.PlainTime.from('00:00')
            const time2 = withTime ? Temporal.PlainTime.from('00:00').add({ seconds: next(86400) }) : Temporal.PlainTime.from('00:00')
            const one: any = withTime ? first.toPlainDateTime(time1) : first
            const two: any = withTime ? second.toPlainDateTime(time2) : second
            let expected: string
            try {
                expected = (since ? one.since(two, options) : one.until(two, options)).toString()
            } catch {
                continue
            }
            const difference = plainTemporalDifferenceOf(options, withTime ? 'timestamp' : 'date', since)!
            const got = durationRound(first.year, first.month, first.day, nanosecondsOf(time1), second.year, second.month, second.day, nanosecondsOf(time2), difference.largestUnit, difference.smallestUnit, difference.increment, difference.mode, since ? -1 : 1)
            compared++
            if (got !== expected) {
                differences.push(one.toString() + (since ? ' since ' : ' until ') + two.toString() + ' ' + JSON.stringify(options) + ': ' + expected + ' got ' + String(got))
            }
        }
        expect(differences).toEqual([])
        expect(durationRound(null, 1, 1, 0, 2024, 1, 1, 0, 'month', 'month', 1, 'trunc', 1)).toBeNull()
    })
})
