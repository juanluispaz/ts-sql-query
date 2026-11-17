// What the operations of the data types give and accept, for the compiler: the data type, the source and the
// optionality of the result; which data types work together (int and double, through their group) and which only with
// themselves (a data type of the user, a bigint, a decimal); the logical data types; the families a data type of the
// user extends; the arguments and fragments of a data type; a class given where a data type goes; and the filter a
// dynamic condition gives to a column.

import { describe, expect, test } from '../../lib/testRunner.js'
import { assertType, type Exact } from '../../lib/assertType.js'
import { PostgreSqlConnection } from '../../../src/connections/PostgreSqlConnection.js'
import { NoopQueryRunner } from '../../../src/queryRunners/NoopQueryRunner.js'
import { Table } from '../../../src/Table.js'
import {
    AdditiveType, BigintType, BooleanType, ComparableType, DecimalsType, DivisibleType, DoubleType, EnumType, EqualableType,
    IntType, IntegersType, LocalDateTimeType, LocalDateType, MultipliableType, RealsType, StringType,
    UuidType, UuidsType,
} from '../../../src/exports/v2/index.js'
import type { DefaultTypeAdapter, TypeAdapterPlaceholderContext, TypeAdapterProjectionContext, TypeAdapterValueFromDBContext, TypeAdapterValueToDBContext } from '../../../src/exports/v2/index.js'
import { NumberType } from '../../../src/typeSystem/number.js'
import { IfType } from '../../../src/typeSystem/logical.js'
import type { AlwaysIfValueSource, IfValueSource } from '../../../src/typeSystem/logical.js'
import type { TypedValueSource } from '../../../src/typeSystem/valueSource.js'
import type { OptionalityOf, RemapIValueSourceType, RemapValueSourceType, RemapValueSourceTypeWithOptionalType, SourceOf, DataTypeOf, ValueSource } from '../../../src/typeSystem/base.js'
import type { Argument, ArgForFn, MapArgumentToValueSource, TypeOfArgument } from '../../../src/typeSystem/arguments.js'
import type { AggregatedArrayProjectableAsNullableType, AggregatedArrayType } from '../../../src/typeSystem/aggregatedArrays.js'
import type { Column } from '../../../src/utils/Column.js'
import type { typeName } from '../../../src/utils/symbols.js'
import type { DynamicCondition, FilterOf } from '../../../src/exports/v2/index.js'
import type { DynamicConditionForModel } from '../../../src/dynamic/condition.js'
import type { DynamicCondition as DynamicConditionOfVersion1 } from '../../../src/exports/v1/expressions/dynamicConditionUsingFilters.js'

type Money = number & { readonly __money: unique symbol }
type Other = number & { readonly __other: unique symbol }
type Status = 'a' | 'b'

// A data type of the user: a class that extends its family with its type name
abstract class MoneyType extends IntegersType<Money, 'Money'> {
    static override readonly type = 'Money'
}
abstract class OtherType extends IntegersType<Other, 'Other'> {
    static override readonly type = 'Other'
}
// An integer of the user named like a built-in data type
abstract class IntNamedType extends IntegersType<number, 'int'> { }
abstract class PriceType extends DecimalsType<string, 'Price'> {
    static override readonly type = 'Price'
}
abstract class RatioType extends RealsType<number, 'Ratio'> {
    static override readonly type = 'Ratio'
}
abstract class StatusType extends EnumType<Status, 'Status'> {
    static override readonly type = 'Status'
}
// Another data type with the same type name
abstract class OwnStatusType extends EqualableType<Status, 'Status'> { }

class DBConnection extends PostgreSqlConnection<'DBConnection'> {
    moneyArg = this.arg(MoneyType, 'optional')
}

