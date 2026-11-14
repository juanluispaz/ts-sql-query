import type { CustomType } from '../../TypeAdapter.js'
import { __isBigint, __isBoolean, __isDouble, __isExactDecimal, __isInt, __isLocalDate, __isLocalDateTime, __isLocalTime, __isSqlDataTypeOf, __isString, __isUuid } from '../../typeSystem/dataTypes.js'
import { connectionClassIdOf, keepDerivedOfSqlDataType, keptDerivedOfSqlDataType } from '../sqlDataTypeNames.js'
import { utcDateText, utcTimeText } from '../utcDateTimeText.js'
import { postgreSqlZonedParam } from '../metadataSymbols.js'
import { existingParamContextOf, existingQueryContextOf } from '../../internal/QueryContextImpl.js'

/**
 * The PostgreSQL type a parameter is given where the position it is written in doesn't give it one (forceTypeCast):
 * the cast written after the placeholder by the query runners that can only type a parameter in the SQL (`pg`, Bun
 * SQL), and the oid of the type the parameter is sent with by the ones whose driver can type it (postgres.js, PGlite).
 */
export interface PostgreSqlParamType {
    readonly cast: string
    /** Undefined for a type without a fixed oid (one of the user or of an extension) */
    readonly oid: number | undefined
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
const timestamptz: PostgreSqlParamType = { cast: 'timestamptz', oid: 1184 }

/** The oids of the types of PostgreSQL that have a fixed one, by the name nativeSqlDataTypeOf gives without its arguments */
const fixedOids: { readonly [cast: string]: number | undefined } = {
    'boolean': 16, 'smallint': 21, 'integer': 23, 'bigint': 20, 'real': 700, 'double precision': 701, 'numeric': 1700,
    'text': 25, 'character varying': 1043, 'character': 1042, 'bytea': 17, 'date': 1082, 'time': 1083,
    'time with time zone': 1266, 'timestamp': 1114, 'timestamp with time zone': 1184, 'interval': 1186, 'uuid': 2950,
    'json': 114, 'jsonb': 3802, 'xml': 142, 'jsonpath': 4072, 'inet': 869, 'cidr': 650, 'macaddr': 829, 'macaddr8': 774,
    'money': 790, 'bit': 1560, 'bit varying': 1562, 'point': 600, 'line': 628, 'lseg': 601, 'box': 603, 'path': 602,
    'polygon': 604, 'circle': 718, 'tsvector': 3614, 'tsquery': 3615, 'oid': 26, 'tid': 27, 'xid': 28, 'cid': 29,
    'xid8': 5069, 'pg_lsn': 3220,
}

/** Where a SQL data type keeps, hidden, the PostgreSQL type of a parameter derived from it, for each class of connection */
const paramTypeOfSqlDataTypeKey: unique symbol = Symbol('postgreSqlParamTypeOfSqlDataType')

/**
 * The PostgreSQL type of the parameter at that index from the SQL data type requested for it, when it describes the
 * value (`__isSqlDataTypeOf`): its native name without the arguments (`numeric(18, 4)` is a `numeric`,
 * `character varying(20)` a `character varying`), because a cast with them would round or cut a value that doesn't fit,
 * silently; and its oid, when the type has a fixed one. Derived once for each SQL data type and class of connection
 */
export function postgreSqlParamTypeOfSqlDataType(params: any[], index: number): PostgreSqlParamType | undefined {
    const param = existingParamContextOf(params, index)
    const sqlDataType = param?.requestedSqlDataType
    if (sqlDataType === undefined || !__isSqlDataTypeOf(sqlDataType, param!.requestedType, param!.requestedCustomType)) {
        return undefined
    }
    // A localTime has no zone: a cast to a time with time zone would complete it with the zone of the session
    if (__isLocalTime(param!.requestedType, param!.requestedCustomType) && sqlDataType.family === 'datetime' && sqlDataType.timeZone !== undefined && sqlDataType.timeZone !== 'none') {
        return undefined
    }
    const configuration = existingQueryContextOf(params)?.connectionConfiguration
    if (configuration === undefined) {
        return undefined
    }
    const connectionClassId = connectionClassIdOf(configuration)
    const kept = keptDerivedOfSqlDataType<PostgreSqlParamType>(sqlDataType, paramTypeOfSqlDataTypeKey, connectionClassId)
    if (kept !== undefined) {
        return kept === null ? undefined : kept
    }
    const native = configuration.nativeSqlDataTypeOf(sqlDataType)
    let result: PostgreSqlParamType | undefined
    if (native !== undefined) {
        const cast = native.indexOf('(') < 0 ? native : native.replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim()
        result = { cast, oid: cast.startsWith('interval') ? 1186 : fixedOids[cast] }
    }
    keepDerivedOfSqlDataType(sqlDataType, paramTypeOfSqlDataTypeKey, connectionClassId, result)
    return result
}

/**
 * Whether the parameter at that index is a localDateTime or a localTime of a database outside UTC (marked by the
 * connection before it is added): it goes as a timestamptz of its instant, which the database converts with its
 * session, in the zone of the database, where it is compared with or stored in a timestamp or a time
 */
export function isPostgreSqlZonedParam(params: any[], index: number): boolean {
    return existingParamContextOf(params, index)?.getMetadata(postgreSqlZonedParam) === true
}

/**
 * The PostgreSQL type of a parameter, from its type and its custom type; an `enum`, a `custom`, a `customComparable`
 * or a value without type gets the type of the JS value sent: a bigint is an `int8`, an integer number an `int4` or an
 * `int8` by its range, any other number a `float8`. Undefined when there is none, like for a text or a null of those
 * types.
 */
export function postgreSqlParamType(type: string | undefined, customType: CustomType | undefined, valueSentToDB: unknown, zoned: boolean = false): PostgreSqlParamType | undefined {
    if (__isBoolean(type, customType)) {
        return bool
    }
    if (__isInt(type, customType)) {
        return int4
    }
    if (__isBigint(type, customType)) {
        return int8
    }
    if (__isDouble(type, customType)) {
        return float8
    }
    if (__isExactDecimal(type, customType)) {
        return numeric
    }
    if (__isString(type, customType)) {
        return text
    }
    if (__isUuid(type, customType)) {
        return uuid
    }
    if (__isLocalDate(type, customType)) {
        return date
    }
    if (__isLocalTime(type, customType)) {
        return zoned ? timestamptz : time
    }
    if (__isLocalDateTime(type, customType)) {
        return zoned ? timestamptz : timestamp
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
 * parameter has a PostgreSQL type: the one declared for its type name in typesByName, the one of its SQL data type
 * (postgreSqlParamTypeOfSqlDataType), or the one of postgreSqlParamType.
 * A value of a database outside UTC (zoned) is always cast to a timestamptz, which the database converts with its
 * session, whatever type is declared for it.
 */
export function postgreSqlPlaceholder(index: number, value: unknown, type: string, customType: CustomType | undefined, forceTypeCast: boolean, typesByName?: { readonly [typeName: string]: string } | undefined, zoned: boolean = false, ofSqlDataType?: PostgreSqlParamType | undefined): string {
    const placeholder = '$' + (index + 1)
    if (!forceTypeCast && !zoned) {
        return placeholder
    }
    if (zoned) {
        return placeholder + '::' + timestamptz.cast + postgreSqlZonedTimeCast(type, customType, zoned)
    }
    const declared = typesByName && Object.hasOwn(typesByName, type) ? typesByName[type] : undefined
    if (declared !== undefined) {
        return placeholder + '::' + declared
    }
    if (ofSqlDataType !== undefined) {
        return placeholder + '::' + ofSqlDataType.cast
    }
    const cast = postgreSqlParamType(type, customType, value, zoned)?.cast
    if (cast) {
        return placeholder + '::' + cast + postgreSqlZonedTimeCast(type, customType, zoned)
    }
    return placeholder
}

/** A localTime of a database outside UTC, sent as a timestamptz, is turned into the time of the session: `::time` */
export function postgreSqlZonedTimeCast(type: string, customType: CustomType | undefined, zoned: boolean): string {
    return zoned && __isLocalTime(type, customType) ? '::time' : ''
}

/**
 * The value a parameter is given to the driver as on PostgreSQL, for every query runner of it: a localDate, a localTime or a
 * localDateTime that is a Date goes as the text of its UTC getters, so the database gets the same value whatever the
 * zone of the process (the drivers write a Date with the local getters, or as an instant): `YYYY-MM-DD`,
 * `HH:MM:SS.mmm` and `YYYY-MM-DD HH:MM:SS.mmm+00`, whose offset makes it the same value for a `timestamp` (that ignores
 * it) and a `timestamptz`. A year before 1 is written as PostgreSQL does, `0044-03-15 BC` for the year -43. Any other
 * value is sent as it is.
 */
export function postgreSqlParamValue(value: unknown, type: string, customType: CustomType | undefined, zoned: boolean = false): unknown {
    if (!(value instanceof Date) || isNaN(value.getTime())) {
        return value
    }
    const year = value.getUTCFullYear()
    const era = year < 1 ? ' BC' : ''
    // The year 0 is 1 BC
    const eraYear = year < 1 ? 1 - year : year
    if (__isLocalDate(type, customType)) {
        return utcDateText(value, eraYear) + era
    }
    if (__isLocalTime(type, customType)) {
        if (zoned) {
            // Its own day gives the offset the database converts it with
            return utcDateText(value, eraYear) + ' ' + utcTimeText(value) + '+00' + era
        }
        return utcTimeText(value)
    }
    if (__isLocalDateTime(type, customType)) {
        return utcDateText(value, eraYear) + ' ' + utcTimeText(value) + '+00' + era
    }
    return value
}

/**
 * The params as the drivers of PostgreSQL receive them (see postgreSqlParamValue), from the type of each parameter kept
 * in the params. The params of the query keep the value the connection handed; a copy is returned when a value changes.
 */
export function postgreSqlDriverParams(params: any[]): any[] {
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
        result[i] = postgreSqlParamValue(value, type, param?.requestedCustomType, isPostgreSqlZonedParam(params, i))
    }
    return result ?? params
}
