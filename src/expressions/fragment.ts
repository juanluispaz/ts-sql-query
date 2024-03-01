import type { AnyDB } from "../databases"
import type { ITableOrViewRef, NoTableOrViewRequired } from "../utils/ITableOrView"
import type { BooleanValueSource, NumberValueSource, StringValueSource, DateValueSource, TimeValueSource, DateTimeValueSource, EqualableValueSource, ComparableValueSource, RemapValueSourceType, TypeOfArgument, MapArgumentToTypeUnsafe, UnsafeArgForFn, IfValueSource, UnsafeArgForBuilderIfValue, IBooleanValueSource, IIfValueSource, BigintValueSource, OptionalType, ValueSourceOf, UuidValueSource, CustomIntValueSource, CustomDoubleValueSource, CustomUuidValueSource, CustomLocalDateTimeValueSource, CustomLocalDateValueSource, CustomLocalTimeValueSource } from "../expressions/values"
import { optionalType } from "../utils/symbols"

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

export interface DateFragmentExpression<DB extends AnyDB, OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray):  DateValueSource<NoTableOrViewRequired<DB>, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): DateValueSource<T1, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): DateValueSource<T1 | T2, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): DateValueSource<T1 | T2 | T3, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): DateValueSource<T1 | T2 | T3 | T4, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): DateValueSource<T1 | T2 | T3 | T4 | T5, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>, T6 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): DateValueSource<T1 | T2 | T3 | T4 | T5 | T6, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>, T6 extends ITableOrViewRef<DB>, T7 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): DateValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, OPTIONAL_TYPE>
    sql<T extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: ValueSourceOf<T>[]): DateValueSource<T, OPTIONAL_TYPE>
}

export interface TimeFragmentExpression<DB extends AnyDB, OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray):  TimeValueSource<NoTableOrViewRequired<DB>, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): TimeValueSource<T1, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): TimeValueSource<T1 | T2, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): TimeValueSource<T1 | T2 | T3, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): TimeValueSource<T1 | T2 | T3 | T4, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): TimeValueSource<T1 | T2 | T3 | T4 | T5, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>, T6 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): TimeValueSource<T1 | T2 | T3 | T4 | T5 | T6, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>, T6 extends ITableOrViewRef<DB>, T7 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): TimeValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, OPTIONAL_TYPE>
    sql<T extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: ValueSourceOf<T>[]): TimeValueSource<T, OPTIONAL_TYPE>
}

export interface DateTimeFragmentExpression<DB extends AnyDB, OPTIONAL_TYPE extends OptionalType> {
    sql(sql: TemplateStringsArray):  DateTimeValueSource<NoTableOrViewRequired<DB>, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>): DateTimeValueSource<T1, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>): DateTimeValueSource<T1 | T2, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>): DateTimeValueSource<T1 | T2 | T3, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>): DateTimeValueSource<T1 | T2 | T3 | T4, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>): DateTimeValueSource<T1 | T2 | T3 | T4 | T5, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>, T6 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>): DateTimeValueSource<T1 | T2 | T3 | T4 | T5 | T6, OPTIONAL_TYPE>
    sql<T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>, T6 extends ITableOrViewRef<DB>, T7 extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, p1: ValueSourceOf<T1>, p2: ValueSourceOf<T2>, p3: ValueSourceOf<T3>, p4: ValueSourceOf<T4>, p5: ValueSourceOf<T5>, p6: ValueSourceOf<T6>, p7: ValueSourceOf<T7>): DateTimeValueSource<T1 | T2 | T3 | T4 | T5 | T6 | T7, OPTIONAL_TYPE>
    sql<T extends ITableOrViewRef<DB>>(sql: TemplateStringsArray, ...p: ValueSourceOf<T>[]): DateTimeValueSource<T, OPTIONAL_TYPE>
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

export interface FragmentFunction1TypeUnsafe<DB extends AnyDB, A1, RESULT> {
    (a1: TypeOfArgument<A1>): RemapValueSourceType<NoTableOrViewRequired<DB>, RESULT>
    <T1 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>): RemapValueSourceType<T1, RESULT>
}

