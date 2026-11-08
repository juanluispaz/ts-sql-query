// Compile-time negative tests for value expressions on the mysql dialect:
// the operators and functions of each data type's value source, and the
// connection-level value functions (const, optionalConst, aggregates, exists).
// These never execute any SQL — the value of the test is that
// `validate:tests` (tsc) rejects each `@ts-expect-error` line. If the library
// stops rejecting one of these, the directive becomes "unused" and `tsc` fails
// the build with `TS2578` — exactly the regression signal we want.
//
// Every negative sits next to a positive control: the same expression with the
// valid variant, which must compile, so each directive can only be satisfied
// by the rule it names.
//
// Every `@ts-expect-error` MUST be accompanied by a comment naming the rule it
// enforces. DESIGN §6.

import { test, expect } from '../../../lib/testRunner.js'
import { MySqlConnection } from '../../../../src/connections/MySqlConnection.js'
import { Table } from '../../../../src/Table.js'
import type { DBConnection } from '../domain/connection.js'
import { tColMatrixColumn as t } from '../domain/connection.js'

// A second connection with its own table: value sources of a different
// connection must not mix with the ones of `DBConnection`.
class OtherConnection extends MySqlConnection<'OtherConnection'> { }
class TOther extends Table<OtherConnection, 'TOther'> {
    id = this.column('id', 'int')
    constructor() { super('other') }
}

// Type-only: the function below is checked by tsc but never invoked at
// runtime, so no instance is needed.
declare const connection: DBConnection
declare const other: OtherConnection
declare const tOther: TOther

