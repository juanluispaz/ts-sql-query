import type { AnyDB } from "../databases"
import type { ITableOrView, NoTableOrViewRequired } from "../utils/ITableOrView"
import type { BooleanValueSource, NumberValueSource, StringValueSource, DateValueSource, TimeValueSource, DateTimeValueSource, EqualableValueSource, IntValueSource, DoubleValueSource, LocalDateValueSource, LocalTimeValueSource, LocalDateTimeValueSource, TypeSafeStringValueSource, StringNumberValueSource, StringIntValueSource, StringDoubleValueSource, ValueSource, ComparableValueSource, MapArgumentToTypeSafe, RemapValueSourceType, TypeOfArgument, MapArgumentToTypeUnsafe } from "../expressions/values"

export interface BooleanFragmentExpression<DB extends AnyDB, TYPE> {
    sql(sql: TemplateStringsArray):  BooleanValueSource<DB, NoTableOrViewRequired, TYPE>
    sql<T1 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>): BooleanValueSource<DB, T1, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>): BooleanValueSource<DB, T1 | T2, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>): BooleanValueSource<DB, T1 | T2 | T3, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>): BooleanValueSource<DB, T1 | T2 | T3 | T4, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>, p5: ValueSource<DB, T5, any>): BooleanValueSource<DB, T1 | T2 | T3 | T4 | T5, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>, T6 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>, p5: ValueSource<DB, T5, any>, p6: ValueSource<DB, T6, any>): BooleanValueSource<DB, T1 | T2 | T3 | T4 | T5 | T6, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>, T6 extends ITableOrView<DB>, T7 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>, p5: ValueSource<DB, T5, any>, p6: ValueSource<DB, T6, any>, p7: ValueSource<DB, T7, any>): BooleanValueSource<DB, T1 | T2 | T3 | T4 | T5 | T6 | T7, TYPE>
    sql<T extends ITableOrView<DB>>(sql: TemplateStringsArray, ...p: ValueSource<DB, T, any>[]): BooleanValueSource<DB, T, TYPE>
}

export interface StringIntFragmentExpression<DB extends AnyDB, TYPE> {
    sql(sql: TemplateStringsArray):  StringIntValueSource<DB, NoTableOrViewRequired, TYPE>
    sql<T1 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>): StringIntValueSource<DB, T1, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>): StringIntValueSource<DB, T1 | T2, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>): StringIntValueSource<DB, T1 | T2 | T3, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>): StringIntValueSource<DB, T1 | T2 | T3 | T4, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>, p5: ValueSource<DB, T5, any>): StringIntValueSource<DB, T1 | T2 | T3 | T4 | T5, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>, T6 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>, p5: ValueSource<DB, T5, any>, p6: ValueSource<DB, T6, any>): StringIntValueSource<DB, T1 | T2 | T3 | T4 | T5 | T6, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>, T6 extends ITableOrView<DB>, T7 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>, p5: ValueSource<DB, T5, any>, p6: ValueSource<DB, T6, any>, p7: ValueSource<DB, T7, any>): StringIntValueSource<DB, T1 | T2 | T3 | T4 | T5 | T6 | T7, TYPE>
    sql<T extends ITableOrView<DB>>(sql: TemplateStringsArray, ...p: ValueSource<DB, T, any>[]): StringIntValueSource<DB, T, TYPE>
}

export interface StringNumberFragmentExpression<DB extends AnyDB, TYPE> {
    sql(sql: TemplateStringsArray):  StringNumberValueSource<DB, NoTableOrViewRequired, TYPE>
    sql<T1 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>): StringNumberValueSource<DB, T1, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>): StringNumberValueSource<DB, T1 | T2, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>): StringNumberValueSource<DB, T1 | T2 | T3, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>): StringNumberValueSource<DB, T1 | T2 | T3 | T4, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>, p5: ValueSource<DB, T5, any>): StringNumberValueSource<DB, T1 | T2 | T3 | T4 | T5, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>, T6 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>, p5: ValueSource<DB, T5, any>, p6: ValueSource<DB, T6, any>): StringNumberValueSource<DB, T1 | T2 | T3 | T4 | T5 | T6, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>, T6 extends ITableOrView<DB>, T7 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>, p5: ValueSource<DB, T5, any>, p6: ValueSource<DB, T6, any>, p7: ValueSource<DB, T7, any>): StringNumberValueSource<DB, T1 | T2 | T3 | T4 | T5 | T6 | T7, TYPE>
    sql<T extends ITableOrView<DB>>(sql: TemplateStringsArray, ...p: ValueSource<DB, T, any>[]): StringNumberValueSource<DB, T, TYPE>
}

export interface IntFragmentExpression<DB extends AnyDB, TYPE> {
    sql(sql: TemplateStringsArray):  IntValueSource<DB, NoTableOrViewRequired, TYPE>
    sql<T1 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>): IntValueSource<DB, T1, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>): IntValueSource<DB, T1 | T2, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>): IntValueSource<DB, T1 | T2 | T3, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>): IntValueSource<DB, T1 | T2 | T3 | T4, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>, p5: ValueSource<DB, T5, any>): IntValueSource<DB, T1 | T2 | T3 | T4 | T5, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>, T6 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>, p5: ValueSource<DB, T5, any>, p6: ValueSource<DB, T6, any>): IntValueSource<DB, T1 | T2 | T3 | T4 | T5 | T6, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>, T6 extends ITableOrView<DB>, T7 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>, p5: ValueSource<DB, T5, any>, p6: ValueSource<DB, T6, any>, p7: ValueSource<DB, T7, any>): IntValueSource<DB, T1 | T2 | T3 | T4 | T5 | T6 | T7, TYPE>
    sql<T extends ITableOrView<DB>>(sql: TemplateStringsArray, ...p: ValueSource<DB, T, any>[]): IntValueSource<DB, T, TYPE>
}

export interface NumberFragmentExpression<DB extends AnyDB, TYPE> {
    sql(sql: TemplateStringsArray):  NumberValueSource<DB, NoTableOrViewRequired, TYPE>
    sql<T1 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>): NumberValueSource<DB, T1, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>): NumberValueSource<DB, T1 | T2, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>): NumberValueSource<DB, T1 | T2 | T3, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>): NumberValueSource<DB, T1 | T2 | T3 | T4, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>, p5: ValueSource<DB, T5, any>): NumberValueSource<DB, T1 | T2 | T3 | T4 | T5, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>, T6 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>, p5: ValueSource<DB, T5, any>, p6: ValueSource<DB, T6, any>): NumberValueSource<DB, T1 | T2 | T3 | T4 | T5 | T6, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>, T6 extends ITableOrView<DB>, T7 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>, p5: ValueSource<DB, T5, any>, p6: ValueSource<DB, T6, any>, p7: ValueSource<DB, T7, any>): NumberValueSource<DB, T1 | T2 | T3 | T4 | T5 | T6 | T7, TYPE>
    sql<T extends ITableOrView<DB>>(sql: TemplateStringsArray, ...p: ValueSource<DB, T, any>[]): NumberValueSource<DB, T, TYPE>
}

export interface StringDoubleFragmentExpression<DB extends AnyDB, TYPE> {
    sql(sql: TemplateStringsArray):  StringDoubleValueSource<DB, NoTableOrViewRequired, TYPE>
    sql<T1 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>): StringDoubleValueSource<DB, T1, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>): StringDoubleValueSource<DB, T1 | T2, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>): StringDoubleValueSource<DB, T1 | T2 | T3, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>): StringDoubleValueSource<DB, T1 | T2 | T3 | T4, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>, p5: ValueSource<DB, T5, any>): StringDoubleValueSource<DB, T1 | T2 | T3 | T4 | T5, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>, T6 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>, p5: ValueSource<DB, T5, any>, p6: ValueSource<DB, T6, any>): StringDoubleValueSource<DB, T1 | T2 | T3 | T4 | T5 | T6, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>, T6 extends ITableOrView<DB>, T7 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>, p5: ValueSource<DB, T5, any>, p6: ValueSource<DB, T6, any>, p7: ValueSource<DB, T7, any>): StringDoubleValueSource<DB, T1 | T2 | T3 | T4 | T5 | T6 | T7, TYPE>
    sql<T extends ITableOrView<DB>>(sql: TemplateStringsArray, ...p: ValueSource<DB, T, any>[]): StringDoubleValueSource<DB, T, TYPE>
}

