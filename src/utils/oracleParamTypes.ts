import type { TypeCategory } from '../TypeAdapter.js'
import { customDecimalDigitsOf, rejectCustomDecimalParam } from './customDecimalParams.js'
import { __conversionType, __isDecimalCategory } from './typeCategory.js'

/**
 * Checks a parameter on Oracle, for every query runner of it: the number of the database keeps 38 significant
 * digits, so a customDecimal with more, which would be rounded in a computation without an error and that no column
 * can hold, is rejected. Call it before adding the parameter at that index.
 */
export function checkOracleParam(index: number, value: unknown, type: string, typeCategory: TypeCategory): void {
    if (!__isDecimalCategory(typeCategory)) {
        return
    }
    const digits = customDecimalDigitsOf(value)
    if (digits && digits.significantDigits > 38) {
        rejectCustomDecimalParam(value, type, index, 'a number of 38 significant digits')
    }
}

/**
 * The Date a localDate, a localTime or a localDateTime that is a Date is bound with by every query runner of Oracle,
 * as a timestamp with time zone (oracledb's DB_TYPE_TIMESTAMP_TZ), which oracledb writes with the UTC getters, where a
 * timestamp or a date (the bind it gives a Date) is written with the local ones. The values are in UTC, and Oracle
 * converts that bind with the zone of the session (UTC, see requireOracleSessionInDatabaseZone) where it is compared with or
 * stored in a date or a timestamp. A localDate is bound at the start of its UTC day, so it equals the value of a date
 * column with that day. Undefined for any other value, which is bound as it is. The params of the query don't change.
 */
export function oracleUtcTimestampBindValue(value: unknown, type: string | undefined, typeCategory: TypeCategory | undefined): Date | undefined {
    if (!(value instanceof Date) || isNaN(value.getTime()) || type === undefined) {
        return undefined
    }
    switch (__conversionType(type, typeCategory)) {
        case 'localDate':
            return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
        case 'localTime':
        case 'localDateTime':
            return value
        default:
            return undefined
    }
}
