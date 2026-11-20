import type { DataTypeClass } from '../../TypeAdapter.js'
import { exactDecimalDigitsOf, rejectExactDecimalParam } from '../exactDecimalParams.js'
import { __durationSqlDataTypeOf, __temporalFieldsOf, __typeSqlDataTypeOf } from '../../typeSystem/dataTypes.js'
import { oracleDateParam, oracleZonedParam } from '../metadataSymbols.js'
import { existingParamContextOf } from '../../internal/QueryContextImpl.js'
import { isDurationValue } from '../durationValues.js'
import { instantUtcDateTime, isInstantValue, isZonedDateTimeValue } from '../instantValues.js'
import { __temporalIfAvailable, type TemporalPlainDateTime, type TemporalPlainTime } from '../../typeSystem/temporal.js'

/**
 * Checks a parameter on Oracle, for every query runner of it: the number of the database keeps 38 significant
 * digits, so an exact number sent as its text (a stringDecimal, a decimal of the user) with more, which would be rounded in a computation without an error and that no column
 * can hold, is rejected. Call it before adding the parameter at that index.
 */
export function checkOracleParam(index: number, value: unknown, requestedType: DataTypeClass | undefined): void {
    if (__typeSqlDataTypeOf(requestedType)?.family !== 'exact numeric') {
        return
    }
    const digits = exactDecimalDigitsOf(value)
    if (digits && digits.significantDigits > 38) {
        rejectExactDecimalParam(value, requestedType?.type ?? '', index, 'a number of 38 significant digits')
    }
}

/**
 * A Date whose local getters give its UTC digits. oracledb writes a DATE or a TIMESTAMP bind with the local getters of
 * the Date it receives, which it doesn't copy (in Thin, `writeOracleDate` of lib/impl/datahandlers/buffer.js; the
 * fraction from getUTCMilliseconds), so with this one Oracle receives the UTC digits whatever the zone of the process,
 * also a time that the zone of the process skips. Only in the binds given to oracledb, never in the params.
 */
class OracleUtcDigitsDate extends Date {
    override getFullYear(): number { return this.getUTCFullYear() }
    override getMonth(): number { return this.getUTCMonth() }
    override getDate(): number { return this.getUTCDate() }
    override getHours(): number { return this.getUTCHours() }
    override getMinutes(): number { return this.getUTCMinutes() }
    override getSeconds(): number { return this.getUTCSeconds() }
    // Thick reads the fraction with this one
    override getMilliseconds(): number { return this.getUTCMilliseconds() }
}

/**
 * The bind every query runner of Oracle gives a localDate, a localTime or a localDateTime that is a Date: a DATE (a
 * localDate, at the start of its UTC day, and a value of whole seconds of a DATE column) or a TIMESTAMP with the digits
 * of its UTC getters, so a date or a timestamp
 * column compares with it as it is, and its index can be used (compared with a timestamp with time zone, Oracle converts
 * the column: SYS_EXTRACT_UTC(INTERNAL_FUNCTION(column))). In a process in UTC the local getters are the UTC ones and the
 * Date goes as it is; otherwise a copy whose local getters are the UTC ones. Undefined for any other value, which is
 * bound as it is. Called when the query is executed: the params of the query don't change.
 */
export function oracleTemporalBind(value: unknown, requestedType: DataTypeClass | undefined, processInUtc: boolean, ofDate: boolean): { val: Date, type: 'date' | 'timestamp' } | undefined {
    if (!(value instanceof Date) || isNaN(value.getTime())) {
        return undefined
    }
    const fields = __temporalFieldsOf(requestedType)
    if (fields === 'date') {
        const day = Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
        return { val: processInUtc ? new Date(day) : new OracleUtcDigitsDate(day), type: 'date' }
    }
    if (fields === 'time' || fields === 'timestamp') {
        // Of a DATE (oracleDateParam of metadataSymbols.ts), a value of whole seconds is a DATE, which the column compares with as it
        // is; one with a fraction stays a TIMESTAMP, which keeps it (10:00:00.500 is after a DATE of 10:00:00)
        return { val: processInUtc ? value : new OracleUtcDigitsDate(value.getTime()), type: ofDate && value.getUTCMilliseconds() === 0 ? 'date' : 'timestamp' }
    }
    return undefined
}

