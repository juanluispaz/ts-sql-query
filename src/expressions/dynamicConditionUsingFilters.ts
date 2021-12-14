import { double, int, LocalDate, LocalDateTime, LocalTime, stringDouble, stringInt } from "ts-extended-types";
import { AnyValueSource, BooleanValueSource, IAggregatedArrayValueSource, IBigintValueSource, IBooleanValueSource, IComparableValueSource, IDateTimeValueSource, IDateValueSource, IDoubleValueSource, IEqualableValueSource, IIntValueSource, ILocalDateTimeValueSource, ILocalDateValueSource, ILocalTimeValueSource, INullableValueSource, INumberValueSource, IStringDoubleValueSource, IStringIntValueSource, IStringNumberValueSource, IStringValueSource, ITimeValueSource, ITypeSafeBigintValueSource, ITypeSafeStringValueSource, IValueSource, MergeOptionalUnion, ValueSourceOf } from "./values";

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
    lessOrEqualsIfValue?: TYPE | null | undefined
    lessOrEquals?: TYPE
    greaterOrEqualsIfValue?: TYPE | null | undefined
    greaterOrEquals?: TYPE

    /** @deprecated use lessThanIfValue instead */
    smallerIfValue?: TYPE | null | undefined
    /** @deprecated use lessThan instead */
    smaller?: TYPE
    /** @deprecated use greaterThanIfValue instead */
    largerIfValue?: TYPE | null | undefined
    /** @deprecated use greaterThan instead */
    larger?: TYPE
    /** @deprecated use lessOrEqualsIfValue instead */
    smallAsIfValue?: TYPE | null | undefined
    /** @deprecated use lessOrEquals instead */
    smallAs?: TYPE
    /** @deprecated use greaterOrEqualsIfValue instead */
    largeAsIfValue?: TYPE | null | undefined
    /** @deprecated use greaterOrEquals instead */
    largeAs?: TYPE
}

