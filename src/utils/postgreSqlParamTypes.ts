import type { TypeCategory } from '../TypeAdapter.js'
import { __conversionType } from './typeCategory.js'
import { utcDateText, utcTimeText } from './utcDateTimeText.js'

/**
 * The PostgreSQL type a parameter is given where the position it is written in doesn't give it one (forceTypeCast):
 * the cast written after the placeholder by the query runners that can only type a parameter in the SQL (`pg`, Bun
 * SQL), and the oid of the type the parameter is sent with by the ones whose driver can type it (postgres.js, PGlite).
 */
export interface PostgreSqlParamType {
    readonly cast: string
    readonly oid: number
}

const bool: PostgreSqlParamType = { cast: 'bool', oid: 16 }
const int4: PostgreSqlParamType = { cast: 'int4', oid: 23 }
const int8: PostgreSqlParamType = { cast: 'int8', oid: 20 }
const float8: PostgreSqlParamType = { cast: 'float8', oid: 701 }
const numeric: PostgreSqlParamType = { cast: 'numeric', oid: 1700 }
const text: PostgreSqlParamType = { cast: 'text', oid: 25 }
const uuid: PostgreSqlParamType = { cast: 'uuid', oid: 2950 }
const date: PostgreSqlParamType = { cast: 'date', oid: 1082 }
const time: PostgreSqlParamType = { cast: 'time', oid: 1083 }
const timestamp: PostgreSqlParamType = { cast: 'timestamp', oid: 1114 }

const byConversionType: { [conversionType: string]: PostgreSqlParamType } = {
    boolean: bool,
    int: int4,
    bigint: int8,
    double: float8,
    stringDecimal: numeric,
    customDecimal: numeric,
    string: text,
    uuid: uuid,
    localDate: date,
    localTime: time,
    localDateTime: timestamp,
}

/**
 * The PostgreSQL type of a parameter, from the type it is converted as (see `__conversionType`); an `enum`, a
 * `custom`, a `customComparable` or a value without category gets the type of the JS value sent: a bigint is an
 * `int8`, an integer number an `int4` or an `int8` by its range, any other number a `float8`. Undefined when there is
 * none, like for a text or a null of those types.
 */
export function postgreSqlParamType(type: string | undefined, typeCategory: TypeCategory | undefined, valueSentToDB: unknown): PostgreSqlParamType | undefined {
    if (type !== undefined) {
        const conversionType = __conversionType(type, typeCategory)
        if (Object.hasOwn(byConversionType, conversionType)) {
            return byConversionType[conversionType]
        }
    }
    if (typeof valueSentToDB === 'bigint') {
        return int8
    }
    if (typeof valueSentToDB === 'number') {
        if (Number.isInteger(valueSentToDB)) {
            if (valueSentToDB >= -2147483648 && valueSentToDB <= 2147483647) {
                return int4
            }
            return int8
        }
        return float8
    }
    return undefined
}

/**
 * The placeholder `$<index + 1>` of the parameter at that index of the params, with its cast when forceTypeCast and the
 * parameter has a PostgreSQL type: the one declared for its type name in typesByName, or the one of postgreSqlParamType.
 */
export function postgreSqlPlaceholder(index: number, value: unknown, type: string, typeCategory: TypeCategory, forceTypeCast: boolean, typesByName?: { readonly [typeName: string]: string } | undefined): string {
    const placeholder = '$' + (index + 1)
    if (!forceTypeCast) {
        return placeholder
    }
    const declared = typesByName && Object.hasOwn(typesByName, type) ? typesByName[type] : undefined
    const cast = declared ?? postgreSqlParamType(type, typeCategory, value)?.cast
    if (cast) {
        return placeholder + '::' + cast
    }
    return placeholder
}

/**
 * The value a parameter is sent as on PostgreSQL, for every query runner of it: a localDate, a localTime or a
 * localDateTime that is a Date goes as the text of its UTC getters, so the database gets the same value whatever the
 * zone of the process (the drivers write a Date with the local getters, or as an instant): `YYYY-MM-DD`,
 * `HH:MM:SS.mmm` and `YYYY-MM-DD HH:MM:SS.mmm+00`, whose offset makes it the same value for a `timestamp` (that ignores
 * it) and a `timestamptz`. A year before 1 is written as PostgreSQL does, `0044-03-15 BC` for the year -43. Any other
 * value is sent as it is.
 */
export function postgreSqlParamValue(value: unknown, type: string, typeCategory: TypeCategory): unknown {
    if (!(value instanceof Date) || isNaN(value.getTime())) {
        return value
    }
    const year = value.getUTCFullYear()
    const era = year < 1 ? ' BC' : ''
    // The year 0 is 1 BC
    const eraYear = year < 1 ? 1 - year : year
    switch (__conversionType(type, typeCategory)) {
        case 'localDate':
            return utcDateText(value, eraYear) + era
        case 'localTime':
            return utcTimeText(value)
        case 'localDateTime':
            return utcDateText(value, eraYear) + ' ' + utcTimeText(value) + '+00' + era
        default:
            return value
    }
}