export interface FragmentFunction2TypeUnsafe<DB extends AnyDB, A1, A2, RESULT> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>): RemapValueSourceType<NoTableOrViewRequired<DB>, RESULT>
    <T1 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>): RemapValueSourceType<T1, RESULT>

    <T2 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>): RemapValueSourceType<T2, RESULT>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>): RemapValueSourceType<T1 | T2, RESULT>
}

export interface FragmentFunction3TypeUnsafe<DB extends AnyDB, A1, A2, A3, RESULT> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>): RemapValueSourceType<NoTableOrViewRequired<DB>, RESULT>
    <T1 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>): RemapValueSourceType<T1, RESULT>
    <T2 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>): RemapValueSourceType<T2, RESULT>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>): RemapValueSourceType<T1 | T2, RESULT>

    <T3 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>): RemapValueSourceType<T3, RESULT>
    <T1 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>): RemapValueSourceType<T1 | T3, RESULT>
    <T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>): RemapValueSourceType<T2 | T3, RESULT>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>): RemapValueSourceType<T1 | T2 | T3, RESULT>
}

export interface FragmentFunction4TypeUnsafe<DB extends AnyDB, A1, A2, A3, A4, RESULT> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<NoTableOrViewRequired<DB>, RESULT>
    <T1 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<T1, RESULT>
    <T2 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<T2, RESULT>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<T1 | T2, RESULT>
    <T3 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<T3, RESULT>
    <T1 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<T1 | T3, RESULT>
    <T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<T2 | T3, RESULT>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>): RemapValueSourceType<T1 | T2 | T3, RESULT>

    <T4 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>): RemapValueSourceType<T4, RESULT>
    <T1 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>): RemapValueSourceType<T1 | T4, RESULT>
    <T2 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>): RemapValueSourceType<T2 | T4, RESULT>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>): RemapValueSourceType<T1 | T2 | T4, RESULT>
    <T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>): RemapValueSourceType<T3 | T4, RESULT>
    <T1 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>): RemapValueSourceType<T1 | T3 | T4, RESULT>
    <T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>): RemapValueSourceType<T2 | T3 | T4, RESULT>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>): RemapValueSourceType<T1 | T2 | T3 | T4, RESULT>
}

export interface FragmentFunction5TypeUnsafe<DB extends AnyDB, A1, A2, A3, A4, A5, RESULT> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<NoTableOrViewRequired<DB>, RESULT>
    <T1 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T1, RESULT>
    <T2 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T2, RESULT>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T1 | T2, RESULT>
    <T3 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T3, RESULT>
    <T1 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T1 | T3, RESULT>
    <T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T2 | T3, RESULT>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T1 | T2 | T3, RESULT>
    <T4 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T4, RESULT>
    <T1 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T1 | T4, RESULT>
    <T2 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T2 | T4, RESULT>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T1 | T2 | T4, RESULT>
    <T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T3 | T4, RESULT>
    <T1 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T1 | T3 | T4, RESULT>
    <T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T2 | T3 | T4, RESULT>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): RemapValueSourceType<T1 | T2 | T3 | T4, RESULT>

    <T5 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: UnsafeArgForFn<T5, A5>): RemapValueSourceType<T5, RESULT>
    <T1 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: UnsafeArgForFn<T5, A5>): RemapValueSourceType<T1 | T5, RESULT>
    <T2 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: UnsafeArgForFn<T5, A5>): RemapValueSourceType<T2 | T5, RESULT>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: UnsafeArgForFn<T5, A5>): RemapValueSourceType<T1 | T2 | T5, RESULT>
    <T3 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: UnsafeArgForFn<T5, A5>): RemapValueSourceType<T3 | T5, RESULT>
    <T1 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: UnsafeArgForFn<T5, A5>): RemapValueSourceType<T1 | T3 | T5, RESULT>
    <T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: UnsafeArgForFn<T5, A5>): RemapValueSourceType<T2 | T3 | T5, RESULT>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: UnsafeArgForFn<T5, A5>): RemapValueSourceType<T1 | T2 | T3 | T5, RESULT>
    <T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>, a5: UnsafeArgForFn<T5, A5>): RemapValueSourceType<T4 | T5, RESULT>
    <T1 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>, a5: UnsafeArgForFn<T5, A5>): RemapValueSourceType<T1 | T4 | T5, RESULT>
    <T2 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>, a5: UnsafeArgForFn<T5, A5>): RemapValueSourceType<T2 | T4 | T5, RESULT>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>, a5: UnsafeArgForFn<T5, A5>): RemapValueSourceType<T1 | T2 | T4 | T5, RESULT>
    <T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>, a5: UnsafeArgForFn<T5, A5>): RemapValueSourceType<T3 | T4 | T5, RESULT>
    <T1 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>, a5: UnsafeArgForFn<T5, A5>): RemapValueSourceType<T1 | T3 | T4 | T5, RESULT>
    <T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>, a5: UnsafeArgForFn<T5, A5>): RemapValueSourceType<T2 | T3 | T4 | T5, RESULT>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>, a5: UnsafeArgForFn<T5, A5>): RemapValueSourceType<T1 | T2 | T3 | T4 | T5, RESULT>
}

