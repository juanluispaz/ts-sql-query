// What the query runners do with an instant (a Temporal.Instant): the wall clock of its instant in UTC, which every
// database stores in a column without zone (the database being in UTC) and converts into a column with zone, and the
// text of PostgreSQL, with its offset.

import { __temporalIfAvailable, type TemporalPlainDateTime, type TemporalZonedDateTime } from '../typeSystem/temporal.js'
import { plainTemporalText } from './plainTemporalValues.js'

/** Whether the value is a Temporal.Instant */
export function isInstantValue(value: unknown): boolean {
    if (value === null || typeof value !== 'object') {
        return false
    }
    const temporal = __temporalIfAvailable()
    return !!temporal && value instanceof temporal.Instant
}

/**
 * The wall clock in UTC of an instant, with all its digits, sent as a Temporal value without zone is (the database
 * being in UTC, it is the wall clock a column without zone keeps, and the one a column with zone converts from the zone
 * of the session); undefined for any other value
 */
export function instantUtcDateTime(value: unknown): TemporalPlainDateTime | undefined {
    if (!isInstantValue(value)) {
        return undefined
    }
    return (value as { toZonedDateTimeISO(zone: string): { toPlainDateTime(): TemporalPlainDateTime } }).toZonedDateTimeISO('UTC').toPlainDateTime()
}

/**
 * The text of an instant as PostgreSQL reads it: its wall clock in UTC with the offset `+00`, which makes it the same
 * value for a `timestamptz` and for a `timestamp` (that ignores the offset), and the era for a year before 1
 * (`0044-03-15 09:15:30+00 BC`); undefined for any other value
 */
export function postgreSqlInstantText(value: unknown): string | undefined {
    const dateTime = instantUtcDateTime(value)
    if (!dateTime) {
        return undefined
    }
    const text = plainTemporalText(dateTime, true)!
    return text.endsWith(' BC') ? text.slice(0, -3) + '+00 BC' : text + '+00'
}

/** Whether the value is a Temporal.ZonedDateTime (false when the runtime has no Temporal) */
export function isZonedDateTimeValue(value: unknown): value is TemporalZonedDateTime {
    const temporal = __temporalIfAvailable()
    return temporal !== undefined && value instanceof temporal.ZonedDateTime
}
