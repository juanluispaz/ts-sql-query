import type { TypeCategory } from '../TypeAdapter.js'
import { __conversionType } from './typeCategory.js'

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
