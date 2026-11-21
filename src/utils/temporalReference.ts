// The dates the database stores a value in that is only a part of one: the day of the date of a month of a year
// (plainYearMonth), the year of the date of a day of a month (plainMonthDay), and, on Oracle, which has no type of a
// time of the day, the date of a time (localTime, plainTime): dayOfStoredYearMonths, yearOfStoredMonthDays and
// dateOfStoredTimes of the connection, Temporal's by default (the 1st of the month, the year 1972, 1972-01-01)

import { TsSqlProcessingError } from '../TsSqlError.js'

/** The day of the date of a stored month of a year: from 1 to 28, a day every month has; INVALID_CONFIGURATION otherwise */
export function dayOfStoredYearMonthsOf(day: number | undefined): number {
    if (day === undefined) {
        return 1
    }
    if (!Number.isInteger(day) || day < 1 || day > 28) {
        throw new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name: 'dayOfStoredYearMonths', value: day }, 'dayOfStoredYearMonths must be a day from 1 to 28: ' + String(day))
    }
    return day
}

/** The year of the date of a stored day of a month: a leap year, that has February 29; INVALID_CONFIGURATION otherwise */
export function yearOfStoredMonthDaysOf(year: number | undefined): number {
    if (year === undefined) {
        return 1972
    }
    if (!Number.isInteger(year) || !((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0)) {
        throw new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name: 'yearOfStoredMonthDays', value: year }, 'yearOfStoredMonthDays must be a leap year: ' + String(year))
    }
    return year
}

/** The date of a column of a date that stores only a time of the day (Oracle): a date `'YYYY-MM-DD'`; INVALID_CONFIGURATION otherwise */
export function dateOfStoredTimesOf(date: string | undefined): string {
    if (date === undefined) {
        return '1972-01-01'
    }
    if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(date)) {
        throw new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name: 'dateOfStoredTimes', value: date }, "dateOfStoredTimes must be a date 'YYYY-MM-DD': " + date)
    }
    return date
}
