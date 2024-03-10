import type { AnyDB } from "../databases"
import type { ITableOrViewRef, NoTableOrViewRequired } from "../utils/ITableOrView"
import type { BooleanValueSource, NumberValueSource, StringValueSource, LocalDateValueSource, LocalTimeValueSource, LocalDateTimeValueSource, EqualableValueSource, ComparableValueSource, RemapValueSourceType, TypeOfArgument, MapArgumentToValueSource, ArgForFn, IfValueSource, ArgForBuilderIfValue, IBooleanValueSource, IIfValueSource, BigintValueSource, OptionalType, ValueSourceOf, UuidValueSource, CustomIntValueSource, CustomDoubleValueSource, CustomUuidValueSource, CustomLocalDateTimeValueSource, CustomLocalDateValueSource, CustomLocalTimeValueSource, IValueSource, RemapValueSourceTypeWithOptionalType, OptionalTypeOfValue, ArgBaseTypeForFn, MergeOptionalUnion } from "../expressions/values"
import type { optionalType, tableOrView } from "../utils/symbols"

export interface BooleanFragmentExpression<DB extends AnyDB, OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray):  BooleanValueSource<NoTableOrViewRequired<DB>, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): BooleanValueSource<T1, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): BooleanValueSource<T1 | T2, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): BooleanValueSource<T1 | T2 | T3, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): BooleanValueSource<T1 | T2 | T3 | T4, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): BooleanValueSource<T1 | T2 | T3 | T4 | T5, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>, T6 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): BooleanValueSource<T1 | T2 | T3 | T4 | T5 | T6, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>, T6 extends ITableOrViewRef<DB>, T7 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): BooleanValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, OPTIONAL_TYPE>
    sql<T extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: ValueSourceOf<T>[]): BooleanValueSource<T, OPTIONAL_TYPE>
}

export interface NumberFragmentExpression<DB extends AnyDB, OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray):  NumberValueSource<NoTableOrViewRequired<DB>, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): NumberValueSource<T1, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): NumberValueSource<T1 | T2, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): NumberValueSource<T1 | T2 | T3, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): NumberValueSource<T1 | T2 | T3 | T4, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): NumberValueSource<T1 | T2 | T3 | T4 | T5, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>, T6 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): NumberValueSource<T1 | T2 | T3 | T4 | T5 | T6, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>, T6 extends ITableOrViewRef<DB>, T7 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): NumberValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, OPTIONAL_TYPE>
    sql<T extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: ValueSourceOf<T>[]): NumberValueSource<T, OPTIONAL_TYPE>
}

export interface BigintFragmentExpression<DB extends AnyDB, OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray):  BigintValueSource<NoTableOrViewRequired<DB>, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): BigintValueSource<T1, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): BigintValueSource<T1 | T2, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): BigintValueSource<T1 | T2 | T3, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): BigintValueSource<T1 | T2 | T3 | T4, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): BigintValueSource<T1 | T2 | T3 | T4 | T5, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>, T6 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): BigintValueSource<T1 | T2 | T3 | T4 | T5 | T6, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>, T6 extends ITableOrViewRef<DB>, T7 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): BigintValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, OPTIONAL_TYPE>
    sql<T extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: ValueSourceOf<T>[]): NumberValueSource<T, OPTIONAL_TYPE>
}

export interface StringFragmentExpression<DB extends AnyDB, OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray):  StringValueSource<NoTableOrViewRequired<DB>, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): StringValueSource<T1, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): StringValueSource<T1 | T2, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): StringValueSource<T1 | T2 | T3, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): StringValueSource<T1 | T2 | T3 | T4, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): StringValueSource<T1 | T2 | T3 | T4 | T5, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>, T6 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): StringValueSource<T1 | T2 | T3 | T4 | T5 | T6, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>, T6 extends ITableOrViewRef<DB>, T7 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): StringValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, OPTIONAL_TYPE>
    sql<T extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: ValueSourceOf<T>[]): StringValueSource<T, OPTIONAL_TYPE>
}

export interface UuidFragmentExpression<DB extends AnyDB, OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray):  UuidValueSource<NoTableOrViewRequired<DB>, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): UuidValueSource<T1, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): UuidValueSource<T1 | T2, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): UuidValueSource<T1 | T2 | T3, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): UuidValueSource<T1 | T2 | T3 | T4, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): UuidValueSource<T1 | T2 | T3 | T4 | T5, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>, T6 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): UuidValueSource<T1 | T2 | T3 | T4 | T5 | T6, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>, T6 extends ITableOrViewRef<DB>, T7 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): UuidValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, OPTIONAL_TYPE>
    sql<T extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: ValueSourceOf<T>[]): UuidValueSource<T, OPTIONAL_TYPE>
}

export interface LocalDateFragmentExpression<DB extends AnyDB, OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray):  LocalDateValueSource<NoTableOrViewRequired<DB>, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): LocalDateValueSource<T1, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): LocalDateValueSource<T1 | T2, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): LocalDateValueSource<T1 | T2 | T3, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): LocalDateValueSource<T1 | T2 | T3 | T4, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): LocalDateValueSource<T1 | T2 | T3 | T4 | T5, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>, T6 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): LocalDateValueSource<T1 | T2 | T3 | T4 | T5 | T6, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>, T6 extends ITableOrViewRef<DB>, T7 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): LocalDateValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, OPTIONAL_TYPE>
    sql<T extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: ValueSourceOf<T>[]): LocalDateValueSource<T, OPTIONAL_TYPE>
}

export interface LocalTimeFragmentExpression<DB extends AnyDB, OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray):  LocalTimeValueSource<NoTableOrViewRequired<DB>, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): LocalTimeValueSource<T1, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): LocalTimeValueSource<T1 | T2, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): LocalTimeValueSource<T1 | T2 | T3, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): LocalTimeValueSource<T1 | T2 | T3 | T4, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): LocalTimeValueSource<T1 | T2 | T3 | T4 | T5, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>, T6 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): LocalTimeValueSource<T1 | T2 | T3 | T4 | T5 | T6, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>, T6 extends ITableOrViewRef<DB>, T7 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): LocalTimeValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, OPTIONAL_TYPE>
    sql<T extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: ValueSourceOf<T>[]): LocalTimeValueSource<T, OPTIONAL_TYPE>
}

export interface LocalDateTimeFragmentExpression<DB extends AnyDB, OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray):  LocalDateTimeValueSource<NoTableOrViewRequired<DB>, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): LocalDateTimeValueSource<T1, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): LocalDateTimeValueSource<T1 | T2, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): LocalDateTimeValueSource<T1 | T2 | T3, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): LocalDateTimeValueSource<T1 | T2 | T3 | T4, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): LocalDateTimeValueSource<T1 | T2 | T3 | T4 | T5, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>, T6 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): LocalDateTimeValueSource<T1 | T2 | T3 | T4 | T5 | T6, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>, T6 extends ITableOrViewRef<DB>, T7 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): LocalDateTimeValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, OPTIONAL_TYPE>
    sql<T extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: ValueSourceOf<T>[]): LocalDateTimeValueSource<T, OPTIONAL_TYPE>
}