export interface DoubleFragmentExpression<DB extends AnyDB, TYPE> {
    sql(sql: TemplateStringsArray):  DoubleValueSource<DB, NoTableOrViewRequired, TYPE>
    sql<T1 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>): DoubleValueSource<DB, T1, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>): DoubleValueSource<DB, T1 | T2, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>): DoubleValueSource<DB, T1 | T2 | T3, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>): DoubleValueSource<DB, T1 | T2 | T3 | T4, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>, p5: ValueSource<DB, T5, any>): DoubleValueSource<DB, T1 | T2 | T3 | T4 | T5, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>, T6 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>, p5: ValueSource<DB, T5, any>, p6: ValueSource<DB, T6, any>): DoubleValueSource<DB, T1 | T2 | T3 | T4 | T5 | T6, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>, T6 extends ITableOrView<DB>, T7 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>, p5: ValueSource<DB, T5, any>, p6: ValueSource<DB, T6, any>, p7: ValueSource<DB, T7, any>): DoubleValueSource<DB, T1 | T2 | T3 | T4 | T5 | T6 | T7, TYPE>
    sql<T extends ITableOrView<DB>>(sql: TemplateStringsArray, ...p: ValueSource<DB, T, any>[]): DoubleValueSource<DB, T, TYPE>
}

export interface TypeSafeStringFragmentExpression<DB extends AnyDB, TYPE> {
    sql(sql: TemplateStringsArray):  TypeSafeStringValueSource<DB, NoTableOrViewRequired, TYPE>
    sql<T1 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>): TypeSafeStringValueSource<DB, T1, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>): TypeSafeStringValueSource<DB, T1 | T2, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>): TypeSafeStringValueSource<DB, T1 | T2 | T3, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>): TypeSafeStringValueSource<DB, T1 | T2 | T3 | T4, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>, p5: ValueSource<DB, T5, any>): TypeSafeStringValueSource<DB, T1 | T2 | T3 | T4 | T5, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>, T6 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>, p5: ValueSource<DB, T5, any>, p6: ValueSource<DB, T6, any>): TypeSafeStringValueSource<DB, T1 | T2 | T3 | T4 | T5 | T6, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>, T6 extends ITableOrView<DB>, T7 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>, p5: ValueSource<DB, T5, any>, p6: ValueSource<DB, T6, any>, p7: ValueSource<DB, T7, any>): TypeSafeStringValueSource<DB, T1 | T2 | T3 | T4 | T5 | T6 | T7, TYPE>
    sql<T extends ITableOrView<DB>>(sql: TemplateStringsArray, ...p: ValueSource<DB, T, any>[]): TypeSafeStringValueSource<DB, T, TYPE>
}

export interface StringFragmentExpression<DB extends AnyDB, TYPE> {
    sql(sql: TemplateStringsArray):  StringValueSource<DB, NoTableOrViewRequired, TYPE>
    sql<T1 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>): StringValueSource<DB, T1, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>): StringValueSource<DB, T1 | T2, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>): StringValueSource<DB, T1 | T2 | T3, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>): StringValueSource<DB, T1 | T2 | T3 | T4, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>, p5: ValueSource<DB, T5, any>): StringValueSource<DB, T1 | T2 | T3 | T4 | T5, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>, T6 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>, p5: ValueSource<DB, T5, any>, p6: ValueSource<DB, T6, any>): StringValueSource<DB, T1 | T2 | T3 | T4 | T5 | T6, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>, T6 extends ITableOrView<DB>, T7 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>, p5: ValueSource<DB, T5, any>, p6: ValueSource<DB, T6, any>, p7: ValueSource<DB, T7, any>): StringValueSource<DB, T1 | T2 | T3 | T4 | T5 | T6 | T7, TYPE>
    sql<T extends ITableOrView<DB>>(sql: TemplateStringsArray, ...p: ValueSource<DB, T, any>[]): StringValueSource<DB, T, TYPE>
}

export interface LocalDateFragmentExpression<DB extends AnyDB, TYPE> {
    sql(sql: TemplateStringsArray):  LocalDateValueSource<DB, NoTableOrViewRequired, TYPE>
    sql<T1 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>): LocalDateValueSource<DB, T1, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>): LocalDateValueSource<DB, T1 | T2, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>): LocalDateValueSource<DB, T1 | T2 | T3, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>): LocalDateValueSource<DB, T1 | T2 | T3 | T4, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>, p5: ValueSource<DB, T5, any>): LocalDateValueSource<DB, T1 | T2 | T3 | T4 | T5, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>, T6 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>, p5: ValueSource<DB, T5, any>, p6: ValueSource<DB, T6, any>): LocalDateValueSource<DB, T1 | T2 | T3 | T4 | T5 | T6, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>, T6 extends ITableOrView<DB>, T7 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>, p5: ValueSource<DB, T5, any>, p6: ValueSource<DB, T6, any>, p7: ValueSource<DB, T7, any>): LocalDateValueSource<DB, T1 | T2 | T3 | T4 | T5 | T6 | T7, TYPE>
    sql<T extends ITableOrView<DB>>(sql: TemplateStringsArray, ...p: ValueSource<DB, T, any>[]): LocalDateValueSource<DB, T, TYPE>
}

export interface DateFragmentExpression<DB extends AnyDB, TYPE> {
    sql(sql: TemplateStringsArray):  DateValueSource<DB, NoTableOrViewRequired, TYPE>
    sql<T1 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>): DateValueSource<DB, T1, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>): DateValueSource<DB, T1 | T2, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>): DateValueSource<DB, T1 | T2 | T3, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>): DateValueSource<DB, T1 | T2 | T3 | T4, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>, p5: ValueSource<DB, T5, any>): DateValueSource<DB, T1 | T2 | T3 | T4 | T5, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>, T6 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>, p5: ValueSource<DB, T5, any>, p6: ValueSource<DB, T6, any>): DateValueSource<DB, T1 | T2 | T3 | T4 | T5 | T6, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>, T6 extends ITableOrView<DB>, T7 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>, p5: ValueSource<DB, T5, any>, p6: ValueSource<DB, T6, any>, p7: ValueSource<DB, T7, any>): DateValueSource<DB, T1 | T2 | T3 | T4 | T5 | T6 | T7, TYPE>
    sql<T extends ITableOrView<DB>>(sql: TemplateStringsArray, ...p: ValueSource<DB, T, any>[]): DateValueSource<DB, T, TYPE>
}

export interface LocalTimeFragmentExpression<DB extends AnyDB, TYPE> {
    sql(sql: TemplateStringsArray):  LocalTimeValueSource<DB, NoTableOrViewRequired, TYPE>
    sql<T1 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>): LocalTimeValueSource<DB, T1, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>): LocalTimeValueSource<DB, T1 | T2, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>): LocalTimeValueSource<DB, T1 | T2 | T3, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>): LocalTimeValueSource<DB, T1 | T2 | T3 | T4, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>, p5: ValueSource<DB, T5, any>): LocalTimeValueSource<DB, T1 | T2 | T3 | T4 | T5, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>, T6 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>, p5: ValueSource<DB, T5, any>, p6: ValueSource<DB, T6, any>): LocalTimeValueSource<DB, T1 | T2 | T3 | T4 | T5 | T6, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>, T6 extends ITableOrView<DB>, T7 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>, p5: ValueSource<DB, T5, any>, p6: ValueSource<DB, T6, any>, p7: ValueSource<DB, T7, any>): LocalTimeValueSource<DB, T1 | T2 | T3 | T4 | T5 | T6 | T7, TYPE>
    sql<T extends ITableOrView<DB>>(sql: TemplateStringsArray, ...p: ValueSource<DB, T, any>[]): LocalTimeValueSource<DB, T, TYPE>
}

