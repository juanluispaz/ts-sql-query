// The text of a Date written from its UTC getters, for the query runners that send a localDate, a localTime or a
// localDateTime as text: every value in the database is in UTC, whatever the zone of the process.

function pad(value: number, length: number): string {
    return String(value).padStart(length, '0')
}

/**
 * `YYYY-MM-DD` of the UTC day; the year has at least 4 digits, and a negative one its sign (`-0044-03-15`). The year
 * written can be given, for a database that writes the years before 1 in another way (PostgreSQL: `0044-03-15 BC`).
 */
export function utcDateText(value: Date, year: number = value.getUTCFullYear()): string {
    const yearText = year < 0 ? '-' + pad(-year, 4) : pad(year, 4)
    return yearText + '-' + pad(value.getUTCMonth() + 1, 2) + '-' + pad(value.getUTCDate(), 2)
}

/** `HH:MM:SS.mmm` of the UTC time */
export function utcTimeText(value: Date): string {
    return pad(value.getUTCHours(), 2) + ':' + pad(value.getUTCMinutes(), 2) + ':' + pad(value.getUTCSeconds(), 2) + '.' + pad(value.getUTCMilliseconds(), 3)
}

// A date, a time or both, with an optional offset and an optional PostgreSQL era: `2024-01-14`, `09:15:30.123`,
// `2024-01-14 09:15:30.123456`, `2024-01-14T09:15:30.1230000`, `2024-01-14 09:15:30+09`, `...+05:30`, `...+00:14:44`,
// `...Z`, `0044-03-15 BC`
const dateTimeTextPattern = /^(?:([+-]?\d{4,6})-(\d\d)-(\d\d))?(?:(?:^|[T ])(\d\d):(\d\d)(?::(\d\d)(?:[.,](\d+))?)?)?(?:\s*(Z|[+-]\d\d(?::?\d\d(?::?\d\d)?)?))?( BC)?$/i

/**
 * The Date of a text of a date, a time or both: its digits are the UTC getters of the Date when the text has no offset,
 * and with an offset (`Z`, `+09`, `+05:30`, `-03:30:45`) it is the instant the text gives. A date without a time is at
 * 00:00, a time without a date is on 1970-01-01. The fraction of a second is truncated to milliseconds. Every year is
 * read as it is written (`0099` is the year 99), and `BC` (PostgreSQL) is a year before 1 (`0044 BC` is the year -43).
 * Undefined when the text is not one of these forms or its digits are out of the calendar: a day the month doesn't
 * have (`2024-02-30`), or the end of the day `24:00:00`, that a Date of that day can't represent.
 */
export function parseUtcDateTimeText(text: string): Date | undefined {
    const match = dateTimeTextPattern.exec(text.trim())
    if (!match) {
        return undefined
    }
    const [, yearText, monthText, dayText, hoursText, minutesText, secondsText, fractionText, offsetText, eraText] = match
    if (yearText === undefined && hoursText === undefined) {
        return undefined
    }
    let year = 1970
    let month = 1
    let day = 1
    if (yearText !== undefined) {
        year = Number(yearText)
        month = Number(monthText)
        day = Number(dayText)
        if (eraText) {
            // The year 1 BC is the year 0
            year = 1 - year
        }
    }
    const hours = hoursText === undefined ? 0 : Number(hoursText)
    const minutes = minutesText === undefined ? 0 : Number(minutesText)
    const seconds = secondsText === undefined ? 0 : Number(secondsText)
    const milliseconds = fractionText === undefined ? 0 : Number((fractionText + '00').slice(0, 3))
    if (month < 1 || month > 12 || day < 1 || day > 31 || hours > 23 || minutes > 59 || seconds > 59) {
        return undefined
    }
    const result = new Date(0)
    // setUTCFullYear, not Date.UTC, that reads the years 0 to 99 as 1900 to 1999
    result.setUTCFullYear(year, month - 1, day)
    result.setUTCHours(hours, minutes, seconds, milliseconds)
    if (result.getUTCDate() !== day) {
        // A day the month doesn't have (2024-02-30, that MySQL keeps with ALLOW_INVALID_DATES): the Date would be
        // another day
        return undefined
    }
    if (offsetText !== undefined && offsetText.toUpperCase() !== 'Z') {
        const digits = offsetText.slice(1).replace(/:/g, '')
        const offset = (Number(digits.slice(0, 2)) * 3600 + Number(digits.slice(2, 4) || '0') * 60 + Number(digits.slice(4, 6) || '0')) * 1000
        result.setTime(result.getTime() - (offsetText[0] === '-' ? -offset : offset))
    }
    return isNaN(result.getTime()) ? undefined : result
}

/**
 * The parser of a driver for the text of a date or a timestamp without zone (PostgreSQL's `date` and `timestamp`): the
 * Date whose UTC getters are its digits, where the parsers of the drivers build it with the local ones, from the zone
 * of the process. A text in another form (`infinity`) is given as it is.
 */
export function parseUtcDateTimeTextOrKeepIt(text: string): Date | string {
    return parseUtcDateTimeText(text) ?? text
}

/**
 * Whether the digits of a text of a date, a time or both are outside the calendar: a day the month doesn't have
 * (`2024-02-30`), an hour beyond 23 (the end of the day `24:00:00`), a minute or a second beyond 59. A Date built from
 * it would be another day or time, without an error. False for a text in another form.
 */
export function isDateTimeTextOutOfCalendar(text: string): boolean {
    const match = dateTimeTextPattern.exec(text.trim())
    if (!match) {
        return false
    }
    const [, yearText, monthText, dayText, hoursText, minutesText, secondsText] = match
    if (yearText !== undefined) {
        const month = Number(monthText)
        const day = Number(dayText)
        const check = new Date(0)
        check.setUTCFullYear(Number(yearText), month - 1, day)
        if (month < 1 || month > 12 || day < 1 || check.getUTCDate() !== day) {
            return true
        }
    }
    return (hoursText !== undefined && Number(hoursText) > 23)
        || (minutesText !== undefined && Number(minutesText) > 59)
        || (secondsText !== undefined && Number(secondsText) > 59)
}