export interface EqualableFragmentExpression<DB extends AnyDB, TYPE, TYPE_NAME, OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray):  EqualableValueSource<NoTableOrViewRequired<DB>, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): EqualableValueSource<T1, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): EqualableValueSource<T1 | T2, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): EqualableValueSource<T1 | T2 | T3, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): EqualableValueSource<T1 | T2 | T3 | T4, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): EqualableValueSource<T1 | T2 | T3 | T4 | T5, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>, T6 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): EqualableValueSource<T1 | T2 | T3 | T4 | T5 | T6, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>, T6 extends ITableOrViewRef<DB>, T7 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): EqualableValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: ValueSourceOf<T>[]): EqualableValueSource<T, TYPE, TYPE_NAME, OPTIONAL_TYPE>
}

export interface ComparableFragmentExpression<DB extends AnyDB, TYPE, TYPE_NAME, OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray):  ComparableValueSource<NoTableOrViewRequired<DB>, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): ComparableValueSource<T1, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): ComparableValueSource<T1 | T2, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): ComparableValueSource<T1 | T2 | T3, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): ComparableValueSource<T1 | T2 | T3 | T4, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): ComparableValueSource<T1 | T2 | T3 | T4 | T5, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>, T6 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): ComparableValueSource<T1 | T2 | T3 | T4 | T5 | T6, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>, T6 extends ITableOrViewRef<DB>, T7 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): ComparableValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: ValueSourceOf<T>[]): ComparableValueSource<T, TYPE, TYPE_NAME, OPTIONAL_TYPE>
}

export interface CustomIntFragmentExpression<DB extends AnyDB, TYPE, TYPE_NAME, OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray):  CustomIntValueSource<NoTableOrViewRequired<DB>, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): CustomIntValueSource<T1, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): CustomIntValueSource<T1 | T2, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): CustomIntValueSource<T1 | T2 | T3, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): CustomIntValueSource<T1 | T2 | T3 | T4, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): CustomIntValueSource<T1 | T2 | T3 | T4 | T5, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>, T6 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): CustomIntValueSource<T1 | T2 | T3 | T4 | T5 | T6, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>, T6 extends ITableOrViewRef<DB>, T7 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): CustomIntValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: ValueSourceOf<T>[]): CustomIntValueSource<T, TYPE, TYPE_NAME, OPTIONAL_TYPE>
}

export interface CustomDoubleFragmentExpression<DB extends AnyDB, TYPE, TYPE_NAME, OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray):  CustomDoubleValueSource<NoTableOrViewRequired<DB>, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): CustomDoubleValueSource<T1, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): CustomDoubleValueSource<T1 | T2, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): CustomDoubleValueSource<T1 | T2 | T3, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): CustomDoubleValueSource<T1 | T2 | T3 | T4, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): CustomDoubleValueSource<T1 | T2 | T3 | T4 | T5, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>, T6 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): CustomDoubleValueSource<T1 | T2 | T3 | T4 | T5 | T6, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>, T6 extends ITableOrViewRef<DB>, T7 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): CustomDoubleValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: ValueSourceOf<T>[]): CustomDoubleValueSource<T, TYPE, TYPE_NAME, OPTIONAL_TYPE>
}

export interface CustomUuidFragmentExpression<DB extends AnyDB, TYPE, TYPE_NAME, OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray):  CustomUuidValueSource<NoTableOrViewRequired<DB>, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): CustomUuidValueSource<T1, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): CustomUuidValueSource<T1 | T2, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): CustomUuidValueSource<T1 | T2 | T3, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): CustomUuidValueSource<T1 | T2 | T3 | T4, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): CustomUuidValueSource<T1 | T2 | T3 | T4 | T5, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>, T6 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): CustomUuidValueSource<T1 | T2 | T3 | T4 | T5 | T6, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>, T6 extends ITableOrViewRef<DB>, T7 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): CustomUuidValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: ValueSourceOf<T>[]): CustomUuidValueSource<T, TYPE, TYPE_NAME, OPTIONAL_TYPE>
}

export interface CustomLocalDateTimeFragmentExpression<DB extends AnyDB, TYPE, TYPE_NAME, OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray):  CustomLocalDateTimeValueSource<NoTableOrViewRequired<DB>, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): CustomLocalDateTimeValueSource<T1, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): CustomLocalDateTimeValueSource<T1 | T2, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): CustomLocalDateTimeValueSource<T1 | T2 | T3, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): CustomLocalDateTimeValueSource<T1 | T2 | T3 | T4, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): CustomLocalDateTimeValueSource<T1 | T2 | T3 | T4 | T5, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>, T6 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): CustomLocalDateTimeValueSource<T1 | T2 | T3 | T4 | T5 | T6, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>, T6 extends ITableOrViewRef<DB>, T7 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): CustomLocalDateTimeValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: ValueSourceOf<T>[]): CustomLocalDateTimeValueSource<T, TYPE, TYPE_NAME, OPTIONAL_TYPE>
}

export interface CustomLocalDateFragmentExpression<DB extends AnyDB, TYPE, TYPE_NAME, OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray):  CustomLocalDateValueSource<NoTableOrViewRequired<DB>, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): CustomLocalDateValueSource<T1, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): CustomLocalDateValueSource<T1 | T2, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): CustomLocalDateValueSource<T1 | T2 | T3, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): CustomLocalDateValueSource<T1 | T2 | T3 | T4, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): CustomLocalDateValueSource<T1 | T2 | T3 | T4 | T5, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>, T6 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): CustomLocalDateValueSource<T1 | T2 | T3 | T4 | T5 | T6, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>, T6 extends ITableOrViewRef<DB>, T7 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): CustomLocalDateValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: ValueSourceOf<T>[]): CustomLocalDateValueSource<T, TYPE, TYPE_NAME, OPTIONAL_TYPE>
}

export interface CustomLocalTimeFragmentExpression<DB extends AnyDB, TYPE, TYPE_NAME, OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray):  CustomLocalTimeValueSource<NoTableOrViewRequired<DB>, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): CustomLocalTimeValueSource<T1, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): CustomLocalTimeValueSource<T1 | T2, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): CustomLocalTimeValueSource<T1 | T2 | T3, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): CustomLocalTimeValueSource<T1 | T2 | T3 | T4, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): CustomLocalTimeValueSource<T1 | T2 | T3 | T4 | T5, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>, T6 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): CustomLocalTimeValueSource<T1 | T2 | T3 | T4 | T5 | T6, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>, T6 extends ITableOrViewRef<DB>, T7 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): CustomLocalTimeValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: ValueSourceOf<T>[]): CustomLocalTimeValueSource<T, TYPE, TYPE_NAME, OPTIONAL_TYPE>
}


export interface FragmentBuilder0<DB extends AnyDB> {
    as<RESULT extends ValueSourceOf<NoTableOrViewRequired<DB>>>(impl: () => RESULT): () => RESULT
}

export interface FragmentBuilder1<DB extends AnyDB, A1> {
    as<RESULT extends ValueSourceOf<NoTableOrViewRequired<DB>>>(impl: (a1: MapArgumentToValueSource<NoTableOrViewRequired<DB>, A1>) => RESULT): FragmentFunction1<DB, A1, RESULT>
}

export interface FragmentBuilder2<DB extends AnyDB, A1, A2> {
    as<RESULT extends ValueSourceOf<NoTableOrViewRequired<DB>>>(impl: (a1: MapArgumentToValueSource<NoTableOrViewRequired<DB>, A1>, a2: MapArgumentToValueSource<NoTableOrViewRequired<DB>, A2>) => RESULT): FragmentFunction2<DB, A1, A2, RESULT>
}

