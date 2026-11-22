// The options of until, since and round of an instant, as Temporal reads them: the same options accepted and
// rejected, over a grid of units, increments and modes; until computed as the difference of the wall clocks in UTC with
// the options given to a date and time gives Temporal's duration; and the function of SQLite that writes the text of a
// duration reads an integer given as its text, as the library gives it one beyond 2^53, and fails for a real.

import { describe, expect, test } from '../../lib/testRunner.js'
import { instantDifferenceOptionsOf, instantRoundingOf } from '../../../src/utils/instantOptions.js'
import { plainTemporalDifferenceOf } from '../../../src/utils/plainTemporalDifference.js'
import { sqliteScalarFunctions } from '../../../src/utils/sqlite/sqliteFunctions.js'
import { isTemporalTheReference } from '../../lib/temporalReference.js'

const durationText = sqliteScalarFunctions.find(f => f.name === 'tsq_duration_text')!.fn
const durationTotal = sqliteScalarFunctions.find(f => f.name === 'tsq_duration_total')!.fn

const from = Temporal.Instant.from('1969-12-31T23:59:30.5Z')
const to = Temporal.Instant.from('2024-03-15T10:00:00.123456789Z')
const units = [undefined, 'auto', 'year', 'month', 'week', 'day', 'days', 'hour', 'hours', 'minute', 'second', 'seconds', 'millisecond', 'microsecond', 'nanosecond', 'nanoseconds', 'fortnight']
const increments = [undefined, 1, 2, 5, 7, 10, 12, 15, 24, 30, 60, 90, 120, 1000, 1440, 86400, 2.7, 0]
const modes = [undefined, 'trunc', 'floor', 'halfEven', 'nearest']

describe('InstantOptions', () => {
    // Its values are the ones of Temporal: compared where the Temporal of the runtime gives the ones of the specification
    test.skipIf(!isTemporalTheReference())('until-takes-the-options-temporal-takes-with-its-result', () => {
        const differences: string[] = []
        const fromInUtc = from.toZonedDateTimeISO('UTC').toPlainDateTime()
        const toInUtc = to.toZonedDateTimeISO('UTC').toPlainDateTime()
        for (const largestUnit of units) for (const smallestUnit of units) for (const roundingIncrement of increments) for (const roundingMode of modes) {
            const options: Record<string, unknown> = {}
            if (largestUnit !== undefined) options['largestUnit'] = largestUnit
            if (smallestUnit !== undefined) options['smallestUnit'] = smallestUnit
            if (roundingIncrement !== undefined) options['roundingIncrement'] = roundingIncrement
            if (roundingMode !== undefined) options['roundingMode'] = roundingMode
            let expected: string | undefined
            try {
                expected = from.until(to, options as any).toString()
            } catch {
                expected = undefined
            }
            const normalized = instantDifferenceOptionsOf(options)
            const accepted = normalized !== undefined && plainTemporalDifferenceOf(normalized, 'timestamp', false) !== undefined
            if (accepted !== (expected !== undefined)) {
                differences.push(JSON.stringify(options) + (accepted ? ' accepted' : ' rejected'))
            } else if (expected !== undefined && fromInUtc.until(toInUtc, normalized as any).toString() !== expected) {
                differences.push(JSON.stringify(options) + ' gives ' + fromInUtc.until(toInUtc, normalized as any).toString() + ', Temporal ' + expected)
            }
        }
        expect(differences).toEqual([])
        expect(instantDifferenceOptionsOf('second')).toBeUndefined()
    })

    test('round-takes-the-options-temporal-takes', () => {
        const differences: string[] = []
        for (const smallestUnit of units) for (const roundingIncrement of increments) for (const roundingMode of modes) {
            const options: Record<string, unknown> = { smallestUnit }
            if (roundingIncrement !== undefined) options['roundingIncrement'] = roundingIncrement
            if (roundingMode !== undefined) options['roundingMode'] = roundingMode
            let accepted = true
            try {
                from.round(options as any)
            } catch {
                accepted = false
            }
            if (accepted !== (instantRoundingOf(options) !== undefined)) {
                differences.push(JSON.stringify(options))
            }
        }
        expect(differences).toEqual([])
        // A unit alone, as Temporal takes it; halfExpand by default
        expect(instantRoundingOf('minute')).toEqual({ step: 60_000_000_000n, mode: 'halfExpand' })
        expect(instantRoundingOf({ smallestUnit: 'minute', roundingIncrement: 1440, roundingMode: 'floor' })).toEqual({ step: 86_400_000_000_000n, mode: 'trunc' })
    })

    test('the-text-of-a-duration-of-sqlite-reads-an-integer-given-as-text', () => {
        // 4880353340.123 seconds: more nanoseconds than a double holds exactly
        expect(durationText(0, 0, 0, 0, '4880353340123000000', 'second')).toBe('PT4880353340.123S')
        expect(durationText(0, 0, 0, 0, '-4880353340123000000', 'hour')).toBe('-PT1355653H42M20.123S')
        // A real, which SQLite gives for an integer beyond its 64 bits (a difference of more than 292 years): an error
        let error = 'no error'
        try {
            durationText(0, 0, 0, 0, '1.10770596301220e+19', 'hour')
        } catch (e) {
            error = (e as Error).message
        }
        expect(error).toBe("tsq_duration_text: the nanoseconds of the time don't fit in the 64-bit integers of SQLite")
    })

    test('the-total-of-a-duration-of-sqlite-reads-the-nanoseconds-given-as-text', () => {
        // The total of a difference gives its nanoseconds as text: 4880353340.5 seconds are 1355653.70625 hours
        expect(durationTotal(0, 0, 0, 0, '4880353340500000000', 0, 0, 0, 'hour')).toBe(Temporal.Duration.from({ seconds: 4880353340, milliseconds: 500 }).total('hours'))
        // A real, which SQLite gives for an integer beyond its 64 bits (a difference of more than 292 years): an error
        let error = 'no error'
        try {
            durationTotal(0, 0, 0, 0, '1.26370818451235e+19', 0, 0, 0, 'hour')
        } catch (e) {
            error = (e as Error).message
        }
        expect(error).toBe("tsq_duration_total: the nanoseconds of the time don't fit in the 64-bit integers of SQLite")
    })
})
