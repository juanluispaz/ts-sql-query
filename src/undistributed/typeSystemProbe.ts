// What the new type system of the value sources must answer, checked by the compiler while it is built alongside the
// current one. Nothing runs here.

import type { TypedValueSource } from '../typeSystem/valueSource.js'
import type { RemapIValueSourceType, RemapValueSourceType, RemapValueSourceTypeWithOptionalType, ValueSource } from '../typeSystem/base.js'
import type { Argument, ArgForFn, MapArgumentToValueSource, TypeOfArgument } from '../typeSystem/arguments.js'
import type { FragmentExpression } from '../typeSystem/fragments.js'
import type { AlwaysIfValueSource, BooleanType, IfValueSource } from '../typeSystem/booleans.js'
import type { BigintType, CustomDecimalType, CustomDoubleType, CustomIntType, DoubleType, IntType, NumberType, StringDecimalType } from '../typeSystem/numbers.js'
import { CustomDecimalType as CustomDecimalTypeClass } from '../typeSystem/numbers.js'
import { CustomIntType as CustomIntTypeClass } from '../typeSystem/numbers.js'
import { IntType as IntTypeClass, NumberType as NumberTypeClass } from '../typeSystem/numbers.js'
import { IfType as IfTypeClass } from '../typeSystem/booleans.js'
import { Table } from '../Table.js'
import type { Column } from '../utils/Column.js'
import type { OptionalOf, SourceOf, TypeOf } from '../typeSystem/base.js'
import { PostgreSqlConnection } from '../connections/PostgreSqlConnection.js'
import type { StringType } from '../typeSystem/strings.js'
import type { UuidType } from '../typeSystem/uuids.js'
import type { LocalDateTimeType, LocalDateType } from '../typeSystem/localDates.js'
import type { CustomEqualableType, EnumType } from '../typeSystem/equalable.js'
import type { AggregatedArrayProjectableAsNullableType, AggregatedArrayType } from '../typeSystem/aggregatedArrays.js'

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false
function assertType<T extends true>(_value?: T): void {}

type Money = number & { readonly __money: unique symbol }
type Other = number & { readonly __other: unique symbol }

declare const anInt: ValueSource<'s1/', IntType, 'required'>
declare const aDouble: ValueSource<'s2/', DoubleType, 'optional'>
declare const aString: ValueSource<'s1/', StringType, 'required'>
declare const aMoney: ValueSource<'s1/', CustomIntType<Money, 'Money'>, 'required'>
declare const otherMoney: ValueSource<'s2/', CustomIntType<Money, 'Money'>, 'optional'>
declare const anOther: ValueSource<'s1/', CustomIntType<Other, 'Other'>, 'required'>
declare const intNamedMoney: ValueSource<'s1/', CustomIntType<number, 'int'>, 'required'>
declare const aBoolean: ValueSource<'s1/', BooleanType, 'required'>
declare const anIf: IfValueSource<'s2/', 'optional'>
declare const anAlwaysIf: AlwaysIfValueSource<'s1/', 'required'>

// int and double work together, through their group
const intEqualsDouble = anInt.equals(aDouble)
assertType<Equal<typeof intEqualsDouble, ValueSource<'s1/' | 's2/', BooleanType, 'optional'>>>()
const intEqualsNumber = anInt.equals(5)
assertType<Equal<typeof intEqualsNumber, ValueSource<'s1/', BooleanType, 'required'>>>()
aDouble.lessThan(anInt)
// @ts-expect-error a string is not a number
anInt.equals(aString)
// @ts-expect-error a custom int is not an int
anInt.equals(aMoney)
// @ts-expect-error an int is not a custom int
aMoney.equals(anInt)
// @ts-expect-error another type name
aMoney.equals(anOther)
// @ts-expect-error a custom int named like a built-in type is not that type
anInt.equals(intNamedMoney)
const moneyEqualsMoney = aMoney.equals(otherMoney)
assertType<Equal<typeof moneyEqualsMoney, ValueSource<'s1/' | 's2/', BooleanType, 'optional'>>>()
aMoney.equals(1 as Money)