export interface FragmentBuilder3<DB extends AnyDB, A1, A2, A3> {
    as<RESULT extends ValueSourceOf<NoTableOrViewRequired<DB>>>(impl: (a1: MapArgumentToValueSource<NoTableOrViewRequired<DB>, A1>, a2: MapArgumentToValueSource<NoTableOrViewRequired<DB>, A2>, a3: MapArgumentToValueSource<NoTableOrViewRequired<DB>, A3>) => RESULT): FragmentFunction3<DB, A1, A2, A3, RESULT>
}

export interface FragmentBuilder4<DB extends AnyDB, A1, A2, A3, A4> {
    as<RESULT extends ValueSourceOf<NoTableOrViewRequired<DB>>>(impl: (a1: MapArgumentToValueSource<NoTableOrViewRequired<DB>, A1>, a2: MapArgumentToValueSource<NoTableOrViewRequired<DB>, A2>, a3: MapArgumentToValueSource<NoTableOrViewRequired<DB>, A3>, a4: MapArgumentToValueSource<NoTableOrViewRequired<DB>, A4>) => RESULT): FragmentFunction4<DB, A1, A2, A3, A4, RESULT>
}

export interface FragmentBuilder5<DB extends AnyDB, A1, A2, A3, A4, A5> {
    as<RESULT extends ValueSourceOf<NoTableOrViewRequired<DB>>>(impl: (a1: MapArgumentToValueSource<NoTableOrViewRequired<DB>, A1>, a2: MapArgumentToValueSource<NoTableOrViewRequired<DB>, A2>, a3: MapArgumentToValueSource<NoTableOrViewRequired<DB>, A3>, a4: MapArgumentToValueSource<NoTableOrViewRequired<DB>, A4>, a5: MapArgumentToValueSource<NoTableOrViewRequired<DB>, A5>) => RESULT): FragmentFunction5<DB, A1, A2, A3, A4, A5, RESULT>
}

export interface FragmentFunction1<DB extends AnyDB, A1, RESULT> {
    (a1: TypeOfArgument<A1>): RemapValueSourceType<NoTableOrViewRequired<DB>, RESULT>
    <T1 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>): RemapValueSourceType<T1, RESULT>
}

export interface FragmentFunction2<DB extends AnyDB, A1, A2, RESULT> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>): RemapValueSourceType<NoTableOrViewRequired<DB>, RESULT>
    <T1 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>): RemapValueSourceType<T1, RESULT>

    <T2 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>): RemapValueSourceType<T2, RESULT>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>): RemapValueSourceType<T1 | T2, RESULT>
}

export interface FragmentFunction3<DB extends AnyDB, A1, A2, A3, RESULT> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>): RemapValueSourceType<NoTableOrViewRequired<DB>, RESULT>
    <T1 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>): RemapValueSourceType<T1, RESULT>
    <T2 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>): RemapValueSourceType<T2, RESULT>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>): RemapValueSourceType<T1 | T2, RESULT>

    <T3 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>): RemapValueSourceType<T3, RESULT>
    <T1 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>): RemapValueSourceType<T1 | T3, RESULT>
    <T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>): RemapValueSourceType<T2 | T3, RESULT>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>): RemapValueSourceType<T1 | T2 | T3, RESULT>
}

export interface FragmentFunction4<DB extends AnyDB, A1, A2, A3, A4, RESULT> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<NoTableOrViewRequired<DB>, RESULT>
    <T1 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<T1, RESULT>
    <T2 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<T2, RESULT>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<T1 | T2, RESULT>
    <T3 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<T3, RESULT>
    <T1 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<T1 | T3, RESULT>
    <T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<T2 | T3, RESULT>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<T1 | T2 | T3, RESULT>

    <T4 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>): RemapValueSourceType<T4, RESULT>
    <T1 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>): RemapValueSourceType<T1 | T4, RESULT>
    <T2 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>): RemapValueSourceType<T2 | T4, RESULT>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>): RemapValueSourceType<T1 | T2 | T4, RESULT>
    <T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>): RemapValueSourceType<T3 | T4, RESULT>
    <T1 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>): RemapValueSourceType<T1 | T3 | T4, RESULT>
    <T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>): RemapValueSourceType<T2 | T3 | T4, RESULT>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>): RemapValueSourceType<T1 | T2 | T3 | T4, RESULT>
}

export interface FragmentFunction5<DB extends AnyDB, A1, A2, A3, A4, A5, RESULT> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<NoTableOrViewRequired<DB>, RESULT>
    <T1 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T1, RESULT>
    <T2 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T2, RESULT>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T1 | T2, RESULT>
    <T3 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T3, RESULT>
    <T1 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T1 | T3, RESULT>
    <T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T2 | T3, RESULT>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T1 | T2 | T3, RESULT>
    <T4 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T4, RESULT>
    <T1 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T1 | T4, RESULT>
    <T2 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T2 | T4, RESULT>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T1 | T2 | T4, RESULT>
    <T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T3 | T4, RESULT>
    <T1 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T1 | T3 | T4, RESULT>
    <T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T2 | T3 | T4, RESULT>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T1 | T2 | T3 | T4, RESULT>

    <T5 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: ArgForFn<T5, A5>): RemapValueSourceType<T5, RESULT>
    <T1 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: ArgForFn<T5, A5>): RemapValueSourceType<T1 | T5, RESULT>
    <T2 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: ArgForFn<T5, A5>): RemapValueSourceType<T2 | T5, RESULT>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: ArgForFn<T5, A5>): RemapValueSourceType<T1 | T2 | T5, RESULT>
    <T3 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: ArgForFn<T5, A5>): RemapValueSourceType<T3 | T5, RESULT>
    <T1 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: ArgForFn<T5, A5>): RemapValueSourceType<T1 | T3 | T5, RESULT>
    <T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: ArgForFn<T5, A5>): RemapValueSourceType<T2 | T3 | T5, RESULT>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: ArgForFn<T5, A5>): RemapValueSourceType<T1 | T2 | T3 | T5, RESULT>
    <T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>, a5: ArgForFn<T5, A5>): RemapValueSourceType<T4 | T5, RESULT>
    <T1 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>, a5: ArgForFn<T5, A5>): RemapValueSourceType<T1 | T4 | T5, RESULT>
    <T2 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>, a5: ArgForFn<T5, A5>): RemapValueSourceType<T2 | T4 | T5, RESULT>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>, a5: ArgForFn<T5, A5>): RemapValueSourceType<T1 | T2 | T4 | T5, RESULT>
    <T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>, a5: ArgForFn<T5, A5>): RemapValueSourceType<T3 | T4 | T5, RESULT>
    <T1 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>, a5: ArgForFn<T5, A5>): RemapValueSourceType<T1 | T3 | T4 | T5, RESULT>
    <T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>, a5: ArgForFn<T5, A5>): RemapValueSourceType<T2 | T3 | T4 | T5, RESULT>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>, a5: ArgForFn<T5, A5>): RemapValueSourceType<T1 | T2 | T3 | T4 | T5, RESULT>
}

export interface FragmentBuilder0IfValue<DB extends AnyDB> {
    as<RESULT extends IBooleanValueSource<NoTableOrViewRequired<DB>, any> | IIfValueSource<NoTableOrViewRequired<DB>, any>>(impl: () => RESULT): () => IfValueSource<NoTableOrViewRequired<DB>, RESULT[typeof optionalType]>
}

