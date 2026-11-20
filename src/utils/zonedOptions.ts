// The options of the arithmetic of a zoned date and time, as Temporal reads them: how a wall clock computed from one
// (by `with`, `round`, `withPlainTime`, `startOfDay`) is taken back to an instant in its zone. Temporal prefers the
// offset the value had (or the one given in the field `offset` of `with`) when it is still an offset of the zone for
// that wall clock, so a value in the hour a zone repeats stays in the same one; otherwise it disambiguates the wall
// clock, as `toZonedDateTime` does.

/** How a wall clock is disambiguated in a zone, as Temporal's option `disambiguation` */
export type ZonedDisambiguation = 'compatible' | 'earlier' | 'later' | 'reject'

/**
 * How a wall clock is taken to an instant in the zone of a zoned date and time, as Temporal's option `offset`: with
 * the offset ('use'), with it when the zone has it for that wall clock ('prefer'; 'reject' fails the query when the
 * zone hasn't), or disambiguated without it ('ignore')
 */
export interface ZonedInterpretation {
    readonly disambiguation: ZonedDisambiguation
    readonly offset: 'use' | 'prefer' | 'reject' | 'ignore'
    /** The offset preferred, in nanoseconds (the field `offset` of `with`); undefined for the one of the value */
    readonly offsetNanoseconds: bigint | undefined
}

/** A wall clock disambiguated as Temporal's 'compatible' (startOfDay, withPlainTime) */
export const compatibleInterpretation: ZonedInterpretation = { disambiguation: 'compatible', offset: 'ignore', offsetNanoseconds: undefined }

/** A wall clock with the offset of the value when the zone still has it, otherwise as 'compatible' (round) */
export const preferringOffsetInterpretation: ZonedInterpretation = { disambiguation: 'compatible', offset: 'prefer', offsetNanoseconds: undefined }

/** Whether the value is a disambiguation of Temporal */
export function isZonedDisambiguation(value: unknown): value is ZonedDisambiguation {
    return value === 'compatible' || value === 'earlier' || value === 'later' || value === 'reject'
}

const offsetPattern = /^([+-])(\d\d)(?::?(\d\d)(?::?(\d\d)(?:[.,](\d{1,9}))?)?)?$/

/** The nanoseconds of an offset written as Temporal reads it (`+01:00`, `-0330`, `+05:30:15.5`); undefined when it isn't one */
export function offsetNanosecondsOf(value: unknown): bigint | undefined {
    const match = typeof value === 'string' ? offsetPattern.exec(value) : null
    if (!match) {
        return undefined
    }
    const [, sign, hours, minutes, seconds, fraction] = match
    if (Number(hours) > 23 || Number(minutes ?? '0') > 59 || Number(seconds ?? '0') > 59) {
        return undefined
    }
    const total = ((BigInt(hours!) * 60n + BigInt(minutes ?? '0')) * 60n + BigInt(seconds ?? '0')) * 1_000_000_000n + BigInt(((fraction ?? '') + '000000000').slice(0, 9))
    return sign === '-' ? -total : total
}

/**
 * The interpretation the options of `with` of a zoned date and time ask for, and the offset of its field `offset`;
 * undefined when Temporal rejects them: a disambiguation or an offset option it hasn't, or an offset that isn't one
 */
export function zonedWithInterpretationOf(options: unknown, offsetField: unknown): ZonedInterpretation | undefined {
    if (options !== undefined && (options === null || typeof options !== 'object')) {
        return undefined
    }
    const given = (options ?? {}) as { disambiguation?: unknown, offset?: unknown }
    const disambiguation = given.disambiguation ?? 'compatible'
    const offset = given.offset ?? 'prefer'
    if (!isZonedDisambiguation(disambiguation) || (offset !== 'use' && offset !== 'prefer' && offset !== 'reject' && offset !== 'ignore')) {
        return undefined
    }
    let offsetNanoseconds: bigint | undefined
    if (offsetField !== undefined) {
        offsetNanoseconds = offsetNanosecondsOf(offsetField)
        if (offsetNanoseconds === undefined) {
            return undefined
        }
    }
    return { disambiguation, offset, offsetNanoseconds }
}
