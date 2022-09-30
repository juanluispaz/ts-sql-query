import type { AnyDB } from "../databases"
import type { TableOrViewRef, NoTableOrViewRequired } from "../utils/ITableOrView"
import type { BooleanValueSource, NumberValueSource, StringValueSource, DateValueSource, TimeValueSource, DateTimeValueSource, EqualableValueSource, IntValueSource, DoubleValueSource, LocalDateValueSource, LocalTimeValueSource, LocalDateTimeValueSource, TypeSafeStringValueSource, StringNumberValueSource, StringIntValueSource, StringDoubleValueSource, ComparableValueSource, MapArgumentToTypeSafe, RemapValueSourceType, TypeOfArgument, MapArgumentToTypeUnsafe, SafeArgForFn, UnsafeArgForFn, IfValueSource, SafeArgForBuilderIfValue, UnsafeArgForBuilderIfValue, IBooleanValueSource, IIfValueSource, BigintValueSource, TypeSafeBigintValueSource, OptionalType, ValueSourceOf, TypeSafeUuidValueSource, UuidValueSource } from "../expressions/values"
import { optionalType } from "../utils/symbols"

export interface BooleanFragmentExpression<DB extends AnyDB, OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray):  BooleanValueSource<NoTableOrViewRequired<DB>, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): BooleanValueSource<T1, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): BooleanValueSource<T1 | T2, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): BooleanValueSource<T1 | T2 | T3, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): BooleanValueSource<T1 | T2 | T3 | T4, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): BooleanValueSource<T1 | T2 | T3 | T4 | T5, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): BooleanValueSource<T1 | T2 | T3 | T4 | T5 | T6, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>, T7 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): BooleanValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, OPTIONAL_TYPE>
    sql<T extends TableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: ValueSourceOf<T>[]): BooleanValueSource<T, OPTIONAL_TYPE>
}

export interface StringIntFragmentExpression<DB extends AnyDB, OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray):  StringIntValueSource<NoTableOrViewRequired<DB>, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): StringIntValueSource<T1, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): StringIntValueSource<T1 | T2, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): StringIntValueSource<T1 | T2 | T3, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): StringIntValueSource<T1 | T2 | T3 | T4, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): StringIntValueSource<T1 | T2 | T3 | T4 | T5, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): StringIntValueSource<T1 | T2 | T3 | T4 | T5 | T6, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>, T7 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): StringIntValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, OPTIONAL_TYPE>
    sql<T extends TableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: ValueSourceOf<T>[]): StringIntValueSource<T, OPTIONAL_TYPE>
}

export interface StringNumberFragmentExpression<DB extends AnyDB, OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray):  StringNumberValueSource<NoTableOrViewRequired<DB>, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): StringNumberValueSource<T1, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): StringNumberValueSource<T1 | T2, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): StringNumberValueSource<T1 | T2 | T3, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): StringNumberValueSource<T1 | T2 | T3 | T4, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): StringNumberValueSource<T1 | T2 | T3 | T4 | T5, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): StringNumberValueSource<T1 | T2 | T3 | T4 | T5 | T6, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>, T7 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): StringNumberValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, OPTIONAL_TYPE>
    sql<T extends TableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: ValueSourceOf<T>[]): StringNumberValueSource<T, OPTIONAL_TYPE>
}

export interface IntFragmentExpression<DB extends AnyDB, OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray):  IntValueSource<NoTableOrViewRequired<DB>, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): IntValueSource<T1, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): IntValueSource<T1 | T2, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): IntValueSource<T1 | T2 | T3, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): IntValueSource<T1 | T2 | T3 | T4, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): IntValueSource<T1 | T2 | T3 | T4 | T5, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): IntValueSource<T1 | T2 | T3 | T4 | T5 | T6, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>, T7 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): IntValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, OPTIONAL_TYPE>
    sql<T extends TableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: ValueSourceOf<T>[]): IntValueSource<T, OPTIONAL_TYPE>
}

export interface NumberFragmentExpression<DB extends AnyDB, OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray):  NumberValueSource<NoTableOrViewRequired<DB>, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): NumberValueSource<T1, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): NumberValueSource<T1 | T2, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): NumberValueSource<T1 | T2 | T3, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): NumberValueSource<T1 | T2 | T3 | T4, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): NumberValueSource<T1 | T2 | T3 | T4 | T5, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): NumberValueSource<T1 | T2 | T3 | T4 | T5 | T6, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>, T7 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): NumberValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, OPTIONAL_TYPE>
    sql<T extends TableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: ValueSourceOf<T>[]): NumberValueSource<T, OPTIONAL_TYPE>
}

export interface BigintFragmentExpression<DB extends AnyDB, OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray):  BigintValueSource<NoTableOrViewRequired<DB>, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): BigintValueSource<T1, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): BigintValueSource<T1 | T2, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): BigintValueSource<T1 | T2 | T3, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): BigintValueSource<T1 | T2 | T3 | T4, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): BigintValueSource<T1 | T2 | T3 | T4 | T5, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): BigintValueSource<T1 | T2 | T3 | T4 | T5 | T6, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>, T7 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): BigintValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, OPTIONAL_TYPE>
    sql<T extends TableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: ValueSourceOf<T>[]): NumberValueSource<T, OPTIONAL_TYPE>
}

export interface TypeSafeBigintFragmentExpression<DB extends AnyDB, OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray):  TypeSafeBigintValueSource<NoTableOrViewRequired<DB>, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): TypeSafeBigintValueSource<T1, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): TypeSafeBigintValueSource<T1 | T2, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): TypeSafeBigintValueSource<T1 | T2 | T3, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): TypeSafeBigintValueSource<T1 | T2 | T3 | T4, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): TypeSafeBigintValueSource<T1 | T2 | T3 | T4 | T5, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): TypeSafeBigintValueSource<T1 | T2 | T3 | T4 | T5 | T6, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>, T7 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): TypeSafeBigintValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, OPTIONAL_TYPE>
    sql<T extends TableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: ValueSourceOf<T>[]): NumberValueSource<T, OPTIONAL_TYPE>
}

export interface StringDoubleFragmentExpression<DB extends AnyDB, OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray):  StringDoubleValueSource<NoTableOrViewRequired<DB>, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): StringDoubleValueSource<T1, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): StringDoubleValueSource<T1 | T2, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): StringDoubleValueSource<T1 | T2 | T3, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): StringDoubleValueSource<T1 | T2 | T3 | T4, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): StringDoubleValueSource<T1 | T2 | T3 | T4 | T5, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): StringDoubleValueSource<T1 | T2 | T3 | T4 | T5 | T6, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>, T7 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): StringDoubleValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, OPTIONAL_TYPE>
    sql<T extends TableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: ValueSourceOf<T>[]): StringDoubleValueSource<T, OPTIONAL_TYPE>
}

