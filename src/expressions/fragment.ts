import type { AnyDB } from "../databases"
import type { TableOrViewRef, NoTableOrViewRequired } from "../utils/ITableOrView"
import type { BooleanValueSource, NumberValueSource, StringValueSource, DateValueSource, TimeValueSource, DateTimeValueSource, EqualableValueSource, IntValueSource, DoubleValueSource, LocalDateValueSource, LocalTimeValueSource, LocalDateTimeValueSource, TypeSafeStringValueSource, StringNumberValueSource, StringIntValueSource, StringDoubleValueSource, IValueSource, ComparableValueSource, MapArgumentToTypeSafe, RemapValueSourceType, TypeOfArgument, MapArgumentToTypeUnsafe, SafeArgForFn, UnsafeArgForFn, IfValueSource, SafeArgForBuilderIfValue, UnsafeArgForBuilderIfValue, IBooleanValueSource, IIfValueSource, BigintValueSource, TypeSafeBigintValueSource } from "../expressions/values"
import { valueType } from "../utils/symbols"

export interface BooleanFragmentExpression<DB extends AnyDB, TYPE> {
    sql(sql: TemplateStringsArray):  BooleanValueSource<NoTableOrViewRequired<DB>, TYPE>
    sql<T1 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>): BooleanValueSource<T1, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>): BooleanValueSource<T1 | T2, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>): BooleanValueSource<T1 | T2 | T3, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>): BooleanValueSource<T1 | T2 | T3 | T4, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>): BooleanValueSource<T1 | T2 | T3 | T4 | T5, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>, p6: IValueSource<T6, any>): BooleanValueSource<T1 | T2 | T3 | T4 | T5 | T6, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>, T7 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>, p6: IValueSource<T6, any>, p7: IValueSource<T7, any>): BooleanValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, TYPE>
    sql<T extends TableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: IValueSource<T, any>[]): BooleanValueSource<T, TYPE>
}

export interface StringIntFragmentExpression<DB extends AnyDB, TYPE> {
    sql(sql: TemplateStringsArray):  StringIntValueSource<NoTableOrViewRequired<DB>, TYPE>
    sql<T1 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>): StringIntValueSource<T1, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>): StringIntValueSource<T1 | T2, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>): StringIntValueSource<T1 | T2 | T3, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>): StringIntValueSource<T1 | T2 | T3 | T4, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>): StringIntValueSource<T1 | T2 | T3 | T4 | T5, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>, p6: IValueSource<T6, any>): StringIntValueSource<T1 | T2 | T3 | T4 | T5 | T6, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>, T7 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>, p6: IValueSource<T6, any>, p7: IValueSource<T7, any>): StringIntValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, TYPE>
    sql<T extends TableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: IValueSource<T, any>[]): StringIntValueSource<T, TYPE>
}

export interface StringNumberFragmentExpression<DB extends AnyDB, TYPE> {
    sql(sql: TemplateStringsArray):  StringNumberValueSource<NoTableOrViewRequired<DB>, TYPE>
    sql<T1 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>): StringNumberValueSource<T1, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>): StringNumberValueSource<T1 | T2, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>): StringNumberValueSource<T1 | T2 | T3, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>): StringNumberValueSource<T1 | T2 | T3 | T4, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>): StringNumberValueSource<T1 | T2 | T3 | T4 | T5, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>, p6: IValueSource<T6, any>): StringNumberValueSource<T1 | T2 | T3 | T4 | T5 | T6, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>, T7 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>, p6: IValueSource<T6, any>, p7: IValueSource<T7, any>): StringNumberValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, TYPE>
    sql<T extends TableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: IValueSource<T, any>[]): StringNumberValueSource<T, TYPE>
}

export interface IntFragmentExpression<DB extends AnyDB, TYPE> {
    sql(sql: TemplateStringsArray):  IntValueSource<NoTableOrViewRequired<DB>, TYPE>
    sql<T1 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>): IntValueSource<T1, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>): IntValueSource<T1 | T2, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>): IntValueSource<T1 | T2 | T3, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>): IntValueSource<T1 | T2 | T3 | T4, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>): IntValueSource<T1 | T2 | T3 | T4 | T5, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>, p6: IValueSource<T6, any>): IntValueSource<T1 | T2 | T3 | T4 | T5 | T6, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>, T7 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>, p6: IValueSource<T6, any>, p7: IValueSource<T7, any>): IntValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, TYPE>
    sql<T extends TableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: IValueSource<T, any>[]): IntValueSource<T, TYPE>
}

export interface NumberFragmentExpression<DB extends AnyDB, TYPE> {
    sql(sql: TemplateStringsArray):  NumberValueSource<NoTableOrViewRequired<DB>, TYPE>
    sql<T1 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>): NumberValueSource<T1, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>): NumberValueSource<T1 | T2, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>): NumberValueSource<T1 | T2 | T3, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>): NumberValueSource<T1 | T2 | T3 | T4, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>): NumberValueSource<T1 | T2 | T3 | T4 | T5, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>, p6: IValueSource<T6, any>): NumberValueSource<T1 | T2 | T3 | T4 | T5 | T6, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>, T7 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>, p6: IValueSource<T6, any>, p7: IValueSource<T7, any>): NumberValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, TYPE>
    sql<T extends TableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: IValueSource<T, any>[]): NumberValueSource<T, TYPE>
}

export interface BigintFragmentExpression<DB extends AnyDB, TYPE> {
    sql(sql: TemplateStringsArray):  BigintValueSource<NoTableOrViewRequired<DB>, TYPE>
    sql<T1 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>): BigintValueSource<T1, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>): BigintValueSource<T1 | T2, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>): BigintValueSource<T1 | T2 | T3, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>): BigintValueSource<T1 | T2 | T3 | T4, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>): BigintValueSource<T1 | T2 | T3 | T4 | T5, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>, p6: IValueSource<T6, any>): BigintValueSource<T1 | T2 | T3 | T4 | T5 | T6, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>, T7 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>, p6: IValueSource<T6, any>, p7: IValueSource<T7, any>): BigintValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, TYPE>
    sql<T extends TableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: IValueSource<T, any>[]): NumberValueSource<T, TYPE>
}