export interface TimeFragmentExpression<DB extends AnyDB, TYPE> {
    sql(sql: TemplateStringsArray):  TimeValueSource<DB, NoTableOrViewRequired, TYPE>
    sql<T1 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>): TimeValueSource<DB, T1, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>): TimeValueSource<DB, T1 | T2, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>): TimeValueSource<DB, T1 | T2 | T3, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>): TimeValueSource<DB, T1 | T2 | T3 | T4, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>, p5: ValueSource<DB, T5, any>): TimeValueSource<DB, T1 | T2 | T3 | T4 | T5, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>, T6 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>, p5: ValueSource<DB, T5, any>, p6: ValueSource<DB, T6, any>): TimeValueSource<DB, T1 | T2 | T3 | T4 | T5 | T6, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>, T6 extends ITableOrView<DB>, T7 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>, p5: ValueSource<DB, T5, any>, p6: ValueSource<DB, T6, any>, p7: ValueSource<DB, T7, any>): TimeValueSource<DB, T1 | T2 | T3 | T4 | T5 | T6 | T7, TYPE>
    sql<T extends ITableOrView<DB>>(sql: TemplateStringsArray, ...p: ValueSource<DB, T, any>[]): TimeValueSource<DB, T, TYPE>
}

export interface LocalDateTimeFragmentExpression<DB extends AnyDB, TYPE> {
    sql(sql: TemplateStringsArray):  LocalDateTimeValueSource<DB, NoTableOrViewRequired, TYPE>
    sql<T1 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>): LocalDateTimeValueSource<DB, T1, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>): LocalDateTimeValueSource<DB, T1 | T2, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>): LocalDateTimeValueSource<DB, T1 | T2 | T3, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>): LocalDateTimeValueSource<DB, T1 | T2 | T3 | T4, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>, p5: ValueSource<DB, T5, any>): LocalDateTimeValueSource<DB, T1 | T2 | T3 | T4 | T5, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>, T6 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>, p5: ValueSource<DB, T5, any>, p6: ValueSource<DB, T6, any>): LocalDateTimeValueSource<DB, T1 | T2 | T3 | T4 | T5 | T6, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>, T6 extends ITableOrView<DB>, T7 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>, p5: ValueSource<DB, T5, any>, p6: ValueSource<DB, T6, any>, p7: ValueSource<DB, T7, any>): LocalDateTimeValueSource<DB, T1 | T2 | T3 | T4 | T5 | T6 | T7, TYPE>
    sql<T extends ITableOrView<DB>>(sql: TemplateStringsArray, ...p: ValueSource<DB, T, any>[]): LocalDateTimeValueSource<DB, T, TYPE>
}

export interface DateTimeFragmentExpression<DB extends AnyDB, TYPE> {
    sql(sql: TemplateStringsArray):  DateTimeValueSource<DB, NoTableOrViewRequired, TYPE>
    sql<T1 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>): DateTimeValueSource<DB, T1, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>): DateTimeValueSource<DB, T1 | T2, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>): DateTimeValueSource<DB, T1 | T2 | T3, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>): DateTimeValueSource<DB, T1 | T2 | T3 | T4, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>, p5: ValueSource<DB, T5, any>): DateTimeValueSource<DB, T1 | T2 | T3 | T4 | T5, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>, T6 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>, p5: ValueSource<DB, T5, any>, p6: ValueSource<DB, T6, any>): DateTimeValueSource<DB, T1 | T2 | T3 | T4 | T5 | T6, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>, T6 extends ITableOrView<DB>, T7 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>, p5: ValueSource<DB, T5, any>, p6: ValueSource<DB, T6, any>, p7: ValueSource<DB, T7, any>): DateTimeValueSource<DB, T1 | T2 | T3 | T4 | T5 | T6 | T7, TYPE>
    sql<T extends ITableOrView<DB>>(sql: TemplateStringsArray, ...p: ValueSource<DB, T, any>[]): DateTimeValueSource<DB, T, TYPE>
}

export interface EqualableFragmentExpression<DB extends AnyDB, TYPE> {
    sql(sql: TemplateStringsArray):  EqualableValueSource<DB, NoTableOrViewRequired, TYPE>
    sql<T1 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>): EqualableValueSource<DB, T1, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>): EqualableValueSource<DB, T1 | T2, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>): EqualableValueSource<DB, T1 | T2 | T3, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>): EqualableValueSource<DB, T1 | T2 | T3 | T4, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>, p5: ValueSource<DB, T5, any>): EqualableValueSource<DB, T1 | T2 | T3 | T4 | T5, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>, T6 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>, p5: ValueSource<DB, T5, any>, p6: ValueSource<DB, T6, any>): EqualableValueSource<DB, T1 | T2 | T3 | T4 | T5 | T6, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>, T6 extends ITableOrView<DB>, T7 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>, p5: ValueSource<DB, T5, any>, p6: ValueSource<DB, T6, any>, p7: ValueSource<DB, T7, any>): EqualableValueSource<DB, T1 | T2 | T3 | T4 | T5 | T6 | T7, TYPE>
    sql<T extends ITableOrView<DB>>(sql: TemplateStringsArray, ...p: ValueSource<DB, T, any>[]): EqualableValueSource<DB, T, TYPE>
}

export interface ComparableFragmentExpression<DB extends AnyDB, TYPE> {
    sql(sql: TemplateStringsArray):  ComparableValueSource<DB, NoTableOrViewRequired, TYPE>
    sql<T1 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>): ComparableValueSource<DB, T1, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>): ComparableValueSource<DB, T1 | T2, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>): ComparableValueSource<DB, T1 | T2 | T3, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>): ComparableValueSource<DB, T1 | T2 | T3 | T4, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>, p5: ValueSource<DB, T5, any>): ComparableValueSource<DB, T1 | T2 | T3 | T4 | T5, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>, T6 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>, p5: ValueSource<DB, T5, any>, p6: ValueSource<DB, T6, any>): ComparableValueSource<DB, T1 | T2 | T3 | T4 | T5 | T6, TYPE>
    sql<T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>, T6 extends ITableOrView<DB>, T7 extends ITableOrView<DB>>(sql: TemplateStringsArray, p1: ValueSource<DB, T1, any>, p2: ValueSource<DB, T2, any>, p3: ValueSource<DB, T3, any>, p4: ValueSource<DB, T4, any>, p5: ValueSource<DB, T5, any>, p6: ValueSource<DB, T6, any>, p7: ValueSource<DB, T7, any>): ComparableValueSource<DB, T1 | T2 | T3 | T4 | T5 | T6 | T7, TYPE>
    sql<T extends ITableOrView<DB>>(sql: TemplateStringsArray, ...p: ValueSource<DB, T, any>[]): ComparableValueSource<DB, T, TYPE>
}

export interface FragmentBuilder0<DB extends AnyDB> {
    as<RESULT extends ValueSource<DB, NoTableOrViewRequired, any>>(impl: () => RESULT): () => RESULT
}

export interface FragmentBuilder1TypeSafe<DB extends AnyDB, A1> {
    as<RESULT extends ValueSource<DB, NoTableOrViewRequired, any>>(impl: (a1: MapArgumentToTypeSafe<DB, NoTableOrViewRequired, A1>) => RESULT): FargmentFunction1TypeSafe<DB, A1, RESULT>
}

