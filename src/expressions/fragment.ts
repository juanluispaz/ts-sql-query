import type { BooleanValueSource, NumberValueSource, StringValueSource, LocalDateValueSource, LocalTimeValueSource, LocalDateTimeValueSource, EqualableValueSource, ComparableValueSource, RemapValueSourceType, TypeOfArgument, MapArgumentToValueSource, ArgForFn, IfValueSource, ArgForBuilderIfValue, IAnyBooleanValueSource, BigintValueSource, OptionalType, ValueSourceOf, UuidValueSource, CustomIntValueSource, CustomDoubleValueSource, CustomUuidValueSource, CustomLocalDateTimeValueSource, CustomLocalDateValueSource, CustomLocalTimeValueSource, IValueSource, RemapValueSourceTypeWithOptionalType, OptionalTypeOfValue, ArgBaseTypeForFn, MergeOptionalUnion } from "../expressions/values"
import type { optionalType, source } from "../utils/symbols"
import type { NSource } from "../utils/sourceName"

export interface BooleanFragmentExpression</*in|out*/ NO_SOURCE extends NSource, /*in|out*/ OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray):  BooleanValueSource<NO_SOURCE, OPTIONAL_TYPE>
    sql<T1 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): BooleanValueSource<T1, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): BooleanValueSource<T1 | T2, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): BooleanValueSource<T1 | T2 | T3, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): BooleanValueSource<T1 | T2 | T3 | T4, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): BooleanValueSource<T1 | T2 | T3 | T4 | T5, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource, T6 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): BooleanValueSource<T1 | T2 | T3 | T4 | T5 | T6, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource, T6 extends NSource, T7 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): BooleanValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, OPTIONAL_TYPE>
}

export interface NumberFragmentExpression</*in|out*/ NO_SOURCE extends NSource, /*in|out*/ OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray):  NumberValueSource<NO_SOURCE, OPTIONAL_TYPE>
    sql<T1 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): NumberValueSource<T1, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): NumberValueSource<T1 | T2, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): NumberValueSource<T1 | T2 | T3, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): NumberValueSource<T1 | T2 | T3 | T4, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): NumberValueSource<T1 | T2 | T3 | T4 | T5, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource, T6 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): NumberValueSource<T1 | T2 | T3 | T4 | T5 | T6, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource, T6 extends NSource, T7 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): NumberValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, OPTIONAL_TYPE>
}

export interface BigintFragmentExpression</*in|out*/ NO_SOURCE extends NSource, /*in|out*/ OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray):  BigintValueSource<NO_SOURCE, OPTIONAL_TYPE>
    sql<T1 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): BigintValueSource<T1, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): BigintValueSource<T1 | T2, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): BigintValueSource<T1 | T2 | T3, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): BigintValueSource<T1 | T2 | T3 | T4, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): BigintValueSource<T1 | T2 | T3 | T4 | T5, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource, T6 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): BigintValueSource<T1 | T2 | T3 | T4 | T5 | T6, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource, T6 extends NSource, T7 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): BigintValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, OPTIONAL_TYPE>
}

export interface StringFragmentExpression</*in|out*/ NO_SOURCE extends NSource, /*in|out*/ OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray):  StringValueSource<NO_SOURCE, OPTIONAL_TYPE>
    sql<T1 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): StringValueSource<T1, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): StringValueSource<T1 | T2, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): StringValueSource<T1 | T2 | T3, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): StringValueSource<T1 | T2 | T3 | T4, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): StringValueSource<T1 | T2 | T3 | T4 | T5, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource, T6 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): StringValueSource<T1 | T2 | T3 | T4 | T5 | T6, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource, T6 extends NSource, T7 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): StringValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, OPTIONAL_TYPE>
}

export interface UuidFragmentExpression</*in|out*/ NO_SOURCE extends NSource, /*in|out*/ OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray):  UuidValueSource<NO_SOURCE, OPTIONAL_TYPE>
    sql<T1 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): UuidValueSource<T1, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): UuidValueSource<T1 | T2, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): UuidValueSource<T1 | T2 | T3, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): UuidValueSource<T1 | T2 | T3 | T4, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): UuidValueSource<T1 | T2 | T3 | T4 | T5, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource, T6 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): UuidValueSource<T1 | T2 | T3 | T4 | T5 | T6, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource, T6 extends NSource, T7 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): UuidValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, OPTIONAL_TYPE>
}

export interface LocalDateFragmentExpression</*in|out*/ NO_SOURCE extends NSource, /*in|out*/ OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray):  LocalDateValueSource<NO_SOURCE, OPTIONAL_TYPE>
    sql<T1 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): LocalDateValueSource<T1, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): LocalDateValueSource<T1 | T2, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): LocalDateValueSource<T1 | T2 | T3, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): LocalDateValueSource<T1 | T2 | T3 | T4, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): LocalDateValueSource<T1 | T2 | T3 | T4 | T5, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource, T6 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): LocalDateValueSource<T1 | T2 | T3 | T4 | T5 | T6, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource, T6 extends NSource, T7 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): LocalDateValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, OPTIONAL_TYPE>
}

export interface LocalTimeFragmentExpression</*in|out*/ NO_SOURCE extends NSource, /*in|out*/ OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray):  LocalTimeValueSource<NO_SOURCE, OPTIONAL_TYPE>
    sql<T1 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): LocalTimeValueSource<T1, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): LocalTimeValueSource<T1 | T2, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): LocalTimeValueSource<T1 | T2 | T3, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): LocalTimeValueSource<T1 | T2 | T3 | T4, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): LocalTimeValueSource<T1 | T2 | T3 | T4 | T5, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource, T6 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): LocalTimeValueSource<T1 | T2 | T3 | T4 | T5 | T6, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource, T6 extends NSource, T7 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): LocalTimeValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, OPTIONAL_TYPE>
}

export interface LocalDateTimeFragmentExpression</*in|out*/ NO_SOURCE extends NSource, /*in|out*/ OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray):  LocalDateTimeValueSource<NO_SOURCE, OPTIONAL_TYPE>
    sql<T1 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): LocalDateTimeValueSource<T1, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): LocalDateTimeValueSource<T1 | T2, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): LocalDateTimeValueSource<T1 | T2 | T3, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): LocalDateTimeValueSource<T1 | T2 | T3 | T4, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): LocalDateTimeValueSource<T1 | T2 | T3 | T4 | T5, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource, T6 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): LocalDateTimeValueSource<T1 | T2 | T3 | T4 | T5 | T6, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource, T6 extends NSource, T7 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): LocalDateTimeValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, OPTIONAL_TYPE>
}

export interface EqualableFragmentExpression</*in|out*/ NO_SOURCE extends NSource, TYPE, TYPE_NAME, /*in|out*/ OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray):  EqualableValueSource<NO_SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): EqualableValueSource<T1, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): EqualableValueSource<T1 | T2, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): EqualableValueSource<T1 | T2 | T3, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): EqualableValueSource<T1 | T2 | T3 | T4, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): EqualableValueSource<T1 | T2 | T3 | T4 | T5, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource, T6 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): EqualableValueSource<T1 | T2 | T3 | T4 | T5 | T6, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource, T6 extends NSource, T7 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): EqualableValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, TYPE, TYPE_NAME, OPTIONAL_TYPE>
}