// The data type and the optionality the result keeps
const optionalInt = anInt.asOptional()
assertType<Equal<typeof optionalInt, ValueSource<'s1/', IntType, 'optional'>>>()
const doubleIsNull = aDouble.isNull()
assertType<Equal<typeof doubleIsNull, ValueSource<'s2/', BooleanType, 'required'>>>()
const optionalMoney = aMoney.asOptional()
assertType<Equal<typeof optionalMoney, ValueSource<'s1/', CustomIntType<Money, 'Money'>, 'optional'>>>()
const intEqualsIfValue = anInt.equalsIfValue(null)
assertType<Equal<typeof intEqualsIfValue, IfValueSource<'s1/', 'required'>>>()
const coalesced = aDouble.valueWhenNull(anInt)
assertType<Equal<typeof coalesced, ValueSource<'s2/' | 's1/', DoubleType, 'required'>>>()
const inN = anInt.inN(1, aDouble)
assertType<Equal<typeof inN, ValueSource<'s1/' | 's2/', BooleanType, 'optional'>>>()

// The logical data types
const booleanAndIf = aBoolean.and(anIf)
assertType<Equal<typeof booleanAndIf, ValueSource<'s1/' | 's2/', BooleanType, 'optional'>>>()
const ifAndBoolean = anIf.and(aBoolean)
assertType<Equal<typeof ifAndBoolean, ValueSource<'s2/' | 's1/', BooleanType, 'optional'>>>()
const ifAndAlwaysIf = anIf.and(anAlwaysIf)
assertType<Equal<typeof ifAndAlwaysIf, IfValueSource<'s2/' | 's1/', 'optional'>>>()
const alwaysIfOrIf = anAlwaysIf.or(anIf)
assertType<Equal<typeof alwaysIfOrIf, AlwaysIfValueSource<'s1/' | 's2/', 'optional'>>>()
// @ts-expect-error a number is not logical
aBoolean.and(anInt)
// A condition is not a value source
type ConditionIsNotAValueSource = typeof anIf extends TypedValueSource<any, any, any> ? false : true
assertType<ConditionIsNotAValueSource>()
type BooleanIsAValueSource = typeof aBoolean extends TypedValueSource<any, any, any> ? true : false
assertType<BooleanIsAValueSource>()

// A custom data type made by the static function of its family
const MoneyType = CustomIntTypeClass.of<Money, 'Money'>('Money')
assertType<Equal<typeof MoneyType.prototype, CustomIntType<Money, 'Money'>>>()

// The numbers: an operation of an int with a double gives a double; with a number given as a value, TypeScript can't
// know which one it is, so it is the number in general
declare const aBigint: ValueSource<'s1/', BigintType, 'required'>
declare const aDecimal: ValueSource<'s1/', CustomDecimalType<string, 'Price'>, 'required'>
declare const otherDecimal: ValueSource<'s2/', CustomDecimalType<string, 'Price'>, 'optional'>
declare const aStringDecimal: ValueSource<'s1/', StringDecimalType, 'required'>
declare const aCustomDouble: ValueSource<'s1/', CustomDoubleType<number, 'Ratio'>, 'required'>
declare const aNumber: ValueSource<'s2/', NumberType, 'required'>

