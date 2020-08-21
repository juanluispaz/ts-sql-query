import { ITableOrView } from "../utils/ITableOrView"
import { ColumnWithDefaultValue } from "../utils/ColumnWithDefaultValue"
import { Default } from "./Default"
import { AnyDB } from "../databases/AnyDB"
import { ExecutableSelect } from "./select"
import { int, double, /*LocalDate, LocalTime, LocalDateTime,*/ stringDouble, stringInt } from "ts-extended-types"
import { TypeAdapter } from "../TypeAdapter"

export abstract class ValueSource<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, TYPE> {
    // @ts-ignore
    protected ___database: DB
    // @ts-ignore
    protected ___table_or_view: TABLE_OR_VIEW
    // @ts-ignore
    protected ___type: TYPE
}

export interface __ValueSourcePrivate {
    __columnType: string
    __typeAdapter?: TypeAdapter
}

export function __getValueSourcePrivate(valueSource: ValueSource<any, any, any>): __ValueSourcePrivate {
    return valueSource as any
}

export abstract class NullableValueSource<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, TYPE> extends ValueSource<DB,TABLE_OR_VIEW, TYPE> {
    abstract isNull(): BooleanValueSource<DB, TABLE_OR_VIEW, boolean>
    abstract isNotNull(): BooleanValueSource<DB, TABLE_OR_VIEW, boolean>
    // Next methods uses this as generic argument to avoid create a circular reference
    // Next methods doen't works on TS 3.5.3, it create a 'Type instantiation is excessively deep and possibly infinite.' (sometimes on UpdateQueryBuilder), a specific implementation will be created
    // abstract valueWhenNull<THIS>(this: THIS, value: MandatoryTypeOf<TYPE>): RemapValueSourceTypeAsMandatory<DB, TABLE_OR_VIEW, THIS>
    // abstract valueWhenNull<THIS, TABLE_OR_VIEW2 extends ITable<DB>>(this: THIS, value: ValueSource<DB, TABLE_OR_VIEW2, MandatoryTypeOf<TYPE>>): RemapValueSourceTypeAsMandatory<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, THIS>
    // abstract valueWhenNull<THIS, TABLE_OR_VIEW2 extends ITable<DB>>(this: THIS, value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): RemapValueSourceTypeAsOptional<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, THIS>
    // abstract asOptional<THIS>(this: THIS): RemapValueSourceTypeAsOptional<DB, TABLE_OR_VIEW, THIS>
    abstract valueWhenNull(value: MandatoryTypeOf<TYPE>): NullableValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    abstract valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, MandatoryTypeOf<TYPE>>): NullableValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    abstract valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): NullableValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
    abstract asOptional(): NullableValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
}

export abstract class EqualableValueSource<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, TYPE> extends NullableValueSource<DB,TABLE_OR_VIEW, TYPE> {
    abstract equalsIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract equals(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract equals<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    abstract equals<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE  | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE | null | undefined>>
    abstract notEqualsIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract notEquals(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract notEquals<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    abstract notEquals<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE  | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE | null | undefined>>
    abstract isIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract is(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract is<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    abstract is<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE | null | undefined>>
    abstract isNotIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, boolean>
    abstract isNot(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, boolean>
    abstract isNot<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    abstract isNot<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE | null | undefined>>

    abstract inIfValue(values: TYPE[] | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract inIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract in(values: TYPE[]): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract in(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract in<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    abstract in<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE | null | undefined>>
    abstract in<TABLE_OR_VIEW2 extends ITableOrView<DB>>(select: ExecutableSelect<DB, TYPE | null | undefined, TABLE_OR_VIEW2>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean>
    abstract notInIfValue(values: TYPE[] | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract notInIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract notIn(values: TYPE[]): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract notIn(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract notIn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    abstract notIn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE | null | undefined>>
    abstract notIn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(select: ExecutableSelect<DB, TYPE | null | undefined, TABLE_OR_VIEW2>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean>
    abstract inN(...value: TYPE[]): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract inN<TABLE_OR_VIEW2 extends ITableOrView<DB>>(...value: (TYPE | ValueSource<DB, TABLE_OR_VIEW2, TYPE>)[]): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>> // limitation: only one source table
    abstract inN<TABLE_OR_VIEW2 extends ITableOrView<DB>>(...value: (TYPE | ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>)[]): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE | null | undefined>> // limitation: only one source table
    abstract notInN(...value: TYPE[]): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract notInN<TABLE_OR_VIEW2 extends ITableOrView<DB>>(...value: (TYPE | ValueSource<DB, TABLE_OR_VIEW2, TYPE>)[]): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>> // limitation: only one source table
    abstract notInN<TABLE_OR_VIEW2 extends ITableOrView<DB>>(...value: (TYPE | ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>)[]): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE | null | undefined>> // limitation: only one source table

    // Redefined methods
    abstract valueWhenNull(value: MandatoryTypeOf<TYPE>): EqualableValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    abstract valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, MandatoryTypeOf<TYPE>>): EqualableValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    abstract valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): EqualableValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
    abstract asOptional(): EqualableValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
}

export abstract class ComparableValueSource<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, TYPE> extends EqualableValueSource<DB, TABLE_OR_VIEW, TYPE> {
    abstract smallerIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract smaller(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract smaller<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    abstract smaller<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE | null | undefined>>
    abstract largerIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract larger(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract larger<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    abstract larger<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE | null | undefined>>
    abstract smallAsIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract smallAs(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract smallAs<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    abstract smallAs<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE | null | undefined>>
    abstract largeAsIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract largeAs(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract largeAs<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    abstract largeAs<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE | null | undefined>>
    abstract between(value: TYPE, value2: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract between<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: TYPE, value2: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    abstract between<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: TYPE, value2: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    abstract between<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>, value2: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    abstract between<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>, value2: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    abstract between<TABLE_OR_VIEW2 extends ITableOrView<DB>, TABLE_OR_VIEW3 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>, value2: ValueSource<DB, TABLE_OR_VIEW3, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2 | TABLE_OR_VIEW3, BooleanOrNullOf<TYPE>>
    abstract between<TABLE_OR_VIEW2 extends ITableOrView<DB>, TABLE_OR_VIEW3 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>, value2: ValueSource<DB, TABLE_OR_VIEW3, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2 | TABLE_OR_VIEW3, boolean | null | undefined>
    abstract between<TABLE_OR_VIEW2 extends ITableOrView<DB>, TABLE_OR_VIEW3 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>, value2: ValueSource<DB, TABLE_OR_VIEW3, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2 | TABLE_OR_VIEW3, boolean | null | undefined>
    abstract between<TABLE_OR_VIEW2 extends ITableOrView<DB>, TABLE_OR_VIEW3 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>, value2: ValueSource<DB, TABLE_OR_VIEW3, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2 | TABLE_OR_VIEW3, boolean | null | undefined>
    abstract notBetween(value: TYPE, value2: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract notBetween<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: TYPE, value2: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    abstract notBetween<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: TYPE, value2: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    abstract notBetween<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>, value2: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    abstract notBetween<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>, value2: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    abstract notBetween<TABLE_OR_VIEW2 extends ITableOrView<DB>, TABLE_OR_VIEW3 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>, value2: ValueSource<DB, TABLE_OR_VIEW3, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2 | TABLE_OR_VIEW3, BooleanOrNullOf<TYPE>>
    abstract notBetween<TABLE_OR_VIEW2 extends ITableOrView<DB>, TABLE_OR_VIEW3 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>, value2: ValueSource<DB, TABLE_OR_VIEW3, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2 | TABLE_OR_VIEW3, boolean | null | undefined>
    abstract notBetween<TABLE_OR_VIEW2 extends ITableOrView<DB>, TABLE_OR_VIEW3 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>, value2: ValueSource<DB, TABLE_OR_VIEW3, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2 | TABLE_OR_VIEW3, boolean | null | undefined>
    abstract notBetween<TABLE_OR_VIEW2 extends ITableOrView<DB>, TABLE_OR_VIEW3 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>, value2: ValueSource<DB, TABLE_OR_VIEW3, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2 | TABLE_OR_VIEW3, boolean | null | undefined>
    // Redefined methods
    abstract valueWhenNull(value: MandatoryTypeOf<TYPE>): ComparableValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    abstract valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, MandatoryTypeOf<TYPE>>): ComparableValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    abstract valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): ComparableValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
    abstract asOptional(): ComparableValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
}

export abstract class BooleanValueSource<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, TYPE /*extends boolean | null | undefined = boolean*/> extends EqualableValueSource<DB, TABLE_OR_VIEW, TYPE> {
    abstract negate(): BooleanValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract and(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract and<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    abstract and<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    abstract or(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract or<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    abstract or<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    // Redefined methods
    abstract valueWhenNull(value: MandatoryTypeOf<TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    abstract valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, MandatoryTypeOf<TYPE>>): BooleanValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    abstract valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
    abstract asOptional(): BooleanValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
}

export abstract class NumberValueSource<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, TYPE /*extends number | null | undefined = number*/> extends ComparableValueSource<DB, TABLE_OR_VIEW, TYPE> {
    // SqlFunction0
    // Number functions
    abstract asStringNumber(): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE | string>
    abstract abs(): NumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract ceil(): NumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract floor(): NumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract round(): NumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract exp(): NumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract ln(): NumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract log10(): NumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract sqrt(): NumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract cbrt(): NumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract sign(): NumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    // Trigonometric Functions
    abstract acos(): NumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract asin(): NumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract atan(): NumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract cos(): NumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract cot(): NumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract sin(): NumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract tan(): NumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    // SqlFunction1
    abstract power(value: TYPE): NumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract power<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: NumberValueSource<DB, TABLE_OR_VIEW2, TYPE>): NumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract power<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: NumberValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): NumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract logn(value: TYPE): NumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract logn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: NumberValueSource<DB, TABLE_OR_VIEW2, TYPE>): NumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract logn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: NumberValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): NumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract roundn(value: TYPE): NumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract roundn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: NumberValueSource<DB, TABLE_OR_VIEW2, TYPE>): NumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract roundn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: NumberValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): NumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract minValue(value: TYPE): NumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract minValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: NumberValueSource<DB, TABLE_OR_VIEW2, TYPE>): NumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract minValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: NumberValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): NumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract maxValue(value: TYPE): NumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract maxValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: NumberValueSource<DB, TABLE_OR_VIEW2, TYPE>): NumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract maxValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: NumberValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): NumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    // Number operators
    abstract add(value: TYPE): NumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract add<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: NumberValueSource<DB, TABLE_OR_VIEW2, TYPE>): NumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract add<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: NumberValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): NumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract substract(value: TYPE): NumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract substract<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: NumberValueSource<DB, TABLE_OR_VIEW2, TYPE>): NumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract substract<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: NumberValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): NumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract multiply(value: TYPE): NumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract multiply<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: NumberValueSource<DB, TABLE_OR_VIEW2, TYPE>): NumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract multiply<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: NumberValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): NumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract divide(value: TYPE): NumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract divide<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: NumberValueSource<DB, TABLE_OR_VIEW2, TYPE>): NumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract divide<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: NumberValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): NumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract mod(value: TYPE): NumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract mod<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: NumberValueSource<DB, TABLE_OR_VIEW2, TYPE>): NumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract mod<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: NumberValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): NumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    // Trigonometric Functions
    abstract atan2(value: TYPE): NumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract atan2<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: NumberValueSource<DB, TABLE_OR_VIEW2, TYPE>): NumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract atan2<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: NumberValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): NumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    // Redefined methods
    abstract valueWhenNull(value: MandatoryTypeOf<TYPE>): NumberValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    abstract valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, MandatoryTypeOf<TYPE>>): NumberValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    abstract valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): NumberValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
    abstract asOptional(): NumberValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
}