export interface ComparableFragmentExpression</*in|out*/ NO_SOURCE extends NSource, TYPE, TYPE_NAME, /*in|out*/ OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray):  ComparableValueSource<NO_SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): ComparableValueSource<T1, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): ComparableValueSource<T1 | T2, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): ComparableValueSource<T1 | T2 | T3, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): ComparableValueSource<T1 | T2 | T3 | T4, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): ComparableValueSource<T1 | T2 | T3 | T4 | T5, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource, T6 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): ComparableValueSource<T1 | T2 | T3 | T4 | T5 | T6, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource, T6 extends NSource, T7 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): ComparableValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, TYPE, TYPE_NAME, OPTIONAL_TYPE>
}

export interface CustomIntFragmentExpression</*in|out*/ NO_SOURCE extends NSource, TYPE, TYPE_NAME, /*in|out*/ OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray):  CustomIntValueSource<NO_SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): CustomIntValueSource<T1, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): CustomIntValueSource<T1 | T2, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): CustomIntValueSource<T1 | T2 | T3, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): CustomIntValueSource<T1 | T2 | T3 | T4, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): CustomIntValueSource<T1 | T2 | T3 | T4 | T5, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource, T6 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): CustomIntValueSource<T1 | T2 | T3 | T4 | T5 | T6, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource, T6 extends NSource, T7 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): CustomIntValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, TYPE, TYPE_NAME, OPTIONAL_TYPE>
}

export interface CustomDoubleFragmentExpression</*in|out*/ NO_SOURCE extends NSource, TYPE, TYPE_NAME, /*in|out*/ OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray):  CustomDoubleValueSource<NO_SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): CustomDoubleValueSource<T1, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): CustomDoubleValueSource<T1 | T2, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): CustomDoubleValueSource<T1 | T2 | T3, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): CustomDoubleValueSource<T1 | T2 | T3 | T4, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): CustomDoubleValueSource<T1 | T2 | T3 | T4 | T5, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource, T6 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): CustomDoubleValueSource<T1 | T2 | T3 | T4 | T5 | T6, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource, T6 extends NSource, T7 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): CustomDoubleValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, TYPE, TYPE_NAME, OPTIONAL_TYPE>
}

export interface CustomUuidFragmentExpression</*in|out*/ NO_SOURCE extends NSource, TYPE, TYPE_NAME, /*in|out*/ OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray):  CustomUuidValueSource<NO_SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): CustomUuidValueSource<T1, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): CustomUuidValueSource<T1 | T2, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): CustomUuidValueSource<T1 | T2 | T3, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): CustomUuidValueSource<T1 | T2 | T3 | T4, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): CustomUuidValueSource<T1 | T2 | T3 | T4 | T5, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource, T6 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): CustomUuidValueSource<T1 | T2 | T3 | T4 | T5 | T6, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource, T6 extends NSource, T7 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): CustomUuidValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, TYPE, TYPE_NAME, OPTIONAL_TYPE>
}

export interface CustomLocalDateTimeFragmentExpression</*in|out*/ NO_SOURCE extends NSource, TYPE, TYPE_NAME, /*in|out*/ OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray):  CustomLocalDateTimeValueSource<NO_SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): CustomLocalDateTimeValueSource<T1, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): CustomLocalDateTimeValueSource<T1 | T2, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): CustomLocalDateTimeValueSource<T1 | T2 | T3, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): CustomLocalDateTimeValueSource<T1 | T2 | T3 | T4, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): CustomLocalDateTimeValueSource<T1 | T2 | T3 | T4 | T5, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource, T6 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): CustomLocalDateTimeValueSource<T1 | T2 | T3 | T4 | T5 | T6, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource, T6 extends NSource, T7 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): CustomLocalDateTimeValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, TYPE, TYPE_NAME, OPTIONAL_TYPE>
}

export interface CustomLocalDateFragmentExpression</*in|out*/ NO_SOURCE extends NSource, TYPE, TYPE_NAME, /*in|out*/ OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray):  CustomLocalDateValueSource<NO_SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): CustomLocalDateValueSource<T1, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): CustomLocalDateValueSource<T1 | T2, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): CustomLocalDateValueSource<T1 | T2 | T3, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): CustomLocalDateValueSource<T1 | T2 | T3 | T4, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): CustomLocalDateValueSource<T1 | T2 | T3 | T4 | T5, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource, T6 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): CustomLocalDateValueSource<T1 | T2 | T3 | T4 | T5 | T6, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource, T6 extends NSource, T7 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): CustomLocalDateValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, TYPE, TYPE_NAME, OPTIONAL_TYPE>
}

export interface CustomLocalTimeFragmentExpression</*in|out*/ NO_SOURCE extends NSource, TYPE, TYPE_NAME, /*in|out*/ OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray):  CustomLocalTimeValueSource<NO_SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): CustomLocalTimeValueSource<T1, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): CustomLocalTimeValueSource<T1 | T2, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): CustomLocalTimeValueSource<T1 | T2 | T3, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): CustomLocalTimeValueSource<T1 | T2 | T3 | T4, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): CustomLocalTimeValueSource<T1 | T2 | T3 | T4 | T5, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource, T6 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): CustomLocalTimeValueSource<T1 | T2 | T3 | T4 | T5 | T6, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource, T6 extends NSource, T7 extends NSource>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): CustomLocalTimeValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, TYPE, TYPE_NAME, OPTIONAL_TYPE>
}


export interface FragmentBuilder0</*in|out*/ NO_SOURCE extends NSource> {
    as<RESULT extends ValueSourceOf<NO_SOURCE>>(impl: () => RESULT): () => RESULT
}

export interface FragmentBuilder1</*in|out*/ NO_SOURCE extends NSource, A1> {
    as<RESULT extends ValueSourceOf<NO_SOURCE>>(impl: (a1: MapArgumentToValueSource<NO_SOURCE, A1>) => RESULT): FragmentFunction1<NO_SOURCE, A1, RESULT>
}

export interface FragmentBuilder2</*in|out*/ NO_SOURCE extends NSource, A1, A2> {
    as<RESULT extends ValueSourceOf<NO_SOURCE>>(impl: (a1: MapArgumentToValueSource<NO_SOURCE, A1>, a2: MapArgumentToValueSource<NO_SOURCE, A2>) => RESULT): FragmentFunction2<NO_SOURCE, A1, A2, RESULT>
}

export interface FragmentBuilder3</*in|out*/ NO_SOURCE extends NSource, A1, A2, A3> {
    as<RESULT extends ValueSourceOf<NO_SOURCE>>(impl: (a1: MapArgumentToValueSource<NO_SOURCE, A1>, a2: MapArgumentToValueSource<NO_SOURCE, A2>, a3: MapArgumentToValueSource<NO_SOURCE, A3>) => RESULT): FragmentFunction3<NO_SOURCE, A1, A2, A3, RESULT>
}

export interface FragmentBuilder4</*in|out*/ NO_SOURCE extends NSource, A1, A2, A3, A4> {
    as<RESULT extends ValueSourceOf<NO_SOURCE>>(impl: (a1: MapArgumentToValueSource<NO_SOURCE, A1>, a2: MapArgumentToValueSource<NO_SOURCE, A2>, a3: MapArgumentToValueSource<NO_SOURCE, A3>, a4: MapArgumentToValueSource<NO_SOURCE, A4>) => RESULT): FragmentFunction4<NO_SOURCE, A1, A2, A3, A4, RESULT>
}