export interface TypeSafeBigintFragmentExpression<DB extends AnyDB, TYPE> {
    sql(sql: TemplateStringsArray):  TypeSafeBigintValueSource<NoTableOrViewRequired<DB>, TYPE>
    sql<T1 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>): TypeSafeBigintValueSource<T1, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>): TypeSafeBigintValueSource<T1 | T2, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>): TypeSafeBigintValueSource<T1 | T2 | T3, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>): TypeSafeBigintValueSource<T1 | T2 | T3 | T4, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>): TypeSafeBigintValueSource<T1 | T2 | T3 | T4 | T5, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>, p6: IValueSource<T6, any>): TypeSafeBigintValueSource<T1 | T2 | T3 | T4 | T5 | T6, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>, T7 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>, p6: IValueSource<T6, any>, p7: IValueSource<T7, any>): TypeSafeBigintValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, TYPE>
    sql<T extends TableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: IValueSource<T, any>[]): NumberValueSource<T, TYPE>
}

export interface StringDoubleFragmentExpression<DB extends AnyDB, TYPE> {
    sql(sql: TemplateStringsArray):  StringDoubleValueSource<NoTableOrViewRequired<DB>, TYPE>
    sql<T1 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>): StringDoubleValueSource<T1, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>): StringDoubleValueSource<T1 | T2, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>): StringDoubleValueSource<T1 | T2 | T3, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>): StringDoubleValueSource<T1 | T2 | T3 | T4, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>): StringDoubleValueSource<T1 | T2 | T3 | T4 | T5, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>, p6: IValueSource<T6, any>): StringDoubleValueSource<T1 | T2 | T3 | T4 | T5 | T6, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>, T7 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>, p6: IValueSource<T6, any>, p7: IValueSource<T7, any>): StringDoubleValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, TYPE>
    sql<T extends TableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: IValueSource<T, any>[]): StringDoubleValueSource<T, TYPE>
}

export interface DoubleFragmentExpression<DB extends AnyDB, TYPE> {
    sql(sql: TemplateStringsArray):  DoubleValueSource<NoTableOrViewRequired<DB>, TYPE>
    sql<T1 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>): DoubleValueSource<T1, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>): DoubleValueSource<T1 | T2, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>): DoubleValueSource<T1 | T2 | T3, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>): DoubleValueSource<T1 | T2 | T3 | T4, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>): DoubleValueSource<T1 | T2 | T3 | T4 | T5, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>, p6: IValueSource<T6, any>): DoubleValueSource<T1 | T2 | T3 | T4 | T5 | T6, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>, T7 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>, p6: IValueSource<T6, any>, p7: IValueSource<T7, any>): DoubleValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, TYPE>
    sql<T extends TableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: IValueSource<T, any>[]): DoubleValueSource<T, TYPE>
}

export interface TypeSafeStringFragmentExpression<DB extends AnyDB, TYPE> {
    sql(sql: TemplateStringsArray):  TypeSafeStringValueSource<NoTableOrViewRequired<DB>, TYPE>
    sql<T1 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>): TypeSafeStringValueSource<T1, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>): TypeSafeStringValueSource<T1 | T2, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>): TypeSafeStringValueSource<T1 | T2 | T3, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>): TypeSafeStringValueSource<T1 | T2 | T3 | T4, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>): TypeSafeStringValueSource<T1 | T2 | T3 | T4 | T5, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>, p6: IValueSource<T6, any>): TypeSafeStringValueSource<T1 | T2 | T3 | T4 | T5 | T6, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>, T7 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>, p6: IValueSource<T6, any>, p7: IValueSource<T7, any>): TypeSafeStringValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, TYPE>
    sql<T extends TableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: IValueSource<T, any>[]): TypeSafeStringValueSource<T, TYPE>
}

export interface StringFragmentExpression<DB extends AnyDB, TYPE> {
    sql(sql: TemplateStringsArray):  StringValueSource<NoTableOrViewRequired<DB>, TYPE>
    sql<T1 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>): StringValueSource<T1, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>): StringValueSource<T1 | T2, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>): StringValueSource<T1 | T2 | T3, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>): StringValueSource<T1 | T2 | T3 | T4, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>): StringValueSource<T1 | T2 | T3 | T4 | T5, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>, p6: IValueSource<T6, any>): StringValueSource<T1 | T2 | T3 | T4 | T5 | T6, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>, T7 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>, p6: IValueSource<T6, any>, p7: IValueSource<T7, any>): StringValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, TYPE>
    sql<T extends TableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: IValueSource<T, any>[]): StringValueSource<T, TYPE>
}

export interface LocalDateFragmentExpression<DB extends AnyDB, TYPE> {
    sql(sql: TemplateStringsArray):  LocalDateValueSource<NoTableOrViewRequired<DB>, TYPE>
    sql<T1 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>): LocalDateValueSource<T1, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>): LocalDateValueSource<T1 | T2, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>): LocalDateValueSource<T1 | T2 | T3, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>): LocalDateValueSource<T1 | T2 | T3 | T4, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>): LocalDateValueSource<T1 | T2 | T3 | T4 | T5, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>, p6: IValueSource<T6, any>): LocalDateValueSource<T1 | T2 | T3 | T4 | T5 | T6, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>, T7 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>, p6: IValueSource<T6, any>, p7: IValueSource<T7, any>): LocalDateValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, TYPE>
    sql<T extends TableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: IValueSource<T, any>[]): LocalDateValueSource<T, TYPE>
}