export abstract class StringNumberValueSource<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, TYPE /*extends number | string | null | undefined = number | string*/> extends ComparableValueSource<DB, TABLE_OR_VIEW, TYPE> {
    // SqlFunction0
    // Number functions
    abstract abs(): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract ceil(): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract floor(): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract round(): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract exp(): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract ln(): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract log10(): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract sqrt(): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract cbrt(): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract sign(): NumberValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, number>>
    // Trigonometric Functions
    abstract acos(): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract asin(): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract atan(): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract cos(): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract cot(): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract sin(): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract tan(): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    // SqlFunction1
    abstract power(value: TYPE): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract power<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringNumberValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringNumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract power<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringNumberValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringNumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract logn(value: TYPE): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract logn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringNumberValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringNumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract logn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringNumberValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringNumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract roundn(value: TYPE): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract roundn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringNumberValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringNumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract roundn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringNumberValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringNumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract minValue(value: TYPE): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract minValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringNumberValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringNumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract minValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringNumberValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringNumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract maxValue(value: TYPE): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract maxValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringNumberValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringNumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract maxValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringNumberValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringNumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    // Number operators
    abstract add(value: TYPE): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract add<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringNumberValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringNumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract add<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringNumberValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringNumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract substract(value: TYPE): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract substract<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringNumberValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringNumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract substract<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringNumberValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringNumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract multiply(value: TYPE): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract multiply<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringNumberValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringNumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract multiply<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringNumberValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringNumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract divide(value: TYPE): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract divide<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringNumberValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringNumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract divide<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringNumberValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringNumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract mod(value: TYPE): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract mod<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringNumberValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringNumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract mod<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringNumberValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringNumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    // Trigonometric Functions
    abstract atan2(value: TYPE): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract atan2<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringNumberValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringNumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract atan2<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringNumberValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringNumberValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    // Redefined methods
    abstract valueWhenNull(value: MandatoryTypeOf<TYPE>): StringNumberValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    abstract valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, MandatoryTypeOf<TYPE>>): StringNumberValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    abstract valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
    abstract asOptional(): StringNumberValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
}