export interface FragmentBuilder5</*in|out*/ NO_SOURCE extends NSource, A1, A2, A3, A4, A5> {
    as<RESULT extends ValueSourceOf<NO_SOURCE>>(impl: (a1: MapArgumentToValueSource<NO_SOURCE, A1>, a2: MapArgumentToValueSource<NO_SOURCE, A2>, a3: MapArgumentToValueSource<NO_SOURCE, A3>, a4: MapArgumentToValueSource<NO_SOURCE, A4>, a5: MapArgumentToValueSource<NO_SOURCE, A5>) => RESULT): FragmentFunction5<NO_SOURCE, A1, A2, A3, A4, A5, RESULT>
}

export interface FragmentFunction1</*in|out*/ NO_SOURCE extends NSource, A1, RESULT> {
    (a1: TypeOfArgument<A1>): RemapValueSourceType<NO_SOURCE, RESULT>
    <T1 extends NSource>(a1: ArgForFn<T1, A1>): RemapValueSourceType<T1, RESULT>
}

export interface FragmentFunction2</*in|out*/ NO_SOURCE extends NSource, A1, A2, RESULT> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>): RemapValueSourceType<NO_SOURCE, RESULT>
    <T1 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>): RemapValueSourceType<T1, RESULT>

    <T2 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>): RemapValueSourceType<T2, RESULT>
    <T1 extends NSource, T2 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>): RemapValueSourceType<T1 | T2, RESULT>
}

export interface FragmentFunction3</*in|out*/ NO_SOURCE extends NSource, A1, A2, A3, RESULT> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>): RemapValueSourceType<NO_SOURCE, RESULT>
    <T1 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>): RemapValueSourceType<T1, RESULT>
    <T2 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>): RemapValueSourceType<T2, RESULT>
    <T1 extends NSource, T2 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>): RemapValueSourceType<T1 | T2, RESULT>

    <T3 extends NSource>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>): RemapValueSourceType<T3, RESULT>
    <T1 extends NSource, T3 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>): RemapValueSourceType<T1 | T3, RESULT>
    <T2 extends NSource, T3 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>): RemapValueSourceType<T2 | T3, RESULT>
    <T1 extends NSource, T2 extends NSource, T3 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>): RemapValueSourceType<T1 | T2 | T3, RESULT>
}

export interface FragmentFunction4</*in|out*/ NO_SOURCE extends NSource, A1, A2, A3, A4, RESULT> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<NO_SOURCE, RESULT>
    <T1 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<T1, RESULT>
    <T2 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<T2, RESULT>
    <T1 extends NSource, T2 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<T1 | T2, RESULT>
    <T3 extends NSource>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<T3, RESULT>
    <T1 extends NSource, T3 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<T1 | T3, RESULT>
    <T2 extends NSource, T3 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<T2 | T3, RESULT>
    <T1 extends NSource, T2 extends NSource, T3 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<T1 | T2 | T3, RESULT>

    <T4 extends NSource>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>): RemapValueSourceType<T4, RESULT>
    <T1 extends NSource, T4 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>): RemapValueSourceType<T1 | T4, RESULT>
    <T2 extends NSource, T4 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>): RemapValueSourceType<T2 | T4, RESULT>
    <T1 extends NSource, T2 extends NSource, T4 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>): RemapValueSourceType<T1 | T2 | T4, RESULT>
    <T3 extends NSource, T4 extends NSource>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>): RemapValueSourceType<T3 | T4, RESULT>
    <T1 extends NSource, T3 extends NSource, T4 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>): RemapValueSourceType<T1 | T3 | T4, RESULT>
    <T2 extends NSource, T3 extends NSource, T4 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>): RemapValueSourceType<T2 | T3 | T4, RESULT>
    <T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>): RemapValueSourceType<T1 | T2 | T3 | T4, RESULT>
}

export interface FragmentFunction5</*in|out*/ NO_SOURCE extends NSource, A1, A2, A3, A4, A5, RESULT> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<NO_SOURCE, RESULT>
    <T1 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T1, RESULT>
    <T2 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T2, RESULT>
    <T1 extends NSource, T2 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T1 | T2, RESULT>
    <T3 extends NSource>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T3, RESULT>
    <T1 extends NSource, T3 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T1 | T3, RESULT>
    <T2 extends NSource, T3 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T2 | T3, RESULT>
    <T1 extends NSource, T2 extends NSource, T3 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T1 | T2 | T3, RESULT>
    <T4 extends NSource>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T4, RESULT>
    <T1 extends NSource, T4 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T1 | T4, RESULT>
    <T2 extends NSource, T4 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T2 | T4, RESULT>
    <T1 extends NSource, T2 extends NSource, T4 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T1 | T2 | T4, RESULT>
    <T3 extends NSource, T4 extends NSource>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T3 | T4, RESULT>
    <T1 extends NSource, T3 extends NSource, T4 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T1 | T3 | T4, RESULT>
    <T2 extends NSource, T3 extends NSource, T4 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T2 | T3 | T4, RESULT>
    <T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T1 | T2 | T3 | T4, RESULT>

    <T5 extends NSource>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: ArgForFn<T5, A5>): RemapValueSourceType<T5, RESULT>
    <T1 extends NSource, T5 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: ArgForFn<T5, A5>): RemapValueSourceType<T1 | T5, RESULT>
    <T2 extends NSource, T5 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: ArgForFn<T5, A5>): RemapValueSourceType<T2 | T5, RESULT>
    <T1 extends NSource, T2 extends NSource, T5 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: ArgForFn<T5, A5>): RemapValueSourceType<T1 | T2 | T5, RESULT>
    <T3 extends NSource, T5 extends NSource>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: ArgForFn<T5, A5>): RemapValueSourceType<T3 | T5, RESULT>
    <T1 extends NSource, T3 extends NSource, T5 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: ArgForFn<T5, A5>): RemapValueSourceType<T1 | T3 | T5, RESULT>
    <T2 extends NSource, T3 extends NSource, T5 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: ArgForFn<T5, A5>): RemapValueSourceType<T2 | T3 | T5, RESULT>
    <T1 extends NSource, T2 extends NSource, T3 extends NSource, T5 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: ArgForFn<T5, A5>): RemapValueSourceType<T1 | T2 | T3 | T5, RESULT>
    <T4 extends NSource, T5 extends NSource>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>, a5: ArgForFn<T5, A5>): RemapValueSourceType<T4 | T5, RESULT>
    <T1 extends NSource, T4 extends NSource, T5 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>, a5: ArgForFn<T5, A5>): RemapValueSourceType<T1 | T4 | T5, RESULT>
    <T2 extends NSource, T4 extends NSource, T5 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>, a5: ArgForFn<T5, A5>): RemapValueSourceType<T2 | T4 | T5, RESULT>
    <T1 extends NSource, T2 extends NSource, T4 extends NSource, T5 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>, a5: ArgForFn<T5, A5>): RemapValueSourceType<T1 | T2 | T4 | T5, RESULT>
    <T3 extends NSource, T4 extends NSource, T5 extends NSource>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>, a5: ArgForFn<T5, A5>): RemapValueSourceType<T3 | T4 | T5, RESULT>
    <T1 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>, a5: ArgForFn<T5, A5>): RemapValueSourceType<T1 | T3 | T4 | T5, RESULT>
    <T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>, a5: ArgForFn<T5, A5>): RemapValueSourceType<T2 | T3 | T4 | T5, RESULT>
    <T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>, a5: ArgForFn<T5, A5>): RemapValueSourceType<T1 | T2 | T3 | T4 | T5, RESULT>
}

export interface FragmentBuilder0IfValue</*in|out*/ NO_SOURCE extends NSource> {
    as<RESULT extends IAnyBooleanValueSource<NO_SOURCE, any>>(impl: () => RESULT): () => IfValueSource<NO_SOURCE, RESULT[typeof optionalType]>
}

