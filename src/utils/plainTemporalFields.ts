// The fields `with` of a Temporal value without zone takes, as Temporal reads them: a number (or the text of one)
// truncated to an integer, the month also as its code; a field of a date below 1 is out of range, a field above its
// range is taken to the last value it can have (the day, to the last day of its month, which only the database knows
// for a month it computes), and a field of a time out of its range to the nearest value it can have.

/** The fields of a date and a time to put in place of the ones of a value, each an integer in its range */
export interface PlainTemporalFields {
    readonly year: number | undefined
    readonly month: number | undefined
    /** At least 1; the database takes it to the last day of the month when it has fewer */
    readonly day: number | undefined
    readonly hour: number | undefined
    readonly minute: number | undefined
    readonly second: number | undefined
    readonly millisecond: number | undefined
    readonly microsecond: number | undefined
    readonly nanosecond: number | undefined
}

const dateFieldNames = ['year', 'month', 'monthCode', 'day'] as const
const timeFieldNames = ['hour', 'minute', 'second', 'millisecond', 'microsecond', 'nanosecond'] as const

/** The integer of a field, as Temporal reads it; undefined for a field not given, NaN for one that isn't a number */
function integerOf(value: unknown): number | undefined {
    if (value === undefined) {
        return undefined
    }
    const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN
    return Number.isFinite(number) ? Math.trunc(number) : NaN
}

function constrained(value: number | undefined, max: number): number | undefined {
    return value === undefined ? undefined : Math.min(Math.max(value, 0), max)
}

/**
 * The fields of the value given to `with` of a date ('date'), a time ('time') or both ('timestamp'), as Temporal's
 * `with` takes them; undefined when Temporal rejects them: not an object, none of the fields of the type, a field that
 * isn't a number, a month or a day below 1, a month code that isn't of the ISO calendar or that says another month.
 * With reject (overflow 'reject') a field out of its range is rejected too, and a day the month given hasn't, when the
 * year and the month are given; a day the month of the value hasn't is rejected by the query. inYear is the year of a
 * value that doesn't give one (the reference year of a day of a month)
 */
export function plainTemporalFieldsOf(value: unknown, fields: 'date' | 'time' | 'timestamp', reject: boolean = false, inYear?: number): PlainTemporalFields | undefined {
    if (value === null || typeof value !== 'object') {
        return undefined
    }
    const given = value as Record<string, unknown>
    const hasDate = fields !== 'time' && dateFieldNames.some(name => given[name] !== undefined)
    const hasTime = fields !== 'date' && timeFieldNames.some(name => given[name] !== undefined)
    if (!hasDate && !hasTime) {
        return undefined
    }
    let year: number | undefined
    let month: number | undefined
    let day: number | undefined
    if (hasDate) {
        year = integerOf(given['year']) ?? inYear
        month = integerOf(given['month'])
        const monthCode = given['monthCode']
        if (monthCode !== undefined) {
            const code = typeof monthCode === 'string' ? /^M(0[1-9]|1[0-2])$/.exec(monthCode) : null
            if (!code || (month !== undefined && month !== Number(code[1]))) {
                return undefined
            }
            month = Number(code[1])
        }
        day = integerOf(given['day'])
        if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day) || (month !== undefined && month < 1) || (day !== undefined && day < 1)) {
            return undefined
        }
        if (month !== undefined && month > 12) {
            if (reject) {
                return undefined
            }
            month = 12
        }
        if (reject && year !== undefined && month !== undefined && day !== undefined && day > daysInMonth(year, month)) {
            return undefined
        }
    }
    let hour: number | undefined
    let minute: number | undefined
    let second: number | undefined
    let millisecond: number | undefined
    let microsecond: number | undefined
    let nanosecond: number | undefined
    if (hasTime) {
        hour = integerOf(given['hour'])
        minute = integerOf(given['minute'])
        second = integerOf(given['second'])
        millisecond = integerOf(given['millisecond'])
        microsecond = integerOf(given['microsecond'])
        nanosecond = integerOf(given['nanosecond'])
        if ([hour, minute, second, millisecond, microsecond, nanosecond].some(Number.isNaN)) {
            return undefined
        }
        if (reject && (outOf(hour, 23) || outOf(minute, 59) || outOf(second, 59) || outOf(millisecond, 999) || outOf(microsecond, 999) || outOf(nanosecond, 999))) {
            return undefined
        }
    }
    return {
        year, month, day,
        hour: constrained(hour, 23), minute: constrained(minute, 59), second: constrained(second, 59),
        millisecond: constrained(millisecond, 999), microsecond: constrained(microsecond, 999), nanosecond: constrained(nanosecond, 999),
    }
}

function outOf(value: number | undefined, max: number): boolean {
    return value !== undefined && (value < 0 || value > max)
}

/** The days of a month of the ISO calendar */
function daysInMonth(year: number, month: number): number {
    if (month === 2) {
        return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28
    }
    return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31
}