export interface FragmentBuilder1IfValue<DB extends AnyDB, A1> {
    as<RESULT extends IBooleanValueSource<NoTableOrViewRequired<DB>, any> | IIfValueSource<NoTableOrViewRequired<DB>, any>>(impl: (a1: ArgForBuilderIfValue<NoTableOrViewRequired<DB>, A1>) => RESULT): FragmentFunctionIfValue1<DB, A1, RESULT[typeof optionalType]>
}

export interface FragmentBuilder2IfValue<DB extends AnyDB, A1, A2> {
    as<RESULT extends IBooleanValueSource<NoTableOrViewRequired<DB>, any> | IIfValueSource<NoTableOrViewRequired<DB>, any>>(impl: (a1: ArgForBuilderIfValue<NoTableOrViewRequired<DB>, A1>, a2: ArgForBuilderIfValue<NoTableOrViewRequired<DB>, A2>) => RESULT): FragmentFunctionIfValue2<DB, A1, A2, RESULT[typeof optionalType]>
}

export interface FragmentBuilder3IfValue<DB extends AnyDB, A1, A2, A3> {
    as<RESULT extends IBooleanValueSource<NoTableOrViewRequired<DB>, any> | IIfValueSource<NoTableOrViewRequired<DB>, any>>(impl: (a1: ArgForBuilderIfValue<NoTableOrViewRequired<DB>, A1>, a2: ArgForBuilderIfValue<NoTableOrViewRequired<DB>, A2>, a3: ArgForBuilderIfValue<NoTableOrViewRequired<DB>, A3>) => RESULT): FragmentFunctionIfValue3<DB, A1, A2, A3, RESULT[typeof optionalType]>
}

export interface FragmentBuilder4IfValue<DB extends AnyDB, A1, A2, A3, A4> {
    as<RESULT extends IBooleanValueSource<NoTableOrViewRequired<DB>, any> | IIfValueSource<NoTableOrViewRequired<DB>, any>>(impl: (a1: ArgForBuilderIfValue<NoTableOrViewRequired<DB>, A1>, a2: ArgForBuilderIfValue<NoTableOrViewRequired<DB>, A2>, a3: ArgForBuilderIfValue<NoTableOrViewRequired<DB>, A3>, a4: ArgForBuilderIfValue<NoTableOrViewRequired<DB>, A4>) => RESULT): FragmentFunctionIfValue4<DB, A1, A2, A3, A4, RESULT[typeof optionalType]>
}

export interface FragmentBuilder5IfValue<DB extends AnyDB, A1, A2, A3, A4, A5> {
    as<RESULT extends BooleanValueSource<NoTableOrViewRequired<DB>, any> | IIfValueSource<NoTableOrViewRequired<DB>, any>>(impl: (a1: ArgForBuilderIfValue<NoTableOrViewRequired<DB>, A1>, a2: ArgForBuilderIfValue<NoTableOrViewRequired<DB>, A2>, a3: ArgForBuilderIfValue<NoTableOrViewRequired<DB>, A3>, a4: ArgForBuilderIfValue<NoTableOrViewRequired<DB>, A4>, a5: ArgForBuilderIfValue<NoTableOrViewRequired<DB>, A5>) => RESULT): FragmentFunctionIfValue5<DB, A1, A2, A3, A4, A5, RESULT[typeof optionalType]>
}

export interface FragmentFunctionIfValue1<DB extends AnyDB, A1, OPTIONAL_TYPE extends OptionalType> {
    (a1: TypeOfArgument<A1>): IfValueSource<NoTableOrViewRequired<DB>, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>): IfValueSource<T1, OPTIONAL_TYPE>
}

export interface FragmentFunctionIfValue2<DB extends AnyDB, A1, A2, OPTIONAL_TYPE extends OptionalType> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>): IfValueSource<NoTableOrViewRequired<DB>, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>): IfValueSource<T1, OPTIONAL_TYPE>

    <T2 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>): IfValueSource<T2, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>): IfValueSource<T1 | T2, OPTIONAL_TYPE>
}

export interface FragmentFunctionIfValue3<DB extends AnyDB, A1, A2, A3, OPTIONAL_TYPE extends OptionalType> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>): IfValueSource<NoTableOrViewRequired<DB>, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>): IfValueSource<T1, OPTIONAL_TYPE>
    <T2 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>): IfValueSource<T2, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>): IfValueSource<T1 | T2, OPTIONAL_TYPE>

    <T3 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>): IfValueSource<T3, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>): IfValueSource<T1 | T3, OPTIONAL_TYPE>
    <T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>): IfValueSource<T2 | T3, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>): IfValueSource<T1 | T2 | T3, OPTIONAL_TYPE>
}

export interface FragmentFunctionIfValue4<DB extends AnyDB, A1, A2, A3, A4, OPTIONAL_TYPE extends OptionalType> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): IfValueSource<NoTableOrViewRequired<DB>, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): IfValueSource<T1, OPTIONAL_TYPE>
    <T2 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): IfValueSource<T2, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): IfValueSource<T1 | T2, OPTIONAL_TYPE>
    <T3 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>): IfValueSource<T3, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>): IfValueSource<T1 | T3, OPTIONAL_TYPE>
    <T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>): IfValueSource<T2 | T3, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>): IfValueSource<T1 | T2 | T3, OPTIONAL_TYPE>

    <T4 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>): IfValueSource<T4, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>): IfValueSource<T1 | T4, OPTIONAL_TYPE>
    <T2 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>): IfValueSource<T2 | T4, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>): IfValueSource<T1 | T2 | T4, OPTIONAL_TYPE>
    <T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>): IfValueSource<T3 | T4, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>): IfValueSource<T1 | T3 | T4, OPTIONAL_TYPE>
    <T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>): IfValueSource<T2 | T3 | T4, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>): IfValueSource<T1 | T2 | T3 | T4, OPTIONAL_TYPE>
}

export interface FragmentFunctionIfValue5<DB extends AnyDB, A1, A2, A3, A4, A5, OPTIONAL_TYPE extends OptionalType> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<NoTableOrViewRequired<DB>, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<T1, OPTIONAL_TYPE>
    <T2 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<T2, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | T2, OPTIONAL_TYPE>
    <T3 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<T3, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | T3, OPTIONAL_TYPE>
    <T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<T2 | T3, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | T2 | T3, OPTIONAL_TYPE>
    <T4 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T4, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | T4, OPTIONAL_TYPE>
    <T2 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T2 | T4, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | T2 | T4, OPTIONAL_TYPE>
    <T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T3 | T4, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | T3 | T4, OPTIONAL_TYPE>
    <T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T2 | T3 | T4, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | T2 | T3 | T4, OPTIONAL_TYPE>

    <T5 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: ArgForFn<T5, A5>): IfValueSource<T5, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: ArgForFn<T5, A5>): IfValueSource<T1 | T5, OPTIONAL_TYPE>
    <T2 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: ArgForFn<T5, A5>): IfValueSource<T2 | T5, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: ArgForFn<T5, A5>): IfValueSource<T1 | T2 | T5, OPTIONAL_TYPE>
    <T3 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: ArgForFn<T5, A5>): IfValueSource<T3 | T5, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: ArgForFn<T5, A5>): IfValueSource<T1 | T3 | T5, OPTIONAL_TYPE>
    <T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: ArgForFn<T5, A5>): IfValueSource<T2 | T3 | T5, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: ArgForFn<T5, A5>): IfValueSource<T1 | T2 | T3 | T5, OPTIONAL_TYPE>
    <T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>, a5: ArgForFn<T5, A5>): IfValueSource<T4 | T5, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>, a5: ArgForFn<T5, A5>): IfValueSource<T1 | T4 | T5, OPTIONAL_TYPE>
    <T2 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>, a5: ArgForFn<T5, A5>): IfValueSource<T2 | T4 | T5, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: ArgForFn<T4, A4>, a5: ArgForFn<T5, A5>): IfValueSource<T1 | T2 | T4 | T5, OPTIONAL_TYPE>
    <T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>, a5: ArgForFn<T5, A5>): IfValueSource<T3 | T4 | T5, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>, a5: ArgForFn<T5, A5>): IfValueSource<T1 | T3 | T4 | T5, OPTIONAL_TYPE>
    <T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>, a5: ArgForFn<T5, A5>): IfValueSource<T2 | T3 | T4 | T5, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: ArgForFn<T1, A1>, a2: ArgForFn<T2, A2>, a3: ArgForFn<T3, A3>, a4: ArgForFn<T4, A4>, a5: ArgForFn<T5, A5>): IfValueSource<T1 | T2 | T3 | T4 | T5, OPTIONAL_TYPE>
}

