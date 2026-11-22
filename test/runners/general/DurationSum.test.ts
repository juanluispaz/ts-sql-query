// Durations added and subtracted together, compared with Temporal itself: the function of the library on SQLite (the
// reference of the same function on the other databases), tsq_duration_add, over the parts tsq_duration_part reads of
// each text ('largest', the largest field that isn't zero; the days; the whole seconds; the nanoseconds), gives the
// text of Temporal's add and subtract, balanced up to the largest field of the two, over durations of every field and
// sign, and fails where Temporal throws (a duration with years, months or weeks).

import { describe, expect, test } from '../../lib/testRunner.js'
import { sqliteScalarFunctions } from '../../../src/utils/sqlite/sqliteFunctions.js'
import { isTemporalTheReference } from '../../lib/temporalReference.js'

const durationAdd = sqliteScalarFunctions.find(f => f.name === 'tsq_duration_add')!.fn
const durationPart = sqliteScalarFunctions.find(f => f.name === 'tsq_duration_part')!.fn

/** A sequence of numbers that is the same on every run */
function numbers(seed: number): (n: number) => number {
    let state = seed
    return n => {
        state = (Math.imul(state, 1103515245) + 12345) & 0x7fffffff
        return (state >>> 8) % n
    }
}

function durationOf(next: (n: number) => number): Temporal.Duration {
    const sign = next(5) < 2 ? -1 : 1
    const fields: Record<string, number> = {}
    const names = ['years', 'months', 'weeks', 'days', 'hours', 'minutes', 'seconds', 'milliseconds', 'microseconds', 'nanoseconds']
    const limits = [4, 15, 6, 41, 61, 151, 151, 1000, 1000, 1000]
    names.forEach((name, i) => {
        if (next(10) < (i < 3 ? 1 : 4)) {
            fields[name] = sign * next(limits[i]!)
        }
    })
    return Temporal.Duration.from(Object.keys(fields).length ? fields : { days: 0 })
}

describe('DurationSum', () => {
    test('the-largest-field-of-a-duration-kept-as-text', () => {
        const texts = ['P1Y', 'P2M', '-P1W', 'P3D', 'PT4H', 'PT90M', '-PT5S', 'PT1.5S', 'PT0.5S', 'PT0.0005S', 'PT0.000000005S', 'PT0S', 'P0DT0S', 'P1DT0.000001S']
        expect(texts.map(text => durationPart(text, 'largest'))).toEqual([0, 1, 2, 3, 4, 5, 6, 6, 7, 8, 9, 10, 10, 3])
        expect(durationPart(null, 'largest')).toBeNull()
    })

    // Its values are the ones of Temporal: compared where the Temporal of the runtime gives the ones of the specification
    test.skipIf(!isTemporalTheReference())('tsq-duration-add-gives-the-sum-of-temporal', () => {
        const next = numbers(20261122)
        const differences: string[] = []
        let rejected = 0
        for (let i = 0; i < 4000; i++) {
            const one = durationOf(next)
            const other = durationOf(next)
            const subtract = next(2) === 0
            let expected: string
            try {
                expected = (subtract ? one.subtract(other) : one.add(other)).toString()
            } catch {
                expected = 'rejected'
                rejected++
            }
            const parts = (text: string) => [durationPart(text, 'largest'), durationPart(text, 'days'), durationPart(text, 'S'), durationPart(text, 'N')]
            let got: unknown
            try {
                got = durationAdd(...parts(one.toString()), ...parts(other.toString()), subtract ? -1 : 1)
            } catch {
                got = 'rejected'
            }
            if (got !== expected) {
                differences.push(one.toString() + (subtract ? ' - ' : ' + ') + other.toString() + ': ' + expected + ' got ' + String(got))
            }
        }
        expect(differences).toEqual([])
        expect(rejected).toBeGreaterThan(100)
        expect(durationAdd(null, 0, 0, 0, 10, 0, 0, 0, 1)).toBeNull()
    })
})