export interface FargmentFunction1TypeSafe<DB extends AnyDB, A1, RESULT> {
    (a1: TypeOfArgument<A1>): RemapValueSourceType<DB, NoTableOrViewRequired, RESULT>
    <T1 extends ITableOrView<DB>>(a1: MapArgumentToTypeSafe<DB, T1, A1>): RemapValueSourceType<DB, T1, RESULT>
}

export interface FragmentBuilder1TypeUnsafe<DB extends AnyDB, A1> {
    as<RESULT extends ValueSource<DB, NoTableOrViewRequired, any>>(impl: (a1: MapArgumentToTypeUnsafe<DB, NoTableOrViewRequired, A1>) => RESULT): FargmentFunction1TypeUnsafe<DB, A1, RESULT>
}

export interface FargmentFunction1TypeUnsafe<DB extends AnyDB, A1, RESULT> {
    (a1: TypeOfArgument<A1>): RemapValueSourceType<DB, NoTableOrViewRequired, RESULT>
    <T1 extends ITableOrView<DB>>(a1: MapArgumentToTypeUnsafe<DB, T1, A1>): RemapValueSourceType<DB, T1, RESULT>
}

export interface FragmentBuilder2TypeSafe<DB extends AnyDB, A1, A2> {
    as<RESULT extends ValueSource<DB, NoTableOrViewRequired, any>>(impl: (a1: MapArgumentToTypeSafe<DB, NoTableOrViewRequired, A1>, a2: MapArgumentToTypeSafe<DB, NoTableOrViewRequired, A2>) => RESULT): FargmentFunction2TypeSafe<DB, A1, A2, RESULT>
}

export interface FargmentFunction2TypeSafe<DB extends AnyDB, A1, A2, RESULT> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>): RemapValueSourceType<DB, NoTableOrViewRequired, RESULT>
    <T1 extends ITableOrView<DB>>(a1: MapArgumentToTypeSafe<DB, T1, A1>, a2: TypeOfArgument<A2>): RemapValueSourceType<DB, T1, RESULT>

    <T2 extends ITableOrView<DB>>(a1: TypeOfArgument<A1>, a2: MapArgumentToTypeSafe<DB, T2, A2>): RemapValueSourceType<DB, T2, RESULT>
    <T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>>(a1: MapArgumentToTypeSafe<DB, T1, A1>, a2: MapArgumentToTypeSafe<DB, T2, A2>): RemapValueSourceType<DB, T1 | T2, RESULT>
}

export interface FragmentBuilder2TypeUnsafe<DB extends AnyDB, A1, A2> {
    as<RESULT extends ValueSource<DB, NoTableOrViewRequired, any>>(impl: (a1: MapArgumentToTypeUnsafe<DB, NoTableOrViewRequired, A1>, a2: MapArgumentToTypeUnsafe<DB, NoTableOrViewRequired, A2>) => RESULT): FargmentFunction2TypeUnsafe<DB, A1, A2, RESULT>
}

export interface FargmentFunction2TypeUnsafe<DB extends AnyDB, A1, A2, RESULT> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>): RemapValueSourceType<DB, NoTableOrViewRequired, RESULT>
    <T1 extends ITableOrView<DB>>(a1: MapArgumentToTypeUnsafe<DB, T1, A1>, a2: TypeOfArgument<A2>): RemapValueSourceType<DB, T1, RESULT>

    <T2 extends ITableOrView<DB>>(a1: TypeOfArgument<A1>, a2: MapArgumentToTypeUnsafe<DB, T2, A2>): RemapValueSourceType<DB, T2, RESULT>
    <T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>>(a1: MapArgumentToTypeUnsafe<DB, T1, A1>, a2: MapArgumentToTypeUnsafe<DB, T2, A2>): RemapValueSourceType<DB, T1 | T2, RESULT>
}

export interface FragmentBuilder3TypeSafe<DB extends AnyDB, A1, A2, A3> {
    as<RESULT extends ValueSource<DB, NoTableOrViewRequired, any>>(impl: (a1: MapArgumentToTypeSafe<DB, NoTableOrViewRequired, A1>, a2: MapArgumentToTypeSafe<DB, NoTableOrViewRequired, A2>, a3: MapArgumentToTypeSafe<DB, NoTableOrViewRequired, A3>) => RESULT): FargmentFunction3TypeSafe<DB, A1, A2, A3, RESULT>
}

export interface FargmentFunction3TypeSafe<DB extends AnyDB, A1, A2, A3, RESULT> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>): RemapValueSourceType<DB, NoTableOrViewRequired, RESULT>
    <T1 extends ITableOrView<DB>>(a1: MapArgumentToTypeSafe<DB, T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>): RemapValueSourceType<DB, T1, RESULT>
    <T2 extends ITableOrView<DB>>(a1: TypeOfArgument<A1>, a2: MapArgumentToTypeSafe<DB, T2, A2>, a3: TypeOfArgument<A3>): RemapValueSourceType<DB, T2, RESULT>
    <T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>>(a1: MapArgumentToTypeSafe<DB, T1, A1>, a2: MapArgumentToTypeSafe<DB, T2, A2>, a3: TypeOfArgument<A3>): RemapValueSourceType<DB, T1 | T2, RESULT>

    <T3 extends ITableOrView<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: MapArgumentToTypeSafe<DB, T3, A3>): RemapValueSourceType<DB, T3, RESULT>
    <T1 extends ITableOrView<DB>, T3 extends ITableOrView<DB>>(a1: MapArgumentToTypeSafe<DB, T1, A1>, a2: TypeOfArgument<A2>, a3: MapArgumentToTypeSafe<DB, T3, A3>): RemapValueSourceType<DB, T1 | T3, RESULT>
    <T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>>(a1: TypeOfArgument<A1>, a2: MapArgumentToTypeSafe<DB, T2, A2>, a3: MapArgumentToTypeSafe<DB, T3, A3>): RemapValueSourceType<DB, T2 | T3, RESULT>
    <T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>>(a1: MapArgumentToTypeSafe<DB, T1, A1>, a2: MapArgumentToTypeSafe<DB, T2, A2>, a3: MapArgumentToTypeSafe<DB, T3, A3>): RemapValueSourceType<DB, T1 | T2 | T3, RESULT>
}

export interface FragmentBuilder3TypeUnsafe<DB extends AnyDB, A1, A2, A3> {
    as<RESULT extends ValueSource<DB, NoTableOrViewRequired, any>>(impl: (a1: MapArgumentToTypeUnsafe<DB, NoTableOrViewRequired, A1>, a2: MapArgumentToTypeUnsafe<DB, NoTableOrViewRequired, A2>, a3: MapArgumentToTypeUnsafe<DB, NoTableOrViewRequired, A3>) => RESULT): FargmentFunction3TypeUnsafe<DB, A1, A2, A3, RESULT>
}

