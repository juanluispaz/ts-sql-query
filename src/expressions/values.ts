import type { ITableOrView } from "../utils/ITableOrView"
import type { Default } from "./Default"
import type { AnyDB } from "../databases"
import type { ExecutableSelect } from "./select"
import type { int, double, /*LocalDate, LocalTime, LocalDateTime,*/ stringDouble, stringInt } from "ts-extended-types"
import type { TypeAdapter } from "../TypeAdapter"
import type { database, tableOrView } from "../utils/symbols"
import type { ColumnWithDefaultValue } from "../utils/Column"
import { valueType } from "../utils/symbols"

export interface ValueSource<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, TYPE> {
    [database]: DB
    [tableOrView]: TABLE_OR_VIEW
    [valueType]: TYPE
}

export interface __ValueSourcePrivate {
    __valueType: string
    __typeAdapter?: TypeAdapter
}

export function __getValueSourcePrivate(valueSource: ValueSource<any, any, any>): __ValueSourcePrivate {
    return valueSource as any
}

export interface NullableValueSource<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, TYPE> extends ValueSource<DB,TABLE_OR_VIEW, TYPE> {
    isNull(): BooleanValueSource<DB, TABLE_OR_VIEW, boolean>
    isNotNull(): BooleanValueSource<DB, TABLE_OR_VIEW, boolean>
    // Next methods uses this as generic argument to avoid create a circular reference
    // Next methods doen't works on TS 3.5.3, it create a 'Type instantiation is excessively deep and possibly infinite.' (sometimes on UpdateQueryBuilder), a specific implementation will be created
    // valueWhenNull<THIS>(this: THIS, value: MandatoryTypeOf<TYPE>): RemapValueSourceTypeAsMandatory<DB, TABLE_OR_VIEW, THIS>
    // valueWhenNull<THIS, TABLE_OR_VIEW2 extends ITable<DB>>(this: THIS, value: ValueSource<DB, TABLE_OR_VIEW2, MandatoryTypeOf<TYPE>>): RemapValueSourceTypeAsMandatory<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, THIS>
    // valueWhenNull<THIS, TABLE_OR_VIEW2 extends ITable<DB>>(this: THIS, value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): RemapValueSourceTypeAsOptional<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, THIS>
    // asOptional<THIS>(this: THIS): RemapValueSourceTypeAsOptional<DB, TABLE_OR_VIEW, THIS>
    valueWhenNull(value: MandatoryTypeOf<TYPE>): NullableValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, MandatoryTypeOf<TYPE>>): NullableValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): NullableValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
    asOptional(): NullableValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
}

export interface EqualableValueSource<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, TYPE> extends NullableValueSource<DB,TABLE_OR_VIEW, TYPE> {
    equalsIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    equals(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    equals<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    equals<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE  | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE | null | undefined>>
    notEqualsIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    notEquals(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    notEquals<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    notEquals<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE  | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE | null | undefined>>
    isIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    is(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    is<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    is<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE | null | undefined>>
    isNotIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, boolean>
    isNot(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, boolean>
    isNot<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    isNot<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE | null | undefined>>

    inIfValue(values: TYPE[] | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    inIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    in(values: TYPE[]): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    in(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    in<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    in<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE | null | undefined>>
    in<TABLE_OR_VIEW2 extends ITableOrView<DB>>(select: ExecutableSelect<DB, TYPE | null | undefined, TABLE_OR_VIEW2>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean>
    notInIfValue(values: TYPE[] | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    notInIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    notIn(values: TYPE[]): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    notIn(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    notIn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    notIn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE | null | undefined>>
    notIn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(select: ExecutableSelect<DB, TYPE | null | undefined, TABLE_OR_VIEW2>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean>
    inN(...value: TYPE[]): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    inN<TABLE_OR_VIEW2 extends ITableOrView<DB>>(...value: (TYPE | ValueSource<DB, TABLE_OR_VIEW2, TYPE>)[]): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>> // limitation: only one source table
    inN<TABLE_OR_VIEW2 extends ITableOrView<DB>>(...value: (TYPE | ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>)[]): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE | null | undefined>> // limitation: only one source table
    notInN(...value: TYPE[]): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    notInN<TABLE_OR_VIEW2 extends ITableOrView<DB>>(...value: (TYPE | ValueSource<DB, TABLE_OR_VIEW2, TYPE>)[]): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>> // limitation: only one source table
    notInN<TABLE_OR_VIEW2 extends ITableOrView<DB>>(...value: (TYPE | ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>)[]): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE | null | undefined>> // limitation: only one source table

    // Redefined methods
    valueWhenNull(value: MandatoryTypeOf<TYPE>): EqualableValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, MandatoryTypeOf<TYPE>>): EqualableValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): EqualableValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
    asOptional(): EqualableValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
}

export interface ComparableValueSource<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, TYPE> extends EqualableValueSource<DB, TABLE_OR_VIEW, TYPE> {
    smallerIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    smaller(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    smaller<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    smaller<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE | null | undefined>>
    largerIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    larger(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    larger<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    larger<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE | null | undefined>>
    smallAsIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    smallAs(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    smallAs<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    smallAs<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE | null | undefined>>
    largeAsIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    largeAs(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    largeAs<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    largeAs<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE | null | undefined>>
    between(value: TYPE, value2: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    between<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: TYPE, value2: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    between<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: TYPE, value2: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    between<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>, value2: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    between<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>, value2: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    between<TABLE_OR_VIEW2 extends ITableOrView<DB>, TABLE_OR_VIEW3 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>, value2: ValueSource<DB, TABLE_OR_VIEW3, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2 | TABLE_OR_VIEW3, BooleanOrNullOf<TYPE>>
    between<TABLE_OR_VIEW2 extends ITableOrView<DB>, TABLE_OR_VIEW3 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>, value2: ValueSource<DB, TABLE_OR_VIEW3, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2 | TABLE_OR_VIEW3, boolean | null | undefined>
    between<TABLE_OR_VIEW2 extends ITableOrView<DB>, TABLE_OR_VIEW3 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>, value2: ValueSource<DB, TABLE_OR_VIEW3, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2 | TABLE_OR_VIEW3, boolean | null | undefined>
    between<TABLE_OR_VIEW2 extends ITableOrView<DB>, TABLE_OR_VIEW3 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>, value2: ValueSource<DB, TABLE_OR_VIEW3, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2 | TABLE_OR_VIEW3, boolean | null | undefined>
    notBetween(value: TYPE, value2: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    notBetween<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: TYPE, value2: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    notBetween<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: TYPE, value2: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    notBetween<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>, value2: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    notBetween<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>, value2: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    notBetween<TABLE_OR_VIEW2 extends ITableOrView<DB>, TABLE_OR_VIEW3 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>, value2: ValueSource<DB, TABLE_OR_VIEW3, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2 | TABLE_OR_VIEW3, BooleanOrNullOf<TYPE>>
    notBetween<TABLE_OR_VIEW2 extends ITableOrView<DB>, TABLE_OR_VIEW3 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>, value2: ValueSource<DB, TABLE_OR_VIEW3, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2 | TABLE_OR_VIEW3, boolean | null | undefined>
    notBetween<TABLE_OR_VIEW2 extends ITableOrView<DB>, TABLE_OR_VIEW3 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>, value2: ValueSource<DB, TABLE_OR_VIEW3, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2 | TABLE_OR_VIEW3, boolean | null | undefined>
    notBetween<TABLE_OR_VIEW2 extends ITableOrView<DB>, TABLE_OR_VIEW3 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>, value2: ValueSource<DB, TABLE_OR_VIEW3, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2 | TABLE_OR_VIEW3, boolean | null | undefined>
    // Redefined methods
    valueWhenNull(value: MandatoryTypeOf<TYPE>): ComparableValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, MandatoryTypeOf<TYPE>>): ComparableValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): ComparableValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
    asOptional(): ComparableValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
}

export interface BooleanValueSource<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, TYPE /*extends boolean | null | undefined = boolean*/> extends EqualableValueSource<DB, TABLE_OR_VIEW, TYPE> {
    negate(): BooleanValueSource<DB, TABLE_OR_VIEW, TYPE>
    and(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    and<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    and<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    or(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    or<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    or<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    // Redefined methods
    valueWhenNull(value: MandatoryTypeOf<TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, MandatoryTypeOf<TYPE>>): BooleanValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
    asOptional(): BooleanValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
}

export interface NumberValueSource<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, TYPE /*extends number | null | undefined = number*/> extends ComparableValueSource<DB, TABLE_OR_VIEW, TYPE> {
    // SqlFunction0
    // Number functions
    asStringNumber(): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE | string>
    abs(): NumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    ceil(): NumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    floor(): NumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    round(): NumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    exp(): NumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    ln(): NumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    log10(): NumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    sqrt(): NumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    cbrt(): NumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    sign(): NumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    // Trigonometric Functions
    acos(): NumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    asin(): NumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    atan(): NumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    cos(): NumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    cot(): NumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    sin(): NumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    tan(): NumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    // SqlFunction1
    power(value: TYPE): NumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    power<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: NumberValueSource<DB, TABLE_OR_VIEW2, TYPE>): NumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    power<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: NumberValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): NumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    logn(value: TYPE): NumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    logn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: NumberValueSource<DB, TABLE_OR_VIEW2, TYPE>): NumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    logn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: NumberValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): NumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    roundn(value: TYPE): NumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    roundn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: NumberValueSource<DB, TABLE_OR_VIEW2, TYPE>): NumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    roundn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: NumberValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): NumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    minValue(value: TYPE): NumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    minValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: NumberValueSource<DB, TABLE_OR_VIEW2, TYPE>): NumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    minValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: NumberValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): NumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    maxValue(value: TYPE): NumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    maxValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: NumberValueSource<DB, TABLE_OR_VIEW2, TYPE>): NumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    maxValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: NumberValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): NumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    // Number operators
    add(value: TYPE): NumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    add<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: NumberValueSource<DB, TABLE_OR_VIEW2, TYPE>): NumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    add<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: NumberValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): NumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    substract(value: TYPE): NumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    substract<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: NumberValueSource<DB, TABLE_OR_VIEW2, TYPE>): NumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    substract<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: NumberValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): NumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    multiply(value: TYPE): NumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    multiply<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: NumberValueSource<DB, TABLE_OR_VIEW2, TYPE>): NumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    multiply<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: NumberValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): NumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    divide(value: TYPE): NumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    divide<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: NumberValueSource<DB, TABLE_OR_VIEW2, TYPE>): NumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    divide<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: NumberValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): NumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    mod(value: TYPE): NumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    mod<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: NumberValueSource<DB, TABLE_OR_VIEW2, TYPE>): NumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    mod<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: NumberValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): NumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    // Trigonometric Functions
    atan2(value: TYPE): NumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    atan2<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: NumberValueSource<DB, TABLE_OR_VIEW2, TYPE>): NumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    atan2<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: NumberValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): NumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    // Redefined methods
    valueWhenNull(value: MandatoryTypeOf<TYPE>): NumberValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, MandatoryTypeOf<TYPE>>): NumberValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): NumberValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
    asOptional(): NumberValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
}

