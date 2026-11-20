// The Temporal values without zone (plainDate, plainTime, plainDateTime) read from the database, and their text sent to
// it: the same grammar as the text of a localDate, a localTime or a localDateTime (utcDateTimeText.ts), keeping all the
// digits of the fraction of a second, up to the nanosecond.

import { __temporal, type TemporalInstant, type TemporalPlainDate, type TemporalPlainDateTime, type TemporalPlainTime } from '../typeSystem/temporal.js'

// A date, a time or both, with an optional offset and an optional PostgreSQL era (see utcDateTimeText.ts)
const dateTimeTextPattern = /^(?:([+-]?\d{4,6})-(\d\d)-(\d\d))?(?:(?:^|[T ])(\d\d):(\d\d)(?::(\d\d)(?:[.,](\d+))?)?)?(?:\s*(Z|[+-]\d\d(?::?\d\d(?::?\d\d)?)?))?( BC| AD)?$/i

/** The digits of a text of a date, a time or both, and the seconds of its offset when it has one */
interface DateTimeTextParts {
    readonly dateTime: TemporalPlainDateTime
    readonly offsetSeconds: number | undefined
}

/**
 * The digits of a text of a date, a time or both, as the database writes it, and its offset (`Z`, `+09`, `+05:30`,
 * `-03:30:45`) when it has one. A date without a time is at 00:00, a time without a date is on 1970-01-01. The fraction
 * of a second is kept up to the nanosecond, and the digits beyond are dropped. Every year is read as it is written
 * (`0099` is the year 99), and `BC` (PostgreSQL) is a year before 1 (`0044 BC` is the year -43). Undefined when the text
 * is not one of these forms or its digits are out of the calendar (`2024-02-30`, `24:00:00`).
 */
function parseDateTimeText(text: string, typeName: string): DateTimeTextParts | undefined {
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
        if (eraText?.toUpperCase() === ' BC') {
            // The year 1 BC is the year 0
            year = 1 - year
        }
    }
    const fraction = fractionText === undefined ? '000000000' : (fractionText + '00000000').slice(0, 9)
    const temporal = __temporal(typeName)
    let dateTime: TemporalPlainDateTime
    try {
        dateTime = temporal.PlainDateTime.from({
            year, month, day,
            hour: hoursText === undefined ? 0 : Number(hoursText),
            minute: minutesText === undefined ? 0 : Number(minutesText),
            second: secondsText === undefined ? 0 : Number(secondsText),
            millisecond: Number(fraction.slice(0, 3)),
            microsecond: Number(fraction.slice(3, 6)),
            nanosecond: Number(fraction.slice(6, 9)),
        }, { overflow: 'reject' })
    } catch {
        return undefined
    }
    if (offsetText === undefined) {
        return { dateTime, offsetSeconds: undefined }
    }
    let offsetSeconds = 0
    if (offsetText.toUpperCase() !== 'Z') {
        const digits = offsetText.slice(1).replace(/:/g, '')
        offsetSeconds = Number(digits.slice(0, 2)) * 3600 + Number(digits.slice(2, 4) || '0') * 60 + Number(digits.slice(4, 6) || '0')
        if (offsetText[0] === '-') {
            offsetSeconds = -offsetSeconds
        }
    }
    return { dateTime, offsetSeconds }
}

/** The instant of the digits of a text with that offset */
function instantOfParts(parts: DateTimeTextParts & { readonly offsetSeconds: number }, typeName: string): TemporalInstant | undefined {
    try {
        return __temporal(typeName).Instant.fromEpochNanoseconds(parts.dateTime.toZonedDateTime('UTC').epochNanoseconds - BigInt(parts.offsetSeconds) * 1_000_000_000n)
    } catch {
        // Beyond the range of an instant
        return undefined
    }
}

/**
 * The PlainDateTime of a text of a date, a time or both, as the database writes it (see parseDateTimeText): its digits
 * when the text has no offset, and with one the digits of the instant it gives in the zone of the database, the zone
 * of the session that wrote them. Undefined when the text is not one of these forms or its digits are out of the
 * calendar.
 */
export function parsePlainDateTimeText(text: string, databaseTimeZone: string, typeName: string): TemporalPlainDateTime | undefined {
    const parts = parseDateTimeText(text, typeName)
    if (!parts || parts.offsetSeconds === undefined) {
        return parts?.dateTime
    }
    return instantOfParts(parts as DateTimeTextParts & { readonly offsetSeconds: number }, typeName)?.toZonedDateTimeISO(databaseTimeZone).toPlainDateTime()
}

/**
 * The Instant of a text of a date and a time, as the database writes it (see parseDateTimeText): the instant it gives
 * with its offset, and without one the instant of its digits as a wall clock of the zone of the database. Undefined
 * when the text is not one of these forms, its digits are out of the calendar, or it is beyond the range of an instant.
 */
export function parseInstantText(text: string, databaseTimeZone: string, typeName: string): TemporalInstant | undefined {
    const parts = parseDateTimeText(text, typeName)
    if (!parts) {
        return undefined
    }
    if (parts.offsetSeconds !== undefined) {
        return instantOfParts(parts as DateTimeTextParts & { readonly offsetSeconds: number }, typeName)
    }
    try {
        return parts.dateTime.toZonedDateTime(databaseTimeZone).toInstant()
    } catch {
        return undefined
    }
}

/** The PlainDateTime whose digits are the UTC getters of a Date, as a driver that gives a Date delivers a value without zone */
export function plainDateTimeOfUtcDate(value: Date, typeName: string): TemporalPlainDateTime {
    return __temporal(typeName).Instant.fromEpochMilliseconds(value.getTime()).toZonedDateTimeISO('UTC').toPlainDateTime()
}

function pad(value: number, length: number): string {
    return String(value).padStart(length, '0')
}

/** The digits of the fraction of a second, without the zeros at its end; empty for a whole second */
function fractionDigits(value: TemporalPlainTime | TemporalPlainDateTime): string {
    const digits = pad(value.millisecond, 3) + pad(value.microsecond, 3) + pad(value.nanosecond, 3)
    return digits.replace(/0+$/, '')
}

/**
 * `YYYY-MM-DD`; the year has at least 4 digits, and a negative one its sign (`-0044-03-15`). The year written can be
 * given, for a database that writes the years before 1 in another way (PostgreSQL: `0044-03-15 BC`).
 */
export function plainDateText(value: TemporalPlainDate | TemporalPlainDateTime, year: number = value.year): string {
    const yearText = year < 0 ? '-' + pad(-year, 4) : pad(year, 4)
    return yearText + '-' + pad(value.month, 2) + '-' + pad(value.day, 2)
}

/** `HH:MM:SS[.fffffffff]`, with the digits of the fraction of a second it has, up to the nanosecond */
export function plainTimeText(value: TemporalPlainTime | TemporalPlainDateTime): string {
    const fraction = fractionDigits(value)
    return pad(value.hour, 2) + ':' + pad(value.minute, 2) + ':' + pad(value.second, 2) + (fraction === '' ? '' : '.' + fraction)
}
