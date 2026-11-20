---
search:
  boost: 0.55
---
# Data types of your own

A data type of yours gives a column your own TypeScript type, like an amount of cents that your code doesn't mix with other numbers, or a value only your code understands, like a JSON document. It is a class that extends a family of the library, declared once and used wherever a value of that type goes: in each column, [constant](../../queries/basic-query-structure.md), [SQL fragment](../../queries/sql-fragments.md) and argument of a fragment. The family says which operations the values offer in a query, their type in the database and how they are converted.

This page has the class, the families, its type in the database, its conversions and giving the type by its name; every static, method and type a class of a data type has is listed in the [Data types API](../../api/data-types.md). The TypeScript types that suit a data type of yours are in [Branded and opaque types](branded-and-opaque-types.md), methods with SQL of your own in [Methods of your own](methods-of-your-own.md), and converting the values in your own way in [Type adapters](type-adapters.md). For the types the library has, see [Data types](../../configuration/data-types.md).

## The class

The family takes two generic arguments, your TypeScript type and its type name, and the class says the type name again in `type`:

```typescriptreact
import { IntegersType, EnumType } from 'ts-sql-query'

abstract class MyIntDataType extends IntegersType<MyIntType, 'MyIntTypeName'> {
    static override readonly type = 'MyIntTypeName'
}
abstract class MyEnumDataType extends EnumType<MyEnumType, 'MyEnumTypeName'> {
    static override readonly type = 'MyEnumTypeName'
}
```

A column takes the class where it takes the name of a type of the library:

```typescriptreact
this.column('ColumnName', MyIntDataType)
this.column('ColumnName', MyEnumDataType)
```

