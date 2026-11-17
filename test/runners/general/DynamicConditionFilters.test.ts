// The filter a dynamic condition gives to each data type is derived from the operations its class exposes (FilterOf):
// it is the same filter the library wrote by hand for each data type before, written out here, except for the three
// corrections at the end. The names of version 1 (NumberFilter, ...) are those same filters.

import { describe, expect, test } from '../../lib/testRunner.js'
import { assertType, type Exact } from '../../lib/assertType.js'
import { IntegersType, exposeFilterOperations, filterOperation } from '../../../src/exports/v2/index.js'
import type { AnyValueSource, TypedValueSource } from '../../../src/typeSystem/valueSource.js'
import type { AnyType, IValueSource, ValueSource } from '../../../src/typeSystem/base.js'
import type { AggregatedArrayType } from '../../../src/typeSystem/aggregatedArrays.js'
import type { AlwaysIfType, BooleanConditionType, BooleanType, ConditionType, IfType } from '../../../src/typeSystem/logical.js'
import type { LocalDateTimeType, LocalDateType, LocalTimeType, LocalDatesType, LocalDateTimesType, LocalTimesType } from '../../../src/typeSystem/localDates.js'
import type { DoubleType, IntType, NumberType } from '../../../src/typeSystem/number.js'
import type { BigintType } from '../../../src/typeSystem/bigint.js'
import type { DecimalsType, StringDecimalType } from '../../../src/typeSystem/decimals.js'
import type { RealsType } from '../../../src/typeSystem/numeric.js'
import type { StringsType, StringType } from '../../../src/typeSystem/strings.js'
import type { UuidType, UuidsType } from '../../../src/typeSystem/uuids.js'
import type { ComparableType } from '../../../src/typeSystem/comparable.js'
import type { EqualableType } from '../../../src/typeSystem/equalable.js'
import type { EnumType } from '../../../src/typeSystem/enum.js'
import type { valueSourceType } from '../../../src/utils/symbols.js'
import type { DataTypeName, DataTypeOfName } from '../../../src/typeSystem/dataTypeNames.js'
import type { FilterOf, FilterTypeOf, MapValueSourceToFilter } from '../../../src/expressions/dynamicConditionUsingFilters.js'
import type {
    BigintFilter, BooleanFilter, ComparableFilter, DateFilter, DateTimeFilter, EqualableFilter, Filter, NullableFilter,
    NumberFilter, StringFilter, TimeFilter,
} from '../../../src/exports/v1/expressions/dynamicConditionUsingFilters.js'

// ---- The filters as they were written by hand before they were derived ----------------------------------------------

interface ExpectedNullableFilter extends Filter {
    isNull?: boolean
    isNotNull?: boolean
}
interface ExpectedEqualableFilter<TYPE> extends ExpectedNullableFilter {
    equalsIfValue?: TYPE | null | undefined
    equals?: TYPE
    notEqualsIfValue?: TYPE | null | undefined
    notEquals?: TYPE
    isIfValue?: TYPE | null | undefined
    is?: TYPE | null | undefined
    isNotIfValue?: TYPE | null | undefined
    isNot?: TYPE | null | undefined
    inIfValue?: readonly TYPE[] | null | undefined
    in?: readonly TYPE[]
    notInIfValue?: readonly TYPE[] | null | undefined
    notIn?: readonly TYPE[]
}
interface ExpectedComparableFilter<TYPE> extends ExpectedEqualableFilter<TYPE> {
    lessThanIfValue?: TYPE | null | undefined
    lessThan?: TYPE
    greaterThanIfValue?: TYPE | null | undefined
    greaterThan?: TYPE
    lessOrEqualIfValue?: TYPE | null | undefined
    lessOrEqual?: TYPE
    greaterOrEqualIfValue?: TYPE | null | undefined
    greaterOrEqual?: TYPE
}
interface ExpectedTextFilter<TYPE> {
    equalsInsensitiveIfValue?: TYPE | null | undefined
    equalsInsensitive?: TYPE
    notEqualsInsensitiveIfValue?: TYPE | null | undefined
    notEqualsInsensitive?: TYPE
    likeIfValue?: TYPE | null | undefined
    like?: TYPE
    notLikeIfValue?: TYPE | null | undefined
    notLike?: TYPE
    likeInsensitiveIfValue?: TYPE | null | undefined
    likeInsensitive?: TYPE
    notLikeInsensitiveIfValue?: TYPE | null | undefined
    notLikeInsensitive?: TYPE
    startsWithIfValue?: TYPE | null | undefined
    startsWith?: TYPE
    notStartsWithIfValue?: TYPE | null | undefined
    notStartsWith?: TYPE
    endsWithIfValue?: TYPE | null | undefined
    endsWith?: TYPE
    notEndsWithIfValue?: TYPE | null | undefined
    notEndsWith?: TYPE
    startsWithInsensitiveIfValue?: TYPE | null | undefined
    startsWithInsensitive?: TYPE
    notStartsWithInsensitiveIfValue?: TYPE | null | undefined
    notStartsWithInsensitive?: TYPE
    endsWithInsensitiveIfValue?: TYPE | null | undefined
    endsWithInsensitive?: TYPE
    notEndsWithInsensitiveIfValue?: TYPE | null | undefined
    notEndsWithInsensitive?: TYPE
    containsIfValue?: TYPE | null | undefined
    contains?: TYPE
    notContainsIfValue?: TYPE | null | undefined
    notContains?: TYPE
    containsInsensitiveIfValue?: TYPE | null | undefined
    containsInsensitive?: TYPE
    notContainsInsensitiveIfValue?: TYPE | null | undefined
    notContainsInsensitive?: TYPE
}
interface ExpectedBooleanFilter extends ExpectedEqualableFilter<boolean> { }
interface ExpectedNumberFilter extends ExpectedComparableFilter<number> { }
interface ExpectedBigintFilter extends ExpectedComparableFilter<bigint> { }
interface ExpectedStringDecimalFilter extends ExpectedComparableFilter<string> { }
interface ExpectedStringFilter extends ExpectedComparableFilter<string>, ExpectedTextFilter<string> { }
interface ExpectedDateFilter extends ExpectedComparableFilter<Date> { }
interface ExpectedTimeFilter extends ExpectedComparableFilter<Date> { }
interface ExpectedDateTimeFilter extends ExpectedComparableFilter<Date> { }
interface ExpectedUuidsFilter<TYPE> extends ExpectedComparableFilter<TYPE>, ExpectedTextFilter<TYPE> { }

