import type { NSource } from '../utils/sourceName.js'
import type { typeName } from '../utils/symbols.js'
import type { OptionalType, TypedValueSource } from '../typeSystem/valueSource.js'
import type { AnyType, IConditionValueSource, ILogicalValueSource, IValueSource as ITypeValueSource, ValueSource as TypeValueSource } from '../typeSystem/base.js'
import type { AlwaysIfValueSource as TypeAlwaysIfValueSource, BooleanType, IfValueSource as TypeIfValueSource } from '../typeSystem/booleans.js'
import type { BigintType, CustomBigintType, CustomDecimalType, CustomDoubleType, CustomIntType, NumberType, StringDecimalType } from '../typeSystem/numbers.js'
import type { StringType } from '../typeSystem/strings.js'
import type { CustomUuidType, UuidType } from '../typeSystem/uuids.js'
import type { CustomLocalDateTimeType, CustomLocalDateType, CustomLocalTimeType, LocalDateTimeType, LocalDateType, LocalTimeType } from '../typeSystem/localDates.js'
import type { CustomEqualableType, EnumType } from '../typeSystem/equalable.js'
import type { CustomComparableType } from '../typeSystem/comparable.js'
import type { AggregatedArrayProjectableAsNullableType, AggregatedArrayType } from '../typeSystem/aggregatedArrays.js'

/*
 * The names of the value sources of each data type, over the type system of src/typeSystem/: a value source is its
 * data type plus its source and its optionality, and what a position accepts (the I... names) is the NType of an operand
 * of the data type.
 */

export type { RemapValueSourceType, RemapValueSourceTypeWithOptionalType, RemapIValueSourceType, RemapIValueSourceTypeWithOptionalType } from '../typeSystem/base.js'
export { asAlwaysIfValueSource } from '../typeSystem/booleans.js'
export { Argument } from '../typeSystem/arguments.js'
export type { ArgumentOptionalType, ArgumentMode, TypeOfArgument, MapArgumentToValueSource, MapArgumentToIValueSource, MapArgumentToIValueSourceAsAnyOptionalType, ArgForFn, ArgBaseTypeForFn, RequiredArgumentWhenValueMode, ArgForBuilderIfValue, RemapValueSourceTypeIfValue } from '../typeSystem/arguments.js'

/** A value source of any data type, with the type of its value and its type name */
export interface IValueSource</*in|out*/ SOURCE extends NSource, /*in|out*/ TYPE, /*in|out*/ TYPE_NAME extends string, /*in|out*/ OPTIONAL_TYPE extends OptionalType> extends TypedValueSource<SOURCE, TYPE, OPTIONAL_TYPE> {
    [typeName]: TYPE_NAME
}

/** A value source of any data type, with the methods every value source has */
export interface ValueSource</*in|out*/ SOURCE extends NSource, /*in|out*/ TYPE, /*in|out*/ TYPE_NAME extends string, /*in|out*/ OPTIONAL_TYPE extends OptionalType> extends IValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE> {
    isConstValue(): boolean
    getConstValue(): TYPE
    allowWhen(when: boolean, errorMessage: string): this
    allowWhen(when: boolean, error: Error): this
    disallowWhen(when: boolean, errorMessage: string): this
    disallowWhen(when: boolean, error: Error): this
}

// The logical data types
export type IAnyBooleanValueSource<SOURCE extends NSource, OPTIONAL_TYPE extends OptionalType> = ILogicalValueSource<SOURCE, OPTIONAL_TYPE>
export type IIfValueSource<SOURCE extends NSource, OPTIONAL_TYPE extends OptionalType> = IConditionValueSource<SOURCE, OPTIONAL_TYPE>
export type IBooleanValueSource<SOURCE extends NSource, OPTIONAL_TYPE extends OptionalType> = ITypeValueSource<SOURCE, BooleanType, OPTIONAL_TYPE>
export type BooleanValueSource<SOURCE extends NSource, OPTIONAL_TYPE extends OptionalType> = TypeValueSource<SOURCE, BooleanType, OPTIONAL_TYPE>
export type IfValueSource<SOURCE extends NSource, OPTIONAL_TYPE extends OptionalType> = TypeIfValueSource<SOURCE, OPTIONAL_TYPE>
export type AlwaysIfValueSource<SOURCE extends NSource, OPTIONAL_TYPE extends OptionalType> = TypeAlwaysIfValueSource<SOURCE, OPTIONAL_TYPE>

