---
search:
  boost: 0.3
---
# Data types API

This page documents what a class of a data type has and what a data type of yours can use: the families it extends, the statics of its class, the methods its own methods can call, registering it by its name, exposing its operations to a dynamic filter, and the types to write its signatures. To learn what a data type of yours is for and how to write one, see [Data types of your own](../advanced/data-types/own-data-types.md).

!!! info

    The families, the classes of the types of the library, `registerDataType`, `exposeFilterOperations`, `filterOperation` and the types of this page (`DataTypes`, `DataTypeName`, `FilterOf`, `ValueSource`, `SourceOf`, `OptionalityOf`, `DataTypeOf`, `CombinedOptionality`, `OperandOf`, `IfValueSource`) are exported from `ts-sql-query`.

## The families

A data type of yours extends one of these classes, with two generic arguments: the TypeScript type of its values, and its type name, a string literal that the class says again in `static type`. All of them are `abstract`.

| Family | Extends | What it adds |
|---|---|---|
| `EqualableType<VALUE_TYPE, TYPE_NAME>` | | Equality: `equals`, `notEquals`, `is`, `isNot`, `in`, `notIn`, and what every value has, like `isNull` and `valueWhenNull` |
| `EnumType<VALUE_TYPE, TYPE_NAME>` | `EqualableType` | Nothing: one of a list of values |
| `ComparableType<VALUE_TYPE, TYPE_NAME>` | `EqualableType` | Order: `lessThan`, `greaterOrEqual`, `between`, ... |
| `ArithmeticType<VALUE_TYPE, TYPE_NAME>` | `ComparableType` | Nothing: the root of the numbers, for `ArithmeticType.is(value)` |
| `AdditiveType<VALUE_TYPE, TYPE_NAME>` | `ArithmeticType` | `add`, `subtract`, `abs`, `sign`, `minValue`, `maxValue`, `modulo`; its columns can be summed and averaged (`sum`, `average` of the connection) |
| `MultipliableType<VALUE_TYPE, TYPE_NAME>` | `AdditiveType` | `multiply` |
| `IntegersType<VALUE_TYPE, TYPE_NAME>` | `MultipliableType` | Its values converted as integers |
| `DecimalsType<VALUE_TYPE, TYPE_NAME>` | `MultipliableType` | Rounding, which keeps the value exact, and the mathematical functions, which give a `double`; its values converted as exact decimals |
| `DivisibleType<VALUE_TYPE, TYPE_NAME>` | `MultipliableType` | `divide` |
| `RealsType<VALUE_TYPE, TYPE_NAME>` | `DivisibleType` | Rounding and the mathematical functions; its values converted as `double` |
| `UuidsType<VALUE_TYPE, TYPE_NAME>` | `ComparableType` | The operations of a text on its text; its values converted as `uuid` |
| `LocalDatesType<VALUE_TYPE, TYPE_NAME>` | `ComparableType` | The parts of a date, like `getFullYear`; its values converted as `localDate` |
| `LocalTimesType<VALUE_TYPE, TYPE_NAME>` | `ComparableType` | The parts of a time; its values converted as `localTime` |
| `LocalDateTimesType<VALUE_TYPE, TYPE_NAME>` | `ComparableType` | The parts of a date and a time; its values converted as `localDateTime` |