export interface FragmentBuilderMaybeOptional0<DB extends AnyDB> {
    as<RESULT extends ValueSourceOf<NoTableOrViewRequired<DB>>>(impl: () => RESULT): () => RESULT
}

export interface FragmentBuilderMaybeOptional1<DB extends AnyDB, A1> {
    as<RESULT extends IValueSource<NoTableOrViewRequired<DB>, any, any, 'optional'>>(impl: (a1: MapArgumentToValueSource<NoTableOrViewRequired<DB>, A1>) => RESULT): FragmentFunctionMaybeOptional1<DB, A1, RESULT>
}

export interface FragmentBuilderMaybeOptional2<DB extends AnyDB, A1, A2> {
    as<RESULT extends IValueSource<NoTableOrViewRequired<DB>, any, any, 'optional'>>(impl: (a1: MapArgumentToValueSource<NoTableOrViewRequired<DB>, A1>, a2: MapArgumentToValueSource<NoTableOrViewRequired<DB>, A2>) => RESULT): FragmentFunctionMaybeOptional2<DB, A1, A2, RESULT>
}

export interface FragmentBuilderMaybeOptional3<DB extends AnyDB, A1, A2, A3> {
    as<RESULT extends IValueSource<NoTableOrViewRequired<DB>, any, any, 'optional'>>(impl: (a1: MapArgumentToValueSource<NoTableOrViewRequired<DB>, A1>, a2: MapArgumentToValueSource<NoTableOrViewRequired<DB>, A2>, a3: MapArgumentToValueSource<NoTableOrViewRequired<DB>, A3>) => RESULT): FragmentFunctionMaybeOptional3<DB, A1, A2, A3, RESULT>
}

export interface FragmentBuilderMaybeOptional4<DB extends AnyDB, A1, A2, A3, A4> {
    as<RESULT extends IValueSource<NoTableOrViewRequired<DB>, any, any, 'optional'>>(impl: (a1: MapArgumentToValueSource<NoTableOrViewRequired<DB>, A1>, a2: MapArgumentToValueSource<NoTableOrViewRequired<DB>, A2>, a3: MapArgumentToValueSource<NoTableOrViewRequired<DB>, A3>, a4: MapArgumentToValueSource<NoTableOrViewRequired<DB>, A4>) => RESULT): FragmentFunctionMaybeOptional4<DB, A1, A2, A3, A4, RESULT>
}

export interface FragmentBuilderMaybeOptional5<DB extends AnyDB, A1, A2, A3, A4, A5> {
    as<RESULT extends IValueSource<NoTableOrViewRequired<DB>, any, any, 'optional'>>(impl: (a1: MapArgumentToValueSource<NoTableOrViewRequired<DB>, A1>, a2: MapArgumentToValueSource<NoTableOrViewRequired<DB>, A2>, a3: MapArgumentToValueSource<NoTableOrViewRequired<DB>, A3>, a4: MapArgumentToValueSource<NoTableOrViewRequired<DB>, A4>, a5: MapArgumentToValueSource<NoTableOrViewRequired<DB>, A5>) => RESULT): FragmentFunctionMaybeOptional5<DB, A1, A2, A3, A4, A5, RESULT>
}

export interface FragmentFunctionMaybeOptional1<DB extends AnyDB, A1, RESULT> {
    <T1 extends TypeOfArgument<A1>>(a1: T1): RemapValueSourceTypeWithOptionalType<NoTableOrViewRequired<DB>, RESULT, OptionalTypeOfValue<T1>>
    <T1 extends ArgBaseTypeForFn<A1>>(a1: T1): RemapValueSourceTypeWithOptionalType<T1[typeof tableOrView], RESULT, T1[typeof optionalType]>
}

export interface FragmentFunctionMaybeOptional2<DB extends AnyDB, A1, A2, RESULT> {
    <T1 extends TypeOfArgument<A1>, T2 extends TypeOfArgument<A2>>(a1: T1, a2: T2): RemapValueSourceTypeWithOptionalType<NoTableOrViewRequired<DB>, RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | OptionalTypeOfValue<T2>>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends TypeOfArgument<A2>>(a1: T1, a2: T2): RemapValueSourceTypeWithOptionalType<T1[typeof tableOrView], RESULT, MergeOptionalUnion<T1[typeof optionalType] | OptionalTypeOfValue<T2>>>

    <T1 extends TypeOfArgument<A1>, T2 extends ArgBaseTypeForFn<A2>>(a1: T1, a2: T2): RemapValueSourceTypeWithOptionalType<T2[typeof tableOrView], RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | T2[typeof optionalType]>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends ArgBaseTypeForFn<A2>>(a1: T1, a2: T2): RemapValueSourceTypeWithOptionalType<T1[typeof tableOrView] | T2[typeof tableOrView], RESULT, MergeOptionalUnion<T1[typeof optionalType] | T2[typeof optionalType]>>
}

export interface FragmentFunctionMaybeOptional3<DB extends AnyDB, A1, A2, A3, RESULT> {
    <T1 extends TypeOfArgument<A1>, T2 extends TypeOfArgument<A2>, T3 extends TypeOfArgument<A3>>(a1: T1, a2: T2, a3: T3): RemapValueSourceTypeWithOptionalType<NoTableOrViewRequired<DB>, RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | OptionalTypeOfValue<T2> | OptionalTypeOfValue<T3>>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends TypeOfArgument<A2>, T3 extends TypeOfArgument<A3>>(a1: T1, a2: T2, a3: T3): RemapValueSourceTypeWithOptionalType<T1[typeof tableOrView], RESULT, MergeOptionalUnion<T1[typeof optionalType] | OptionalTypeOfValue<T2> | OptionalTypeOfValue<T3>>>
    <T1 extends TypeOfArgument<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends TypeOfArgument<A3>>(a1: T1, a2: T2, a3: T3): RemapValueSourceTypeWithOptionalType<T2[typeof tableOrView], RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | T2[typeof optionalType] | OptionalTypeOfValue<T3>>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends TypeOfArgument<A3>>(a1: T1, a2: T2, a3: T3): RemapValueSourceTypeWithOptionalType<T1[typeof tableOrView] | T2[typeof tableOrView], RESULT, MergeOptionalUnion<T1[typeof optionalType] | T2[typeof optionalType] | OptionalTypeOfValue<T3>>>