type ExpectedFilterTypeOf<TYPE> =
    TYPE extends 'boolean' ? ExpectedBooleanFilter :
    TYPE extends 'int' ? ExpectedNumberFilter :
    TYPE extends 'bigint' ? ExpectedBigintFilter :
    TYPE extends 'double' ? ExpectedNumberFilter :
    TYPE extends 'string' ? ExpectedStringFilter :
    TYPE extends 'uuid' ? ExpectedStringFilter :
    TYPE extends 'stringDecimal' ? ExpectedStringDecimalFilter :
    TYPE extends 'localDate' ? ExpectedDateFilter :
    TYPE extends 'localTime' ? ExpectedTimeFilter :
    TYPE extends 'localDateTime' ? ExpectedDateTimeFilter :
    TYPE extends DataTypeName ? ExpectedMapValueSourceToFilter<ValueSource<any, DataTypeOfName<TYPE>, 'required'>> :
    TYPE extends AnyValueSource ? ExpectedMapValueSourceToFilter<TYPE> :
    TYPE extends AnyType ? ExpectedMapValueSourceToFilter<ValueSource<any, TYPE, 'required'>> :
    never

type ExpectedMapValueSourceToFilter<TYPE> =
    TYPE extends TypedValueSource<any, infer T, any> ? (
        TYPE extends IValueSource<any, BooleanType, any> ? ExpectedBooleanFilter :
        TYPE extends IValueSource<any, BigintType, any> ? ExpectedBigintFilter :
        TYPE extends IValueSource<any, NumberType, any> ? ExpectedNumberFilter :
        TYPE extends IValueSource<any, StringType, any> ? ExpectedStringFilter :
        TYPE extends IValueSource<any, UuidType, any> ? ExpectedStringFilter :
        TYPE extends IValueSource<any, StringDecimalType, any> ? ExpectedStringDecimalFilter :
        TYPE extends IValueSource<any, LocalDateTimeType, any> ? ExpectedDateTimeFilter :
        TYPE extends IValueSource<any, LocalDateType, any> ? ExpectedDateFilter :
        TYPE extends IValueSource<any, LocalTimeType, any> ? ExpectedTimeFilter :
        TYPE extends IValueSource<any, AggregatedArrayType<any>, any>  ? Filter | Array<Filter> :
        TYPE extends { [valueSourceType]: infer DATA_TYPE } ? (
            DATA_TYPE extends UuidsType<any, any> ? ExpectedUuidsFilter<T> :
            DATA_TYPE extends ComparableType<any, any> ? ExpectedComparableFilter<T> :
            DATA_TYPE extends EqualableType<any, any> ? ExpectedEqualableFilter<T> :
            Filter
        ) : Filter
    ) : never