export interface FargmentFunction3TypeUnsafe<DB extends AnyDB, A1, A2, A3, RESULT> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>): RemapValueSourceType<DB, NoTableOrViewRequired, RESULT>
    <T1 extends ITableOrView<DB>>(a1: MapArgumentToTypeUnsafe<DB, T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>): RemapValueSourceType<DB, T1, RESULT>
    <T2 extends ITableOrView<DB>>(a1: TypeOfArgument<A1>, a2: MapArgumentToTypeUnsafe<DB, T2, A2>, a3: TypeOfArgument<A3>): RemapValueSourceType<DB, T2, RESULT>
    <T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>>(a1: MapArgumentToTypeUnsafe<DB, T1, A1>, a2: MapArgumentToTypeUnsafe<DB, T2, A2>, a3: TypeOfArgument<A3>): RemapValueSourceType<DB, T1 | T2, RESULT>

    <T3 extends ITableOrView<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: MapArgumentToTypeUnsafe<DB, T3, A3>): RemapValueSourceType<DB, T3, RESULT>
    <T1 extends ITableOrView<DB>, T3 extends ITableOrView<DB>>(a1: MapArgumentToTypeUnsafe<DB, T1, A1>, a2: TypeOfArgument<A2>, a3: MapArgumentToTypeUnsafe<DB, T3, A3>): RemapValueSourceType<DB, T1 | T3, RESULT>
    <T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>>(a1: TypeOfArgument<A1>, a2: MapArgumentToTypeUnsafe<DB, T2, A2>, a3: MapArgumentToTypeUnsafe<DB, T3, A3>): RemapValueSourceType<DB, T2 | T3, RESULT>
    <T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>>(a1: MapArgumentToTypeUnsafe<DB, T1, A1>, a2: MapArgumentToTypeUnsafe<DB, T2, A2>, a3: MapArgumentToTypeUnsafe<DB, T3, A3>): RemapValueSourceType<DB, T1 | T2 | T3, RESULT>
}

export interface FragmentBuilder4TypeSafe<DB extends AnyDB, A1, A2, A3, A4> {
    as<RESULT extends ValueSource<DB, NoTableOrViewRequired, any>>(impl: (a1: MapArgumentToTypeSafe<DB, NoTableOrViewRequired, A1>, a2: MapArgumentToTypeSafe<DB, NoTableOrViewRequired, A2>, a3: MapArgumentToTypeSafe<DB, NoTableOrViewRequired, A3>, a4: MapArgumentToTypeSafe<DB, NoTableOrViewRequired, A4>) => RESULT): FargmentFunction4TypeSafe<DB, A1, A2, A3, A4, RESULT>
}