export interface DateFragmentExpression<DB extends AnyDB, TYPE> {
    sql(sql: TemplateStringsArray):  DateValueSource<NoTableOrViewRequired<DB>, TYPE>
    sql<T1 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>): DateValueSource<T1, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>): DateValueSource<T1 | T2, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>): DateValueSource<T1 | T2 | T3, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>): DateValueSource<T1 | T2 | T3 | T4, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>): DateValueSource<T1 | T2 | T3 | T4 | T5, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>, p6: IValueSource<T6, any>): DateValueSource<T1 | T2 | T3 | T4 | T5 | T6, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>, T7 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>, p6: IValueSource<T6, any>, p7: IValueSource<T7, any>): DateValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, TYPE>
    sql<T extends TableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: IValueSource<T, any>[]): DateValueSource<T, TYPE>
}

export interface LocalTimeFragmentExpression<DB extends AnyDB, TYPE> {
    sql(sql: TemplateStringsArray):  LocalTimeValueSource<NoTableOrViewRequired<DB>, TYPE>
    sql<T1 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>): LocalTimeValueSource<T1, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>): LocalTimeValueSource<T1 | T2, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>): LocalTimeValueSource<T1 | T2 | T3, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>): LocalTimeValueSource<T1 | T2 | T3 | T4, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>): LocalTimeValueSource<T1 | T2 | T3 | T4 | T5, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>, p6: IValueSource<T6, any>): LocalTimeValueSource<T1 | T2 | T3 | T4 | T5 | T6, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>, T7 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>, p6: IValueSource<T6, any>, p7: IValueSource<T7, any>): LocalTimeValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, TYPE>
    sql<T extends TableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: IValueSource<T, any>[]): LocalTimeValueSource<T, TYPE>
}

export interface TimeFragmentExpression<DB extends AnyDB, TYPE> {
    sql(sql: TemplateStringsArray):  TimeValueSource<NoTableOrViewRequired<DB>, TYPE>
    sql<T1 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>): TimeValueSource<T1, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>): TimeValueSource<T1 | T2, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>): TimeValueSource<T1 | T2 | T3, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>): TimeValueSource<T1 | T2 | T3 | T4, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>): TimeValueSource<T1 | T2 | T3 | T4 | T5, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>, p6: IValueSource<T6, any>): TimeValueSource<T1 | T2 | T3 | T4 | T5 | T6, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>, T7 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>, p6: IValueSource<T6, any>, p7: IValueSource<T7, any>): TimeValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, TYPE>
    sql<T extends TableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: IValueSource<T, any>[]): TimeValueSource<T, TYPE>
}

export interface LocalDateTimeFragmentExpression<DB extends AnyDB, TYPE> {
    sql(sql: TemplateStringsArray):  LocalDateTimeValueSource<NoTableOrViewRequired<DB>, TYPE>
    sql<T1 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>): LocalDateTimeValueSource<T1, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>): LocalDateTimeValueSource<T1 | T2, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>): LocalDateTimeValueSource<T1 | T2 | T3, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>): LocalDateTimeValueSource<T1 | T2 | T3 | T4, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>): LocalDateTimeValueSource<T1 | T2 | T3 | T4 | T5, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>, p6: IValueSource<T6, any>): LocalDateTimeValueSource<T1 | T2 | T3 | T4 | T5 | T6, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>, T7 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>, p6: IValueSource<T6, any>, p7: IValueSource<T7, any>): LocalDateTimeValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, TYPE>
    sql<T extends TableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: IValueSource<T, any>[]): LocalDateTimeValueSource<T, TYPE>
}

export interface DateTimeFragmentExpression<DB extends AnyDB, TYPE> {
    sql(sql: TemplateStringsArray):  DateTimeValueSource<NoTableOrViewRequired<DB>, TYPE>
    sql<T1 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>): DateTimeValueSource<T1, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>): DateTimeValueSource<T1 | T2, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>): DateTimeValueSource<T1 | T2 | T3, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>): DateTimeValueSource<T1 | T2 | T3 | T4, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>): DateTimeValueSource<T1 | T2 | T3 | T4 | T5, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>, p6: IValueSource<T6, any>): DateTimeValueSource<T1 | T2 | T3 | T4 | T5 | T6, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>, T7 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>, p6: IValueSource<T6, any>, p7: IValueSource<T7, any>): DateTimeValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, TYPE>
    sql<T extends TableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: IValueSource<T, any>[]): DateTimeValueSource<T, TYPE>
}

export interface EqualableFragmentExpression<DB extends AnyDB, TYPE> {
    sql(sql: TemplateStringsArray):  EqualableValueSource<NoTableOrViewRequired<DB>, TYPE>
    sql<T1 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>): EqualableValueSource<T1, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>): EqualableValueSource<T1 | T2, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>): EqualableValueSource<T1 | T2 | T3, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>): EqualableValueSource<T1 | T2 | T3 | T4, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>): EqualableValueSource<T1 | T2 | T3 | T4 | T5, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>, p6: IValueSource<T6, any>): EqualableValueSource<T1 | T2 | T3 | T4 | T5 | T6, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>, T7 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>, p6: IValueSource<T6, any>, p7: IValueSource<T7, any>): EqualableValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, TYPE>
    sql<T extends TableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: IValueSource<T, any>[]): EqualableValueSource<T, TYPE>
}