// ---- The checks -----------------------------------------------------------------------------------------------------

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false
type Assert<T extends true> = T
type AssertNot<T extends false> = T

type Status = 'open' | 'closed'
type Version = string & { readonly __version: true }
type Code = number & { readonly __code: true }
type Money = number & { readonly __money: true }
type Amount = string & { readonly __amount: true }
type Ratio = number & { readonly __ratio: true }
type Day = string & { readonly __day: true }
type Hour = string & { readonly __hour: true }
type Moment = string & { readonly __moment: true }
type Email = string & { readonly __email: true }
type CustomerId = string & { readonly __customerId: true }
declare abstract class StatusType extends EnumType<Status, 'Status'> { }
declare abstract class CodeType extends EqualableType<Code, 'Code'> { }
declare abstract class VersionType extends ComparableType<Version, 'Version'> { }
declare abstract class MoneyType extends IntegersType<Money, 'Money'> { }
declare abstract class AmountType extends DecimalsType<Amount, 'Amount'> { }
declare abstract class RatioType extends RealsType<Ratio, 'Ratio'> { }
declare abstract class DayType extends LocalDatesType<Day, 'Day'> { }
declare abstract class HourType extends LocalTimesType<Hour, 'Hour'> { }
declare abstract class MomentType extends LocalDateTimesType<Moment, 'Moment'> { }
declare abstract class EmailType extends StringsType<Email> { }
declare abstract class CustomerIdType extends UuidsType<CustomerId, 'CustomerId'> { }
declare abstract class CentsType extends IntType { }
declare abstract class NameType extends StringType { }

type VS<TYPE extends AnyType> = ValueSource<any, TYPE, 'required'>

type IdenticalByName = [
    Assert<Equal<FilterTypeOf<'boolean'>, ExpectedFilterTypeOf<'boolean'>>>,
    Assert<Equal<FilterTypeOf<'int'>, ExpectedFilterTypeOf<'int'>>>,
    Assert<Equal<FilterTypeOf<'bigint'>, ExpectedFilterTypeOf<'bigint'>>>,
    Assert<Equal<FilterTypeOf<'double'>, ExpectedFilterTypeOf<'double'>>>,
    Assert<Equal<FilterTypeOf<'string'>, ExpectedFilterTypeOf<'string'>>>,
    Assert<Equal<FilterTypeOf<'uuid'>, ExpectedFilterTypeOf<'uuid'>>>,
    Assert<Equal<FilterTypeOf<'stringDecimal'>, ExpectedFilterTypeOf<'stringDecimal'>>>,
    Assert<Equal<FilterTypeOf<'localDate'>, ExpectedFilterTypeOf<'localDate'>>>,
    Assert<Equal<FilterTypeOf<'localTime'>, ExpectedFilterTypeOf<'localTime'>>>,
    Assert<Equal<FilterTypeOf<'localDateTime'>, ExpectedFilterTypeOf<'localDateTime'>>>,
]

type IdenticalByValueSource = [
    Assert<Equal<MapValueSourceToFilter<VS<BooleanType>>, ExpectedMapValueSourceToFilter<VS<BooleanType>>>>,
    Assert<Equal<MapValueSourceToFilter<VS<BooleanConditionType>>, ExpectedMapValueSourceToFilter<VS<BooleanConditionType>>>>,
    Assert<Equal<MapValueSourceToFilter<VS<IntType>>, ExpectedMapValueSourceToFilter<VS<IntType>>>>,
    Assert<Equal<MapValueSourceToFilter<VS<DoubleType>>, ExpectedMapValueSourceToFilter<VS<DoubleType>>>>,
    Assert<Equal<MapValueSourceToFilter<VS<NumberType>>, ExpectedMapValueSourceToFilter<VS<NumberType>>>>,
    Assert<Equal<MapValueSourceToFilter<VS<BigintType>>, ExpectedMapValueSourceToFilter<VS<BigintType>>>>,
    Assert<Equal<MapValueSourceToFilter<VS<StringType>>, ExpectedMapValueSourceToFilter<VS<StringType>>>>,
    Assert<Equal<MapValueSourceToFilter<VS<UuidType>>, ExpectedMapValueSourceToFilter<VS<UuidType>>>>,
    Assert<Equal<MapValueSourceToFilter<VS<StringDecimalType>>, ExpectedMapValueSourceToFilter<VS<StringDecimalType>>>>,
    Assert<Equal<MapValueSourceToFilter<VS<LocalDateType>>, ExpectedMapValueSourceToFilter<VS<LocalDateType>>>>,
    Assert<Equal<MapValueSourceToFilter<VS<LocalTimeType>>, ExpectedMapValueSourceToFilter<VS<LocalTimeType>>>>,
    Assert<Equal<MapValueSourceToFilter<VS<LocalDateTimeType>>, ExpectedMapValueSourceToFilter<VS<LocalDateTimeType>>>>,
]

