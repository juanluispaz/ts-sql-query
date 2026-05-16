import type { NConnection } from '../utils/sourceName.js'
import type { QueryRunner } from '../queryRunners/QueryRunner.js'
import { SqliteSqlBuilder } from '../sqlBuilders/SqliteSqlBuilder.js'
import { AbstractConnection } from './AbstractConnection.js'
import type { SqliteDateTimeFormat, SqliteDateTimeFormatType } from './SqliteConfiguration.js'
import { TsSqlProcessingError } from '../TsSqlError.js'

export abstract class SqliteConnection<NAME extends string> extends AbstractConnection<NConnection<'sqlite', NAME>> {

    protected uuidStrategy: 'string' | 'uuid-extension' = 'uuid-extension'

    constructor(queryRunner: QueryRunner, sqlBuilder = new SqliteSqlBuilder()) {
        super(queryRunner, sqlBuilder)
        queryRunner.useDatabase('sqlite')
    }

    /**
     * Minimum SQLite version the generated SQL must support, encoded as
     * `major * 1000 + minor` (e.g. `3_035` for SQLite 3.35, `3_029` for SQLite 3.29).
     * Defaults to `Number.POSITIVE_INFINITY` (latest).
     *
     * Recognised breakpoints:
     * - `>= 3_042`: the `'subsec'` modifier (added in SQLite 3.42) is used with
     *   `unixepoch()` to obtain Unix-milliseconds values without going through
     *   `julianday()` arithmetic.
     * - `>= 3_038`: the `unixepoch()` function (added in SQLite 3.38) is used
     *   instead of `cast(strftime('%s', ...) as integer)` to obtain Unix-seconds
     *   values.
     * - `>= 3_035`: the `RETURNING` clause (added in SQLite 3.35 for `DELETE`,
     *   `INSERT` and `UPDATE`) is emitted on `INSERT` to retrieve the last
     *   inserted id directly from the statement.
     * - `>= 3_030`: native `NULLS FIRST` / `NULLS LAST` syntax in `ORDER BY` is
     *   emitted (added in SQLite 3.30).
     * - below those breakpoints, `NULLS FIRST` / `NULLS LAST` ordering is
     *   emulated, `last_insert_rowid()` is used to retrieve the inserted id,
     *   and `strftime('%s', ...)` / `julianday()` arithmetic is used to obtain
     *   Unix timestamps.
     */
    protected override compatibilityVersion: number = Number.POSITIVE_INFINITY

    protected getDateTimeFormat(_type: SqliteDateTimeFormatType): SqliteDateTimeFormat {
        return 'localdate as text'
    }
    protected treatUnexpectedIntegerDateTimeAsJulian: boolean = false
    protected treatUnexpectedStringDateTimeAsUTC: boolean = false
    protected unexpectedUnixDateTimeAreMilliseconds: boolean = false