export interface ComparableFragmentExpression<DB extends AnyDB, TYPE> {
    sql(sql: TemplateStringsArray):  ComparableValueSource<NoTableOrViewRequired<DB>, TYPE>
    sql<T1 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>): ComparableValueSource<T1, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>): ComparableValueSource<T1 | T2, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>): ComparableValueSource<T1 | T2 | T3, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>): ComparableValueSource<T1 | T2 | T3 | T4, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>): ComparableValueSource<T1 | T2 | T3 | T4 | T5, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>, p6: IValueSource<T6, any>): ComparableValueSource<T1 | T2 | T3 | T4 | T5 | T6, TYPE>
    sql<T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>, T6 extends TableOrViewRef<DB>, T7 extends TableOrViewRef<DB>>(sql: TemplateStringsArray, p1: IValueSource<T1, any>, p2: IValueSource<T2, any>, p3: IValueSource<T3, any>, p4: IValueSource<T4, any>, p5: IValueSource<T5, any>, p6: IValueSource<T6, any>, p7: IValueSource<T7, any>): ComparableValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, TYPE>
    sql<T extends TableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: IValueSource<T, any>[]): ComparableValueSource<T, TYPE>
}

export interface FragmentBuilder0<DB extends AnyDB> {
    as<RESULT extends IValueSource<NoTableOrViewRequired<DB>, any>>(impl: () => RESULT): () => RESULT
}

export interface FragmentBuilder1TypeSafe<DB extends AnyDB, A1> {
    as<RESULT extends IValueSource<NoTableOrViewRequired<DB>, any>>(impl: (a1: MapArgumentToTypeSafe<NoTableOrViewRequired<DB>, A1>) => RESULT): FargmentFunction1TypeSafe<DB, A1, RESULT>
}

export interface FragmentBuilder2TypeSafe<DB extends AnyDB, A1, A2> {
    as<RESULT extends IValueSource<NoTableOrViewRequired<DB>, any>>(impl: (a1: MapArgumentToTypeSafe<NoTableOrViewRequired<DB>, A1>, a2: MapArgumentToTypeSafe<NoTableOrViewRequired<DB>, A2>) => RESULT): FargmentFunction2TypeSafe<DB, A1, A2, RESULT>
}

export interface FragmentBuilder3TypeSafe<DB extends AnyDB, A1, A2, A3> {
    as<RESULT extends IValueSource<NoTableOrViewRequired<DB>, any>>(impl: (a1: MapArgumentToTypeSafe<NoTableOrViewRequired<DB>, A1>, a2: MapArgumentToTypeSafe<NoTableOrViewRequired<DB>, A2>, a3: MapArgumentToTypeSafe<NoTableOrViewRequired<DB>, A3>) => RESULT): FargmentFunction3TypeSafe<DB, A1, A2, A3, RESULT>
}

export interface FragmentBuilder4TypeSafe<DB extends AnyDB, A1, A2, A3, A4> {
    as<RESULT extends IValueSource<NoTableOrViewRequired<DB>, any>>(impl: (a1: MapArgumentToTypeSafe<NoTableOrViewRequired<DB>, A1>, a2: MapArgumentToTypeSafe<NoTableOrViewRequired<DB>, A2>, a3: MapArgumentToTypeSafe<NoTableOrViewRequired<DB>, A3>, a4: MapArgumentToTypeSafe<NoTableOrViewRequired<DB>, A4>) => RESULT): FargmentFunction4TypeSafe<DB, A1, A2, A3, A4, RESULT>
}

export interface FragmentBuilder5TypeSafe<DB extends AnyDB, A1, A2, A3, A4, A5> {
    as<RESULT extends IValueSource<NoTableOrViewRequired<DB>, any>>(impl: (a1: MapArgumentToTypeSafe<NoTableOrViewRequired<DB>, A1>, a2: MapArgumentToTypeSafe<NoTableOrViewRequired<DB>, A2>, a3: MapArgumentToTypeSafe<NoTableOrViewRequired<DB>, A3>, a4: MapArgumentToTypeSafe<NoTableOrViewRequired<DB>, A4>, a5: MapArgumentToTypeSafe<NoTableOrViewRequired<DB>, A5>) => RESULT): FargmentFunction5TypeSafe<DB, A1, A2, A3, A4, A5, RESULT>
}

export interface FragmentBuilder1TypeUnsafe<DB extends AnyDB, A1> {
    as<RESULT extends IValueSource<NoTableOrViewRequired<DB>, any>>(impl: (a1: MapArgumentToTypeUnsafe<NoTableOrViewRequired<DB>, A1>) => RESULT): FargmentFunction1TypeUnsafe<DB, A1, RESULT>
}

export interface FragmentBuilder2TypeUnsafe<DB extends AnyDB, A1, A2> {
    as<RESULT extends IValueSource<NoTableOrViewRequired<DB>, any>>(impl: (a1: MapArgumentToTypeUnsafe<NoTableOrViewRequired<DB>, A1>, a2: MapArgumentToTypeUnsafe<NoTableOrViewRequired<DB>, A2>) => RESULT): FargmentFunction2TypeUnsafe<DB, A1, A2, RESULT>
}

export interface FragmentBuilder3TypeUnsafe<DB extends AnyDB, A1, A2, A3> {
    as<RESULT extends IValueSource<NoTableOrViewRequired<DB>, any>>(impl: (a1: MapArgumentToTypeUnsafe<NoTableOrViewRequired<DB>, A1>, a2: MapArgumentToTypeUnsafe<NoTableOrViewRequired<DB>, A2>, a3: MapArgumentToTypeUnsafe<NoTableOrViewRequired<DB>, A3>) => RESULT): FargmentFunction3TypeUnsafe<DB, A1, A2, A3, RESULT>
}