type IdenticalOfTheUser = [
    Assert<Equal<FilterTypeOf<StatusType>, ExpectedFilterTypeOf<StatusType>>>,
    Assert<Equal<FilterTypeOf<CodeType>, ExpectedFilterTypeOf<CodeType>>>,
    Assert<Equal<FilterTypeOf<VersionType>, ExpectedFilterTypeOf<VersionType>>>,
    Assert<Equal<FilterTypeOf<MoneyType>, ExpectedFilterTypeOf<MoneyType>>>,
    Assert<Equal<FilterTypeOf<AmountType>, ExpectedFilterTypeOf<AmountType>>>,
    Assert<Equal<FilterTypeOf<RatioType>, ExpectedFilterTypeOf<RatioType>>>,
    Assert<Equal<FilterTypeOf<DayType>, ExpectedFilterTypeOf<DayType>>>,
    Assert<Equal<FilterTypeOf<HourType>, ExpectedFilterTypeOf<HourType>>>,
    Assert<Equal<FilterTypeOf<MomentType>, ExpectedFilterTypeOf<MomentType>>>,
    Assert<Equal<FilterTypeOf<CentsType>, ExpectedFilterTypeOf<CentsType>>>,
    Assert<Equal<FilterTypeOf<NameType>, ExpectedFilterTypeOf<NameType>>>,
    Assert<Equal<MapValueSourceToFilter<VS<MoneyType>>, ExpectedMapValueSourceToFilter<VS<MoneyType>>>>,
    Assert<Equal<MapValueSourceToFilter<VS<StatusType>>, ExpectedMapValueSourceToFilter<VS<StatusType>>>>,
]

// The names of version 1, and the filters of the data types they named
type IdenticalPublicNames = [
    Assert<Equal<NullableFilter, ExpectedNullableFilter>>,
    Assert<Equal<EqualableFilter<Status>, ExpectedEqualableFilter<Status>>>,
    Assert<Equal<ComparableFilter<Version>, ExpectedComparableFilter<Version>>>,
    Assert<Equal<BooleanFilter, ExpectedBooleanFilter>>,
    Assert<Equal<NumberFilter, ExpectedNumberFilter>>,
    Assert<Equal<BigintFilter, ExpectedBigintFilter>>,
    Assert<Equal<FilterOf<StringDecimalType>, ExpectedStringDecimalFilter>>,
    Assert<Equal<StringFilter, ExpectedStringFilter>>,
    Assert<Equal<DateFilter, ExpectedDateFilter>>,
    Assert<Equal<TimeFilter, ExpectedTimeFilter>>,
    Assert<Equal<DateTimeFilter, ExpectedDateTimeFilter>>,
    Assert<Equal<FilterOf<UuidsType<string, string>>, ExpectedUuidsFilter<string>>>,
]

// The conditions: no operation exposed. Is the empty mapped type identical to Filter?
type Conditions = [
    Assert<Equal<MapValueSourceToFilter<VS<ConditionType>>, ExpectedMapValueSourceToFilter<VS<ConditionType>>>>,
    Assert<Equal<MapValueSourceToFilter<VS<IfType>>, ExpectedMapValueSourceToFilter<VS<IfType>>>>,
    Assert<Equal<MapValueSourceToFilter<VS<AlwaysIfType>>, ExpectedMapValueSourceToFilter<VS<AlwaysIfType>>>>,
]

// ---- The known differences, accepted as corrections -----------------------------------------------------------------

// 1. A uuid of the user: the text operators take a text (they apply to asString()), not the value of the uuid
interface UserUuidFilter extends ExpectedComparableFilter<CustomerId>, ExpectedTextFilter<string> { }
type UuidOfTheUser = [
    AssertNot<Equal<FilterTypeOf<CustomerIdType>, ExpectedFilterTypeOf<CustomerIdType>>>,
    Assert<Equal<FilterTypeOf<CustomerIdType>, UserUuidFilter>>,
    AssertNot<Equal<FilterOf<UuidsType<CustomerId, string>>, ExpectedUuidsFilter<CustomerId>>>,
]
// 2. An aggregated array: an empty filter, no longer `Filter | Array<Filter>`
type AggregatedArray = [
    AssertNot<Equal<MapValueSourceToFilter<VS<AggregatedArrayType<any>>>, ExpectedMapValueSourceToFilter<VS<AggregatedArrayType<any>>>>>,
    Assert<Equal<keyof MapValueSourceToFilter<VS<AggregatedArrayType<any>>>, never>>,
]
// 3. A text of the user (StringsType): also the text operators
interface UserTextFilter extends ExpectedComparableFilter<Email>, ExpectedTextFilter<string> { }
type TextOfTheUser = [
    AssertNot<Equal<FilterTypeOf<EmailType>, ExpectedFilterTypeOf<EmailType>>>,
    Assert<Equal<ExpectedFilterTypeOf<EmailType>, ExpectedComparableFilter<Email>>>,
    Assert<Equal<FilterTypeOf<EmailType>, UserTextFilter>>,
]