/** Whether the parameter at that index is a localDateTime or a localTime of a database outside UTC (oracleZonedParam) */
export function isOracleZonedParam(params: any[], index: number): boolean {
    return existingParamContextOf(params, index)?.getMetadata(oracleZonedParam) === true
}

/**
 * The placeholder of a localDateTime or a localTime of a database outside UTC, about to be added at that index, which
 * is sent as a TIMESTAMP WITH LOCAL TIME ZONE of its instant: as the value of a column (an insert, the set of an
 * update) Oracle converts it with its session into the wall clock it stores, and the placeholder is the bare one;
 * anywhere else it is cast to the type of the column, the wall clock of the session, so the column compares with it as
 * it is and its index can be used: `cast(:0 as timestamp)`, or `cast(:0 as date)` for a value of whole seconds of a DATE
 * column (oracleDateParam). A localTime, in every position, is the time of the day of that wall clock on 1970-01-01,
 * the day every localTime is kept on: `timestamp '1970-01-01 00:00:00' + (cast(:0 as timestamp) - trunc(cast(:0 as
 * timestamp)))`. A null, or any other parameter, keeps the bare placeholder.
 */
export function oraclePlaceholder(placeholder: string, params: any[], index: number, value: unknown): string {
    const plain = oraclePlainTemporalFormOfParam(params, index, value)
    if (plain !== undefined && isInstantValue(value) && isOracleZonedParam(params, index)) {
        // An instant of a database outside UTC: the wall clock of its instant in UTC, converted to the wall clock of the
        // session (the zone of the database), the one a column without zone keeps and compares with
        const ofDate = existingParamContextOf(params, index)?.getMetadata(oracleDateParam) === true && (value as { epochNanoseconds: bigint }).epochNanoseconds % 1_000_000_000n === 0n
        return 'cast(from_tz(' + plain.conversion + '(' + placeholder + ", '" + plain.format + "', 'NLS_DATE_LANGUAGE=AMERICAN'), '+00:00') at local as " + (ofDate ? 'date)' : 'timestamp)')
    }
    if (plain !== undefined && isZonedDateTimeValue(value)) {
        // A zoned date and time: the wall clock of its instant in UTC, in its zone, written by its name (Temporal checked
        // it): the instant it is, without the ambiguity of a wall clock the zone repeats
        return '(from_tz(' + plain.conversion + '(' + placeholder + ", '" + plain.format + "', 'NLS_DATE_LANGUAGE=AMERICAN'), '+00:00') at time zone '" + value.timeZoneId.replace(/'/g, "''") + "')"
    }
    if (plain !== undefined) {
        // A Temporal value without zone is sent as its text, converted with a format of its own, whatever the formats
        // and the language of the session (NLS_DATE_FORMAT, NLS_TIMESTAMP_FORMAT, NLS_DATE_LANGUAGE)
        return plain.conversion + '(' + placeholder + ", '" + plain.format + "', 'NLS_DATE_LANGUAGE=AMERICAN')"
    }
    if (isDurationValue(value)) {
        // A duration is sent as its ISO 8601 text, converted to the interval of its column: of years to months when the
        // column says it, of days to seconds otherwise
        return (isYearToMonthParam(params, index) ? 'to_yminterval(' : 'to_dsinterval(') + placeholder + ')'
    }
    if (!(value instanceof Date) || !isOracleZonedParam(params, index)) {
        return placeholder
    }
    const param = existingParamContextOf(params, index)
    const ofDate = param?.getMetadata(oracleDateParam) === true && value.getUTCMilliseconds() === 0
    const cast = 'cast(' + placeholder + (ofDate ? ' as date)' : ' as timestamp)')
    if (__temporalFieldsOf(param?.requestedType) === 'time') {
        // A localTime is kept on 1970-01-01, as in UTC: the time of the day of the wall clock, also as the value of a
        // column, so a time after midnight in the zone of the database isn't kept on another day
        return (ofDate ? "date '1970-01-01'" : "timestamp '1970-01-01 00:00:00'") + ' + (' + cast + ' - trunc(' + cast + '))'
    }
    if (param?.isValueForColumn === true) {
        return placeholder
    }
    return cast
}