export interface FragmentBuilder4TypeUnsafe<DB extends AnyDB, A1, A2, A3, A4> {
    as<RESULT extends IValueSource<NoTableOrViewRequired<DB>, any>>(impl: (a1: MapArgumentToTypeUnsafe<NoTableOrViewRequired<DB>, A1>, a2: MapArgumentToTypeUnsafe<NoTableOrViewRequired<DB>, A2>, a3: MapArgumentToTypeUnsafe<NoTableOrViewRequired<DB>, A3>, a4: MapArgumentToTypeUnsafe<NoTableOrViewRequired<DB>, A4>) => RESULT): FargmentFunction4TypeUnsafe<DB, A1, A2, A3, A4, RESULT>
}

export interface FragmentBuilder5TypeUnsafe<DB extends AnyDB, A1, A2, A3, A4, A5> {
    as<RESULT extends IValueSource<NoTableOrViewRequired<DB>, any>>(impl: (a1: MapArgumentToTypeUnsafe<NoTableOrViewRequired<DB>, A1>, a2: MapArgumentToTypeUnsafe<NoTableOrViewRequired<DB>, A2>, a3: MapArgumentToTypeUnsafe<NoTableOrViewRequired<DB>, A3>, a4: MapArgumentToTypeUnsafe<NoTableOrViewRequired<DB>, A4>, a5: MapArgumentToTypeUnsafe<NoTableOrViewRequired<DB>, A5>) => RESULT): FargmentFunction5TypeUnsafe<DB, A1, A2, A3, A4, A5, RESULT>
}

export interface FargmentFunction1TypeSafe<DB extends AnyDB, A1, RESULT> {
    (a1: TypeOfArgument<A1>): RemapValueSourceType<NoTableOrViewRequired<DB>, RESULT>
    <T1 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>): RemapValueSourceType<T1, RESULT>
}

export interface FargmentFunction2TypeSafe<DB extends AnyDB, A1, A2, RESULT> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>): RemapValueSourceType<NoTableOrViewRequired<DB>, RESULT>
    <T1 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>): RemapValueSourceType<T1, RESULT>

    <T2 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: SafeArgForFn<T2, A2>): RemapValueSourceType<T2, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: SafeArgForFn<T2, A2>): RemapValueSourceType<T1 | T2, RESULT>
}

export interface FargmentFunction3TypeSafe<DB extends AnyDB, A1, A2, A3, RESULT> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>): RemapValueSourceType<NoTableOrViewRequired<DB>, RESULT>
    <T1 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>): RemapValueSourceType<T1, RESULT>
    <T2 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: SafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>): RemapValueSourceType<T2, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: SafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>): RemapValueSourceType<T1 | T2, RESULT>

    <T3 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: SafeArgForFn<T3, A3>): RemapValueSourceType<T3, RESULT>
    <T1 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: SafeArgForFn<T3, A3>): RemapValueSourceType<T1 | T3, RESULT>
    <T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: SafeArgForFn<T2, A2>, a3: SafeArgForFn<T3, A3>): RemapValueSourceType<T2 | T3, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: SafeArgForFn<T2, A2>, a3: SafeArgForFn<T3, A3>): RemapValueSourceType<T1 | T2 | T3, RESULT>
}

export interface FargmentFunction4TypeSafe<DB extends AnyDB, A1, A2, A3, A4, RESULT> {
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

export interface FargmentFunction5TypeSafe<DB extends AnyDB, A1, A2, A3, A4, A5, RESULT> {
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

export interface FargmentFunction1TypeUnsafe<DB extends AnyDB, A1, RESULT> {
    (a1: TypeOfArgument<A1>): RemapValueSourceType<NoTableOrViewRequired<DB>, RESULT>
    <T1 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>): RemapValueSourceType<T1, RESULT>
}

export interface FargmentFunction2TypeUnsafe<DB extends AnyDB, A1, A2, RESULT> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>): RemapValueSourceType<NoTableOrViewRequired<DB>, RESULT>
    <T1 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>): RemapValueSourceType<T1, RESULT>

    <T2 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>): RemapValueSourceType<T2, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>): RemapValueSourceType<T1 | T2, RESULT>
}

export interface FargmentFunction3TypeUnsafe<DB extends AnyDB, A1, A2, A3, RESULT> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>): RemapValueSourceType<NoTableOrViewRequired<DB>, RESULT>
    <T1 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>): RemapValueSourceType<T1, RESULT>
    <T2 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>): RemapValueSourceType<T2, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>): RemapValueSourceType<T1 | T2, RESULT>

    <T3 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>): RemapValueSourceType<T3, RESULT>
    <T1 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>): RemapValueSourceType<T1 | T3, RESULT>
    <T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>): RemapValueSourceType<T2 | T3, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>): RemapValueSourceType<T1 | T2 | T3, RESULT>
}

