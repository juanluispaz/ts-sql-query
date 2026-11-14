import type { NSource } from '../utils/sourceName.js'
import type { OptionalType } from './valueSource.js'
import type { BigintValueSource, BooleanValueSource, IBigintValueSource, IBooleanValueSource, ILocalDateTimeValueSource, ILocalDateValueSource, ILocalTimeValueSource, INumberValueSource, IStringDecimalValueSource, IStringValueSource, IUuidValueSource, LocalDateTimeValueSource, LocalDateValueSource, LocalTimeValueSource, NumberValueSource, StringDecimalValueSource, StringValueSource, UuidValueSource } from '../expressions/values.js'
import type { BigintFragmentExpression, BooleanFragmentExpression, LocalDateFragmentExpression, LocalDateTimeFragmentExpression, LocalTimeFragmentExpression, NumberFragmentExpression, StringDecimalFragmentExpression, StringFragmentExpression, UuidFragmentExpression } from '../expressions/fragment.js'

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

/** The name of a built-in data type */
export type BuiltInDataType = keyof BuiltInDataTypeValues

/** The value source of each built-in data type */
export interface BuiltInDataTypeValueSources</*in|out*/ SOURCE extends NSource, /*in|out*/ OPTIONAL_TYPE extends OptionalType> {
    boolean: BooleanValueSource<SOURCE, OPTIONAL_TYPE>
    int: NumberValueSource<SOURCE, OPTIONAL_TYPE>
    bigint: BigintValueSource<SOURCE, OPTIONAL_TYPE>
    double: NumberValueSource<SOURCE, OPTIONAL_TYPE>
    string: StringValueSource<SOURCE, OPTIONAL_TYPE>
    uuid: UuidValueSource<SOURCE, OPTIONAL_TYPE>
    stringDecimal: StringDecimalValueSource<SOURCE, OPTIONAL_TYPE>
    localDate: LocalDateValueSource<SOURCE, OPTIONAL_TYPE>
    localTime: LocalTimeValueSource<SOURCE, OPTIONAL_TYPE>
    localDateTime: LocalDateTimeValueSource<SOURCE, OPTIONAL_TYPE>
}

/** What a position that takes a value of each built-in data type accepts */
export interface BuiltInDataTypeInputs</*in|out*/ SOURCE extends NSource, /*in|out*/ OPTIONAL_TYPE extends OptionalType> {
    boolean: IBooleanValueSource<SOURCE, OPTIONAL_TYPE>
    int: INumberValueSource<SOURCE, OPTIONAL_TYPE>
    bigint: IBigintValueSource<SOURCE, OPTIONAL_TYPE>
    double: INumberValueSource<SOURCE, OPTIONAL_TYPE>
    string: IStringValueSource<SOURCE, OPTIONAL_TYPE>
    uuid: IUuidValueSource<SOURCE, OPTIONAL_TYPE>
    stringDecimal: IStringDecimalValueSource<SOURCE, OPTIONAL_TYPE>
    localDate: ILocalDateValueSource<SOURCE, OPTIONAL_TYPE>
    localTime: ILocalTimeValueSource<SOURCE, OPTIONAL_TYPE>
    localDateTime: ILocalDateTimeValueSource<SOURCE, OPTIONAL_TYPE>
}

/** The fragment expression of each built-in data type */
export interface BuiltInDataTypeFragments</*in|out*/ NO_SOURCE extends NSource, /*in|out*/ OPTIONAL_TYPE extends OptionalType, /*in|out*/ EXTRA_SOURCE extends NSource = never> {
    boolean: BooleanFragmentExpression<NO_SOURCE, OPTIONAL_TYPE, EXTRA_SOURCE>
    int: NumberFragmentExpression<NO_SOURCE, OPTIONAL_TYPE, EXTRA_SOURCE>
    bigint: BigintFragmentExpression<NO_SOURCE, OPTIONAL_TYPE, EXTRA_SOURCE>
    double: NumberFragmentExpression<NO_SOURCE, OPTIONAL_TYPE, EXTRA_SOURCE>
    string: StringFragmentExpression<NO_SOURCE, OPTIONAL_TYPE, EXTRA_SOURCE>
    uuid: UuidFragmentExpression<NO_SOURCE, OPTIONAL_TYPE, EXTRA_SOURCE>
    stringDecimal: StringDecimalFragmentExpression<NO_SOURCE, OPTIONAL_TYPE, EXTRA_SOURCE>
    localDate: LocalDateFragmentExpression<NO_SOURCE, OPTIONAL_TYPE, EXTRA_SOURCE>
    localTime: LocalTimeFragmentExpression<NO_SOURCE, OPTIONAL_TYPE, EXTRA_SOURCE>
    localDateTime: LocalDateTimeFragmentExpression<NO_SOURCE, OPTIONAL_TYPE, EXTRA_SOURCE>
}