const intPlusInt = anInt.add(anInt)
assertType<Equal<typeof intPlusInt, ValueSource<'s1/', IntType, 'required'>>>()
const intPlusDouble = anInt.add(aDouble)
assertType<Equal<typeof intPlusDouble, ValueSource<'s1/' | 's2/', DoubleType, 'optional'>>>()
const intPlusValue = anInt.add(1)
assertType<Equal<typeof intPlusValue, ValueSource<'s1/', NumberType, 'required'>>>()
const doublePlusValue = aDouble.add(1)
assertType<Equal<typeof doublePlusValue, ValueSource<'s2/', DoubleType, 'optional'>>>()
const intPlusNumber = anInt.add(aNumber)
assertType<Equal<typeof intPlusNumber, ValueSource<'s1/' | 's2/', NumberType, 'required'>>>()
const numberPlusDouble = aNumber.multiply(aDouble)
assertType<Equal<typeof numberPlusDouble, ValueSource<'s2/', DoubleType, 'optional'>>>()
const intCeil = aDouble.ceil()
assertType<Equal<typeof intCeil, ValueSource<'s2/', IntType, 'optional'>>>()
const intSqrt = anInt.sqrt()
assertType<Equal<typeof intSqrt, ValueSource<'s1/', DoubleType, 'required'>>>()
const intDivide = anInt.divide(anInt)
assertType<Equal<typeof intDivide, ValueSource<'s1/', DoubleType, 'required'>>>()
const intAsBigint = anInt.asBigint()
assertType<Equal<typeof intAsBigint, ValueSource<'s1/', BigintType, 'required'>>>()
const intWhenNullDouble = anInt.valueWhenNull(aDouble)
assertType<Equal<typeof intWhenNullDouble, ValueSource<'s1/' | 's2/', DoubleType, 'optional'>>>()
const intWhenNullValue = anInt.valueWhenNull(0)
assertType<Equal<typeof intWhenNullValue, ValueSource<'s1/', NumberType, 'required'>>>()
const intWhenNullInt = anInt.valueWhenNull(anInt)
assertType<Equal<typeof intWhenNullInt, ValueSource<'s1/', IntType, 'required'>>>()
const stringWhenNull = aString.valueWhenNull('')
assertType<Equal<typeof stringWhenNull, ValueSource<'s1/', StringType, 'required'>>>()
const moneyWhenNull = aMoney.valueWhenNull(otherMoney)
assertType<Equal<typeof moneyWhenNull, ValueSource<'s1/' | 's2/', CustomIntType<Money, 'Money'>, 'optional'>>>()

// The other numbers work only with themselves
const bigintPlusBigint = aBigint.add(aBigint)
assertType<Equal<typeof bigintPlusBigint, ValueSource<'s1/', BigintType, 'required'>>>()
// @ts-expect-error a bigint is not an int
aBigint.add(anInt)
const bigintTimesBigint = aBigint.multiply(aBigint)
assertType<Equal<typeof bigintTimesBigint, ValueSource<'s1/', BigintType, 'required'>>>()
// @ts-expect-error a bigint has no divide
aBigint.divide(aBigint)
const bigintSign = aBigint.sign()
assertType<Equal<typeof bigintSign, ValueSource<'s1/', IntType, 'required'>>>()
const moneyTimesMoney = aMoney.multiply(otherMoney)
assertType<Equal<typeof moneyTimesMoney, ValueSource<'s1/' | 's2/', CustomIntType<Money, 'Money'>, 'optional'>>>()
// @ts-expect-error a custom int has no sqrt
aMoney.sqrt()
const decimalExp = aDecimal.exp()
assertType<Equal<typeof decimalExp, ValueSource<'s1/', DoubleType, 'required'>>>()
const decimalRoundn = aDecimal.roundn(anInt)
assertType<Equal<typeof decimalRoundn, ValueSource<'s1/', CustomDecimalType<string, 'Price'>, 'required'>>>()
const decimalPower = aStringDecimal.power(aDouble)
assertType<Equal<typeof decimalPower, ValueSource<'s1/' | 's2/', DoubleType, 'optional'>>>()
const decimalPlusDecimal = aDecimal.add(otherDecimal)
assertType<Equal<typeof decimalPlusDecimal, ValueSource<'s1/' | 's2/', CustomDecimalType<string, 'Price'>, 'optional'>>>()
// @ts-expect-error a decimal of the user is not a string decimal
aDecimal.add(aStringDecimal)
// @ts-expect-error a decimal is not an int
aStringDecimal.add(anInt)
const ratioRoundn = aCustomDouble.roundn(anInt)
assertType<Equal<typeof ratioRoundn, ValueSource<'s1/', CustomDoubleType<number, 'Ratio'>, 'required'>>>()
const ratioSqrt = aCustomDouble.sqrt()
assertType<Equal<typeof ratioSqrt, ValueSource<'s1/', CustomDoubleType<number, 'Ratio'>, 'required'>>>()
const PriceType = CustomDecimalTypeClass.of<string, 'Price'>('Price')
assertType<Equal<typeof PriceType.prototype, CustomDecimalType<string, 'Price'>>>()