    <T1 extends TypeOfArgument<A1>, T2 extends TypeOfArgument<A2>, T3 extends ArgBaseTypeForFn<A3>>(a1: T1, a2: T2, a3: T3): RemapValueSourceTypeWithOptionalType<T3[typeof tableOrView], RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | OptionalTypeOfValue<T2> | T3[typeof optionalType]>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends TypeOfArgument<A2>, T3 extends ArgBaseTypeForFn<A3>>(a1: T1, a2: T2, a3: T3): RemapValueSourceTypeWithOptionalType<T1[typeof tableOrView] | T3[typeof tableOrView], RESULT, MergeOptionalUnion<T1[typeof optionalType] | OptionalTypeOfValue<T2 | T3[typeof optionalType]>>>
    <T1 extends TypeOfArgument<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends ArgBaseTypeForFn<A3>>(a1: T1, a2: T2, a3: T3): RemapValueSourceTypeWithOptionalType<T2[typeof tableOrView] | T3[typeof tableOrView], RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | T2[typeof optionalType] | T3[typeof optionalType]>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends ArgBaseTypeForFn<A3>>(a1: T1, a2: T2, a3: T3): RemapValueSourceTypeWithOptionalType<T1[typeof tableOrView] | T2[typeof tableOrView] | T3[typeof tableOrView], RESULT, MergeOptionalUnion<T1[typeof optionalType] | T2[typeof optionalType] | T3[typeof optionalType]>>
}

export interface FragmentFunctionMaybeOptional4<DB extends AnyDB, A1, A2, A3, A4, RESULT> {
    <T1 extends TypeOfArgument<A1>, T2 extends TypeOfArgument<A2>, T3 extends TypeOfArgument<A3>, T4 extends TypeOfArgument<A4>>(a1: T1, a2: T2, a3: T3, a4: T4): RemapValueSourceTypeWithOptionalType<NoTableOrViewRequired<DB>, RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | OptionalTypeOfValue<T2> | OptionalTypeOfValue<T3> | OptionalTypeOfValue<T4>>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends TypeOfArgument<A2>, T3 extends TypeOfArgument<A3>, T4 extends TypeOfArgument<A4>>(a1: T1, a2: T2, a3: T3, a4: T4): RemapValueSourceTypeWithOptionalType<T1[typeof tableOrView], RESULT, MergeOptionalUnion<T1[typeof optionalType] | OptionalTypeOfValue<T2> | OptionalTypeOfValue<T3> | OptionalTypeOfValue<T4>>>
    <T1 extends TypeOfArgument<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends TypeOfArgument<A3>, T4 extends TypeOfArgument<A4>>(a1: T1, a2: T2, a3: T3, a4: T4): RemapValueSourceTypeWithOptionalType<T2[typeof tableOrView], RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | T2[typeof optionalType] | OptionalTypeOfValue<T3> | OptionalTypeOfValue<T4>>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends TypeOfArgument<A3>, T4 extends TypeOfArgument<A4>>(a1: T1, a2: T2, a3: T3, a4: T4): RemapValueSourceTypeWithOptionalType<T1[typeof tableOrView] | T2[typeof tableOrView], RESULT, MergeOptionalUnion<T1[typeof optionalType] | T2[typeof optionalType] | OptionalTypeOfValue<T3> | OptionalTypeOfValue<T4>>>
    <T1 extends TypeOfArgument<A1>, T2 extends TypeOfArgument<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends TypeOfArgument<A4>>(a1: T1, a2: T2, a3: T3, a4: T4): RemapValueSourceTypeWithOptionalType<T3[typeof tableOrView], RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | OptionalTypeOfValue<T2> | T3[typeof optionalType] | OptionalTypeOfValue<T4>>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends TypeOfArgument<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends TypeOfArgument<A4>>(a1: T1, a2: T2, a3: T3, a4: T4): RemapValueSourceTypeWithOptionalType<T1[typeof tableOrView] | T3[typeof tableOrView], RESULT, MergeOptionalUnion<T1[typeof optionalType] | OptionalTypeOfValue<T2 | T3[typeof optionalType]> | OptionalTypeOfValue<T4>>>
    <T1 extends TypeOfArgument<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends TypeOfArgument<A4>>(a1: T1, a2: T2, a3: T3, a4: T4): RemapValueSourceTypeWithOptionalType<T2[typeof tableOrView] | T3[typeof tableOrView], RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | T2[typeof optionalType] | T3[typeof optionalType] | OptionalTypeOfValue<T4>>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends TypeOfArgument<A4>>(a1: T1, a2: T2, a3: T3, a4: T4): RemapValueSourceTypeWithOptionalType<T1[typeof tableOrView] | T2[typeof tableOrView] | T3[typeof tableOrView], RESULT, MergeOptionalUnion<T1[typeof optionalType] | T2[typeof optionalType] | T3[typeof optionalType] | OptionalTypeOfValue<T4>>>

    <T1 extends TypeOfArgument<A1>, T2 extends TypeOfArgument<A2>, T3 extends TypeOfArgument<A3>, T4 extends ArgBaseTypeForFn<A4>>(a1: T1, a2: T2, a3: T3, a4: T4): RemapValueSourceTypeWithOptionalType<T4[typeof tableOrView], RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | OptionalTypeOfValue<T2> | OptionalTypeOfValue<T3> | T4[typeof optionalType]>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends TypeOfArgument<A2>, T3 extends TypeOfArgument<A3>, T4 extends ArgBaseTypeForFn<A4>>(a1: T1, a2: T2, a3: T3, a4: T4): RemapValueSourceTypeWithOptionalType<T1[typeof tableOrView] | T4[typeof tableOrView], RESULT, MergeOptionalUnion<T1[typeof optionalType] | OptionalTypeOfValue<T2> | OptionalTypeOfValue<T3> | T4[typeof optionalType]>>
    <T1 extends TypeOfArgument<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends TypeOfArgument<A3>, T4 extends ArgBaseTypeForFn<A4>>(a1: T1, a2: T2, a3: T3, a4: T4): RemapValueSourceTypeWithOptionalType<T2[typeof tableOrView] | T4[typeof tableOrView], RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | T2[typeof optionalType] | OptionalTypeOfValue<T3> | T4[typeof optionalType]>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends TypeOfArgument<A3>, T4 extends ArgBaseTypeForFn<A4>>(a1: T1, a2: T2, a3: T3, a4: T4): RemapValueSourceTypeWithOptionalType<T1[typeof tableOrView] | T2[typeof tableOrView] | T4[typeof tableOrView], RESULT, MergeOptionalUnion<T1[typeof optionalType] | T2[typeof optionalType] | OptionalTypeOfValue<T3> | T4[typeof optionalType]>>
    <T1 extends TypeOfArgument<A1>, T2 extends TypeOfArgument<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends ArgBaseTypeForFn<A4>>(a1: T1, a2: T2, a3: T3, a4: T4): RemapValueSourceTypeWithOptionalType<T3[typeof tableOrView] | T4[typeof tableOrView], RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | OptionalTypeOfValue<T2> | T3[typeof optionalType] | T4[typeof optionalType]>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends TypeOfArgument<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends ArgBaseTypeForFn<A4>>(a1: T1, a2: T2, a3: T3, a4: T4): RemapValueSourceTypeWithOptionalType<T1[typeof tableOrView] | T3[typeof tableOrView] | T4[typeof tableOrView], RESULT, MergeOptionalUnion<T1[typeof optionalType] | OptionalTypeOfValue<T2 | T3[typeof optionalType]> | T4[typeof optionalType]>>
    <T1 extends TypeOfArgument<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends ArgBaseTypeForFn<A4>>(a1: T1, a2: T2, a3: T3, a4: T4): RemapValueSourceTypeWithOptionalType<T2[typeof tableOrView] | T3[typeof tableOrView] | T4[typeof tableOrView], RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | T2[typeof optionalType] | T3[typeof optionalType] | T4[typeof optionalType]>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends ArgBaseTypeForFn<A4>>(a1: T1, a2: T2, a3: T3, a4: T4): RemapValueSourceTypeWithOptionalType<T1[typeof tableOrView] | T2[typeof tableOrView] | T3[typeof tableOrView] | T4[typeof tableOrView], RESULT, MergeOptionalUnion<T1[typeof optionalType] | T2[typeof optionalType] | T3[typeof optionalType] | T4[typeof optionalType]>>
}

