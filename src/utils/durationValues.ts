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
    const sign = value.sign < 0 ? -1 : 1
    const fields = {
        years: Math.abs(value.years), months: Math.abs(value.months), days: Math.abs(value.weeks) * 7 + Math.abs(value.days),
        hours: Math.abs(value.hours), minutes: Math.abs(value.minutes), seconds: Math.abs(value.seconds),
    }
    const fraction = (String(Math.abs(value.milliseconds)).padStart(3, '0') + String(Math.abs(value.microseconds)).padStart(3, '0') + String(Math.abs(value.nanoseconds)).padStart(3, '0')).replace(/0+$/, '')
    const each = signInEachField && sign < 0 ? '-' : ''
    let date = ''
    if (fields.years) { date += each + fields.years + 'Y' }
    if (fields.months) { date += each + fields.months + 'M' }
    if (fields.days) { date += each + fields.days + 'D' }
    let time = ''
    if (fields.hours) { time += each + fields.hours + 'H' }
    if (fields.minutes) { time += each + fields.minutes + 'M' }
    if (fields.seconds || fraction !== '') { time += each + fields.seconds + (fraction === '' ? '' : '.' + fraction) + 'S' }
    const text = 'P' + date + (time === '' ? '' : 'T' + time)
    const result = text === 'P' ? 'PT0S' : text
    return sign < 0 && !signInEachField ? '-' + result : result
}