export interface BooleanFilter extends EqualableFilter<boolean> { }
export interface NumberFilter extends ComparableFilter<number> { }
export interface StringNumberFilter extends ComparableFilter<number | string> { }
export interface IntFilter extends ComparableFilter<int> { }
export interface DoubleFilter extends ComparableFilter<double> { }
export interface BigintFilter extends ComparableFilter<bigint> { }
export interface StringIntFilter extends ComparableFilter<stringInt> { }
export interface StringDoubleFilter extends ComparableFilter<stringDouble> { }
export interface StringFilter extends ComparableFilter<string> {
    equalsInsensitiveIfValue?: string | null | undefined
    equalsInsensitive?: string
    notEqualsInsensitiveIfValue?: string | null | undefined
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
export interface LocalDateFilter extends ComparableFilter<LocalDate> { }
export interface LocalTimeFilter extends ComparableFilter<LocalTime> { }
export interface LocalDateTimeFilter extends ComparableFilter<LocalDateTime> { }

export type FilterTypeOf<TYPE> = TYPE extends 'boolean' ? BooleanFilter :
    TYPE extends 'stringInt' ? StringNumberFilter :
    TYPE extends 'int' ? NumberFilter :
    TYPE extends 'bigint' ? BigintFilter :
    TYPE extends 'stringDouble' ? StringNumberFilter :
    TYPE extends 'double' ? NumberFilter :
    TYPE extends 'string' ? StringFilter :
    TYPE extends 'localDate' ? DateFilter :
    TYPE extends 'localTime' ? TimeFilter :
    TYPE extends 'localDateTime' ? DateTimeFilter :
    TYPE extends ['enum', infer T] ? EqualableFilter<T> :
    TYPE extends ['custom', infer T] ? EqualableFilter<T> :
    TYPE extends ['customComparable', infer T] ? ComparableFilter<T> :
    never

export type TypeSafeFilterTypeOf<TYPE> = TYPE extends 'boolean' ? BooleanFilter :
    TYPE extends 'stringInt' ? StringIntFilter :
    TYPE extends 'int' ? IntFilter :
    TYPE extends 'bigint' ? BigintFilter :
    TYPE extends 'stringDouble' ? StringDoubleFilter :
    TYPE extends 'double' ? DoubleFilter :
    TYPE extends 'string' ? StringFilter :
    TYPE extends 'localDate' ? LocalDateFilter :
    TYPE extends 'localTime' ? LocalTimeFilter :
    TYPE extends 'localDateTime' ? LocalDateTimeFilter :
    TYPE extends ['enum', infer T] ? EqualableFilter<T> :
    TYPE extends ['custom', infer T] ? EqualableFilter<T> :
    TYPE extends ['customComparable', infer T] ? ComparableFilter<T> :
    never

export type DynamicColumnType<T> = 'boolean' | 'stringInt' | 'int' | 'bigint' | 'stringDouble' | 'double' |
    'string' | 'localDate' | 'localTime' | 'localDateTime' | ['enum', T] | ['custom', T] | ['customComparable', T]

export type DynamicDefinition = {
    [key: string]: DynamicColumnType<any> | DynamicDefinition
}

export type DynamicCondition<DEFINITION extends DynamicDefinition> = {
    not?: DynamicCondition<DEFINITION>
    and?: Array<DynamicCondition<DEFINITION> | undefined>
    or?: Array<DynamicCondition<DEFINITION> | undefined>
} & {
    [KEY in keyof DEFINITION]?: DEFINITION[KEY] extends DynamicColumnType<any> ? FilterTypeOf<DEFINITION[KEY]> : DEFINITION[KEY] extends DynamicDefinition ? DynamicCondition<DEFINITION[KEY]> : never
}

export type TypeSafeDynamicCondition<DEFINITION extends DynamicDefinition> = {
    not?: TypeSafeDynamicCondition<DEFINITION>
    and?: Array<TypeSafeDynamicCondition<DEFINITION> | undefined>
    or?: Array<TypeSafeDynamicCondition<DEFINITION> | undefined>
} & {
    [KEY in keyof DEFINITION]?: DEFINITION[KEY] extends DynamicColumnType<any> ? TypeSafeFilterTypeOf<DEFINITION[KEY]> : DEFINITION[KEY] extends DynamicDefinition ? DynamicCondition<DEFINITION[KEY]> : never
}

export type MapValueSourceToFilter<TYPE> =
    TYPE extends IValueSource<any, infer T, any, any> ? (
        TYPE extends IBooleanValueSource<any, any> ? BooleanFilter :
        TYPE extends IStringIntValueSource<any, any> ? StringIntFilter :
        TYPE extends IIntValueSource<any, any> ? IntFilter :
        TYPE extends IStringDoubleValueSource<any, any> ? StringDoubleFilter :
        TYPE extends IDoubleValueSource<any, any> ? DoubleFilter :
        TYPE extends ITypeSafeBigintValueSource<any, any> ? BigintFilter :
        TYPE extends IBigintValueSource<any, any> ? BigintFilter :
        TYPE extends IStringNumberValueSource<any, any> ? StringNumberFilter :
        TYPE extends INumberValueSource<any, any> ? NumberFilter :
        TYPE extends ITypeSafeStringValueSource<any, any> ? StringFilter :
        TYPE extends IStringValueSource<any, any> ? StringFilter :
        TYPE extends ILocalDateTimeValueSource<any, any> ? LocalDateTimeFilter :
        TYPE extends IDateTimeValueSource<any, any> ? DateTimeFilter :
        TYPE extends ILocalDateValueSource<any, any> ? LocalDateFilter :
        TYPE extends IDateValueSource<any, any> ? DateFilter :
        TYPE extends ILocalTimeValueSource<any, any> ? LocalTimeFilter :
        TYPE extends ITimeValueSource<any, any> ? TimeFilter :
        TYPE extends IComparableValueSource<any, any, any, any> ? ComparableFilter<T> :
        TYPE extends IEqualableValueSource<any, any, any, any> ? EqualableFilter<T> :
        TYPE extends INullableValueSource<any, any, any, any> ? NullableFilter :
        TYPE extends IAggregatedArrayValueSource<any, any, any>  ? Filter | Array<Filter> : // Keep here to make easy deal with aggreagted arrays
        Filter
    ) : never

export type Filterable = {
    [key: string]: AnyValueSource | Filterable
}

export type DynamicFilter<DEFINITION extends Filterable> = {
    not?: DynamicFilter<DEFINITION>
    and?: Array<DynamicFilter<DEFINITION> | undefined>
    or?: Array<DynamicFilter<DEFINITION> | undefined>
} & {
    [KEY in keyof DEFINITION]?: DEFINITION[KEY] extends AnyValueSource ? MapValueSourceToFilter<DEFINITION[KEY]> : DEFINITION[KEY] extends Filterable ? DynamicFilter<DEFINITION[KEY]> : never
}

export interface DynamicConditionExpression<DEFINITION extends Filterable> {
    withValues(filter: DynamicFilter<DEFINITION>): BooleanValueSource<TableOfCondition<DEFINITION>, BooleanOptionalTypeOfCondition<DEFINITION>>
}

export type TableOfValueSource<TYPE> = TYPE extends ValueSourceOf<infer T> ? T : never

export type OptionalTypeOfValueSource<TYPE> =
    TYPE extends IValueSource<any, any, any, infer T> ? T : never

export type BooleanOptionalTypeOfCondition<DEFINITION extends Filterable> = MergeOptionalUnion<({
    [KEY in keyof DEFINITION]: OptionalTypeOfValueSource<DEFINITION[KEY]>
})[keyof DEFINITION]>

export type TableOfCondition<DEFINITION extends Filterable> = ({
    [KEY in keyof DEFINITION]: TableOfValueSource<DEFINITION[KEY]>
})[keyof DEFINITION]