export interface StringNumberValueSource<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, TYPE /*extends number | string | null | undefined = number | string*/> extends ComparableValueSource<DB, TABLE_OR_VIEW, TYPE> {
    // SqlFunction0
    // Number functions
    abs(): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    ceil(): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    floor(): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    round(): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    exp(): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    ln(): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    log10(): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    sqrt(): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    cbrt(): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    sign(): NumberValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, number>>
    // Trigonometric Functions
    acos(): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    asin(): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    atan(): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    cos(): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    cot(): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    sin(): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    tan(): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    // SqlFunction1
    power(value: TYPE): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    power<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringNumberValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringNumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    power<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringNumberValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringNumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    logn(value: TYPE): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    logn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringNumberValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringNumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    logn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringNumberValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringNumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    roundn(value: TYPE): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    roundn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringNumberValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringNumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    roundn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringNumberValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringNumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    minValue(value: TYPE): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    minValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringNumberValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringNumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    minValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringNumberValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringNumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    maxValue(value: TYPE): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    maxValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringNumberValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringNumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    maxValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringNumberValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringNumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    // Number operators
    add(value: TYPE): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    add<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringNumberValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringNumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    add<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringNumberValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringNumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    substract(value: TYPE): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    substract<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringNumberValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringNumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    substract<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringNumberValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringNumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    multiply(value: TYPE): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    multiply<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringNumberValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringNumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    multiply<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringNumberValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringNumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    divide(value: TYPE): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    divide<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringNumberValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringNumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    divide<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringNumberValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringNumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    mod(value: TYPE): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    mod<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringNumberValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringNumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    mod<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringNumberValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringNumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    // Trigonometric Functions
    atan2(value: TYPE): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    atan2<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringNumberValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringNumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    atan2<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringNumberValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringNumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    // Redefined methods
    valueWhenNull(value: MandatoryTypeOf<TYPE>): StringNumberValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, MandatoryTypeOf<TYPE>>): StringNumberValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
    asOptional(): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
}

export interface IntValueSource<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, TYPE /*extends int | null | undefined = int*/> extends ComparableValueSource<DB, TABLE_OR_VIEW, TYPE> {
    // SqlFunction0
    // Number functions
    asStringInt(): StringIntValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringInt>>
    asDouble(): DoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, double>>
    asStringDouble(): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    abs(): IntValueSource<DB, TABLE_OR_VIEW, TYPE>
    ceil(): IntValueSource<DB, TABLE_OR_VIEW, TYPE>
    floor(): IntValueSource<DB, TABLE_OR_VIEW, TYPE>
    round(): IntValueSource<DB, TABLE_OR_VIEW, TYPE>
    exp(): DoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, double>>
    ln(): DoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, double>>
    log10(): DoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, double>>
    sqrt(): DoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, double>>
    cbrt(): DoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, double>>
    sign(): IntValueSource<DB, TABLE_OR_VIEW, TYPE>
    // Trigonometric Functions
    acos(): DoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, double>>
    asin(): DoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, double>>
    atan(): DoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, double>>
    cos(): DoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, double>>
    cot(): DoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, double>>
    sin(): DoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, double>>
    tan(): DoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, double>>
    // SqlFunction1
    power(value: TYPE): DoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, double>>
    power<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, double>>
    power<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, double | null | undefined>
    power(value: double): DoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, double>>
    power<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, double>>
    power<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, double | null | undefined>
    logn(value: TYPE): DoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, double>>
    logn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, double>>
    logn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, double | null | undefined>
    logn(value: double): DoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, double>>
    logn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, double>>
    logn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, double | null | undefined>
    roundn(value: TYPE): DoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, double>>
    roundn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, double>>
    roundn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, double | null | undefined>
    minValue(value: TYPE): IntValueSource<DB, TABLE_OR_VIEW, TYPE>
    minValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE>): IntValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    minValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): IntValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    minValue(value: double): DoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, double>>
    minValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, double>>
    minValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, double | null | undefined>
    maxValue(value: TYPE): IntValueSource<DB, TABLE_OR_VIEW, TYPE>
    maxValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE>): IntValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    maxValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): IntValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    maxValue(value: double): DoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, double>>
    maxValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, double>>
    maxValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, double | null | undefined>
    // Number operators
    add(value: TYPE): IntValueSource<DB, TABLE_OR_VIEW, TYPE>
    add<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE>): IntValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    add<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): IntValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    add(value: double): DoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, double>>
    add<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, double>>
    add<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, double | null | undefined>
    substract(value: TYPE): IntValueSource<DB, TABLE_OR_VIEW, TYPE>
    substract<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE>): IntValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    substract<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): IntValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    substract(value: double): DoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, double>>
    substract<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, double>>
    substract<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, double | null | undefined>
    multiply(value: TYPE): IntValueSource<DB, TABLE_OR_VIEW, TYPE>
    multiply<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE>): IntValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    multiply<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): IntValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    multiply(value: double): DoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, double>>
    multiply<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, double>>
    multiply<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, double | null | undefined>
    divide(value: TYPE): DoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, double>>
    divide<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, double>>
    divide<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, double | null | undefined>
    divide(value: double): DoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, double>>
    divide<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, double>>
    divide<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, double | null | undefined>
    mod(value: TYPE): IntValueSource<DB, TABLE_OR_VIEW, TYPE>
    mod<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE>): IntValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    mod<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): IntValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    mod(value: double): DoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, double>>
    mod<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, double>>
    mod<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, double | null | undefined>
    // Trigonometric Functions
    atan2(value: TYPE): DoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, double>>
    atan2<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, double>>
    atan2<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, double | null | undefined>
    atan2(value: double): DoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, double>>
    atan2<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, double>>
    atan2<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, double | null | undefined>
    // Redefined methods
    valueWhenNull(value: MandatoryTypeOf<TYPE>): IntValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, MandatoryTypeOf<TYPE>>): IntValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): IntValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
    asOptional(): IntValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
}

