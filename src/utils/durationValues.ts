// The durations (Temporal.Duration) as the library sends and reads them: the ISO 8601 text each database reads, and
// the forms the databases deliver.

import { __temporal, __temporalIfAvailable, type TemporalDuration } from '../typeSystem/temporal.js'

/** Whether the value is a Temporal.Duration */
export function isDurationValue(value: unknown): value is TemporalDuration {
    const temporal = value !== null && typeof value === 'object' ? __temporalIfAvailable() : undefined
    return !!temporal && value instanceof temporal.Duration
}

/** The fields of a duration, from the largest */
const fieldNames = ['years', 'months', 'weeks', 'days', 'hours', 'minutes', 'seconds', 'milliseconds', 'microseconds', 'nanoseconds'] as const
type Fields = { [name in typeof fieldNames[number]]?: number }

/**
 * The duration of its fields, which must all have the same sign, as in Temporal; undefined when they mix signs (a
 * PostgreSQL interval can: `-1 days +02:03:00`) or are out of the range of a Temporal.Duration
 */
function durationOf(fields: Fields, typeName: string): TemporalDuration | undefined {
    let sign = 0
    for (const name of fieldNames) {
        const value = fields[name]
        if (value) {
            if (sign !== 0 && Math.sign(value) !== sign) {
                return undefined
            }
            sign = Math.sign(value)
        }
    }
    try {
        return __temporal(typeName).Duration.from(fields)
    } catch {
        return undefined
    }
}

/** The fields of the digits of a fraction of a second (up to 9 digits), with the sign given */
function fractionFields(fraction: string | undefined, sign: number): Fields {
    const digits = ((fraction ?? '') + '000000000').slice(0, 9)
    return { milliseconds: sign * Number(digits.slice(0, 3)), microseconds: sign * Number(digits.slice(3, 6)), nanoseconds: sign * Number(digits.slice(6, 9)) }
}

// PostgreSQL's output with IntervalStyle 'postgres', the default: `1 year 2 mons 3 days 04:05:06.789`, `-1 days -02:00:00`
const postgresStyle = /^(?:(-?\d+) years? ?)?(?:(-?\d+) mons? ?)?(?:(-?\d+) days? ?)?(?:([-+])?(\d+):(\d\d):(\d\d)(?:\.(\d+))?)?$/
// The text of an interval of Oracle, as it converts one to a text (an OUT bind of a RETURNING): `+000000003 04:05:06.789000000`
// (days to seconds), `-000000001-02` (years to months)
const oracleDayToSecond = /^([-+])?(\d+) (\d+):(\d\d):(\d\d)(?:\.(\d+))?$/
const oracleYearToMonth = /^([-+])?(\d+)-(\d+)$/
// ISO 8601, also with a sign in each field (PostgreSQL's IntervalStyle 'iso_8601': `P-1DT-2H`)
const isoStyle = /^([-+])?P(?:(-?\d+)Y)?(?:(-?\d+)M)?(?:(-?\d+)W)?(?:(-?\d+)D)?(?:T(?:(-?\d+)H)?(?:(-?\d+)M)?(?:(-?\d+)(?:[.,](\d+))?S)?)?$/i

/**
 * The duration of a value a database delivers: a Temporal.Duration as it is; its ISO 8601 text (`P1Y2M3DT4H5M6.789S`,
 * `-PT90M`, also with a sign in each field); the text of a PostgreSQL interval in its default style; the text of an
 * interval of Oracle (`+000000003 04:05:06.789000000`, `-000000001-02`); an interval of oracledb
 * (`{ years, months }`, `{ days, hours, minutes, seconds, fseconds }`). Undefined for anything else, or for a value
 * whose fields mix signs, which a Temporal.Duration can't hold.
 */
