import type { CustomType } from '../../TypeAdapter.js'
import { customDecimalDigitsOf, rejectCustomDecimalParam } from '../customDecimalParams.js'
import { __isExactDecimal, __isLocalDate, __isLocalDateTime, __isLocalTime } from '../dataTypes.js'
import { utcDateText, utcTimeText } from '../utcDateTimeText.js'
import { existingParamContextOf } from '../../internal/QueryContextImpl.js'

/**
 * The placeholder of a parameter on MySQL and MariaDB, for every query runner of them. A customDecimal is sent as
 * text, and the database computes with a text in double precision, and compares it in double precision in an `in` or
 * a `between`: it is cast to a decimal with the digits of the value, except as the value of a column, whose type it
 * takes. A value beyond the widest decimal of the database (65 digits, 30 of them decimals) is rejected: the cast
 * would give 999…9 without an error, and without it the database would compute in double precision; no column can
 * hold it. Call it before adding the parameter at that index.
 */
export function mySqlMariaDBPlaceholder(placeholder: string, params: any[], index: number, value: unknown, type: string, customType: CustomType | undefined): string {
    if (!__isExactDecimal(type, customType)) {
        return placeholder
    }
    const digits = customDecimalDigitsOf(value)
    if (!digits) {
        return placeholder
    }
    if (digits.precision > 65 || digits.scale > 30) {
        rejectCustomDecimalParam(value, type, index, 'decimal(65, 30)')
    }
    if ((existingParamContextOf(params, index)?.isValueForColumn === true)) {
        return placeholder
    }
    return 'cast(' + placeholder + ' as decimal(' + digits.precision + ', ' + digits.scale + '))'
}

/**
 * The value a parameter is given to the driver as on MySQL and MariaDB, for every query runner of them: a localDate, a localTime or a
 * localDateTime that is a Date goes as the text of its UTC getters, so the database gets the same value whatever the
 * zone of the process (the drivers write a Date with the local getters): `YYYY-MM-DD`, `HH:MM:SS.mmm` and
 * `YYYY-MM-DD HH:MM:SS.mmm`, with a space and without an offset, the form every version reads in every position (MySQL
 * 5.7 and MariaDB reject an offset, and all of them a `Z`). A date sent as a date also compares equal to a `date`
 * column, which the text of a whole date and time doesn't. Any other value is sent as it is.
 */
export function mySqlMariaDBParamValue(value: unknown, type: string, customType: CustomType | undefined): unknown {
    if (!(value instanceof Date) || isNaN(value.getTime())) {
        return value
    }
    if (__isLocalDate(type, customType)) {
        return utcDateText(value)
    }
    if (__isLocalTime(type, customType)) {
        return utcTimeText(value)
    }
    if (__isLocalDateTime(type, customType)) {
        return utcDateText(value) + ' ' + utcTimeText(value)
    }
    return value
}

/**
 * The params as the drivers of MySQL and MariaDB receive them (see mySqlMariaDBParamValue), from the type of each parameter
 * kept in the params. The params of the query keep the value the connection handed; a copy is returned when a value
 * changes.
 */
export function mySqlMariaDBDriverParams(params: any[]): any[] {
    let result: any[] | undefined = undefined
    for (let i = 0, length = params.length; i < length; i++) {
        const value = params[i]
        const param = existingParamContextOf(params, i)
        const type = param?.requestedType
        if (!(value instanceof Date) || type === undefined) {
            continue
        }
        if (!result) {
            result = params.slice()
        }
        result[i] = mySqlMariaDBParamValue(value, type, param?.requestedCustomType)
    }
    return result ?? params
}