The methods of each family, with their signatures, are in the [Value expressions API](value-expressions.md); what each family is for, in [The families](../advanced/data-types/own-data-types.md#the-families).

The types of the library are classes too, and a method that takes a type takes them where it takes the name: `BooleanType` (`'boolean'`), `IntType` (`'int'`), `DoubleType` (`'double'`), `BigintType` (`'bigint'`, an `IntegersType<bigint, 'bigint'>`), `StringType` (`'string'`), `UuidType` (`'uuid'`, a `UuidsType<string, 'uuid'>`), `StringDecimalType` (`'stringDecimal'`, a `DecimalsType<string, 'stringDecimal'>`), `LocalDateType`, `LocalTimeType` and `LocalDateTimeType` (`'localDate'`, `'localTime'`, `'localDateTime'`, of the families of the dates with `Date`). An `int` and a `double` work together: each one takes the other as an operand.

## The statics of a class of a data type

```typescript
// The statics every class of a data type has, inherited from the root of the data types
interface DataTypeClassStatics {
    /** The type name the library knows the type by at run time; by default, the name of the class */
    readonly type: string
    /** The type of its values in the database; undefined for a type whose values only you know */
    readonly sqlDataType: SqlDataType | undefined

    /** Whether a value source is of this type; it narrows the value source to it */
    is(value: unknown): boolean

    // The conversions of its values, which by default convert nothing and call `next`
    transformValueFromDB(value: unknown, context: TypeAdapterValueFromDBContext, next: DefaultTypeAdapter): unknown
    transformValueToDB(value: unknown, context: TypeAdapterValueToDBContext, next: DefaultTypeAdapter): unknown
    transformPlaceholder(placeholder: string, context: TypeAdapterPlaceholderContext, next: DefaultTypeAdapter): string
    transformProjection(sql: string, context: TypeAdapterProjectionContext, next: DefaultTypeAdapter): string
}
```

- `type`: a class of yours says it with `static override readonly type = 'Money'`, the same as the type name of its generic. It's the name in the messages of the errors, the one [`registerDataType`](#registering-a-type-by-its-name) registers, and the one a type adapter and a query runner read in `originalType.type` and `requestedType.type`. Without it, it's the name of the class, which a minifier can change.
- `sqlDataType`: the family gives one (an integer of 4 bytes for `IntegersType`, a `double` for `RealsType`, ...), and a class of yours can say another with `static override readonly sqlDataType: SqlDataType = { ... }`. The ones of each family are in [The SQL data type of a data type](../advanced/data-types/sql-data-types.md#the-sql-data-type-of-a-data-type), and the shape of the object in the [SQL data types API](sql-data-types.md).
- `is(value)`: a type guard. It says yes to the value sources of the class and of the classes that extend it: `IntegersType.is(value)` is true for a `bigint` and for every integer of yours. The value source keeps its source and its optionality. See [The class](../advanced/data-types/own-data-types.md#the-class).
- The conversions: a class of yours overrides the ones it needs with `static override`. Where each one goes in the chain of conversions of a value, and what `next` is, are in [The conversion of the class of a data type](type-adapters.md#the-conversion-of-the-class-of-a-data-type); what each context has, in [What each context has](type-adapters.md#what-each-context-has).

## The methods for the methods of your own

Inside a class of yours, its methods can call these, which are `protected`: they exist only in the class and in the classes that extend it.

```typescript
// The methods a class of a data type gives its own methods
interface DataTypeProtectedMethods {
    /** A fragment of SQL of a data type, as fragmentWithType of the connection */
    fragmentWithType(type: DataTypeName | DataTypeClass, required: 'required' | 'optional', adapter?: TypeAdapter): DataTypeFragment
    /** A value given to the method, as const of the connection */
    const(value: unknown, type: DataTypeName | DataTypeClass, adapter?: TypeAdapter): ValueSource<any, any>
    /** A value that can be null, as optionalConst of the connection */
    optionalConst(value: unknown, type: DataTypeName | DataTypeClass, adapter?: TypeAdapter): ValueSource<any, any>
}

interface DataTypeFragment {
    /** The SQL, with up to 7 values: `this`, or a value source of any data type */
    sql(sql: TemplateStringsArray, ...values: unknown[]): ValueSource<any, any>
}
```

- `fragmentWithType(type, required, adapter?)`: the type of the result, by its name or its class; `'required'` or `'optional'`; and, optionally, a type adapter for the result. Its `sql` takes the SQL as a template, `` sql`${this} / 100.0` ``, with up to 7 values: `this`, the value source the method is called on, or any value source. The result is a value source of the type given, whose source is the sources of the values: the one of the column the method is called on, when it has `this`.
- `const(value, type, adapter?)` and `optionalConst(value, type, adapter?)`: a value of the type given, by its name or its class, which goes in the SQL as a parameter. The value of `const` is of the TypeScript type of that type; the one of `optionalConst` can be `null` or `undefined` too.

An example is in [SQL of your own in a method](../advanced/data-types/methods-of-your-own.md#sql-of-your-own-in-a-method).

## Registering a type by its name

```typescript
// The registration of a data type of yours, exported by ts-sql-query as a function
interface DataTypeRegistration {
    registerDataType(dataType: DataTypeClass): void
}
```

`registerDataType(MoneyType)` registers a class of yours by its type name, so a column, a constant, a fragment, an argument, `setRequestedType` and a field of a dynamic condition take the name, `'Money'`, where they take the class. Call it in the module of the class, so the class is registered before a table uses it. For TypeScript, declare the name in the interface `DataTypes`, with a module augmentation:

```typescriptreact
declare module 'ts-sql-query' {
    interface DataTypes {
        Money: MoneyType
    }
}
```

`DataTypeName` is the union of the names of `DataTypes`: the ones of the library (`'int'`, `'string'`, ...) and the ones you declare.

| Situation | Result |
|---|---|
| The same class registered again | Nothing happens |
| Another class with a name already registered, also one of the library like `int` | `TsSqlProcessingError`, reason `DATA_TYPE_ALREADY_REGISTERED` |
| A class without a `static type` of its own | `TsSqlProcessingError`, reason `DATA_TYPE_WITHOUT_TYPE_NAME` |
| A name in `DataTypes` that nobody registered, when it's used | `TsSqlProcessingError`, reason `UNKNOWN_DATA_TYPE` |
| A name that isn't in `DataTypes` | Doesn't compile |

See [Giving your type by its name](../advanced/data-types/own-data-types.md#giving-your-type-by-its-name).

## The operations of a type in a dynamic filter

```typescript
// How a class exposes methods of its own to a dynamic filter, with exposeFilterOperations, exported by ts-sql-query
interface DataTypeFilterOperations {
    exposeFilterOperations(dataType: DataTypeClass, family: DataTypeClass | undefined, names: readonly string[], aliases?: { readonly [alias: string]: string }): unknown
}
```

A class says the operations a filter can call on its columns in its static `[filterOperation]`, and declares it on its instances, so the type of the filter has them:

```ts
abstract class BirthdayType extends LocalDatesType<Date, 'Birthday'> {
    static override readonly type = 'Birthday'
    static override readonly [filterOperation] = exposeFilterOperations(this, LocalDatesType, ['isLeapDay'], { leapDay: 'isLeapDay' })
    declare [filterOperation]: (typeof BirthdayType)[typeof filterOperation]

    isLeapDay() {
        return this.getMonth().equals(1).and(this.getDate().equals(29))
    }
}
```

- `dataType`: the class itself, `this` in its static.
- `family`: the class it extends, whose operations it keeps; `undefined` keeps none.
- `names`: the methods of the class it adds. The compiler checks each one: a method that doesn't give a condition, or has more than one parameter, or an optional one, isn't accepted.
- `aliases`: other names a filter can use for those methods, or for the ones of the family, which `withValues` applies and the type of the filter doesn't offer, like the name a method had before it was renamed. A name the class or its family exposes wins over an alias with that name, and a class keeps the aliases of its family.

`FilterOf<DataType>` is the type of the filter of a column of that data type: an optional property for each operation, with the value its method takes, or a `boolean` for a method without parameters (`true` applies the condition, `false` its negation).

| Situation | Result |
|---|---|
| A filter with an operation the class doesn't expose | `TsSqlProcessingError`, reason `DYNAMIC_CONDITION_UNKNOWN_OPERATION` |
| An exposed method that gives something that isn't a condition at run time, like one typed `any` | `TsSqlProcessingError`, reason `DYNAMIC_CONDITION_INVALID_OPERATION_RETURN_TYPE` |

See [Operations of your own in a dynamic filter](../advanced/data-types/methods-of-your-own.md#operations-of-your-own-in-a-dynamic-filter).

## The types to write the signatures

| Type | What it is |
|---|---|
| `ValueSource<Source, DataType, Optionality>` | A value of a data type in a query |
| `SourceOf<X>` | The tables and views the value reaches, which the query must have |
| `OptionalityOf<X>` | Whether the value can be missing: `'required'`, `'optional'`… |
| `DataTypeOf<X>` | The class of the data type of the value |
| `CombinedOptionality<A, B>` | The optionality of a value computed from two: optional when one of them is |
| `OperandOf<DataType>` | A value the data type works with: its own, or of the group it belongs to (an `int` and a `double`); `OperandOf<this>` in its class |
| `IfValueSource<Source, Optionality>` | A condition, like the one `equals` gives |

The result of a method keeps the source of every value it takes: `ValueSource<SourceOf<this> | SourceOf<VALUE>, ...>`. That is what makes a query reject a value of a table it doesn't have, or of another database. An example is in [Combining your type with other values](../advanced/data-types/branded-and-opaque-types.md#combining-your-type-with-other-values).
