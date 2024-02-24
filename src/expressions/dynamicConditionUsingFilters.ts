import { double, int, LocalDate, LocalDateTime, LocalTime, stringDouble, stringInt, uuid } from "ts-extended-types";
import { AnyValueSource, BooleanValueSource, IAggregatedArrayValueSource, IAnyBooleanValueSource, IBigintValueSource, IBooleanValueSource, IComparableValueSource, ICustomDoubleValueSource, ICustomIntValueSource, ICustomLocalDateTimeValueSource, ICustomLocalDateValueSource, ICustomLocalTimeValueSource, ICustomUuidValueSource, IDateTimeValueSource, IDateValueSource, IDoubleValueSource, IEqualableValueSource, IIntValueSource, ILocalDateTimeValueSource, ILocalDateValueSource, ILocalTimeValueSource, INullableValueSource, INumberValueSource, IStringDoubleValueSource, IStringIntValueSource, IStringNumberValueSource, IStringValueSource, ITimeValueSource, ITypeSafeBigintValueSource, ITypeSafeStringValueSource, ITypeSafeUuidValueSource, IUuidValueSource, IValueSource, MergeOptionalUnion, ValueSourceOf } from "./values";

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
export interface CustomIntFilter<TYPE> extends ComparableFilter<TYPE> { }
export interface CustomDoubleFilter<TYPE> extends ComparableFilter<TYPE> { }
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
export interface CustomLocalDateFilter<TYPE> extends ComparableFilter<TYPE> { }
export interface CustomLocalTimeFilter<TYPE> extends ComparableFilter<TYPE> { }
export interface CustomLocalDateTimeFilter<TYPE> extends ComparableFilter<TYPE> { }