export function durationOfReceivedValue(value: unknown, typeName: string): TemporalDuration | undefined {
    if (isDurationValue(value)) {
        return value
    }
    if (typeof value === 'string') {
        const text = value.trim()
        const iso = isoStyle.exec(text)
        // At least one field: `P` and `PT` aren't a duration
        if (iso && /\d/.test(text)) {
            const outer = iso[1] === '-' ? -1 : 1
            const [, , years, months, weeks, days, hours, minutes, seconds, fraction] = iso
            const secondsNumber = seconds === undefined ? 0 : Number(seconds)
            const secondsSign = seconds !== undefined && seconds.startsWith('-') ? -1 : 1
            return durationOf({
                years: outer * Number(years ?? 0), months: outer * Number(months ?? 0), weeks: outer * Number(weeks ?? 0),
                days: outer * Number(days ?? 0), hours: outer * Number(hours ?? 0), minutes: outer * Number(minutes ?? 0),
                seconds: outer * secondsNumber, ...fractionFields(fraction, outer * secondsSign),
            }, typeName)
        }
        const dayToSecond = oracleDayToSecond.exec(text)
        if (dayToSecond) {
            const [, signText, days, hours, minutes, seconds, fraction] = dayToSecond
            const sign = signText === '-' ? -1 : 1
            return durationOf({
                days: sign * Number(days), hours: sign * Number(hours), minutes: sign * Number(minutes), seconds: sign * Number(seconds),
                ...fractionFields(fraction, sign),
            }, typeName)
        }
        const yearToMonth = oracleYearToMonth.exec(text)
        if (yearToMonth) {
            const sign = yearToMonth[1] === '-' ? -1 : 1
            return durationOf({ years: sign * Number(yearToMonth[2]), months: sign * Number(yearToMonth[3]) }, typeName)
        }
        const postgres = postgresStyle.exec(text)
        if (postgres && text !== '') {
            const [, years, months, days, timeSign, hours, minutes, seconds, fraction] = postgres
            const sign = timeSign === '-' ? -1 : 1
            return durationOf({
                years: Number(years ?? 0), months: Number(months ?? 0), days: Number(days ?? 0),
                hours: sign * Number(hours ?? 0), minutes: sign * Number(minutes ?? 0), seconds: sign * Number(seconds ?? 0),
                ...fractionFields(fraction, sign),
            }, typeName)
        }
        return undefined
    }
    if (value !== null && typeof value === 'object') {
        const interval = value as { years?: unknown, months?: unknown, days?: unknown, hours?: unknown, minutes?: unknown, seconds?: unknown, fseconds?: unknown }
        if (typeof interval.years === 'number' && typeof interval.months === 'number') {
            return durationOf({ years: interval.years, months: interval.months }, typeName)
        }
        if (typeof interval.days === 'number' && typeof interval.hours === 'number' && typeof interval.minutes === 'number' && typeof interval.seconds === 'number' && typeof interval.fseconds === 'number') {
            // fseconds: the nanoseconds of the second
            const nanoseconds = interval.fseconds
            return durationOf({
                days: interval.days, hours: interval.hours, minutes: interval.minutes, seconds: interval.seconds,
                milliseconds: Math.trunc(nanoseconds / 1_000_000), microseconds: Math.trunc(nanoseconds / 1000) % 1000, nanoseconds: nanoseconds % 1000,
            }, typeName)
        }
    }
    return undefined
}

/**
 * The ISO 8601 text of a duration for a database that has no weeks (PostgreSQL, Oracle): its weeks as days; with
 * `signInEachField` (PostgreSQL, which rejects `-P1D`) the sign of a negative duration in each field (`P-1DT-2H`)
 */
export function durationIsoTextWithoutWeeks(value: TemporalDuration, signInEachField: boolean): string {
    return isoTextOf(value, true, signInEachField)
}

/**
 * The ISO 8601 text of a duration, as Temporal's `toString` writes it (`-P1Y2W3DT4H0.5S`), written here: the toString
 * of Node 26.1 drops the fraction of a second when its seconds are 0 and it has another field (`PT1H` for one hour and
 * one nanosecond). The fraction of a second keeps up to fractionDigits digits, the others truncated, as Temporal's
 * `toString({ fractionalSecondDigits, roundingMode: 'trunc' })` does (`PT0S` when nothing is left)
 */
export function durationIsoText(value: TemporalDuration, fractionDigits: number = 9): string {
    return isoTextOf(value, false, false, fractionDigits)
}