export abstract class IntValueSource<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, TYPE /*extends int | null | undefined = int*/> extends ComparableValueSource<DB, TABLE_OR_VIEW, TYPE> {
    // SqlFunction0
    // Number functions
    abstract asStringInt(): StringIntValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringInt>>
    abstract asDouble(): DoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, double>>
    abstract asStringDouble(): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    abstract abs(): IntValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract ceil(): IntValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract floor(): IntValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract round(): IntValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract exp(): DoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, double>>
    abstract ln(): DoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, double>>
    abstract log10(): DoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, double>>
    abstract sqrt(): DoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, double>>
    abstract cbrt(): DoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, double>>
    abstract sign(): IntValueSource<DB, TABLE_OR_VIEW, TYPE>
    // Trigonometric Functions
    abstract acos(): DoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, double>>
    abstract asin(): DoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, double>>
    abstract atan(): DoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, double>>
    abstract cos(): DoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, double>>
    abstract cot(): DoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, double>>
    abstract sin(): DoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, double>>
    abstract tan(): DoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, double>>
    // SqlFunction1
    abstract power(value: TYPE): DoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, double>>
    abstract power<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, double>>
    abstract power<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, double | null | undefined>
    abstract power(value: double): DoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, double>>
    abstract power<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, double>>
    abstract power<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, double | null | undefined>
    abstract logn(value: TYPE): DoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, double>>
    abstract logn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, double>>
    abstract logn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, double | null | undefined>
    abstract logn(value: double): DoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, double>>
    abstract logn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, double>>
    abstract logn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, double | null | undefined>
    abstract roundn(value: TYPE): DoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, double>>
    abstract roundn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, double>>
    abstract roundn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, double | null | undefined>
    abstract minValue(value: TYPE): IntValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract minValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE>): IntValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract minValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): IntValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract minValue(value: double): DoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, double>>
    abstract minValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, double>>
    abstract minValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, double | null | undefined>
    abstract maxValue(value: TYPE): IntValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract maxValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE>): IntValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract maxValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): IntValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract maxValue(value: double): DoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, double>>
    abstract maxValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, double>>
    abstract maxValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, double | null | undefined>
    // Number operators
    abstract add(value: TYPE): IntValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract add<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE>): IntValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract add<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): IntValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract add(value: double): DoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, double>>
    abstract add<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, double>>
    abstract add<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, double | null | undefined>
    abstract substract(value: TYPE): IntValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract substract<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE>): IntValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract substract<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): IntValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract substract(value: double): DoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, double>>
    abstract substract<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, double>>
    abstract substract<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, double | null | undefined>
    abstract multiply(value: TYPE): IntValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract multiply<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE>): IntValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract multiply<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): IntValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract multiply(value: double): DoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, double>>
    abstract multiply<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, double>>
    abstract multiply<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, double | null | undefined>
    abstract divide(value: TYPE): DoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, double>>
    abstract divide<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, double>>
    abstract divide<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, double | null | undefined>
    abstract divide(value: double): DoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, double>>
    abstract divide<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, double>>
    abstract divide<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, double | null | undefined>
    abstract mod(value: TYPE): IntValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract mod<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE>): IntValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract mod<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): IntValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract mod(value: double): DoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, double>>
    abstract mod<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, double>>
    abstract mod<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, double | null | undefined>
    // Trigonometric Functions
    abstract atan2(value: TYPE): DoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, double>>
    abstract atan2<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, double>>
    abstract atan2<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, double | null | undefined>
    abstract atan2(value: double): DoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, double>>
    abstract atan2<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, double>>
    abstract atan2<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, double | null | undefined>
    // Redefined methods
    abstract valueWhenNull(value: MandatoryTypeOf<TYPE>): IntValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    abstract valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, MandatoryTypeOf<TYPE>>): IntValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    abstract valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): IntValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
    abstract asOptional(): IntValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
}

export abstract class DoubleValueSource<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, TYPE /*extends double | null | undefined = double*/> extends ComparableValueSource<DB, TABLE_OR_VIEW, TYPE> {
    // SqlFunction0
    // Number functions
    //abstract asInt(): IntValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, int>> // test function
    abstract asStringDouble(): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    abstract abs(): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract ceil(): IntValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, int>>
    abstract floor(): IntValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, int>>
    abstract round(): IntValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, int>>
    abstract exp(): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract ln(): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract log10(): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract sqrt(): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract cbrt(): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract sign(): IntValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, int>>
    // Trigonometric Functions
    abstract acos(): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract asin(): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract atan(): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract cos(): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract cot(): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract sin(): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract tan(): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    // SqlFunction1
    abstract power(value: int): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract power<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract power<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract power(value: TYPE): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract power<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract power<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract logn(value: int): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract logn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract logn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract logn(value: TYPE): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract logn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract logn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract roundn(value: int): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract roundn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract roundn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract minValue(value: int): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract minValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract minValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract minValue(value: TYPE): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract minValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract minValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract maxValue(value: int): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract maxValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract maxValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract maxValue(value: TYPE): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract maxValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract maxValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    // Number operators
    abstract add(value: int): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract add<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract add<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract add(value: TYPE): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract add<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract add<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract substract(value: int): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract substract<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract substract<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract substract(value: TYPE): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract substract<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract substract<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract multiply(value: int): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract multiply<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract multiply<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract multiply(value: TYPE): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract multiply<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract multiply<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract divide(value: int): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract divide<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract divide<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract divide(value: TYPE): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract divide<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract divide<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract mod(value: int): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract mod<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract mod<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract mod(value: TYPE): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract mod<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract mod<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    // Trigonometric Functions
    abstract atan2(value: int): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract atan2<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract atan2<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: IntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract atan2(value: TYPE): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract atan2<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract atan2<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: DoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    // Redefined methods
    abstract valueWhenNull(value: MandatoryTypeOf<TYPE>): DoubleValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    abstract valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, MandatoryTypeOf<TYPE>>): DoubleValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    abstract valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
    abstract asOptional(): DoubleValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
}

export abstract class StringIntValueSource<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, TYPE /*extends stringInt | null | undefined = stringInt*/> extends ComparableValueSource<DB, TABLE_OR_VIEW, TYPE> {
    // SqlFunction0
    // Number functions
    abstract asStringDouble(): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    abstract abs(): StringIntValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract ceil(): StringIntValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract floor(): StringIntValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract round(): StringIntValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract exp(): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    abstract ln(): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    abstract log10(): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    abstract sqrt(): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    abstract cbrt(): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    abstract sign(): IntValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, int>>
    // Trigonometric Functions
    abstract acos(): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    abstract asin(): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    abstract atan(): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    abstract cos(): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    abstract cot(): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    abstract sin(): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    abstract tan(): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    // SqlFunction1
    abstract power(value: TYPE): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    abstract power<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, stringDouble>>
    abstract power<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, stringDouble | null | undefined>
    abstract power(value: stringDouble): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    abstract power<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, stringDouble>>
    abstract power<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, stringDouble | null | undefined>
    abstract logn(value: TYPE): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    abstract logn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, stringDouble>>
    abstract logn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, stringDouble | null | undefined>
    abstract logn(value: stringDouble): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    abstract logn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, stringDouble>>
    abstract logn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, stringDouble | null | undefined>
    abstract roundn(value: TYPE): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    abstract roundn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, stringDouble>>
    abstract roundn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, stringDouble | null | undefined>
    abstract minValue(value: TYPE): StringIntValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract minValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringIntValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract minValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringIntValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract minValue(value: stringDouble): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    abstract minValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, stringDouble>>
    abstract minValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, stringDouble | null | undefined>
    abstract maxValue(value: TYPE): StringIntValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract maxValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringIntValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract maxValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringIntValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract maxValue(value: stringDouble): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    abstract maxValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, stringDouble>>
    abstract maxValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, stringDouble | null | undefined>
    // Number operators
    abstract add(value: TYPE): StringIntValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract add<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringIntValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract add<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringIntValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract add(value: stringDouble): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    abstract add<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, stringDouble>>
    abstract add<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, stringDouble | null | undefined>
    abstract substract(value: TYPE): StringIntValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract substract<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringIntValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract substract<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringIntValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract substract(value: stringDouble): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    abstract substract<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, stringDouble>>
    abstract substract<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, stringDouble | null | undefined>
    abstract multiply(value: TYPE): StringIntValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract multiply<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringIntValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract multiply<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringIntValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract multiply(value: stringDouble): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    abstract multiply<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, stringDouble>>
    abstract multiply<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, stringDouble | null | undefined>
    abstract divide(value: TYPE): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    abstract divide<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, stringDouble>>
    abstract divide<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, stringDouble | null | undefined>
    abstract divide(value: stringDouble): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    abstract divide<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, stringDouble>>
    abstract divide<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, stringDouble | null | undefined>
    abstract mod(value: TYPE): StringIntValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract mod<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringIntValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract mod<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringIntValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract mod(value: stringDouble): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    abstract mod<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, stringDouble>>
    abstract mod<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, stringDouble | null | undefined>
    // Trigonometric Functions
    abstract atan2(value: TYPE): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    abstract atan2<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, stringDouble>>
    abstract atan2<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, stringDouble | null | undefined>
    abstract atan2(value: stringDouble): StringDoubleValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringDouble>>
    abstract atan2<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, AsType<TYPE, stringDouble>>
    abstract atan2<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, stringDouble | null | undefined>
    // Redefined methods
    abstract valueWhenNull(value: MandatoryTypeOf<TYPE>): StringIntValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    abstract valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, MandatoryTypeOf<TYPE>>): StringIntValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    abstract valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringIntValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
    abstract asOptional(): StringIntValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
}

