import type { DataTypeClass } from '../../TypeAdapter.js'
import { exactDecimalDigitsOf, rejectExactDecimalParam } from '../exactDecimalParams.js'
import { __temporalFieldsOf, __typeSqlDataTypeOf } from '../../typeSystem/dataTypes.js'
import { utcDateText, utcTimeText } from '../utcDateTimeText.js'
import { plainTemporalText } from '../plainTemporalValues.js'
import { existingParamContextOf } from '../../internal/QueryContextImpl.js'

/**
 * The placeholder of a parameter on MySQL and MariaDB, for every query runner of them. An exact number sent as its
 * text (a stringDecimal, a decimal of the user) is sent as text, and the database computes with a text in double precision, and compares it in double precision in an `in` or
 * a `between`: it is cast to a decimal with the digits of the value, except as the value of a column, whose type it
 * takes. A value beyond the widest decimal of the database (65 digits, 30 of them decimals) is rejected: the cast
 * would give 999…9 without an error, and without it the database would compute in double precision; no column can
 * hold it. Call it before adding the parameter at that index.
 */
export function mySqlMariaDBPlaceholder(placeholder: string, params: any[], index: number, value: unknown, requestedType: DataTypeClass | undefined): string {
    if (__typeSqlDataTypeOf(requestedType)?.family !== 'exact numeric') {
        return placeholder
    }
    const digits = exactDecimalDigitsOf(value)
    if (!digits) {
        return placeholder
    }
    if (digits.precision > 65 || digits.scale > 30) {
        rejectExactDecimalParam(value, requestedType?.type ?? '', index, 'decimal(65, 30)')
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
export function mySqlMariaDBParamValue(value: unknown, requestedType: DataTypeClass | undefined): unknown {
    if (!(value instanceof Date) || isNaN(value.getTime())) {
        return value
    }
    const fields = __temporalFieldsOf(requestedType)
    if (fields === 'date') {
        return utcDateText(value)
    }
    if (fields === 'time') {
        return utcTimeText(value)
    }
    if (fields === 'timestamp') {
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
        const requestedType = param?.requestedType
        // A Temporal value without zone goes as its text, with all the digits of its fraction of a second
        const plainText = plainTemporalText(value)
        if (plainText === undefined && (!(value instanceof Date) || requestedType === undefined)) {
            continue
        }
        if (!result) {
            result = params.slice()
        }
        result[i] = plainText ?? mySqlMariaDBParamValue(value, requestedType)
    }
    return result ?? params
}

/**
 * Whether Bun SQL can't bind a value as an integer of MySQL and MariaDB: a bigint beyond a signed or an unsigned 64-bit
 * integer, like one of 30 digits. It goes as its text, and is cast to a decimal where the database would compute with it
 * in double precision (mySqlMariaDBPlaceholder), as any exact number sent as text.
 */
export function bunSqlMySqlSendsAsText(value: unknown): value is bigint {
    return typeof value === 'bigint' && (value < -9223372036854775808n || value > 18446744073709551615n)
}

/** The params as Bun SQL receives them on MySQL and MariaDB: those of mySqlMariaDBDriverParams, a bigint it can't bind as its text */
export function bunSqlMySqlDriverParams(params: any[]): any[] {
    let result = mySqlMariaDBDriverParams(params)
    for (let i = 0, length = result.length; i < length; i++) {
        const value = result[i]
        if (bunSqlMySqlSendsAsText(value)) {
            if (result === params) {
                result = params.slice()
            }
            result[i] = value.toString()
        }
    }
    return result
}