export interface UuidFilter extends ComparableFilter<uuid> {
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

export interface CustomUuidFilter<TYPE> extends ComparableFilter<TYPE> {
    equalsInsensitiveIfValue?: TYPE | null | undefined
    equalsInsensitive?: TYPE
    notEqualsInsensitiveIfValue?: TYPE | null | undefined
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
    TYPE extends 'stringInt' ? StringNumberFilter :
    TYPE extends 'int' ? NumberFilter :
    TYPE extends 'bigint' ? BigintFilter :
    TYPE extends 'stringDouble' ? StringNumberFilter :
    TYPE extends 'double' ? NumberFilter :
    TYPE extends 'string' ? StringFilter :
    TYPE extends 'uuid' ? StringFilter :
    TYPE extends 'localDate' ? DateFilter :
    TYPE extends 'localTime' ? TimeFilter :
    TYPE extends 'localDateTime' ? DateTimeFilter :
    TYPE extends ['customInt', infer T] ? CustomIntFilter<T> :
    TYPE extends ['customDouble', infer T] ? CustomDoubleFilter<T> :
    TYPE extends ['customUuid', infer T] ? CustomUuidFilter<T> :
    TYPE extends ['customLocalDate', infer T] ? CustomLocalDateFilter<T> :
    TYPE extends ['customLocalTime', infer T] ? CustomLocalTimeFilter<T> :
    TYPE extends ['customLocalDateTime', infer T] ? CustomLocalDateTimeFilter<T> :
    TYPE extends ['enum', infer T] ? EqualableFilter<T> :
    TYPE extends ['custom', infer T] ? EqualableFilter<T> :
    TYPE extends ['customComparable', infer T] ? ComparableFilter<T> :
    MapValueSourceToFilter<TYPE>


/** 
 * @deprecated Use custom types instead and the FilterTypeOf type
 */
export type TypeSafeFilterTypeOf<TYPE> = 
    TYPE extends 'boolean' ? BooleanFilter :
    TYPE extends 'stringInt' ? StringIntFilter :
    TYPE extends 'int' ? IntFilter :
    TYPE extends 'bigint' ? BigintFilter :
    TYPE extends 'stringDouble' ? StringDoubleFilter :
    TYPE extends 'double' ? DoubleFilter :
    TYPE extends 'string' ? StringFilter :
    TYPE extends 'uuid' ? UuidFilter :
    TYPE extends 'localDate' ? LocalDateFilter :
    TYPE extends 'localTime' ? LocalTimeFilter :
    TYPE extends 'localDateTime' ? LocalDateTimeFilter :
    TYPE extends ['customInt', infer T] ? CustomIntFilter<T> :
    TYPE extends ['customDouble', infer T] ? CustomDoubleFilter<T> :
    TYPE extends ['customUuid', infer T] ? CustomUuidFilter<T> :
    TYPE extends ['customLocalDate', infer T] ? CustomLocalDateFilter<T> :
    TYPE extends ['customLocalTime', infer T] ? CustomLocalTimeFilter<T> :
    TYPE extends ['customLocalDateTime', infer T] ? CustomLocalDateTimeFilter<T> :
    TYPE extends ['enum', infer T] ? EqualableFilter<T> :
    TYPE extends ['custom', infer T] ? EqualableFilter<T> :
    TYPE extends ['customComparable', infer T] ? ComparableFilter<T> :
    MapValueSourceToFilter<TYPE>

export type DynamicColumnType<T> = 'boolean' | 'stringInt' | 'int' | 'bigint' | 'stringDouble' | 'double' |
    'string' | 'uuid' | 'localDate' | 'localTime' | 'localDateTime' | 
    ['customInt', T] | ['customDouble', T] | ['customUuid', T] | ['customLocalDate', T] | ['customLocalTime', T] | ['customLocalDateTime', T] | 
    ['enum', T] | ['custom', T] | ['customComparable', T]

export type DynamicDefinition = {
    [key: string]: AnyValueSource | DynamicColumnType<any> | DynamicDefinition
}

export type DynamicCondition<DEFINITION extends DynamicDefinition, EXTENSION extends DinamicConditionExtension = never> = {
    not?: DynamicCondition<DEFINITION, EXTENSION>
    and?: Array<DynamicCondition<DEFINITION, EXTENSION> | undefined>
    or?: Array<DynamicCondition<DEFINITION, EXTENSION> | undefined>
} & {
    [KEY in NonReplacedField<DEFINITION, EXTENSION>]?: 
        KEY extends keyof EXTENSION 
        ? (
            DEFINITION[KEY] extends DynamicColumnType<any> 
            ? ExtendDefinition<FilterTypeOf<DEFINITION[KEY]>, EXTENSION[KEY]> : DEFINITION[KEY] extends AnyValueSource 
            ? ExtendDefinition<FilterTypeOf<DEFINITION[KEY]>, EXTENSION[KEY]> : DEFINITION[KEY] extends DynamicDefinition 
            ? ( 
                EXTENSION[KEY] extends DinamicConditionExtension
                ? DynamicCondition<DEFINITION[KEY], EXTENSION[KEY]>
                : DynamicCondition<DEFINITION[KEY], never>
            ) : never
        ) : (
            DEFINITION[KEY] extends DynamicColumnType<any> 
            ? FilterTypeOf<DEFINITION[KEY]> : DEFINITION[KEY] extends AnyValueSource 
            ? FilterTypeOf<DEFINITION[KEY]> : DEFINITION[KEY] extends DynamicDefinition 
            ? DynamicCondition<DEFINITION[KEY], never>
            : never
        )
} & {
    [KEY in DynamicConditionExtensionKeys<EXTENSION>]?: EXTENSION[KEY] extends DynamicConditionRule<infer TYPE> ? TYPE : never
}

export type TypeSafeDynamicCondition<DEFINITION extends DynamicDefinition, EXTENSION extends DinamicConditionExtension = never> = {
    not?: TypeSafeDynamicCondition<DEFINITION, EXTENSION>
    and?: Array<TypeSafeDynamicCondition<DEFINITION, EXTENSION> | undefined>
    or?: Array<TypeSafeDynamicCondition<DEFINITION, EXTENSION> | undefined>
} & {
    [KEY in NonReplacedField<DEFINITION, EXTENSION>]?: 
        KEY extends keyof EXTENSION 
        ? (
            DEFINITION[KEY] extends DynamicColumnType<any> 
            ? ExtendDefinition<TypeSafeFilterTypeOf<DEFINITION[KEY]>, EXTENSION[KEY]> : DEFINITION[KEY] extends AnyValueSource 
            ? ExtendDefinition<TypeSafeFilterTypeOf<DEFINITION[KEY]>, EXTENSION[KEY]> : DEFINITION[KEY] extends DynamicDefinition 
            ? ( 
                EXTENSION[KEY] extends DinamicConditionExtension
                ? TypeSafeDynamicCondition<DEFINITION[KEY], EXTENSION[KEY]>
                : TypeSafeDynamicCondition<DEFINITION[KEY], never>
            ) : never
        ) : (
            DEFINITION[KEY] extends DynamicColumnType<any> 
            ? FilterTypeOf<DEFINITION[KEY]> : DEFINITION[KEY] extends AnyValueSource 
            ? FilterTypeOf<DEFINITION[KEY]> : DEFINITION[KEY] extends DynamicDefinition 
            ? TypeSafeDynamicCondition<DEFINITION[KEY], never>
            : never
        )
} & {
    [KEY in DynamicConditionExtensionKeys<EXTENSION>]: EXTENSION[KEY] extends DynamicConditionRule<infer TYPE> ? TYPE : never
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
        TYPE extends ITypeSafeUuidValueSource<any, any> ? UuidFilter :
        TYPE extends IUuidValueSource<any, any> ? StringFilter :
        TYPE extends ILocalDateTimeValueSource<any, any> ? LocalDateTimeFilter :
        TYPE extends IDateTimeValueSource<any, any> ? DateTimeFilter :
        TYPE extends ILocalDateValueSource<any, any> ? LocalDateFilter :
        TYPE extends IDateValueSource<any, any> ? DateFilter :
        TYPE extends ILocalTimeValueSource<any, any> ? LocalTimeFilter :
        TYPE extends ITimeValueSource<any, any> ? TimeFilter :
        TYPE extends ICustomIntValueSource<any, any, any, any> ? CustomIntFilter<T> :
        TYPE extends ICustomDoubleValueSource<any, any, any, any> ? CustomDoubleFilter<T> :
        TYPE extends ICustomUuidValueSource<any, any, any, any> ? CustomUuidFilter<T> :
        TYPE extends ICustomLocalDateValueSource<any, any, any, any> ? CustomLocalDateFilter<T> :
        TYPE extends ICustomLocalTimeValueSource<any, any, any, any> ? CustomLocalTimeFilter<T> :
        TYPE extends ICustomLocalDateTimeValueSource<any, any, any, any> ? CustomLocalDateTimeFilter<T> :
        TYPE extends IComparableValueSource<any, any, any, any> ? ComparableFilter<T> :
        TYPE extends IEqualableValueSource<any, any, any, any> ? EqualableFilter<T> :
        TYPE extends INullableValueSource<any, any, any, any> ? NullableFilter :
        TYPE extends IAggregatedArrayValueSource<any, any, any>  ? Filter | Array<Filter> : // Keep here to make easy deal with aggreagted arrays
        Filter
    ) : never

export type Filterable = {
    [key: string]: AnyValueSource | Filterable
}

export type DinamicConditionExtension = { [key: string]: DynamicConditionRule<any> | DinamicConditionExtension } 
export type DynamicConditionRule<T> = (rule: T) => IAnyBooleanValueSource<any, any>

type NonReplacedField<DEFINITION, EXTENSION> = Exclude<keyof DEFINITION, DynamicConditionExtensionKeys<EXTENSION>> 
type DynamicConditionExtensionKeys<EXTENSION> = {[K in keyof EXTENSION]: EXTENSION[K] extends DynamicConditionRule<any> ? K : never }[keyof EXTENSION]

type ExtendDefinition<T, EXTENSION> = Omit<T, DynamicConditionExtensionKeys<EXTENSION>> & {
    [KEY in DynamicConditionExtensionKeys<EXTENSION>]?: EXTENSION[KEY] extends DynamicConditionRule<infer TYPE> ? TYPE : never
}

export type DynamicFilter<DEFINITION extends Filterable> = {
    not?: DynamicFilter<DEFINITION>
    and?: Array<DynamicFilter<DEFINITION> | undefined>
    or?: Array<DynamicFilter<DEFINITION> | undefined>
} & {
    [KEY in keyof DEFINITION]?: DEFINITION[KEY] extends AnyValueSource ? MapValueSourceToFilter<DEFINITION[KEY]> : DEFINITION[KEY] extends Filterable ? DynamicFilter<DEFINITION[KEY]> : never
}

export interface DynamicConditionExpression<DEFINITION extends Filterable, EXTENSION extends DinamicConditionExtension> {
    withValues(filter: DynamicFilter<DEFINITION>): BooleanValueSource<TableOfCondition<DEFINITION> | TableOfConditionExtention<EXTENSION>, BooleanOptionalTypeOfCondition<DEFINITION> | BooleanOptionalTypeOfConditionExtension<EXTENSION>>
}

export type TableOfValueSource<TYPE> = TYPE extends ValueSourceOf<infer T> ? T : never

export type OptionalTypeOfValueSource<TYPE> =
    TYPE extends IValueSource<any, any, any, infer T> ? T : never

type BooleanOptionalTypeOfCondition<DEFINITION extends Filterable> = MergeOptionalUnion<({
    [KEY in keyof DEFINITION]: 
        DEFINITION[KEY] extends AnyValueSource 
        ? OptionalTypeOfValueSource<DEFINITION[KEY]> : DEFINITION[KEY] extends Filterable
        ? BooleanOptionalTypeOfCondition<DEFINITION[KEY]> : never
})[keyof DEFINITION]>

type TableOfCondition<DEFINITION extends Filterable> = ({
    [KEY in keyof DEFINITION]: 
        DEFINITION[KEY] extends AnyValueSource 
        ? TableOfValueSource<DEFINITION[KEY]> : DEFINITION[KEY] extends Filterable
        ? TableOfCondition<DEFINITION[KEY]> : never
})[keyof DEFINITION]

type BooleanOptionalTypeOfConditionExtension<EXTENSION extends DinamicConditionExtension> = MergeOptionalUnion<({
    [KEY in keyof EXTENSION]: 
        EXTENSION[KEY] extends DynamicConditionRule<infer RULE_RESULT>  
        ? OptionalTypeOfValueSource<RULE_RESULT> : never
})[keyof EXTENSION]>

type TableOfConditionExtention<EXTENSION extends DinamicConditionExtension> = ({
    [KEY in keyof EXTENSION]: 
        EXTENSION[KEY] extends DynamicConditionRule<infer RULE_RESULT> 
        ? TableOfValueSource<RULE_RESULT> : never
})[keyof EXTENSION]