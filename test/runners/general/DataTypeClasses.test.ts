// The classes of the data types: the type guard `is` of each one, and a class given where a data type goes.

import { describe, expect, test } from '../../lib/testRunner.js'
import { assertType, type Exact } from '../../lib/assertType.js'
import { PostgreSqlConnection } from '../../../src/connections/PostgreSqlConnection.js'
import { NoopQueryRunner } from '../../../src/queryRunners/NoopQueryRunner.js'
import {
    BigintType, BooleanType, DoubleType, EnumType, IntType,
    LocalDateType, StringDecimalType, StringType, Table, UuidType, CustomBooleanTypeAdapter,
} from '../../../src/exports/v2/index.js'
import { NumberType } from '../../../src/typeSystem/number.js'
import { AdditiveType, ArithmeticType, IntegersType, RealsType } from '../../../src/typeSystem/numeric.js'
import { DecimalsType } from '../../../src/typeSystem/decimals.js'
import { ComparableType } from '../../../src/typeSystem/comparable.js'
import { EqualableType } from '../../../src/typeSystem/equalable.js'
import { NullableType } from '../../../src/typeSystem/nullable.js'
import { UuidsType } from '../../../src/typeSystem/uuids.js'
import { StringsType } from '../../../src/typeSystem/strings.js'
import { LocalDatesType } from '../../../src/typeSystem/localDates.js'
import { AggregatedArraysType, AggregatedArrayType } from '../../../src/typeSystem/aggregatedArrays.js'
import type { SourceOf, ValueSource } from '../../../src/typeSystem/base.js'

type Money = number & { readonly __brand: 'Money' }
type Status = 'open' | 'closed'

// The data types of the user, each one a class of the family of its values
abstract class MoneyType extends IntegersType<Money, 'Money'> { static override readonly type = 'Money' }
abstract class OtherType extends IntegersType<number, 'Other'> { static override readonly type = 'Other' }
abstract class PriceType extends DecimalsType<string, 'Price'> { static override readonly type = 'Price' }
abstract class StatusType extends EnumType<Status, 'Status'> { static override readonly type = 'Status' }
abstract class VersionType extends ComparableType<string, 'Version'> { static override readonly type = 'Version' }
// Another declaration with the same type name and family: another class
abstract class AnotherMoneyType extends IntegersType<Money, 'Money'> { static override readonly type = 'Money' }

// A data type of the user that extends a base of the library directly, with nothing more than its type name
abstract class ColorType extends EqualableType<string, 'Color'> {
    static override readonly type = 'Color'
}

// Type adapters, each one given to the columns that store a boolean that way
const yesNo = new CustomBooleanTypeAdapter('Y', 'N')
const oneZero = new CustomBooleanTypeAdapter(1, 0)

class DBConnection extends PostgreSqlConnection<'DBConnection'> {}
const conn = new DBConnection(new NoopQueryRunner())

const tThing = new class TThing extends Table<DBConnection, 'TThing'> {
    int = this.column('int', IntType)
    double = this.column('double', DoubleType)
    bigint = this.column('bigint', BigintType)
    string = this.column('string', StringType)
    boolean = this.column('boolean', BooleanType)
    uuid = this.column('uuid', UuidType)
    localDate = this.column('local_date', LocalDateType)
    stringDecimal = this.column('string_decimal', StringDecimalType)
    money = this.column('money', MoneyType)
    price = this.column('price', PriceType)
    status = this.column('status', StatusType)
    version = this.column('version', VersionType)
    color = this.column('color', ColorType)
    yes = this.column('yes', BooleanType, yesNo)
    alsoYes = this.column('also_yes', BooleanType, yesNo)
    yes10 = this.column('yes10', BooleanType, oneZero)
    constructor() { super('thing') }
}()

// A value of each data type, by its name
const values: Record<string, any> = {
    int: tThing.int, double: tThing.double, bigint: tThing.bigint, string: tThing.string, boolean: tThing.boolean,
    uuid: tThing.uuid, localDate: tThing.localDate, stringDecimal: tThing.stringDecimal, money: tThing.money,
    price: tThing.price, status: tThing.status, version: tThing.version,
    aggregatedArray: conn.aggregateAsArrayOfOneColumn(tThing.int),
    condition: tThing.int.equalsIfValue(1),
    neutral: conn.noValueBoolean(),
    number: 5, text: 'text', null: null, undefined: undefined, object: {},
}

// The values each class says yes to
function accepted(typeClass: { is(value: any): boolean }): string[] {
    return Object.keys(values).filter(name => typeClass.is(values[name]))
}

