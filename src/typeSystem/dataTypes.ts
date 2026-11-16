import type { CustomType, DataTypeClass, SqlDataType } from '../TypeAdapter.js'

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
 * The SQL data type a data type gives its values: the `sqlDataType` of its class; undefined for one whose values only
 * the user knows (an enum, a custom one)
 */
export function __typeSqlDataTypeOf(typeClass: DataTypeClass | undefined): SqlDataType | undefined {
    return typeClass?.sqlDataType
}

/**
 * Whether a SQL data type declared for a value (the one of its column, or one requested for it) describes a value of
 * that requested type, comparing it with the SQL data type of the type: the same family, for a boolean, a uuid, a date,
 * a time and a timestamp (by its fields); any number or a money, for a number; any family but a number, a boolean, a
 * date or a time, and a binary, for a text; any, for a type without one (an enum, a custom one). One that doesn't is
 * how the database keeps a value it emulates (the char(36) of a uuid, the NUMBER(1) of a boolean), or the one of a
 * value sent as another type: it says nothing of the value sent
 */
export function __sqlDataTypeDescribes(declared: SqlDataType, requestedType: DataTypeClass | undefined): boolean {
    const ofType = requestedType?.sqlDataType
    if (ofType === undefined) {
        return true
    }
    const family = declared.family
    switch (ofType.family) {
        case 'exact numeric':
        case 'approximate numeric':
            return family === 'exact numeric' || family === 'approximate numeric' || family === 'money'
        case 'character string':
            return family !== 'boolean' && family !== 'exact numeric' && family !== 'approximate numeric' && family !== 'datetime' && family !== 'binary string'
        case 'datetime':
            return family === 'datetime' && declared.fields === ofType.fields
        default:
            return family === ofType.family
    }
}

/**
 * The fields of the date or time of a data type, by the SQL data type of its class: `'date'` for a localDate,
 * `'time'` for a localTime, `'timestamp'` for a localDateTime; undefined for any other
 */
export function __temporalFieldsOf(typeClass: DataTypeClass | undefined): 'date' | 'time' | 'timestamp' | undefined {
    const sqlDataType = typeClass?.sqlDataType
    if (sqlDataType === undefined || sqlDataType.family !== 'datetime' || sqlDataType.fields === 'year') {
        return undefined
    }
    return sqlDataType.fields
}
