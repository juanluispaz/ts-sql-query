import type { DataTypeClass } from '../../TypeAdapter.js'
import { __sqlDataTypeDescribes, __temporalFieldsOf, __typeSqlDataTypeOf } from '../../typeSystem/dataTypes.js'
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
    'boolean': 16, 'int2': 21, 'int4': 23, 'int8': 20, 'float4': 700, 'float8': 701, 'numeric': 1700,
    'text': 25, 'varchar': 1043, 'bpchar': 1042, 'bytea': 17, 'date': 1082, 'time': 1083,
    'timetz': 1266, 'timestamp': 1114, 'timestamptz': 1184, 'interval': 1186, 'uuid': 2950,
    'json': 114, 'jsonb': 3802, 'xml': 142, 'jsonpath': 4072, 'inet': 869, 'cidr': 650, 'macaddr': 829, 'macaddr8': 774,
    'money': 790, 'varbit': 1562, 'bit varying': 1562, 'point': 600, 'line': 628, 'lseg': 601, 'box': 603, 'path': 602,
    'polygon': 604, 'circle': 718, 'tsvector': 3614, 'tsquery': 3615, 'oid': 26, 'tid': 27, 'xid': 28, 'cid': 29,
    'xid8': 5069, 'pg_lsn': 3220,
}

/** Where a SQL data type keeps, hidden, the PostgreSQL type of a parameter derived from it, for each class of connection */
const paramTypeOfSqlDataTypeKey: unique symbol = Symbol('postgreSqlParamTypeOfSqlDataType')

/**
 * The PostgreSQL type of the parameter at that index from the SQL data type requested for it, when it describes the
 * value (`__sqlDataTypeDescribes`), the one of its column or the one requested for it, or otherwise the one of the
 * type requested: its native name without the arguments
 * (castWithoutArguments), because a cast with them would round or cut a value that doesn't fit, silently; and its oid,
 * when the type has a fixed one. Derived once for each SQL data type and class of connection
 */
export function postgreSqlParamTypeOfSqlDataType(params: any[], index: number): PostgreSqlParamType | undefined {
    const param = existingParamContextOf(params, index)
    const declared = param?.requestedSqlDataType
    const sqlDataType = declared !== undefined && __sqlDataTypeDescribes(declared, param?.requestedType) ? declared : __typeSqlDataTypeOf(param?.requestedType)
    if (sqlDataType === undefined) {
        return undefined
    }
    // A localTime has no zone: a cast to a time with time zone would complete it with the zone of the session
    if (sqlDataType.family === 'datetime' && sqlDataType.fields === 'time' && sqlDataType.timeZone !== undefined && sqlDataType.timeZone !== 'none') {
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
        const cast = castWithoutArguments(native)
        result = { cast, oid: cast.startsWith('interval') ? 1186 : fixedOids[cast] }
    }
    keepDerivedOfSqlDataType(sqlDataType, paramTypeOfSqlDataTypeKey, connectionClassId, result)
    return result
}

/**
 * The type of a cast without its arguments, which would round or cut a value that doesn't fit: `numeric(18, 4)` is a
 * `numeric`, `varchar(20)` a `varchar`. A fixed length text or bit string without its length would be of length 1, and
 * cut the value: `char(5)` is a `bpchar`, the text of a fixed length of any length, and `bit(5)` a `varbit`
 */