export interface DoubleFragmentExpression<DB extends AnyDB, OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray):  DoubleValueSource<NoTableOrViewRequired<DB>, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): DoubleValueSource<T1, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): DoubleValueSource<T1 | T2, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): DoubleValueSource<T1 | T2 | T3, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): DoubleValueSource<T1 | T2 | T3 | T4, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): DoubleValueSource<T1 | T2 | T3 | T4 | T5, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): DoubleValueSource<T1 | T2 | T3 | T4 | T5 | T6, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>, T7 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): DoubleValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, OPTIONAL_TYPE>
    sql<T extends TableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: ValueSourceOf<T>[]): DoubleValueSource<T, OPTIONAL_TYPE>
}

export interface TypeSafeStringFragmentExpression<DB extends AnyDB, OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray):  TypeSafeStringValueSource<NoTableOrViewRequired<DB>, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): TypeSafeStringValueSource<T1, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): TypeSafeStringValueSource<T1 | T2, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): TypeSafeStringValueSource<T1 | T2 | T3, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): TypeSafeStringValueSource<T1 | T2 | T3 | T4, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): TypeSafeStringValueSource<T1 | T2 | T3 | T4 | T5, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): TypeSafeStringValueSource<T1 | T2 | T3 | T4 | T5 | T6, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>, T7 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): TypeSafeStringValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, OPTIONAL_TYPE>
    sql<T extends TableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: ValueSourceOf<T>[]): TypeSafeStringValueSource<T, OPTIONAL_TYPE>
}

export interface StringFragmentExpression<DB extends AnyDB, OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray):  StringValueSource<NoTableOrViewRequired<DB>, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): StringValueSource<T1, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): StringValueSource<T1 | T2, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): StringValueSource<T1 | T2 | T3, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): StringValueSource<T1 | T2 | T3 | T4, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): StringValueSource<T1 | T2 | T3 | T4 | T5, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): StringValueSource<T1 | T2 | T3 | T4 | T5 | T6, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>, T7 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): StringValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, OPTIONAL_TYPE>
    sql<T extends TableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: ValueSourceOf<T>[]): StringValueSource<T, OPTIONAL_TYPE>
}

export interface TypeSafeUuidFragmentExpression<DB extends AnyDB, OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray):  TypeSafeUuidValueSource<NoTableOrViewRequired<DB>, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): TypeSafeUuidValueSource<T1, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): TypeSafeUuidValueSource<T1 | T2, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): TypeSafeUuidValueSource<T1 | T2 | T3, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): TypeSafeUuidValueSource<T1 | T2 | T3 | T4, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): TypeSafeUuidValueSource<T1 | T2 | T3 | T4 | T5, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): TypeSafeUuidValueSource<T1 | T2 | T3 | T4 | T5 | T6, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>, T7 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): TypeSafeUuidValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, OPTIONAL_TYPE>
    sql<T extends TableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: ValueSourceOf<T>[]): TypeSafeUuidValueSource<T, OPTIONAL_TYPE>
}

export interface UuidFragmentExpression<DB extends AnyDB, OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray):  UuidValueSource<NoTableOrViewRequired<DB>, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): UuidValueSource<T1, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): UuidValueSource<T1 | T2, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): UuidValueSource<T1 | T2 | T3, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): UuidValueSource<T1 | T2 | T3 | T4, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): UuidValueSource<T1 | T2 | T3 | T4 | T5, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): UuidValueSource<T1 | T2 | T3 | T4 | T5 | T6, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>, T7 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): UuidValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, OPTIONAL_TYPE>
    sql<T extends TableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: ValueSourceOf<T>[]): UuidValueSource<T, OPTIONAL_TYPE>
}

export interface LocalDateFragmentExpression<DB extends AnyDB, OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray):  LocalDateValueSource<NoTableOrViewRequired<DB>, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): LocalDateValueSource<T1, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): LocalDateValueSource<T1 | T2, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): LocalDateValueSource<T1 | T2 | T3, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): LocalDateValueSource<T1 | T2 | T3 | T4, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): LocalDateValueSource<T1 | T2 | T3 | T4 | T5, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): LocalDateValueSource<T1 | T2 | T3 | T4 | T5 | T6, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>, T7 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): LocalDateValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, OPTIONAL_TYPE>
    sql<T extends TableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: ValueSourceOf<T>[]): LocalDateValueSource<T, OPTIONAL_TYPE>
}

export interface DateFragmentExpression<DB extends AnyDB, OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray):  DateValueSource<NoTableOrViewRequired<DB>, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): DateValueSource<T1, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): DateValueSource<T1 | T2, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): DateValueSource<T1 | T2 | T3, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): DateValueSource<T1 | T2 | T3 | T4, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): DateValueSource<T1 | T2 | T3 | T4 | T5, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): DateValueSource<T1 | T2 | T3 | T4 | T5 | T6, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>, T7 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): DateValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, OPTIONAL_TYPE>
    sql<T extends TableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: ValueSourceOf<T>[]): DateValueSource<T, OPTIONAL_TYPE>
}

export interface LocalTimeFragmentExpression<DB extends AnyDB, OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray):  LocalTimeValueSource<NoTableOrViewRequired<DB>, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): LocalTimeValueSource<T1, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): LocalTimeValueSource<T1 | T2, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): LocalTimeValueSource<T1 | T2 | T3, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): LocalTimeValueSource<T1 | T2 | T3 | T4, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): LocalTimeValueSource<T1 | T2 | T3 | T4 | T5, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): LocalTimeValueSource<T1 | T2 | T3 | T4 | T5 | T6, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>, T7 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): LocalTimeValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, OPTIONAL_TYPE>
    sql<T extends TableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: ValueSourceOf<T>[]): LocalTimeValueSource<T, OPTIONAL_TYPE>
}

export interface TimeFragmentExpression<DB extends AnyDB, OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray):  TimeValueSource<NoTableOrViewRequired<DB>, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): TimeValueSource<T1, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): TimeValueSource<T1 | T2, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): TimeValueSource<T1 | T2 | T3, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): TimeValueSource<T1 | T2 | T3 | T4, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): TimeValueSource<T1 | T2 | T3 | T4 | T5, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): TimeValueSource<T1 | T2 | T3 | T4 | T5 | T6, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>, T7 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): TimeValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, OPTIONAL_TYPE>
    sql<T extends TableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: ValueSourceOf<T>[]): TimeValueSource<T, OPTIONAL_TYPE>
}