export interface FragmentBuilder1IfValue</*in|out*/ NO_SOURCE extends NSource, A1> {
    as<RESULT extends IAnyBooleanValueSource<NO_SOURCE, any>>(impl: (a1: ArgForBuilderIfValue<NO_SOURCE, A1>) => RESULT): FragmentFunctionIfValue1<NO_SOURCE, A1, RESULT[typeof optionalType]>
}

export interface FragmentBuilder2IfValue</*in|out*/ NO_SOURCE extends NSource, A1, A2> {
    as<RESULT extends IAnyBooleanValueSource<NO_SOURCE, any>>(impl: (a1: ArgForBuilderIfValue<NO_SOURCE, A1>, a2: ArgForBuilderIfValue<NO_SOURCE, A2>) => RESULT): FragmentFunctionIfValue2<NO_SOURCE, A1, A2, RESULT[typeof optionalType]>
}

export interface FragmentBuilder3IfValue</*in|out*/ NO_SOURCE extends NSource, A1, A2, A3> {
    as<RESULT extends IAnyBooleanValueSource<NO_SOURCE, any>>(impl: (a1: ArgForBuilderIfValue<NO_SOURCE, A1>, a2: ArgForBuilderIfValue<NO_SOURCE, A2>, a3: ArgForBuilderIfValue<NO_SOURCE, A3>) => RESULT): FragmentFunctionIfValue3<NO_SOURCE, A1, A2, A3, RESULT[typeof optionalType]>
}

export interface FragmentBuilder4IfValue</*in|out*/ NO_SOURCE extends NSource, A1, A2, A3, A4> {
    as<RESULT extends IAnyBooleanValueSource<NO_SOURCE, any>>(impl: (a1: ArgForBuilderIfValue<NO_SOURCE, A1>, a2: ArgForBuilderIfValue<NO_SOURCE, A2>, a3: ArgForBuilderIfValue<NO_SOURCE, A3>, a4: ArgForBuilderIfValue<NO_SOURCE, A4>) => RESULT): FragmentFunctionIfValue4<NO_SOURCE, A1, A2, A3, A4, RESULT[typeof optionalType]>
}

export interface FragmentBuilder5IfValue</*in|out*/ NO_SOURCE extends NSource, A1, A2, A3, A4, A5> {
    as<RESULT extends IAnyBooleanValueSource<NO_SOURCE, any>>(impl: (a1: ArgForBuilderIfValue<NO_SOURCE, A1>, a2: ArgForBuilderIfValue<NO_SOURCE, A2>, a3: ArgForBuilderIfValue<NO_SOURCE, A3>, a4: ArgForBuilderIfValue<NO_SOURCE, A4>, a5: ArgForBuilderIfValue<NO_SOURCE, A5>) => RESULT): FragmentFunctionIfValue5<NO_SOURCE, A1, A2, A3, A4, A5, RESULT[typeof optionalType]>
}

export interface FragmentFunctionIfValue1</*in|out*/ NO_SOURCE extends NSource, A1, /*in|out*/ OPTIONAL_TYPE extends OptionalType> {
    (a1: TypeOfArgument<A1>): IfValueSource<NO_SOURCE, OPTIONAL_TYPE>
    <T1 extends NSource>(a1: ArgForFn<T1, A1>): IfValueSource<T1, OPTIONAL_TYPE>
}

export interface FragmentFunctionIfValue2</*in|out*/ NO_SOURCE extends NSource, A1, A2, /*in|out*/ OPTIONAL_TYPE extends OptionalType> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>): IfValueSource<NO_SOURCE, OPTIONAL_TYPE>
    <T1 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>): IfValueSource<T1, OPTIONAL_TYPE>

    <T2 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>): IfValueSource<T2, OPTIONAL_TYPE>
    <T1 extends NSource, T2 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>): IfValueSource<T1 | T2, OPTIONAL_TYPE>
}

export interface FragmentFunctionIfValue3</*in|out*/ NO_SOURCE extends NSource, A1, A2, A3, /*in|out*/ OPTIONAL_TYPE extends OptionalType> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>): IfValueSource<NO_SOURCE, OPTIONAL_TYPE>
    <T1 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>): IfValueSource<T1, OPTIONAL_TYPE>
    <T2 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>): IfValueSource<T2, OPTIONAL_TYPE>
    <T1 extends NSource, T2 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>): IfValueSource<T1 | T2, OPTIONAL_TYPE>

    <T3 extends NSource>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>): IfValueSource<T3, OPTIONAL_TYPE>
    <T1 extends NSource, T3 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>): IfValueSource<T1 | T3, OPTIONAL_TYPE>
    <T2 extends NSource, T3 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>): IfValueSource<T2 | T3, OPTIONAL_TYPE>
    <T1 extends NSource, T2 extends NSource, T3 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>): IfValueSource<T1 | T2 | T3, OPTIONAL_TYPE>
}

export interface FragmentFunctionIfValue4</*in|out*/ NO_SOURCE extends NSource, A1, A2, A3, A4, /*in|out*/ OPTIONAL_TYPE extends OptionalType> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): IfValueSource<NO_SOURCE, OPTIONAL_TYPE>
    <T1 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): IfValueSource<T1, OPTIONAL_TYPE>
    <T2 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): IfValueSource<T2, OPTIONAL_TYPE>
    <T1 extends NSource, T2 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): IfValueSource<T1 | T2, OPTIONAL_TYPE>
    <T3 extends NSource>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>): IfValueSource<T3, OPTIONAL_TYPE>
    <T1 extends NSource, T3 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>): IfValueSource<T1 | T3, OPTIONAL_TYPE>
    <T2 extends NSource, T3 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>): IfValueSource<T2 | T3, OPTIONAL_TYPE>
    <T1 extends NSource, T2 extends NSource, T3 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>): IfValueSource<T1 | T2 | T3, OPTIONAL_TYPE>

    <T4 extends NSource>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>): IfValueSource<T4, OPTIONAL_TYPE>
    <T1 extends NSource, T4 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>): IfValueSource<T1 | T4, OPTIONAL_TYPE>
    <T2 extends NSource, T4 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>): IfValueSource<T2 | T4, OPTIONAL_TYPE>
    <T1 extends NSource, T2 extends NSource, T4 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>): IfValueSource<T1 | T2 | T4, OPTIONAL_TYPE>
    <T3 extends NSource, T4 extends NSource>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>): IfValueSource<T3 | T4, OPTIONAL_TYPE>
    <T1 extends NSource, T3 extends NSource, T4 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>): IfValueSource<T1 | T3 | T4, OPTIONAL_TYPE>
    <T2 extends NSource, T3 extends NSource, T4 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>): IfValueSource<T2 | T3 | T4, OPTIONAL_TYPE>
    <T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>): IfValueSource<T1 | T2 | T3 | T4, OPTIONAL_TYPE>
}

