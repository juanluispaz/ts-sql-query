import type { DataToProjectOf, DataToProjectOfAny, GetDataToProjectSource } from '../complexProjections/dataToProject.js'
import type { UsableKeyOf } from '../utils/objectUtils.js'
import type { AnyValueSource, TypedValueSource } from '../typeSystem/valueSource.js'
import type { AggregatedArrayType } from '../typeSystem/aggregatedArrays.js'
import type { ILogicalValueSource, IValueSource, ValueSource } from '../typeSystem/base.js'
import type { BooleanType } from '../typeSystem/booleans.js'
import type { CustomComparableType } from '../typeSystem/comparable.js'
import type { CustomEqualableType } from '../typeSystem/customEqualable.js'
import type { EnumType } from '../typeSystem/enum.js'
import type { CustomLocalDateTimeType, CustomLocalDateType, CustomLocalTimeType, LocalDateTimeType, LocalDateType, LocalTimeType } from '../typeSystem/localDates.js'
import type { BigintType, CustomBigintType, CustomDoubleType, CustomIntType, NumberType } from '../typeSystem/number.js'
import type { CustomDecimalType, StringDecimalType } from '../typeSystem/decimal.js'
import type { StringType } from '../typeSystem/strings.js'
import type { CustomUuidType, UuidType } from '../typeSystem/uuids.js'

export interface Filter {
}

export interface NullableFilter extends Filter {
    isNull?: boolean
    isNotNull?: boolean
}

export interface EqualableFilter<TYPE> extends NullableFilter {
    equalsIfValue?: TYPE | null | undefined
    equals?: TYPE
    notEqualsIfValue?: TYPE | null | undefined
    notEquals?: TYPE
    isIfValue?: TYPE | null | undefined
    is?: TYPE | null | undefined
    isNotIfValue?: TYPE | null | undefined
    isNot?: TYPE | null | undefined
    inIfValue?: TYPE[] | null | undefined
    in?: TYPE[]
    notInIfValue?: TYPE[] | null | undefined
    notIn?: TYPE[]
}

export interface ComparableFilter<TYPE> extends EqualableFilter<TYPE> {
    lessThanIfValue?: TYPE | null | undefined
    lessThan?: TYPE
    greaterThanIfValue?: TYPE | null | undefined
    greaterThan?: TYPE
    lessOrEqualIfValue?: TYPE | null | undefined
    lessOrEqual?: TYPE
    greaterOrEqualIfValue?: TYPE | null | undefined
    greaterOrEqual?: TYPE
}

export interface BooleanFilter extends EqualableFilter<boolean> { }
export interface NumberFilter extends ComparableFilter<number> { }
export interface BigintFilter extends ComparableFilter<bigint> { }
export interface CustomIntFilter<TYPE> extends ComparableFilter<TYPE> { }
export interface CustomBigintFilter<TYPE> extends ComparableFilter<TYPE> { }
export interface CustomDoubleFilter<TYPE> extends ComparableFilter<TYPE> { }
export interface StringDecimalFilter extends ComparableFilter<string> { }
export interface CustomDecimalFilter<TYPE> extends ComparableFilter<TYPE> { }
export interface StringFilter extends ComparableFilter<string> {
    equalsInsensitiveIfValue?: string | null | undefined
    equalsInsensitive?: string
    notEqualsInsensitiveIfValue?: string | null | undefined
    notEqualsInsensitive?: string
    likeIfValue?: string | null | undefined
    like?: string
    notLikeIfValue?: string | null | undefined
    notLike?: string
    likeInsensitiveIfValue?: string | null | undefined
    likeInsensitive?: string
    notLikeInsensitiveIfValue?: string | null | undefined
    notLikeInsensitive?: string
    startsWithIfValue?: string | null | undefined
    startsWith?: string
    notStartsWithIfValue?: string | null | undefined
    notStartsWith?: string
    endsWithIfValue?: string | null | undefined
    endsWith?: string
    notEndsWithIfValue?: string | null | undefined
    notEndsWith?: string
    startsWithInsensitiveIfValue?: string | null | undefined
    startsWithInsensitive?: string
    notStartsWithInsensitiveIfValue?: string | null | undefined
    notStartsWithInsensitive?: string
    endsWithInsensitiveIfValue?: string | null | undefined
    endsWithInsensitive?: string
    notEndsWithInsensitiveIfValue?: string | null | undefined
    notEndsWithInsensitive?: string
    containsIfValue?: string | null | undefined
    contains?: string
    notContainsIfValue?: string | null | undefined
    notContains?: string
    containsInsensitiveIfValue?: string | null | undefined
    containsInsensitive?: string
    notContainsInsensitiveIfValue?: string | null | undefined
    notContainsInsensitive?: string
}
export interface DateFilter extends ComparableFilter<Date> { }
export interface TimeFilter extends ComparableFilter<Date> { }
export interface DateTimeFilter extends ComparableFilter<Date> { }
export interface CustomLocalDateFilter<TYPE> extends ComparableFilter<TYPE> { }
export interface CustomLocalTimeFilter<TYPE> extends ComparableFilter<TYPE> { }
export interface CustomLocalDateTimeFilter<TYPE> extends ComparableFilter<TYPE> { }

