import type { TypeCategory } from '../../TypeAdapter.js'
import { customDecimalDigitsOf, rejectCustomDecimalParam } from '../customDecimalParams.js'
import { __conversionType, __isDecimalCategory } from '../typeCategory.js'
import { getParamMetadata, oracleDateParam, oracleZonedParam, queryParamValueForColumn } from '../metadataSymbols.js'

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
export function oracleTemporalBind(value: unknown, type: string | undefined, typeCategory: TypeCategory | undefined, processInUtc: boolean, ofDate: boolean): { val: Date, type: 'date' | 'timestamp' } | undefined {
    if (!(value instanceof Date) || isNaN(value.getTime()) || type === undefined) {
        return undefined
    }
    switch (__conversionType(type, typeCategory)) {
        case 'localDate': {
            const day = Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
            return { val: processInUtc ? new Date(day) : new OracleUtcDigitsDate(day), type: 'date' }
        }
        case 'localTime':
        case 'localDateTime':
            // Of a DATE (oracleDateParam of metadataSymbols.ts), a value of whole seconds is a DATE, which the column compares with as it
            // is; one with a fraction stays a TIMESTAMP, which keeps it (10:00:00.500 is after a DATE of 10:00:00)
            return { val: processInUtc ? value : new OracleUtcDigitsDate(value.getTime()), type: ofDate && value.getUTCMilliseconds() === 0 ? 'date' : 'timestamp' }
        default:
            return undefined
    }
}

/** Whether the parameter at that index is a localDateTime or a localTime of a database outside UTC (oracleZonedParam) */
export function isOracleZonedParam(params: any[], index: number): boolean {
    return getParamMetadata(params, index, oracleZonedParam) === true
}

/**
 * The placeholder of a localDateTime or a localTime of a database outside UTC, about to be added at that index, which
 * is sent as a TIMESTAMP WITH LOCAL TIME ZONE of its instant: as the value of a column (an insert, the set of an
 * update) Oracle converts it with its session into the wall clock it stores, and the placeholder is the bare one;
 * anywhere else it is cast to the type of the column, the wall clock of the session, so the column compares with it as
 * it is and its index can be used: `cast(:0 as timestamp)`, or `cast(:0 as date)` for a value of whole seconds of a DATE
 * column (oracleDateParam). A null, or any other parameter, keeps the bare placeholder.
 */
export function oraclePlaceholder(placeholder: string, params: any[], index: number, value: unknown): string {
    if (!(value instanceof Date) || !isOracleZonedParam(params, index) || (getParamMetadata(params, index, queryParamValueForColumn) === true)) {
        return placeholder
    }
    const ofDate = getParamMetadata(params, index, oracleDateParam) === true && value.getUTCMilliseconds() === 0
    return 'cast(' + placeholder + (ofDate ? ' as date)' : ' as timestamp)')
}