export interface FragmentFunctionMaybeOptional5<DB extends AnyDB, A1, A2, A3, A4, A5, RESULT> {
    <T1 extends TypeOfArgument<A1>, T2 extends TypeOfArgument<A2>, T3 extends TypeOfArgument<A3>, T4 extends TypeOfArgument<A4>, T5 extends TypeOfArgument<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<NoTableOrViewRequired<DB>, RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | OptionalTypeOfValue<T2> | OptionalTypeOfValue<T3> | OptionalTypeOfValue<T4> | OptionalTypeOfValue<T5>>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends TypeOfArgument<A2>, T3 extends TypeOfArgument<A3>, T4 extends TypeOfArgument<A4>, T5 extends TypeOfArgument<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T1[typeof tableOrView], RESULT, MergeOptionalUnion<T1[typeof optionalType] | OptionalTypeOfValue<T2> | OptionalTypeOfValue<T3> | OptionalTypeOfValue<T4> | OptionalTypeOfValue<T5>>>
    <T1 extends TypeOfArgument<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends TypeOfArgument<A3>, T4 extends TypeOfArgument<A4>, T5 extends TypeOfArgument<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T2[typeof tableOrView], RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | T2[typeof optionalType] | OptionalTypeOfValue<T3> | OptionalTypeOfValue<T4> | OptionalTypeOfValue<T5>>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends TypeOfArgument<A3>, T4 extends TypeOfArgument<A4>, T5 extends TypeOfArgument<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T1[typeof tableOrView] | T2[typeof tableOrView], RESULT, MergeOptionalUnion<T1[typeof optionalType] | T2[typeof optionalType] | OptionalTypeOfValue<T3> | OptionalTypeOfValue<T4> | OptionalTypeOfValue<T5>>>
    <T1 extends TypeOfArgument<A1>, T2 extends TypeOfArgument<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends TypeOfArgument<A4>, T5 extends TypeOfArgument<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T3[typeof tableOrView], RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | OptionalTypeOfValue<T2> | T3[typeof optionalType] | OptionalTypeOfValue<T4> | OptionalTypeOfValue<T5>>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends TypeOfArgument<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends TypeOfArgument<A4>, T5 extends TypeOfArgument<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T1[typeof tableOrView] | T3[typeof tableOrView], RESULT, MergeOptionalUnion<T1[typeof optionalType] | OptionalTypeOfValue<T2 | T3[typeof optionalType]> | OptionalTypeOfValue<T4> | OptionalTypeOfValue<T5>>>
    <T1 extends TypeOfArgument<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends TypeOfArgument<A4>, T5 extends TypeOfArgument<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T2[typeof tableOrView] | T3[typeof tableOrView], RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | T2[typeof optionalType] | T3[typeof optionalType] | OptionalTypeOfValue<T4> | OptionalTypeOfValue<T5>>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends TypeOfArgument<A4>, T5 extends TypeOfArgument<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T1[typeof tableOrView] | T2[typeof tableOrView] | T3[typeof tableOrView], RESULT, MergeOptionalUnion<T1[typeof optionalType] | T2[typeof optionalType] | T3[typeof optionalType] | OptionalTypeOfValue<T4> | OptionalTypeOfValue<T5>>>
    <T1 extends TypeOfArgument<A1>, T2 extends TypeOfArgument<A2>, T3 extends TypeOfArgument<A3>, T4 extends ArgBaseTypeForFn<A4>, T5 extends TypeOfArgument<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T4[typeof tableOrView], RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | OptionalTypeOfValue<T2> | OptionalTypeOfValue<T3> | T4[typeof optionalType] | OptionalTypeOfValue<T5>>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends TypeOfArgument<A2>, T3 extends TypeOfArgument<A3>, T4 extends ArgBaseTypeForFn<A4>, T5 extends TypeOfArgument<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T1[typeof tableOrView] | T4[typeof tableOrView], RESULT, MergeOptionalUnion<T1[typeof optionalType] | OptionalTypeOfValue<T2> | OptionalTypeOfValue<T3> | T4[typeof optionalType] | OptionalTypeOfValue<T5>>>
    <T1 extends TypeOfArgument<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends TypeOfArgument<A3>, T4 extends ArgBaseTypeForFn<A4>, T5 extends TypeOfArgument<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T2[typeof tableOrView] | T4[typeof tableOrView], RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | T2[typeof optionalType] | OptionalTypeOfValue<T3> | T4[typeof optionalType] | OptionalTypeOfValue<T5>>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends TypeOfArgument<A3>, T4 extends ArgBaseTypeForFn<A4>, T5 extends TypeOfArgument<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T1[typeof tableOrView] | T2[typeof tableOrView] | T4[typeof tableOrView], RESULT, MergeOptionalUnion<T1[typeof optionalType] | T2[typeof optionalType] | OptionalTypeOfValue<T3> | T4[typeof optionalType] | OptionalTypeOfValue<T5>>>
    <T1 extends TypeOfArgument<A1>, T2 extends TypeOfArgument<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends ArgBaseTypeForFn<A4>, T5 extends TypeOfArgument<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T3[typeof tableOrView] | T4[typeof tableOrView], RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | OptionalTypeOfValue<T2> | T3[typeof optionalType] | T4[typeof optionalType] | OptionalTypeOfValue<T5>>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends TypeOfArgument<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends ArgBaseTypeForFn<A4>, T5 extends TypeOfArgument<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T1[typeof tableOrView] | T3[typeof tableOrView] | T4[typeof tableOrView], RESULT, MergeOptionalUnion<T1[typeof optionalType] | OptionalTypeOfValue<T2 | T3[typeof optionalType]> | T4[typeof optionalType] | OptionalTypeOfValue<T5>>>
    <T1 extends TypeOfArgument<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends ArgBaseTypeForFn<A4>, T5 extends TypeOfArgument<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T2[typeof tableOrView] | T3[typeof tableOrView] | T4[typeof tableOrView], RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | T2[typeof optionalType] | T3[typeof optionalType] | T4[typeof optionalType] | OptionalTypeOfValue<T5>>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends ArgBaseTypeForFn<A4>, T5 extends TypeOfArgument<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T1[typeof tableOrView] | T2[typeof tableOrView] | T3[typeof tableOrView] | T4[typeof tableOrView], RESULT, MergeOptionalUnion<T1[typeof optionalType] | T2[typeof optionalType] | T3[typeof optionalType] | T4[typeof optionalType] | OptionalTypeOfValue<T5>>>