// Texts
declare const optionalString: ValueSource<'s2/', StringType, 'optional'>
const concatenated = aString.concat(optionalString)
assertType<Equal<typeof concatenated, ValueSource<'s1/' | 's2/', StringType, 'optional'>>>()
const concatenatedIgnoringNull = optionalString.concatIgnoringNull(aString)
assertType<Equal<typeof concatenatedIgnoringNull, ValueSource<'s2/' | 's1/', StringType, 'required'>>>()
const stringLength = aString.length()
assertType<Equal<typeof stringLength, ValueSource<'s1/', IntType, 'required'>>>()
const substring = aString.substr(anInt, 2)
assertType<Equal<typeof substring, ValueSource<'s1/', StringType, 'required'>>>()
// @ts-expect-error a number is not a text
aString.concat(anInt)
// @ts-expect-error a bigint is not a position
aString.substr(aBigint, 2)

// Uuids and dates
declare const aUuid: ValueSource<'s1/', UuidType, 'required'>
declare const aDate: ValueSource<'s1/', LocalDateType, 'optional'>
declare const aDateTime: ValueSource<'s1/', LocalDateTimeType, 'required'>
const uuidText = aUuid.asString()
assertType<Equal<typeof uuidText, ValueSource<'s1/', StringType, 'required'>>>()
// @ts-expect-error a uuid is not a text
aUuid.equals(aString)
const year = aDate.getFullYear()
assertType<Equal<typeof year, ValueSource<'s1/', IntType, 'optional'>>>()
const time = aDateTime.getTime()
assertType<Equal<typeof time, ValueSource<'s1/', IntType, 'required'>>>()
// @ts-expect-error a date is not a date and time
aDate.lessThan(aDateTime)

// The enumerations and the other types of the user
declare const aStatus: ValueSource<'s1/', EnumType<'a' | 'b', 'Status'>, 'required'>
declare const customStatus: ValueSource<'s1/', CustomEqualableType<'a' | 'b', 'Status'>, 'required'>
aStatus.equals('a')
aStatus.in(['a', 'b'])
// @ts-expect-error an enumeration is not a custom type of the same type name
aStatus.equals(customStatus)
// @ts-expect-error an enumeration has no order
aStatus.lessThan('a')

// Aggregated arrays
declare const anArray: ValueSource<'s1/', AggregatedArrayProjectableAsNullableType<{ a?: number }[], { a: number | null }[]>, 'optional'>
const emptyForNoValue = anArray.useEmptyArrayForNoValue()
assertType<Equal<typeof emptyForNoValue, ValueSource<'s1/', AggregatedArrayProjectableAsNullableType<{ a?: number }[], { a: number | null }[]>, 'required'>>>()
const asNullable = anArray.projectingOptionalValuesAsNullable()
assertType<Equal<typeof asNullable, ValueSource<'s1/', AggregatedArrayType<{ a: number | null }[]>, 'optional'>>>()

// Another source for a value source (a column of an alias, of a with, ...)
assertType<Equal<RemapValueSourceType<'x/', typeof anInt>, ValueSource<'x/', IntType, 'required'>>>()
assertType<Equal<RemapValueSourceTypeWithOptionalType<'x/', typeof aMoney, 'optional'>, ValueSource<'x/', CustomIntType<Money, 'Money'>, 'optional'>>>()
const intInput: RemapIValueSourceType<'s2/', typeof anInt> = aDouble.asRequiredInOptionalObject() as unknown as ValueSource<'s2/', DoubleType, 'required'>
void intInput
// @ts-expect-error a text is not what an int position accepts
const notAnIntInput: RemapIValueSourceType<'s1/', typeof anInt> = aString
void notAnIntInput