The type name in the generic is the one TypeScript uses; `type` is the one the library uses when the query runs: in the messages of the errors, in [its name as a type](#giving-your-type-by-its-name) and in what a [type adapter](type-adapters.md) and a query runner receive. Without `type`, it's the name of the class (`MyIntDataType`). The class is `abstract`, as its family is. Declare it once and import it where you use it: each declaration is a class of its own, and `is` says yes only to the values of its own class.

The type name is part of the type of the column: another column or expression can be compared with it, or assigned to it, only when it has the same type name. Two classes with the same type name and different TypeScript types are a mistake that nothing detects: give each type a name of its own.

The types of the library have a class too, `BooleanType`, `IntType`, `BigintType`, `DoubleType`, `StringType`, `UuidType`, `StringDecimalType`, `PlainDateType`, `PlainTimeType`, `PlainDateTimeType`, `InstantType`, `ZonedDateTimeType`, `DurationType`, `LocalDateType`, `LocalTimeType` and `LocalDateTimeType`, exported by `ts-sql-query` like the families. A method that takes a type takes its class too, so `this.column('ColumnName', IntType)` is the same column as `this.column('ColumnName', 'int')`.

Each of these classes has a type guard, `is`, that says whether a value source, like a column or an expression, is of its type: `MyIntDataType.is(value)`. A class with more than one type, like a family, says yes to any of its types: `IntegersType.is(value)` is true for a `bigint` and for every integer of yours. A condition made by an `*IfValue` method is a `boolean` there. The value source keeps its source and its optionality: from a union of value sources, `is` leaves the ones of its type, and a value source of a wider type, like a `NumberType` asked with `IntType.is`, becomes one of the type asked. A value that may not be a value source is asked with `instanceof` (`value instanceof IntType`), which says only its class.

## The families

The family the class extends says which operations the column offers in a query, its type in the database (its [SQL data type](sql-data-types.md)), and how its values are converted:

| Family | What its values can do | Its values are converted as |
|---|---|---|
| `IntegersType` | An integer: added, subtracted, multiplied, compared | An `int`, or a `bigint` when its SQL data type doesn't fit in a `number` (see below) |
| `DecimalsType` | An exact decimal: also rounded; what can't be exact gives a `double` | A decimal number as text: see [Exact decimals](../../configuration/data-types.md#exact-decimals) |
| `RealsType` | A floating point number: also divided and rounded, with the mathematical functions | `double` |
| `AdditiveType` | A number only added and subtracted, like a sum of money | Not converted |
| `MultipliableType` | Also multiplied | Not converted |
| `DivisibleType` | Also divided | Not converted |
| `UuidsType` | A UUID | `uuid` |
| `PlainDatesType`, `PlainTimesType`, `PlainDateTimesType` | A date, a time, both, as Temporal values | `plainDate`, `plainTime`, `plainDateTime` |
| `InstantsType` | An exact moment, as a `Temporal.Instant`, ordered by its moment | `instant` |
| `ZonedDateTimesType` | An exact moment in a time zone, as a `Temporal.ZonedDateTime`, ordered by its instant (Oracle only) | `zonedDateTime` |
| `DurationsType` | A length of time, as a `Temporal.Duration`, compared for equality | `duration` |
| `LocalDatesType`, `LocalTimesType`, `LocalDateTimesType` | A date, a time, both, as a `Date` | `localDate`, `localTime`, `localDateTime` |
| `EnumType` | One of a list of values, compared for equality | Not converted |
| `EqualableType` | Compared for equality | Not converted |
| `ComparableType` | Also ordered, like `lessThan` and `between` | Not converted |

A type of yours works only with values of its own type: `add`, `equals`, `minValue` and the rest take and give that type. To combine it with other values, like multiplying cents by a plain number, see [Combining your type with other values](branded-and-opaque-types.md#combining-your-type-with-other-values).

So an int with a TypeScript brand needs nothing else; its values are checked and converted as those of an `int`:

```typescriptreact
declare const centsBrand: unique symbol
type Cents = number & { readonly [centsBrand]: true }

abstract class CentsType extends IntegersType<Cents, 'Cents'> {
    static override readonly type = 'Cents'
}

costCents = this.column('cost_cents', CentsType)
```

## Its type in the database

Each class has a type in the database by default, its SQL data type, which says what its values are there: the one of its family, in its static `sqlDataType`. An integer of yours is an integer of 4 bytes, like an `int`, a `RealsType` a floating point number, a `UuidsType` a uuid; a family whose values only you know, like `EqualableType`, `ComparableType` or `AdditiveType`, has none, and its values are sent as their value in JavaScript. The query runners send and read every value of the type by it, also a constant or a computed value like `cost.add(1)`. The SQL data type of each family is in [The SQL data type of a data type](sql-data-types.md#the-sql-data-type-of-a-data-type).

A class of yours says another one with `static override readonly sqlDataType`. For an integer, the size decides the value in your code: one that fits in a `number` (up to 6 bytes, or 15 digits) is a `number`, and a wider one a `bigint`, which keeps every digit:

```typescriptreact
declare const downloadsBrand: unique symbol
type Downloads = bigint & { readonly [downloadsBrand]: true }

abstract class DownloadsType extends IntegersType<Downloads, 'Downloads'> {
    static override readonly type = 'Downloads'
    static override readonly sqlDataType: SqlDataType = { family: 'exact numeric', scale: 0, bytes: 8 }
}
```

The TypeScript type has to be the one of that value: a `bigint` for an integer wider than a `number`.

An integer wider than the integer types of the databases, like `{ family: 'exact numeric', precision: 30, scale: 0 }`, keeps every digit too: it's read, compared, computed and summed as an exact number. SQLite, whose integers have 64 bits, keeps it as its text, as an [exact decimal](../../configuration/supported-databases/sqlite.md#exact-decimals-the-decimal-strategies).

## Its conversions: a type adapter in the class

The class of a data type converts its values as a [type adapter](type-adapters.md) does, with statics of the same names and parameters: `transformValueToDB` for a value sent, `transformValueFromDB` for a value read, and, optionally, `transformPlaceholder` and `transformProjection` for the SQL of the parameter and of the value read. By default they convert nothing and call `next`, the conversion of the library; a class of yours overrides the ones it needs with `static override`. They apply to every value of the type, in every column, constant, fragment and argument, after the type adapter of the column, if it has one: the conversion goes with the type wherever it's used. [A value of a class of yours](branded-and-opaque-types.md#a-value-of-a-class-of-yours) has a class that converts its values, and [The context of a conversion](conversion-context.md) what each step of the conversion sees.

!!! important

    Register the conversion of a type whose family doesn't convert it (`AdditiveType`, `MultipliableType`, `DivisibleType`, `EnumType`, `EqualableType` and `ComparableType`), and of a type whose values in your code aren't those its family converts, like a date kept as its text. Without it, such a value is returned as it comes, and that depends on where it comes from: from a plain column you get what the driver gives, which can be different in each driver, and from [an array aggregate](../../queries/aggregate-as-object-array.md#how-the-values-go-through-json) you get what is in the JSON. A number there is its text, so that no digit is lost, and it's the conversion that decides what to do with it.

The conversion can also be written in the connection, for every type it applies to, or in a type adapter of one column: see [Type adapters](type-adapters.md).

## Giving your type by its name

A column takes your type by its class. It can take it by its type name too, as a type of the library (`'int'`): register the class with `registerDataType`, in the module of the class, so it is registered before a table uses it, and declare the name in `DataTypes`, so TypeScript knows the type it gives:

```typescriptreact
import { IntegersType, registerDataType } from 'ts-sql-query'

export abstract class CentsType extends IntegersType<Cents, 'Cents'> {
    static override readonly type = 'Cents'
}

registerDataType(CentsType)

declare module 'ts-sql-query' {
    interface DataTypes {
        Cents: CentsType
    }
}
```

Then the name goes wherever a type goes: a column, `this.column('cost_cents', 'Cents')`, a constant, `connection.const(price, 'Cents')`, a fragment, an argument, the type a type adapter requests, `setRequestedType('Cents')`, and a field of a [dynamic condition](../../dynamic/helper-types/conditions.md), `DynamicCondition<{ cost: 'Cents' }>`. A column given the name is the one given the class: the same type, the same SQL and the same parameters.

The name is the `static type` of the class, which the class must say: without it, the class is named after the name of its class, which a minifier can change, and registering it is an error, `DATA_TYPE_WITHOUT_TYPE_NAME`. A name is registered once: registering the same class again does nothing, and another class with a name already registered, also the name of a type of the library, is an error, `DATA_TYPE_ALREADY_REGISTERED`. A name that isn't in `DataTypes` doesn't compile, and one that is but nobody registered is an error when it is used, `UNKNOWN_DATA_TYPE`.