function _typeNegatives() {
    // ---------------------------------------------------------------- boolean

    // Rule: `and` / `or` combine boolean operands only.
    void t.mBool.and(t.mBool)
    // @ts-expect-error an int column is not a boolean operand of and
    void t.mBool.and(t.mInt)
    void t.mBool.and(true)
    // @ts-expect-error a string is not a boolean operand of and
    void t.mBool.and('x')
    void t.mBool.or(false)
    // @ts-expect-error a number is not a boolean operand of or
    void t.mBool.or(1)
    void connection.true().and(t.mBool)
    // @ts-expect-error an int column is not a boolean operand of and
    void connection.true().and(t.mInt)

    // Rule: `negate` is a boolean operation, absent on other data types.
    void t.mBool.negate()
    // @ts-expect-error negate does not exist on a number value source
    void t.mInt.negate()

    // Rule: boolean values are only equalable, not ordered.
    void t.mBool.equals(true)
    // @ts-expect-error lessThan does not exist on a boolean value source
    void t.mBool.lessThan(true)
    // @ts-expect-error a number is not a boolean value
    void t.mBool.equals(1)

    // Rule: `trueWhenNoValue` resolves an *IfValue condition; a plain
    // condition always has its value, so it does not offer it.
    void t.mInt.equalsIfValue(1).trueWhenNoValue()
    // @ts-expect-error trueWhenNoValue does not exist on a plain boolean value source
    void t.mBool.equals(true).trueWhenNoValue()

    // ------------------------------------------------------- number (int/double)

    // Rule: number arithmetic takes number operands only.
    void t.mInt.add(1)
    // @ts-expect-error a string scalar is not a number operand
    void t.mInt.add('1')
    void t.mInt.add(t.mDouble)
    // @ts-expect-error a string column is not a number operand
    void t.mInt.add(t.mStr)
    // @ts-expect-error a bigint column is not a number operand
    void t.mInt.add(t.mBigint)
    // @ts-expect-error a customInt column is not a number operand
    void t.mInt.add(t.cents)
    void t.mDouble.modulo(t.mInt)
    // @ts-expect-error a bigint column is not a number operand of modulo
    void t.mDouble.modulo(t.mBigint)
    void t.mInt.power(2)
    // @ts-expect-error a string scalar is not a number operand of power
    void t.mInt.power('2')

    // Rule: a number compares with numbers only.
    void t.mInt.equals(t.mDouble)
    // @ts-expect-error a bigint column is not comparable with a number
    void t.mInt.equals(t.mBigint)
    void t.mInt.notEquals(1)
    // @ts-expect-error a string scalar is not comparable with a number
    void t.mInt.notEquals('1')
    void t.mInt.is(1)
    // @ts-expect-error a string scalar is not comparable with a number
    void t.mInt.is('1')
    void t.mInt.greaterThan(t.mInt)
    // @ts-expect-error a localDate column is not comparable with a number
    void t.mInt.greaterThan(t.mDate)

    // Rule: both `between` bounds carry the receiver's data type.
    void t.mInt.between(1, 5)
    // @ts-expect-error a string upper bound for a number between
    void t.mInt.between(1, '5')
    void t.mInt.between(t.mInt, 5)
    // @ts-expect-error a string column as lower bound for a number between
    void t.mInt.between(t.mStr, 5)

    // Rule: `in` / `notIn` take an array of the receiver's data type.
    void t.mInt.in([1])
    // @ts-expect-error a string element in a number in-list
    void t.mInt.in(['1'])
    // @ts-expect-error a bare scalar is not an in-list
    void t.mInt.in(1)
    void t.mInt.notIn([1])
    // @ts-expect-error a string element in a number not-in-list
    void t.mInt.notIn(['a'])
    void t.mInt.inIfValue([1])
    // @ts-expect-error a string element in a number in-list
    void t.mInt.inIfValue(['1'])

    // Rule: string functions are absent on a number value source.
    void t.mStr.length()
    // @ts-expect-error length does not exist on a number value source
    void t.mInt.length()
    // @ts-expect-error toLowerCase does not exist on a number value source
    void t.mInt.toLowerCase()

    // Rule: a number cast is offered on numbers; a uuid is the only one cast to string.
    void t.mDouble.asInt()
    // @ts-expect-error asInt does not exist on a string value source
    void t.mStr.asInt()
    // @ts-expect-error asString does not exist on a number value source
    void t.mInt.asString()

    // ------------------------------------------------------------------ bigint

    // Rule: bigint arithmetic and comparison take bigint operands only.
    void t.mBigint.add(1n)
    // @ts-expect-error a number scalar is not a bigint operand
    void t.mBigint.add(1)
    // @ts-expect-error an int column is not a bigint operand
    void t.mBigint.add(t.mInt)
    void t.mBigint.equals(1n)
    // @ts-expect-error a number scalar is not comparable with a bigint
    void t.mBigint.equals(1)

    // ------------------------------------------------------------------ string

    // Rule: `concat` appends strings only.
    void t.mStr.concat('x')
    // @ts-expect-error a number scalar is not concatenable
    void t.mStr.concat(1)
    void t.mStr.concat(t.mStr)
    // @ts-expect-error an int column is not concatenable
    void t.mStr.concat(t.mInt)
    void t.mStr.concat(t.mUuid.asString())
    // @ts-expect-error a uuid column is concatenable only through asString()
    void t.mStr.concat(t.mUuid)

    // Rule: the string predicates take string operands only.
    void t.mStr.like('a%')
    // @ts-expect-error a number scalar is not a like pattern
    void t.mStr.like(1)
    // @ts-expect-error a uuid column is not a like pattern
    void t.mStr.like(t.mUuid)
    void t.mStr.equalsInsensitive(t.mStr)
    // @ts-expect-error an int column is not a string operand of equalsInsensitive
    void t.mStr.equalsInsensitive(t.mInt)
    void t.mStr.contains(t.mStr)
    // @ts-expect-error an int column is not a string operand of contains
    void t.mStr.contains(t.mInt)
    void t.mStr.startsWith(t.mStr)
    // @ts-expect-error a uuid column is not a string operand of startsWith
    void t.mStr.startsWith(t.mUuid)
    void t.mStr.lessThan('b')
    // @ts-expect-error a number scalar is not comparable with a string
    void t.mStr.lessThan(1)

    // Rule: the string functions take their documented argument data types.
    void t.mStr.substr(1, 2)
    // @ts-expect-error substr's start is a number, not a string
    void t.mStr.substr('1', 2)
    void t.mStr.substr(t.mInt, 1)
    // @ts-expect-error substr's start is a number, not a string column
    void t.mStr.substr(t.mStr, 1)
    void t.mStr.substrToEnd(1)
    // @ts-expect-error substrToEnd's start is a number, not a string
    void t.mStr.substrToEnd('1')
    void t.mStr.replaceAll('a', 'x')
    // @ts-expect-error replaceAll's search value is a string, not a number
    void t.mStr.replaceAll(1, 'x')
    void t.mStr.collate('C')
    // @ts-expect-error the collation name is a string
    void t.mStr.collate(1)

    // Rule: arithmetic is absent on a string value source.
    // @ts-expect-error add does not exist on a string value source
    void t.mStr.add(1)

    // Rule: asString is the uuid cast; a string needs none.
    // @ts-expect-error asString does not exist on a string value source
    void t.mStr.asString()

    // -------------------------------------------------------------------- uuid

    // Rule: a uuid is its own data type, not a string: comparing it with a
    // string column needs asString().
    void t.mStr.equals(t.mUuid.asString())
    // @ts-expect-error a uuid column is not comparable with a string column
    void t.mStr.equals(t.mUuid)
    void t.mUuid.equals(t.mUuid)
    // @ts-expect-error a string column is not comparable with a uuid column
    void t.mUuid.equals(t.mStr)

    // Rule: the string functions are absent on a uuid value source.
    void t.mUuid.asString().like('a%')
    // @ts-expect-error like does not exist on a uuid value source
    void t.mUuid.like('a%')
    // @ts-expect-error concat does not exist on a uuid value source
    void t.mUuid.concat('x')

    // ------------------------------------------------- localDate / localTime / localDateTime

    // Rule: localDate, localTime and localDateTime are distinct data types even
    // though all three read as a JavaScript Date.
    void t.mDate.equals(t.mDate)
    // @ts-expect-error a localDateTime column is not comparable with a localDate
    void t.mDate.equals(t.mDatetime)
    // @ts-expect-error a localTime column is not comparable with a localDate
    void t.mDate.lessThan(t.mTime)
    void t.mTime.equals(t.mTime)
    // @ts-expect-error a localDateTime column is not comparable with a localTime
    void t.mTime.equals(t.mDatetime)
    void t.mDatetime.between(t.mDatetime, t.mDatetime)
    // @ts-expect-error a localDate lower bound for a localDateTime between
    void t.mDatetime.between(t.mDate, t.mDatetime)
    void connection.const(new Date(), 'localDate').equals(t.mDate)
    // @ts-expect-error a localTime constant is not comparable with a localDate
    void connection.const(new Date(), 'localTime').equals(t.mDate)

    // Rule: a date value is a Date, not its text representation.
    void t.mDate.equals(new Date())
    // @ts-expect-error a string is not a localDate value
    void t.mDate.equals('2020-01-01')

    // Rule: arithmetic is absent on a date value source.
    // @ts-expect-error add does not exist on a localDate value source
    void t.mDate.add(1)

    // -------------------------------------------------- custom data types vs their base

    // Rule: a custom data type is not comparable with the native data type it
    // is stored as.
    void t.cents.equals(1)
    // @ts-expect-error an int column is not comparable with a customInt
    void t.cents.equals(t.mInt)
    void t.money.equals(1.5)
    // @ts-expect-error a double column is not comparable with a customDouble
    void t.money.equals(t.mDouble)
    void t.signingKey.asString()
    // @ts-expect-error a uuid column is not comparable with a customUuid
    void t.signingKey.equals(t.mUuid)
    void t.releaseDay.equals(new Date())
    // @ts-expect-error a localDate column is not comparable with a customLocalDate
    void t.releaseDay.equals(t.mDate)
    void t.cutoffClock.equals(new Date())
    // @ts-expect-error a localTime column is not comparable with a customLocalTime
    void t.cutoffClock.equals(t.mTime)
    void t.signOff.equals(new Date())
    // @ts-expect-error a localDateTime column is not comparable with a customLocalDateTime
    void t.signOff.equals(t.mDatetime)
    void t.semver.equals('1.0.0')
    // @ts-expect-error a customComparable column is not comparable with a string column
    void t.mStr.equals(t.semver)

    // Rule: custom arithmetic takes operands of the same custom data type.
    void t.cents.add(1)
    // @ts-expect-error an int column is not a customInt operand
    void t.cents.add(t.mInt)
    // @ts-expect-error a customDouble column is not a customInt operand
    void t.cents.add(t.money)
    void connection.const(1, 'customDouble', 'Money').add(t.money)
    // @ts-expect-error a double column is not a customDouble operand
    void t.money.add(t.mDouble)

    // Rule: a customDecimal takes operands of its own type, and the functions that can't be exact give a double.
    const amount = connection.const<string, 'Amount'>('1.50', 'customDecimal', 'Amount')
    void amount.add('0.01')
    void amount.add(amount)
    // @ts-expect-error a customDouble column is not a customDecimal operand
    void amount.add(t.money)
    // @ts-expect-error a double column is not a customDecimal operand
    void amount.add(t.mDouble)
    // @ts-expect-error a customDecimal is not comparable with a double column
    void amount.equals(t.mDouble)
    void amount.power(2)
    // @ts-expect-error the exponent of power is a number, not a customDecimal
    void amount.power(amount)
    // @ts-expect-error a customDecimal has no divide: the division of two decimals isn't exact
    void amount.divide('2')
    void amount.sqrt().equals(t.mDouble)
    // @ts-expect-error sqrt gives a double, not a customDecimal
    void amount.sqrt().equals(amount)
    void amount.roundn(2).equals(amount)
    // @ts-expect-error asDouble is a NumberValueSource-only cast, absent on customDecimal
    void amount.asDouble()

    // Rule: asString is offered on uuid data types only.
    // @ts-expect-error asString does not exist on a customInt value source
    void t.cents.asString()

    // ------------------------------------------------ enum / custom / customComparable

    // Rule: the string functions are absent on a customComparable value source.
    void t.semver.lessThan('2.0.0')
    // @ts-expect-error like does not exist on a customComparable value source
    void t.semver.like('1%')

    // Rule: custom and enum data types are only equalable, not ordered.
    void t.channel.equals('beta')
    // @ts-expect-error lessThan does not exist on a custom value source
    void t.channel.lessThan('beta')
    void t.activity.equals('coding')
    // @ts-expect-error lessThan does not exist on an enum value source
    void t.activity.lessThan('coding')

    // Rule: an enum compares with a member of its union only.
    // @ts-expect-error 'other' is not a WorklogActivity
    void t.activity.equals('other')

    // ------------------------------------------------- null, optionality and *IfValue

    // Rule: a plain comparison takes a value; null / undefined are handled by
    // is / isNull or by the *IfValue variant.
    void t.mInt.is(null)
    // @ts-expect-error equals does not take null; use is(null) or isNull()
    void t.mInt.equals(null)
    // @ts-expect-error equals does not take undefined; use equalsIfValue
    void t.mInt.equals(undefined)
    void t.mInt.in([1, 2])
    // @ts-expect-error an in-list element cannot be null
    void t.mInt.in([1, null])
    void t.mInt.inIfValue(null)
    // @ts-expect-error in does not take null; use inIfValue
    void t.mInt.in(null)
    void t.mStr.concatIfValue(null)
    // @ts-expect-error concat does not take null; use concatIfValue
    void t.mStr.concat(null)
    void t.mStr.likeIfValue(null)
    // @ts-expect-error like does not take null; use likeIfValue
    void t.mStr.like(null)

    // Rule: the *IfValue operand keeps the receiver's data type.
    void t.mInt.equalsIfValue(1)
    // @ts-expect-error a string scalar is not comparable with a number
    void t.mInt.equalsIfValue('1')

    // Rule: valueWhenNull's replacement is a value of the receiver's data type.
    void t.mInt.valueWhenNull(0)
    // @ts-expect-error a string replacement for a number
    void t.mInt.valueWhenNull('0')
    // @ts-expect-error a string column as replacement for a number
    void t.mInt.valueWhenNull(t.mStr)
    // @ts-expect-error null is not a replacement value
    void t.mInt.valueWhenNull(null)

    // ------------------------------------------------------- const / optionalConst

    // Rule: const's value matches the data type named.
    void connection.const('1', 'string')
    // @ts-expect-error a number value for a string constant
    void connection.const(1, 'string')
    void connection.const(1, 'int')
    // @ts-expect-error a string value for an int constant
    void connection.const('1', 'int')
    // @ts-expect-error a bigint value for an int constant
    void connection.const(1n, 'int')
    void connection.const(new Date(), 'localDate')
    // @ts-expect-error a string value for a localDate constant
    void connection.const('2020-01-01', 'localDate')
    void connection.optionalConst('1', 'string')
    // @ts-expect-error a number value for a string constant
    void connection.optionalConst(1, 'string')

    // Rule: const's data type is one of the library's data types.
    // @ts-expect-error 'date' is not a data type; use 'localDate'
    void connection.const(new Date(), 'date')

    // Rule: const takes a value; a null one is an optionalConst.
    void connection.optionalConst(null, 'int')
    void connection.optionalConst(undefined, 'int')
    // @ts-expect-error const does not take null; use optionalConst
    void connection.const(null, 'int')

    // Rule: a custom data type constant needs its type name.
    void connection.const(1, 'customInt', 'Cents')
    // @ts-expect-error a customInt constant without its type name
    void connection.const(1, 'customInt')

    // Rule: the type name keeps custom constants apart.
    void connection.const(1, 'customInt', 'Cents').equals(t.cents)
    // @ts-expect-error a customInt 'Other' constant is not comparable with customInt 'Cents'
    void connection.const(1, 'customInt', 'Other').equals(t.cents)
    void connection.const('coding', 'enum', 'WorklogActivity').equals(t.activity)
    // @ts-expect-error an enum 'ReleaseChannel' constant is not comparable with enum 'WorklogActivity'
    void connection.const('coding', 'enum', 'ReleaseChannel').equals(t.activity)

    // --------------------------------------- allowWhen / disallowWhen / onlyWhen / ignoreWhen

    // Rule: these conditions are evaluated in JavaScript when the query is
    // built, so they take a boolean, not a value source.
    void t.mInt.allowWhen(true, 'not allowed')
    // @ts-expect-error a boolean column is not a JavaScript condition
    void t.mInt.allowWhen(t.mBool, 'not allowed')
    void t.mInt.disallowWhen(false, 'not allowed')
    // @ts-expect-error a boolean column is not a JavaScript condition
    void t.mInt.disallowWhen(t.mBool, 'not allowed')
    void t.mBool.onlyWhen(true)
    // @ts-expect-error a boolean column is not a JavaScript condition
    void t.mBool.onlyWhen(t.mBool)
    void t.mBool.ignoreWhen(false)
    // @ts-expect-error a string is not a JavaScript condition
    void t.mBool.ignoreWhen('x')
    void t.mInt.onlyWhenOrNull(true)
    // @ts-expect-error a boolean column is not a JavaScript condition
    void t.mInt.onlyWhenOrNull(t.mBool)

    // Rule: allowWhen / disallowWhen need the error to raise.
    // @ts-expect-error allowWhen without its error message
    void t.mInt.allowWhen(true)

    // -------------------------------------------------------------- aggregates

    // Rule: sum / average take a numeric value source.
    void connection.sum(t.mInt)
    // @ts-expect-error a localDate column is not summable
    void connection.sum(t.mDate)
    // @ts-expect-error a boolean column is not summable
    void connection.sum(t.mBool)
    void connection.sumDistinct(t.mInt)
    // @ts-expect-error a string column is not summable
    void connection.sumDistinct(t.mStr)
    void connection.average(t.mDouble)
    // @ts-expect-error a string column cannot be averaged
    void connection.average(t.mStr)
    // @ts-expect-error a localDate column cannot be averaged
    void connection.average(t.mDate)
    void connection.averageDistinct(t.mInt)
    // @ts-expect-error a string column cannot be averaged
    void connection.averageDistinct(t.mStr)

    // Rule: max / min take an ordered data type.
    void connection.max(t.mInt)
    // @ts-expect-error a boolean column is not ordered
    void connection.max(t.mBool)
    void connection.max(t.semver)
    // @ts-expect-error a custom column is not ordered
    void connection.max(t.channel)
    void connection.min(t.mDate)
    // @ts-expect-error a boolean column is not ordered
    void connection.min(t.mBool)
    // @ts-expect-error an enum column is not ordered
    void connection.min(t.activity)

    // Rule: stringConcat aggregates strings, and its separator is a string.
    void connection.stringConcat(t.mStr)
    // @ts-expect-error an int column is not a string to aggregate
    void connection.stringConcat(t.mInt)
    // @ts-expect-error a uuid column is not a string to aggregate
    void connection.stringConcat(t.mUuid)
    void connection.stringConcat(t.mStr, ', ')
    // @ts-expect-error the separator is a string
    void connection.stringConcat(t.mStr, 1)
    void connection.stringConcatDistinct(t.mStr)
    // @ts-expect-error an int column is not a string to aggregate
    void connection.stringConcatDistinct(t.mInt)

    // Rule: count / exists take a value source / a select query.
    void connection.count(t.mInt)
    // @ts-expect-error a scalar is not a value source to count
    void connection.count(1)
    void connection.exists(connection.selectFrom(t).select({ id: t.id }))
    // @ts-expect-error a scalar is not a select query
    void connection.exists(1)

    // ---------------------------------------------------------- aggregated arrays

    // Rule: an aggregated array is built from value sources.
    void connection.aggregateAsArray({ x: t.mInt })
    // @ts-expect-error a scalar is not a value source to aggregate
    void connection.aggregateAsArray({ x: 1 })
    void connection.aggregateAsArrayOfOneColumn(t.mInt)
    // @ts-expect-error a scalar is not a value source to aggregate
    void connection.aggregateAsArrayOfOneColumn(1)

    // Rule: an aggregated array is a projection only; it offers no comparison.
    void connection.aggregateAsArrayOfOneColumn(t.mInt).useEmptyArrayForNoValue()
    // @ts-expect-error equals does not exist on an aggregated array value source
    void connection.aggregateAsArrayOfOneColumn(t.mInt).equals([1])

    // ------------------------------------------------------ mixing connections

    // Rule: the aggregate functions and exists take value sources / queries of
    // their own connection.
    // @ts-expect-error a column of another connection
    void connection.count(tOther.id)
    // @ts-expect-error a column of another connection
    void connection.max(tOther.id)
    // @ts-expect-error a select query of another connection
    void connection.exists(other.selectFrom(tOther).select({ id: tOther.id }))
    // @ts-expect-error a column of another connection
    void connection.aggregateAsArray({ x: tOther.id })

    // Rule: an expression carrying a value source of another connection is not
    // usable in this connection's query.
    void connection.selectFrom(t).where(t.mInt.equals(connection.const(1, 'int'))).select({ id: t.id })
    // @ts-expect-error the condition compares with a column of another connection
    void connection.selectFrom(t).where(t.mInt.equals(tOther.id)).select({ id: t.id })
    // @ts-expect-error the condition compares with a constant of another connection
    void connection.selectFrom(t).where(t.mInt.equals(other.const(1, 'int'))).select({ id: t.id })
    void connection.selectFrom(t).select({ x: t.mInt.add(connection.const(1, 'int')) })
    // @ts-expect-error the projected value adds a constant of another connection
    void connection.selectFrom(t).select({ x: t.mInt.add(other.const(1, 'int')) })

    // ------------------------------------------------------- nested aggregates

    // Rule: an aggregate function does not take an aggregate as its argument (a
    // nested aggregate), which MySQL rejects. Aggregating the result of an
    // aggregate is written over a subquery that aggregates.
    void connection.max(t.mInt)
    // @ts-expect-error count(...) is an aggregate: max cannot take it
    void connection.max(connection.count(t.mInt))
    // @ts-expect-error countAll() is an aggregate: sum cannot take it
    void connection.sum(connection.countAll())
    // @ts-expect-error max(...) is an aggregate: count cannot take it
    void connection.count(connection.max(t.mInt))
    // @ts-expect-error count(...) is an aggregate: an aggregated array cannot take it
    void connection.aggregateAsArrayOfOneColumn(connection.count(t.mInt))
    // @ts-expect-error countAll() is an aggregate: an aggregated array cannot take it
    void connection.aggregateAsArray({ n: connection.countAll() })
    // Positive control: the aggregate of a subquery that aggregates.
    void connection.sum(connection.selectFrom(t).selectOneColumn(connection.countAll()).forUseAsInlineQueryValue())
}

test('expressions-negative-types', () => {
    expect(typeof _typeNegatives).toBe('function')
})