class TFirst extends Table<DBConnection, 'TFirst'> {
    anInt = this.column('an_int', 'int')
    aString = this.column('a_string', 'string')
    aMoney = this.column('a_money', MoneyType)
    anOther = this.column('an_other', OtherType)
    intNamedMoney = this.column('int_named_money', IntNamedType)
    aBoolean = this.column('a_boolean', 'boolean')
    aBigint = this.column('a_bigint', 'bigint')
    aDecimal = this.column('a_decimal', PriceType)
    aStringDecimal = this.column('a_string_decimal', 'stringDecimal')
    aCustomDouble = this.column('a_custom_double', RatioType)
    aUuid = this.column('a_uuid', 'uuid')
    aDate = this.optionalColumn('a_date', 'localDate')
    aDateTime = this.column('a_date_time', 'localDateTime')
    aStatus = this.column('a_status', StatusType)
    ownStatus = this.column('own_status', OwnStatusType)
    constructor() {
        super('first')
    }
}

class TSecond extends Table<DBConnection, 'TSecond'> {
    anInt = this.column('an_int', 'int')
    aDouble = this.optionalColumn('a_double', 'double')
    otherMoney = this.optionalColumn('other_money', MoneyType)
    otherDecimal = this.optionalColumn('other_decimal', PriceType)
    optionalString = this.optionalColumn('optional_string', 'string')
    constructor() {
        super('second')
    }
}

const conn = new DBConnection(new NoopQueryRunner())
const tFirst = new TFirst()
const tSecond = new TSecond()
type S1 = SourceOf<typeof tFirst.anInt>
type S2 = SourceOf<typeof tSecond.anInt>

const { anInt, aString, aMoney, anOther, intNamedMoney, aBoolean, aBigint, aDecimal, aStringDecimal, aCustomDouble, aUuid, aDate, aDateTime, aStatus, ownStatus } = tFirst
const { aDouble, otherMoney, otherDecimal, optionalString } = tSecond
// A number whose data type TypeScript doesn't know: int or double
const aNumber = tSecond.anInt.add(1)