export interface LocalDateTimeFragmentExpression<DB extends AnyDB, OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray):  LocalDateTimeValueSource<NoTableOrViewRequired<DB>, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): LocalDateTimeValueSource<T1, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): LocalDateTimeValueSource<T1 | T2, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): LocalDateTimeValueSource<T1 | T2 | T3, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): LocalDateTimeValueSource<T1 | T2 | T3 | T4, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): LocalDateTimeValueSource<T1 | T2 | T3 | T4 | T5, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): LocalDateTimeValueSource<T1 | T2 | T3 | T4 | T5 | T6, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>, T7 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): LocalDateTimeValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, OPTIONAL_TYPE>
    sql<T extends TableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: ValueSourceOf<T>[]): LocalDateTimeValueSource<T, OPTIONAL_TYPE>
}

export interface DateTimeFragmentExpression<DB extends AnyDB, OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray):  DateTimeValueSource<NoTableOrViewRequired<DB>, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): DateTimeValueSource<T1, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): DateTimeValueSource<T1 | T2, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): DateTimeValueSource<T1 | T2 | T3, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): DateTimeValueSource<T1 | T2 | T3 | T4, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): DateTimeValueSource<T1 | T2 | T3 | T4 | T5, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): DateTimeValueSource<T1 | T2 | T3 | T4 | T5 | T6, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>, T7 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): DateTimeValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, OPTIONAL_TYPE>
    sql<T extends TableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: ValueSourceOf<T>[]): DateTimeValueSource<T, OPTIONAL_TYPE>
}

export interface EqualableFragmentExpression<DB extends AnyDB, TYPE, TYPE_NAME, OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray):  EqualableValueSource<NoTableOrViewRequired<DB>, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): EqualableValueSource<T1, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): EqualableValueSource<T1 | T2, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): EqualableValueSource<T1 | T2 | T3, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): EqualableValueSource<T1 | T2 | T3 | T4, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): EqualableValueSource<T1 | T2 | T3 | T4 | T5, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): EqualableValueSource<T1 | T2 | T3 | T4 | T5 | T6, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>, T7 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): EqualableValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T extends TableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: ValueSourceOf<T>[]): EqualableValueSource<T, TYPE, TYPE_NAME, OPTIONAL_TYPE>
}

export interface ComparableFragmentExpression<DB extends AnyDB, TYPE, TYPE_NAME, OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray):  ComparableValueSource<NoTableOrViewRequired<DB>, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): ComparableValueSource<T1, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): ComparableValueSource<T1 | T2, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): ComparableValueSource<T1 | T2 | T3, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): ComparableValueSource<T1 | T2 | T3 | T4, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): ComparableValueSource<T1 | T2 | T3 | T4 | T5, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): ComparableValueSource<T1 | T2 | T3 | T4 | T5 | T6, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>, T7 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): ComparableValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sql<T extends TableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: ValueSourceOf<T>[]): ComparableValueSource<T, TYPE, TYPE_NAME, OPTIONAL_TYPE>
}

export interface FragmentBuilder0<DB extends AnyDB> {
    as<RESULT extends ValueSourceOf<NoTableOrViewRequired<DB>>>(impl: () => RESULT): () => RESULT
}

export interface FragmentBuilder1TypeSafe<DB extends AnyDB, A1> {
    as<RESULT extends ValueSourceOf<NoTableOrViewRequired<DB>>>(impl: (a1: MapArgumentToTypeSafe<NoTableOrViewRequired<DB>, A1>) => RESULT): FragmentFunction1TypeSafe<DB, A1, RESULT>
}

export interface FragmentBuilder2TypeSafe<DB extends AnyDB, A1, A2> {
    as<RESULT extends ValueSourceOf<NoTableOrViewRequired<DB>>>(impl: (a1: MapArgumentToTypeSafe<NoTableOrViewRequired<DB>, A1>, a2: MapArgumentToTypeSafe<NoTableOrViewRequired<DB>, A2>) => RESULT): FragmentFunction2TypeSafe<DB, A1, A2, RESULT>
}

export interface FragmentBuilder3TypeSafe<DB extends AnyDB, A1, A2, A3> {
    as<RESULT extends ValueSourceOf<NoTableOrViewRequired<DB>>>(impl: (a1: MapArgumentToTypeSafe<NoTableOrViewRequired<DB>, A1>, a2: MapArgumentToTypeSafe<NoTableOrViewRequired<DB>, A2>, a3: MapArgumentToTypeSafe<NoTableOrViewRequired<DB>, A3>) => RESULT): FragmentFunction3TypeSafe<DB, A1, A2, A3, RESULT>
}

export interface FragmentBuilder4TypeSafe<DB extends AnyDB, A1, A2, A3, A4> {
    as<RESULT extends ValueSourceOf<NoTableOrViewRequired<DB>>>(impl: (a1: MapArgumentToTypeSafe<NoTableOrViewRequired<DB>, A1>, a2: MapArgumentToTypeSafe<NoTableOrViewRequired<DB>, A2>, a3: MapArgumentToTypeSafe<NoTableOrViewRequired<DB>, A3>, a4: MapArgumentToTypeSafe<NoTableOrViewRequired<DB>, A4>) => RESULT): FragmentFunction4TypeSafe<DB, A1, A2, A3, A4, RESULT>
}

export interface FragmentBuilder5TypeSafe<DB extends AnyDB, A1, A2, A3, A4, A5> {
    as<RESULT extends ValueSourceOf<NoTableOrViewRequired<DB>>>(impl: (a1: MapArgumentToTypeSafe<NoTableOrViewRequired<DB>, A1>, a2: MapArgumentToTypeSafe<NoTableOrViewRequired<DB>, A2>, a3: MapArgumentToTypeSafe<NoTableOrViewRequired<DB>, A3>, a4: MapArgumentToTypeSafe<NoTableOrViewRequired<DB>, A4>, a5: MapArgumentToTypeSafe<NoTableOrViewRequired<DB>, A5>) => RESULT): FragmentFunction5TypeSafe<DB, A1, A2, A3, A4, A5, RESULT>
}

export interface FragmentBuilder1TypeUnsafe<DB extends AnyDB, A1> {
    as<RESULT extends ValueSourceOf<NoTableOrViewRequired<DB>>>(impl: (a1: MapArgumentToTypeUnsafe<NoTableOrViewRequired<DB>, A1>) => RESULT): FragmentFunction1TypeUnsafe<DB, A1, RESULT>
}

export interface FragmentBuilder2TypeUnsafe<DB extends AnyDB, A1, A2> {
    as<RESULT extends ValueSourceOf<NoTableOrViewRequired<DB>>>(impl: (a1: MapArgumentToTypeUnsafe<NoTableOrViewRequired<DB>, A1>, a2: MapArgumentToTypeUnsafe<NoTableOrViewRequired<DB>, A2>) => RESULT): FragmentFunction2TypeUnsafe<DB, A1, A2, RESULT>
}