export interface FargmentFunction4TypeUnsafe<DB extends AnyDB, A1, A2, A3, A4, RESULT> {
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

export interface FargmentFunction5TypeUnsafe<DB extends AnyDB, A1, A2, A3, A4, A5, RESULT> {
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
    as<RESULT extends IBooleanValueSource<NoTableOrViewRequired<DB>, any> | IIfValueSource<NoTableOrViewRequired<DB>, any>>(impl: () => RESULT): () => IfValueSource<NoTableOrViewRequired<DB>, RESULT[typeof valueType]>
}

export interface FragmentBuilder1IfValueTypeSafe<DB extends AnyDB, A1> {
    as<RESULT extends IBooleanValueSource<NoTableOrViewRequired<DB>, any> | IIfValueSource<NoTableOrViewRequired<DB>, any>>(impl: (a1: SafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A1>) => RESULT): FargmentFunctionIfValue1TypeSafe<DB, A1, RESULT[typeof valueType]>
}

export interface FragmentBuilder2IfValueTypeSafe<DB extends AnyDB, A1, A2> {
    as<RESULT extends IBooleanValueSource<NoTableOrViewRequired<DB>, any> | IIfValueSource<NoTableOrViewRequired<DB>, any>>(impl: (a1: SafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A1>, a2: SafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A2>) => RESULT): FargmentFunctionIfValue2TypeSafe<DB, A1, A2, RESULT[typeof valueType]>
}

export interface FragmentBuilder3IfValueTypeSafe<DB extends AnyDB, A1, A2, A3> {
    as<RESULT extends IBooleanValueSource<NoTableOrViewRequired<DB>, any> | IIfValueSource<NoTableOrViewRequired<DB>, any>>(impl: (a1: SafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A1>, a2: SafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A2>, a3: SafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A3>) => RESULT): FargmentFunctionIfValue3TypeSafe<DB, A1, A2, A3, RESULT[typeof valueType]>
}

export interface FragmentBuilder4IfValueTypeSafe<DB extends AnyDB, A1, A2, A3, A4> {
    as<RESULT extends IBooleanValueSource<NoTableOrViewRequired<DB>, any> | IIfValueSource<NoTableOrViewRequired<DB>, any>>(impl: (a1: SafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A1>, a2: SafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A2>, a3: SafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A3>, a4: SafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A4>) => RESULT): FargmentFunctionIfValue4TypeSafe<DB, A1, A2, A3, A4, RESULT[typeof valueType]>
}

export interface FragmentBuilder5IfValueTypeSafe<DB extends AnyDB, A1, A2, A3, A4, A5> {
    as<RESULT extends IBooleanValueSource<NoTableOrViewRequired<DB>, any> | IIfValueSource<NoTableOrViewRequired<DB>, any>>(impl: (a1: SafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A1>, a2: SafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A2>, a3: SafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A3>, a4: SafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A4>, a5: SafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A5>) => RESULT): FargmentFunctionIfValue5TypeSafe<DB, A1, A2, A3, A4, A5, RESULT[typeof valueType]>
}

export interface FragmentBuilder1IfValueTypeUnsafe<DB extends AnyDB, A1> {
    as<RESULT extends IBooleanValueSource<NoTableOrViewRequired<DB>, any> | IIfValueSource<NoTableOrViewRequired<DB>, any>>(impl: (a1: UnsafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A1>) => RESULT): FargmentFunctionIfValue1TypeUnsafe<DB, A1, RESULT[typeof valueType]>
}

export interface FragmentBuilder2IfValueTypeUnsafe<DB extends AnyDB, A1, A2> {
    as<RESULT extends IBooleanValueSource<NoTableOrViewRequired<DB>, any> | IIfValueSource<NoTableOrViewRequired<DB>, any>>(impl: (a1: UnsafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A1>, a2: UnsafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A2>) => RESULT): FargmentFunctionIfValue2TypeUnsafe<DB, A1, A2, RESULT[typeof valueType]>
}

export interface FragmentBuilder3IfValueTypeUnsafe<DB extends AnyDB, A1, A2, A3> {
    as<RESULT extends IBooleanValueSource<NoTableOrViewRequired<DB>, any> | IIfValueSource<NoTableOrViewRequired<DB>, any>>(impl: (a1: UnsafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A1>, a2: UnsafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A2>, a3: UnsafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A3>) => RESULT): FargmentFunctionIfValue3TypeUnsafe<DB, A1, A2, A3, RESULT[typeof valueType]>
}

export interface FragmentBuilder4IfValueTypeUnsafe<DB extends AnyDB, A1, A2, A3, A4> {
    as<RESULT extends IBooleanValueSource<NoTableOrViewRequired<DB>, any> | IIfValueSource<NoTableOrViewRequired<DB>, any>>(impl: (a1: UnsafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A1>, a2: UnsafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A2>, a3: UnsafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A3>, a4: UnsafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A4>) => RESULT): FargmentFunctionIfValue4TypeUnsafe<DB, A1, A2, A3, A4, RESULT[typeof valueType]>
}

export interface FragmentBuilder5IfValueTypeUnsafe<DB extends AnyDB, A1, A2, A3, A4, A5> {
    as<RESULT extends BooleanValueSource<NoTableOrViewRequired<DB>, any> | IIfValueSource<NoTableOrViewRequired<DB>, any>>(impl: (a1: UnsafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A1>, a2: UnsafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A2>, a3: UnsafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A3>, a4: UnsafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A4>, a5: UnsafeArgForBuilderIfValue<NoTableOrViewRequired<DB>, A5>) => RESULT): FargmentFunctionIfValue5TypeUnsafe<DB, A1, A2, A3, A4, A5, RESULT[typeof valueType]>
}

export interface FargmentFunctionIfValue1TypeSafe<DB extends AnyDB, A1, RESULT> {
    (a1: TypeOfArgument<A1>): IfValueSource<NoTableOrViewRequired<DB>, RESULT>
    <T1 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>): IfValueSource<T1, RESULT>
}

export interface FargmentFunctionIfValue2TypeSafe<DB extends AnyDB, A1, A2, RESULT> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>): IfValueSource<NoTableOrViewRequired<DB>, RESULT>
    <T1 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>): IfValueSource<T1, RESULT>

    <T2 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: SafeArgForFn<T2, A2>): IfValueSource<T2, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: SafeArgForFn<T2, A2>): IfValueSource<T1 | T2, RESULT>
}

export interface FargmentFunctionIfValue3TypeSafe<DB extends AnyDB, A1, A2, A3, RESULT> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>): IfValueSource<NoTableOrViewRequired<DB>, RESULT>
    <T1 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>): IfValueSource<T1, RESULT>
    <T2 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: SafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>): IfValueSource<T2, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: SafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>): IfValueSource<T1 | T2, RESULT>

    <T3 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: SafeArgForFn<T3, A3>): IfValueSource<T3, RESULT>
    <T1 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: SafeArgForFn<T3, A3>): IfValueSource<T1 | T3, RESULT>
    <T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: SafeArgForFn<T2, A2>, a3: SafeArgForFn<T3, A3>): IfValueSource<T2 | T3, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: SafeArgForFn<T2, A2>, a3: SafeArgForFn<T3, A3>): IfValueSource<T1 | T2 | T3, RESULT>
}

