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