export interface FargmentFunction4TypeSafe<DB extends AnyDB, A1, A2, A3, A4, RESULT> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<DB, NoTableOrViewRequired, RESULT>
    <T1 extends ITableOrView<DB>>(a1: MapArgumentToTypeSafe<DB, T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<DB, T1, RESULT>
    <T2 extends ITableOrView<DB>>(a1: TypeOfArgument<A1>, a2: MapArgumentToTypeSafe<DB, T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<DB, T2, RESULT>
    <T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>>(a1: MapArgumentToTypeSafe<DB, T1, A1>, a2: MapArgumentToTypeSafe<DB, T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<DB, T1 | T2, RESULT>
    <T3 extends ITableOrView<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: MapArgumentToTypeSafe<DB, T3, A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<DB, T3, RESULT>
    <T1 extends ITableOrView<DB>, T3 extends ITableOrView<DB>>(a1: MapArgumentToTypeSafe<DB, T1, A1>, a2: TypeOfArgument<A2>, a3: MapArgumentToTypeSafe<DB, T3, A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<DB, T1 | T3, RESULT>
    <T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>>(a1: TypeOfArgument<A1>, a2: MapArgumentToTypeSafe<DB, T2, A2>, a3: MapArgumentToTypeSafe<DB, T3, A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<DB, T2 | T3, RESULT>
    <T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>>(a1: MapArgumentToTypeSafe<DB, T1, A1>, a2: MapArgumentToTypeSafe<DB, T2, A2>, a3: MapArgumentToTypeSafe<DB, T3, A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<DB, T1 | T2 | T3, RESULT>

    <T4 extends ITableOrView<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: MapArgumentToTypeSafe<DB, T4, A4>): RemapValueSourceType<DB, T4, RESULT>
    <T1 extends ITableOrView<DB>, T4 extends ITableOrView<DB>>(a1: MapArgumentToTypeSafe<DB, T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: MapArgumentToTypeSafe<DB, T4, A4>): RemapValueSourceType<DB, T1 | T4, RESULT>
    <T2 extends ITableOrView<DB>, T4 extends ITableOrView<DB>>(a1: TypeOfArgument<A1>, a2: MapArgumentToTypeSafe<DB, T2, A2>, a3: TypeOfArgument<A3>, a4: MapArgumentToTypeSafe<DB, T4, A4>): RemapValueSourceType<DB, T2 | T4, RESULT>
    <T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T4 extends ITableOrView<DB>>(a1: MapArgumentToTypeSafe<DB, T1, A1>, a2: MapArgumentToTypeSafe<DB, T2, A2>, a3: TypeOfArgument<A3>, a4: MapArgumentToTypeSafe<DB, T4, A4>): RemapValueSourceType<DB, T1 | T2 | T4, RESULT>
    <T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: MapArgumentToTypeSafe<DB, T3, A3>, a4: MapArgumentToTypeSafe<DB, T4, A4>): RemapValueSourceType<DB, T3 | T4, RESULT>
    <T1 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>>(a1: MapArgumentToTypeSafe<DB, T1, A1>, a2: TypeOfArgument<A2>, a3: MapArgumentToTypeSafe<DB, T3, A3>, a4: MapArgumentToTypeSafe<DB, T4, A4>): RemapValueSourceType<DB, T1 | T3 | T4, RESULT>
    <T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>>(a1: TypeOfArgument<A1>, a2: MapArgumentToTypeSafe<DB, T2, A2>, a3: MapArgumentToTypeSafe<DB, T3, A3>, a4: MapArgumentToTypeSafe<DB, T4, A4>): RemapValueSourceType<DB, T2 | T3 | T4, RESULT>
    <T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>>(a1: MapArgumentToTypeSafe<DB, T1, A1>, a2: MapArgumentToTypeSafe<DB, T2, A2>, a3: MapArgumentToTypeSafe<DB, T3, A3>, a4: MapArgumentToTypeSafe<DB, T4, A4>): RemapValueSourceType<DB, T1 | T2 | T3 | T4, RESULT>
}

export interface FragmentBuilder4TypeUnsafe<DB extends AnyDB, A1, A2, A3, A4> {
    as<RESULT extends ValueSource<DB, NoTableOrViewRequired, any>>(impl: (a1: MapArgumentToTypeUnsafe<DB, NoTableOrViewRequired, A1>, a2: MapArgumentToTypeUnsafe<DB, NoTableOrViewRequired, A2>, a3: MapArgumentToTypeUnsafe<DB, NoTableOrViewRequired, A3>, a4: MapArgumentToTypeUnsafe<DB, NoTableOrViewRequired, A4>) => RESULT): FargmentFunction4TypeUnsafe<DB, A1, A2, A3, A4, RESULT>
}

export interface FargmentFunction4TypeUnsafe<DB extends AnyDB, A1, A2, A3, A4, RESULT> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<DB, NoTableOrViewRequired, RESULT>
    <T1 extends ITableOrView<DB>>(a1: MapArgumentToTypeUnsafe<DB, T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<DB, T1, RESULT>
    <T2 extends ITableOrView<DB>>(a1: TypeOfArgument<A1>, a2: MapArgumentToTypeUnsafe<DB, T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<DB, T2, RESULT>
    <T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>>(a1: MapArgumentToTypeUnsafe<DB, T1, A1>, a2: MapArgumentToTypeUnsafe<DB, T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<DB, T1 | T2, RESULT>
    <T3 extends ITableOrView<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: MapArgumentToTypeUnsafe<DB, T3, A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<DB, T3, RESULT>
    <T1 extends ITableOrView<DB>, T3 extends ITableOrView<DB>>(a1: MapArgumentToTypeUnsafe<DB, T1, A1>, a2: TypeOfArgument<A2>, a3: MapArgumentToTypeUnsafe<DB, T3, A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<DB, T1 | T3, RESULT>
    <T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>>(a1: TypeOfArgument<A1>, a2: MapArgumentToTypeUnsafe<DB, T2, A2>, a3: MapArgumentToTypeUnsafe<DB, T3, A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<DB, T2 | T3, RESULT>
    <T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>>(a1: MapArgumentToTypeUnsafe<DB, T1, A1>, a2: MapArgumentToTypeUnsafe<DB, T2, A2>, a3: MapArgumentToTypeUnsafe<DB, T3, A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<DB, T1 | T2 | T3, RESULT>

    <T4 extends ITableOrView<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: MapArgumentToTypeUnsafe<DB, T4, A4>): RemapValueSourceType<DB, T4, RESULT>
    <T1 extends ITableOrView<DB>, T4 extends ITableOrView<DB>>(a1: MapArgumentToTypeUnsafe<DB, T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: MapArgumentToTypeUnsafe<DB, T4, A4>): RemapValueSourceType<DB, T1 | T4, RESULT>
    <T2 extends ITableOrView<DB>, T4 extends ITableOrView<DB>>(a1: TypeOfArgument<A1>, a2: MapArgumentToTypeUnsafe<DB, T2, A2>, a3: TypeOfArgument<A3>, a4: MapArgumentToTypeUnsafe<DB, T4, A4>): RemapValueSourceType<DB, T2 | T4, RESULT>
    <T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T4 extends ITableOrView<DB>>(a1: MapArgumentToTypeUnsafe<DB, T1, A1>, a2: MapArgumentToTypeUnsafe<DB, T2, A2>, a3: TypeOfArgument<A3>, a4: MapArgumentToTypeUnsafe<DB, T4, A4>): RemapValueSourceType<DB, T1 | T2 | T4, RESULT>
    <T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: MapArgumentToTypeUnsafe<DB, T3, A3>, a4: MapArgumentToTypeUnsafe<DB, T4, A4>): RemapValueSourceType<DB, T3 | T4, RESULT>
    <T1 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>>(a1: MapArgumentToTypeUnsafe<DB, T1, A1>, a2: TypeOfArgument<A2>, a3: MapArgumentToTypeUnsafe<DB, T3, A3>, a4: MapArgumentToTypeUnsafe<DB, T4, A4>): RemapValueSourceType<DB, T1 | T3 | T4, RESULT>
    <T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>>(a1: TypeOfArgument<A1>, a2: MapArgumentToTypeUnsafe<DB, T2, A2>, a3: MapArgumentToTypeUnsafe<DB, T3, A3>, a4: MapArgumentToTypeUnsafe<DB, T4, A4>): RemapValueSourceType<DB, T2 | T3 | T4, RESULT>
    <T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>>(a1: MapArgumentToTypeUnsafe<DB, T1, A1>, a2: MapArgumentToTypeUnsafe<DB, T2, A2>, a3: MapArgumentToTypeUnsafe<DB, T3, A3>, a4: MapArgumentToTypeUnsafe<DB, T4, A4>): RemapValueSourceType<DB, T1 | T2 | T3 | T4, RESULT>
}

export interface FragmentBuilder5TypeSafe<DB extends AnyDB, A1, A2, A3, A4, A5> {
    as<RESULT extends ValueSource<DB, NoTableOrViewRequired, any>>(impl: (a1: MapArgumentToTypeSafe<DB, NoTableOrViewRequired, A1>, a2: MapArgumentToTypeSafe<DB, NoTableOrViewRequired, A2>, a3: MapArgumentToTypeSafe<DB, NoTableOrViewRequired, A3>, a4: MapArgumentToTypeSafe<DB, NoTableOrViewRequired, A4>, a5: MapArgumentToTypeSafe<DB, NoTableOrViewRequired, A5>) => RESULT): FargmentFunction5TypeSafe<DB, A1, A2, A3, A4, A5, RESULT>
}

export interface FargmentFunction5TypeSafe<DB extends AnyDB, A1, A2, A3, A4, A5, RESULT> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<DB, NoTableOrViewRequired, RESULT>
    <T1 extends ITableOrView<DB>>(a1: MapArgumentToTypeSafe<DB, T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<DB, T1, RESULT>
    <T2 extends ITableOrView<DB>>(a1: TypeOfArgument<A1>, a2: MapArgumentToTypeSafe<DB, T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<DB, T2, RESULT>
    <T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>>(a1: MapArgumentToTypeSafe<DB, T1, A1>, a2: MapArgumentToTypeSafe<DB, T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<DB, T1 | T2, RESULT>
    <T3 extends ITableOrView<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: MapArgumentToTypeSafe<DB, T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<DB, T3, RESULT>
    <T1 extends ITableOrView<DB>, T3 extends ITableOrView<DB>>(a1: MapArgumentToTypeSafe<DB, T1, A1>, a2: TypeOfArgument<A2>, a3: MapArgumentToTypeSafe<DB, T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<DB, T1 | T3, RESULT>
    <T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>>(a1: TypeOfArgument<A1>, a2: MapArgumentToTypeSafe<DB, T2, A2>, a3: MapArgumentToTypeSafe<DB, T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<DB, T2 | T3, RESULT>
    <T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>>(a1: MapArgumentToTypeSafe<DB, T1, A1>, a2: MapArgumentToTypeSafe<DB, T2, A2>, a3: MapArgumentToTypeSafe<DB, T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<DB, T1 | T2 | T3, RESULT>
    <T4 extends ITableOrView<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: MapArgumentToTypeSafe<DB, T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<DB, T4, RESULT>
    <T1 extends ITableOrView<DB>, T4 extends ITableOrView<DB>>(a1: MapArgumentToTypeSafe<DB, T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: MapArgumentToTypeSafe<DB, T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<DB, T1 | T4, RESULT>
    <T2 extends ITableOrView<DB>, T4 extends ITableOrView<DB>>(a1: TypeOfArgument<A1>, a2: MapArgumentToTypeSafe<DB, T2, A2>, a3: TypeOfArgument<A3>, a4: MapArgumentToTypeSafe<DB, T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<DB, T2 | T4, RESULT>
    <T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T4 extends ITableOrView<DB>>(a1: MapArgumentToTypeSafe<DB, T1, A1>, a2: MapArgumentToTypeSafe<DB, T2, A2>, a3: TypeOfArgument<A3>, a4: MapArgumentToTypeSafe<DB, T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<DB, T1 | T2 | T4, RESULT>
    <T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: MapArgumentToTypeSafe<DB, T3, A3>, a4: MapArgumentToTypeSafe<DB, T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<DB, T3 | T4, RESULT>
    <T1 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>>(a1: MapArgumentToTypeSafe<DB, T1, A1>, a2: TypeOfArgument<A2>, a3: MapArgumentToTypeSafe<DB, T3, A3>, a4: MapArgumentToTypeSafe<DB, T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<DB, T1 | T3 | T4, RESULT>
    <T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>>(a1: TypeOfArgument<A1>, a2: MapArgumentToTypeSafe<DB, T2, A2>, a3: MapArgumentToTypeSafe<DB, T3, A3>, a4: MapArgumentToTypeSafe<DB, T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<DB, T2 | T3 | T4, RESULT>
    <T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>>(a1: MapArgumentToTypeSafe<DB, T1, A1>, a2: MapArgumentToTypeSafe<DB, T2, A2>, a3: MapArgumentToTypeSafe<DB, T3, A3>, a4: MapArgumentToTypeSafe<DB, T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<DB, T1 | T2 | T3 | T4, RESULT>

    <T5 extends ITableOrView<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: MapArgumentToTypeSafe<DB, T5, A5>): RemapValueSourceType<DB, T5, RESULT>
    <T1 extends ITableOrView<DB>, T5 extends ITableOrView<DB>>(a1: MapArgumentToTypeSafe<DB, T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: MapArgumentToTypeSafe<DB, T5, A5>): RemapValueSourceType<DB, T1 | T5, RESULT>
    <T2 extends ITableOrView<DB>, T5 extends ITableOrView<DB>>(a1: TypeOfArgument<A1>, a2: MapArgumentToTypeSafe<DB, T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: MapArgumentToTypeSafe<DB, T5, A5>): RemapValueSourceType<DB, T2 | T5, RESULT>
    <T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T5 extends ITableOrView<DB>>(a1: MapArgumentToTypeSafe<DB, T1, A1>, a2: MapArgumentToTypeSafe<DB, T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: MapArgumentToTypeSafe<DB, T5, A5>): RemapValueSourceType<DB, T1 | T2 | T5, RESULT>
    <T3 extends ITableOrView<DB>, T5 extends ITableOrView<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: MapArgumentToTypeSafe<DB, T3, A3>, a4: TypeOfArgument<A4>, a5: MapArgumentToTypeSafe<DB, T5, A5>): RemapValueSourceType<DB, T3 | T5, RESULT>
    <T1 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T5 extends ITableOrView<DB>>(a1: MapArgumentToTypeSafe<DB, T1, A1>, a2: TypeOfArgument<A2>, a3: MapArgumentToTypeSafe<DB, T3, A3>, a4: TypeOfArgument<A4>, a5: MapArgumentToTypeSafe<DB, T5, A5>): RemapValueSourceType<DB, T1 | T3 | T5, RESULT>
    <T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T5 extends ITableOrView<DB>>(a1: TypeOfArgument<A1>, a2: MapArgumentToTypeSafe<DB, T2, A2>, a3: MapArgumentToTypeSafe<DB, T3, A3>, a4: TypeOfArgument<A4>, a5: MapArgumentToTypeSafe<DB, T5, A5>): RemapValueSourceType<DB, T2 | T3 | T5, RESULT>
    <T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T5 extends ITableOrView<DB>>(a1: MapArgumentToTypeSafe<DB, T1, A1>, a2: MapArgumentToTypeSafe<DB, T2, A2>, a3: MapArgumentToTypeSafe<DB, T3, A3>, a4: TypeOfArgument<A4>, a5: MapArgumentToTypeSafe<DB, T5, A5>): RemapValueSourceType<DB, T1 | T2 | T3 | T5, RESULT>
    <T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: MapArgumentToTypeSafe<DB, T4, A4>, a5: MapArgumentToTypeSafe<DB, T5, A5>): RemapValueSourceType<DB, T4 | T5, RESULT>
    <T1 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>>(a1: MapArgumentToTypeSafe<DB, T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: MapArgumentToTypeSafe<DB, T4, A4>, a5: MapArgumentToTypeSafe<DB, T5, A5>): RemapValueSourceType<DB, T1 | T4 | T5, RESULT>
    <T2 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>>(a1: TypeOfArgument<A1>, a2: MapArgumentToTypeSafe<DB, T2, A2>, a3: TypeOfArgument<A3>, a4: MapArgumentToTypeSafe<DB, T4, A4>, a5: MapArgumentToTypeSafe<DB, T5, A5>): RemapValueSourceType<DB, T2 | T4 | T5, RESULT>
    <T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>>(a1: MapArgumentToTypeSafe<DB, T1, A1>, a2: MapArgumentToTypeSafe<DB, T2, A2>, a3: TypeOfArgument<A3>, a4: MapArgumentToTypeSafe<DB, T4, A4>, a5: MapArgumentToTypeSafe<DB, T5, A5>): RemapValueSourceType<DB, T1 | T2 | T4 | T5, RESULT>
    <T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: MapArgumentToTypeSafe<DB, T3, A3>, a4: MapArgumentToTypeSafe<DB, T4, A4>, a5: MapArgumentToTypeSafe<DB, T5, A5>): RemapValueSourceType<DB, T3 | T4 | T5, RESULT>
    <T1 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>>(a1: MapArgumentToTypeSafe<DB, T1, A1>, a2: TypeOfArgument<A2>, a3: MapArgumentToTypeSafe<DB, T3, A3>, a4: MapArgumentToTypeSafe<DB, T4, A4>, a5: MapArgumentToTypeSafe<DB, T5, A5>): RemapValueSourceType<DB, T1 | T3 | T4 | T5, RESULT>
    <T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>>(a1: TypeOfArgument<A1>, a2: MapArgumentToTypeSafe<DB, T2, A2>, a3: MapArgumentToTypeSafe<DB, T3, A3>, a4: MapArgumentToTypeSafe<DB, T4, A4>, a5: MapArgumentToTypeSafe<DB, T5, A5>): RemapValueSourceType<DB, T2 | T3 | T4 | T5, RESULT>
    <T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>>(a1: MapArgumentToTypeSafe<DB, T1, A1>, a2: MapArgumentToTypeSafe<DB, T2, A2>, a3: MapArgumentToTypeSafe<DB, T3, A3>, a4: MapArgumentToTypeSafe<DB, T4, A4>, a5: MapArgumentToTypeSafe<DB, T5, A5>): RemapValueSourceType<DB, T1 | T2 | T3 | T4 | T5, RESULT>
}

export interface FragmentBuilder5TypeUnsafe<DB extends AnyDB, A1, A2, A3, A4, A5> {
    as<RESULT extends ValueSource<DB, NoTableOrViewRequired, any>>(impl: (a1: MapArgumentToTypeUnsafe<DB, NoTableOrViewRequired, A1>, a2: MapArgumentToTypeUnsafe<DB, NoTableOrViewRequired, A2>, a3: MapArgumentToTypeUnsafe<DB, NoTableOrViewRequired, A3>, a4: MapArgumentToTypeUnsafe<DB, NoTableOrViewRequired, A4>, a5: MapArgumentToTypeUnsafe<DB, NoTableOrViewRequired, A5>) => RESULT): FargmentFunction5TypeUnsafe<DB, A1, A2, A3, A4, A5, RESULT>
}

export interface FargmentFunction5TypeUnsafe<DB extends AnyDB, A1, A2, A3, A4, A5, RESULT> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<DB, NoTableOrViewRequired, RESULT>
    <T1 extends ITableOrView<DB>>(a1: MapArgumentToTypeUnsafe<DB, T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<DB, T1, RESULT>
    <T2 extends ITableOrView<DB>>(a1: TypeOfArgument<A1>, a2: MapArgumentToTypeUnsafe<DB, T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<DB, T2, RESULT>
    <T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>>(a1: MapArgumentToTypeUnsafe<DB, T1, A1>, a2: MapArgumentToTypeUnsafe<DB, T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<DB, T1 | T2, RESULT>
    <T3 extends ITableOrView<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: MapArgumentToTypeUnsafe<DB, T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<DB, T3, RESULT>
    <T1 extends ITableOrView<DB>, T3 extends ITableOrView<DB>>(a1: MapArgumentToTypeUnsafe<DB, T1, A1>, a2: TypeOfArgument<A2>, a3: MapArgumentToTypeUnsafe<DB, T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<DB, T1 | T3, RESULT>
    <T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>>(a1: TypeOfArgument<A1>, a2: MapArgumentToTypeUnsafe<DB, T2, A2>, a3: MapArgumentToTypeUnsafe<DB, T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<DB, T2 | T3, RESULT>
    <T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>>(a1: MapArgumentToTypeUnsafe<DB, T1, A1>, a2: MapArgumentToTypeUnsafe<DB, T2, A2>, a3: MapArgumentToTypeUnsafe<DB, T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<DB, T1 | T2 | T3, RESULT>
    <T4 extends ITableOrView<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: MapArgumentToTypeUnsafe<DB, T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<DB, T4, RESULT>
    <T1 extends ITableOrView<DB>, T4 extends ITableOrView<DB>>(a1: MapArgumentToTypeUnsafe<DB, T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: MapArgumentToTypeUnsafe<DB, T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<DB, T1 | T4, RESULT>
    <T2 extends ITableOrView<DB>, T4 extends ITableOrView<DB>>(a1: TypeOfArgument<A1>, a2: MapArgumentToTypeUnsafe<DB, T2, A2>, a3: TypeOfArgument<A3>, a4: MapArgumentToTypeUnsafe<DB, T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<DB, T2 | T4, RESULT>
    <T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T4 extends ITableOrView<DB>>(a1: MapArgumentToTypeUnsafe<DB, T1, A1>, a2: MapArgumentToTypeUnsafe<DB, T2, A2>, a3: TypeOfArgument<A3>, a4: MapArgumentToTypeUnsafe<DB, T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<DB, T1 | T2 | T4, RESULT>
    <T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: MapArgumentToTypeUnsafe<DB, T3, A3>, a4: MapArgumentToTypeUnsafe<DB, T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<DB, T3 | T4, RESULT>
    <T1 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>>(a1: MapArgumentToTypeUnsafe<DB, T1, A1>, a2: TypeOfArgument<A2>, a3: MapArgumentToTypeUnsafe<DB, T3, A3>, a4: MapArgumentToTypeUnsafe<DB, T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<DB, T1 | T3 | T4, RESULT>
    <T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>>(a1: TypeOfArgument<A1>, a2: MapArgumentToTypeUnsafe<DB, T2, A2>, a3: MapArgumentToTypeUnsafe<DB, T3, A3>, a4: MapArgumentToTypeUnsafe<DB, T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<DB, T2 | T3 | T4, RESULT>
    <T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>>(a1: MapArgumentToTypeUnsafe<DB, T1, A1>, a2: MapArgumentToTypeUnsafe<DB, T2, A2>, a3: MapArgumentToTypeUnsafe<DB, T3, A3>, a4: MapArgumentToTypeUnsafe<DB, T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<DB, T1 | T2 | T3 | T4, RESULT>

    <T5 extends ITableOrView<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: MapArgumentToTypeUnsafe<DB, T5, A5>): RemapValueSourceType<DB, T5, RESULT>
    <T1 extends ITableOrView<DB>, T5 extends ITableOrView<DB>>(a1: MapArgumentToTypeUnsafe<DB, T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: MapArgumentToTypeUnsafe<DB, T5, A5>): RemapValueSourceType<DB, T1 | T5, RESULT>
    <T2 extends ITableOrView<DB>, T5 extends ITableOrView<DB>>(a1: TypeOfArgument<A1>, a2: MapArgumentToTypeUnsafe<DB, T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: MapArgumentToTypeUnsafe<DB, T5, A5>): RemapValueSourceType<DB, T2 | T5, RESULT>
    <T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T5 extends ITableOrView<DB>>(a1: MapArgumentToTypeUnsafe<DB, T1, A1>, a2: MapArgumentToTypeUnsafe<DB, T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: MapArgumentToTypeUnsafe<DB, T5, A5>): RemapValueSourceType<DB, T1 | T2 | T5, RESULT>
    <T3 extends ITableOrView<DB>, T5 extends ITableOrView<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: MapArgumentToTypeUnsafe<DB, T3, A3>, a4: TypeOfArgument<A4>, a5: MapArgumentToTypeUnsafe<DB, T5, A5>): RemapValueSourceType<DB, T3 | T5, RESULT>
    <T1 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T5 extends ITableOrView<DB>>(a1: MapArgumentToTypeUnsafe<DB, T1, A1>, a2: TypeOfArgument<A2>, a3: MapArgumentToTypeUnsafe<DB, T3, A3>, a4: TypeOfArgument<A4>, a5: MapArgumentToTypeUnsafe<DB, T5, A5>): RemapValueSourceType<DB, T1 | T3 | T5, RESULT>
    <T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T5 extends ITableOrView<DB>>(a1: TypeOfArgument<A1>, a2: MapArgumentToTypeUnsafe<DB, T2, A2>, a3: MapArgumentToTypeUnsafe<DB, T3, A3>, a4: TypeOfArgument<A4>, a5: MapArgumentToTypeUnsafe<DB, T5, A5>): RemapValueSourceType<DB, T2 | T3 | T5, RESULT>
    <T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T5 extends ITableOrView<DB>>(a1: MapArgumentToTypeUnsafe<DB, T1, A1>, a2: MapArgumentToTypeUnsafe<DB, T2, A2>, a3: MapArgumentToTypeUnsafe<DB, T3, A3>, a4: TypeOfArgument<A4>, a5: MapArgumentToTypeUnsafe<DB, T5, A5>): RemapValueSourceType<DB, T1 | T2 | T3 | T5, RESULT>
    <T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: MapArgumentToTypeUnsafe<DB, T4, A4>, a5: MapArgumentToTypeUnsafe<DB, T5, A5>): RemapValueSourceType<DB, T4 | T5, RESULT>
    <T1 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>>(a1: MapArgumentToTypeUnsafe<DB, T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: MapArgumentToTypeUnsafe<DB, T4, A4>, a5: MapArgumentToTypeUnsafe<DB, T5, A5>): RemapValueSourceType<DB, T1 | T4 | T5, RESULT>
    <T2 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>>(a1: TypeOfArgument<A1>, a2: MapArgumentToTypeUnsafe<DB, T2, A2>, a3: TypeOfArgument<A3>, a4: MapArgumentToTypeUnsafe<DB, T4, A4>, a5: MapArgumentToTypeUnsafe<DB, T5, A5>): RemapValueSourceType<DB, T2 | T4 | T5, RESULT>
    <T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>>(a1: MapArgumentToTypeUnsafe<DB, T1, A1>, a2: MapArgumentToTypeUnsafe<DB, T2, A2>, a3: TypeOfArgument<A3>, a4: MapArgumentToTypeUnsafe<DB, T4, A4>, a5: MapArgumentToTypeUnsafe<DB, T5, A5>): RemapValueSourceType<DB, T1 | T2 | T4 | T5, RESULT>
    <T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: MapArgumentToTypeUnsafe<DB, T3, A3>, a4: MapArgumentToTypeUnsafe<DB, T4, A4>, a5: MapArgumentToTypeUnsafe<DB, T5, A5>): RemapValueSourceType<DB, T3 | T4 | T5, RESULT>
    <T1 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>>(a1: MapArgumentToTypeUnsafe<DB, T1, A1>, a2: TypeOfArgument<A2>, a3: MapArgumentToTypeUnsafe<DB, T3, A3>, a4: MapArgumentToTypeUnsafe<DB, T4, A4>, a5: MapArgumentToTypeUnsafe<DB, T5, A5>): RemapValueSourceType<DB, T1 | T3 | T4 | T5, RESULT>
    <T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>>(a1: TypeOfArgument<A1>, a2: MapArgumentToTypeUnsafe<DB, T2, A2>, a3: MapArgumentToTypeUnsafe<DB, T3, A3>, a4: MapArgumentToTypeUnsafe<DB, T4, A4>, a5: MapArgumentToTypeUnsafe<DB, T5, A5>): RemapValueSourceType<DB, T2 | T3 | T4 | T5, RESULT>
    <T1 extends ITableOrView<DB>, T2 extends ITableOrView<DB>, T3 extends ITableOrView<DB>, T4 extends ITableOrView<DB>, T5 extends ITableOrView<DB>>(a1: MapArgumentToTypeUnsafe<DB, T1, A1>, a2: MapArgumentToTypeUnsafe<DB, T2, A2>, a3: MapArgumentToTypeUnsafe<DB, T3, A3>, a4: MapArgumentToTypeUnsafe<DB, T4, A4>, a5: MapArgumentToTypeUnsafe<DB, T5, A5>): RemapValueSourceType<DB, T1 | T2 | T3 | T4 | T5, RESULT>
}

