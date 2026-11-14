import type { CustomType, SqlDataType } from '../TypeAdapter.js'

// Questions about the data type of a value, asked with its type and its custom type: a custom type decides when the
// value has one (a `customLocalDate` named 'ReleaseDay' is a localDate, a `customInt` named 'localDate' is an int); a
// value without custom type is decided by its type. An `enum`, a `custom` or a `customComparable` answers no to all.

/** Whether the value is a boolean */
export function __isBoolean(type: string | undefined, customType: CustomType | undefined): boolean {
    return customType === undefined && type === 'boolean'
}

/** Whether the value is an int or a customInt */
export function __isInt(type: string | undefined, customType: CustomType | undefined): boolean {
    if (customType !== undefined) {
        return customType === 'customInt'
    }
    return type === 'int'
}

/** Whether the value is a bigint or a customBigint */
export function __isBigint(type: string | undefined, customType: CustomType | undefined): boolean {
    if (customType !== undefined) {
        return customType === 'customBigint'
    }
    return type === 'bigint'
}

/** Whether the value is a double or a customDouble */
export function __isDouble(type: string | undefined, customType: CustomType | undefined): boolean {
    if (customType !== undefined) {
        return customType === 'customDouble'
    }
    return type === 'double'
}

/**
 * Whether the value is a decimal the library sends and reads as its text, so it keeps every digit: a stringDecimal (a
 * JavaScript string) or a customDecimal (a type of the user). Every rule of the exact decimals applies to both.
 */
export function __isExactDecimal(type: string | undefined, customType: CustomType | undefined): boolean {
    if (customType !== undefined) {
        return customType === 'customDecimal'
    }
    return type === 'stringDecimal'
}

/** Whether the value is a string */
export function __isString(type: string | undefined, customType: CustomType | undefined): boolean {
    return customType === undefined && type === 'string'
}

/** Whether the value is a uuid or a customUuid */
export function __isUuid(type: string | undefined, customType: CustomType | undefined): boolean {
    if (customType !== undefined) {
        return customType === 'customUuid'
    }
    return type === 'uuid'
}

/** Whether the value is a localDate or a customLocalDate */
export function __isLocalDate(type: string | undefined, customType: CustomType | undefined): boolean {
    if (customType !== undefined) {
        return customType === 'customLocalDate'
    }
    return type === 'localDate'
}

/** Whether the value is a localTime or a customLocalTime */
export function __isLocalTime(type: string | undefined, customType: CustomType | undefined): boolean {
    if (customType !== undefined) {
        return customType === 'customLocalTime'
    }
    return type === 'localTime'
}

/** Whether the value is a localDateTime or a customLocalDateTime */
export function __isLocalDateTime(type: string | undefined, customType: CustomType | undefined): boolean {
    if (customType !== undefined) {
        return customType === 'customLocalDateTime'
    }
    return type === 'localDateTime'
}

/** Whether the value is an aggregated array */
export function __isAggregatedArray(type: string | undefined, customType: CustomType | undefined): boolean {
    return customType === undefined && type === 'aggregatedArray'
}

/**
 * Whether a SQL data type describes a value of that requested type, so a query runner can send the value with it: a
 * boolean is a boolean; a number, a numeric or a money; a text, any family but a number, a boolean, a date or a time,
 * and a binary; a uuid, a uuid; a localDate, a date; a localTime, a time; a localDateTime, a timestamp. An `enum`, a
 * `custom`, a `customComparable` or a value without a built-in type, whose value the library doesn't know, any family.
 * An adapter that sends a value as another type (a date as its text) requests the SQL data type of what it sends
 */
export function __isSqlDataTypeOf(sqlDataType: SqlDataType, type: string | undefined, customType: CustomType | undefined): boolean {
    const family = sqlDataType.family
    if (__isBoolean(type, customType)) {
        return family === 'boolean'
    }
    if (__isInt(type, customType) || __isBigint(type, customType) || __isDouble(type, customType) || __isExactDecimal(type, customType)) {
        return family === 'exact numeric' || family === 'approximate numeric' || family === 'money'
    }
    if (__isUuid(type, customType)) {
        return family === 'uuid'
    }
    if (__isLocalDate(type, customType)) {
        return family === 'datetime' && sqlDataType.fields === 'date'
    }
    if (__isLocalTime(type, customType)) {
        return family === 'datetime' && sqlDataType.fields === 'time'
    }
    if (__isLocalDateTime(type, customType)) {
        return family === 'datetime' && sqlDataType.fields === 'timestamp'
    }
    if (__isString(type, customType)) {
        return family !== 'boolean' && family !== 'exact numeric' && family !== 'approximate numeric' && family !== 'datetime' && family !== 'binary string'
    }
    return !__isAggregatedArray(type, customType)
}