export interface FragmentBuilder3TypeUnsafe<DB extends AnyDB, A1, A2, A3> {
    as<RESULT extends ValueSourceOf<NoTableOrViewRequired<DB>>>(impl: (a1: MapArgumentToTypeUnsafe<NoTableOrViewRequired<DB>, A1>, a2: MapArgumentToTypeUnsafe<NoTableOrViewRequired<DB>, A2>, a3: MapArgumentToTypeUnsafe<NoTableOrViewRequired<DB>, A3>) => RESULT): FragmentFunction3TypeUnsafe<DB, A1, A2, A3, RESULT>
}

export interface FragmentBuilder4TypeUnsafe<DB extends AnyDB, A1, A2, A3, A4> {
    as<RESULT extends ValueSourceOf<NoTableOrViewRequired<DB>>>(impl: (a1: MapArgumentToTypeUnsafe<NoTableOrViewRequired<DB>, A1>, a2: MapArgumentToTypeUnsafe<NoTableOrViewRequired<DB>, A2>, a3: MapArgumentToTypeUnsafe<NoTableOrViewRequired<DB>, A3>, a4: MapArgumentToTypeUnsafe<NoTableOrViewRequired<DB>, A4>) => RESULT): FragmentFunction4TypeUnsafe<DB, A1, A2, A3, A4, RESULT>
}

export interface FragmentBuilder5TypeUnsafe<DB extends AnyDB, A1, A2, A3, A4, A5> {
    as<RESULT extends ValueSourceOf<NoTableOrViewRequired<DB>>>(impl: (a1: MapArgumentToTypeUnsafe<NoTableOrViewRequired<DB>, A1>, a2: MapArgumentToTypeUnsafe<NoTableOrViewRequired<DB>, A2>, a3: MapArgumentToTypeUnsafe<NoTableOrViewRequired<DB>, A3>, a4: MapArgumentToTypeUnsafe<NoTableOrViewRequired<DB>, A4>, a5: MapArgumentToTypeUnsafe<NoTableOrViewRequired<DB>, A5>) => RESULT): FragmentFunction5TypeUnsafe<DB, A1, A2, A3, A4, A5, RESULT>
}

export interface FragmentFunction1TypeSafe<DB extends AnyDB, A1, RESULT> {
    (a1: TypeOfArgument<A1>): RemapValueSourceType<NoTableOrViewRequired<DB>, RESULT>
    <T1 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>): RemapValueSourceType<T1, RESULT>
}

export interface FragmentFunction2TypeSafe<DB extends AnyDB, A1, A2, RESULT> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>): RemapValueSourceType<NoTableOrViewRequired<DB>, RESULT>
    <T1 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>): RemapValueSourceType<T1, RESULT>

    <T2 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: SafeArgForFn<T2, A2>): RemapValueSourceType<T2, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: SafeArgForFn<T2, A2>): RemapValueSourceType<T1 | T2, RESULT>
}

export interface FragmentFunction3TypeSafe<DB extends AnyDB, A1, A2, A3, RESULT> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>): RemapValueSourceType<NoTableOrViewRequired<DB>, RESULT>
    <T1 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>): RemapValueSourceType<T1, RESULT>
    <T2 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: SafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>): RemapValueSourceType<T2, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: SafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>): RemapValueSourceType<T1 | T2, RESULT>

    <T3 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: SafeArgForFn<T3, A3>): RemapValueSourceType<T3, RESULT>
    <T1 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: SafeArgForFn<T3, A3>): RemapValueSourceType<T1 | T3, RESULT>
    <T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: SafeArgForFn<T2, A2>, a3: SafeArgForFn<T3, A3>): RemapValueSourceType<T2 | T3, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: SafeArgForFn<T2, A2>, a3: SafeArgForFn<T3, A3>): RemapValueSourceType<T1 | T2 | T3, RESULT>
}

export interface FragmentFunction4TypeSafe<DB extends AnyDB, A1, A2, A3, A4, RESULT> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<NoTableOrViewRequired<DB>, RESULT>
    <T1 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<T1, RESULT>
    <T2 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: SafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<T2, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: SafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<T1 | T2, RESULT>
    <T3 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: SafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<T3, RESULT>
    <T1 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: SafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<T1 | T3, RESULT>
    <T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: SafeArgForFn<T2, A2>, a3: SafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<T2 | T3, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: SafeArgForFn<T2, A2>, a3: SafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<T1 | T2 | T3, RESULT>

    <T4 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: SafeArgForFn<T4, A4>): RemapValueSourceType<T4, RESULT>
    <T1 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: SafeArgForFn<T4, A4>): RemapValueSourceType<T1 | T4, RESULT>
    <T2 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: SafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: SafeArgForFn<T4, A4>): RemapValueSourceType<T2 | T4, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: SafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: SafeArgForFn<T4, A4>): RemapValueSourceType<T1 | T2 | T4, RESULT>
    <T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: SafeArgForFn<T3, A3>, a4: SafeArgForFn<T4, A4>): RemapValueSourceType<T3 | T4, RESULT>
    <T1 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: SafeArgForFn<T3, A3>, a4: SafeArgForFn<T4, A4>): RemapValueSourceType<T1 | T3 | T4, RESULT>
    <T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: SafeArgForFn<T2, A2>, a3: SafeArgForFn<T3, A3>, a4: SafeArgForFn<T4, A4>): RemapValueSourceType<T2 | T3 | T4, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: SafeArgForFn<T2, A2>, a3: SafeArgForFn<T3, A3>, a4: SafeArgForFn<T4, A4>): RemapValueSourceType<T1 | T2 | T3 | T4, RESULT>
}