export interface CustomUuidFilter<TYPE> extends ComparableFilter<TYPE> {
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

export type FilterTypeOf<TYPE> = 
    TYPE extends 'boolean' ? BooleanFilter :
    TYPE extends 'int' ? NumberFilter :
    TYPE extends 'bigint' ? BigintFilter :
    TYPE extends 'double' ? NumberFilter :
    TYPE extends 'string' ? StringFilter :
    TYPE extends 'uuid' ? StringFilter :
    TYPE extends 'stringDecimal' ? StringDecimalFilter :
    TYPE extends 'localDate' ? DateFilter :
    TYPE extends 'localTime' ? TimeFilter :
    TYPE extends 'localDateTime' ? DateTimeFilter :
    TYPE extends ['customInt', infer T] ? CustomIntFilter<T> :
    TYPE extends ['customBigint', infer T] ? CustomBigintFilter<T> :
    TYPE extends ['customDouble', infer T] ? CustomDoubleFilter<T> :
    TYPE extends ['customDecimal', infer T] ? CustomDecimalFilter<T> :
    TYPE extends ['customUuid', infer T] ? CustomUuidFilter<T> :
    TYPE extends ['customLocalDate', infer T] ? CustomLocalDateFilter<T> :
    TYPE extends ['customLocalTime', infer T] ? CustomLocalTimeFilter<T> :
    TYPE extends ['customLocalDateTime', infer T] ? CustomLocalDateTimeFilter<T> :
    TYPE extends ['enum', infer T] ? EqualableFilter<T> :
    TYPE extends ['custom', infer T] ? EqualableFilter<T> :
    TYPE extends ['customComparable', infer T] ? ComparableFilter<T> :
    MapValueSourceToFilter<TYPE>

export type DynamicColumnType<T> = 'boolean' | 'int' | 'bigint' | 'double' |
    'string' | 'uuid' | 'stringDecimal' | 'localDate' | 'localTime' | 'localDateTime' | 
    ['customInt', T] | ['customBigint', T] | ['customDouble', T] | ['customDecimal', T] | ['customUuid', T] | ['customLocalDate', T] | ['customLocalTime', T] | ['customLocalDateTime', T] | 
    ['enum', T] | ['custom', T] | ['customComparable', T]

// The definition of a dynamic condition: up to 5 levels, as a complex projection; the last level only has columns
export type DynamicDefinition = {
    [key: string]: AnyValueSource | DynamicColumnType<any> | DynamicDefinition2
}
type DynamicDefinition2 = {
    [key: string]: AnyValueSource | DynamicColumnType<any> | DynamicDefinition3
}
type DynamicDefinition3 = {
    [key: string]: AnyValueSource | DynamicColumnType<any> | DynamicDefinition4
}
type DynamicDefinition4 = {
    [key: string]: AnyValueSource | DynamicColumnType<any> | DynamicDefinition5
}
type DynamicDefinition5 = {
    [key: string]: AnyValueSource | DynamicColumnType<any>
}

export type DynamicCondition<DEFINITION extends DynamicDefinition, EXTENSION extends DynamicConditionExtension = never> = {
    not?: DynamicCondition<DEFINITION, EXTENSION>
    and?: Array<DynamicCondition<DEFINITION, EXTENSION> | undefined>
    or?: Array<DynamicCondition<DEFINITION, EXTENSION> | undefined>
} & {
    [KEY in NonReplacedField<DEFINITION, EXTENSION>]?:
        DEFINITION[KEY] extends DynamicColumnType<any>
        ? ColumnFilterWithExtension<FilterTypeOf<DEFINITION[KEY]>, EXTENSION> : DEFINITION[KEY] extends AnyValueSource
        ? ColumnFilterWithExtension<FilterTypeOf<DEFINITION[KEY]>, EXTENSION> : DEFINITION[KEY] extends DynamicDefinition
        ? DynamicCondition<DEFINITION[KEY], KEY extends keyof EXTENSION ? (EXTENSION[KEY] extends DynamicConditionExtension ? EXTENSION[KEY] : never) : never>
        : never
} & {
    [KEY in DynamicConditionExtensionKeys<EXTENSION>]?: EXTENSION[KEY] extends DynamicConditionRule<infer TYPE> ? TYPE : never
}

export type MapValueSourceToFilter<TYPE> =
    TYPE extends TypedValueSource<any, infer T, any> ? (
        TYPE extends IValueSource<any, BooleanType, any> ? BooleanFilter :
        TYPE extends IValueSource<any, BigintType, any> ? BigintFilter :
        TYPE extends IValueSource<any, NumberType, any> ? NumberFilter :
        TYPE extends IValueSource<any, StringType, any> ? StringFilter :
        TYPE extends IValueSource<any, UuidType, any> ? StringFilter :
        TYPE extends IValueSource<any, StringDecimalType, any> ? StringDecimalFilter :
        TYPE extends IValueSource<any, LocalDateTimeType, any> ? DateTimeFilter :
        TYPE extends IValueSource<any, LocalDateType, any> ? DateFilter :
        TYPE extends IValueSource<any, LocalTimeType, any> ? TimeFilter :
        TYPE extends IValueSource<any, CustomIntType<any, any>, any> ? CustomIntFilter<T> :
        TYPE extends IValueSource<any, CustomBigintType<any, any>, any> ? CustomBigintFilter<T> :
        TYPE extends IValueSource<any, CustomDoubleType<any, any>, any> ? CustomDoubleFilter<T> :
        TYPE extends IValueSource<any, CustomDecimalType<any, any>, any> ? CustomDecimalFilter<T> :
        TYPE extends IValueSource<any, CustomUuidType<any, any>, any> ? CustomUuidFilter<T> :
        TYPE extends IValueSource<any, CustomLocalDateType<any, any>, any> ? CustomLocalDateFilter<T> :
        TYPE extends IValueSource<any, CustomLocalTimeType<any, any>, any> ? CustomLocalTimeFilter<T> :
        TYPE extends IValueSource<any, CustomLocalDateTimeType<any, any>, any> ? CustomLocalDateTimeFilter<T> :
        TYPE extends IValueSource<any, CustomComparableType<any, any>, any> ? ComparableFilter<T> :
        TYPE extends IValueSource<any, EnumType<any, any>, any> ? EqualableFilter<T> :
        TYPE extends IValueSource<any, CustomEqualableType<any, any>, any> ? EqualableFilter<T> :
        TYPE extends IValueSource<any, AggregatedArrayType<any>, any>  ? Filter | Array<Filter> : // Keep here to make easy deal with aggreagted arrays
        Filter
    ) : never

export type Filterable = DataToProjectOfAny

export type DynamicConditionExtension = DataToProjectOf<DynamicConditionRule<any>>
export type DynamicConditionRule<T> = (rule: T) => ILogicalValueSource<any, any>

type NonReplacedField<DEFINITION, EXTENSION> = Exclude<UsableKeyOf<DEFINITION>, DynamicConditionExtensionKeys<EXTENSION>> 
type DynamicConditionExtensionKeys<EXTENSION> = {[K in keyof EXTENSION]: EXTENSION[K] extends DynamicConditionRule<any> ? K : never }[keyof EXTENSION]

// The extension rules as usable inside a column's filter. The runtime forwards
// the *whole* extension to every value-source column (see
// `DynamicConditionBuilder.processColumnFilter` /
// `processAdditionalColumnFilter`), so any extension key can be applied under
// any column: a function rule maps to its argument type, and a nested object of
// rules recurses to the same shape (to any depth).
type DynamicConditionColumnExtension<EXTENSION> = {
    [KEY in keyof EXTENSION]?:
        EXTENSION[KEY] extends DynamicConditionRule<infer TYPE> ? TYPE
        : EXTENSION[KEY] extends DynamicConditionExtension ? DynamicConditionColumnExtension<EXTENSION[KEY]>
        : never
}

// A column filter (its built-in operators) widened with the column-scoped
// extension rules. An extension key shadows a same-named built-in operator,
// mirroring the runtime which checks the extension before the operators. With
// no extension (`never`) the column keeps exactly its built-in operators.
type ColumnFilterWithExtension<COLUMN_FILTER, EXTENSION> =
    [EXTENSION] extends [never] ? COLUMN_FILTER
    : Omit<COLUMN_FILTER, keyof EXTENSION> & DynamicConditionColumnExtension<EXTENSION>

// RESCURSIVE type
export type DynamicFilter<DEFINITION extends Filterable, EXTENSION extends DynamicConditionExtension = never> = {
    not?: DynamicFilter<DEFINITION, EXTENSION>
    and?: Array<DynamicFilter<DEFINITION, EXTENSION> | undefined>
    or?: Array<DynamicFilter<DEFINITION, EXTENSION> | undefined>
} & {
    [KEY in NonReplacedField<DEFINITION, EXTENSION>]?:
        DEFINITION[KEY] extends AnyValueSource
        ? ColumnFilterWithExtension<MapValueSourceToFilter<DEFINITION[KEY]>, EXTENSION> : DEFINITION[KEY] extends Filterable
        ? DynamicFilter<DEFINITION[KEY], KEY extends keyof EXTENSION ? (EXTENSION[KEY] extends DynamicConditionExtension ? EXTENSION[KEY] : never) : never>
        : never
} & ([EXTENSION] extends [never] ? unknown : {
    [KEY in DynamicConditionExtensionKeys<EXTENSION>]?: EXTENSION[KEY] extends DynamicConditionRule<infer TYPE> ? TYPE : never
})

export interface DynamicConditionExpression<DEFINITION extends Filterable, EXTENSION extends DynamicConditionExtension> {
    // It is optional because some members can be optionals, another strategy will be look inside the object looking for 
    // any optional, but is provides low value
    withValues(filter: DynamicFilter<DEFINITION, EXTENSION>): ValueSource<SourceOf<DEFINITION> | SourceOf<EXTENSION>, BooleanType, 'optional'>
}

type SourceOf<TYPE> = [TYPE] extends [never] ? never : GetDataToProjectSource<TYPE>
