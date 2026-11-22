// The fields `with` of a Temporal value without zone takes, as Temporal reads them: a number (or the text of one)
// truncated to an integer, the month also as its code; a field of a date below 1 is out of range, a field above its
// range is taken to the last value it can have (the day, to the last day of its month, which only the database knows
// for a month it computes), and a field of a time out of its range to the nearest value it can have.

/**
 * A field of the query given to with (an int, like a column): its value is only known by the database, which takes it
 * to its range or rejects it as Temporal does
 */
export type PlainTemporalFieldOfQuery = object

/**
 * The fields of a date and a time to put in place of the ones of a value, each an integer in its range, or a field of
 * the query
 */
export interface PlainTemporalFields {
    readonly year: number | PlainTemporalFieldOfQuery | undefined
    readonly month: number | PlainTemporalFieldOfQuery | undefined
    /** At least 1; the database takes it to the last day of the month when it has fewer */
    readonly day: number | PlainTemporalFieldOfQuery | undefined
    readonly hour: number | PlainTemporalFieldOfQuery | undefined
    readonly minute: number | PlainTemporalFieldOfQuery | undefined
    readonly second: number | PlainTemporalFieldOfQuery | undefined
    readonly millisecond: number | PlainTemporalFieldOfQuery | undefined
    readonly microsecond: number | PlainTemporalFieldOfQuery | undefined
    readonly nanosecond: number | PlainTemporalFieldOfQuery | undefined
}

/** Whether a field given to with is of the query */
export function isFieldOfTheQuery(field: unknown): field is PlainTemporalFieldOfQuery {
    return typeof field === 'object' && field !== null
}

/** Whether a field of the fields given to with is of the query */
export function hasFieldOfTheQuery(given: PlainTemporalFields): boolean {
    return isFieldOfTheQuery(given.year) || isFieldOfTheQuery(given.month) || isFieldOfTheQuery(given.day) || isFieldOfTheQuery(given.hour) || isFieldOfTheQuery(given.minute)
        || isFieldOfTheQuery(given.second) || isFieldOfTheQuery(given.millisecond) || isFieldOfTheQuery(given.microsecond) || isFieldOfTheQuery(given.nanosecond)
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

function constrained(value: number | PlainTemporalFieldOfQuery | undefined, max: number): number | PlainTemporalFieldOfQuery | undefined {
    return typeof value === 'number' ? Math.min(Math.max(value, 0), max) : value
}

/** A field given as Temporal reads it (see integerOf), or the field of the query as it is */
function fieldOf(value: unknown): number | PlainTemporalFieldOfQuery | undefined {
    return isFieldOfTheQuery(value) ? value : integerOf(value)
}

/** Whether a number of a field is NaN (a field of the query isn't) */
function isNaNField(value: number | PlainTemporalFieldOfQuery | undefined): boolean {
    return typeof value === 'number' && Number.isNaN(value)
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
    let year: number | PlainTemporalFieldOfQuery | undefined
    let month: number | PlainTemporalFieldOfQuery | undefined
    let day: number | PlainTemporalFieldOfQuery | undefined
    if (hasDate) {
        year = fieldOf(given['year']) ?? inYear
        month = fieldOf(given['month'])
        const monthCode = given['monthCode']
        if (monthCode !== undefined) {
            const code = typeof monthCode === 'string' ? /^M(0[1-9]|1[0-2])$/.exec(monthCode) : null
            if (!code || (month !== undefined && month !== Number(code[1]))) {
                return undefined
            }
            month = Number(code[1])
        }
        day = fieldOf(given['day'])
        if (isNaNField(year) || isNaNField(month) || isNaNField(day) || (typeof month === 'number' && month < 1) || (typeof day === 'number' && day < 1)) {
            return undefined
        }
        if (typeof month === 'number' && month > 12) {
            if (reject) {
                return undefined
            }
            month = 12
        }
        if (reject && typeof year === 'number' && typeof month === 'number' && typeof day === 'number' && day > daysInMonth(year, month)) {
            return undefined
        }
    }
    let hour: number | PlainTemporalFieldOfQuery | undefined
    let minute: number | PlainTemporalFieldOfQuery | undefined
    let second: number | PlainTemporalFieldOfQuery | undefined
    let millisecond: number | PlainTemporalFieldOfQuery | undefined
    let microsecond: number | PlainTemporalFieldOfQuery | undefined
    let nanosecond: number | PlainTemporalFieldOfQuery | undefined
    if (hasTime) {
        hour = fieldOf(given['hour'])
        minute = fieldOf(given['minute'])
        second = fieldOf(given['second'])
        millisecond = fieldOf(given['millisecond'])
        microsecond = fieldOf(given['microsecond'])
        nanosecond = fieldOf(given['nanosecond'])
        if ([hour, minute, second, millisecond, microsecond, nanosecond].some(isNaNField)) {
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

function outOf(value: number | PlainTemporalFieldOfQuery | undefined, max: number): boolean {
    return typeof value === 'number' && (value < 0 || value > max)
}

/** The days of a month of the ISO calendar */
function daysInMonth(year: number, month: number): number {
    if (month === 2) {
        return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28
    }
    return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31
}
