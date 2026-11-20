import type { DataTypeClass } from '../../TypeAdapter.js'
import { exactDecimalDigitsOf, rejectExactDecimalParam } from '../exactDecimalParams.js'
import { __typeSqlDataTypeOf } from '../../typeSystem/dataTypes.js'
import { existingParamContextOf } from '../../internal/QueryContextImpl.js'
import { __temporalIfAvailable, type TemporalPlainDateTime, type TemporalPlainTime } from '../../typeSystem/temporal.js'
import { utcDateText, utcTimeText } from '../utcDateTimeText.js'
import { instantUtcDateTime } from '../instantValues.js'

/**
 * The placeholder of a parameter on SQL Server, for every query runner of it. An exact number sent as its text (a
 * stringDecimal, an exact decimal, a number or a bigint of an exact number that isn't an integer of a fixed size) is
 * sent as an nvarchar:
 * two of them would be concatenated, a modulo rejects it, and alone it would be cut to the width of the text it is
 * converted to; it is cast to a decimal with the digits of the value, except as the value of a column, whose type it
 * takes. A value beyond the widest decimal of the database (38 digits) is rejected: the cast would fail, and no
 * column can hold it. Call it before adding the parameter at that index.
 */
export function sqlServerPlaceholder(placeholder: string, params: any[], index: number, value: unknown, requestedType: DataTypeClass | undefined): string {
    const sqlDataType = __typeSqlDataTypeOf(requestedType)
    if (sqlDataType?.family !== 'exact numeric') {
        return placeholder
    }
    // An integer of a fixed size goes as one (an Int, a BigInt); any other exact number, as its text
    const sentAsText = sqlDataType.scale !== 0 || sqlDataType.bytes === undefined
    const digits = typeof value === 'string' ? exactDecimalDigitsOf(value) : sentAsText && (typeof value === 'bigint' || typeof value === 'number') ? exactDecimalDigitsOf(String(value)) : undefined
    if (!digits) {
        return placeholder
    }
    if (digits.precision > 38) {
        rejectExactDecimalParam(value, requestedType?.type ?? '', index, 'decimal(38)')
    }
    if ((existingParamContextOf(params, index)?.isValueForColumn === true)) {
        return placeholder
    }
    return 'cast(' + placeholder + ' as decimal(' + digits.precision + ', ' + digits.scale + '))'
}

/**
 * The Date tedious binds a Temporal value without zone with, as a date, a time or a datetime2: the digits of the value
 * in its UTC getters (the query runners bind with useUTC), and the digits below the millisecond in its
 * `nanosecondDelta` (in seconds), which tedious adds to the value it writes, so a datetime2(7) and a time(7) get all of
 * them. Undefined for any other value. Made when the query is executed: the params keep the Temporal value.
 */
export function sqlServerTemporalDate(value: unknown): Date | undefined {
    const temporal = __temporalIfAvailable()
    if (!temporal || value === null || typeof value !== 'object') {
        return undefined
    }
    const result: any = new Date(0)
    if (value instanceof temporal.PlainDate) {
        result.setUTCFullYear(value.year, value.month - 1, value.day)
        return result
    }
    let time: TemporalPlainTime | TemporalPlainDateTime
    if (value instanceof temporal.Instant) {
        // An instant, as the wall clock of its instant in UTC (a datetimeoffset column takes it with +00:00)
        const dateTime = instantUtcDateTime(value)!
        result.setUTCFullYear(dateTime.year, dateTime.month - 1, dateTime.day)
        time = dateTime
    } else if (value instanceof temporal.PlainDateTime) {
        result.setUTCFullYear(value.year, value.month - 1, value.day)
        time = value
    } else if (value instanceof temporal.PlainTime) {
        time = value
    } else {
        return undefined
    }
    result.setUTCHours(time.hour, time.minute, time.second, time.millisecond)
    result.nanosecondDelta = (time.microsecond * 1000 + time.nanosecond) / 1_000_000_000
    return result
}

/**
 * The text of a date, a time or a datetime2 that tedious delivers as a Date: its UTC getters, and the digits below the
 * millisecond, which tedious keeps apart in its `nanosecondsDelta` (in seconds): `YYYY-MM-DDTHH:MM:SS.fffffff`, for a
 * Temporal value without zone, which the connection reads with all its digits. Any other value is given as it is.
 */
export function sqlServerTemporalText(value: unknown): unknown {
    if (!(value instanceof Date) || isNaN(value.getTime())) {
        return value
    }
    const delta = (value as any).nanosecondsDelta
    const hundredsOfNanoseconds = typeof delta === 'number' ? Math.round(delta * 10_000_000) : 0
    return utcDateText(value) + 'T' + utcTimeText(value) + String(hundredsOfNanoseconds).padStart(4, '0')
}