// What exposeFilterOperations accepts: a method that gives a condition and has no parameters or one that is required
abstract class LevelType extends IntegersType<number, 'Level'> {
    static override readonly type = 'Level'
    static override readonly [filterOperation] = exposeFilterOperations(this, IntegersType, ['isHigh', 'atLeast'])
    declare [filterOperation]: (typeof LevelType)[typeof filterOperation]
    isHigh() { return this.greaterThan(5) }
    atLeast(value: number) { return this.greaterOrEqual(value) }
    withOptional(value?: number) { return this.greaterOrEqual(value ?? 0) }
    withRest(...values: number[]) { return this.in(values) }
    withTwo(from: number, to: number) { return this.greaterOrEqual(from).and(this.lessOrEqual(to)) }
    twice() { return this.multiply(2) }
}

describe('The filters of the data types', () => {
    test('an-alias-gives-the-method-it-stands-for-and-never-hides-a-name-exposed', () => {
        const methodOf = exposeFilterOperations(LevelType, IntegersType, ['isHigh'], { high: 'isHigh', equals: 'isHigh' })
        // An alias of the class, and one of version 1 that its family keeps
        expect(Reflect.apply(methodOf, undefined, ['high'])).toBe('isHigh')
        expect(Reflect.apply(methodOf, undefined, ['smaller'])).toBe('lessThan')
        // A name the family exposes wins over an alias with that name
        expect(methodOf('equals')).toBe('equals')
        // A class that exposes a name an alias of its family has: its own method
        abstract class SmallerType extends IntegersType<number, 'Smaller'> {
            static override readonly type = 'Smaller'
            static override readonly [filterOperation] = exposeFilterOperations(this, IntegersType, ['smaller'])
            declare [filterOperation]: (typeof SmallerType)[typeof filterOperation]
            smaller() { return this.lessThan(10) }
        }
        expect(SmallerType[filterOperation]('smaller')).toBe('smaller')
        // @ts-expect-error an alias stands for a name the class or its family exposes
        exposeFilterOperations(LevelType, IntegersType, ['isHigh'], { high: 'withTwo' })
        // The aliases are not in the types of the filter
        assertType<Exact<'high' extends keyof FilterOf<LevelType> ? true : false, false>>()
    })

    test('a-data-type-exposes-only-methods-that-give-a-condition-with-no-parameters-or-one-required', () => {
        // @ts-expect-error an optional parameter: the filter couldn't tell its value from true or false
        exposeFilterOperations(LevelType, IntegersType, ['withOptional'])
        // @ts-expect-error a rest parameter
        exposeFilterOperations(LevelType, IntegersType, ['withRest'])
        // @ts-expect-error two parameters
        exposeFilterOperations(LevelType, IntegersType, ['withTwo'])
        // @ts-expect-error it doesn't give a condition
        exposeFilterOperations(LevelType, IntegersType, ['twice'])
        // @ts-expect-error not a method of the class
        exposeFilterOperations(LevelType, IntegersType, ['nope'])
        const methodOf = exposeFilterOperations(LevelType, IntegersType, ['isHigh', 'atLeast'])
        expect([methodOf('isHigh'), methodOf('atLeast'), methodOf('lessThan')]).toEqual(['isHigh', 'atLeast', 'lessThan'])
        expect(Reflect.apply(methodOf, undefined, ['twice'])).toBe(undefined)
        assertType<Exact<keyof FilterOf<LevelType>, keyof FilterOf<IntegersType<number, 'Level'>> | 'isHigh' | 'atLeast'>>()
    })

    test('each-filter-is-the-one-written-by-hand-before-except-the-three-corrections', () => {
        type Checked = [IdenticalByName, IdenticalByValueSource, IdenticalOfTheUser, IdenticalPublicNames, Conditions, UuidOfTheUser, AggregatedArray, TextOfTheUser]
        assertType<Checked extends unknown[] ? true : false>()
        expect(true).toBe(true)
    })
})