// The numbers
export type INumberValueSource<SOURCE extends NSource, OPTIONAL_TYPE extends OptionalType> = ITypeValueSource<SOURCE, NumberType, OPTIONAL_TYPE>
export type NumberValueSource<SOURCE extends NSource, OPTIONAL_TYPE extends OptionalType> = TypeValueSource<SOURCE, NumberType, OPTIONAL_TYPE>
export type IBigintValueSource<SOURCE extends NSource, OPTIONAL_TYPE extends OptionalType> = ITypeValueSource<SOURCE, BigintType, OPTIONAL_TYPE>
export type BigintValueSource<SOURCE extends NSource, OPTIONAL_TYPE extends OptionalType> = TypeValueSource<SOURCE, BigintType, OPTIONAL_TYPE>
export type IStringDecimalValueSource<SOURCE extends NSource, OPTIONAL_TYPE extends OptionalType> = ITypeValueSource<SOURCE, StringDecimalType, OPTIONAL_TYPE>
export type StringDecimalValueSource<SOURCE extends NSource, OPTIONAL_TYPE extends OptionalType> = TypeValueSource<SOURCE, StringDecimalType, OPTIONAL_TYPE>
export type ICustomIntValueSource<SOURCE extends NSource, TYPE, TYPE_NAME extends string, OPTIONAL_TYPE extends OptionalType> = ITypeValueSource<SOURCE, CustomIntType<TYPE, TYPE_NAME>, OPTIONAL_TYPE>
export type CustomIntValueSource<SOURCE extends NSource, TYPE, TYPE_NAME extends string, OPTIONAL_TYPE extends OptionalType> = TypeValueSource<SOURCE, CustomIntType<TYPE, TYPE_NAME>, OPTIONAL_TYPE>
export type ICustomBigintValueSource<SOURCE extends NSource, TYPE, TYPE_NAME extends string, OPTIONAL_TYPE extends OptionalType> = ITypeValueSource<SOURCE, CustomBigintType<TYPE, TYPE_NAME>, OPTIONAL_TYPE>
export type CustomBigintValueSource<SOURCE extends NSource, TYPE, TYPE_NAME extends string, OPTIONAL_TYPE extends OptionalType> = TypeValueSource<SOURCE, CustomBigintType<TYPE, TYPE_NAME>, OPTIONAL_TYPE>
export type ICustomDoubleValueSource<SOURCE extends NSource, TYPE, TYPE_NAME extends string, OPTIONAL_TYPE extends OptionalType> = ITypeValueSource<SOURCE, CustomDoubleType<TYPE, TYPE_NAME>, OPTIONAL_TYPE>
export type CustomDoubleValueSource<SOURCE extends NSource, TYPE, TYPE_NAME extends string, OPTIONAL_TYPE extends OptionalType> = TypeValueSource<SOURCE, CustomDoubleType<TYPE, TYPE_NAME>, OPTIONAL_TYPE>
export type ICustomDecimalValueSource<SOURCE extends NSource, TYPE, TYPE_NAME extends string, OPTIONAL_TYPE extends OptionalType> = ITypeValueSource<SOURCE, CustomDecimalType<TYPE, TYPE_NAME>, OPTIONAL_TYPE>
export type CustomDecimalValueSource<SOURCE extends NSource, TYPE, TYPE_NAME extends string, OPTIONAL_TYPE extends OptionalType> = TypeValueSource<SOURCE, CustomDecimalType<TYPE, TYPE_NAME>, OPTIONAL_TYPE>

// The texts and the uuids
export type IStringValueSource<SOURCE extends NSource, OPTIONAL_TYPE extends OptionalType> = ITypeValueSource<SOURCE, StringType, OPTIONAL_TYPE>
export type StringValueSource<SOURCE extends NSource, OPTIONAL_TYPE extends OptionalType> = TypeValueSource<SOURCE, StringType, OPTIONAL_TYPE>
export type IUuidValueSource<SOURCE extends NSource, OPTIONAL_TYPE extends OptionalType> = ITypeValueSource<SOURCE, UuidType, OPTIONAL_TYPE>
export type UuidValueSource<SOURCE extends NSource, OPTIONAL_TYPE extends OptionalType> = TypeValueSource<SOURCE, UuidType, OPTIONAL_TYPE>
export type ICustomUuidValueSource<SOURCE extends NSource, TYPE, TYPE_NAME extends string, OPTIONAL_TYPE extends OptionalType> = ITypeValueSource<SOURCE, CustomUuidType<TYPE, TYPE_NAME>, OPTIONAL_TYPE>
export type CustomUuidValueSource<SOURCE extends NSource, TYPE, TYPE_NAME extends string, OPTIONAL_TYPE extends OptionalType> = TypeValueSource<SOURCE, CustomUuidType<TYPE, TYPE_NAME>, OPTIONAL_TYPE>

