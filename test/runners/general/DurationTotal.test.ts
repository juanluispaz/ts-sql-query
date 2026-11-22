// total of a duration, compared with Temporal itself: the options as Temporal reads them (the same ones accepted and
// rejected; a date of reference given as a text or as fields isn't taken), and the function of the library on SQLite
// (the reference of the same function on the other databases): tsq_duration_total gives the number Temporal's total
// gives, to the last digit, over durations of every field and sign, dates of reference at the ends of the months, and
// every unit, and fails where Temporal throws.

import { describe, expect, test } from '../../lib/testRunner.js'
import { durationTotalOf } from '../../../src/utils/durationTotal.js'
import { sqliteScalarFunctions } from '../../../src/utils/sqlite/sqliteFunctions.js'
import { isTemporalTheReference } from '../../lib/temporalReference.js'

const durationTotal = sqliteScalarFunctions.find(f => f.name === 'tsq_duration_total')!.fn
const durationPart = sqliteScalarFunctions.find(f => f.name === 'tsq_duration_part')!.fn

const units = ['year', 'month', 'week', 'day', 'hour', 'minute', 'second', 'millisecond', 'microsecond', 'nanosecond']

/** A sequence of numbers that is the same on every run */
function numbers(seed: number): (n: number) => number {
    let state = seed
    return n => {
        state = (Math.imul(state, 1103515245) + 12345) & 0x7fffffff
        return (state >>> 8) % n
    }
}

describe('DurationTotal', () => {
    test('the-options-temporal-accepts-and-rejects', () => {
        const duration = Temporal.Duration.from('P1DT12H')
        const names = ['years', 'month', 'week', 'days', 'hour', 'minutes', 'second', 'millisecond', 'microseconds', 'nanosecond', 'auto', 'fortnight', undefined]
        const references = [undefined, Temporal.PlainDate.from('2024-01-31'), Temporal.PlainDateTime.from('2024-01-31T10:00')]
        const differences: string[] = []
        for (const unit of names) {
            const forms: unknown[] = [unit, { unit }]
            for (const relativeTo of references) {
                if (relativeTo !== undefined) {
                    forms.push({ unit, relativeTo })
                }
            }
            for (const options of forms) {
                let accepted = true
                try {
                    duration.total(options as any)
                } catch {
                    accepted = false
                }
                if (accepted !== (durationTotalOf(options) !== undefined)) {
                    differences.push(String(options === undefined ? options : JSON.stringify(options)))
                }
            }
        }
        expect(differences).toEqual([])
        // Temporal takes a text or the fields of a date too: a date of reference is a date or a date and time here
        expect(durationTotalOf({ unit: 'month', relativeTo: '2024-01-31' })).toBeUndefined()
        expect(durationTotalOf({ unit: 'month', relativeTo: { year: 2024, month: 1, day: 31 } })).toBeUndefined()
        expect(durationTotalOf({ unit: 'months', relativeTo: Temporal.PlainDateTime.from('2024-01-31T10:00') })).toEqual({ unit: 'month', relativeTo: { year: 2024, month: 1, day: 31 } })
    })

    // Its values are the ones of Temporal: compared where the Temporal of the runtime gives the ones of the specification
    test.skipIf(!isTemporalTheReference())('tsq-duration-total-gives-the-total-of-temporal', () => {
        const next = numbers(20261121)
        const differences: string[] = []
        let compared = 0
        let rejected = 0
        while (compared < 4000) {
            const sign = next(5) < 2 ? -1 : 1
            const small = next(2) === 0
            const fields: Record<string, number> = {}
            if (next(10) < 3) fields['years'] = sign * next(small ? 4 : 200)
            if (next(10) < 4) fields['months'] = sign * next(small ? 15 : 3000)
            if (next(10) < 2) fields['weeks'] = sign * next(small ? 7 : 2000)
            if (next(2)) fields['days'] = sign * next(small ? 41 : 100000)
            if (next(2)) fields['hours'] = sign * next(small ? 31 : 2000000)
            if (next(10) < 4) fields['minutes'] = sign * next(200)
            if (next(10) < 4) fields['seconds'] = sign * next(200)
            if (next(10) < 3) fields['milliseconds'] = sign * next(1000)
            if (next(10) < 3) fields['microseconds'] = sign * next(1000)
            if (next(10) < 3) fields['nanoseconds'] = sign * next(1000)
            const duration = Temporal.Duration.from(Object.keys(fields).length ? fields : { days: 0 })
            const unit = units[next(10)]!
            const relativeTo = next(4) === 0 ? undefined : Temporal.PlainDate.from({ year: 1800 + next(400), month: 1 + next(12), day: next(5) < 3 ? [1, 28, 29, 30, 31][next(5)]! : 1 + next(31) })
            let expected: number | 'rejected'
            try {
                expected = duration.total(relativeTo ? { unit: unit as any, relativeTo } : { unit: unit as any })
            } catch {
                expected = 'rejected'
            }
            const text = duration.toString()
            let got: unknown
            try {
                got = durationTotal(durationPart(text, 'M'), durationPart(text, 'weeks'), durationPart(text, 'days'), durationPart(text, 'S'), durationPart(text, 'N'), relativeTo?.year ?? 0, relativeTo?.month ?? 0, relativeTo?.day ?? 0, unit)
            } catch {
                got = 'rejected'
            }
            compared++
            if (expected === 'rejected') {
                rejected++
            }
            if (!Object.is(got, expected) && !(got === 0 && expected === 0)) {
                differences.push(text + ' in ' + unit + ' from ' + String(relativeTo) + ': ' + String(expected) + ' got ' + String(got))
            }
        }
        expect(differences).toEqual([])
        expect(rejected).toBeGreaterThan(100)
        expect(durationTotal(null, 0, 1, 0, 0, 0, 0, 0, 'day')).toBeNull()
        expect(durationTotal(0, 0, 1, 0, 0, null, 1, 1, 'day')).toBeNull()
    })
})