export abstract class StringDoubleValueSource<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, TYPE /*extends stringDouble | null | undefined = stringDouble*/> extends ComparableValueSource<DB, TABLE_OR_VIEW, TYPE> {
    // SqlFunction0
    // Number functions
    //abstract asInt(): StringIntValueSource<DB, TABLE_OR_VIEW, StringIntTypeOf<TYPE>> // test function
    abstract abs(): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract ceil(): StringIntValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringInt>>
    abstract floor(): StringIntValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringInt>>
    abstract round(): StringIntValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, stringInt>>
    abstract exp(): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract ln(): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract log10(): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract sqrt(): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract cbrt(): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract sign(): IntValueSource<DB, TABLE_OR_VIEW, AsType<TYPE, int>>
    // Trigonometric Functions
    abstract acos(): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract asin(): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract atan(): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract cos(): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract cot(): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract sin(): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract tan(): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    // SqlFunction1
    abstract power(value: stringInt): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract power<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract power<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract power(value: TYPE): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract power<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract power<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract logn(value: stringInt): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract logn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract logn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract logn(value: TYPE): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract logn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract logn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract roundn(value: stringInt): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract roundn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract roundn<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract minValue(value: stringInt): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract minValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract minValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract minValue(value: TYPE): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract minValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract minValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract maxValue(value: stringInt): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract maxValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract maxValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract maxValue(value: TYPE): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract maxValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract maxValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    // Number operators
    abstract add(value: stringInt): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract add<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract add<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract add(value: TYPE): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract add<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract add<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract substract(value: stringInt): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract substract<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract substract<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract substract(value: TYPE): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract substract<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract substract<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract multiply(value: stringInt): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract multiply<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract multiply<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract multiply(value: TYPE): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract multiply<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract multiply<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract divide(value: stringInt): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract divide<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract divide<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract divide(value: TYPE): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract divide<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract divide<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract mod(value: stringInt): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract mod<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract mod<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract mod(value: TYPE): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract mod<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract mod<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    // Trigonometric Functions
    abstract atan2(value: stringInt): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract atan2<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract atan2<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringIntValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract atan2(value: TYPE): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract atan2<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract atan2<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringDoubleValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    // Redefined methods
    abstract valueWhenNull(value: MandatoryTypeOf<TYPE>): StringDoubleValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    abstract valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, MandatoryTypeOf<TYPE>>): StringDoubleValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    abstract valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
    abstract asOptional(): StringDoubleValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
}