export interface FragmentFunction5TypeSafe<DB extends AnyDB, A1, A2, A3, A4, A5, RESULT> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<NoTableOrViewRequired<DB>, RESULT>
    <T1 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T1, RESULT>
    <T2 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: SafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T2, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: SafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T1 | T2, RESULT>
    <T3 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: SafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T3, RESULT>
    <T1 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: SafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T1 | T3, RESULT>
    <T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: SafeArgForFn<T2, A2>, a3: SafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T2 | T3, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: SafeArgForFn<T2, A2>, a3: SafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T1 | T2 | T3, RESULT>
    <T4 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: SafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T4, RESULT>
    <T1 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: SafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T1 | T4, RESULT>
    <T2 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: SafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: SafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T2 | T4, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: SafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: SafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T1 | T2 | T4, RESULT>
    <T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: SafeArgForFn<T3, A3>, a4: SafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T3 | T4, RESULT>
    <T1 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: SafeArgForFn<T3, A3>, a4: SafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T1 | T3 | T4, RESULT>
    <T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: SafeArgForFn<T2, A2>, a3: SafeArgForFn<T3, A3>, a4: SafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T2 | T3 | T4, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: SafeArgForFn<T2, A2>, a3: SafeArgForFn<T3, A3>, a4: SafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T1 | T2 | T3 | T4, RESULT>

    <T5 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: SafeArgForFn<T5, A5>): RemapValueSourceType<T5, RESULT>
    <T1 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: SafeArgForFn<T5, A5>): RemapValueSourceType<T1 | T5, RESULT>
    <T2 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: SafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: SafeArgForFn<T5, A5>): RemapValueSourceType<T2 | T5, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: SafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: SafeArgForFn<T5, A5>): RemapValueSourceType<T1 | T2 | T5, RESULT>
    <T3 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: SafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: SafeArgForFn<T5, A5>): RemapValueSourceType<T3 | T5, RESULT>
    <T1 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: SafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: SafeArgForFn<T5, A5>): RemapValueSourceType<T1 | T3 | T5, RESULT>
    <T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: SafeArgForFn<T2, A2>, a3: SafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: SafeArgForFn<T5, A5>): RemapValueSourceType<T2 | T3 | T5, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: SafeArgForFn<T2, A2>, a3: SafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: SafeArgForFn<T5, A5>): RemapValueSourceType<T1 | T2 | T3 | T5, RESULT>
    <T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: SafeArgForFn<T4, A4>, a5: SafeArgForFn<T5, A5>): RemapValueSourceType<T4 | T5, RESULT>
    <T1 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: SafeArgForFn<T4, A4>, a5: SafeArgForFn<T5, A5>): RemapValueSourceType<T1 | T4 | T5, RESULT>
    <T2 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: SafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: SafeArgForFn<T4, A4>, a5: SafeArgForFn<T5, A5>): RemapValueSourceType<T2 | T4 | T5, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: SafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: SafeArgForFn<T4, A4>, a5: SafeArgForFn<T5, A5>): RemapValueSourceType<T1 | T2 | T4 | T5, RESULT>
    <T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: SafeArgForFn<T3, A3>, a4: SafeArgForFn<T4, A4>, a5: SafeArgForFn<T5, A5>): RemapValueSourceType<T3 | T4 | T5, RESULT>
    <T1 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: SafeArgForFn<T3, A3>, a4: SafeArgForFn<T4, A4>, a5: SafeArgForFn<T5, A5>): RemapValueSourceType<T1 | T3 | T4 | T5, RESULT>
    <T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: SafeArgForFn<T2, A2>, a3: SafeArgForFn<T3, A3>, a4: SafeArgForFn<T4, A4>, a5: SafeArgForFn<T5, A5>): RemapValueSourceType<T2 | T3 | T4 | T5, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: SafeArgForFn<T2, A2>, a3: SafeArgForFn<T3, A3>, a4: SafeArgForFn<T4, A4>, a5: SafeArgForFn<T5, A5>): RemapValueSourceType<T1 | T2 | T3 | T4 | T5, RESULT>
}

export interface FragmentFunction1TypeUnsafe<DB extends AnyDB, A1, RESULT> {
    (a1: TypeOfArgument<A1>): RemapValueSourceType<NoTableOrViewRequired<DB>, RESULT>
    <T1 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>): RemapValueSourceType<T1, RESULT>
}

export interface FragmentFunction2TypeUnsafe<DB extends AnyDB, A1, A2, RESULT> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>): RemapValueSourceType<NoTableOrViewRequired<DB>, RESULT>
    <T1 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>): RemapValueSourceType<T1, RESULT>

    <T2 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>): RemapValueSourceType<T2, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>): RemapValueSourceType<T1 | T2, RESULT>
}

export interface FragmentFunction3TypeUnsafe<DB extends AnyDB, A1, A2, A3, RESULT> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>): RemapValueSourceType<NoTableOrViewRequired<DB>, RESULT>
    <T1 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>): RemapValueSourceType<T1, RESULT>
    <T2 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>): RemapValueSourceType<T2, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>): RemapValueSourceType<T1 | T2, RESULT>

    <T3 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>): RemapValueSourceType<T3, RESULT>
    <T1 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>): RemapValueSourceType<T1 | T3, RESULT>
    <T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>): RemapValueSourceType<T2 | T3, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>): RemapValueSourceType<T1 | T2 | T3, RESULT>
}

export interface FragmentFunction4TypeUnsafe<DB extends AnyDB, A1, A2, A3, A4, RESULT> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<NoTableOrViewRequired<DB>, RESULT>
    <T1 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<T1, RESULT>
    <T2 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<T2, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<T1 | T2, RESULT>
    <T3 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<T3, RESULT>
    <T1 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<T1 | T3, RESULT>
    <T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<T2 | T3, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<T1 | T2 | T3, RESULT>

    <T4 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>): RemapValueSourceType<T4, RESULT>
    <T1 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>): RemapValueSourceType<T1 | T4, RESULT>
    <T2 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>): RemapValueSourceType<T2 | T4, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>): RemapValueSourceType<T1 | T2 | T4, RESULT>
    <T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>): RemapValueSourceType<T3 | T4, RESULT>
    <T1 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>): RemapValueSourceType<T1 | T3 | T4, RESULT>
    <T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>): RemapValueSourceType<T2 | T3 | T4, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>): RemapValueSourceType<T1 | T2 | T3 | T4, RESULT>
}

