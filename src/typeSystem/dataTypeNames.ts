import type { NSource } from '../utils/sourceName.js'
import type { OptionalType } from './valueSource.js'
import type { BooleanType } from './logical.js'
import type { DoubleType, IntType } from './number.js'
import type { BigintType } from './bigint.js'
import type { StringDecimalType } from './decimals.js'
import type { StringType } from './strings.js'
import type { UuidType } from './uuids.js'
import type { LocalDateTimeType, LocalDateType, LocalTimeType } from './localDates.js'
import type { PlainDateTimeType, PlainDateType, PlainTimeType } from './plainDates.js'
import type { DurationType } from './durations.js'
import type { InstantType } from './instants.js'
import type { ZonedDateTimeType } from './zonedDateTimes.js'
import type { AnyType, IValueSource, ValueSource, ValueTypeOf } from './base.js'
import type { FragmentExpression } from './fragments.js'

// The data types known by name: the ones of the library and the ones the user registers (registerDataType, with its
// entry in DataTypes), named by the type given to a column, a constant, a fragment or an argument, and what each one is
// in each position: its value source, what a position that takes it accepts, and its fragment expression.

/**
 * The data type of each type name a column, a constant, a fragment or an argument can be given: the built-in ones, and
 * the ones of yours you register with `registerDataType` and declare here, by the type name of their class:
 *
 * ```ts
 * declare module 'ts-sql-query' {
 *     interface DataTypes {
 *         Cents: CentsType
 *     }
 * }
 * ```
 */
export interface DataTypes {
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
    plainDate: PlainDateType
    plainTime: PlainTimeType
    plainDateTime: PlainDateTimeType
    duration: DurationType
    instant: InstantType
    zonedDateTime: ZonedDateTimeType
}

/** The name of a data type known by name: a built-in one, or one of yours declared in DataTypes */
export type DataTypeName = Extract<keyof DataTypes, string>

/** The data type of a type name */
export type DataTypeOfName<NAME extends DataTypeName> = DataTypes[NAME] extends infer TYPE extends AnyType ? TYPE : never

/** The type of the value of a type name */
export type DataTypeValueOfName<NAME extends DataTypeName> = ValueTypeOf<DataTypeOfName<NAME>>

/*
 * The maps below give, for each type name, its value source, what a position that takes it accepts and its fragment
 * expression; a method that takes a type name reads them as `DataTypeValueSources<SOURCE, OPTIONAL_TYPE>[TYPE]`. Every
 * entry is the same generic type (`ValueSource<SOURCE, DataTypeOfName<TYPE>, OPTIONAL_TYPE>`), so they look like a
 * wrapper that could be written directly, but they are not: indexing a map with a union of names (`t: 'int' | 'string'`)
 * gives the union of its entries, a union of value sources, which is what the value is at run time: one of them. A union
 * in gives a union out, by design. Written directly, the union goes inside, `ValueSource<SOURCE, IntType | StringType,
 * ...>`: one value source with the methods of both data types and a value `number | string`, which no value at run time
 * is. Keep the maps.
 */

/** The value source of each type name */
export type DataTypeValueSources</*in|out*/ SOURCE extends NSource, /*in|out*/ OPTIONAL_TYPE extends OptionalType> = {
    [TYPE in DataTypeName]: ValueSource<SOURCE, DataTypeOfName<TYPE>, OPTIONAL_TYPE>
}

/** What a position that takes a value of each type name accepts */
export type DataTypeInputs</*in|out*/ SOURCE extends NSource, /*in|out*/ OPTIONAL_TYPE extends OptionalType> = {
    [TYPE in DataTypeName]: IValueSource<SOURCE, DataTypeOfName<TYPE>, OPTIONAL_TYPE>
}

/** The fragment expression of each type name */
export type DataTypeFragments</*in|out*/ NO_SOURCE extends NSource, /*in|out*/ OPTIONAL_TYPE extends OptionalType, /*in|out*/ EXTRA_SOURCE extends NSource = never> = {
    [TYPE in DataTypeName]: FragmentExpression<NO_SOURCE, DataTypeOfName<TYPE>, OPTIONAL_TYPE, EXTRA_SOURCE>
}