export interface FragmentBuilder0IfValue<DB extends AnyDB> {
    as<RESULT extends IBooleanValueSource<NoTableOrViewRequired<DB>, any> | IIfValueSource<NoTableOrViewRequired<DB>, any>>(impl: () => RESULT): () => IfValueSource<NoTableOrViewRequired<DB>, RESULT[typeof optionalType]>
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

export interface FragmentFunctionIfValue1TypeUnsafe<DB extends AnyDB, A1, OPTIONAL_TYPE extends OptionalType> {
    (a1: TypeOfArgument<A1>): IfValueSource<NoTableOrViewRequired<DB>, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>): IfValueSource<T1, OPTIONAL_TYPE>
}

export interface FragmentFunctionIfValue2TypeUnsafe<DB extends AnyDB, A1, A2, OPTIONAL_TYPE extends OptionalType> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>): IfValueSource<NoTableOrViewRequired<DB>, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>): IfValueSource<T1, OPTIONAL_TYPE>

    <T2 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>): IfValueSource<T2, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>): IfValueSource<T1 | T2, OPTIONAL_TYPE>
}

export interface FragmentFunctionIfValue3TypeUnsafe<DB extends AnyDB, A1, A2, A3, OPTIONAL_TYPE extends OptionalType> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>): IfValueSource<NoTableOrViewRequired<DB>, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>): IfValueSource<T1, OPTIONAL_TYPE>
    <T2 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>): IfValueSource<T2, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>): IfValueSource<T1 | T2, OPTIONAL_TYPE>

    <T3 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>): IfValueSource<T3, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>): IfValueSource<T1 | T3, OPTIONAL_TYPE>
    <T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>): IfValueSource<T2 | T3, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>): IfValueSource<T1 | T2 | T3, OPTIONAL_TYPE>
}

export interface FragmentFunctionIfValue4TypeUnsafe<DB extends AnyDB, A1, A2, A3, A4, OPTIONAL_TYPE extends OptionalType> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): IfValueSource<NoTableOrViewRequired<DB>, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): IfValueSource<T1, OPTIONAL_TYPE>
    <T2 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): IfValueSource<T2, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>): IfValueSource<T1 | T2, OPTIONAL_TYPE>
    <T3 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>): IfValueSource<T3, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>): IfValueSource<T1 | T3, OPTIONAL_TYPE>
    <T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>): IfValueSource<T2 | T3, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>): IfValueSource<T1 | T2 | T3, OPTIONAL_TYPE>

    <T4 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>): IfValueSource<T4, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>): IfValueSource<T1 | T4, OPTIONAL_TYPE>
    <T2 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>): IfValueSource<T2 | T4, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>): IfValueSource<T1 | T2 | T4, OPTIONAL_TYPE>
    <T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>): IfValueSource<T3 | T4, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>): IfValueSource<T1 | T3 | T4, OPTIONAL_TYPE>
    <T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>): IfValueSource<T2 | T3 | T4, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>): IfValueSource<T1 | T2 | T3 | T4, OPTIONAL_TYPE>
}

