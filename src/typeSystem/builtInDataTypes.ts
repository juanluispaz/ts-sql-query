import type { NSource } from '../utils/sourceName.js'
import type { OptionalType } from './valueSource.js'
import type { BooleanType } from './logical.js'
import type { DoubleType, IntType } from './number.js'
import type { BigintType } from './bigint.js'
import type { StringDecimalType } from './decimals.js'
import type { StringType } from './strings.js'
import type { UuidType } from './uuids.js'
import type { LocalDateTimeType, LocalDateType, LocalTimeType } from './localDates.js'
import type { IValueSource, ValueSource } from './base.js'
import type { FragmentExpression } from './fragments.js'

// The data types the library has, named by the type given to a column, a constant, a fragment or an argument, and what
// each one is in each position: the type of its value, its value source, what a position that takes it accepts, and its
// fragment expression. A custom data type is not here: it gives its type name besides its type.

/** The type of the value of each built-in data type */
export interface BuiltInDataTypeValues {
    boolean: boolean
    int: number
    bigint: bigint
    double: number
    string: string
    uuid: string
    stringDecimal: string
    localDate: Date
    localTime: Date
    localDateTime: Date
}

/** The data type of each built-in data type */
export interface BuiltInDataTypes {
    boolean: BooleanType
    int: IntType
    bigint: BigintType
    double: DoubleType
    string: StringType
    uuid: UuidType
    stringDecimal: StringDecimalType
    localDate: LocalDateType
    localTime: LocalTimeType
    localDateTime: LocalDateTimeType
}

/** The name of a built-in data type */
export type BuiltInDataType = keyof BuiltInDataTypeValues

/** The value source of each built-in data type */
export type BuiltInDataTypeValueSources</*in|out*/ SOURCE extends NSource, /*in|out*/ OPTIONAL_TYPE extends OptionalType> = {
    [TYPE in BuiltInDataType]: ValueSource<SOURCE, BuiltInDataTypes[TYPE], OPTIONAL_TYPE>
}

/** What a position that takes a value of each built-in data type accepts */
export type BuiltInDataTypeInputs</*in|out*/ SOURCE extends NSource, /*in|out*/ OPTIONAL_TYPE extends OptionalType> = {
    [TYPE in BuiltInDataType]: IValueSource<SOURCE, BuiltInDataTypes[TYPE], OPTIONAL_TYPE>
}

/** The fragment expression of each built-in data type */
export type BuiltInDataTypeFragments</*in|out*/ NO_SOURCE extends NSource, /*in|out*/ OPTIONAL_TYPE extends OptionalType, /*in|out*/ EXTRA_SOURCE extends NSource = never> = {
    [TYPE in BuiltInDataType]: FragmentExpression<NO_SOURCE, BuiltInDataTypes[TYPE], OPTIONAL_TYPE, EXTRA_SOURCE>
}