function castWithoutArguments(native: string): string {
    if (native.indexOf('(') < 0) {
        return native
    }
    const cast = native.replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim()
    if (cast === 'char') {
        return 'bpchar'
    }
    if (cast === 'bit') {
        return 'varbit'
    }
    return cast
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
 * The PostgreSQL type of a parameter of that requested type, from the SQL data type of the type (its class): a boolean
 * is a `bool`; an integer of 4 bytes or less an `int4`, of 8 an `int8`, any other exact number a `numeric`; a floating
 * point number a `float8`; a text a `text`; a uuid a `uuid`; a date, a time and a timestamp a `date`, a `time` and a
 * `timestamp` (a `timestamptz` when zoned). A type without a SQL data type (an `enum`, an `EqualableType` or a
 * `ComparableType` of the user) or a value without type gets the type of the JS value sent: a bigint is an `int8`, an integer
 * number an `int4` or an `int8` by its range, any other number a `float8`. Undefined when there is none, like for a
 * text or a null of those types.
 */
export function postgreSqlParamType(requestedType: DataTypeClass | undefined, valueSentToDB: unknown, zoned: boolean = false): PostgreSqlParamType | undefined {
    const sqlDataType = __typeSqlDataTypeOf(requestedType)
    if (sqlDataType !== undefined) {
        switch (sqlDataType.family) {
            case 'boolean':
                return bool
            case 'exact numeric':
                if (sqlDataType.scale === 0 && sqlDataType.bytes !== undefined) {
                    return sqlDataType.bytes <= 4 ? int4 : int8
                }
                return numeric
            case 'approximate numeric':
                return float8
            case 'character string':
                return text
            case 'uuid':
                return uuid
            case 'datetime':
                if (sqlDataType.fields === 'date') {
                    return date
                }
                if (sqlDataType.fields === 'time') {
                    return zoned ? timestamptz : time
                }
                if (sqlDataType.fields === 'timestamp') {
                    return zoned ? timestamptz : timestamp
                }
                break
            default:
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
 * parameter has a PostgreSQL type: the one declared for its type name in typesByName, the one of its SQL data type
 * (postgreSqlParamTypeOfSqlDataType), or the one of postgreSqlParamType.
 * A value of a database outside UTC (zoned) is always cast to a timestamptz, which the database converts with its
 * session, whatever type is declared for it.
 */
export function postgreSqlPlaceholder(index: number, value: unknown, requestedType: DataTypeClass | undefined, forceTypeCast: boolean, typesByName?: { readonly [typeName: string]: string } | undefined, zoned: boolean = false, ofSqlDataType?: PostgreSqlParamType | undefined): string {
    const placeholder = '$' + (index + 1)
    if (!forceTypeCast && !zoned) {
        return placeholder
    }
    if (zoned) {
        return placeholder + '::' + timestamptz.cast + postgreSqlZonedTimeCast(requestedType, zoned)
    }
    const type = requestedType?.type ?? ''
    const declared = typesByName && Object.hasOwn(typesByName, type) ? typesByName[type] : undefined
    if (declared !== undefined) {
        return placeholder + '::' + declared
    }
    if (ofSqlDataType !== undefined) {
        return placeholder + '::' + ofSqlDataType.cast
    }
    const cast = postgreSqlParamType(requestedType, value, zoned)?.cast
    if (cast) {
        return placeholder + '::' + cast + postgreSqlZonedTimeCast(requestedType, zoned)
    }
    return placeholder
}

/** A localTime of a database outside UTC, sent as a timestamptz, is turned into the time of the session: `::time` */
export function postgreSqlZonedTimeCast(requestedType: DataTypeClass | undefined, zoned: boolean): string {
    return zoned && __temporalFieldsOf(requestedType) === 'time' ? '::time' : ''
}

/**
 * The value a parameter is given to the driver as on PostgreSQL, for every query runner of it: a localDate, a localTime or a
 * localDateTime that is a Date goes as the text of its UTC getters, so the database gets the same value whatever the
 * zone of the process (the drivers write a Date with the local getters, or as an instant): `YYYY-MM-DD`,
 * `HH:MM:SS.mmm` and `YYYY-MM-DD HH:MM:SS.mmm+00`, whose offset makes it the same value for a `timestamp` (that ignores
 * it) and a `timestamptz`. A year before 1 is written as PostgreSQL does, `0044-03-15 BC` for the year -43. Any other
 * value is sent as it is.
 */
export function postgreSqlParamValue(value: unknown, requestedType: DataTypeClass | undefined, zoned: boolean = false): unknown {
    if (!(value instanceof Date) || isNaN(value.getTime())) {
        return value
    }
    const year = value.getUTCFullYear()
    const era = year < 1 ? ' BC' : ''
    // The year 0 is 1 BC
    const eraYear = year < 1 ? 1 - year : year
    const fields = __temporalFieldsOf(requestedType)
    if (fields === 'date') {
        return utcDateText(value, eraYear) + era
    }
    if (fields === 'time') {
        if (zoned) {
            // Its own day gives the offset the database converts it with
            return utcDateText(value, eraYear) + ' ' + utcTimeText(value) + '+00' + era
        }
        return utcTimeText(value)
    }
    if (fields === 'timestamp') {
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
        const requestedType = param?.requestedType
        if (!(value instanceof Date) || requestedType === undefined) {
            continue
        }
        if (!result) {
            result = params.slice()
        }
        result[i] = postgreSqlParamValue(value, requestedType, isPostgreSqlZonedParam(params, i))
    }
    return result ?? params
}