export interface FragmentFunction5TypeUnsafe<DB extends AnyDB, A1, A2, A3, A4, A5, RESULT> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<NoTableOrViewRequired<DB>, RESULT>
    <T1 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T1, RESULT>
    <T2 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T2, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T1 | T2, RESULT>
    <T3 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T3, RESULT>
    <T1 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T1 | T3, RESULT>
    <T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T2 | T3, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T1 | T2 | T3, RESULT>
    <T4 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T4, RESULT>
    <T1 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T1 | T4, RESULT>
    <T2 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T2 | T4, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T1 | T2 | T4, RESULT>
    <T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T3 | T4, RESULT>
    <T1 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T1 | T3 | T4, RESULT>
    <T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T2 | T3 | T4, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T1 | T2 | T3 | T4, RESULT>

    <T5 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: UnsafeArgForFn<T5, A5>): RemapValueSourceType<T5, RESULT>
    <T1 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: UnsafeArgForFn<T5, A5>): RemapValueSourceType<T1 | T5, RESULT>
    <T2 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: UnsafeArgForFn<T5, A5>): RemapValueSourceType<T2 | T5, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: UnsafeArgForFn<T5, A5>): RemapValueSourceType<T1 | T2 | T5, RESULT>
    <T3 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: UnsafeArgForFn<T5, A5>): RemapValueSourceType<T3 | T5, RESULT>
    <T1 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: UnsafeArgForFn<T5, A5>): RemapValueSourceType<T1 | T3 | T5, RESULT>
    <T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: UnsafeArgForFn<T5, A5>): RemapValueSourceType<T2 | T3 | T5, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: UnsafeArgForFn<T5, A5>): RemapValueSourceType<T1 | T2 | T3 | T5, RESULT>
    <T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>, a5: UnsafeArgForFn<T5, A5>): RemapValueSourceType<T4 | T5, RESULT>
    <T1 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>, a5: UnsafeArgForFn<T5, A5>): RemapValueSourceType<T1 | T4 | T5, RESULT>
    <T2 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>, a5: UnsafeArgForFn<T5, A5>): RemapValueSourceType<T2 | T4 | T5, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>, a5: UnsafeArgForFn<T5, A5>): RemapValueSourceType<T1 | T2 | T4 | T5, RESULT>
    <T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>, a5: UnsafeArgForFn<T5, A5>): RemapValueSourceType<T3 | T4 | T5, RESULT>
    <T1 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>, a5: UnsafeArgForFn<T5, A5>): RemapValueSourceType<T1 | T3 | T4 | T5, RESULT>
    <T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>, a5: UnsafeArgForFn<T5, A5>): RemapValueSourceType<T2 | T3 | T4 | T5, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>, a5: UnsafeArgForFn<T5, A5>): RemapValueSourceType<T1 | T2 | T3 | T4 | T5, RESULT>
}

export interface FragmentBuilder0IfValue<DB extends AnyDB> {
    as<RESULT extends IBooleanValueSource<NoTableOrViewRequired<DB>, any> | IIfValueSource<NoTableOrViewRequired<DB>, any>>(impl: () => RESULT): () => IfValueSource<NoTableOrViewRequired<DB>, RESULT[typeof optionalType]>
}

export interface FragmentBuilder1IfValueTypeSafe<DB extends AnyDB, A1> {
    as<RESULT extends IBooleanValueSource<NoTableOrViewRequired<DB>, any> | IIfValueSource<NoTableOrViewRequired<DB>, any>>(impl: (a1: SafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A1>) => RESULT): FragmentFunctionIfValue1TypeSafe<DB, A1, RESULT[typeof optionalType]>
}

export interface FragmentBuilder2IfValueTypeSafe<DB extends AnyDB, A1, A2> {
    as<RESULT extends IBooleanValueSource<NoTableOrViewRequired<DB>, any> | IIfValueSource<NoTableOrViewRequired<DB>, any>>(impl: (a1: SafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A1>, a2: SafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A2>) => RESULT): FragmentFunctionIfValue2TypeSafe<DB, A1, A2, RESULT[typeof optionalType]>
}

export interface FragmentBuilder3IfValueTypeSafe<DB extends AnyDB, A1, A2, A3> {
    as<RESULT extends IBooleanValueSource<NoTableOrViewRequired<DB>, any> | IIfValueSource<NoTableOrViewRequired<DB>, any>>(impl: (a1: SafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A1>, a2: SafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A2>, a3: SafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A3>) => RESULT): FragmentFunctionIfValue3TypeSafe<DB, A1, A2, A3, RESULT[typeof optionalType]>
}

export interface FragmentBuilder4IfValueTypeSafe<DB extends AnyDB, A1, A2, A3, A4> {
    as<RESULT extends IBooleanValueSource<NoTableOrViewRequired<DB>, any> | IIfValueSource<NoTableOrViewRequired<DB>, any>>(impl: (a1: SafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A1>, a2: SafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A2>, a3: SafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A3>, a4: SafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A4>) => RESULT): FragmentFunctionIfValue4TypeSafe<DB, A1, A2, A3, A4, RESULT[typeof optionalType]>
}

export interface FragmentBuilder5IfValueTypeSafe<DB extends AnyDB, A1, A2, A3, A4, A5> {
    as<RESULT extends IBooleanValueSource<NoTableOrViewRequired<DB>, any> | IIfValueSource<NoTableOrViewRequired<DB>, any>>(impl: (a1: SafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A1>, a2: SafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A2>, a3: SafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A3>, a4: SafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A4>, a5: SafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A5>) => RESULT): FragmentFunctionIfValue5TypeSafe<DB, A1, A2, A3, A4, A5, RESULT[typeof optionalType]>
}

export interface FragmentBuilder1IfValueTypeUnsafe<DB extends AnyDB, A1> {
    as<RESULT extends IBooleanValueSource<NoTableOrViewRequired<DB>, any> | IIfValueSource<NoTableOrViewRequired<DB>, any>>(impl: (a1: UnsafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A1>) => RESULT): FragmentFunctionIfValue1TypeUnsafe<DB, A1, RESULT[typeof optionalType]>
}

export interface FragmentBuilder2IfValueTypeUnsafe<DB extends AnyDB, A1, A2> {
    as<RESULT extends IBooleanValueSource<NoTableOrViewRequired<DB>, any> | IIfValueSource<NoTableOrViewRequired<DB>, any>>(impl: (a1: UnsafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A1>, a2: UnsafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A2>) => RESULT): FragmentFunctionIfValue2TypeUnsafe<DB, A1, A2, RESULT[typeof optionalType]>
}

export interface FragmentBuilder3IfValueTypeUnsafe<DB extends AnyDB, A1, A2, A3> {
    as<RESULT extends IBooleanValueSource<NoTableOrViewRequired<DB>, any> | IIfValueSource<NoTableOrViewRequired<DB>, any>>(impl: (a1: UnsafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A1>, a2: UnsafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A2>, a3: UnsafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A3>) => RESULT): FragmentFunctionIfValue3TypeUnsafe<DB, A1, A2, A3, RESULT[typeof optionalType]>
}

export interface FragmentBuilder4IfValueTypeUnsafe<DB extends AnyDB, A1, A2, A3, A4> {
    as<RESULT extends IBooleanValueSource<NoTableOrViewRequired<DB>, any> | IIfValueSource<NoTableOrViewRequired<DB>, any>>(impl: (a1: UnsafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A1>, a2: UnsafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A2>, a3: UnsafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A3>, a4: UnsafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A4>) => RESULT): FragmentFunctionIfValue4TypeUnsafe<DB, A1, A2, A3, A4, RESULT[typeof optionalType]>
}

export interface FragmentBuilder5IfValueTypeUnsafe<DB extends AnyDB, A1, A2, A3, A4, A5> {
    as<RESULT extends BooleanValueSource<NoTableOrViewRequired<DB>, any> | IIfValueSource<NoTableOrViewRequired<DB>, any>>(impl: (a1: UnsafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A1>, a2: UnsafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A2>, a3: UnsafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A3>, a4: UnsafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A4>, a5: UnsafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A5>) => RESULT): FragmentFunctionIfValue5TypeUnsafe<DB, A1, A2, A3, A4, A5, RESULT[typeof optionalType]>
}