export interface DoubleValueSource<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, TYPE /*extends double | null | undefined = double*/> extends ComparableValueSource<DB, TABLE_OR_VIEW, TYPE> {
    // SqlFunction0
    // Number functions
    //asInt(): IntValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, int>> // test function
    asStringDouble(): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    abs(): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    ceil(): IntValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, int>>
    floor(): IntValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, int>>
    round(): IntValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, int>>
    exp(): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    ln(): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    log10(): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    sqrt(): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    cbrt(): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    sign(): IntValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, int>>
    // Trigonometric Functions
    acos(): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    asin(): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    atan(): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    cos(): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    cot(): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    sin(): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    tan(): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    // SqlFunction1
    power(value: int): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    power<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    power<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    power(value: TYPE): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    power<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    power<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    logn(value: int): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    logn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    logn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    logn(value: TYPE): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    logn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    logn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    roundn(value: int): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    roundn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    roundn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    minValue(value: int): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    minValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    minValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    minValue(value: TYPE): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    minValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    minValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    maxValue(value: int): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    maxValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    maxValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    maxValue(value: TYPE): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    maxValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    maxValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    // Number operators
    add(value: int): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    add<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    add<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    add(value: TYPE): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    add<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    add<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    substract(value: int): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    substract<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    substract<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    substract(value: TYPE): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    substract<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    substract<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    multiply(value: int): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    multiply<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    multiply<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    multiply(value: TYPE): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    multiply<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    multiply<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    divide(value: int): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    divide<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    divide<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    divide(value: TYPE): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    divide<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    divide<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    mod(value: int): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    mod<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    mod<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    mod(value: TYPE): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    mod<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    mod<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    // Trigonometric Functions
    atan2(value: int): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    atan2<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    atan2<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    atan2(value: TYPE): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    atan2<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    atan2<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    // Redefined methods
    valueWhenNull(value: MandatoryTypeOf<TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, MandatoryTypeOf<TYPE>>): DoubleValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
    asOptional(): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
}

export interface StringIntValueSource<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, TYPE /*extends stringInt | null | undefined = stringInt*/> extends ComparableValueSource<DB, TABLE_OR_VIEW, TYPE> {
    // SqlFunction0
    // Number functions
    asStringDouble(): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    abs(): StringIntValueSource<DB, TABLE_OR_VIEW, TYPE>
    ceil(): StringIntValueSource<DB, TABLE_OR_VIEW, TYPE>
    floor(): StringIntValueSource<DB, TABLE_OR_VIEW, TYPE>
    round(): StringIntValueSource<DB, TABLE_OR_VIEW, TYPE>
    exp(): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    ln(): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    log10(): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    sqrt(): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    cbrt(): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    sign(): IntValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, int>>
    // Trigonometric Functions
    acos(): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    asin(): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    atan(): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    cos(): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    cot(): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    sin(): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    tan(): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    // SqlFunction1
    power(value: TYPE): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    power<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, stringDouble>>
    power<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, stringDouble | null | undefined>
    power(value: stringDouble): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    power<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, stringDouble>>
    power<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, stringDouble | null | undefined>
    logn(value: TYPE): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    logn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, stringDouble>>
    logn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, stringDouble | null | undefined>
    logn(value: stringDouble): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    logn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, stringDouble>>
    logn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, stringDouble | null | undefined>
    roundn(value: TYPE): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    roundn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, stringDouble>>
    roundn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, stringDouble | null | undefined>
    minValue(value: TYPE): StringIntValueSource<DB, TABLE_OR_VIEW, TYPE>
    minValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringIntValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    minValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringIntValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    minValue(value: stringDouble): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    minValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, stringDouble>>
    minValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, stringDouble | null | undefined>
    maxValue(value: TYPE): StringIntValueSource<DB, TABLE_OR_VIEW, TYPE>
    maxValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringIntValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    maxValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringIntValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    maxValue(value: stringDouble): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    maxValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, stringDouble>>
    maxValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, stringDouble | null | undefined>
    // Number operators
    add(value: TYPE): StringIntValueSource<DB, TABLE_OR_VIEW, TYPE>
    add<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringIntValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    add<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringIntValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    add(value: stringDouble): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    add<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, stringDouble>>
    add<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, stringDouble | null | undefined>
    substract(value: TYPE): StringIntValueSource<DB, TABLE_OR_VIEW, TYPE>
    substract<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringIntValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    substract<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringIntValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    substract(value: stringDouble): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    substract<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, stringDouble>>
    substract<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, stringDouble | null | undefined>
    multiply(value: TYPE): StringIntValueSource<DB, TABLE_OR_VIEW, TYPE>
    multiply<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringIntValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    multiply<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringIntValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    multiply(value: stringDouble): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    multiply<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, stringDouble>>
    multiply<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, stringDouble | null | undefined>
    divide(value: TYPE): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    divide<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, stringDouble>>
    divide<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, stringDouble | null | undefined>
    divide(value: stringDouble): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    divide<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, stringDouble>>
    divide<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, stringDouble | null | undefined>
    mod(value: TYPE): StringIntValueSource<DB, TABLE_OR_VIEW, TYPE>
    mod<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringIntValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    mod<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringIntValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    mod(value: stringDouble): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    mod<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, stringDouble>>
    mod<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, stringDouble | null | undefined>
    // Trigonometric Functions
    atan2(value: TYPE): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    atan2<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, stringDouble>>
    atan2<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, stringDouble | null | undefined>
    atan2(value: stringDouble): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    atan2<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, stringDouble>>
    atan2<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, stringDouble | null | undefined>
    // Redefined methods
    valueWhenNull(value: MandatoryTypeOf<TYPE>): StringIntValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, MandatoryTypeOf<TYPE>>): StringIntValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringIntValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
    asOptional(): StringIntValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
}