export interface FragmentFunctionIfValue5</*in|out*/ NO_SOURCE extends NSource, A1, A2, A3, A4, A5, /*in|out*/ OPTIONAL_TYPE extends OptionalType> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<NO_SOURCE, OPTIONAL_TYPE>
    <T1 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<T1, OPTIONAL_TYPE>
    <T2 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<T2, OPTIONAL_TYPE>
    <T1 extends NSource, T2 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | T2, OPTIONAL_TYPE>
    <T3 extends NSource>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<T3, OPTIONAL_TYPE>
    <T1 extends NSource, T3 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | T3, OPTIONAL_TYPE>
    <T2 extends NSource, T3 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<T2 | T3, OPTIONAL_TYPE>
    <T1 extends NSource, T2 extends NSource, T3 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | T2 | T3, OPTIONAL_TYPE>
    <T4 extends NSource>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T4, OPTIONAL_TYPE>
    <T1 extends NSource, T4 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | T4, OPTIONAL_TYPE>
    <T2 extends NSource, T4 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T2 | T4, OPTIONAL_TYPE>
    <T1 extends NSource, T2 extends NSource, T4 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | T2 | T4, OPTIONAL_TYPE>
    <T3 extends NSource, T4 extends NSource>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T3 | T4, OPTIONAL_TYPE>
    <T1 extends NSource, T3 extends NSource, T4 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | T3 | T4, OPTIONAL_TYPE>
    <T2 extends NSource, T3 extends NSource, T4 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T2 | T3 | T4, OPTIONAL_TYPE>
    <T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | T2 | T3 | T4, OPTIONAL_TYPE>

    <T5 extends NSource>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: ArgForFn<T5, A5>): IfValueSource<T5, OPTIONAL_TYPE>
    <T1 extends NSource, T5 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: ArgForFn<T5, A5>): IfValueSource<T1 | T5, OPTIONAL_TYPE>
    <T2 extends NSource, T5 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: ArgForFn<T5, A5>): IfValueSource<T2 | T5, OPTIONAL_TYPE>
    <T1 extends NSource, T2 extends NSource, T5 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: ArgForFn<T5, A5>): IfValueSource<T1 | T2 | T5, OPTIONAL_TYPE>
    <T3 extends NSource, T5 extends NSource>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: ArgForFn<T5, A5>): IfValueSource<T3 | T5, OPTIONAL_TYPE>
    <T1 extends NSource, T3 extends NSource, T5 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: ArgForFn<T5, A5>): IfValueSource<T1 | T3 | T5, OPTIONAL_TYPE>
    <T2 extends NSource, T3 extends NSource, T5 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: ArgForFn<T5, A5>): IfValueSource<T2 | T3 | T5, OPTIONAL_TYPE>
    <T1 extends NSource, T2 extends NSource, T3 extends NSource, T5 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: ArgForFn<T5, A5>): IfValueSource<T1 | T2 | T3 | T5, OPTIONAL_TYPE>
    <T4 extends NSource, T5 extends NSource>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>, a5: ArgForFn<T5, A5>): IfValueSource<T4 | T5, OPTIONAL_TYPE>
    <T1 extends NSource, T4 extends NSource, T5 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>, a5: ArgForFn<T5, A5>): IfValueSource<T1 | T4 | T5, OPTIONAL_TYPE>
    <T2 extends NSource, T4 extends NSource, T5 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>, a5: ArgForFn<T5, A5>): IfValueSource<T2 | T4 | T5, OPTIONAL_TYPE>
    <T1 extends NSource, T2 extends NSource, T4 extends NSource, T5 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>, a5: ArgForFn<T5, A5>): IfValueSource<T1 | T2 | T4 | T5, OPTIONAL_TYPE>
    <T3 extends NSource, T4 extends NSource, T5 extends NSource>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>, a5: ArgForFn<T5, A5>): IfValueSource<T3 | T4 | T5, OPTIONAL_TYPE>
    <T1 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>, a5: ArgForFn<T5, A5>): IfValueSource<T1 | T3 | T4 | T5, OPTIONAL_TYPE>
    <T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>, a5: ArgForFn<T5, A5>): IfValueSource<T2 | T3 | T4 | T5, OPTIONAL_TYPE>
    <T1 extends NSource, T2 extends NSource, T3 extends NSource, T4 extends NSource, T5 extends NSource>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>, a5: ArgForFn<T5, A5>): IfValueSource<T1 | T2 | T3 | T4 | T5, OPTIONAL_TYPE>
}

export interface FragmentBuilderMaybeOptional0</*in|out*/ NO_SOURCE extends NSource> {
    as<RESULT extends ValueSourceOf<NO_SOURCE>>(impl: () => RESULT): () => RESULT
}

export interface FragmentBuilderMaybeOptional1</*in|out*/ NO_SOURCE extends NSource, A1> {
    as<RESULT extends IValueSource<NO_SOURCE, any, any, 'optional'>>(impl: (a1: MapArgumentToValueSource<NO_SOURCE, A1>) => RESULT): FragmentFunctionMaybeOptional1<NO_SOURCE, A1, RESULT>
}

export interface FragmentBuilderMaybeOptional2</*in|out*/ NO_SOURCE extends NSource, A1, A2> {
    as<RESULT extends IValueSource<NO_SOURCE, any, any, 'optional'>>(impl: (a1: MapArgumentToValueSource<NO_SOURCE, A1>, a2: MapArgumentToValueSource<NO_SOURCE, A2>) => RESULT): FragmentFunctionMaybeOptional2<NO_SOURCE, A1, A2, RESULT>
}

export interface FragmentBuilderMaybeOptional3</*in|out*/ NO_SOURCE extends NSource, A1, A2, A3> {
    as<RESULT extends IValueSource<NO_SOURCE, any, any, 'optional'>>(impl: (a1: MapArgumentToValueSource<NO_SOURCE, A1>, a2: MapArgumentToValueSource<NO_SOURCE, A2>, a3: MapArgumentToValueSource<NO_SOURCE, A3>) => RESULT): FragmentFunctionMaybeOptional3<NO_SOURCE, A1, A2, A3, RESULT>
}

export interface FragmentBuilderMaybeOptional4</*in|out*/ NO_SOURCE extends NSource, A1, A2, A3, A4> {
    as<RESULT extends IValueSource<NO_SOURCE, any, any, 'optional'>>(impl: (a1: MapArgumentToValueSource<NO_SOURCE, A1>, a2: MapArgumentToValueSource<NO_SOURCE, A2>, a3: MapArgumentToValueSource<NO_SOURCE, A3>, a4: MapArgumentToValueSource<NO_SOURCE, A4>) => RESULT): FragmentFunctionMaybeOptional4<NO_SOURCE, A1, A2, A3, A4, RESULT>
}

export interface FragmentBuilderMaybeOptional5</*in|out*/ NO_SOURCE extends NSource, A1, A2, A3, A4, A5> {
    as<RESULT extends IValueSource<NO_SOURCE, any, any, 'optional'>>(impl: (a1: MapArgumentToValueSource<NO_SOURCE, A1>, a2: MapArgumentToValueSource<NO_SOURCE, A2>, a3: MapArgumentToValueSource<NO_SOURCE, A3>, a4: MapArgumentToValueSource<NO_SOURCE, A4>, a5: MapArgumentToValueSource<NO_SOURCE, A5>) => RESULT): FragmentFunctionMaybeOptional5<NO_SOURCE, A1, A2, A3, A4, A5, RESULT>
}

export interface FragmentFunctionMaybeOptional1</*in|out*/ NO_SOURCE extends NSource, A1, RESULT> {
    <T1 extends TypeOfArgument<A1>>(a1: T1): RemapValueSourceTypeWithOptionalType<NO_SOURCE, RESULT, OptionalTypeOfValue<T1>>
    <T1 extends ArgBaseTypeForFn<A1>>(a1: T1): RemapValueSourceTypeWithOptionalType<T1[typeof source], RESULT, T1[typeof optionalType]>
}

export interface FragmentFunctionMaybeOptional2</*in|out*/ NO_SOURCE extends NSource, A1, A2, RESULT> {
    <T1 extends TypeOfArgument<A1>, T2 extends TypeOfArgument<A2>>(a1: T1, a2: T2): RemapValueSourceTypeWithOptionalType<NO_SOURCE, RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | OptionalTypeOfValue<T2>>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends TypeOfArgument<A2>>(a1: T1, a2: T2): RemapValueSourceTypeWithOptionalType<T1[typeof source], RESULT, MergeOptionalUnion<T1[typeof optionalType] | OptionalTypeOfValue<T2>>>