export interface FragmentFunctionIfValue1TypeSafe<DB extends AnyDB, A1, OPTIONAL_TYPE extends OptionalType> {
    (a1: TypeOfArgument<A1>): IfValueSource<NoTableOrViewRequired<DB>, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>): IfValueSource<T1, OPTIONAL_TYPE>
}

export interface FragmentFunctionIfValue2TypeSafe<DB extends AnyDB, A1, A2, OPTIONAL_TYPE extends OptionalType> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>): IfValueSource<NoTableOrViewRequired<DB>, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>): IfValueSource<T1, OPTIONAL_TYPE>

    <T2 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: SafeArgForFn<T2, A2>): IfValueSource<T2, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: SafeArgForFn<T2, A2>): IfValueSource<T1 | T2, OPTIONAL_TYPE>
}

export interface FragmentFunctionIfValue3TypeSafe<DB extends AnyDB, A1, A2, A3, OPTIONAL_TYPE extends OptionalType> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>): IfValueSource<NoTableOrViewRequired<DB>, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>): IfValueSource<T1, OPTIONAL_TYPE>
    <T2 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: SafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>): IfValueSource<T2, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: SafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>): IfValueSource<T1 | T2, OPTIONAL_TYPE>

    <T3 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: SafeArgForFn<T3, A3>): IfValueSource<T3, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: SafeArgForFn<T3, A3>): IfValueSource<T1 | T3, OPTIONAL_TYPE>
    <T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: SafeArgForFn<T2, A2>, a3: SafeArgForFn<T3, A3>): IfValueSource<T2 | T3, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: SafeArgForFn<T2, A2>, a3: SafeArgForFn<T3, A3>): IfValueSource<T1 | T2 | T3, OPTIONAL_TYPE>
}

export interface FragmentFunctionIfValue4TypeSafe<DB extends AnyDB, A1, A2, A3, A4, OPTIONAL_TYPE extends OptionalType> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): IfValueSource<NoTableOrViewRequired<DB>, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): IfValueSource<T1, OPTIONAL_TYPE>
    <T2 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: SafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): IfValueSource<T2, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: SafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): IfValueSource<T1 | T2, OPTIONAL_TYPE>
    <T3 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: SafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>): IfValueSource<T3, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: SafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>): IfValueSource<T1 | T3, OPTIONAL_TYPE>
    <T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: SafeArgForFn<T2, A2>, a3: SafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>): IfValueSource<T2 | T3, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: SafeArgForFn<T2, A2>, a3: SafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>): IfValueSource<T1 | T2 | T3, OPTIONAL_TYPE>

    <T4 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: SafeArgForFn<T4, A4>): IfValueSource<T4, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: SafeArgForFn<T4, A4>): IfValueSource<T1 | T4, OPTIONAL_TYPE>
    <T2 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: SafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: SafeArgForFn<T4, A4>): IfValueSource<T2 | T4, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: SafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: SafeArgForFn<T4, A4>): IfValueSource<T1 | T2 | T4, OPTIONAL_TYPE>
    <T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: SafeArgForFn<T3, A3>, a4: SafeArgForFn<T4, A4>): IfValueSource<T3 | T4, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: SafeArgForFn<T3, A3>, a4: SafeArgForFn<T4, A4>): IfValueSource<T1 | T3 | T4, OPTIONAL_TYPE>
    <T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: SafeArgForFn<T2, A2>, a3: SafeArgForFn<T3, A3>, a4: SafeArgForFn<T4, A4>): IfValueSource<T2 | T3 | T4, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: SafeArgForFn<T2, A2>, a3: SafeArgForFn<T3, A3>, a4: SafeArgForFn<T4, A4>): IfValueSource<T1 | T2 | T3 | T4, OPTIONAL_TYPE>
}

export interface FragmentFunctionIfValue5TypeSafe<DB extends AnyDB, A1, A2, A3, A4, A5, OPTIONAL_TYPE extends OptionalType> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<NoTableOrViewRequired<DB>, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<T1, OPTIONAL_TYPE>
    <T2 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: SafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<T2, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: SafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | T2, OPTIONAL_TYPE>
    <T3 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: SafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<T3, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: SafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | T3, OPTIONAL_TYPE>
    <T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: SafeArgForFn<T2, A2>, a3: SafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<T2 | T3, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: SafeArgForFn<T2, A2>, a3: SafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | T2 | T3, OPTIONAL_TYPE>
    <T4 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: SafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T4, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: SafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | T4, OPTIONAL_TYPE>
    <T2 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: SafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: SafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T2 | T4, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: SafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: SafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | T2 | T4, OPTIONAL_TYPE>
    <T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: SafeArgForFn<T3, A3>, a4: SafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T3 | T4, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: SafeArgForFn<T3, A3>, a4: SafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | T3 | T4, OPTIONAL_TYPE>
    <T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: SafeArgForFn<T2, A2>, a3: SafeArgForFn<T3, A3>, a4: SafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T2 | T3 | T4, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: SafeArgForFn<T2, A2>, a3: SafeArgForFn<T3, A3>, a4: SafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | T2 | T3 | T4, OPTIONAL_TYPE>

    <T5 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: SafeArgForFn<T5, A5>): IfValueSource<T5, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: SafeArgForFn<T5, A5>): IfValueSource<T1 | T5, OPTIONAL_TYPE>
    <T2 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: SafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: SafeArgForFn<T5, A5>): IfValueSource<T2 | T5, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: SafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: SafeArgForFn<T5, A5>): IfValueSource<T1 | T2 | T5, OPTIONAL_TYPE>
    <T3 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: SafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: SafeArgForFn<T5, A5>): IfValueSource<T3 | T5, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: SafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: SafeArgForFn<T5, A5>): IfValueSource<T1 | T3 | T5, OPTIONAL_TYPE>
    <T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: SafeArgForFn<T2, A2>, a3: SafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: SafeArgForFn<T5, A5>): IfValueSource<T2 | T3 | T5, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: SafeArgForFn<T2, A2>, a3: SafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: SafeArgForFn<T5, A5>): IfValueSource<T1 | T2 | T3 | T5, OPTIONAL_TYPE>
    <T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: SafeArgForFn<T4, A4>, a5: SafeArgForFn<T5, A5>): IfValueSource<T4 | T5, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: SafeArgForFn<T4, A4>, a5: SafeArgForFn<T5, A5>): IfValueSource<T1 | T4 | T5, OPTIONAL_TYPE>
    <T2 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: SafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: SafeArgForFn<T4, A4>, a5: SafeArgForFn<T5, A5>): IfValueSource<T2 | T4 | T5, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: SafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: SafeArgForFn<T4, A4>, a5: SafeArgForFn<T5, A5>): IfValueSource<T1 | T2 | T4 | T5, OPTIONAL_TYPE>
    <T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: SafeArgForFn<T3, A3>, a4: SafeArgForFn<T4, A4>, a5: SafeArgForFn<T5, A5>): IfValueSource<T3 | T4 | T5, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: SafeArgForFn<T3, A3>, a4: SafeArgForFn<T4, A4>, a5: SafeArgForFn<T5, A5>): IfValueSource<T1 | T3 | T4 | T5, OPTIONAL_TYPE>
    <T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: SafeArgForFn<T2, A2>, a3: SafeArgForFn<T3, A3>, a4: SafeArgForFn<T4, A4>, a5: SafeArgForFn<T5, A5>): IfValueSource<T2 | T3 | T4 | T5, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: SafeArgForFn<T2, A2>, a3: SafeArgForFn<T3, A3>, a4: SafeArgForFn<T4, A4>, a5: SafeArgForFn<T5, A5>): IfValueSource<T1 | T2 | T3 | T4 | T5, OPTIONAL_TYPE>
}

