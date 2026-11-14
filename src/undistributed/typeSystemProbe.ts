// What the new type system of the value sources must answer, checked by the compiler while it is built alongside the
// current one. Nothing runs here.

import type { TypedValueSource } from '../typeSystem/valueSource.js'
import type { ValueSource } from '../typeSystem/base.js'
import type { AlwaysIfValueSource, BooleanType, IfValueSource } from '../typeSystem/booleans.js'
import type { CustomIntType, DoubleType, IntType } from '../typeSystem/numbers.js'
import { CustomIntType as CustomIntTypeClass } from '../typeSystem/numbers.js'
import type { StringType } from '../typeSystem/strings.js'

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
const MoneyType = CustomIntTypeClass.withTypeName<Money, 'Money'>('Money')
assertType<Equal<typeof MoneyType.prototype, CustomIntType<Money, 'Money'>>>()