    protected override transformValueFromDB(value: unknown, type: string): unknown {
        if (value === undefined || value == null) {
            return super.transformValueFromDB(value, type)
        }
        switch (type) {
            case 'localDate': {
                if (typeof value === 'string') {
                    const valueAsNumber = +value
                    if (!isNaN(valueAsNumber)) {
                        value = valueAsNumber
                    }
                }
                const dateTimeFormat = this.getDateTimeFormat('date')
                let result: Date
                if (value instanceof Date) {
                    result = new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()))
                } else if (typeof value === 'string') {
                    if (containsTimezone(value)) {
                        result = new Date(value)
                    } else switch (dateTimeFormat) {
                        case 'localdate as text':
                        case 'localdate as text using T separator':
                            if (value.length <= 10) {
                                result = new Date(value + ' 00:00') // If time is omited, UTC timezone will be used instead the local one
                            } else {
                                result = new Date(value)
                            }
                            result = new Date(Date.UTC(result.getFullYear(), result.getMonth(), result.getDate()))
                            break
                        case 'Julian day as real number':
                        case 'Unix time seconds as integer':
                        case 'Unix time milliseconds as integer':
                            if (!this.treatUnexpectedStringDateTimeAsUTC) {
                                if (value.length <= 10) {
                                    result = new Date(value + ' 00:00') // If time is omited, UTC timezone will be used instead the local one
                                } else {
                                    result = new Date(value)
                                }
                                result = new Date(Date.UTC(result.getFullYear(), result.getMonth(), result.getDate()))
                            } else {
                                result = new Date(value + 'Z')
                            }
                            break
                        case 'UTC as text':
                        case 'UTC as text using T separator':
                        case 'UTC as text using Z timezone':
                        case 'UTC as text using T separator and Z timezone':
                            result = new Date(value + 'Z')
                            break
                        default:
                            throw new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name: 'dataTimeFormat', value: dateTimeFormat }, 'Invalid sqlite date time format: ' + dateTimeFormat)
                    }
                } else if (typeof value === 'number' || typeof value === 'bigint') {
                    let number: number = (typeof value === 'bigint') ? Number(value) : value;

                    if (dateTimeFormat === 'Julian day as real number') {
                        result = new Date(julianToMilliseconds(number)) // Timezone is not compesated due down time is overwrited
                    } else if (dateTimeFormat === 'Unix time seconds as integer') {
                        result = new Date(number * 1000)
                    } else if (dateTimeFormat === 'Unix time milliseconds as integer') {
                        result = new Date(number)
                    } else {
                        // Try to automatically detect if it is a julian or a unix time
                        // If it have decimal, it will be considered julian, otherwise unix time
                        if (this.treatUnexpectedIntegerDateTimeAsJulian || !Number.isInteger(value)) {
                            result = new Date(julianToMilliseconds(number))
                        } else if (this.unexpectedUnixDateTimeAreMilliseconds) {
                            result = new Date(number)
                        } else {
                            result = new Date(number * 1000)
                        }
                    }
                    result.setUTCHours(0, 0, 0, 0)
                } else {
                    throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: type }, `Invalid localDate value received from the db: ${value} (type ${typeof value})`)
                }
                if (isNaN(result.getTime())) {
                    throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: type }, `Invalid localDate value received from the db: ${value} (.getTime() returns NaN)`)
                }
                (result as any).___type___ = 'localDate'
                // This time fix works in almost every timezone (from -10 to +13, but not +14, -11, -12, almost uninhabited)
                result.setUTCMinutes(600)
                return result
            }
            case 'localTime': {
                if (typeof value === 'string') {
                    const valueAsNumber = +value
                    if (!isNaN(valueAsNumber)) {
                        value = valueAsNumber
                    }
                }
                const dateTimeFormat = this.getDateTimeFormat('time')
                let result: Date
                if (value instanceof Date) {
                    result = new Date(value.getTime())
                } else if (typeof value === 'string') {
                    if (containsTimezone(value)) {
                        if (containsDate(value)) {
                            result = new Date(value)
                        } else {
                            result = new Date('1970-01-01 ' + value)
                        }
                    } else switch (dateTimeFormat) {
                        case 'localdate as text':
                        case 'localdate as text using T separator':
                            if (containsDate(value)) {
                                result = new Date(value)
                            } else {
                                result = new Date('1970-01-01 ' + value)
                            }
                            break
                        case 'Julian day as real number':
                        case 'Unix time seconds as integer':
                        case 'Unix time milliseconds as integer':
                            if (containsDate(value)) {
                                if (this.treatUnexpectedStringDateTimeAsUTC) {
                                    result = new Date(value + 'Z')
                                } else {
                                    result = new Date(value)
                                }
                            } else {
                                if (this.treatUnexpectedStringDateTimeAsUTC) {
                                    result = new Date('1970-01-01 ' + value + 'Z')
                                } else {
                                    result = new Date('1970-01-01 ' + value)
                                }
                            }
                            break
                        case 'UTC as text':
                        case 'UTC as text using T separator':
                        case 'UTC as text using Z timezone':
                        case 'UTC as text using T separator and Z timezone':
                            if (containsDate(value)) {
                                result = new Date(value + 'Z')
                            } else {
                                result = new Date('1970-01-01 ' + value + 'Z')
                            }
                            break
                        default:
                            throw new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name: 'dataTimeFormat', value: dateTimeFormat }, 'Invalid sqlite date time format: ' + dateTimeFormat)
                    }
                } else if (typeof value === 'number' || typeof value === 'bigint') {
                    let number: number = (typeof value === 'bigint') ? Number(value) : value;

                    if (dateTimeFormat === 'Julian day as real number') {
                        result = new Date(julianToMilliseconds(number + 2440587.5 /* 1970-01-01 */))
                    } else if (dateTimeFormat === 'Unix time seconds as integer') {
                        result = new Date(number * 1000)
                    } else if (dateTimeFormat === 'Unix time milliseconds as integer') {
                        result = new Date(number)
                    } else {
                        // Try to automatically detect if it is a julian or a unix time
                        // If it have decimal, it will be considered julian, otherwise unix time
                        if (this.treatUnexpectedIntegerDateTimeAsJulian || !Number.isInteger(number)) {
                            if (number >= -1 && number <= 1) {
                                result = new Date(julianToMilliseconds(number + 2440587.5 /* 1970-01-01 */))
                            } else {
                                result = new Date(julianToMilliseconds(number))
                            }
                        } else if (this.unexpectedUnixDateTimeAreMilliseconds) {
                            result = new Date(number)
                        } else {
                            result = new Date(number * 1000)
                        }
                    }
                } else {
                    throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: type }, `Invalid localTime value received from the db: ${value} (type ${typeof value})`)
                }
                if (isNaN(result.getTime())) {
                    throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: type }, `Invalid localTime value received from the db: ${value} (.getTime() returns NaN)`)
                }
                (result as any).___type___ = 'localTime'
                result.setFullYear(1970, 0, 1)
                return result
            }
            case 'localDateTime': {
                if (typeof value === 'string') {
                    const valueAsNumber = +value
                    if (!isNaN(valueAsNumber)) {
                        value = valueAsNumber
                    }
                }
                const dateTimeFormat = this.getDateTimeFormat('dateTime')
                let result: Date
                if (value instanceof Date) {
                    result = value
                } else if (typeof value === 'string') {
                    if (containsTimezone(value)) {
                        result = new Date(value)
                    } else switch (dateTimeFormat) {
                        case 'localdate as text':
                        case 'localdate as text using T separator':
                            result = new Date(value)
                            break
                        case 'Julian day as real number':
                        case 'Unix time seconds as integer':
                            if (this.treatUnexpectedStringDateTimeAsUTC) {
                                result = new Date(value + 'Z')
                            } else {
                                result = new Date(value)
                            }
                            break
                        case 'UTC as text':
                        case 'UTC as text using T separator':
                        case 'UTC as text using Z timezone':
                        case 'UTC as text using T separator and Z timezone':
                            result = new Date(value + 'Z')
                            break
                        default:
                            throw new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name: 'dataTimeFormat', value: dateTimeFormat }, 'Invalid sqlite date time format: ' + dateTimeFormat)
                    }
                } else if (typeof value === 'number' || typeof value === 'bigint') {
                    let number: number = (typeof value === 'bigint') ? Number(value) : value;

                    if (dateTimeFormat === 'Julian day as real number') {
                        result = new Date(julianToMilliseconds(number)) // Timezone is not compesated due down time is overwrited
                    } else if (dateTimeFormat === 'Unix time seconds as integer') {
                        result = new Date(number * 1000)
                    } else if (dateTimeFormat === 'Unix time milliseconds as integer') {
                        result = new Date(number)
                    } else {
                        // Try to automatically detect if it is a julian or a unix time
                        // If it have decimal, it will be considered julian, otherwise unix time
                        if (this.treatUnexpectedIntegerDateTimeAsJulian || !Number.isInteger(value)) {
                            result = new Date(julianToMilliseconds(number))
                        } else if (this.unexpectedUnixDateTimeAreMilliseconds) {
                            result = new Date(number)
                        } else {
                            result = new Date(number * 1000)
                        }
                    }
                } else {
                    throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: type }, `Invalid localDateTime value received from the db: ${value} (type ${typeof value})`)
                }
                if (isNaN(result.getTime())) {
                    throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value, typeName: type }, `Invalid localDateTime value received from the db: ${value} (.getTime() returns NaN)`)
                }
                (result as any).___type___ = 'LocalDateTime'
                return result
            }
        }
        return super.transformValueFromDB(value, type)
    }
    protected override transformValueToDB(value: unknown, type: string): unknown {
        if (value === undefined || value == null) {
            return super.transformValueToDB(value, type)
        }
        switch (type) {
            case 'localDate':
                if (value instanceof Date && !isNaN(value.getTime())) {
                    const dateTimeFormat = this.getDateTimeFormat('date')
                    switch (dateTimeFormat) {
                        case 'localdate as text':
                        case 'localdate as text using T separator':
                        case 'UTC as text':
                        case 'UTC as text using T separator':
                        case 'UTC as text using Z timezone':
                        case 'UTC as text using T separator and Z timezone':
                            return value.getFullYear() + '-' + doubleDigit(value.getMonth() + 1) + '-' + doubleDigit(value.getDate())
                        case 'Julian day as real number':
                            return millisecondsToJulian(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()))
                        case 'Unix time seconds as integer':
                            return Math.trunc(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()) / 1000)
                        case 'Unix time milliseconds as integer':
                            return Date.UTC(value.getFullYear(), value.getMonth(), value.getDate())
                        default:
                            throw new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name: 'dataTimeFormat', value: dateTimeFormat }, 'Invalid sqlite date time format: ' + dateTimeFormat)
                    }
                }
                throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value, typeName: type }, `Invalid localDate value to send to the db: ${value} (type ${typeof value})`)
            case 'localTime':
                if (value instanceof Date && !isNaN(value.getTime())) {
                    const dateTimeFormat = this.getDateTimeFormat('time')
                    switch (dateTimeFormat) {
                        case 'localdate as text':
                        case 'localdate as text using T separator':
                            return doubleDigit(value.getHours()) + ':' + doubleDigit(value.getMinutes()) + ':' + doubleDigit(value.getSeconds()) + tripleDigitFraction(value.getMilliseconds())
                        case 'UTC as text':
                        case 'UTC as text using T separator':
                            return doubleDigit(value.getUTCHours()) + ':' + doubleDigit(value.getUTCMinutes()) + ':' + doubleDigit(value.getUTCSeconds()) + tripleDigitFraction(value.getUTCMilliseconds())
                        case 'UTC as text using Z timezone':
                        case 'UTC as text using T separator and Z timezone':
                            return doubleDigit(value.getUTCHours()) + ':' + doubleDigit(value.getUTCMinutes()) + ':' + doubleDigit(value.getUTCSeconds()) + tripleDigitFraction(value.getUTCMilliseconds()) + 'Z'
                        case 'Julian day as real number':
                            return millisecondsToJulian(Date.UTC(1970, 0, 1, value.getUTCHours(), value.getUTCMinutes(), value.getUTCSeconds(), value.getUTCMilliseconds())) - 2440587.5 /* 1970-01-01 */
                        case 'Unix time seconds as integer':
                            return Math.trunc(Date.UTC(1970, 0, 1, value.getUTCHours(), value.getUTCMinutes(), value.getUTCSeconds(), value.getUTCMilliseconds()) / 1000)
                        case 'Unix time milliseconds as integer':
                            return Date.UTC(1970, 0, 1, value.getUTCHours(), value.getUTCMinutes(), value.getUTCSeconds(), value.getUTCMilliseconds())
                        default:
                            throw new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name: 'dataTimeFormat', value: dateTimeFormat }, 'Invalid sqlite date time format: ' + dateTimeFormat)
                    }
                }
                throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value, typeName: type }, `Invalid localTime value to send to the db: ${value} (type ${typeof value})`)
            case 'localDateTime':
                if (value instanceof Date && !isNaN(value.getTime())) {
                    const dateTimeFormat = this.getDateTimeFormat('dateTime')
                    switch (dateTimeFormat) {
                        case 'localdate as text':
                            return value.getFullYear() + '-' + doubleDigit(value.getMonth() + 1) + '-' + doubleDigit(value.getDate())
                                + ' ' + doubleDigit(value.getHours()) + ':' + doubleDigit(value.getMinutes()) + ':' + doubleDigit(value.getSeconds()) + tripleDigitFraction(value.getMilliseconds())
                        case 'localdate as text using T separator':
                            return value.getFullYear() + '-' + doubleDigit(value.getMonth() + 1) + '-' + doubleDigit(value.getDate())
                                + 'T' + doubleDigit(value.getHours()) + ':' + doubleDigit(value.getMinutes()) + ':' + doubleDigit(value.getSeconds()) + tripleDigitFraction(value.getMilliseconds())
                        case 'UTC as text':
                            return value.getUTCFullYear() + '-' + doubleDigit(value.getUTCMonth() + 1) + '-' + doubleDigit(value.getUTCDate())
                                + ' ' + doubleDigit(value.getUTCHours()) + ':' + doubleDigit(value.getUTCMinutes()) + ':' + doubleDigit(value.getUTCSeconds()) + tripleDigitFraction(value.getUTCMilliseconds())
                        case 'UTC as text using T separator':
                            return value.getUTCFullYear() + '-' + doubleDigit(value.getUTCMonth() + 1) + '-' + doubleDigit(value.getUTCDate())
                                + 'T' + doubleDigit(value.getUTCHours()) + ':' + doubleDigit(value.getUTCMinutes()) + ':' + doubleDigit(value.getUTCSeconds()) + tripleDigitFraction(value.getUTCMilliseconds())
                        case 'UTC as text using Z timezone':
                            return value.getUTCFullYear() + '-' + doubleDigit(value.getUTCMonth() + 1) + '-' + doubleDigit(value.getUTCDate())
                                + ' ' + doubleDigit(value.getUTCHours()) + ':' + doubleDigit(value.getUTCMinutes()) + ':' + doubleDigit(value.getUTCSeconds()) + tripleDigitFraction(value.getUTCMilliseconds()) + 'Z'
                        case 'UTC as text using T separator and Z timezone':
                            return value.getUTCFullYear() + '-' + doubleDigit(value.getUTCMonth() + 1) + '-' + doubleDigit(value.getUTCDate())
                                + 'T' + doubleDigit(value.getUTCHours()) + ':' + doubleDigit(value.getUTCMinutes()) + ':' + doubleDigit(value.getUTCSeconds()) + tripleDigitFraction(value.getUTCMilliseconds()) + 'Z'
                        case 'Julian day as real number':
                            return millisecondsToJulian(value.getTime())
                        case 'Unix time seconds as integer':
                            return Math.trunc(value.getTime() / 1000)
                        case 'Unix time milliseconds as integer':
                            return value.getTime()
                        default:
                            throw new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name: 'dataTimeFormat', value: dateTimeFormat }, 'Invalid sqlite date time format: ' + dateTimeFormat)
                    }
                }
                throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value, typeName: type }, `Invalid localDateTime value to send to the db: ${value} (type ${typeof value})`)
        }
        return super.transformValueToDB(value, type)
    }
}

function doubleDigit(value: number): string {
    if (value > 9) {
        return '' + value
    } else {
        return '0' + value
    }
}

function tripleDigit(value: number): string {
    if (value > 99) {
        return '' + value
    } else if (value > 9) {
        return '0' + value
    } else {
        return '00' + value
    }
}

function tripleDigitFraction(value: number): string {
    if (value > 0) {
        return '.' + tripleDigit(value)
    }
    return ''
}

function millisecondsToJulian(value: number): number {
    return value / 86400000.0 + 2440587.5
}

function julianToMilliseconds(value: number): number {
    return  (value - 2440587.5) * 86400000.0
}

function containsTimezone(value: string): boolean {
    return /(([\+\-]\d\d?(:\d\d?)?)|Z)$/.test(value)
}

function containsDate(value: string): boolean {
    return /^\d+-\d\d?-\d\d?(\s|T)/.test(value)
}