export interface FragmentFunctionIfValue5TypeUnsafe<DB extends AnyDB, A1, A2, A3, A4, A5, OPTIONAL_TYPE extends OptionalType> {
    (a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<NoTableOrViewRequired<DB>, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<T1, OPTIONAL_TYPE>
    <T2 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<T2, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | T2, OPTIONAL_TYPE>
    <T3 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<T3, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | T3, OPTIONAL_TYPE>
    <T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<T2 | T3, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | T2 | T3, OPTIONAL_TYPE>
    <T4 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T4, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | T4, OPTIONAL_TYPE>
    <T2 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T2 | T4, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | T2 | T4, OPTIONAL_TYPE>
    <T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T3 | T4, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | T3 | T4, OPTIONAL_TYPE>
    <T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T2 | T3 | T4, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>, a5: TypeOfArgument<A5>): IfValueSource<T1 | T2 | T3 | T4, OPTIONAL_TYPE>

    <T5 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: UnsafeArgForFn<T5, A5>): IfValueSource<T5, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: UnsafeArgForFn<T5, A5>): IfValueSource<T1 | T5, OPTIONAL_TYPE>
    <T2 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: UnsafeArgForFn<T5, A5>): IfValueSource<T2 | T5, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: TypeOfArgument<A4>, a5: UnsafeArgForFn<T5, A5>): IfValueSource<T1 | T2 | T5, OPTIONAL_TYPE>
    <T3 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: UnsafeArgForFn<T5, A5>): IfValueSource<T3 | T5, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: UnsafeArgForFn<T5, A5>): IfValueSource<T1 | T3 | T5, OPTIONAL_TYPE>
    <T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: UnsafeArgForFn<T5, A5>): IfValueSource<T2 | T3 | T5, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: TypeOfArgument<A4>, a5: UnsafeArgForFn<T5, A5>): IfValueSource<T1 | T2 | T3 | T5, OPTIONAL_TYPE>
    <T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>, a5: UnsafeArgForFn<T5, A5>): IfValueSource<T4 | T5, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>, a5: UnsafeArgForFn<T5, A5>): IfValueSource<T1 | T4 | T5, OPTIONAL_TYPE>
    <T2 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>, a5: UnsafeArgForFn<T5, A5>): IfValueSource<T2 | T4 | T5, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: TypeOfArgument<A3>, a4: UnsafeArgForFn<T4, A4>, a5: UnsafeArgForFn<T5, A5>): IfValueSource<T1 | T2 | T4 | T5, OPTIONAL_TYPE>
    <T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>, a5: UnsafeArgForFn<T5, A5>): IfValueSource<T3 | T4 | T5, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: TypeOfArgument<A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>, a5: UnsafeArgForFn<T5, A5>): IfValueSource<T1 | T3 | T4 | T5, OPTIONAL_TYPE>
    <T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: TypeOfArgument<A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>, a5: UnsafeArgForFn<T5, A5>): IfValueSource<T2 | T3 | T4 | T5, OPTIONAL_TYPE>
    <T1 extends ITableOrViewRef<DB>, T2 extends ITableOrViewRef<DB>, T3 extends ITableOrViewRef<DB>, T4 extends ITableOrViewRef<DB>, T5 extends ITableOrViewRef<DB>>(a1: UnsafeArgForFn<T1, A1>, a2: UnsafeArgForFn<T2, A2>, a3: UnsafeArgForFn<T3, A3>, a4: UnsafeArgForFn<T4, A4>, a5: UnsafeArgForFn<T5, A5>): IfValueSource<T1 | T2 | T3 | T4 | T5, OPTIONAL_TYPE>
}