export interface FragmentFunctionIfValue1TypeUnsafe<DB extends AnyDB, A1, OPTIONAL_TYPE extends OptionalType> {
    (a1: TypeOfArgument<A1>): IfValueSource<NoTableOrViewRequired<DB>, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>): IfValueSource<T1, OPTIONAL_TYPE>
}

export interface FragmentFunctionIfValue2TypeUnsafe<DB extends AnyDB, A1, A2, OPTIONAL_TYPE extends OptionalType> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>): IfValueSource<NoTableOrViewRequired<DB>, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>): IfValueSource<T1, OPTIONAL_TYPE>

    <T2 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>): IfValueSource<T2, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>): IfValueSource<T1 | T2, OPTIONAL_TYPE>
}

export interface FragmentFunctionIfValue3TypeUnsafe<DB extends AnyDB, A1, A2, A3, OPTIONAL_TYPE extends OptionalType> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>): IfValueSource<NoTableOrViewRequired<DB>, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>): IfValueSource<T1, OPTIONAL_TYPE>
    <T2 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>): IfValueSource<T2, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>): IfValueSource<T1 | T2, OPTIONAL_TYPE>

    <T3 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>): IfValueSource<T3, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>): IfValueSource<T1 | T3, OPTIONAL_TYPE>
    <T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>): IfValueSource<T2 | T3, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>): IfValueSource<T1 | T2 | T3, OPTIONAL_TYPE>
}

export interface FragmentFunctionIfValue4TypeUnsafe<DB extends AnyDB, A1, A2, A3, A4, OPTIONAL_TYPE extends OptionalType> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): IfValueSource<NoTableOrViewRequired<DB>, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): IfValueSource<T1, OPTIONAL_TYPE>
    <T2 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): IfValueSource<T2, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): IfValueSource<T1 | T2, OPTIONAL_TYPE>
    <T3 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>): IfValueSource<T3, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>): IfValueSource<T1 | T3, OPTIONAL_TYPE>
    <T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>): IfValueSource<T2 | T3, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>): IfValueSource<T1 | T2 | T3, OPTIONAL_TYPE>

    <T4 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>): IfValueSource<T4, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>): IfValueSource<T1 | T4, OPTIONAL_TYPE>
    <T2 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>): IfValueSource<T2 | T4, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>): IfValueSource<T1 | T2 | T4, OPTIONAL_TYPE>
    <T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>): IfValueSource<T3 | T4, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>): IfValueSource<T1 | T3 | T4, OPTIONAL_TYPE>
    <T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>): IfValueSource<T2 | T3 | T4, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>): IfValueSource<T1 | T2 | T3 | T4, OPTIONAL_TYPE>
}

export interface FragmentFunctionIfValue5TypeUnsafe<DB extends AnyDB, A1, A2, A3, A4, A5, OPTIONAL_TYPE extends OptionalType> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<NoTableOrViewRequired<DB>, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<T1, OPTIONAL_TYPE>
    <T2 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<T2, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | T2, OPTIONAL_TYPE>
    <T3 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<T3, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | T3, OPTIONAL_TYPE>
    <T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<T2 | T3, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | T2 | T3, OPTIONAL_TYPE>
    <T4 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T4, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | T4, OPTIONAL_TYPE>
    <T2 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T2 | T4, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | T2 | T4, OPTIONAL_TYPE>
    <T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T3 | T4, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | T3 | T4, OPTIONAL_TYPE>
    <T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T2 | T3 | T4, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | T2 | T3 | T4, OPTIONAL_TYPE>

    <T5 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: UnsafeArgForFn<T5, A5>): IfValueSource<T5, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: UnsafeArgForFn<T5, A5>): IfValueSource<T1 | T5, OPTIONAL_TYPE>
    <T2 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: UnsafeArgForFn<T5, A5>): IfValueSource<T2 | T5, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: UnsafeArgForFn<T5, A5>): IfValueSource<T1 | T2 | T5, OPTIONAL_TYPE>
    <T3 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: UnsafeArgForFn<T5, A5>): IfValueSource<T3 | T5, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: UnsafeArgForFn<T5, A5>): IfValueSource<T1 | T3 | T5, OPTIONAL_TYPE>
    <T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: UnsafeArgForFn<T5, A5>): IfValueSource<T2 | T3 | T5, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: UnsafeArgForFn<T5, A5>): IfValueSource<T1 | T2 | T3 | T5, OPTIONAL_TYPE>
    <T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>, a5: UnsafeArgForFn<T5, A5>): IfValueSource<T4 | T5, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>, a5: UnsafeArgForFn<T5, A5>): IfValueSource<T1 | T4 | T5, OPTIONAL_TYPE>
    <T2 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>, a5: UnsafeArgForFn<T5, A5>): IfValueSource<T2 | T4 | T5, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>, a5: UnsafeArgForFn<T5, A5>): IfValueSource<T1 | T2 | T4 | T5, OPTIONAL_TYPE>
    <T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>, a5: UnsafeArgForFn<T5, A5>): IfValueSource<T3 | T4 | T5, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>, a5: UnsafeArgForFn<T5, A5>): IfValueSource<T1 | T3 | T4 | T5, OPTIONAL_TYPE>
    <T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>, a5: UnsafeArgForFn<T5, A5>): IfValueSource<T2 | T3 | T4 | T5, OPTIONAL_TYPE>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>, a5: UnsafeArgForFn<T5, A5>): IfValueSource<T1 | T2 | T3 | T4 | T5, OPTIONAL_TYPE>
}