describe('DataTypeClasses', () => {
    test('is-of-a-class-with-a-type-says-yes-only-to-its-type', () => {
        expect(accepted(IntType)).toEqual(['int'])
        expect(accepted(DoubleType)).toEqual(['double'])
        expect(accepted(BigintType)).toEqual(['bigint'])
        expect(accepted(StringType)).toEqual(['string'])
        expect(accepted(UuidType)).toEqual(['uuid'])
        expect(accepted(LocalDateType)).toEqual(['localDate'])
        expect(accepted(StringDecimalType)).toEqual(['stringDecimal'])
        expect(accepted(AggregatedArrayType)).toEqual(['aggregatedArray'])
    })

    test('is-of-a-type-of-the-user-says-yes-only-to-its-class', () => {
        expect(accepted(MoneyType)).toEqual(['money'])
        expect(accepted(OtherType)).toEqual([])
        expect(accepted(PriceType)).toEqual(['price'])
        expect(accepted(StatusType)).toEqual(['status'])
        expect(accepted(VersionType)).toEqual(['version'])
        expect(accepted(AnotherMoneyType)).toEqual([])
    })

    test('is-of-a-family-says-yes-to-each-of-its-types', () => {
        expect(accepted(IntegersType)).toEqual(['bigint', 'money'])
        expect(accepted(DecimalsType)).toEqual(['stringDecimal', 'price'])
        expect(accepted(EnumType)).toEqual(['status'])
    })

    test('is-of-a-group-says-yes-to-each-data-type-it-groups', () => {
        expect(accepted(NumberType)).toEqual(['int', 'double'])
        expect(accepted(ArithmeticType)).toEqual(['int', 'double', 'bigint', 'stringDecimal', 'money', 'price'])
        expect(accepted(AdditiveType)).toEqual(['bigint', 'stringDecimal', 'money', 'price'])
        expect(accepted(IntegersType)).toEqual(['bigint', 'money'])
        expect(accepted(RealsType)).toEqual([])
        expect(accepted(DecimalsType)).toEqual(['stringDecimal', 'price'])
        expect(accepted(UuidsType)).toEqual(['uuid'])
        expect(accepted(StringsType)).toEqual(['string'])
        expect(accepted(AggregatedArraysType)).toEqual(['aggregatedArray'])
        expect(accepted(LocalDatesType)).toEqual(['localDate'])
        expect(accepted(ComparableType)).toEqual(['int', 'double', 'bigint', 'string', 'uuid', 'localDate', 'stringDecimal', 'money', 'price', 'version'])
        const equalable = ['int', 'double', 'bigint', 'string', 'boolean', 'uuid', 'localDate', 'stringDecimal', 'money', 'price', 'status', 'version', 'condition', 'neutral']
        expect(accepted(EqualableType)).toEqual(equalable)
        expect(accepted(NullableType)).toEqual(equalable)
    })

    test('is-of-boolean-says-yes-to-a-condition-and-to-the-neutral-which-are-booleans-at-run-time', () => {
        expect(accepted(BooleanType)).toEqual(['boolean', 'condition', 'neutral'])
    })

    test('is-narrows-a-value-source-keeping-its-source-and-optionality', () => {
        // Of a union, the value sources of the data type; of a data type it extends, the data type asked with the
        // source and the optionality of the value source
        function isMoney(value: typeof tThing.money | typeof tThing.double): boolean {
            if (MoneyType.is(value)) {
                assertType<Exact<typeof value, typeof tThing.money>>()
                return true
            }
            return false
        }
        function isInt(value: ValueSource<SourceOf<typeof tThing.int>, NumberType, 'required'>): boolean {
            if (IntType.is(value)) {
                assertType<Exact<typeof value, ValueSource<SourceOf<typeof tThing.int>, IntType, 'required'>>>()
                return true
            }
            return false
        }
        expect(isMoney(tThing.money)).toBe(true)
        expect(isMoney(tThing.double)).toBe(false)
        expect(isInt(tThing.int.add(1))).toBe(true)
        expect(isInt(tThing.double.add(1))).toBe(false)
    })

    test('each-declaration-is-a-class-of-its-own', () => {
        expect(AnotherMoneyType.type).toBe(MoneyType.type)
        expect(tThing.money).not.toBeInstanceOf(AnotherMoneyType)
        expect(AnotherMoneyType.is(tThing.money)).toBe(false)
    })

    test('a-value-source-is-an-instance-of-the-class-of-its-data-type', () => {
        expect(tThing.money).toBeInstanceOf(MoneyType)
        expect(tThing.money).toBeInstanceOf(IntegersType)
        expect(tThing.int).toBeInstanceOf(IntType)
        expect(tThing.int).toBeInstanceOf(NumberType)
        expect(tThing.int).not.toBeInstanceOf(DoubleType)
        expect(conn.const(5, 'int')).toBeInstanceOf(IntType)
        expect(tThing.money.add(tThing.money)).toBeInstanceOf(MoneyType)
        expect(tThing.int.add(0.5)).toBeInstanceOf(DoubleType)
        expect(tThing.string.length()).toBeInstanceOf(IntType)
        expect(tThing.int.equals(1)).toBeInstanceOf(BooleanType)
        expect(conn.noValueBoolean()).toBeInstanceOf(BooleanType)
        expect(tThing.status.equals('open')).toBeInstanceOf(BooleanType)
        expect(tThing.uuid.asString()).toBeInstanceOf(StringType)
        expect(tThing.stringDecimal.sqrt()).toBeInstanceOf(DoubleType)
        expect(tThing.version.valueWhenNull('1')).toBeInstanceOf(VersionType)
        expect(conn.aggregateAsArrayOfOneColumn(tThing.int)).toBeInstanceOf(AggregatedArrayType)
        expect(conn.selectFrom(tThing).select({ int: tThing.int }).forUseAsInlineAggregatedArrayValue()).toBeInstanceOf(AggregatedArrayType)
        expect(conn.aggregateAsArrayOfOneColumn(tThing.int).onlyWhenOrNull(false)).toBeInstanceOf(AggregatedArrayType)
    })

    test('the-text-of-a-uuid-keeps-its-class-only-where-its-sql-is-kept', () => {
        const text = tThing.uuid.asString()
        const classOf = (value: unknown) => (value as object).constructor
        expect(text).toBeInstanceOf(StringType)
        expect(classOf(text)).not.toBe(StringType)
        // A value source that keeps the SQL of the text keeps its class
        expect(classOf(text.asOptional())).toBe(classOf(text))
        expect(classOf(text.allowWhen(true, 'never'))).toBe(classOf(text))
        // A value computed from it is a text
        expect(classOf(text.concat('-'))).toBe(StringType)
        expect(classOf(text.valueWhenNull('-'))).toBe(StringType)
        expect(classOf(conn.max(text))).toBe(StringType)
    })

    test('the-boolean-of-a-condition-keeps-its-class-only-where-its-sql-is-kept', () => {
        const classOf = (value: unknown) => (value as object).constructor
        const condition = tThing.int.equals(1)
        expect(condition).toBeInstanceOf(BooleanType)
        expect(classOf(condition)).not.toBe(BooleanType)
        expect(classOf(tThing.boolean)).toBe(BooleanType)
        // The comparisons, and, or, negate, exists and the neutral are conditions
        expect(classOf(tThing.boolean.and(true))).toBe(classOf(condition))
        expect(classOf(condition.negate())).toBe(classOf(condition))
        expect(classOf(conn.exists(conn.selectFrom(tThing).selectOneColumn(tThing.int)))).toBe(classOf(condition))
        expect(classOf(conn.noValueBoolean())).toBe(classOf(condition))
        // What keeps its SQL keeps its class; a value computed from it is a boolean
        expect(classOf(condition.allowWhen(true, 'never'))).toBe(classOf(condition))
        expect(classOf(condition.asOptional())).toBe(classOf(condition))
        expect(classOf(condition.valueWhenNull(false))).toBe(BooleanType)
    })

    test('a-data-type-that-extends-a-base-directly-gives-the-booleans-of-the-library', () => {
        const classOf = (value: unknown) => (value as object).constructor
        const condition = tThing.int.equals(1)
        expect(tThing.color).toBeInstanceOf(ColorType)
        expect(classOf(tThing.color.equals('red'))).toBe(classOf(condition))
        expect(classOf(tThing.color.isNull())).toBe(classOf(condition))
        expect(classOf(tThing.color.in(['red', 'blue']))).toBe(classOf(condition))
        expect(classOf(tThing.color.valueWhenNull('red'))).toBe(ColorType)
        // The same type as the comparison of a built-in data type
        const red = tThing.color.equals('red')
        assertType<Exact<typeof red, typeof condition>>()
    })

    test('a-value-source-with-a-type-adapter-is-an-instance-of-a-class-of-its-data-type-for-that-adapter', () => {
        const classOf = (value: unknown) => (value as object).constructor
        expect(tThing.yes).toBeInstanceOf(BooleanType)
        expect(BooleanType.is(tThing.yes)).toBe(true)
        expect(classOf(tThing.yes)).not.toBe(BooleanType)
        // The same class for the same data type and adapter, another one for another adapter
        expect(classOf(tThing.alsoYes)).toBe(classOf(tThing.yes))
        expect(classOf(tThing.yes10)).not.toBe(classOf(tThing.yes))
        // Without an adapter, the class of the data type itself
        expect(classOf(tThing.boolean)).toBe(BooleanType)
        expect(classOf(tThing.yes.asOptional())).toBe(classOf(tThing.yes))
    })

    test('a-built-in-class-gives-the-type-its-name-gives', () => {
        const byClass = conn.const(5, IntType)
        const byName = conn.const(5, 'int')
        assertType<Exact<typeof byClass, typeof byName>>()
        expect(IntType.is(byClass)).toBe(true)
        expect(IntType.is(byName)).toBe(true)
    })
})