    <T1 extends TypeOfArgument<A1>, T2 extends ArgBaseTypeForFn<A2>>(a1: T1, a2: T2): RemapValueSourceTypeWithOptionalType<T2[typeof source], RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | T2[typeof optionalType]>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends ArgBaseTypeForFn<A2>>(a1: T1, a2: T2): RemapValueSourceTypeWithOptionalType<T1[typeof source] | T2[typeof source], RESULT, MergeOptionalUnion<T1[typeof optionalType] | T2[typeof optionalType]>>
}

export interface FragmentFunctionMaybeOptional3</*in|out*/ NO_SOURCE extends NSource, A1, A2, A3, RESULT> {
    <T1 extends TypeOfArgument<A1>, T2 extends TypeOfArgument<A2>, T3 extends TypeOfArgument<A3>>(a1: T1, a2: T2, a3: T3): RemapValueSourceTypeWithOptionalType<NO_SOURCE, RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | OptionalTypeOfValue<T2> | OptionalTypeOfValue<T3>>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends TypeOfArgument<A2>, T3 extends TypeOfArgument<A3>>(a1: T1, a2: T2, a3: T3): RemapValueSourceTypeWithOptionalType<T1[typeof source], RESULT, MergeOptionalUnion<T1[typeof optionalType] | OptionalTypeOfValue<T2> | OptionalTypeOfValue<T3>>>
    <T1 extends TypeOfArgument<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends TypeOfArgument<A3>>(a1: T1, a2: T2, a3: T3): RemapValueSourceTypeWithOptionalType<T2[typeof source], RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | T2[typeof optionalType] | OptionalTypeOfValue<T3>>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends TypeOfArgument<A3>>(a1: T1, a2: T2, a3: T3): RemapValueSourceTypeWithOptionalType<T1[typeof source] | T2[typeof source], RESULT, MergeOptionalUnion<T1[typeof optionalType] | T2[typeof optionalType] | OptionalTypeOfValue<T3>>>

    <T1 extends TypeOfArgument<A1>, T2 extends TypeOfArgument<A2>, T3 extends ArgBaseTypeForFn<A3>>(a1: T1, a2: T2, a3: T3): RemapValueSourceTypeWithOptionalType<T3[typeof source], RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | OptionalTypeOfValue<T2> | T3[typeof optionalType]>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends TypeOfArgument<A2>, T3 extends ArgBaseTypeForFn<A3>>(a1: T1, a2: T2, a3: T3): RemapValueSourceTypeWithOptionalType<T1[typeof source] | T3[typeof source], RESULT, MergeOptionalUnion<T1[typeof optionalType] | OptionalTypeOfValue<T2 | T3[typeof optionalType]>>>
    <T1 extends TypeOfArgument<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends ArgBaseTypeForFn<A3>>(a1: T1, a2: T2, a3: T3): RemapValueSourceTypeWithOptionalType<T2[typeof source] | T3[typeof source], RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | T2[typeof optionalType] | T3[typeof optionalType]>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends ArgBaseTypeForFn<A3>>(a1: T1, a2: T2, a3: T3): RemapValueSourceTypeWithOptionalType<T1[typeof source] | T2[typeof source] | T3[typeof source], RESULT, MergeOptionalUnion<T1[typeof optionalType] | T2[typeof optionalType] | T3[typeof optionalType]>>
}

export interface FragmentFunctionMaybeOptional4</*in|out*/ NO_SOURCE extends NSource, A1, A2, A3, A4, RESULT> {
    <T1 extends TypeOfArgument<A1>, T2 extends TypeOfArgument<A2>, T3 extends TypeOfArgument<A3>, T4 extends TypeOfArgument<A4>>(a1: T1, a2: T2, a3: T3, a4: T4): RemapValueSourceTypeWithOptionalType<NO_SOURCE, RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | OptionalTypeOfValue<T2> | OptionalTypeOfValue<T3> | OptionalTypeOfValue<T4>>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends TypeOfArgument<A2>, T3 extends TypeOfArgument<A3>, T4 extends TypeOfArgument<A4>>(a1: T1, a2: T2, a3: T3, a4: T4): RemapValueSourceTypeWithOptionalType<T1[typeof source], RESULT, MergeOptionalUnion<T1[typeof optionalType] | OptionalTypeOfValue<T2> | OptionalTypeOfValue<T3> | OptionalTypeOfValue<T4>>>
    <T1 extends TypeOfArgument<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends TypeOfArgument<A3>, T4 extends TypeOfArgument<A4>>(a1: T1, a2: T2, a3: T3, a4: T4): RemapValueSourceTypeWithOptionalType<T2[typeof source], RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | T2[typeof optionalType] | OptionalTypeOfValue<T3> | OptionalTypeOfValue<T4>>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends TypeOfArgument<A3>, T4 extends TypeOfArgument<A4>>(a1: T1, a2: T2, a3: T3, a4: T4): RemapValueSourceTypeWithOptionalType<T1[typeof source] | T2[typeof source], RESULT, MergeOptionalUnion<T1[typeof optionalType] | T2[typeof optionalType] | OptionalTypeOfValue<T3> | OptionalTypeOfValue<T4>>>
    <T1 extends TypeOfArgument<A1>, T2 extends TypeOfArgument<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends TypeOfArgument<A4>>(a1: T1, a2: T2, a3: T3, a4: T4): RemapValueSourceTypeWithOptionalType<T3[typeof source], RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | OptionalTypeOfValue<T2> | T3[typeof optionalType] | OptionalTypeOfValue<T4>>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends TypeOfArgument<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends TypeOfArgument<A4>>(a1: T1, a2: T2, a3: T3, a4: T4): RemapValueSourceTypeWithOptionalType<T1[typeof source] | T3[typeof source], RESULT, MergeOptionalUnion<T1[typeof optionalType] | OptionalTypeOfValue<T2 | T3[typeof optionalType]> | OptionalTypeOfValue<T4>>>
    <T1 extends TypeOfArgument<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends TypeOfArgument<A4>>(a1: T1, a2: T2, a3: T3, a4: T4): RemapValueSourceTypeWithOptionalType<T2[typeof source] | T3[typeof source], RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | T2[typeof optionalType] | T3[typeof optionalType] | OptionalTypeOfValue<T4>>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends TypeOfArgument<A4>>(a1: T1, a2: T2, a3: T3, a4: T4): RemapValueSourceTypeWithOptionalType<T1[typeof source] | T2[typeof source] | T3[typeof source], RESULT, MergeOptionalUnion<T1[typeof optionalType] | T2[typeof optionalType] | T3[typeof optionalType] | OptionalTypeOfValue<T4>>>