export interface FargmentFunctionIfValue4TypeSafe<DB extends AnyDB, A1, A2, A3, A4, RESULT> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): IfValueSource<NoTableOrViewRequired<DB>, RESULT>
    <T1 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): IfValueSource<T1, RESULT>
    <T2 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: SafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): IfValueSource<T2, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: SafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): IfValueSource<T1 | T2, RESULT>
    <T3 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: SafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>): IfValueSource<T3, RESULT>
    <T1 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: SafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>): IfValueSource<T1 | T3, RESULT>
    <T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: SafeArgForFn<T2, A2>, a3: SafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>): IfValueSource<T2 | T3, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: SafeArgForFn<T2, A2>, a3: SafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>): IfValueSource<T1 | T2 | T3, RESULT>

    <T4 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: SafeArgForFn<T4, A4>): IfValueSource<T4, RESULT>
    <T1 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: SafeArgForFn<T4, A4>): IfValueSource<T1 | T4, RESULT>
    <T2 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: SafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: SafeArgForFn<T4, A4>): IfValueSource<T2 | T4, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: SafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: SafeArgForFn<T4, A4>): IfValueSource<T1 | T2 | T4, RESULT>
    <T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: SafeArgForFn<T3, A3>, a4: SafeArgForFn<T4, A4>): IfValueSource<T3 | T4, RESULT>
    <T1 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: SafeArgForFn<T3, A3>, a4: SafeArgForFn<T4, A4>): IfValueSource<T1 | T3 | T4, RESULT>
    <T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: SafeArgForFn<T2, A2>, a3: SafeArgForFn<T3, A3>, a4: SafeArgForFn<T4, A4>): IfValueSource<T2 | T3 | T4, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: SafeArgForFn<T2, A2>, a3: SafeArgForFn<T3, A3>, a4: SafeArgForFn<T4, A4>): IfValueSource<T1 | T2 | T3 | T4, RESULT>
}

export interface FargmentFunctionIfValue5TypeSafe<DB extends AnyDB, A1, A2, A3, A4, A5, RESULT> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<NoTableOrViewRequired<DB>, RESULT>
    <T1 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<T1, RESULT>
    <T2 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: SafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<T2, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: SafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | T2, RESULT>
    <T3 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: SafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<T3, RESULT>
    <T1 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: SafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | T3, RESULT>
    <T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: SafeArgForFn<T2, A2>, a3: SafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<T2 | T3, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: SafeArgForFn<T2, A2>, a3: SafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | T2 | T3, RESULT>
    <T4 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: SafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T4, RESULT>
    <T1 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: SafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | T4, RESULT>
    <T2 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: SafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: SafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T2 | T4, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: SafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: SafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | T2 | T4, RESULT>
    <T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: SafeArgForFn<T3, A3>, a4: SafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T3 | T4, RESULT>
    <T1 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: SafeArgForFn<T3, A3>, a4: SafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | T3 | T4, RESULT>
    <T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: SafeArgForFn<T2, A2>, a3: SafeArgForFn<T3, A3>, a4: SafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T2 | T3 | T4, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: SafeArgForFn<T2, A2>, a3: SafeArgForFn<T3, A3>, a4: SafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | T2 | T3 | T4, RESULT>

    <T5 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: SafeArgForFn<T5, A5>): IfValueSource<T5, RESULT>
    <T1 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: SafeArgForFn<T5, A5>): IfValueSource<T1 | T5, RESULT>
    <T2 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: SafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: SafeArgForFn<T5, A5>): IfValueSource<T2 | T5, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: SafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: SafeArgForFn<T5, A5>): IfValueSource<T1 | T2 | T5, RESULT>
    <T3 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: SafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: SafeArgForFn<T5, A5>): IfValueSource<T3 | T5, RESULT>
    <T1 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: SafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: SafeArgForFn<T5, A5>): IfValueSource<T1 | T3 | T5, RESULT>
    <T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: SafeArgForFn<T2, A2>, a3: SafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: SafeArgForFn<T5, A5>): IfValueSource<T2 | T3 | T5, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: SafeArgForFn<T2, A2>, a3: SafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: SafeArgForFn<T5, A5>): IfValueSource<T1 | T2 | T3 | T5, RESULT>
    <T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: SafeArgForFn<T4, A4>, a5: SafeArgForFn<T5, A5>): IfValueSource<T4 | T5, RESULT>
    <T1 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: SafeArgForFn<T4, A4>, a5: SafeArgForFn<T5, A5>): IfValueSource<T1 | T4 | T5, RESULT>
    <T2 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: SafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: SafeArgForFn<T4, A4>, a5: SafeArgForFn<T5, A5>): IfValueSource<T2 | T4 | T5, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: SafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: SafeArgForFn<T4, A4>, a5: SafeArgForFn<T5, A5>): IfValueSource<T1 | T2 | T4 | T5, RESULT>
    <T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: SafeArgForFn<T3, A3>, a4: SafeArgForFn<T4, A4>, a5: SafeArgForFn<T5, A5>): IfValueSource<T3 | T4 | T5, RESULT>
    <T1 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: SafeArgForFn<T3, A3>, a4: SafeArgForFn<T4, A4>, a5: SafeArgForFn<T5, A5>): IfValueSource<T1 | T3 | T4 | T5, RESULT>
    <T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: SafeArgForFn<T2, A2>, a3: SafeArgForFn<T3, A3>, a4: SafeArgForFn<T4, A4>, a5: SafeArgForFn<T5, A5>): IfValueSource<T2 | T3 | T4 | T5, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: SafeArgForFn<T1, A1>, a2: SafeArgForFn<T2, A2>, a3: SafeArgForFn<T3, A3>, a4: SafeArgForFn<T4, A4>, a5: SafeArgForFn<T5, A5>): IfValueSource<T1 | T2 | T3 | T4 | T5, RESULT>
}

