import type { TypeCategory } from '../TypeAdapter.js'
import type { ValueType } from '../expressions/values.js'

/**
 * The category given to the transforms and to the query runners for a value type of the library: the same word,
 * except the internal ones, that have no category.
 */
export function __typeCategoryOf(valueType: ValueType): TypeCategory {
    if (valueType === 'aggregatedArray') {
        return ''
    }
    return valueType
}

// The type names the default transforms of the connections convert
const convertedTypeNames = new Set<string>([
    'boolean', 'int', 'stringInt', 'bigint', 'double', 'stringDouble', 'string', 'uuid',
    'localDate', 'localTime', 'localDateTime', 'aggregatedArray',
])

// The type a value of each category is converted as, when its type name isn't one of the above
const conversionTypeByCategory = new Map<string, string>([
    ['boolean', 'boolean'],
    ['int', 'int'], ['bigint', 'bigint'], ['customInt', 'int'], ['customBigint', 'bigint'],
    ['double', 'double'], ['customDouble', 'double'],
    ['string', 'string'],
    ['uuid', 'uuid'], ['customUuid', 'uuid'],
    ['localDate', 'localDate'], ['customLocalDate', 'localDate'],
    ['localTime', 'localTime'], ['customLocalTime', 'localTime'],
    ['localDateTime', 'localDateTime'], ['customLocalDateTime', 'localDateTime'],
])

/**
 * The type the default transforms convert a value as: its type name when it is one they convert, so an adapter
 * that calls `next` with another type changes the conversion; otherwise, the type of its category, so a
 * `customLocalDate` named `'ReleaseDay'` is converted as a `localDate`. An `enum`, a `custom`, a `customComparable`
 * or a value without category keep their type name, and pass as they come.
 */
export function __conversionType(type: string, typeCategory: TypeCategory | undefined): string {
    if (convertedTypeNames.has(type) || !typeCategory) {
        return type
    }
    return conversionTypeByCategory.get(typeCategory) ?? type
}