export interface StringDoubleValueSource<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, TYPE /*extends stringDouble | null | undefined = stringDouble*/> extends ComparableValueSource<DB, TABLE_OR_VIEW, TYPE> {
    // SqlFunction0
    // Number functions
    //asInt(): StringIntValueSource<DB, TABLE_OR_VIEW, StringIntTypeOf<TYPE>> // test function
    abs(): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    ceil(): StringIntValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringInt>>
    floor(): StringIntValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringInt>>
    round(): StringIntValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringInt>>
    exp(): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    ln(): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    log10(): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    sqrt(): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    cbrt(): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    sign(): IntValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, int>>
    // Trigonometric Functions
    acos(): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    asin(): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    atan(): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    cos(): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    cot(): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    sin(): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    tan(): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    // SqlFunction1
    power(value: stringInt): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    power<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    power<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    power(value: TYPE): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    power<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    power<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    logn(value: stringInt): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    logn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    logn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    logn(value: TYPE): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    logn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    logn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    roundn(value: stringInt): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    roundn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    roundn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    minValue(value: stringInt): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    minValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    minValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    minValue(value: TYPE): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    minValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    minValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    maxValue(value: stringInt): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    maxValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    maxValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    maxValue(value: TYPE): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    maxValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    maxValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    // Number operators
    add(value: stringInt): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    add<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    add<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    add(value: TYPE): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    add<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    add<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    substract(value: stringInt): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    substract<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    substract<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    substract(value: TYPE): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    substract<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    substract<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    multiply(value: stringInt): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    multiply<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    multiply<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    multiply(value: TYPE): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    multiply<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    multiply<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    divide(value: stringInt): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    divide<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    divide<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    divide(value: TYPE): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    divide<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    divide<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    mod(value: stringInt): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    mod<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    mod<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    mod(value: TYPE): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    mod<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    mod<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    // Trigonometric Functions
    atan2(value: stringInt): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    atan2<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    atan2<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    atan2(value: TYPE): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    atan2<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    atan2<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    // Redefined methods
    valueWhenNull(value: MandatoryTypeOf<TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, MandatoryTypeOf<TYPE>>): StringDoubleValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
    asOptional(): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
}