export interface FargmentFunctionIfValue1TypeUnsafe<DB extends AnyDB, A1, RESULT> {
    (a1: TypeOfArgument<A1>): IfValueSource<NoTableOrViewRequired<DB>, RESULT>
    <T1 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>): IfValueSource<T1, RESULT>
}

export interface FargmentFunctionIfValue2TypeUnsafe<DB extends AnyDB, A1, A2, RESULT> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>): IfValueSource<NoTableOrViewRequired<DB>, RESULT>
    <T1 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>): IfValueSource<T1, RESULT>

    <T2 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>): IfValueSource<T2, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>): IfValueSource<T1 | T2, RESULT>
}

export interface FargmentFunctionIfValue3TypeUnsafe<DB extends AnyDB, A1, A2, A3, RESULT> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>): IfValueSource<NoTableOrViewRequired<DB>, RESULT>
    <T1 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>): IfValueSource<T1, RESULT>
    <T2 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>): IfValueSource<T2, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>): IfValueSource<T1 | T2, RESULT>

    <T3 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>): IfValueSource<T3, RESULT>
    <T1 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>): IfValueSource<T1 | T3, RESULT>
    <T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>): IfValueSource<T2 | T3, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>): IfValueSource<T1 | T2 | T3, RESULT>
}

export interface FargmentFunctionIfValue4TypeUnsafe<DB extends AnyDB, A1, A2, A3, A4, RESULT> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): IfValueSource<NoTableOrViewRequired<DB>, RESULT>
    <T1 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): IfValueSource<T1, RESULT>
    <T2 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): IfValueSource<T2, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): IfValueSource<T1 | T2, RESULT>
    <T3 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>): IfValueSource<T3, RESULT>
    <T1 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>): IfValueSource<T1 | T3, RESULT>
    <T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>): IfValueSource<T2 | T3, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>): IfValueSource<T1 | T2 | T3, RESULT>

    <T4 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>): IfValueSource<T4, RESULT>
    <T1 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>): IfValueSource<T1 | T4, RESULT>
    <T2 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>): IfValueSource<T2 | T4, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>): IfValueSource<T1 | T2 | T4, RESULT>
    <T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>): IfValueSource<T3 | T4, RESULT>
    <T1 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>): IfValueSource<T1 | T3 | T4, RESULT>
    <T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>): IfValueSource<T2 | T3 | T4, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>): IfValueSource<T1 | T2 | T3 | T4, RESULT>
}

export interface FargmentFunctionIfValue5TypeUnsafe<DB extends AnyDB, A1, A2, A3, A4, A5, RESULT> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<NoTableOrViewRequired<DB>, RESULT>
    <T1 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<T1, RESULT>
    <T2 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<T2, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | T2, RESULT>
    <T3 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<T3, RESULT>
    <T1 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | T3, RESULT>
    <T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<T2 | T3, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | T2 | T3, RESULT>
    <T4 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T4, RESULT>
    <T1 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | T4, RESULT>
    <T2 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T2 | T4, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | T2 | T4, RESULT>
    <T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T3 | T4, RESULT>
    <T1 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | T3 | T4, RESULT>
    <T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T2 | T3 | T4, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | T2 | T3 | T4, RESULT>

    <T5 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: UnsafeArgForFn<T5, A5>): IfValueSource<T5, RESULT>
    <T1 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: UnsafeArgForFn<T5, A5>): IfValueSource<T1 | T5, RESULT>
    <T2 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: UnsafeArgForFn<T5, A5>): IfValueSource<T2 | T5, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: UnsafeArgForFn<T5, A5>): IfValueSource<T1 | T2 | T5, RESULT>
    <T3 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: UnsafeArgForFn<T5, A5>): IfValueSource<T3 | T5, RESULT>
    <T1 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: UnsafeArgForFn<T5, A5>): IfValueSource<T1 | T3 | T5, RESULT>
    <T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: UnsafeArgForFn<T5, A5>): IfValueSource<T2 | T3 | T5, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: UnsafeArgForFn<T5, A5>): IfValueSource<T1 | T2 | T3 | T5, RESULT>
    <T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>, a5: UnsafeArgForFn<T5, A5>): IfValueSource<T4 | T5, RESULT>
    <T1 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>, a5: UnsafeArgForFn<T5, A5>): IfValueSource<T1 | T4 | T5, RESULT>
    <T2 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>, a5: UnsafeArgForFn<T5, A5>): IfValueSource<T2 | T4 | T5, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>, a5: UnsafeArgForFn<T5, A5>): IfValueSource<T1 | T2 | T4 | T5, RESULT>
    <T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>, a5: UnsafeArgForFn<T5, A5>): IfValueSource<T3 | T4 | T5, RESULT>
    <T1 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>, a5: UnsafeArgForFn<T5, A5>): IfValueSource<T1 | T3 | T4 | T5, RESULT>
    <T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>, a5: UnsafeArgForFn<T5, A5>): IfValueSource<T2 | T3 | T4 | T5, RESULT>
    <T1 extends TableOrViewRef<DB>, T2 extends TableOrViewRef<DB>, T3 extends TableOrViewRef<DB>, T4 extends TableOrViewRef<DB>, T5 extends TableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>, a5: UnsafeArgForFn<T5, A5>): IfValueSource<T1 | T2 | T3 | T4 | T5, RESULT>
}