    <T1 extends TypeOfArgument<A1>, T2 extends TypeOfArgument<A2>, T3 extends TypeOfArgument<A3>, T4 extends ArgBaseTypeForFn<A4>>(a1: T1, a2: T2, a3: T3, a4: T4): RemapValueSourceTypeWithOptionalType<T4[typeof source], RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | OptionalTypeOfValue<T2> | OptionalTypeOfValue<T3> | T4[typeof optionalType]>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends TypeOfArgument<A2>, T3 extends TypeOfArgument<A3>, T4 extends ArgBaseTypeForFn<A4>>(a1: T1, a2: T2, a3: T3, a4: T4): RemapValueSourceTypeWithOptionalType<T1[typeof source] | T4[typeof source], RESULT, MergeOptionalUnion<T1[typeof optionalType] | OptionalTypeOfValue<T2> | OptionalTypeOfValue<T3> | T4[typeof optionalType]>>
    <T1 extends TypeOfArgument<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends TypeOfArgument<A3>, T4 extends ArgBaseTypeForFn<A4>>(a1: T1, a2: T2, a3: T3, a4: T4): RemapValueSourceTypeWithOptionalType<T2[typeof source] | T4[typeof source], RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | T2[typeof optionalType] | OptionalTypeOfValue<T3> | T4[typeof optionalType]>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends TypeOfArgument<A3>, T4 extends ArgBaseTypeForFn<A4>>(a1: T1, a2: T2, a3: T3, a4: T4): RemapValueSourceTypeWithOptionalType<T1[typeof source] | T2[typeof source] | T4[typeof source], RESULT, MergeOptionalUnion<T1[typeof optionalType] | T2[typeof optionalType] | OptionalTypeOfValue<T3> | T4[typeof optionalType]>>
    <T1 extends TypeOfArgument<A1>, T2 extends TypeOfArgument<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends ArgBaseTypeForFn<A4>>(a1: T1, a2: T2, a3: T3, a4: T4): RemapValueSourceTypeWithOptionalType<T3[typeof source] | T4[typeof source], RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | OptionalTypeOfValue<T2> | T3[typeof optionalType] | T4[typeof optionalType]>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends TypeOfArgument<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends ArgBaseTypeForFn<A4>>(a1: T1, a2: T2, a3: T3, a4: T4): RemapValueSourceTypeWithOptionalType<T1[typeof source] | T3[typeof source] | T4[typeof source], RESULT, MergeOptionalUnion<T1[typeof optionalType] | OptionalTypeOfValue<T2 | T3[typeof optionalType]> | T4[typeof optionalType]>>
    <T1 extends TypeOfArgument<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends ArgBaseTypeForFn<A4>>(a1: T1, a2: T2, a3: T3, a4: T4): RemapValueSourceTypeWithOptionalType<T2[typeof source] | T3[typeof source] | T4[typeof source], RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | T2[typeof optionalType] | T3[typeof optionalType] | T4[typeof optionalType]>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends ArgBaseTypeForFn<A4>>(a1: T1, a2: T2, a3: T3, a4: T4): RemapValueSourceTypeWithOptionalType<T1[typeof source] | T2[typeof source] | T3[typeof source] | T4[typeof source], RESULT, MergeOptionalUnion<T1[typeof optionalType] | T2[typeof optionalType] | T3[typeof optionalType] | T4[typeof optionalType]>>
}

export interface FragmentFunctionMaybeOptional5</*in|out*/ NO_SOURCE extends NSource, A1, A2, A3, A4, A5, RESULT> {
    <T1 extends TypeOfArgument<A1>, T2 extends TypeOfArgument<A2>, T3 extends TypeOfArgument<A3>, T4 extends TypeOfArgument<A4>, T5 extends TypeOfArgument<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<NO_SOURCE, RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | OptionalTypeOfValue<T2> | OptionalTypeOfValue<T3> | OptionalTypeOfValue<T4> | OptionalTypeOfValue<T5>>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends TypeOfArgument<A2>, T3 extends TypeOfArgument<A3>, T4 extends TypeOfArgument<A4>, T5 extends TypeOfArgument<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T1[typeof source], RESULT, MergeOptionalUnion<T1[typeof optionalType] | OptionalTypeOfValue<T2> | OptionalTypeOfValue<T3> | OptionalTypeOfValue<T4> | OptionalTypeOfValue<T5>>>
    <T1 extends TypeOfArgument<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends TypeOfArgument<A3>, T4 extends TypeOfArgument<A4>, T5 extends TypeOfArgument<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T2[typeof source], RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | T2[typeof optionalType] | OptionalTypeOfValue<T3> | OptionalTypeOfValue<T4> | OptionalTypeOfValue<T5>>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends TypeOfArgument<A3>, T4 extends TypeOfArgument<A4>, T5 extends TypeOfArgument<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T1[typeof source] | T2[typeof source], RESULT, MergeOptionalUnion<T1[typeof optionalType] | T2[typeof optionalType] | OptionalTypeOfValue<T3> | OptionalTypeOfValue<T4> | OptionalTypeOfValue<T5>>>
    <T1 extends TypeOfArgument<A1>, T2 extends TypeOfArgument<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends TypeOfArgument<A4>, T5 extends TypeOfArgument<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T3[typeof source], RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | OptionalTypeOfValue<T2> | T3[typeof optionalType] | OptionalTypeOfValue<T4> | OptionalTypeOfValue<T5>>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends TypeOfArgument<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends TypeOfArgument<A4>, T5 extends TypeOfArgument<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T1[typeof source] | T3[typeof source], RESULT, MergeOptionalUnion<T1[typeof optionalType] | OptionalTypeOfValue<T2 | T3[typeof optionalType]> | OptionalTypeOfValue<T4> | OptionalTypeOfValue<T5>>>
    <T1 extends TypeOfArgument<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends TypeOfArgument<A4>, T5 extends TypeOfArgument<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T2[typeof source] | T3[typeof source], RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | T2[typeof optionalType] | T3[typeof optionalType] | OptionalTypeOfValue<T4> | OptionalTypeOfValue<T5>>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends TypeOfArgument<A4>, T5 extends TypeOfArgument<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T1[typeof source] | T2[typeof source] | T3[typeof source], RESULT, MergeOptionalUnion<T1[typeof optionalType] | T2[typeof optionalType] | T3[typeof optionalType] | OptionalTypeOfValue<T4> | OptionalTypeOfValue<T5>>>
    <T1 extends TypeOfArgument<A1>, T2 extends TypeOfArgument<A2>, T3 extends TypeOfArgument<A3>, T4 extends ArgBaseTypeForFn<A4>, T5 extends TypeOfArgument<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T4[typeof source], RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | OptionalTypeOfValue<T2> | OptionalTypeOfValue<T3> | T4[typeof optionalType] | OptionalTypeOfValue<T5>>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends TypeOfArgument<A2>, T3 extends TypeOfArgument<A3>, T4 extends ArgBaseTypeForFn<A4>, T5 extends TypeOfArgument<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T1[typeof source] | T4[typeof source], RESULT, MergeOptionalUnion<T1[typeof optionalType] | OptionalTypeOfValue<T2> | OptionalTypeOfValue<T3> | T4[typeof optionalType] | OptionalTypeOfValue<T5>>>
    <T1 extends TypeOfArgument<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends TypeOfArgument<A3>, T4 extends ArgBaseTypeForFn<A4>, T5 extends TypeOfArgument<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T2[typeof source] | T4[typeof source], RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | T2[typeof optionalType] | OptionalTypeOfValue<T3> | T4[typeof optionalType] | OptionalTypeOfValue<T5>>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends TypeOfArgument<A3>, T4 extends ArgBaseTypeForFn<A4>, T5 extends TypeOfArgument<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T1[typeof source] | T2[typeof source] | T4[typeof source], RESULT, MergeOptionalUnion<T1[typeof optionalType] | T2[typeof optionalType] | OptionalTypeOfValue<T3> | T4[typeof optionalType] | OptionalTypeOfValue<T5>>>
    <T1 extends TypeOfArgument<A1>, T2 extends TypeOfArgument<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends ArgBaseTypeForFn<A4>, T5 extends TypeOfArgument<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T3[typeof source] | T4[typeof source], RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | OptionalTypeOfValue<T2> | T3[typeof optionalType] | T4[typeof optionalType] | OptionalTypeOfValue<T5>>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends TypeOfArgument<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends ArgBaseTypeForFn<A4>, T5 extends TypeOfArgument<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T1[typeof source] | T3[typeof source] | T4[typeof source], RESULT, MergeOptionalUnion<T1[typeof optionalType] | OptionalTypeOfValue<T2 | T3[typeof optionalType]> | T4[typeof optionalType] | OptionalTypeOfValue<T5>>>
    <T1 extends TypeOfArgument<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends ArgBaseTypeForFn<A4>, T5 extends TypeOfArgument<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T2[typeof source] | T3[typeof source] | T4[typeof source], RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | T2[typeof optionalType] | T3[typeof optionalType] | T4[typeof optionalType] | OptionalTypeOfValue<T5>>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends ArgBaseTypeForFn<A4>, T5 extends TypeOfArgument<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T1[typeof source] | T2[typeof source] | T3[typeof source] | T4[typeof source], RESULT, MergeOptionalUnion<T1[typeof optionalType] | T2[typeof optionalType] | T3[typeof optionalType] | T4[typeof optionalType] | OptionalTypeOfValue<T5>>>