// The arguments of a fragment
type IntArg = Argument<IntType, 'required', 'combined'>
type OptionalMoneyArg = Argument<CustomIntType<Money, 'Money'>, 'optional', 'combined'>
type ValueArg = Argument<StringType, 'required', 'value'>
assertType<Equal<TypeOfArgument<IntArg>, number>>()
assertType<Equal<TypeOfArgument<OptionalMoneyArg>, Money | null | undefined>>()
assertType<Equal<MapArgumentToValueSource<'n/', IntArg>, ValueSource<'n/', IntType, 'required'>>>()
assertType<Equal<ArgForFn<'s1/', ValueArg>, never>>()
const moneyForArg: ArgForFn<'s2/', OptionalMoneyArg> = otherMoney
void moneyForArg
// @ts-expect-error a value argument of another type name
const otherForArg: ArgForFn<'s1/', OptionalMoneyArg> = anOther
void otherForArg

// A fragment of a data type
declare const intFragment: FragmentExpression<'n/', IntType, 'optional'>
const fragmentValue = intFragment.sql`${aString} + 1` as unknown
void fragmentValue
const fragmentOfOne = intFragment.sql(null as unknown as TemplateStringsArray, aString)
assertType<Equal<typeof fragmentOfOne, ValueSource<'s1/', IntType, 'optional'>>>()

// An argument of type any
const equalsAny = aString.equals(5 as any)
const equalsAnyIsUsable: ValueSource<'s1/', BooleanType, 'required'> = equalsAny
void equalsAnyIsUsable

// The type guard of a data type: a value source of that data type, with any source and optionality
declare const anything: unknown
if (IntTypeClass.is(anything)) {
    assertType<Equal<typeof anything, ValueSource<any, IntType, any>>>()
}
if (NumberTypeClass.is(anything)) {
    assertType<Equal<typeof anything, ValueSource<any, NumberType, any>>>()
}
if (MoneyType.is(anything)) {
    assertType<Equal<typeof anything, ValueSource<any, CustomIntType<Money, 'Money'>, any>>>()
}
// A condition is a boolean at run time: its data type has no type guard
// @ts-expect-error
IfTypeClass.is(anything)

// A method that takes a data type takes its class too; a built-in one gives the same as by its name
class ProbeConnection extends PostgreSqlConnection<'ProbeConnection'> {
    moneyArg = this.arg(MoneyType, 'optional')
}
declare const probeConnection: ProbeConnection
class ProbeTable extends Table<ProbeConnection, 'ProbeTable'> {
    byClass = this.column('amount', MoneyType)
    builtInByClass = this.optionalColumn('id', IntTypeClass)
    builtInByName = this.optionalColumn('id', 'int')
    // @ts-expect-error a class that groups data types has no type of its own
    group = this.column('id', NumberTypeClass)
    // @ts-expect-error the family of a custom data type has no type name
    family = this.column('id', CustomIntTypeClass)
    constructor() {
        super('probe_table')
    }
}
declare const probeTable: ProbeTable
assertType<Equal<SourceOf<typeof probeTable.byClass>, SourceOf<typeof probeTable.builtInByName>>>()
assertType<Equal<TypeOf<typeof probeTable.byClass>, CustomIntType<Money, 'Money'>>>()
assertType<Equal<OptionalOf<typeof probeTable.byClass>, 'required'>>()
assertType<typeof probeTable.byClass extends Column ? true : false>()
assertType<Equal<typeof probeTable.builtInByClass, typeof probeTable.builtInByName>>()
const moneyConst = probeConnection.const(5 as Money, MoneyType)
const intConst = probeConnection.const(5, 'int')
assertType<Equal<SourceOf<typeof moneyConst>, SourceOf<typeof intConst>>>()
assertType<Equal<TypeOf<typeof moneyConst>, CustomIntType<Money, 'Money'>>>()
// @ts-expect-error the value of a constant is of the type of its data type
probeConnection.const(5, MoneyType)
assertType<Equal<typeof probeConnection.moneyArg, Argument<CustomIntType<Money, 'Money'>, 'optional', 'combined'>>>()