export abstract class StringValueSource<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, TYPE /*extends string | null | undefined = string*/> extends ComparableValueSource<DB, TABLE_OR_VIEW, TYPE> {
    // SqlComparator 1
    abstract equalsInsensitiveIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract equalsInsensitive(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract equalsInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    abstract equalsInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    abstract notEqualsInsensitiveIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract notEqualsInsensitive(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract notEqualsInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    abstract notEqualsInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    abstract likeIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract like(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract like<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    abstract like<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    abstract notLikeIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract notLike(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract notLike<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    abstract notLike<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    abstract likeInsensitiveIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract likeInsensitive(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract likeInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    abstract likeInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    abstract notLikeInsensitiveIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract notLikeInsensitive(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract notLikeInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    abstract notLikeInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    abstract startWithIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract startWith(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract startWith<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    abstract startWith<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    abstract notStartWithIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract notStartWith(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract notStartWith<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    abstract notStartWith<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    abstract endWithIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract endWith(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract endWith<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    abstract endWith<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    abstract notEndWithIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract notEndWith(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract notEndWith<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    abstract notEndWith<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    abstract startWithInsensitiveIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract startWithInsensitive(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract startWithInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    abstract startWithInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    abstract notStartWithInsensitiveIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract notStartWithInsensitive(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract notStartWithInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    abstract notStartWithInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    abstract endWithInsensitiveIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract endWithInsensitive(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract endWithInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    abstract endWithInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    abstract notEndWithInsensitiveIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract notEndWithInsensitive(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract notEndWithInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    abstract notEndWithInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    abstract containsIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract contains(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract contains<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    abstract contains<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    abstract notContainsIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract notContains(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract notContains<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    abstract notContains<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    abstract containsInsensitiveIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract containsInsensitive(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract containsInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    abstract containsInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    abstract notContainsInsensitiveIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract notContainsInsensitive(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract notContainsInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    abstract notContainsInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    // SqlFunction0
    abstract lower(): StringValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract upper(): StringValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract length(): NumberValueSource<DB, TABLE_OR_VIEW, number>
    abstract trim(): StringValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract ltrim(): StringValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract rtrim(): StringValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract reverse(): StringValueSource<DB, TABLE_OR_VIEW, TYPE>
    // SqlFunction1
    abstract concatIfValue(value: TYPE | null | undefined): StringValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract concat(value: TYPE): StringValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract concat(value: TYPE | null | undefined): StringValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
    abstract concat<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract concat<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: StringValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract substringToEnd(start: number): StringValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract substringToEnd<TABLE_OR_VIEW2 extends ITableOrView<DB>>(start: NumberValueSource<DB, TABLE_OR_VIEW2, number>): StringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract substringToEnd<TABLE_OR_VIEW2 extends ITableOrView<DB>>(start: NumberValueSource<DB, TABLE_OR_VIEW2, number | null | undefined>): StringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    // SqlFunction2
    abstract substring(start: number, end: number): StringValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract substring<TABLE_OR_VIEW2 extends ITableOrView<DB>>(start: number, end: NumberValueSource<DB, TABLE_OR_VIEW2, number>): StringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract substring<TABLE_OR_VIEW2 extends ITableOrView<DB>>(start: number, end: NumberValueSource<DB, TABLE_OR_VIEW2, number | null | undefined>): StringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract substring<TABLE_OR_VIEW2 extends ITableOrView<DB>>(start: NumberValueSource<DB, TABLE_OR_VIEW2, number>, end: number): StringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract substring<TABLE_OR_VIEW2 extends ITableOrView<DB>>(start: NumberValueSource<DB, TABLE_OR_VIEW2, number | null | undefined>, end: number): StringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract substring<TABLE_OR_VIEW2 extends ITableOrView<DB>, TABLE_OR_VIEW3 extends ITableOrView<DB>>(start: NumberValueSource<DB, TABLE_OR_VIEW2, number>, end: NumberValueSource<DB, TABLE_OR_VIEW3, number>): StringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2 | TABLE_OR_VIEW3, TYPE>
    abstract substring<TABLE_OR_VIEW2 extends ITableOrView<DB>, TABLE_OR_VIEW3 extends ITableOrView<DB>>(start: NumberValueSource<DB, TABLE_OR_VIEW2, number>, end: NumberValueSource<DB, TABLE_OR_VIEW3, number | null | undefined>): StringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2 | TABLE_OR_VIEW3, TYPE| null | undefined>
    abstract substring<TABLE_OR_VIEW2 extends ITableOrView<DB>, TABLE_OR_VIEW3 extends ITableOrView<DB>>(start: NumberValueSource<DB, TABLE_OR_VIEW2, number | null | undefined>, end: NumberValueSource<DB, TABLE_OR_VIEW3, number>): StringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2 | TABLE_OR_VIEW3, TYPE| null | undefined>
    abstract substring<TABLE_OR_VIEW2 extends ITableOrView<DB>, TABLE_OR_VIEW3 extends ITableOrView<DB>>(start: NumberValueSource<DB, TABLE_OR_VIEW2, number | null | undefined>, end: NumberValueSource<DB, TABLE_OR_VIEW3, number | null | undefined>): StringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2 | TABLE_OR_VIEW3, TYPE| null | undefined>
    abstract replaceIfValue(findString: TYPE | null | undefined, replaceWith: TYPE | null | undefined): StringValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract replaceIfValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(findString: TYPE | null | undefined, replaceWith: StringValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract replaceIfValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(findString: TYPE | null | undefined, replaceWith: StringValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract replaceIfValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(findString: StringValueSource<DB, TABLE_OR_VIEW2, TYPE>, replaceWith: TYPE | null | undefined): StringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract replaceIfValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(findString: StringValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>, replaceWith: TYPE | null | undefined): StringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract replace(findString: TYPE, replaceWith: TYPE): StringValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract replace<TABLE_OR_VIEW2 extends ITableOrView<DB>>(findString: TYPE, replaceWith: StringValueSource<DB, TABLE_OR_VIEW2, TYPE>): StringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract replace<TABLE_OR_VIEW2 extends ITableOrView<DB>>(findString: TYPE, replaceWith: StringValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract replace<TABLE_OR_VIEW2 extends ITableOrView<DB>>(findString: StringValueSource<DB, TABLE_OR_VIEW2, TYPE>, replaceWith: TYPE): StringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract replace<TABLE_OR_VIEW2 extends ITableOrView<DB>>(findString: StringValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>, replaceWith: TYPE): StringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract replace<TABLE_OR_VIEW2 extends ITableOrView<DB>, TABLE_OR_VIEW3 extends ITableOrView<DB>>(findString: StringValueSource<DB, TABLE_OR_VIEW2, TYPE>, replaceWith: StringValueSource<DB, TABLE_OR_VIEW3, TYPE>): StringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2 | TABLE_OR_VIEW3, TYPE>
    abstract replace<TABLE_OR_VIEW2 extends ITableOrView<DB>, TABLE_OR_VIEW3 extends ITableOrView<DB>>(findString: StringValueSource<DB, TABLE_OR_VIEW2, TYPE>, replaceWith: StringValueSource<DB, TABLE_OR_VIEW3, TYPE | null | undefined>): StringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2 | TABLE_OR_VIEW3, TYPE | null | undefined>
    abstract replace<TABLE_OR_VIEW2 extends ITableOrView<DB>, TABLE_OR_VIEW3 extends ITableOrView<DB>>(findString: StringValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>, replaceWith: StringValueSource<DB, TABLE_OR_VIEW3, TYPE>): StringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2 | TABLE_OR_VIEW3, TYPE | null | undefined>
    abstract replace<TABLE_OR_VIEW2 extends ITableOrView<DB>, TABLE_OR_VIEW3 extends ITableOrView<DB>>(findString: StringValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>, replaceWith: StringValueSource<DB, TABLE_OR_VIEW3, TYPE | null | undefined>): StringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2 | TABLE_OR_VIEW3, TYPE | null | undefined>
    // Redefined methods
    abstract valueWhenNull(value: MandatoryTypeOf<TYPE>): StringValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    abstract valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, MandatoryTypeOf<TYPE>>): StringValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    abstract valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): StringValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
    abstract asOptional(): StringValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
}

export abstract class TypeSafeStringValueSource<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, TYPE /*extends string | null | undefined = string*/> extends ComparableValueSource<DB, TABLE_OR_VIEW, TYPE> {
    // SqlComparator 1
    //abstract asString(): TypeSafeStringValueSource<DB, TABLE_OR_VIEW, TYPE> // test function
    abstract equalsInsensitiveIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract equalsInsensitive(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract equalsInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    abstract equalsInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    abstract notEqualsInsensitiveIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract notEqualsInsensitive(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract notEqualsInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    abstract notEqualsInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    abstract likeIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract like(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract like<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    abstract like<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    abstract notLikeIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract notLike(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract notLike<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    abstract notLike<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    abstract likeInsensitiveIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract likeInsensitive(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract likeInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    abstract likeInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    abstract notLikeInsensitiveIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract notLikeInsensitive(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract notLikeInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    abstract notLikeInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    abstract startWithIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract startWith(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract startWith<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    abstract startWith<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    abstract notStartWithIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract notStartWith(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract notStartWith<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    abstract notStartWith<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    abstract endWithIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract endWith(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract endWith<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    abstract endWith<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    abstract notEndWithIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract notEndWith(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract notEndWith<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    abstract notEndWith<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    abstract startWithInsensitiveIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract startWithInsensitive(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract startWithInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    abstract startWithInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    abstract notStartWithInsensitiveIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract notStartWithInsensitive(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract notStartWithInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    abstract notStartWithInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    abstract endWithInsensitiveIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract endWithInsensitive(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract endWithInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    abstract endWithInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    abstract notEndWithInsensitiveIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract notEndWithInsensitive(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract notEndWithInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    abstract notEndWithInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    abstract containsIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract contains(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract contains<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    abstract contains<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    abstract notContainsIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract notContains(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract notContains<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    abstract notContains<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    abstract containsInsensitiveIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract containsInsensitive(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract containsInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    abstract containsInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    abstract notContainsInsensitiveIfValue(value: TYPE | null | undefined): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract notContainsInsensitive(value: TYPE): BooleanValueSource<DB, TABLE_OR_VIEW, BooleanOrNullOf<TYPE>>
    abstract notContainsInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, BooleanOrNullOf<TYPE>>
    abstract notContainsInsensitive<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): BooleanValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, boolean | null | undefined>
    // SqlFunction0
    abstract lower(): TypeSafeStringValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract upper(): TypeSafeStringValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract length(): IntValueSource<DB, TABLE_OR_VIEW, int>
    abstract trim(): TypeSafeStringValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract ltrim(): TypeSafeStringValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract rtrim(): TypeSafeStringValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract reverse(): TypeSafeStringValueSource<DB, TABLE_OR_VIEW, TYPE>
    // SqlFunction1
    abstract concatIfValue(value: TYPE | null | undefined): TypeSafeStringValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract concat(value: TYPE): TypeSafeStringValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract concat(value: TYPE | null | undefined): TypeSafeStringValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
    abstract concat<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: TypeSafeStringValueSource<DB, TABLE_OR_VIEW2, TYPE>): TypeSafeStringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract concat<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: TypeSafeStringValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): TypeSafeStringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract substringToEnd(start: int): TypeSafeStringValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract substringToEnd<TABLE_OR_VIEW2 extends ITableOrView<DB>>(start: IntValueSource<DB, TABLE_OR_VIEW2, int>): TypeSafeStringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract substringToEnd<TABLE_OR_VIEW2 extends ITableOrView<DB>>(start: IntValueSource<DB, TABLE_OR_VIEW2, int | null | undefined>): TypeSafeStringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    // SqlFunction2
    abstract substring(start: int, end: int): TypeSafeStringValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract substring<TABLE_OR_VIEW2 extends ITableOrView<DB>>(start: int, end: IntValueSource<DB, TABLE_OR_VIEW2, int>): TypeSafeStringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract substring<TABLE_OR_VIEW2 extends ITableOrView<DB>>(start: int, end: IntValueSource<DB, TABLE_OR_VIEW2, int | null | undefined>): TypeSafeStringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract substring<TABLE_OR_VIEW2 extends ITableOrView<DB>>(start: IntValueSource<DB, TABLE_OR_VIEW2, int>, end: int): TypeSafeStringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract substring<TABLE_OR_VIEW2 extends ITableOrView<DB>>(start: IntValueSource<DB, TABLE_OR_VIEW2, int | null | undefined>, end: int): TypeSafeStringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract substring<TABLE_OR_VIEW2 extends ITableOrView<DB>, TABLE_OR_VIEW3 extends ITableOrView<DB>>(start: IntValueSource<DB, TABLE_OR_VIEW2, int>, end: IntValueSource<DB, TABLE_OR_VIEW3, int>): TypeSafeStringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2 | TABLE_OR_VIEW3, TYPE>
    abstract substring<TABLE_OR_VIEW2 extends ITableOrView<DB>, TABLE_OR_VIEW3 extends ITableOrView<DB>>(start: IntValueSource<DB, TABLE_OR_VIEW2, int>, end: IntValueSource<DB, TABLE_OR_VIEW3, int | null | undefined>): TypeSafeStringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2 | TABLE_OR_VIEW3, TYPE| null | undefined>
    abstract substring<TABLE_OR_VIEW2 extends ITableOrView<DB>, TABLE_OR_VIEW3 extends ITableOrView<DB>>(start: IntValueSource<DB, TABLE_OR_VIEW2, int | null | undefined>, end: IntValueSource<DB, TABLE_OR_VIEW3, int>): TypeSafeStringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2 | TABLE_OR_VIEW3, TYPE| null | undefined>
    abstract substring<TABLE_OR_VIEW2 extends ITableOrView<DB>, TABLE_OR_VIEW3 extends ITableOrView<DB>>(start: IntValueSource<DB, TABLE_OR_VIEW2, int | null | undefined>, end: IntValueSource<DB, TABLE_OR_VIEW3, int | null | undefined>): TypeSafeStringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2 | TABLE_OR_VIEW3, TYPE| null | undefined>
    abstract replaceIfValue(findString: TYPE | null | undefined, replaceWith: TYPE | null | undefined): TypeSafeStringValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract replaceIfValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(findString: TYPE | null | undefined, replaceWith: TypeSafeStringValueSource<DB, TABLE_OR_VIEW2, TYPE>): TypeSafeStringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract replaceIfValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(findString: TYPE | null | undefined, replaceWith: TypeSafeStringValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): TypeSafeStringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract replaceIfValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(findString: TypeSafeStringValueSource<DB, TABLE_OR_VIEW2, TYPE>, replaceWith: TYPE | null | undefined): TypeSafeStringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract replaceIfValue<TABLE_OR_VIEW2 extends ITableOrView<DB>>(findString: TypeSafeStringValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>, replaceWith: TYPE | null | undefined): TypeSafeStringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract replace(findString: TYPE, replaceWith: TYPE): TypeSafeStringValueSource<DB, TABLE_OR_VIEW, TYPE>
    abstract replace<TABLE_OR_VIEW2 extends ITableOrView<DB>>(findString: TYPE, replaceWith: TypeSafeStringValueSource<DB, TABLE_OR_VIEW2, TYPE>): TypeSafeStringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract replace<TABLE_OR_VIEW2 extends ITableOrView<DB>>(findString: TYPE, replaceWith: TypeSafeStringValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): TypeSafeStringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract replace<TABLE_OR_VIEW2 extends ITableOrView<DB>>(findString: TypeSafeStringValueSource<DB, TABLE_OR_VIEW2, TYPE>, replaceWith: TYPE): TypeSafeStringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE>
    abstract replace<TABLE_OR_VIEW2 extends ITableOrView<DB>>(findString: TypeSafeStringValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>, replaceWith: TYPE): TypeSafeStringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2, TYPE | null | undefined>
    abstract replace<TABLE_OR_VIEW2 extends ITableOrView<DB>, TABLE_OR_VIEW3 extends ITableOrView<DB>>(findString: TypeSafeStringValueSource<DB, TABLE_OR_VIEW2, TYPE>, replaceWith: TypeSafeStringValueSource<DB, TABLE_OR_VIEW3, TYPE>): TypeSafeStringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2 | TABLE_OR_VIEW3, TYPE>
    abstract replace<TABLE_OR_VIEW2 extends ITableOrView<DB>, TABLE_OR_VIEW3 extends ITableOrView<DB>>(findString: TypeSafeStringValueSource<DB, TABLE_OR_VIEW2, TYPE>, replaceWith: TypeSafeStringValueSource<DB, TABLE_OR_VIEW3, TYPE | null | undefined>): TypeSafeStringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2 | TABLE_OR_VIEW3, TYPE | null | undefined>
    abstract replace<TABLE_OR_VIEW2 extends ITableOrView<DB>, TABLE_OR_VIEW3 extends ITableOrView<DB>>(findString: TypeSafeStringValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>, replaceWith: TypeSafeStringValueSource<DB, TABLE_OR_VIEW3, TYPE>): TypeSafeStringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2 | TABLE_OR_VIEW3, TYPE | null | undefined>
    abstract replace<TABLE_OR_VIEW2 extends ITableOrView<DB>, TABLE_OR_VIEW3 extends ITableOrView<DB>>(findString: TypeSafeStringValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>, replaceWith: TypeSafeStringValueSource<DB, TABLE_OR_VIEW3, TYPE | null | undefined>): TypeSafeStringValueSource<DB, TABLE_OR_VIEW | TABLE_OR_VIEW2 | TABLE_OR_VIEW3, TYPE | null | undefined>
    // Redefined methods
    abstract valueWhenNull(value: MandatoryTypeOf<TYPE>): TypeSafeStringValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    abstract valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, MandatoryTypeOf<TYPE>>): TypeSafeStringValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    abstract valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): TypeSafeStringValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
    abstract asOptional(): TypeSafeStringValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
}

export abstract class DateValueSource<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, TYPE /*extends Date | null | undefined = Date*/> extends ComparableValueSource<DB, TABLE_OR_VIEW, TYPE> {
    /** Gets the year */
    abstract getFullYear(): NumberValueSource<DB, TABLE_OR_VIEW, number>
    /** Gets the month (value between 0 to 11)*/
    abstract getMonth(): NumberValueSource<DB, TABLE_OR_VIEW, number>
    /** Gets the day-of-the-month */
    abstract getDate(): NumberValueSource<DB, TABLE_OR_VIEW, number>
    /** Gets the day of the week (0 represents Sunday) */
    abstract getDay(): NumberValueSource<DB, TABLE_OR_VIEW, number>
    // Redefined methods
    abstract valueWhenNull(value: MandatoryTypeOf<TYPE>): DateValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    abstract valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, MandatoryTypeOf<TYPE>>): DateValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    abstract valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DateValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
    abstract asOptional(): DateValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
}

export abstract class TimeValueSource<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, TYPE /*extends Date | null | undefined = Date*/> extends ComparableValueSource<DB, TABLE_OR_VIEW, TYPE> {
    /** Gets the hours */
    abstract getHours(): NumberValueSource<DB, TABLE_OR_VIEW, number>
    /** Gets the minutes */
    abstract getMinutes(): NumberValueSource<DB, TABLE_OR_VIEW, number>
    /** Gets the seconds */
    abstract getSeconds(): NumberValueSource<DB, TABLE_OR_VIEW, number>
    /** Gets the milliseconds */
    abstract getMilliseconds(): NumberValueSource<DB, TABLE_OR_VIEW, number>
    // Redefined methods
    abstract valueWhenNull(value: MandatoryTypeOf<TYPE>): TimeValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    abstract valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, MandatoryTypeOf<TYPE>>): TimeValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    abstract valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): TimeValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
    abstract asOptional(): TimeValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
}

export abstract class DateTimeValueSource<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, TYPE /*extends Date | null | undefined = Date*/> extends ComparableValueSource<DB, TABLE_OR_VIEW, TYPE> {
    /** Gets the year */
    abstract getFullYear(): NumberValueSource<DB, TABLE_OR_VIEW, number>
    /** Gets the month (value between 0 to 11)*/
    abstract getMonth(): NumberValueSource<DB, TABLE_OR_VIEW, number>
    /** Gets the day-of-the-month */
    abstract getDate(): NumberValueSource<DB, TABLE_OR_VIEW, number>
    /** Gets the day of the week (0 represents Sunday) */
    abstract getDay(): NumberValueSource<DB, TABLE_OR_VIEW, number>
    /** Gets the hours */
    abstract getHours(): NumberValueSource<DB, TABLE_OR_VIEW, number>
    /** Gets the minutes */
    abstract getMinutes(): NumberValueSource<DB, TABLE_OR_VIEW, number>
    /** Gets the seconds */
    abstract getSeconds(): NumberValueSource<DB, TABLE_OR_VIEW, number>
    /** Gets the milliseconds */
    abstract getMilliseconds(): NumberValueSource<DB, TABLE_OR_VIEW, number>
    /** Gets the time value in milliseconds */
    abstract getTime(): NumberValueSource<DB, TABLE_OR_VIEW, number>
    // Redefined methods
    abstract valueWhenNull(value: MandatoryTypeOf<TYPE>): DateTimeValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    abstract valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, MandatoryTypeOf<TYPE>>): DateTimeValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    abstract valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): DateTimeValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
    abstract asOptional(): DateTimeValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
}

export abstract class LocalDateValueSource<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, TYPE /*extends LocalDate | null | undefined = LocalDate*/> extends ComparableValueSource<DB, TABLE_OR_VIEW, TYPE> {
    /** Gets the year */
    abstract getFullYear(): IntValueSource<DB, TABLE_OR_VIEW, int>
    /** Gets the month (value between 0 to 11)*/
    abstract getMonth(): IntValueSource<DB, TABLE_OR_VIEW, int>
    /** Gets the day-of-the-month */
    abstract getDate(): IntValueSource<DB, TABLE_OR_VIEW, int>
    /** Gets the day of the week (0 represents Sunday) */
    abstract getDay(): IntValueSource<DB, TABLE_OR_VIEW, int>
    // Redefined methods
    abstract valueWhenNull(value: MandatoryTypeOf<TYPE>): LocalDateValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    abstract valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, MandatoryTypeOf<TYPE>>): LocalDateValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    abstract valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): LocalDateValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
    abstract asOptional(): LocalDateValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
}

export abstract class LocalTimeValueSource<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, TYPE /*extends LocalTime | null | undefined = LocalTime*/> extends ComparableValueSource<DB, TABLE_OR_VIEW, TYPE> {
    /** Gets the hours */
    abstract getHours(): IntValueSource<DB, TABLE_OR_VIEW, int>
    /** Gets the minutes */
    abstract getMinutes(): IntValueSource<DB, TABLE_OR_VIEW, int>
    /** Gets the seconds */
    abstract getSeconds(): IntValueSource<DB, TABLE_OR_VIEW, int>
    /** Gets the milliseconds */
    abstract getMilliseconds(): IntValueSource<DB, TABLE_OR_VIEW, int>
    // Redefined methods
    abstract valueWhenNull(value: MandatoryTypeOf<TYPE>): LocalTimeValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    abstract valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, MandatoryTypeOf<TYPE>>): LocalTimeValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    abstract valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): LocalTimeValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
    abstract asOptional(): LocalTimeValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
}

export abstract class LocalDateTimeValueSource<DB extends AnyDB, TABLE_OR_VIEW extends ITableOrView<DB>, TYPE /*extends LocalDateTime | null | undefined = LocalDateTime*/> extends ComparableValueSource<DB, TABLE_OR_VIEW, TYPE> {
    /** Gets the year */
    abstract getFullYear(): IntValueSource<DB, TABLE_OR_VIEW, int>
    /** Gets the month (value between 0 to 11)*/
    abstract getMonth(): IntValueSource<DB, TABLE_OR_VIEW, int>
    /** Gets the day-of-the-month */
    abstract getDate(): IntValueSource<DB, TABLE_OR_VIEW, int>
    /** Gets the day of the week (0 represents Sunday) */
    abstract getDay(): IntValueSource<DB, TABLE_OR_VIEW, int>
    /** Gets the hours */
    abstract getHours(): IntValueSource<DB, TABLE_OR_VIEW, int>
    /** Gets the minutes */
    abstract getMinutes(): IntValueSource<DB, TABLE_OR_VIEW, int>
    /** Gets the seconds */
    abstract getSeconds(): IntValueSource<DB, TABLE_OR_VIEW, int>
    /** Gets the milliseconds */
    abstract getMilliseconds(): IntValueSource<DB, TABLE_OR_VIEW, int>
    /** Gets the time value in milliseconds. */
    abstract getTime(): IntValueSource<DB, TABLE_OR_VIEW, int>
    // Redefined methods
    abstract valueWhenNull(value: MandatoryTypeOf<TYPE>): LocalDateTimeValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    abstract valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, MandatoryTypeOf<TYPE>>): LocalDateTimeValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<TYPE>>
    abstract valueWhenNull<TABLE_OR_VIEW2 extends ITableOrView<DB>>(value: ValueSource<DB, TABLE_OR_VIEW2, TYPE | null | undefined>): LocalDateTimeValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
    abstract asOptional(): LocalDateTimeValueSource<DB, TABLE_OR_VIEW, TYPE | null | undefined>
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

/*

// Other implementation, it works on TypeScript 3.3.3, but not in 3.5.3

export type RemapValueSourceType<DB extends AnyDB, TABLE_OR_VIEW extends ITable<DB>, TYPE> =
    TYPE extends BooleanValueSource<DB, any, infer Q1> ? BooleanValueSource<DB, TABLE_OR_VIEW, Q1> :
    TYPE extends StringIntValueSource<DB, any, infer Q2S> ? StringIntValueSource<DB, TABLE_OR_VIEW, Q2S> :
    TYPE extends IntValueSource<DB, any, infer Q2> ? IntValueSource<DB, TABLE_OR_VIEW, Q2> :
    TYPE extends StringDoubleValueSource<DB, any, infer Q3S> ? StringDoubleValueSource<DB, TABLE_OR_VIEW, Q3S> :
    TYPE extends DoubleValueSource<DB, any, infer Q3> ? DoubleValueSource<DB, TABLE_OR_VIEW, Q3> :
    TYPE extends StringNumberValueSource<DB, any, infer Q4S> ? StringNumberValueSource<DB, TABLE_OR_VIEW, Q4S> :
    TYPE extends NumberValueSource<DB, any, infer Q4> ? NumberValueSource<DB, TABLE_OR_VIEW, Q4> :
    TYPE extends TypeSafeStringValueSource<DB, any, infer Q5> ? TypeSafeStringValueSource<DB, TABLE_OR_VIEW, Q5> :
    TYPE extends StringValueSource<DB, any, infer Q6> ? StringValueSource<DB, TABLE_OR_VIEW, Q6> :
    TYPE extends LocalDateTimeValueSource<DB, any, infer Q7> ? LocalDateTimeValueSource<DB, TABLE_OR_VIEW, Q7> :
    TYPE extends DateTimeValueSource<DB, any, infer Q8> ? DateTimeValueSource<DB, TABLE_OR_VIEW, Q8> :
    TYPE extends LocalDateValueSource<DB, any, infer Q9> ? LocalDateValueSource<DB, TABLE_OR_VIEW, Q9> :
    TYPE extends DateValueSource<DB, any, infer Q10> ? DateValueSource<DB, TABLE_OR_VIEW, Q10> :
    TYPE extends LocalTimeValueSource<DB, any, infer Q11> ? LocalTimeValueSource<DB, TABLE_OR_VIEW, Q11> :
    TYPE extends TimeValueSource<DB, any, infer Q12> ? TimeValueSource<DB, TABLE_OR_VIEW, Q12> :
    TYPE extends ComparableValueSource<DB, any, infer Q13> ? ComparableValueSource<DB, TABLE_OR_VIEW, Q13> :
    TYPE extends EqualableValueSource<DB, any, infer Q14> ? EqualableValueSource<DB, TABLE_OR_VIEW, Q14> :
    TYPE extends NullableValueSource<DB, any, infer Q15> ? NullableValueSource<DB, TABLE_OR_VIEW, Q15> :
    TYPE extends ValueSource<DB, any, infer Q16> ? NullableValueSource<DB, TABLE_OR_VIEW, Q16> :
    never

export type RemapValueSourceTypeAsOptional<DB extends AnyDB, TABLE_OR_VIEW extends ITable<DB>, TYPE> =
    TYPE extends BooleanValueSource<DB, any, infer Q1> ? BooleanValueSource<DB, TABLE_OR_VIEW, Q1 | null | undefined> :
    TYPE extends StringIntValueSource<DB, any, infer Q2S> ? StringIntValueSource<DB, TABLE_OR_VIEW, Q2S | null | undefined> :
    TYPE extends IntValueSource<DB, any, infer Q2> ? IntValueSource<DB, TABLE_OR_VIEW, Q2 | null | undefined> :
    TYPE extends StringDoubleValueSource<DB, any, infer Q3S> ? StringDoubleValueSource<DB, TABLE_OR_VIEW, Q3S | null | undefined> :
    TYPE extends DoubleValueSource<DB, any, infer Q3> ? DoubleValueSource<DB, TABLE_OR_VIEW, Q3 | null | undefined> :
    TYPE extends StringNumberValueSource<DB, any, infer Q4S> ? StringNumberValueSource<DB, TABLE_OR_VIEW, Q4S | null | undefined> :
    TYPE extends NumberValueSource<DB, any, infer Q4> ? NumberValueSource<DB, TABLE_OR_VIEW, Q4 | null | undefined> :
    TYPE extends TypeSafeStringValueSource<DB, any, infer Q5> ? TypeSafeStringValueSource<DB, TABLE_OR_VIEW, Q5 | null | undefined> :
    TYPE extends StringValueSource<DB, any, infer Q6> ? StringValueSource<DB, TABLE_OR_VIEW, Q6 | null | undefined> :
    TYPE extends LocalDateTimeValueSource<DB, any, infer Q7> ? LocalDateTimeValueSource<DB, TABLE_OR_VIEW, Q7 | null | undefined> :
    TYPE extends DateTimeValueSource<DB, any, infer Q8> ? DateTimeValueSource<DB, TABLE_OR_VIEW, Q8 | null | undefined> :
    TYPE extends LocalDateValueSource<DB, any, infer Q9> ? LocalDateValueSource<DB, TABLE_OR_VIEW, Q9 | null | undefined> :
    TYPE extends DateValueSource<DB, any, infer Q10> ? DateValueSource<DB, TABLE_OR_VIEW, Q10 | null | undefined> :
    TYPE extends LocalTimeValueSource<DB, any, infer Q11> ? LocalTimeValueSource<DB, TABLE_OR_VIEW, Q11 | null | undefined> :
    TYPE extends TimeValueSource<DB, any, infer Q12> ? TimeValueSource<DB, TABLE_OR_VIEW, Q12 | null | undefined> :
    TYPE extends ComparableValueSource<DB, any, infer Q13> ? ComparableValueSource<DB, TABLE_OR_VIEW, Q13 | null | undefined> :
    TYPE extends EqualableValueSource<DB, any, infer Q14> ? EqualableValueSource<DB, TABLE_OR_VIEW, Q14 | null | undefined> :
    TYPE extends NullableValueSource<DB, any, infer Q15> ? NullableValueSource<DB, TABLE_OR_VIEW, Q15 | null | undefined> :
    TYPE extends ValueSource<DB, any, infer Q16> ? NullableValueSource<DB, TABLE_OR_VIEW, Q16 | null | undefined> :
    never

export type RemapValueSourceTypeAsMandatory<DB extends AnyDB, TABLE_OR_VIEW extends ITable<DB>, TYPE> =
    TYPE extends BooleanValueSource<DB, any, infer Q1> ? BooleanValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<Q1>> :
    TYPE extends StringIntValueSource<DB, any, infer Q2S> ? StringIntValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<Q2S>> :
    TYPE extends IntValueSource<DB, any, infer Q2> ? IntValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<Q2>> :
    TYPE extends StringDoubleValueSource<DB, any, infer Q3S> ? StringDoubleValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<Q3S>> :
    TYPE extends DoubleValueSource<DB, any, infer Q3> ? DoubleValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<Q3>> :
    TYPE extends StringNumberValueSource<DB, any, infer Q4S> ? StringNumberValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<Q4S>> :
    TYPE extends NumberValueSource<DB, any, infer Q4> ? NumberValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<Q4>> :
    TYPE extends TypeSafeStringValueSource<DB, any, infer Q5> ? TypeSafeStringValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<Q5>> :
    TYPE extends StringValueSource<DB, any, infer Q6> ? StringValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<Q6>> :
    TYPE extends LocalDateTimeValueSource<DB, any, infer Q7> ? LocalDateTimeValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<Q7>> :
    TYPE extends DateTimeValueSource<DB, any, infer Q8> ? DateTimeValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<Q8>> :
    TYPE extends LocalDateValueSource<DB, any, infer Q9> ? LocalDateValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<Q9>> :
    TYPE extends DateValueSource<DB, any, infer Q10> ? DateValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<Q10>> :
    TYPE extends LocalTimeValueSource<DB, any, infer Q11> ? LocalTimeValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<Q11>> :
    TYPE extends TimeValueSource<DB, any, infer Q12> ? TimeValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<Q12>> :
    TYPE extends ComparableValueSource<DB, any, infer Q13> ? ComparableValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<Q13>> :
    TYPE extends EqualableValueSource<DB, any, infer Q14> ? EqualableValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<Q14>> :
    TYPE extends NullableValueSource<DB, any, infer Q15> ? NullableValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<Q15>> :
    TYPE extends ValueSource<DB, any, infer Q16> ? NullableValueSource<DB, TABLE_OR_VIEW, MandatoryTypeOf<Q16>> :
    never
*/

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
    // @ts-ignore
    protected readonly ___type: TYPE
    constructor (type: T, typeName: string, required: REQUIRED, adapter?: TypeAdapter,) {
        this.type = type
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