// The dates and times without a zone
export type ILocalDateValueSource<SOURCE extends NSource, OPTIONAL_TYPE extends OptionalType> = ITypeValueSource<SOURCE, LocalDateType, OPTIONAL_TYPE>
export type LocalDateValueSource<SOURCE extends NSource, OPTIONAL_TYPE extends OptionalType> = TypeValueSource<SOURCE, LocalDateType, OPTIONAL_TYPE>
export type ILocalTimeValueSource<SOURCE extends NSource, OPTIONAL_TYPE extends OptionalType> = ITypeValueSource<SOURCE, LocalTimeType, OPTIONAL_TYPE>
export type LocalTimeValueSource<SOURCE extends NSource, OPTIONAL_TYPE extends OptionalType> = TypeValueSource<SOURCE, LocalTimeType, OPTIONAL_TYPE>
export type ILocalDateTimeValueSource<SOURCE extends NSource, OPTIONAL_TYPE extends OptionalType> = ITypeValueSource<SOURCE, LocalDateTimeType, OPTIONAL_TYPE>
export type LocalDateTimeValueSource<SOURCE extends NSource, OPTIONAL_TYPE extends OptionalType> = TypeValueSource<SOURCE, LocalDateTimeType, OPTIONAL_TYPE>
export type ICustomLocalDateValueSource<SOURCE extends NSource, TYPE, TYPE_NAME extends string, OPTIONAL_TYPE extends OptionalType> = ITypeValueSource<SOURCE, CustomLocalDateType<TYPE, TYPE_NAME>, OPTIONAL_TYPE>
export type CustomLocalDateValueSource<SOURCE extends NSource, TYPE, TYPE_NAME extends string, OPTIONAL_TYPE extends OptionalType> = TypeValueSource<SOURCE, CustomLocalDateType<TYPE, TYPE_NAME>, OPTIONAL_TYPE>
export type ICustomLocalTimeValueSource<SOURCE extends NSource, TYPE, TYPE_NAME extends string, OPTIONAL_TYPE extends OptionalType> = ITypeValueSource<SOURCE, CustomLocalTimeType<TYPE, TYPE_NAME>, OPTIONAL_TYPE>
export type CustomLocalTimeValueSource<SOURCE extends NSource, TYPE, TYPE_NAME extends string, OPTIONAL_TYPE extends OptionalType> = TypeValueSource<SOURCE, CustomLocalTimeType<TYPE, TYPE_NAME>, OPTIONAL_TYPE>
export type ICustomLocalDateTimeValueSource<SOURCE extends NSource, TYPE, TYPE_NAME extends string, OPTIONAL_TYPE extends OptionalType> = ITypeValueSource<SOURCE, CustomLocalDateTimeType<TYPE, TYPE_NAME>, OPTIONAL_TYPE>
export type CustomLocalDateTimeValueSource<SOURCE extends NSource, TYPE, TYPE_NAME extends string, OPTIONAL_TYPE extends OptionalType> = TypeValueSource<SOURCE, CustomLocalDateTimeType<TYPE, TYPE_NAME>, OPTIONAL_TYPE>

// The enumerations and the other types of the user
export type IEnumValueSource<SOURCE extends NSource, TYPE, TYPE_NAME extends string, OPTIONAL_TYPE extends OptionalType> = ITypeValueSource<SOURCE, EnumType<TYPE, TYPE_NAME>, OPTIONAL_TYPE>
export type EnumValueSource<SOURCE extends NSource, TYPE, TYPE_NAME extends string, OPTIONAL_TYPE extends OptionalType> = TypeValueSource<SOURCE, EnumType<TYPE, TYPE_NAME>, OPTIONAL_TYPE>
export type IEqualableValueSource<SOURCE extends NSource, TYPE, TYPE_NAME extends string, OPTIONAL_TYPE extends OptionalType> = ITypeValueSource<SOURCE, CustomEqualableType<TYPE, TYPE_NAME>, OPTIONAL_TYPE>
export type EqualableValueSource<SOURCE extends NSource, TYPE, TYPE_NAME extends string, OPTIONAL_TYPE extends OptionalType> = TypeValueSource<SOURCE, CustomEqualableType<TYPE, TYPE_NAME>, OPTIONAL_TYPE>
export type IComparableValueSource<SOURCE extends NSource, TYPE, TYPE_NAME extends string, OPTIONAL_TYPE extends OptionalType> = ITypeValueSource<SOURCE, CustomComparableType<TYPE, TYPE_NAME>, OPTIONAL_TYPE>
export type ComparableValueSource<SOURCE extends NSource, TYPE, TYPE_NAME extends string, OPTIONAL_TYPE extends OptionalType> = TypeValueSource<SOURCE, CustomComparableType<TYPE, TYPE_NAME>, OPTIONAL_TYPE>

// The aggregated arrays
export type IAggregatedArrayValueSource<SOURCE extends NSource, TYPE, OPTIONAL_TYPE extends OptionalType> = ITypeValueSource<SOURCE, AggregatedArrayType<TYPE>, OPTIONAL_TYPE>
export type AggregatedArrayValueSource<SOURCE extends NSource, TYPE, OPTIONAL_TYPE extends OptionalType> = TypeValueSource<SOURCE, AggregatedArrayType<TYPE>, OPTIONAL_TYPE>
export type AggregatedArrayValueSourceProjectableAsNullable<SOURCE extends NSource, TYPE, STRICT_TYPE, OPTIONAL_TYPE extends OptionalType> = TypeValueSource<SOURCE, AggregatedArrayProjectableAsNullableType<TYPE, STRICT_TYPE>, OPTIONAL_TYPE>

/** A value source of the data type given */
export type ValueSourceOfDataType<SOURCE extends NSource, TYPE extends AnyType, OPTIONAL_TYPE extends OptionalType> = TypeValueSource<SOURCE, TYPE, OPTIONAL_TYPE>