/**
 * How a Temporal value without zone is sent on Oracle: its text, and the conversion and the format that read it, with
 * the era always written (`AD` or `BC`; Oracle has no year 0, the year 1 BC). A PlainDate is a DATE
 * (`to_date(:0, 'YYYY-MM-DD BC')`); a PlainTime is a TIMESTAMP on 1970-01-01, the day a time of the day is kept on in
 * Oracle, which has no TIME type; a PlainDateTime is a TIMESTAMP with all the digits of its fraction of a second
 * (`to_timestamp(:0, 'YYYY-MM-DD HH24:MI:SS.FF9 BC')`), or a DATE when it is the value of a DATE column (`ofDate`) of
 * whole seconds, which the column compares with as it is, so its index can be used. Undefined for any other value.
 */
export function oraclePlainTemporalForm(value: unknown, ofDate: boolean): { text: string, conversion: 'to_date' | 'to_timestamp', format: string } | undefined {
    const temporal = __temporalIfAvailable()
    if (!temporal || value === null || typeof value !== 'object') {
        return undefined
    }
    if (value instanceof temporal.ZonedDateTime) {
        // A zoned date and time, as the wall clock of its instant in UTC (its placeholder gives it its zone)
        value = instantUtcDateTime(value.toInstant())
    } else if (value instanceof temporal.Instant) {
        // An instant, as the wall clock of its instant in UTC
        value = instantUtcDateTime(value)
    }
    if (value instanceof temporal.PlainDate) {
        return { text: oracleDateText(value.year, value.month, value.day), conversion: 'to_date', format: 'YYYY-MM-DD BC' }
    }
    let date: string
    let time: TemporalPlainTime | TemporalPlainDateTime
    if (value instanceof temporal.PlainDateTime) {
        date = oracleDateText(value.year, value.month, value.day)
        time = value
    } else if (value instanceof temporal.PlainTime) {
        date = '1970-01-01 AD'
        time = value
    } else {
        return undefined
    }
    const era = date.slice(-3)
    const day = date.slice(0, -3)
    const clock = pad(time.hour, 2) + ':' + pad(time.minute, 2) + ':' + pad(time.second, 2)
    if (ofDate && time.millisecond === 0 && time.microsecond === 0 && time.nanosecond === 0) {
        return { text: day + ' ' + clock + era, conversion: 'to_date', format: 'YYYY-MM-DD HH24:MI:SS BC' }
    }
    const fraction = pad(time.millisecond, 3) + pad(time.microsecond, 3) + pad(time.nanosecond, 3)
    return { text: day + ' ' + clock + '.' + fraction + era, conversion: 'to_timestamp', format: 'YYYY-MM-DD HH24:MI:SS.FF9 BC' }
}

/**
 * How the parameter at that index is sent when it is a Temporal value without zone or an instant (see
 * oraclePlainTemporalForm): an instant of a database outside UTC always as a TIMESTAMP, which its placeholder converts
 * (see oraclePlaceholder)
 */
export function oraclePlainTemporalFormOfParam(params: any[], index: number, value: unknown): { text: string, conversion: 'to_date' | 'to_timestamp', format: string } | undefined {
    const ofDate = existingParamContextOf(params, index)?.getMetadata(oracleDateParam) === true && !(isInstantValue(value) && isOracleZonedParam(params, index))
    return oraclePlainTemporalForm(value, ofDate)
}

/** `YYYY-MM-DD AD`, or `YYYY-MM-DD BC` for a year before 1 (the year 0 is 1 BC) */
function oracleDateText(year: number, month: number, day: number): string {
    const bc = year < 1
    return pad(bc ? 1 - year : year, 4) + '-' + pad(month, 2) + '-' + pad(day, 2) + (bc ? ' BC' : ' AD')
}

function pad(value: number, length: number): string {
    return String(value).padStart(length, '0')
}

/** Whether the parameter at that index is a duration of an interval of years to months (its requested SQL data type) */
export function isYearToMonthParam(params: any[], index: number): boolean {
    const param = existingParamContextOf(params, index)
    const sqlDataType = __durationSqlDataTypeOf(param?.requestedSqlDataType, param?.requestedType)
    return sqlDataType?.family === 'interval' && sqlDataType.fields === 'year to month'
}