describe('The operations of the data types', () => {
    test('int-and-double-work-together-through-their-group', () => {
        assertType<Exact<typeof aNumber, ValueSource<S2, NumberType, 'required'>>>()
        const intEqualsDouble = anInt.equals(aDouble)
        assertType<Exact<typeof intEqualsDouble, ValueSource<S1 | S2, BooleanType, 'optional'>>>()
        const intEqualsNumber = anInt.equals(5)
        assertType<Exact<typeof intEqualsNumber, ValueSource<S1, BooleanType, 'required'>>>()
        aDouble.lessThan(anInt)
        // @ts-expect-error a string is not a number
        anInt.equals(aString)
        // @ts-expect-error an integer of the user is not an int
        anInt.equals(aMoney)
        // @ts-expect-error an int is not an integer of the user
        aMoney.equals(anInt)
        // @ts-expect-error another type name
        aMoney.equals(anOther)
        // @ts-expect-error an integer of the user named like a built-in type is not that type
        anInt.equals(intNamedMoney)
        const moneyEqualsMoney = aMoney.equals(otherMoney)
        assertType<Exact<typeof moneyEqualsMoney, ValueSource<S1 | S2, BooleanType, 'optional'>>>()
        aMoney.equals(1 as Money)
        expect(conn.selectFrom(tFirst).join(tSecond).on(intEqualsDouble).select({ id: anInt }).where(moneyEqualsMoney).query())
            .toBe('select first.an_int as id from first join second on first.an_int = second.a_double where first.a_money = second.other_money')
    })

    test('the-result-keeps-the-data-type-and-the-optionality', () => {
        const optionalInt = anInt.asOptional()
        assertType<Exact<typeof optionalInt, ValueSource<S1, IntType, 'optional'>>>()
        const doubleIsNull = aDouble.isNull()
        assertType<Exact<typeof doubleIsNull, ValueSource<S2, BooleanType, 'required'>>>()
        const optionalMoney = aMoney.asOptional()
        assertType<Exact<typeof optionalMoney, ValueSource<S1, MoneyType, 'optional'>>>()
        const intEqualsIfValue = anInt.equalsIfValue(null)
        assertType<Exact<typeof intEqualsIfValue, IfValueSource<S1, 'required'>>>()
        const coalesced = aDouble.valueWhenNull(anInt)
        assertType<Exact<typeof coalesced, ValueSource<S2 | S1, DoubleType, 'required'>>>()
        const inN = anInt.inN(1, aDouble)
        assertType<Exact<typeof inN, ValueSource<S1 | S2, BooleanType, 'optional'>>>()
        expect(IntType.is(optionalInt)).toBe(true)
    })

    test('the-logical-data-types', () => {
        const anIf = aDouble.equalsIfValue(null as number | null)
        assertType<Exact<typeof anIf, IfValueSource<S2, 'optional'>>>()
        const anAlwaysIf = conn.dynamicBooleanExpressionUsing(tFirst)
        type S0 = SourceOf<typeof anAlwaysIf>
        const booleanAndIf = aBoolean.and(anIf)
        assertType<Exact<typeof booleanAndIf, ValueSource<S1 | S2, BooleanType, 'optional'>>>()
        const ifAndBoolean = anIf.and(aBoolean)
        assertType<Exact<typeof ifAndBoolean, ValueSource<S2 | S1, BooleanType, 'optional'>>>()
        const ifAndAlwaysIf = anIf.and(anAlwaysIf)
        assertType<Exact<SourceOf<typeof ifAndAlwaysIf>, S2 | S0>>()
        assertType<typeof ifAndAlwaysIf extends IfValueSource<any, any> ? true : false>()
        const alwaysIfOrIf = anAlwaysIf.or(anIf)
        assertType<Exact<SourceOf<typeof alwaysIfOrIf>, S0 | S2>>()
        assertType<typeof alwaysIfOrIf extends AlwaysIfValueSource<any, any> ? true : false>()
        // @ts-expect-error a number is not logical
        aBoolean.and(anInt)
        // A condition is not a value source; a boolean is
        assertType<typeof anIf extends TypedValueSource<any, any, any> ? false : true>()
        assertType<typeof aBoolean extends TypedValueSource<any, any, any> ? true : false>()
        expect(BooleanType.is(booleanAndIf)).toBe(true)
    })

    test('an-int-with-a-double-gives-a-double-and-with-a-value-the-number-in-general', () => {
        const intPlusInt = anInt.add(anInt)
        assertType<Exact<typeof intPlusInt, ValueSource<S1, IntType, 'required'>>>()
        const intPlusDouble = anInt.add(aDouble)
        assertType<Exact<typeof intPlusDouble, ValueSource<S1 | S2, DoubleType, 'optional'>>>()
        const intPlusValue = anInt.add(1)
        assertType<Exact<typeof intPlusValue, ValueSource<S1, NumberType, 'required'>>>()
        const doublePlusValue = aDouble.add(1)
        assertType<Exact<typeof doublePlusValue, ValueSource<S2, DoubleType, 'optional'>>>()
        const intPlusNumber = anInt.add(aNumber)
        assertType<Exact<typeof intPlusNumber, ValueSource<S1 | S2, NumberType, 'required'>>>()
        const numberTimesDouble = aNumber.multiply(aDouble)
        assertType<Exact<typeof numberTimesDouble, ValueSource<S2, DoubleType, 'optional'>>>()
        const intCeil = aDouble.ceil()
        assertType<Exact<typeof intCeil, ValueSource<S2, IntType, 'optional'>>>()
        const intSqrt = anInt.sqrt()
        assertType<Exact<typeof intSqrt, ValueSource<S1, DoubleType, 'required'>>>()
        const intDivide = anInt.divide(anInt)
        assertType<Exact<typeof intDivide, ValueSource<S1, DoubleType, 'required'>>>()
        const intAsBigint = anInt.asBigint()
        assertType<Exact<typeof intAsBigint, ValueSource<S1, BigintType, 'required'>>>()
        const intWhenNullDouble = anInt.valueWhenNull(aDouble)
        assertType<Exact<typeof intWhenNullDouble, ValueSource<S1 | S2, DoubleType, 'optional'>>>()
        const intWhenNullValue = anInt.valueWhenNull(0)
        assertType<Exact<typeof intWhenNullValue, ValueSource<S1, NumberType, 'required'>>>()
        const intWhenNullInt = anInt.valueWhenNull(anInt)
        assertType<Exact<typeof intWhenNullInt, ValueSource<S1, IntType, 'required'>>>()
        const stringWhenNull = aString.valueWhenNull('')
        assertType<Exact<typeof stringWhenNull, ValueSource<S1, StringType, 'required'>>>()
        const moneyWhenNull = aMoney.valueWhenNull(otherMoney)
        assertType<Exact<typeof moneyWhenNull, ValueSource<S1 | S2, MoneyType, 'optional'>>>()
        expect(DoubleType.is(intPlusDouble)).toBe(true)
        expect(NumberType.is(intPlusValue)).toBe(true)
    })

    test('the-other-numbers-work-only-with-themselves', () => {
        const bigintPlusBigint = aBigint.add(aBigint)
        assertType<Exact<typeof bigintPlusBigint, ValueSource<S1, BigintType, 'required'>>>()
        // @ts-expect-error a bigint is not an int
        aBigint.add(anInt)
        const bigintTimesBigint = aBigint.multiply(aBigint)
        assertType<Exact<typeof bigintTimesBigint, ValueSource<S1, BigintType, 'required'>>>()
        // @ts-expect-error a bigint has no divide
        expect(() => aBigint.divide(aBigint)).toThrow(TypeError)
        const bigintSign = aBigint.sign()
        assertType<Exact<typeof bigintSign, ValueSource<S1, IntType, 'required'>>>()
        const moneyTimesMoney = aMoney.multiply(otherMoney)
        assertType<Exact<typeof moneyTimesMoney, ValueSource<S1 | S2, MoneyType, 'optional'>>>()
        // @ts-expect-error an integer of the user has no sqrt
        expect(() => aMoney.sqrt()).toThrow(TypeError)
        const decimalExp = aDecimal.exp()
        assertType<Exact<typeof decimalExp, ValueSource<S1, DoubleType, 'required'>>>()
        const decimalRoundn = aDecimal.roundn(anInt)
        assertType<Exact<typeof decimalRoundn, ValueSource<S1, PriceType, 'required'>>>()
        const decimalPower = aStringDecimal.power(aDouble)
        assertType<Exact<typeof decimalPower, ValueSource<S1 | S2, DoubleType, 'optional'>>>()
        const decimalPlusDecimal = aDecimal.add(otherDecimal)
        assertType<Exact<typeof decimalPlusDecimal, ValueSource<S1 | S2, PriceType, 'optional'>>>()
        // @ts-expect-error a decimal of the user is not a string decimal
        aDecimal.add(aStringDecimal)
        // @ts-expect-error a decimal is not an int
        aStringDecimal.add(anInt)
        const ratioRoundn = aCustomDouble.roundn(anInt)
        assertType<Exact<typeof ratioRoundn, ValueSource<S1, RatioType, 'required'>>>()
        const ratioSqrt = aCustomDouble.sqrt()
        assertType<Exact<typeof ratioSqrt, ValueSource<S1, RatioType, 'required'>>>()
        expect(MoneyType.is(moneyTimesMoney)).toBe(true)
        expect(PriceType.is(decimalRoundn)).toBe(true)
    })

    test('texts-uuids-and-dates', () => {
        const concatenated = aString.concat(optionalString)
        assertType<Exact<typeof concatenated, ValueSource<S1 | S2, StringType, 'optional'>>>()
        const concatenatedIgnoringNull = optionalString.concatIgnoringNull(aString)
        assertType<Exact<typeof concatenatedIgnoringNull, ValueSource<S2 | S1, StringType, 'required'>>>()
        const stringLength = aString.length()
        assertType<Exact<typeof stringLength, ValueSource<S1, IntType, 'required'>>>()
        const substring = aString.substr(anInt, 2)
        assertType<Exact<typeof substring, ValueSource<S1, StringType, 'required'>>>()
        // @ts-expect-error a number is not a text
        aString.concat(anInt)
        // @ts-expect-error a bigint is not a position
        aString.substr(aBigint, 2)
        const uuidText = aUuid.asString()
        assertType<Exact<typeof uuidText, ValueSource<S1, StringType, 'required'>>>()
        // @ts-expect-error a uuid is not a text
        aUuid.equals(aString)
        const year = aDate.getFullYear()
        assertType<Exact<typeof year, ValueSource<S1, IntType, 'optional'>>>()
        const time = aDateTime.getTime()
        assertType<Exact<typeof time, ValueSource<S1, IntType, 'required'>>>()
        // @ts-expect-error a date is not a date and time
        aDate.lessThan(aDateTime)
        expect(StringType.is(uuidText)).toBe(true)
        expect(UuidType.is(aUuid)).toBe(true)
        expect(LocalDateType.is(aDate)).toBe(true)
        expect(LocalDateTimeType.is(aDateTime)).toBe(true)
    })

    test('the-enumerations-and-the-other-types-of-the-user', () => {
        aStatus.equals('a')
        aStatus.in(['a', 'b'])
        // The NType is the type name, whatever the family: two data types of the same type name are one for TypeScript
        // (an error of the user)
        aStatus.equals(ownStatus)
        // @ts-expect-error an enumeration has no order
        expect(() => aStatus.lessThan('a')).toThrow(TypeError)
        expect(StatusType.is(aStatus)).toBe(true)
    })

    test('aggregated-arrays', () => {
        const anArray = conn.aggregateAsArray({ a: aDate })
        type SA = SourceOf<typeof anArray>
        type ArrayType = AggregatedArrayProjectableAsNullableType<{ a?: Date }[], { a: Date | null }[]>
        assertType<Exact<typeof anArray, ValueSource<SA, ArrayType, 'required'>>>()
        // An inline select of one value has no value when it gives no rows
        const optionalArray = conn.selectFrom(tFirst).selectOneColumn(anArray).forUseAsInlineQueryValue()
        type SO = SourceOf<typeof optionalArray>
        assertType<Exact<typeof optionalArray, ValueSource<SO, ArrayType, 'optional'>>>()
        const emptyForNoValue = optionalArray.useEmptyArrayForNoValue()
        assertType<Exact<typeof emptyForNoValue, ValueSource<SO, ArrayType, 'required'>>>()
        const asNullable = optionalArray.projectingOptionalValuesAsNullable()
        assertType<Exact<typeof asNullable, ValueSource<SO, AggregatedArrayType<{ a: Date | null }[]>, 'optional'>>>()
        expect(conn.selectFrom(tSecond).select({ dates: emptyForNoValue }).query()).toBe("select ((select json_agg(json_build_object('a', a_date)) as result from first))::text as dates from second")
    })

    test('another-source-for-a-value-source', () => {
        assertType<Exact<RemapValueSourceType<'x/', typeof anInt>, ValueSource<'x/', IntType, 'required'>>>()
        assertType<Exact<RemapValueSourceTypeWithOptionalType<'x/', typeof aMoney, 'optional'>, ValueSource<'x/', MoneyType, 'optional'>>>()
        const doubleInput: ValueSource<S2, DoubleType, 'required'> = aDouble.valueWhenNull(0)
        const intInput: RemapIValueSourceType<S2, typeof anInt> = doubleInput
        // @ts-expect-error a text is not what an int position accepts
        const notAnIntInput: RemapIValueSourceType<S1, typeof anInt> = aString
        expect([intInput, notAnIntInput].length).toBe(2)
    })

    test('the-arguments-and-the-fragments-of-a-data-type', () => {
        type IntArg = Argument<IntType, 'required', 'combined'>
        type OptionalMoneyArg = Argument<MoneyType, 'optional', 'combined'>
        type ValueArg = Argument<StringType, 'required', 'value'>
        assertType<Exact<TypeOfArgument<IntArg>, number>>()
        assertType<Exact<TypeOfArgument<OptionalMoneyArg>, Money | null | undefined>>()
        assertType<Exact<MapArgumentToValueSource<'n/', IntArg>, ValueSource<'n/', IntType, 'required'>>>()
        assertType<Exact<ArgForFn<S1, ValueArg>, never>>()
        assertType<Exact<typeof conn.moneyArg, Argument<MoneyType, 'optional', 'combined'>>>()
        const moneyForArg: ArgForFn<S2, OptionalMoneyArg> = otherMoney
        // @ts-expect-error a value argument of another type name
        const otherForArg: ArgForFn<S1, OptionalMoneyArg> = anOther
        expect([moneyForArg, otherForArg].length).toBe(2)

        const fragmentOfOne = conn.fragmentWithType('int', 'optional').sql`${aString} + 1`
        assertType<Exact<typeof fragmentOfOne, ValueSource<S1, IntType, 'optional'>>>()
        // An argument of type any
        const equalsAny = aString.equals(5 as any)
        const equalsAnyIsUsable: ValueSource<S1, BooleanType, 'required'> = equalsAny
        expect(IntType.is(fragmentOfOne)).toBe(true)
        expect(BooleanType.is(equalsAnyIsUsable)).toBe(true)
    })

    test('a-value-that-may-not-be-a-value-source-is-narrowed-by-instanceof', () => {
        const anything: unknown = anInt
        // @ts-expect-error the type guard takes a value source
        IntType.is(anything)
        if (anything instanceof IntType) {
            assertType<Exact<typeof anything, IntType>>()
        }
        // A condition is a boolean at run time: its data type has no type guard
        // @ts-expect-error it has none
        expect(() => IfType.is(anInt)).toThrow(TypeError)
        expect(anything instanceof IntType).toBe(true)
    })

    test('a-method-that-takes-a-data-type-takes-its-class-too', () => {
        class TProbe extends Table<DBConnection, 'TProbe'> {
            byClass = this.column('amount', MoneyType)
            builtInByClass = this.optionalColumn('id', IntType)
            builtInByName = this.optionalColumn('id', 'int')
            // @ts-expect-error a class that groups data types has no type of its own
            group = this.column('id', NumberType)
            // @ts-expect-error a family has no type name
            family = this.column('id', IntegersType)
            constructor() {
                super('probe_table')
            }
        }
        const tProbe = new TProbe()
        assertType<Exact<SourceOf<typeof tProbe.byClass>, SourceOf<typeof tProbe.builtInByName>>>()
        assertType<Exact<DataTypeOf<typeof tProbe.byClass>, MoneyType>>()
        assertType<Exact<OptionalityOf<typeof tProbe.byClass>, 'required'>>()
        assertType<typeof tProbe.byClass extends Column ? true : false>()
        assertType<Exact<typeof tProbe.builtInByClass, typeof tProbe.builtInByName>>()
        const moneyConst = conn.const(5 as Money, MoneyType)
        const intConst = conn.const(5, 'int')
        assertType<Exact<SourceOf<typeof moneyConst>, SourceOf<typeof intConst>>>()
        assertType<Exact<DataTypeOf<typeof moneyConst>, MoneyType>>()
        // @ts-expect-error the value of a constant is of the type of its data type
        conn.const(5, MoneyType)
        expect(MoneyType.is(moneyConst)).toBe(true)
    })

    test('the-conversions-of-a-data-type-are-statics-with-the-parameters-of-a-type-adapter', () => {
        abstract class ConvertedIntType extends IntegersType<number, 'Converted'> {
            static override transformValueFromDB(value: unknown, context: TypeAdapterValueFromDBContext, next: DefaultTypeAdapter): unknown {
                return next.transformValueFromDB(value, context)
            }
            static override transformProjection(sql: string, context: TypeAdapterProjectionContext, next: DefaultTypeAdapter): string {
                context.setRequestedType('bigint')
                return next.transformProjection(sql, context)
            }
        }
        assertType<Exact<typeof ConvertedIntType.transformValueToDB, (value: unknown, context: TypeAdapterValueToDBContext, next: DefaultTypeAdapter) => unknown>>()
        assertType<Exact<typeof ConvertedIntType.transformPlaceholder, (placeholder: string, context: TypeAdapterPlaceholderContext, next: DefaultTypeAdapter) => string>>()
        // @ts-expect-error a placeholder is a text
        abstract class WrongConversionType extends IntegersType<number, 'Converted'> {
            static override transformPlaceholder(placeholder: string, context: TypeAdapterPlaceholderContext, next: DefaultTypeAdapter): number {
                return next.transformPlaceholder(placeholder, context).length
            }
        }
        expect(WrongConversionType.type).toBe('WrongConversionType')
    })

    test('each-family-adds-what-its-numbers-can-do-and-works-only-with-itself', () => {
        interface Cash { cash: true }
        abstract class CashType extends AdditiveType<Cash, 'Cash'> { static override readonly type = 'Cash' }
        abstract class ScaledType extends MultipliableType<number, 'Scaled'> { static override readonly type = 'Scaled' }
        abstract class QuantityType extends IntegersType<number, 'Quantity'> { static override readonly type = 'Quantity' }
        abstract class UnitPriceType extends DecimalsType<string, 'UnitPrice'> { static override readonly type = 'UnitPrice' }
        abstract class ShareType extends DivisibleType<number, 'Share'> { static override readonly type = 'Share' }
        abstract class FractionType extends RealsType<number, 'Fraction'> { static override readonly type = 'Fraction' }
        abstract class TagType extends EqualableType<string, 'Tag'> { static override readonly type = 'Tag' }
        abstract class VersionType extends ComparableType<string, 'Version'> { static override readonly type = 'Version' }
        class TFamilies extends Table<DBConnection, 'TFamilies'> {
            cash = this.column('cash', CashType)
            scaled = this.column('scaled', ScaledType)
            quantity = this.column('quantity', QuantityType)
            price = this.column('unit_price', UnitPriceType)
            share = this.column('share', ShareType)
            fraction = this.column('fraction', FractionType)
            tag = this.column('tag', TagType)
            version = this.column('version', VersionType)
            // @ts-expect-error a family has no type name of its own
            family = this.column('family', AdditiveType)
            constructor() {
                super('families')
            }
        }
        const families = new TFamilies()
        assertType<Exact<typeof families.cash[typeof typeName], 'type:Cash:'>>()
        assertType<Exact<typeof families.quantity[typeof typeName], 'type:Quantity:'>>()
        assertType<Exact<DataTypeOf<typeof families.cash>, CashType>>()

        const cashSum = families.cash.add(families.cash)
        assertType<Exact<DataTypeOf<typeof cashSum>, CashType>>()
        families.cash.modulo(families.cash)
        // @ts-expect-error an additive number is not multiplied
        expect(() => families.cash.multiply(families.cash)).toThrow(TypeError)
        // @ts-expect-error nor rounded: its operations don't add digits
        expect(() => families.cash.round()).toThrow(TypeError)
        // @ts-expect-error a data type of the user works only with itself
        families.cash.add(families.scaled)
        families.scaled.multiply(families.scaled)
        // @ts-expect-error a multipliable number is not divided
        expect(() => families.scaled.divide(families.scaled)).toThrow(TypeError)
        families.quantity.multiply(families.quantity)
        // @ts-expect-error an integer is not divided
        expect(() => families.quantity.divide(families.quantity)).toThrow(TypeError)
        // @ts-expect-error nor rounded
        expect(() => families.quantity.round()).toThrow(TypeError)
        const priceRounded = families.price.roundn(2)
        assertType<Exact<DataTypeOf<typeof priceRounded>, UnitPriceType>>()
        const priceCeil = families.price.ceil()
        assertType<Exact<DataTypeOf<typeof priceCeil>, UnitPriceType>>()
        const priceRoot = families.price.sqrt()
        assertType<Exact<DataTypeOf<typeof priceRoot>, DoubleType>>()
        // @ts-expect-error an exact decimal is not divided
        expect(() => families.price.divide(families.price)).toThrow(TypeError)
        families.share.divide(families.share)
        // @ts-expect-error a divisible number has no floating point functions
        expect(() => families.share.sqrt()).toThrow(TypeError)
        const fractionRoot = families.fraction.sqrt()
        assertType<Exact<DataTypeOf<typeof fractionRoot>, FractionType>>()
        families.fraction.divide(families.fraction).floor()
        // @ts-expect-error a bigint is not rounded
        expect(() => anInt.asBigint().round()).toThrow(TypeError)
        families.tag.equals('a')
        // @ts-expect-error a value compared for equality has no order
        expect(() => families.tag.lessThan('a')).toThrow(TypeError)
        families.version.lessThan('1.0')
        // The sum of a number of the user is of its data type; what isn't a number is not summed
        const cashTotal = conn.sum(families.cash)
        assertType<Exact<DataTypeOf<typeof cashTotal>, CashType>>()
        assertType<Exact<OptionalityOf<typeof cashTotal>, 'optional'>>()
        const fractionAverage = conn.average(families.fraction)
        assertType<Exact<DataTypeOf<typeof fractionAverage>, DoubleType>>()
        // @ts-expect-error a value compared for equality is not summed
        conn.sum(families.tag)
        // @ts-expect-error nor a value with an order
        conn.sum(families.version)
        expect(CashType.is(cashTotal)).toBe(true)
    })

    test('a-dynamic-condition-gives-each-column-the-filter-of-its-data-type', () => {
        abstract class RefType extends UuidsType<string, 'Ref'> { static override readonly type = 'Ref' }
        abstract class TagType extends EqualableType<string, 'Tag'> { static override readonly type = 'Tag' }
        abstract class VersionType extends ComparableType<string, 'Version'> { static override readonly type = 'Version' }
        type ProbeFilter = DynamicCondition<{ id: 'int', total: MoneyType, tag: TagType, ref: RefType, nested: { version: VersionType } }>
        assertType<Exact<NonNullable<ProbeFilter['id']>, FilterOf<IntType>>>()
        assertType<Exact<NonNullable<ProbeFilter['total']>, FilterOf<ComparableType<Money, string>>>>()
        assertType<Exact<NonNullable<ProbeFilter['tag']>, FilterOf<EqualableType<string, string>>>>()
        assertType<Exact<NonNullable<ProbeFilter['ref']>, FilterOf<UuidsType<string, string>>>>()
        assertType<Exact<NonNullable<NonNullable<ProbeFilter['nested']>['version']>, FilterOf<ComparableType<string, string>>>>()
        // @ts-expect-error a tuple of version 1 is not a column of a definition
        type ProbeFilterWithTuple = DynamicCondition<{ total: ['customInt', Money] }>
        type ProbeFilterOfVersion1 = DynamicConditionOfVersion1<{ total: ['customInt', Money], state: ['enum', Status], nested: { at: ['customLocalDate', Date] } }>
        assertType<Exact<NonNullable<ProbeFilterOfVersion1['total']>, FilterOf<ComparableType<Money, string>>>>()
        assertType<Exact<NonNullable<ProbeFilterOfVersion1['state']>, FilterOf<EqualableType<Status, string>>>>()
        assertType<Exact<NonNullable<NonNullable<ProbeFilterOfVersion1['nested']>['at']>, FilterOf<ComparableType<Date, string>>>>()
        type ProbeModelFilter = DynamicConditionForModel<{ total: Money, state: Status }>
        assertType<Exact<NonNullable<ProbeModelFilter['total']>, FilterOf<ComparableType<Money, string>>>>()
        assertType<Exact<NonNullable<ProbeModelFilter['state']>, FilterOf<EqualableType<Status, string>>>>()
        const filter: ProbeFilter = { total: { greaterThan: 1 as Money }, nested: { version: { lessThan: '2' } } }
        const withTuple: ProbeFilterWithTuple = {}
        expect([filter, withTuple].length).toBe(2)
    })
})
