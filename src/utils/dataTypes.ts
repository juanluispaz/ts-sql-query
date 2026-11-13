import type { CustomType } from '../TypeAdapter.js'

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

const customTypes = new Set<string>([
    'customInt', 'customBigint', 'customDouble', 'customDecimal', 'customUuid',
    'customLocalDate', 'customLocalTime', 'customLocalDateTime', 'enum', 'custom', 'customComparable',
])

/** Which custom type a value type of the library is, or undefined for a built-in type */
export function __customTypeOf(valueType: string): CustomType | undefined {
    return customTypes.has(valueType) ? valueType as CustomType : undefined
}