    <T1 extends TypeOfArgument<A1>, T2 extends TypeOfArgument<A2>, T3 extends TypeOfArgument<A3>, T4 extends TypeOfArgument<A4>, T5 extends ArgBaseTypeForFn<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T5[typeof source], RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | OptionalTypeOfValue<T2> | OptionalTypeOfValue<T3> | OptionalTypeOfValue<T4> | T5[typeof optionalType]>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends TypeOfArgument<A2>, T3 extends TypeOfArgument<A3>, T4 extends TypeOfArgument<A4>, T5 extends ArgBaseTypeForFn<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T1[typeof source] | T5[typeof source], RESULT, MergeOptionalUnion<T1[typeof optionalType] | OptionalTypeOfValue<T2> | OptionalTypeOfValue<T3> | OptionalTypeOfValue<T4> | T5[typeof optionalType]>>
    <T1 extends TypeOfArgument<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends TypeOfArgument<A3>, T4 extends TypeOfArgument<A4>, T5 extends ArgBaseTypeForFn<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T2[typeof source] | T5[typeof source], RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | T2[typeof optionalType] | OptionalTypeOfValue<T3> | OptionalTypeOfValue<T4> | T5[typeof optionalType]>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends TypeOfArgument<A3>, T4 extends TypeOfArgument<A4>, T5 extends ArgBaseTypeForFn<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T1[typeof source] | T2[typeof source] | T5[typeof source], RESULT, MergeOptionalUnion<T1[typeof optionalType] | T2[typeof optionalType] | OptionalTypeOfValue<T3> | OptionalTypeOfValue<T4> | T5[typeof optionalType]>>
    <T1 extends TypeOfArgument<A1>, T2 extends TypeOfArgument<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends TypeOfArgument<A4>, T5 extends ArgBaseTypeForFn<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T3[typeof source] | T5[typeof source], RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | OptionalTypeOfValue<T2> | T3[typeof optionalType] | OptionalTypeOfValue<T4> | T5[typeof optionalType]>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends TypeOfArgument<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends TypeOfArgument<A4>, T5 extends ArgBaseTypeForFn<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T1[typeof source] | T3[typeof source] | T5[typeof source], RESULT, MergeOptionalUnion<T1[typeof optionalType] | OptionalTypeOfValue<T2 | T3[typeof optionalType]> | OptionalTypeOfValue<T4> | T5[typeof optionalType]>>
    <T1 extends TypeOfArgument<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends TypeOfArgument<A4>, T5 extends ArgBaseTypeForFn<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T2[typeof source] | T3[typeof source] | T5[typeof source], RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | T2[typeof optionalType] | T3[typeof optionalType] | OptionalTypeOfValue<T4> | T5[typeof optionalType]>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends TypeOfArgument<A4>, T5 extends ArgBaseTypeForFn<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T1[typeof source] | T2[typeof source] | T3[typeof source] | T5[typeof source], RESULT, MergeOptionalUnion<T1[typeof optionalType] | T2[typeof optionalType] | T3[typeof optionalType] | OptionalTypeOfValue<T4> | T5[typeof optionalType]>>
    <T1 extends TypeOfArgument<A1>, T2 extends TypeOfArgument<A2>, T3 extends TypeOfArgument<A3>, T4 extends ArgBaseTypeForFn<A4>, T5 extends ArgBaseTypeForFn<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T4[typeof source] | T5[typeof source], RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | OptionalTypeOfValue<T2> | OptionalTypeOfValue<T3> | T4[typeof optionalType] | T5[typeof optionalType]>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends TypeOfArgument<A2>, T3 extends TypeOfArgument<A3>, T4 extends ArgBaseTypeForFn<A4>, T5 extends ArgBaseTypeForFn<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T1[typeof source] | T4[typeof source] | T5[typeof source], RESULT, MergeOptionalUnion<T1[typeof optionalType] | OptionalTypeOfValue<T2> | OptionalTypeOfValue<T3> | T4[typeof optionalType] | T5[typeof optionalType]>>
    <T1 extends TypeOfArgument<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends TypeOfArgument<A3>, T4 extends ArgBaseTypeForFn<A4>, T5 extends ArgBaseTypeForFn<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T2[typeof source] | T4[typeof source] | T5[typeof source], RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | T2[typeof optionalType] | OptionalTypeOfValue<T3> | T4[typeof optionalType] | T5[typeof optionalType]>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends TypeOfArgument<A3>, T4 extends ArgBaseTypeForFn<A4>, T5 extends ArgBaseTypeForFn<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T1[typeof source] | T2[typeof source] | T4[typeof source] | T5[typeof source], RESULT, MergeOptionalUnion<T1[typeof optionalType] | T2[typeof optionalType] | OptionalTypeOfValue<T3> | T4[typeof optionalType] | T5[typeof optionalType]>>
    <T1 extends TypeOfArgument<A1>, T2 extends TypeOfArgument<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends ArgBaseTypeForFn<A4>, T5 extends ArgBaseTypeForFn<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T3[typeof source] | T4[typeof source] | T5[typeof source], RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | OptionalTypeOfValue<T2> | T3[typeof optionalType] | T4[typeof optionalType] | T5[typeof optionalType]>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends TypeOfArgument<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends ArgBaseTypeForFn<A4>, T5 extends ArgBaseTypeForFn<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T1[typeof source] | T3[typeof source] | T4[typeof source] | T5[typeof source], RESULT, MergeOptionalUnion<T1[typeof optionalType] | OptionalTypeOfValue<T2 | T3[typeof optionalType]> | T4[typeof optionalType] | T5[typeof optionalType]>>
    <T1 extends TypeOfArgument<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends ArgBaseTypeForFn<A4>, T5 extends ArgBaseTypeForFn<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T2[typeof source] | T3[typeof source] | T4[typeof source] | T5[typeof source], RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | T2[typeof optionalType] | T3[typeof optionalType] | T4[typeof optionalType] | T5[typeof optionalType]>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends ArgBaseTypeForFn<A4>, T5 extends ArgBaseTypeForFn<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T1[typeof source] | T2[typeof source] | T3[typeof source] | T4[typeof source] | T5[typeof source], RESULT, MergeOptionalUnion<T1[typeof optionalType] | T2[typeof optionalType] | T3[typeof optionalType] | T4[typeof optionalType] | T5[typeof optionalType]>>
}