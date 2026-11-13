import type { CustomType } from '../TypeAdapter.js'
import type { ValueType } from '../expressions/values.js'

/**
 * The category of a type, as the modules of the query runners decide by it: the custom type when it is one (like
 * `'customInt'`), the name of a built-in type, or '' for a value without one (an aggregated array, a fragment)
 */
export type TypeCategory = Exclude<ValueType, 'aggregatedArray'>

const customTypes = new Set<string>([
    'customInt', 'customBigint', 'customDouble', 'customDecimal', 'customUuid',
    'customLocalDate', 'customLocalTime', 'customLocalDateTime', 'enum', 'custom', 'customComparable',
])

/** Which custom type a value type of the library is, or undefined for a built-in type */
export function __customTypeOf(valueType: ValueType): CustomType | undefined {
    return customTypes.has(valueType) ? valueType as CustomType : undefined
}

// The built-in types
const builtInTypes = new Set<string>([
    'boolean', 'int', 'bigint', 'double', 'stringDecimal', 'string', 'uuid', 'localDate', 'localTime', 'localDateTime',
])

/** The category of a type (see TypeCategory) */
export function __typeCategory(type: string | undefined, customType: CustomType | undefined): TypeCategory {
    if (customType) {
        return customType
    }
    return type !== undefined && builtInTypes.has(type) ? type as TypeCategory : ''
}

// The type names the default transforms of the connections convert
const convertedTypeNames = new Set<string>([
    'boolean', 'int', 'bigint', 'double', 'stringDecimal', 'string', 'uuid',
    'localDate', 'localTime', 'localDateTime', 'aggregatedArray',
])

// The type a value of each category is converted as, when its type name isn't one of the above
const conversionTypeByCategory = new Map<string, string>([
    ['boolean', 'boolean'],
    ['int', 'int'], ['bigint', 'bigint'], ['customInt', 'int'], ['customBigint', 'bigint'],
    ['double', 'double'], ['customDouble', 'double'], ['stringDecimal', 'stringDecimal'], ['customDecimal', 'customDecimal'],
    ['string', 'string'],
    ['uuid', 'uuid'], ['customUuid', 'uuid'],
    ['localDate', 'localDate'], ['customLocalDate', 'localDate'],
    ['localTime', 'localTime'], ['customLocalTime', 'localTime'],
    ['localDateTime', 'localDateTime'], ['customLocalDateTime', 'localDateTime'],
])

/**
 * The type the default transforms convert a value as: its type name when it is one they convert; otherwise, the type
 * of its category, so a `customLocalDate` named `'ReleaseDay'` is converted as a `localDate`. An `enum`, a `custom`, a
 * `customComparable` or a value without category keep their type name, and pass as they come.
 */
export function __conversionType(type: string, typeCategory: TypeCategory | undefined): string {
    if (convertedTypeNames.has(type) || !typeCategory) {
        return type
    }
    return conversionTypeByCategory.get(typeCategory) ?? type
}

/**
 * A decimal the library sends and reads as its text, so it keeps every digit: a stringDecimal (a JavaScript string)
 * or a customDecimal (a type of the user). Every rule of the exact decimals applies to both.
 */
export function __isDecimalCategory(category: string | undefined): boolean {
    return category === 'customDecimal' || category === 'stringDecimal'
}