export interface StringValueSource<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, TYPE /*extends string | null | undefined = string*/> extends ComparableValueSource<DB, TABLE_OR_VIEW, TYPE> {
    // SqlComparator 1
    equalsInsensitiveIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    equalsInsensitive(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    equalsInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    equalsInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    notEqualsInsensitiveIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    notEqualsInsensitive(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    notEqualsInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    notEqualsInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    likeIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    like(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    like<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    like<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    notLikeIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    notLike(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    notLike<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    notLike<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    likeInsensitiveIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    likeInsensitive(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    likeInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    likeInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    notLikeInsensitiveIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    notLikeInsensitive(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    notLikeInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    notLikeInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    startWithIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    startWith(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    startWith<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    startWith<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    notStartWithIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    notStartWith(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    notStartWith<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    notStartWith<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    endWithIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    endWith(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    endWith<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    endWith<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    notEndWithIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    notEndWith(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    notEndWith<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    notEndWith<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    startWithInsensitiveIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    startWithInsensitive(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    startWithInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    startWithInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    notStartWithInsensitiveIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    notStartWithInsensitive(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    notStartWithInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    notStartWithInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    endWithInsensitiveIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    endWithInsensitive(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    endWithInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    endWithInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    notEndWithInsensitiveIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    notEndWithInsensitive(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    notEndWithInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    notEndWithInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    containsIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    contains(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    contains<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    contains<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    notContainsIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    notContains(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    notContains<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    notContains<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    containsInsensitiveIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    containsInsensitive(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    containsInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    containsInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    notContainsInsensitiveIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    notContainsInsensitive(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    notContainsInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    notContainsInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    // SqlFunction0
    lower(): StringValueSource<DB, TABLE_OR_VIEW, TYPE>
    upper(): StringValueSource<DB, TABLE_OR_VIEW, TYPE>
    length(): NumberValueSource<DB, TABLE_OR_VIEW, number>
    trim(): StringValueSource<DB, TABLE_OR_VIEW, TYPE>
    ltrim(): StringValueSource<DB, TABLE_OR_VIEW, TYPE>
    rtrim(): StringValueSource<DB, TABLE_OR_VIEW, TYPE>
    reverse(): StringValueSource<DB, TABLE_OR_VIEW, TYPE>
    // SqlFunction1
    concatIfValue(value: TYPE | null | undefined): StringValueSource<DB, TABLE_OR_VIEW, TYPE>
    concat(value: TYPE): StringValueSource<DB, TABLE_OR_VIEW, TYPE>
    concat(value: TYPE | null | undefined): StringValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
    concat<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    concat<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    substringToEnd(start: number): StringValueSource<DB, TABLE_OR_VIEW, TYPE>
    substringToEnd<TABLE_OR_VIEW2 extends ITableOrView<DB>>(start: NumberValueSource<DB, TABLE_OR_VIEW2, number>): StringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    substringToEnd<TABLE_OR_VIEW2 extends ITableOrView<DB>>(start: NumberValueSource<DB, TABLE_OR_VIEW2, number | null | undefined>): StringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    // SqlFunction2
    substring(start: number, end: number): StringValueSource<DB, TABLE_OR_VIEW, TYPE>
    substring<TABLE_OR_VIEW2 extends ITableOrView<DB>>(start: number, end: NumberValueSource<DB, TABLE_OR_VIEW2, number>): StringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    substring<TABLE_OR_VIEW2 extends ITableOrView<DB>>(start: number, end: NumberValueSource<DB, TABLE_OR_VIEW2, number | null | undefined>): StringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    substring<TABLE_OR_VIEW2 extends ITableOrView<DB>>(start: NumberValueSource<DB, TABLE_OR_VIEW2, number>, end: number): StringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    substring<TABLE_OR_VIEW2 extends ITableOrView<DB>>(start: NumberValueSource<DB, TABLE_OR_VIEW2, number | null | undefined>, end: number): StringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    substring<TABLE_OR_VIEW2 extends ITableOrView<DB>, TABLE_OR_VIEW3 extends ITableOrView<DB>>(start: NumberValueSource<DB, TABLE_OR_VIEW2, number>, end: NumberValueSource<DB, TABLE_OR_VIEW3, number>): StringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2 | TABLE_OR_VIEW3, TYPE>
    substring<TABLE_OR_VIEW2 extends ITableOrView<DB>, TABLE_OR_VIEW3 extends ITableOrView<DB>>(start: NumberValueSource<DB, TABLE_OR_VIEW2, number>, end: NumberValueSource<DB, TABLE_OR_VIEW3, number | null | undefined>): StringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2 | TABLE_OR_VIEW3, TYPE| null | undefined>
    substring<TABLE_OR_VIEW2 extends ITableOrView<DB>, TABLE_OR_VIEW3 extends ITableOrView<DB>>(start: NumberValueSource<DB, TABLE_OR_VIEW2, number | null | undefined>, end: NumberValueSource<DB, TABLE_OR_VIEW3, number>): StringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2 | TABLE_OR_VIEW3, TYPE| null | undefined>
    substring<TABLE_OR_VIEW2 extends ITableOrView<DB>, TABLE_OR_VIEW3 extends ITableOrView<DB>>(start: NumberValueSource<DB, TABLE_OR_VIEW2, number | null | undefined>, end: NumberValueSource<DB, TABLE_OR_VIEW3, number | null | undefined>): StringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2 | TABLE_OR_VIEW3, TYPE| null | undefined>
    replaceIfValue(findString: TYPE | null | undefined, replaceWith: TYPE | null | undefined): StringValueSource<DB, TABLE_OR_VIEW, TYPE>
    replaceIfValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(findString: TYPE | null | undefined, replaceWith: StringValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    replaceIfValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(findString: TYPE | null | undefined, replaceWith: StringValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    replaceIfValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(findString: StringValueSource<DB, TABLE_OR_VIEW2, TYPE>, replaceWith: TYPE | null | undefined): StringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    replaceIfValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(findString: StringValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>, replaceWith: TYPE | null | undefined): StringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    replace(findString: TYPE, replaceWith: TYPE): StringValueSource<DB, TABLE_OR_VIEW, TYPE>
    replace<TABLE_OR_VIEW2 extends ITableOrView<DB>>(findString: TYPE, replaceWith: StringValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    replace<TABLE_OR_VIEW2 extends ITableOrView<DB>>(findString: TYPE, replaceWith: StringValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    replace<TABLE_OR_VIEW2 extends ITableOrView<DB>>(findString: StringValueSource<DB, TABLE_OR_VIEW2, TYPE>, replaceWith: TYPE): StringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    replace<TABLE_OR_VIEW2 extends ITableOrView<DB>>(findString: StringValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>, replaceWith: TYPE): StringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    replace<TABLE_OR_VIEW2 extends ITableOrView<DB>, TABLE_OR_VIEW3 extends ITableOrView<DB>>(findString: StringValueSource<DB, TABLE_OR_VIEW2, TYPE>, replaceWith: StringValueSource<DB, TABLE_OR_VIEW3, TYPE>): StringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2 | TABLE_OR_VIEW3, TYPE>
    replace<TABLE_OR_VIEW2 extends ITableOrView<DB>, TABLE_OR_VIEW3 extends ITableOrView<DB>>(findString: StringValueSource<DB, TABLE_OR_VIEW2, TYPE>, replaceWith: StringValueSource<DB, TABLE_OR_VIEW3, TYPE | null | undefined>): StringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2 | TABLE_OR_VIEW3, TYPE | null | undefined>
    replace<TABLE_OR_VIEW2 extends ITableOrView<DB>, TABLE_OR_VIEW3 extends ITableOrView<DB>>(findString: StringValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>, replaceWith: StringValueSource<DB, TABLE_OR_VIEW3, TYPE>): StringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2 | TABLE_OR_VIEW3, TYPE | null | undefined>
    replace<TABLE_OR_VIEW2 extends ITableOrView<DB>, TABLE_OR_VIEW3 extends ITableOrView<DB>>(findString: StringValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>, replaceWith: StringValueSource<DB, TABLE_OR_VIEW3, TYPE | null | undefined>): StringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2 | TABLE_OR_VIEW3, TYPE | null | undefined>
    // Redefined methods
    valueWhenNull(value: MandatoryTypeOf<TYPE>): StringValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, MandatoryTypeOf<TYPE>>): StringValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
    asOptional(): StringValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
}

export interface TypeSafeStringValueSource<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, TYPE /*extends string | null | undefined = string*/> extends ComparableValueSource<DB, TABLE_OR_VIEW, TYPE> {
    // SqlComparator 1
    //asString(): TypeSafeStringValueSource<DB, TABLE_OR_VIEW, TYPE> // test function
    equalsInsensitiveIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    equalsInsensitive(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    equalsInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    equalsInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    notEqualsInsensitiveIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    notEqualsInsensitive(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    notEqualsInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    notEqualsInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    likeIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    like(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    like<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    like<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    notLikeIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    notLike(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    notLike<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    notLike<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    likeInsensitiveIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    likeInsensitive(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    likeInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    likeInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    notLikeInsensitiveIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    notLikeInsensitive(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    notLikeInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    notLikeInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    startWithIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    startWith(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    startWith<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    startWith<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    notStartWithIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    notStartWith(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    notStartWith<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    notStartWith<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    endWithIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    endWith(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    endWith<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    endWith<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    notEndWithIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    notEndWith(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    notEndWith<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    notEndWith<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    startWithInsensitiveIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    startWithInsensitive(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    startWithInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    startWithInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    notStartWithInsensitiveIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    notStartWithInsensitive(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    notStartWithInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    notStartWithInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    endWithInsensitiveIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    endWithInsensitive(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    endWithInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    endWithInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    notEndWithInsensitiveIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    notEndWithInsensitive(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    notEndWithInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    notEndWithInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    containsIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    contains(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    contains<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    contains<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    notContainsIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    notContains(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    notContains<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    notContains<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    containsInsensitiveIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    containsInsensitive(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    containsInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    containsInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    notContainsInsensitiveIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    notContainsInsensitive(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    notContainsInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    notContainsInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    // SqlFunction0
    lower(): TypeSafeStringValueSource<DB, TABLE_OR_VIEW, TYPE>
    upper(): TypeSafeStringValueSource<DB, TABLE_OR_VIEW, TYPE>
    length(): IntValueSource<DB, TABLE_OR_VIEW, int>
    trim(): TypeSafeStringValueSource<DB, TABLE_OR_VIEW, TYPE>
    ltrim(): TypeSafeStringValueSource<DB, TABLE_OR_VIEW, TYPE>
    rtrim(): TypeSafeStringValueSource<DB, TABLE_OR_VIEW, TYPE>
    reverse(): TypeSafeStringValueSource<DB, TABLE_OR_VIEW, TYPE>
    // SqlFunction1
    concatIfValue(value: TYPE | null | undefined): TypeSafeStringValueSource<DB, TABLE_OR_VIEW, TYPE>
    concat(value: TYPE): TypeSafeStringValueSource<DB, TABLE_OR_VIEW, TYPE>
    concat(value: TYPE | null | undefined): TypeSafeStringValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
    concat<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: TypeSafeStringValueSource<DB, TABLE_OR_VIEW2, TYPE>): TypeSafeStringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    concat<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: TypeSafeStringValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): TypeSafeStringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    substringToEnd(start: int): TypeSafeStringValueSource<DB, TABLE_OR_VIEW, TYPE>
    substringToEnd<TABLE_OR_VIEW2 extends ITableOrView<DB>>(start: IntValueSource<DB, TABLE_OR_VIEW2, int>): TypeSafeStringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    substringToEnd<TABLE_OR_VIEW2 extends ITableOrView<DB>>(start: IntValueSource<DB, TABLE_OR_VIEW2, int | null | undefined>): TypeSafeStringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    // SqlFunction2
    substring(start: int, end: int): TypeSafeStringValueSource<DB, TABLE_OR_VIEW, TYPE>
    substring<TABLE_OR_VIEW2 extends ITableOrView<DB>>(start: int, end: IntValueSource<DB, TABLE_OR_VIEW2, int>): TypeSafeStringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    substring<TABLE_OR_VIEW2 extends ITableOrView<DB>>(start: int, end: IntValueSource<DB, TABLE_OR_VIEW2, int | null | undefined>): TypeSafeStringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    substring<TABLE_OR_VIEW2 extends ITableOrView<DB>>(start: IntValueSource<DB, TABLE_OR_VIEW2, int>, end: int): TypeSafeStringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    substring<TABLE_OR_VIEW2 extends ITableOrView<DB>>(start: IntValueSource<DB, TABLE_OR_VIEW2, int | null | undefined>, end: int): TypeSafeStringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    substring<TABLE_OR_VIEW2 extends ITableOrView<DB>, TABLE_OR_VIEW3 extends ITableOrView<DB>>(start: IntValueSource<DB, TABLE_OR_VIEW2, int>, end: IntValueSource<DB, TABLE_OR_VIEW3, int>): TypeSafeStringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2 | TABLE_OR_VIEW3, TYPE>
    substring<TABLE_OR_VIEW2 extends ITableOrView<DB>, TABLE_OR_VIEW3 extends ITableOrView<DB>>(start: IntValueSource<DB, TABLE_OR_VIEW2, int>, end: IntValueSource<DB, TABLE_OR_VIEW3, int | null | undefined>): TypeSafeStringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2 | TABLE_OR_VIEW3, TYPE| null | undefined>
    substring<TABLE_OR_VIEW2 extends ITableOrView<DB>, TABLE_OR_VIEW3 extends ITableOrView<DB>>(start: IntValueSource<DB, TABLE_OR_VIEW2, int | null | undefined>, end: IntValueSource<DB, TABLE_OR_VIEW3, int>): TypeSafeStringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2 | TABLE_OR_VIEW3, TYPE| null | undefined>
    substring<TABLE_OR_VIEW2 extends ITableOrView<DB>, TABLE_OR_VIEW3 extends ITableOrView<DB>>(start: IntValueSource<DB, TABLE_OR_VIEW2, int | null | undefined>, end: IntValueSource<DB, TABLE_OR_VIEW3, int | null | undefined>): TypeSafeStringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2 | TABLE_OR_VIEW3, TYPE| null | undefined>
    replaceIfValue(findString: TYPE | null | undefined, replaceWith: TYPE | null | undefined): TypeSafeStringValueSource<DB, TABLE_OR_VIEW, TYPE>
    replaceIfValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(findString: TYPE | null | undefined, replaceWith: TypeSafeStringValueSource<DB, TABLE_OR_VIEW2, TYPE>): TypeSafeStringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    replaceIfValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(findString: TYPE | null | undefined, replaceWith: TypeSafeStringValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): TypeSafeStringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    replaceIfValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(findString: TypeSafeStringValueSource<DB, TABLE_OR_VIEW2, TYPE>, replaceWith: TYPE | null | undefined): TypeSafeStringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    replaceIfValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(findString: TypeSafeStringValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>, replaceWith: TYPE | null | undefined): TypeSafeStringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    replace(findString: TYPE, replaceWith: TYPE): TypeSafeStringValueSource<DB, TABLE_OR_VIEW, TYPE>
    replace<TABLE_OR_VIEW2 extends ITableOrView<DB>>(findString: TYPE, replaceWith: TypeSafeStringValueSource<DB, TABLE_OR_VIEW2, TYPE>): TypeSafeStringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    replace<TABLE_OR_VIEW2 extends ITableOrView<DB>>(findString: TYPE, replaceWith: TypeSafeStringValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): TypeSafeStringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    replace<TABLE_OR_VIEW2 extends ITableOrView<DB>>(findString: TypeSafeStringValueSource<DB, TABLE_OR_VIEW2, TYPE>, replaceWith: TYPE): TypeSafeStringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    replace<TABLE_OR_VIEW2 extends ITableOrView<DB>>(findString: TypeSafeStringValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>, replaceWith: TYPE): TypeSafeStringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    replace<TABLE_OR_VIEW2 extends ITableOrView<DB>, TABLE_OR_VIEW3 extends ITableOrView<DB>>(findString: TypeSafeStringValueSource<DB, TABLE_OR_VIEW2, TYPE>, replaceWith: TypeSafeStringValueSource<DB, TABLE_OR_VIEW3, TYPE>): TypeSafeStringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2 | TABLE_OR_VIEW3, TYPE>
    replace<TABLE_OR_VIEW2 extends ITableOrView<DB>, TABLE_OR_VIEW3 extends ITableOrView<DB>>(findString: TypeSafeStringValueSource<DB, TABLE_OR_VIEW2, TYPE>, replaceWith: TypeSafeStringValueSource<DB, TABLE_OR_VIEW3, TYPE | null | undefined>): TypeSafeStringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2 | TABLE_OR_VIEW3, TYPE | null | undefined>
    replace<TABLE_OR_VIEW2 extends ITableOrView<DB>, TABLE_OR_VIEW3 extends ITableOrView<DB>>(findString: TypeSafeStringValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>, replaceWith: TypeSafeStringValueSource<DB, TABLE_OR_VIEW3, TYPE>): TypeSafeStringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2 | TABLE_OR_VIEW3, TYPE | null | undefined>
    replace<TABLE_OR_VIEW2 extends ITableOrView<DB>, TABLE_OR_VIEW3 extends ITableOrView<DB>>(findString: TypeSafeStringValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>, replaceWith: TypeSafeStringValueSource<DB, TABLE_OR_VIEW3, TYPE | null | undefined>): TypeSafeStringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2 | TABLE_OR_VIEW3, TYPE | null | undefined>
    // Redefined methods
    valueWhenNull(value: MandatoryTypeOf<TYPE>): TypeSafeStringValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, MandatoryTypeOf<TYPE>>): TypeSafeStringValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): TypeSafeStringValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
    asOptional(): TypeSafeStringValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
}

export interface DateValueSource<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, TYPE /*extends Date | null | undefined = Date*/> extends ComparableValueSource<DB, TABLE_OR_VIEW, TYPE> {
    /** Gets the year */
    getFullYear(): NumberValueSource<DB, TABLE_OR_VIEW, number>
    /** Gets the month (value between 0 to 11)*/
    getMonth(): NumberValueSource<DB, TABLE_OR_VIEW, number>
    /** Gets the day-of-the-month */
    getDate(): NumberValueSource<DB, TABLE_OR_VIEW, number>
    /** Gets the day of the week (0 represents Sunday) */
    getDay(): NumberValueSource<DB, TABLE_OR_VIEW, number>
    // Redefined methods
    valueWhenNull(value: MandatoryTypeOf<TYPE>): DateValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, MandatoryTypeOf<TYPE>>): DateValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DateValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
    asOptional(): DateValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
}

export interface TimeValueSource<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, TYPE /*extends Date | null | undefined = Date*/> extends ComparableValueSource<DB, TABLE_OR_VIEW, TYPE> {
    /** Gets the hours */
    getHours(): NumberValueSource<DB, TABLE_OR_VIEW, number>
    /** Gets the minutes */
    getMinutes(): NumberValueSource<DB, TABLE_OR_VIEW, number>
    /** Gets the seconds */
    getSeconds(): NumberValueSource<DB, TABLE_OR_VIEW, number>
    /** Gets the milliseconds */
    getMilliseconds(): NumberValueSource<DB, TABLE_OR_VIEW, number>
    // Redefined methods
    valueWhenNull(value: MandatoryTypeOf<TYPE>): TimeValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, MandatoryTypeOf<TYPE>>): TimeValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): TimeValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
    asOptional(): TimeValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
}

export interface DateTimeValueSource<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, TYPE /*extends Date | null | undefined = Date*/> extends ComparableValueSource<DB, TABLE_OR_VIEW, TYPE> {
    /** Gets the year */
    getFullYear(): NumberValueSource<DB, TABLE_OR_VIEW, number>
    /** Gets the month (value between 0 to 11)*/
    getMonth(): NumberValueSource<DB, TABLE_OR_VIEW, number>
    /** Gets the day-of-the-month */
    getDate(): NumberValueSource<DB, TABLE_OR_VIEW, number>
    /** Gets the day of the week (0 represents Sunday) */
    getDay(): NumberValueSource<DB, TABLE_OR_VIEW, number>
    /** Gets the hours */
    getHours(): NumberValueSource<DB, TABLE_OR_VIEW, number>
    /** Gets the minutes */
    getMinutes(): NumberValueSource<DB, TABLE_OR_VIEW, number>
    /** Gets the seconds */
    getSeconds(): NumberValueSource<DB, TABLE_OR_VIEW, number>
    /** Gets the milliseconds */
    getMilliseconds(): NumberValueSource<DB, TABLE_OR_VIEW, number>
    /** Gets the time value in milliseconds */
    getTime(): NumberValueSource<DB, TABLE_OR_VIEW, number>
    // Redefined methods
    valueWhenNull(value: MandatoryTypeOf<TYPE>): DateTimeValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, MandatoryTypeOf<TYPE>>): DateTimeValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DateTimeValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
    asOptional(): DateTimeValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
}

export interface LocalDateValueSource<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, TYPE /*extends LocalDate | null | undefined = LocalDate*/> extends ComparableValueSource<DB, TABLE_OR_VIEW, TYPE> {
    /** Gets the year */
    getFullYear(): IntValueSource<DB, TABLE_OR_VIEW, int>
    /** Gets the month (value between 0 to 11)*/
    getMonth(): IntValueSource<DB, TABLE_OR_VIEW, int>
    /** Gets the day-of-the-month */
    getDate(): IntValueSource<DB, TABLE_OR_VIEW, int>
    /** Gets the day of the week (0 represents Sunday) */
    getDay(): IntValueSource<DB, TABLE_OR_VIEW, int>
    // Redefined methods
    valueWhenNull(value: MandatoryTypeOf<TYPE>): LocalDateValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, MandatoryTypeOf<TYPE>>): LocalDateValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): LocalDateValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
    asOptional(): LocalDateValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
}

export interface LocalTimeValueSource<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, TYPE /*extends LocalTime | null | undefined = LocalTime*/> extends ComparableValueSource<DB, TABLE_OR_VIEW, TYPE> {
    /** Gets the hours */
    getHours(): IntValueSource<DB, TABLE_OR_VIEW, int>
    /** Gets the minutes */
    getMinutes(): IntValueSource<DB, TABLE_OR_VIEW, int>
    /** Gets the seconds */
    getSeconds(): IntValueSource<DB, TABLE_OR_VIEW, int>
    /** Gets the milliseconds */
    getMilliseconds(): IntValueSource<DB, TABLE_OR_VIEW, int>
    // Redefined methods
    valueWhenNull(value: MandatoryTypeOf<TYPE>): LocalTimeValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, MandatoryTypeOf<TYPE>>): LocalTimeValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): LocalTimeValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
    asOptional(): LocalTimeValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
}

export interface LocalDateTimeValueSource<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, TYPE /*extends LocalDateTime | null | undefined = LocalDateTime*/> extends ComparableValueSource<DB, TABLE_OR_VIEW, TYPE> {
    /** Gets the year */
    getFullYear(): IntValueSource<DB, TABLE_OR_VIEW, int>
    /** Gets the month (value between 0 to 11)*/
    getMonth(): IntValueSource<DB, TABLE_OR_VIEW, int>
    /** Gets the day-of-the-month */
    getDate(): IntValueSource<DB, TABLE_OR_VIEW, int>
    /** Gets the day of the week (0 represents Sunday) */
    getDay(): IntValueSource<DB, TABLE_OR_VIEW, int>
    /** Gets the hours */
    getHours(): IntValueSource<DB, TABLE_OR_VIEW, int>
    /** Gets the minutes */
    getMinutes(): IntValueSource<DB, TABLE_OR_VIEW, int>
    /** Gets the seconds */
    getSeconds(): IntValueSource<DB, TABLE_OR_VIEW, int>
    /** Gets the milliseconds */
    getMilliseconds(): IntValueSource<DB, TABLE_OR_VIEW, int>
    /** Gets the time value in milliseconds. */
    getTime(): IntValueSource<DB, TABLE_OR_VIEW, int>
    // Redefined methods
    valueWhenNull(value: MandatoryTypeOf<TYPE>): LocalDateTimeValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, MandatoryTypeOf<TYPE>>): LocalDateTimeValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): LocalDateTimeValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
    asOptional(): LocalDateTimeValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
}

export type ColumnsOf<DB extends AnyDB, TYPE extends ITableOrView<DB>> = ({ [K in keyof TYPE]-?: TYPE[K] extends ValueSource<DB, TYPE, any> ? K : never })[keyof TYPE]

export type TypeOfColumn<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, K extends ColumnsOf<DB, TABLE_OR_VIEW>> =
    TABLE_OR_VIEW[K] extends ValueSource<DB, TABLE_OR_VIEW, infer Q> ? Q
    : never

export type InputTypeOfColumn<DB extends AnyDB, TYPE extends ITableOrView<DB>, K extends ColumnsOf<DB, TYPE>> =
    TYPE[K] extends ValueSource<DB, TYPE, infer Q> ?
    (TYPE[K] extends ColumnWithDefaultValue ? (
        Q | ValueSource<DB, TYPE, Q> | Default
    ) : (
        Q | ValueSource<DB, TYPE, Q>
    ))
    : never

export type BooleanOrNullOf<T> = T extends null | undefined ? T : boolean
export type StringOrNullOf<T> = T extends null | undefined ? T : string

export type RemapValueSourceType<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, TYPE> =
    TYPE extends ValueSource<DB, any, infer T> ? (
        TYPE extends BooleanValueSource<DB, any, any> ? BooleanValueSource<DB, TABLE_OR_VIEW, T> :
        TYPE extends StringIntValueSource<DB, any, any> ? StringIntValueSource<DB, TABLE_OR_VIEW, T> :
        TYPE extends IntValueSource<DB, any, any> ? IntValueSource<DB, TABLE_OR_VIEW, T> :
        TYPE extends StringDoubleValueSource<DB, any, any> ? StringDoubleValueSource<DB, TABLE_OR_VIEW, T> :
        TYPE extends DoubleValueSource<DB, any, any> ? DoubleValueSource<DB, TABLE_OR_VIEW, T> :
        TYPE extends StringNumberValueSource<DB, any, any> ? StringNumberValueSource<DB, TABLE_OR_VIEW, T> :
        TYPE extends NumberValueSource<DB, any, any> ? NumberValueSource<DB, TABLE_OR_VIEW, T> :
        TYPE extends TypeSafeStringValueSource<DB, any, any> ? TypeSafeStringValueSource<DB, TABLE_OR_VIEW, T> :
        TYPE extends StringValueSource<DB, any, any> ? StringValueSource<DB, TABLE_OR_VIEW, T> :
        TYPE extends LocalDateTimeValueSource<DB, any, any> ? LocalDateTimeValueSource<DB, TABLE_OR_VIEW, T> :
        TYPE extends DateTimeValueSource<DB, any, any> ? DateTimeValueSource<DB, TABLE_OR_VIEW, T> :
        TYPE extends LocalDateValueSource<DB, any, any> ? LocalDateValueSource<DB, TABLE_OR_VIEW, T> :
        TYPE extends DateValueSource<DB, any, any> ? DateValueSource<DB, TABLE_OR_VIEW, T> :
        TYPE extends LocalTimeValueSource<DB, any, any> ? LocalTimeValueSource<DB, TABLE_OR_VIEW, T> :
        TYPE extends TimeValueSource<DB, any, any> ? TimeValueSource<DB, TABLE_OR_VIEW, T> :
        TYPE extends ComparableValueSource<DB, any, any> ? ComparableValueSource<DB, TABLE_OR_VIEW, T> :
        TYPE extends EqualableValueSource<DB, any, any> ? EqualableValueSource<DB, TABLE_OR_VIEW, T> :
        TYPE extends NullableValueSource<DB, any, any> ? NullableValueSource<DB, TABLE_OR_VIEW, T> :
        TYPE extends ValueSource<DB, any, any> ? NullableValueSource<DB, TABLE_OR_VIEW, T> :
        never
    ): never

export type RemapValueSourceTypeAsOptional<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, TYPE> =
    TYPE extends ValueSource<DB, any, infer T> ? (
        TYPE extends BooleanValueSource<DB, any, any> ? BooleanValueSource<DB, TABLE_OR_VIEW, T | null | undefined> :
        TYPE extends StringIntValueSource<DB, any, any> ? StringIntValueSource<DB, TABLE_OR_VIEW, T | null | undefined> :
        TYPE extends IntValueSource<DB, any, any> ? IntValueSource<DB, TABLE_OR_VIEW, T | null | undefined> :
        TYPE extends StringDoubleValueSource<DB, any, any> ? StringDoubleValueSource<DB, TABLE_OR_VIEW, T | null | undefined> :
        TYPE extends DoubleValueSource<DB, any, any> ? DoubleValueSource<DB, TABLE_OR_VIEW, T | null | undefined> :
        TYPE extends StringNumberValueSource<DB, any, any> ? StringNumberValueSource<DB, TABLE_OR_VIEW, T | null | undefined> :
        TYPE extends NumberValueSource<DB, any, any> ? NumberValueSource<DB, TABLE_OR_VIEW, T | null | undefined> :
        TYPE extends TypeSafeStringValueSource<DB, any, any> ? TypeSafeStringValueSource<DB, TABLE_OR_VIEW, T | null | undefined> :
        TYPE extends StringValueSource<DB, any, any> ? StringValueSource<DB, TABLE_OR_VIEW, T | null | undefined> :
        TYPE extends LocalDateTimeValueSource<DB, any, any> ? LocalDateTimeValueSource<DB, TABLE_OR_VIEW, T | null | undefined> :
        TYPE extends DateTimeValueSource<DB, any, any> ? DateTimeValueSource<DB, TABLE_OR_VIEW, T | null | undefined> :
        TYPE extends LocalDateValueSource<DB, any, any> ? LocalDateValueSource<DB, TABLE_OR_VIEW, T | null | undefined> :
        TYPE extends DateValueSource<DB, any, any> ? DateValueSource<DB, TABLE_OR_VIEW, T | null | undefined> :
        TYPE extends LocalTimeValueSource<DB, any, any> ? LocalTimeValueSource<DB, TABLE_OR_VIEW, T | null | undefined> :
        TYPE extends TimeValueSource<DB, any, any> ? TimeValueSource<DB, TABLE_OR_VIEW, T | null | undefined> :
        TYPE extends ComparableValueSource<DB, any, any> ? ComparableValueSource<DB, TABLE_OR_VIEW, T | null | undefined> :
        TYPE extends EqualableValueSource<DB, any, any> ? EqualableValueSource<DB, TABLE_OR_VIEW, T | null | undefined> :
        TYPE extends NullableValueSource<DB, any, any> ? NullableValueSource<DB, TABLE_OR_VIEW, T | null | undefined> :
        TYPE extends ValueSource<DB, any, any> ? NullableValueSource<DB, TABLE_OR_VIEW, T | null | undefined> :
        never
    ): never

export type RemapValueSourceTypeAsMandatory<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, TYPE> =
    TYPE extends ValueSource<DB, any, infer T> ? (
        TYPE extends BooleanValueSource<DB, any, any> ? BooleanValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<T>> :
        TYPE extends StringIntValueSource<DB, any, any> ? StringIntValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<T>> :
        TYPE extends IntValueSource<DB, any, any> ? IntValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<T>> :
        TYPE extends StringDoubleValueSource<DB, any, any> ? StringDoubleValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<T>> :
        TYPE extends DoubleValueSource<DB, any, any> ? DoubleValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<T>> :
        TYPE extends StringNumberValueSource<DB, any, any> ? StringNumberValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<T>> :
        TYPE extends NumberValueSource<DB, any, any> ? NumberValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<T>> :
        TYPE extends TypeSafeStringValueSource<DB, any, any> ? TypeSafeStringValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<T>> :
        TYPE extends StringValueSource<DB, any, any> ? StringValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<T>> :
        TYPE extends LocalDateTimeValueSource<DB, any, any> ? LocalDateTimeValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<T>> :
        TYPE extends DateTimeValueSource<DB, any, any> ? DateTimeValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<T>> :
        TYPE extends LocalDateValueSource<DB, any, any> ? LocalDateValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<T>> :
        TYPE extends DateValueSource<DB, any, any> ? DateValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<T>> :
        TYPE extends LocalTimeValueSource<DB, any, any> ? LocalTimeValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<T>> :
        TYPE extends TimeValueSource<DB, any, any> ? TimeValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<T>> :
        TYPE extends ComparableValueSource<DB, any, any> ? ComparableValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<T>> :
        TYPE extends EqualableValueSource<DB, any, any> ? EqualableValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<T>> :
        TYPE extends NullableValueSource<DB, any, any> ? NullableValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<T>> :
        TYPE extends ValueSource<DB, any, any> ? NullableValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<T>> :
        never
    ): never

export type MandatoryTypeOf<T> = T extends null | undefined ? never : T
export type OptionalTypeOf<T> = T extends null ? null : T extends undefined ? undefined : never
export type AsType<T, TYPE> = TYPE | OptionalTypeOf<T>

export type ArgumentType = 'boolean' | 'stringInt' | 'int' | 'stringDouble' | 'double' | 'string' | 'localDateTime' | 'localDate' | 'localTime' | 'customComparable' | 'enum' | 'custom'
export type ArgumentRequire = 'required' | 'optional'
export class Argument<T extends ArgumentType, REQUIRED extends ArgumentRequire, TYPE> {
    readonly type: T
    readonly typeName: string
    readonly required: REQUIRED
    readonly adapter?: TypeAdapter
    [valueType]: TYPE
    constructor (argumentType: T, typeName: string, required: REQUIRED, adapter?: TypeAdapter,) {
        this.type = argumentType
        this.typeName = typeName
        this.required = required
        this.adapter = adapter
    }
}

export type TypeOf<R extends ArgumentRequire, T> = R extends 'required' ? T : (T | null | undefined)
export type TypeOfArgument<ARG> = ARG extends Argument<any, any, infer T> ? T : never

export type MapArgumentToTypeSafe<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, ARG> =
    ARG extends Argument<infer TYPE, infer REQUIRED, infer T> ? (
        TYPE extends 'boolean' ? BooleanValueSource<DB, TABLE_OR_VIEW, TypeOf<REQUIRED, T>> :
        TYPE extends 'stringInt' ? StringIntValueSource<DB, TABLE_OR_VIEW, TypeOf<REQUIRED, T>> :
        TYPE extends 'int' ? IntValueSource<DB, TABLE_OR_VIEW, TypeOf<REQUIRED, T>> :
        TYPE extends 'stringDouble' ? StringDoubleValueSource<DB, TABLE_OR_VIEW, TypeOf<REQUIRED, T>> :
        TYPE extends 'double' ? DoubleValueSource<DB, TABLE_OR_VIEW, TypeOf<REQUIRED, T>> :
        TYPE extends 'string' ? TypeSafeStringValueSource<DB, TABLE_OR_VIEW, TypeOf<REQUIRED, T>> :
        TYPE extends 'localDateTime' ? LocalDateTimeValueSource<DB, TABLE_OR_VIEW, TypeOf<REQUIRED, T>> :
        TYPE extends 'localDate' ? LocalDateValueSource<DB, TABLE_OR_VIEW, TypeOf<REQUIRED, T>> :
        TYPE extends 'localTime' ? LocalTimeValueSource<DB, TABLE_OR_VIEW, TypeOf<REQUIRED, T>> :
        TYPE extends 'customComparable'? ComparableValueSource<DB, TABLE_OR_VIEW, TypeOf<REQUIRED, T>> :
        TYPE extends 'enum' ? EqualableValueSource<DB, TABLE_OR_VIEW, TypeOf<REQUIRED, T>> :
        TYPE extends 'custom' ? EqualableValueSource<DB, TABLE_OR_VIEW, TypeOf<REQUIRED, T>> :
        never
    ): never

export type MapArgumentToTypeUnsafe<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, ARG> =
    ARG extends Argument<infer TYPE, infer REQUIRED, infer T> ? (
        TYPE extends 'boolean' ? BooleanValueSource<DB, TABLE_OR_VIEW, TypeOf<REQUIRED, T>> :
        TYPE extends 'stringInt' ? StringNumberValueSource<DB, TABLE_OR_VIEW, TypeOf<REQUIRED, T>> :
        TYPE extends 'int' ? NumberValueSource<DB, TABLE_OR_VIEW, TypeOf<REQUIRED, T>> :
        TYPE extends 'stringDouble' ? StringDoubleValueSource<DB, TABLE_OR_VIEW, TypeOf<REQUIRED, T>> :
        TYPE extends 'double' ? NumberValueSource<DB, TABLE_OR_VIEW, TypeOf<REQUIRED, T>> :
        TYPE extends 'string' ? StringValueSource<DB, TABLE_OR_VIEW, TypeOf<REQUIRED, T>> :
        TYPE extends 'localDateTime' ? DateTimeValueSource<DB, TABLE_OR_VIEW, TypeOf<REQUIRED, T>> :
        TYPE extends 'localDate' ? DateValueSource<DB, TABLE_OR_VIEW, TypeOf<REQUIRED, T>> :
        TYPE extends 'localTime' ? TimeValueSource<DB, TABLE_OR_VIEW, TypeOf<REQUIRED, T>> :
        TYPE extends 'customComparable' ? ComparableValueSource<DB, TABLE_OR_VIEW, TypeOf<REQUIRED, T>> :
        TYPE extends 'enum' ? EqualableValueSource<DB, TABLE_OR_VIEW, TypeOf<REQUIRED, T>> :
        TYPE extends 'custom' ? EqualableValueSource<DB, TABLE_OR_VIEW, TypeOf<REQUIRED, T>> :
        never
    ): never