function isoTextOf(value: TemporalDuration, weeksAsDays: boolean, signInEachField: boolean, fractionDigits: number = 9): string {
    const sign = value.sign < 0 ? -1 : 1
    const fields = {
        years: Math.abs(value.years), months: Math.abs(value.months), weeks: weeksAsDays ? 0 : Math.abs(value.weeks),
        days: (weeksAsDays ? Math.abs(value.weeks) * 7 : 0) + Math.abs(value.days),
        hours: Math.abs(value.hours), minutes: Math.abs(value.minutes),
    }
    // The seconds and the fields below them, as Temporal writes them: one number of seconds with its fraction, as each
    // field may hold more than one of the next (1500 milliseconds are 1.5 seconds)
    let nanoseconds = BigInt(Math.abs(value.seconds)) * 1_000_000_000n + BigInt(Math.abs(value.milliseconds)) * 1_000_000n + BigInt(Math.abs(value.microseconds)) * 1000n + BigInt(Math.abs(value.nanoseconds))
    if (fractionDigits < 9) {
        nanoseconds -= nanoseconds % 10n ** BigInt(9 - fractionDigits)
    }
    const seconds = nanoseconds / 1_000_000_000n
    const fraction = String(nanoseconds % 1_000_000_000n).padStart(9, '0').replace(/0+$/, '')
    const each = signInEachField && sign < 0 ? '-' : ''
    let date = ''
    if (fields.years) { date += each + fields.years + 'Y' }
    if (fields.months) { date += each + fields.months + 'M' }
    if (fields.weeks) { date += each + fields.weeks + 'W' }
    if (fields.days) { date += each + fields.days + 'D' }
    let time = ''
    if (fields.hours) { time += each + fields.hours + 'H' }
    if (fields.minutes) { time += each + fields.minutes + 'M' }
    if (seconds !== 0n || fraction !== '') { time += each + String(seconds) + (fraction === '' ? '' : '.' + fraction) + 'S' }
    const text = 'P' + date + (time === '' ? '' : 'T' + time)
    if (text === 'P') {
        // Without a sign: a duration that the truncation leaves at zero is zero
        return 'PT0S'
    }
    return sign < 0 && !signInEachField ? '-' + text : text
}

/**
 * The parts of a duration as Temporal adds it to a value without zone: the months (its years too), added first, with
 * the day kept in the month (Jan 31 plus a month is Feb 29); then the days (its weeks too); then the time, in whole
 * seconds and the nanoseconds of the second, with the sign of the duration. A plainDate adds the whole days of the
 * time and no more (`PT36H` is one day, `-PT36H` minus one); a plainTime only the time, that goes round at midnight
 */
export interface DurationParts {
    readonly months: number
    readonly days: number
    readonly seconds: number
    readonly nanoseconds: number
}

/** The parts of a duration (multiplied by sign) as Temporal adds it to a date, a time, or a date and time */
export function durationPartsFor(value: TemporalDuration, fields: 'date' | 'time' | 'timestamp', sign: 1 | -1): DurationParts {
    const time = ((((BigInt(value.hours) * 60n + BigInt(value.minutes)) * 60n + BigInt(value.seconds)) * 1000n + BigInt(value.milliseconds)) * 1000n + BigInt(value.microseconds)) * 1000n + BigInt(value.nanoseconds)
    const seconds = time / 1_000_000_000n
    const nanoseconds = time % 1_000_000_000n
    if (fields === 'time') {
        return { months: 0, days: 0, seconds: sign * Number(seconds % 86400n), nanoseconds: sign * Number(nanoseconds) }
    }
    const months = sign * (value.years * 12 + value.months)
    const days = value.weeks * 7 + value.days
    if (fields === 'date') {
        return { months, days: sign * (days + Number(seconds / 86400n)), seconds: 0, nanoseconds: 0 }
    }
    return { months, days: sign * days, seconds: sign * Number(seconds), nanoseconds: sign * Number(nanoseconds) }
}

/**
 * The duration a value given to add or subtract is: a Temporal.Duration, or an object with its fields, as
 * Temporal.Duration.from takes it (`{ days: 3 }`); undefined for anything else
 */
export function durationOfArgument(value: unknown, typeName: string): TemporalDuration | undefined {
    if (isDurationValue(value)) {
        return value
    }
    if (value === null || typeof value !== 'object') {
        return undefined
    }
    try {
        return __temporal(typeName).Duration.from(value as any)
    } catch (error) {
        if (error instanceof RangeError || error instanceof TypeError) {
            return undefined
        }
        throw error
    }
}

/** Whether the parts add nothing */
export function isZeroDuration(parts: DurationParts): boolean {
    return parts.months === 0 && parts.days === 0 && parts.seconds === 0 && parts.nanoseconds === 0
}

/** The Temporal.Duration of the parts: its months, days, seconds and the fraction of the second */
export function durationOfParts(parts: DurationParts, typeName: string): TemporalDuration {
    const nanoseconds = parts.nanoseconds
    return __temporal(typeName).Duration.from({
        months: parts.months, days: parts.days, seconds: parts.seconds,
        milliseconds: Math.trunc(nanoseconds / 1_000_000), microseconds: Math.trunc(nanoseconds / 1000) % 1000, nanoseconds: nanoseconds % 1000,
    })
}

/**
 * The parts of a duration as the SQL that adds them (see DurationParts), each undefined when it adds nothing, with the
 * numbers of a constant
 */
export interface DurationPartsSql {
    readonly months: string | undefined
    readonly days: string | undefined
    readonly seconds: string | undefined
    readonly nanoseconds: string | undefined
    readonly constant: DurationParts | undefined
}
