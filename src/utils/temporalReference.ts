// The reference a month of a year (plainYearMonth) and a day of a month (plainMonthDay) are kept with, in a date: the
// temporalReferenceDate of the connection, '1972-01-01' by default, Temporal's (the 1st of the month, the year 1972)

import { TsSqlProcessingError } from '../TsSqlError.js'

/** The day a month of a year is kept on, and the year a day of a month is kept in */
export interface TemporalReference {
    readonly year: number
    readonly day: number
}

/** The reference of Temporal: the 1st of the month, the year 1972, a leap year */
const temporalStandardReference: TemporalReference = { year: 1972, day: 1 }

/**
 * The reference of a temporalReferenceDate (undefined for the default): its year, a leap year that has February 29,
 * and its day, from 1 to 28, a day every month has; anything else is rejected with INVALID_CONFIGURATION
 */
export function temporalReferenceOf(date: string | undefined): TemporalReference {
    if (date === undefined || date === '1972-01-01') {
        return temporalStandardReference
    }
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
    const year = match ? Number(match[1]) : NaN
    const month = match ? Number(match[2]) : NaN
    const day = match ? Number(match[3]) : NaN
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
    if (!leap || !(month >= 1 && month <= 12) || !(day >= 1 && day <= 28)) {
        throw new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name: 'temporalReferenceDate', value: date }, "temporalReferenceDate must be a date 'YYYY-MM-DD' of a leap year and a day from 1 to 28: " + date)
    }
    return { year, day }
}