    <T1 extends TypeOfArgument<A1>, T2 extends TypeOfArgument<A2>, T3 extends TypeOfArgument<A3>, T4 extends TypeOfArgument<A4>, T5 extends ArgBaseTypeForFn<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T5[typeof tableOrView], RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | OptionalTypeOfValue<T2> | OptionalTypeOfValue<T3> | OptionalTypeOfValue<T4> | T5[typeof optionalType]>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends TypeOfArgument<A2>, T3 extends TypeOfArgument<A3>, T4 extends TypeOfArgument<A4>, T5 extends ArgBaseTypeForFn<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T1[typeof tableOrView] | T5[typeof tableOrView], RESULT, MergeOptionalUnion<T1[typeof optionalType] | OptionalTypeOfValue<T2> | OptionalTypeOfValue<T3> | OptionalTypeOfValue<T4> | T5[typeof optionalType]>>
    <T1 extends TypeOfArgument<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends TypeOfArgument<A3>, T4 extends TypeOfArgument<A4>, T5 extends ArgBaseTypeForFn<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T2[typeof tableOrView] | T5[typeof tableOrView], RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | T2[typeof optionalType] | OptionalTypeOfValue<T3> | OptionalTypeOfValue<T4> | T5[typeof optionalType]>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends TypeOfArgument<A3>, T4 extends TypeOfArgument<A4>, T5 extends ArgBaseTypeForFn<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T1[typeof tableOrView] | T2[typeof tableOrView] | T5[typeof tableOrView], RESULT, MergeOptionalUnion<T1[typeof optionalType] | T2[typeof optionalType] | OptionalTypeOfValue<T3> | OptionalTypeOfValue<T4> | T5[typeof optionalType]>>
    <T1 extends TypeOfArgument<A1>, T2 extends TypeOfArgument<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends TypeOfArgument<A4>, T5 extends ArgBaseTypeForFn<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T3[typeof tableOrView] | T5[typeof tableOrView], RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | OptionalTypeOfValue<T2> | T3[typeof optionalType] | OptionalTypeOfValue<T4> | T5[typeof optionalType]>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends TypeOfArgument<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends TypeOfArgument<A4>, T5 extends ArgBaseTypeForFn<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T1[typeof tableOrView] | T3[typeof tableOrView] | T5[typeof tableOrView], RESULT, MergeOptionalUnion<T1[typeof optionalType] | OptionalTypeOfValue<T2 | T3[typeof optionalType]> | OptionalTypeOfValue<T4> | T5[typeof optionalType]>>
    <T1 extends TypeOfArgument<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends TypeOfArgument<A4>, T5 extends ArgBaseTypeForFn<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T2[typeof tableOrView] | T3[typeof tableOrView] | T5[typeof tableOrView], RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | T2[typeof optionalType] | T3[typeof optionalType] | OptionalTypeOfValue<T4> | T5[typeof optionalType]>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends TypeOfArgument<A4>, T5 extends ArgBaseTypeForFn<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T1[typeof tableOrView] | T2[typeof tableOrView] | T3[typeof tableOrView] | T5[typeof tableOrView], RESULT, MergeOptionalUnion<T1[typeof optionalType] | T2[typeof optionalType] | T3[typeof optionalType] | OptionalTypeOfValue<T4> | T5[typeof optionalType]>>
    <T1 extends TypeOfArgument<A1>, T2 extends TypeOfArgument<A2>, T3 extends TypeOfArgument<A3>, T4 extends ArgBaseTypeForFn<A4>, T5 extends ArgBaseTypeForFn<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T4[typeof tableOrView] | T5[typeof tableOrView], RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | OptionalTypeOfValue<T2> | OptionalTypeOfValue<T3> | T4[typeof optionalType] | T5[typeof optionalType]>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends TypeOfArgument<A2>, T3 extends TypeOfArgument<A3>, T4 extends ArgBaseTypeForFn<A4>, T5 extends ArgBaseTypeForFn<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T1[typeof tableOrView] | T4[typeof tableOrView] | T5[typeof tableOrView], RESULT, MergeOptionalUnion<T1[typeof optionalType] | OptionalTypeOfValue<T2> | OptionalTypeOfValue<T3> | T4[typeof optionalType] | T5[typeof optionalType]>>
    <T1 extends TypeOfArgument<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends TypeOfArgument<A3>, T4 extends ArgBaseTypeForFn<A4>, T5 extends ArgBaseTypeForFn<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T2[typeof tableOrView] | T4[typeof tableOrView] | T5[typeof tableOrView], RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | T2[typeof optionalType] | OptionalTypeOfValue<T3> | T4[typeof optionalType] | T5[typeof optionalType]>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends TypeOfArgument<A3>, T4 extends ArgBaseTypeForFn<A4>, T5 extends ArgBaseTypeForFn<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T1[typeof tableOrView] | T2[typeof tableOrView] | T4[typeof tableOrView] | T5[typeof tableOrView], RESULT, MergeOptionalUnion<T1[typeof optionalType] | T2[typeof optionalType] | OptionalTypeOfValue<T3> | T4[typeof optionalType] | T5[typeof optionalType]>>
    <T1 extends TypeOfArgument<A1>, T2 extends TypeOfArgument<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends ArgBaseTypeForFn<A4>, T5 extends ArgBaseTypeForFn<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T3[typeof tableOrView] | T4[typeof tableOrView] | T5[typeof tableOrView], RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | OptionalTypeOfValue<T2> | T3[typeof optionalType] | T4[typeof optionalType] | T5[typeof optionalType]>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends TypeOfArgument<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends ArgBaseTypeForFn<A4>, T5 extends ArgBaseTypeForFn<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T1[typeof tableOrView] | T3[typeof tableOrView] | T4[typeof tableOrView] | T5[typeof tableOrView], RESULT, MergeOptionalUnion<T1[typeof optionalType] | OptionalTypeOfValue<T2 | T3[typeof optionalType]> | T4[typeof optionalType] | T5[typeof optionalType]>>
    <T1 extends TypeOfArgument<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends ArgBaseTypeForFn<A4>, T5 extends ArgBaseTypeForFn<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T2[typeof tableOrView] | T3[typeof tableOrView] | T4[typeof tableOrView] | T5[typeof tableOrView], RESULT, MergeOptionalUnion<OptionalTypeOfValue<T1> | T2[typeof optionalType] | T3[typeof optionalType] | T4[typeof optionalType] | T5[typeof optionalType]>>
    <T1 extends ArgBaseTypeForFn<A1>, T2 extends ArgBaseTypeForFn<A2>, T3 extends ArgBaseTypeForFn<A3>, T4 extends ArgBaseTypeForFn<A4>, T5 extends ArgBaseTypeForFn<A5>>(a1: T1, a2: T2, a3: T3, a4: T4, a5: T5): RemapValueSourceTypeWithOptionalType<T1[typeof tableOrView] | T2[typeof tableOrView] | T3[typeof tableOrView] | T4[typeof tableOrView] | T5[typeof tableOrView], RESULT, MergeOptionalUnion<T1[typeof optionalType] | T2[typeof optionalType] | T3[typeof optionalType] | T4[typeof optionalType] | T5[typeof optionalType]>>
}