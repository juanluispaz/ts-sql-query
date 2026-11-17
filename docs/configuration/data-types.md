---
search:
  boost: 0.55
---
# Data types

Each column you [map](mapping.md) has a type, which decides two things: the TypeScript type of its values, and the operations a query offers for it. This page has the types, which one to choose, and how each one is sent to the database; to convert the values in your own way on their way to and from the database, see [Type adapters](../advanced/type-adapters.md).

## The types of a column

The same types are used for a [constant](../queries/basic-query-structure.md) and a [SQL fragment](../queries/sql-fragments.md).

| Column type                     | TypeScript Type      | Description                                                       |
|---------------------------------|----------------------|-------------------------------------------------------------------|
| `boolean`                       | `boolean`            | Boolean value                                                     |
| `int`                           | `number`             | Integer number                                                    |
| `bigint`                        | `bigint`             | BigInt number                                                     |
| `double`                        | `number`             | Floating point number                                             |
| `string`                        | `string`             | String value                                                      |
| `uuid`                          | `string`             | UUID value                                                        |
| `stringDecimal`                 | `string`             | Exact decimal number, sent and read as its text                   |
| `localDate`                     | `Date`               | Date without time                                                 |
| `localTime`                     | `Date`               | Time without date                                                 |
| `localDateTime`                 | `Date`               | Date with time                                                    |
| A class of yours                | *yours*              | Your type, with the operations of the family it extends: see [Your own types](#your-own-types) |

A column is defined with these types as follows, and each method of [Kinds of columns](mapping.md#kinds-of-columns) takes them in the same way:

```typescriptreact
this.column('ColumnName', 'boolean')
this.column('ColumnName', 'int')
this.column('ColumnName', 'bigint')
this.column('ColumnName', 'double')
this.column('ColumnName', 'string')
this.column('ColumnName', 'uuid')
this.column('ColumnName', 'stringDecimal')
this.column('ColumnName', 'localDate')
this.column('ColumnName', 'localTime')
this.column('ColumnName', 'localDateTime')
this.column('ColumnName', MyIntDataType)
this.column('ColumnName', MyEnumDataType)
```

A type of yours is a class that extends the family of what its values can do, declared once and used wherever a value of that type goes: in each column, [constant](../queries/basic-query-structure.md), [SQL fragment](../queries/sql-fragments.md) and argument of a fragment. The family takes two generic arguments, your TypeScript type and its type name, and the class says the type name again in `type`:

```typescriptreact
import { IntegersType, EnumType } from 'ts-sql-query'

abstract class MyIntDataType extends IntegersType<MyIntType, 'MyIntTypeName'> {
    static override readonly type = 'MyIntTypeName'
}
abstract class MyEnumDataType extends EnumType<MyEnumType, 'MyEnumTypeName'> {
    static override readonly type = 'MyEnumTypeName'
}
```

The type name in the generic is the one TypeScript uses; `type` is the one the library uses when the query runs: in the messages of the errors, in [its name as a type](#giving-your-type-by-its-name) and in what a [type adapter](../advanced/type-adapters.md) and a query runner receive. Without `type`, it's the name of the class (`MyIntDataType`). The class is `abstract`, as its family is. Declare it once and import it where you use it: each declaration is a class of its own, and `is` says yes only to the values of its own class.

The type name is part of the type of the column: another column or expression can be compared with it, or assigned to it, only when it has the same type name. Two classes with the same type name and different TypeScript types are a mistake that nothing detects: give each type a name of its own.

The built-in types have a class too, `BooleanType`, `IntType`, `BigintType`, `DoubleType`, `StringType`, `UuidType`, `StringDecimalType`, `LocalDateType`, `LocalTimeType` and `LocalDateTimeType`, exported by `ts-sql-query` like the families. A method that takes a type takes its class too, so `this.column('ColumnName', IntType)` is the same column as `this.column('ColumnName', 'int')`.

Each of these classes has a type guard, `is`, that says whether a value source, like a column or an expression, is of its type: `MyIntDataType.is(value)`. A class with more than one type, like a family, says yes to any of its types: `IntegersType.is(value)` is true for a `bigint` and for every integer of yours. A condition made by an `*IfValue` method is a `boolean` there. The value source keeps its source and its optionality: from a union of value sources, `is` leaves the ones of its type, and a value source of a wider type, like a `NumberType` asked with `IntType.is`, becomes one of the type asked. A value that may not be a value source is asked with `instanceof` (`value instanceof IntType`), which says only its class.

!!! tip "Generating UUIDs"

    **Which version**: prefer **UUID v7** (timestamp-first, as defined in [RFC 9562](https://www.rfc-editor.org/rfc/rfc9562)) over UUID v4. Because v7 encodes the creation time in its leading bytes, primary keys built on v7 stay roughly time-ordered, which keeps index B-trees compact and reduces write amplification on inserts — without giving up the uniqueness guarantees of a random UUID.

    **Where to generate it**: whichever UUID version you choose, prefer letting the database produce the value as a column `DEFAULT` over generating it in application code. The database is a single authoritative source (which also fixes the timestamp authority for v7), removes the application's runtime dependency on a UUID library, and produces the same shape regardless of which caller issues the `INSERT`. Generate it in the application only when the value must be known before the `INSERT` — for example to reference it in related records inserted in the same transaction or to return it eagerly to a caller. With the `uuid` package the application-side path for v7 is `import { v7 as uuidv7 } from 'uuid'`.

    The generators of each database are on its page: [MariaDB](supported-databases/mariadb.md#uuid-strategies), [MySQL](supported-databases/mysql.md#uuid-strategies), [Oracle](supported-databases/oracle.md#uuid-strategies), [PostgreSQL](supported-databases/postgresql.md#uuid-handling), [SQLite](supported-databases/sqlite.md#uuid-strategies) and [SQL Server](supported-databases/sqlserver.md#uuid-management).

## Which type to choose

Choose by the values your code handles, not only by the type of the column in the database:

| You have | Use | What to know |
|---|---|---|
| A whole number that fits in a JavaScript `number` | `int` | Reading a number past `Number.MAX_SAFE_INTEGER` is rejected with `PRECISION_LOST_RECEIVING_VALUE_FROM_DATABASE`, instead of giving you a rounded value. Sending a number with decimals is rejected too. |
| A whole number that can be larger, like a 64-bit counter | `bigint` | The value in your code is a `bigint`. Some drivers round large integers unless you configure them: see the [query runner](query-runners/index.md#which-one-for-your-database) of your driver. The query is rejected rather than giving you a rounded value. |
| A number with decimals, when a JavaScript `number` is enough | `double` | The value becomes a `number`, whatever the column is. A `decimal` column with more digits than a `number` holds loses them. |
| A decimal number that must stay exact, like money | `stringDecimal` | The value is a `string` with all its digits; what each database keeps is in [Exact decimals](#exact-decimals). |
| The same, with your own type for it, like the one of a decimal library | A class that extends `DecimalsType` | Your type, with a [conversion](#your-own-types) from and to the text of the number. |
| Text | `string` | An empty string [has no value](connection.md#allowing-empty-string) by default. |
| True or false | `boolean` | Oracle and SQL Server store it as a number or a bit, with `0` and `1`. For other representations, like `'Y'` and `'N'`, see [Custom booleans values](../advanced/custom-booleans-values.md). |
| A UUID | `uuid` | It's a `string` in your code, and how it's stored depends on the database, as in the tip above. |
| A date with no time, like a birthday | `localDate` | A `Date` at 10:00 UTC of the day: read it with `getUTCFullYear`, `getUTCMonth` and `getUTCDate`. See [Read the values with the UTC getters](time-zones.md#read-the-values-with-the-utc-getters). |
| A time with no date, like an opening time | `localTime` | A `Date` on 1970-01-01: read it with `getUTCHours`, `getUTCMinutes` and `getUTCSeconds`. |
| A date with time, like the moment something happened | `localDateTime` | A `Date` whose UTC getters are the stored digits, in any zone of your application. This is the type for a column that stores an instant too, like `timestamptz` on PostgreSQL, which gives the instant. See [Time zones](time-zones.md). |
| One of a fixed list of values | `enum` | With a union of your values as its TypeScript type. |
| A value your code gives a type of its own, like an id with a TypeScript brand | A class of the [family](#your-own-types) with the operations it needs | It's converted as its family says, like an `IntegersType` as an `int`. |
| A value that only your code understands, like a JSON document | A class that extends `EqualableType`, or `ComparableType` if the database can order it | With the [conversion registered](#your-own-types). |

On SQLite, with a `localdate` [strategy of dates](supported-databases/sqlite.md#working-with-date-and-time), the default, a `localTime` and a `localDateTime` hold the stored text in their local getters instead: see [Time zones](time-zones.md#the-rule-every-value-in-the-database-is-in-utc).

## Your own types

A type of yours gives a column your own TypeScript type, and its type name identifies it. The family its class extends says which operations the column offers in a query, its type in the database (its [SQL data type](../advanced/sql-data-types.md)), and how its values are converted:

| Family | What its values can do | Its values are converted as |
|---|---|---|
| `IntegersType` | An integer: added, subtracted, multiplied, compared | An `int`, or a `bigint` when its SQL data type doesn't fit in a `number` (see below) |
| `DecimalsType` | An exact decimal: also rounded; what can't be exact gives a `double` | A decimal number as text: see [Exact decimals](#exact-decimals) |
| `RealsType` | A floating point number: also divided and rounded, with the mathematical functions | `double` |
| `AdditiveType` | A number only added and subtracted, like a sum of money | Not converted |
| `MultipliableType` | Also multiplied | Not converted |
| `DivisibleType` | Also divided | Not converted |
| `UuidsType` | A UUID | `uuid` |
| `LocalDatesType`, `LocalTimesType`, `LocalDateTimesType` | A date, a time, both | `localDate`, `localTime`, `localDateTime` |
| `EnumType` | One of a list of values, compared for equality | Not converted |
| `EqualableType` | Compared for equality | Not converted |
| `ComparableType` | Also ordered, like `lessThan` and `between` | Not converted |

A type of yours works only with values of its own type: `add`, `equals`, `minValue` and the rest take and give that type.

So an int with a TypeScript brand needs nothing else; its values are checked and converted as those of an `int`:

```typescriptreact
type Cents = number & { readonly __brand: 'Cents' }

abstract class CentsType extends IntegersType<Cents, 'Cents'> {
    static override readonly type = 'Cents'
}

costCents = this.column('cost_cents', CentsType)
```

An integer of yours is an `int` of 4 bytes. Its class says another size with its SQL data type, and the size decides the value in your code: one that fits in a `number` (up to 6 bytes, or 15 digits) is a `number`, and a wider one a `bigint`, which keeps every digit:

```typescriptreact
type Downloads = bigint & { readonly __brand: 'Downloads' }

abstract class DownloadsType extends IntegersType<Downloads, 'Downloads'> {
    static override readonly type = 'Downloads'
    static override readonly sqlDataType: SqlDataType = { family: 'exact numeric', scale: 0, bytes: 8 }
}
```

The TypeScript type has to be the one of that value: a `bigint` for an integer wider than a `number`.

An integer wider than the integer types of the databases, like `{ family: 'exact numeric', precision: 30, scale: 0 }`, keeps every digit too: it's read, compared, computed and summed as an exact number. SQLite, whose integers have 64 bits, keeps it as its text, as an [exact decimal](supported-databases/sqlite.md#exact-decimals-the-decimal-strategies).

!!! important

    Register the conversion of a type whose family doesn't convert it (`AdditiveType`, `MultipliableType`, `DivisibleType`, `EnumType`, `EqualableType` and `ComparableType`), and of a type whose values in your code aren't those its family converts, like a date kept as its text. Without it, such a value is returned as it comes, and that depends on where it comes from: from a plain column you get what the driver gives, which can be different in each driver, and from [an array aggregate](../queries/aggregate-as-object-array.md#how-the-values-go-through-json) you get what is in the JSON. A number there is its text, so that no digit is lost, and it's the conversion that decides what to do with it.

The conversion is written in the connection, so it applies everywhere that type is used, in the class of the type, or in a type adapter of one column: see [Type adapters](../advanced/type-adapters.md).

### Giving your type by its name

A column takes your type by its class. It can take it by its type name too, as a built-in type (`'int'`): register the class with `registerDataType`, in the module of the class, so it is registered before a table uses it, and declare the name in `DataTypes`, so TypeScript knows the type it gives:

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

Then the name goes wherever a type goes: a column, `this.column('cost_cents', 'Cents')`, a constant, `connection.const(price, 'Cents')`, a fragment, an argument, the type a type adapter requests, `setRequestedType('Cents')`, and a field of a [dynamic condition](../dynamic/helper-types/conditions.md), `DynamicCondition<{ cost: 'Cents' }>`. A column given the name is the one given the class: the same type, the same SQL and the same parameters.

The name is the `static type` of the class, which the class must say: without it, the class is named after the name of its class, which a minifier can change, and registering it is an error, `DATA_TYPE_WITHOUT_TYPE_NAME`. A name is registered once: registering the same class again does nothing, and another class with a name already registered, also the name of a built-in type, is an error, `DATA_TYPE_ALREADY_REGISTERED`. A name that isn't in `DataTypes` doesn't compile, and one that is but nobody registered is an error when it is used, `UNKNOWN_DATA_TYPE`.

### Operations of your own in a dynamic filter

A [dynamic filter](../dynamic/caller-decides/filters.md) calls the methods of the data type of each column: `{ birthday: { greaterThan: date } }` is `birthday.greaterThan(date)`. A type of yours has the operations of its family, and its class can offer methods of its own to a filter. Each of these methods gives a condition and has no parameters or one. List them in `[filterOperation]`, a static of the class, with `exposeFilterOperations`, and declare that static on the instance, so the type of the filter has them:

```ts
import { DynamicCondition, LocalDatesType, Table, exposeFilterOperations, filterOperation } from "ts-sql-query"

abstract class BirthdayType extends LocalDatesType<Date, 'Birthday'> {
    static override readonly type = 'Birthday'
    static override readonly [filterOperation] = exposeFilterOperations(this, LocalDatesType, ['isLeapDay', 'inYear'])
    declare [filterOperation]: (typeof BirthdayType)[typeof filterOperation]

    // Born on 29 February
    isLeapDay() {
        return this.getMonth().equals(1).and(this.getDate().equals(29))
    }
    inYear(year: number) {
        return this.getFullYear().equals(year)
    }
}

const tCustomerBirthday = new class TCustomerBirthday extends Table<DBConnection, 'TCustomerBirthday'> {
    id = this.primaryKey('id', 'int')
    birthday = this.optionalColumn('birthday', BirthdayType)
    constructor() {
        super('customer')
    }
}()

const filter: DynamicCondition<{ birthday: BirthdayType }> = {
    birthday: { inYear: 2000, isLeapDay: true }
}

const customers = await connection.selectFrom(tCustomerBirthday)
    .where(connection.dynamicConditionFor({ birthday: tCustomerBirthday.birthday }).withValues(filter))
    .select({ id: tCustomerBirthday.id })
    .executeSelectMany()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select id as id 
    from customer 
    where 
            year(birthday) = ? 
        and (month(birthday) - 1) = ? 
        and (dayofmonth(birthday)) = ?
    ```
=== "MySQL"
    ```mysql
    select id as id 
    from customer 
    where 
            year(birthday) = ? 
        and (month(birthday) - 1) = ? 
        and (dayofmonth(birthday)) = ?
    ```
=== "Oracle"
    ```oracle
    select id as "id" 
    from customer 
    where 
            extract(year from birthday) = :0 
        and (extract(month from birthday) - 1) = :1 
        and extract(day from birthday) = :2
    ```
===+ "PostgreSQL"
    ```postgresql
    select id as id 
    from customer 
    where 
            extract(year from birthday) = $1 
        and (extract(month from birthday) - 1) = $2 
        and extract(day from birthday) = $3
    ```
=== "SQLite"
    ```sqlite
    select id as id 
    from customer 
    where 
            cast(strftime('%Y', birthday) as integer) = ?1 
        and (cast(strftime('%m', birthday) as integer) - 1) = ?2 
        and cast(strftime('%d', birthday) as integer) = ?3
    ```
=== "SQL Server"
    ```sqlserver
    select id as id 
    from customer 
    where 
            datepart(year, birthday) = @0 
        and (datepart(month, birthday) - 1) = @1 
        and datepart(day, birthday) = @2
    ```

The parameters are: `[ 2000, 1, 29 ]`

`exposeFilterOperations` receives the class, the class it extends, whose operations it keeps, and the names of the methods it adds. The compiler checks each name: a method that doesn't give a condition, or has more than one parameter, or an optional one, isn't accepted.

What the filter gives each method:

- A method with a parameter receives the value of the filter, of the type of its parameter: `inYear: 2000` is `inYear(2000)`.
- A method without parameters receives `true` or `false`: `true` applies the condition, `isLeapDay()`, and `false` its negation, `isLeapDay().negate()`.
- A value `null` or `undefined` adds no condition, as with the operations of the library, unless the name of the method is `is` or `isNot` or ends in `IfValue`: those receive it. See [Empty values in a filter](../dynamic/caller-decides/filters.md#empty-values-in-a-filter).

`FilterOf<BirthdayType>`, from `ts-sql-query`, is the type of the filter of the column: the operations of `LocalDatesType` and `isLeapDay` and `inYear`. Without the `declare` line, the type of the filter doesn't have them, but a filter that arrives as data, like one parsed from JSON, can still use them: the class has them. A method that isn't in the list is rejected with `DYNAMIC_CONDITION_UNKNOWN_OPERATION`, and one that gives something that isn't a condition at run time, like a method whose type is `any`, with `DYNAMIC_CONDITION_INVALID_OPERATION_RETURN_TYPE`.

## Exact decimals

JavaScript has no decimal type yet (there is a [proposal](https://github.com/tc39/proposal-decimal) to add one), and a `number` keeps about 16 significant digits. An exact decimal is kept as the text of the number, like `'12345678901234567890.1234567891'`, which keeps all the digits and the scale, like the `0` of `1.50`. There are two types for it, and everything this section says applies to both:

- `stringDecimal`: the value is a `string`. Choose it when a string is enough in your code.
- A class of yours that extends `DecimalsType`: the value has your own TypeScript type, like a branded string or the decimal type of a library of your choice. The conversion from and to the text, if your type isn't a string, goes in a [type adapter](../advanced/type-adapters.md).

```typescriptreact
amount = this.optionalColumn('amount', 'stringDecimal')

type Amount = string & { readonly __brand: 'Amount' }
abstract class AmountType extends DecimalsType<Amount, 'Amount'> {
    static override readonly type = 'Amount'
}
price = this.optionalColumn('price', AmountType)
```

A `stringDecimal` is compared and computed only with another `stringDecimal` or a string, and a decimal of yours only with values of its own type, so the two don't mix.

The text sent to the database uses a point as the decimal separator and has no exponent, like `'-0.25'`; another text, like `'1,50'` or `'1e3'`, is rejected with `INVALID_VALUE_TO_SEND_TO_DATABASE`. A text read from the database is returned as it comes, with a `0` added before a leading point (`.5` is `'0.5'`).

The operations that keep the value exact return the same type, `stringDecimal` or yours: `add`, `subtract`, `multiply`, `modulo`, `abs`, `ceil`, `floor`, `round`, `roundn`, `minValue`, `maxValue` and `sum`. There is no `divide`: the division of two decimals isn't exact, and each database rounds it its own way. The ones whose result can't be exact return a `double`: `power`, `sqrt`, `cbrt`, `exp`, `ln`, `log10`, `logn`, the trigonometric functions and `average`.

A query with a decimal column of yours, here `tExactAmount` with `amount` as a `decimal(38, 10)` and `price` as a `decimal(10, 2)`:

```ts
const rows = await connection.selectFrom(tExactAmount)
    .where(tExactAmount.price.greaterThan('1'))
    .select({
        id: tExactAmount.id,
        amount: tExactAmount.amount,
        next: tExactAmount.amount.add('0.0000000001'),
    })
    .orderBy('id')
    .executeSelectMany()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        amount as amount, 
        amount + cast(? as decimal(11, 10)) as next 
    from exact_amount 
    where price > cast(? as decimal(1, 0)) 
    order by id
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        amount as amount, 
        amount + cast(? as decimal(11, 10)) as next 
    from exact_amount 
    where price > cast(? as decimal(1, 0)) 
    order by id
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        amount as "amount", 
        amount + :0 as "next" 
    from exact_amount 
    where price > :1 
    order by "id"
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        amount as amount, 
        amount + $1 as next 
    from exact_amount 
    where price > $2 
    order by id
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        amount as amount, 
        (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when amount is null then null else decimal_add(amount, ?1) end as tsq_v)) as next 
    from exact_amount 
    where decimal_cmp(price, ?2) > 0 
    order by id
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        convert(nvarchar(41), amount) as amount, 
        convert(nvarchar(41), amount + cast(@0 as decimal(11, 10))) as next 
    from exact_amount 
    where price > cast(@1 as decimal(1, 0)) 
    order by id
    ```

The parameters are: `[ '0.0000000001', '1' ]`

For a row with the amount `12345678901234567890.1234567891` and the price `1.50`, the row read is `{ id: 1, amount: '12345678901234567890.1234567891', next: '12345678901234567890.1234567892' }`. On SQLite the query uses functions you register in the connection of the driver: see below.

What each database keeps, for a `decimal(38, 10)` and a `decimal(10, 2)` column:

| Database | Reading a value | Sending a value | Adding, comparing and ordering |
|---|---|---|---|
| MariaDB, MySQL | All the digits, with the scale of the column: `'1.50'` | As text, written as `cast(? as decimal(P, S))` with the digits of the value where it isn't assigned to a column; a value wider than `decimal(65, 30)` is rejected | Exact |
| Oracle | All the digits, without the zeros at the end of the decimals: `'1.5'` for `1.50` | As text; a value of more than 38 significant digits is rejected | Exact |
| PostgreSQL | All the digits, with the scale of the column: `'1.50'` | As a `numeric` | Exact |
| SQLite | By default, the canonical text: `'1.5'` for `1.50`; with a strategy without the canonical text, the text stored | By default, the canonical text; otherwise the text, as it is | Exact or rejected, by the decimal strategy: see below |
| SQL Server | All the digits, with the scale of the column: `'1.50'`; the outermost query converts the value to text with `convert(nvarchar(41), …)` | As an `nvarchar`, written as `cast(@0 as decimal(P, S))` with the digits of the value where it isn't assigned to a column; a value wider than `decimal(38)` is rejected | Exact |

In every database, an exact decimal of yours in an [array aggregate](../queries/aggregate-as-object-array.md) is read from the JSON with all its digits.

On SQL Server the conversion to text goes only in the select that returns the rows, so the database compares, groups and orders the numbers, not their text. An order by of a converted column is written with its expression, and a compound query, or a `selectDistinctFrom` ordered by a converted column, is wrapped in a select that converts the columns:

```sql
select o_1_.id as id, convert(nvarchar(41), o_1_.shifted) as shifted from (select id as id, price + cast(@0 as decimal(1, 0)) as shifted from exact_amount where id in (@1, @2) union select id as id, price + cast(@3 as decimal(1, 0)) as shifted from exact_amount where id in (@4, @5)) as o_1_ order by o_1_.shifted
```

If a select adds columns of its own with `customizeQuery({ beforeColumns })`, the wrapping select passes them on too: it selects the converted columns and every column of the wrapped select, where the converted ones have another alias (`price_tsq_raw`).

On MariaDB and MySQL, a text parameter would be computed as a floating point number, and compared as one in an `in` or a `between`; the cast keeps it exact. The widest decimal of these databases has 65 digits, 30 of them decimals: the cast of a value with more gives `999…9` without an error, and no column can hold it, so it's rejected with `INVALID_VALUE_TO_SEND_TO_DATABASE` before the query is sent.

On SQL Server, a text parameter alone would be cut to the width of the text it's converted to, two of them would be joined as texts by `+`, and a modulo rejects it; the cast keeps it a number. The widest decimal of SQL Server has 38 digits: a value with more is rejected with `INVALID_VALUE_TO_SEND_TO_DATABASE` before the query is sent.

Oracle's numbers keep 38 significant digits: a computation with a value of more is rounded without an error, and no column can hold it, so it's rejected with `INVALID_VALUE_TO_SEND_TO_DATABASE` before the query is sent.

Oracle reads the text with a point as the decimal separator, the one the library always sends. A session that uses another separator (`NLS_NUMERIC_CHARACTERS`) rejects the value with `ORA-01722`.

SQLite has no exact decimal type, and a column declared `decimal` turns the text into a floating point number when it stores it: store an exact decimal in a `TEXT` column of a `STRICT` table. How the library computes and compares it is the decimal strategy of the connection, and every strategy is exact or rejects the query. By default it writes the functions of SQLite's decimal extension, plain SQL and a few functions of the library, which you register in the connection of the driver, and it stores and reads every value in its canonical text (`1.50` as `1.5`), which compares as text. See [Exact decimals: the decimal strategies](supported-databases/sqlite.md#exact-decimals-the-decimal-strategies), and [SQLite functions and extensions](supported-databases/sqlite-extensions.md) for registering those functions or loading SQLite's extension.

## How a value is sent to the database

Each parameter of a query goes with its type, the one requested for it: by default the type of its column or value, or the one a type adapter requests with `setRequestedType`, like a `string` for a date sent as its text. That type decides which SQL type the parameter has in the databases where the library declares one:

| Type | PostgreSQL type, where the query needs one | SQL Server parameter type |
|---|---|---|
| `boolean` | `bool` | `bit` |
| `int`, `IntegersType` of 4 bytes, its default | `int4` | `int` |
| `bigint`, `IntegersType` of 8 bytes | `int8` | `bigint` |
| `double`, `RealsType` | `float8` | `float` |
| `stringDecimal`, `DecimalsType` | `numeric` | `nvarchar`, the text |
| `string` | `text` | `nvarchar` |
| `uuid`, `UuidsType` | `uuid` | `uniqueidentifier` |
| `localDate`, `LocalDatesType` | `date` | `date` |
| `localTime`, `LocalTimesType` | `time` | `time` |
| `localDateTime`, `LocalDateTimesType` | `timestamp` | `datetime2` |
| A type of yours whose family converts nothing, like `EnumType`, `EqualableType` or `ComparableType` | By the value: `int4` or `int8` for a whole number, `float8` for one with decimals, `int8` for a `bigint`, and none otherwise | By the value, and a text always as `nvarchar` |

PostgreSQL gets the type only where it can't tell it from the rest of the query, like a constant selected on its own or a row of [`Values`](mapping.md#mapping-constant-values-as-view). How it gets it depends on the query runner: `pg` and Bun SQL write it as a cast in the SQL (`select $1::int4 as result`); postgres.js and PGlite send the parameter with its type, and the SQL has no cast (`select $1 as result`). A `null` of one of these types is a parameter too, with its type: `$1::int4` with the parameter `null` on `pg`. Oracle declares it for a `null` of a number, a date or a time, and for a date or a time returned with `returning`: `NUMBER` or `TIMESTAMP`, as the driver sends their values. On MariaDB, MySQL and SQLite, and on Oracle for the rest, the driver sends each value as JavaScript gives it.

So the type also says how big the value can be in the database: an integer of yours is a 32-bit integer, like an `int`, unless its class says another SQL data type, like 64 bits; a `RealsType` is a floating point number, and an exact decimal a [`DecimalsType`](#exact-decimals).

For a type the library doesn't know, like an enum of the database, say its SQL data type in its class (next section). The query runners of postgres.js, PGlite, SQL Server and Oracle also take `driverTypeOf`, a function that gives the type of the driver a parameter is sent with, for what only that driver has; each query runner's page has its shape.

## The type of the column in the database

The data type says what a value is in TypeScript; it doesn't say what the column is in the database: a `string` can be a `varchar(20)` or an `nvarchar(max)`. Tell it, and the library and the query runners use it where it gives a better query, on every driver of the database: on SQL Server an ASCII text of a `varchar` column is sent as a `varchar`, so the index of the column is sought instead of scanned; on Oracle a `CLOB` column given back by a `returning` arrives whole. The value given to the column and the values compared with it take it.

The recommended way is to write the type as you see it in the database, and let a connection turn it into what the library reads, with `sqlDataTypeFrom`. `typesConnection` is a connection of your connection class that executes nothing, made once in a module the tables import (see [how to create it](../advanced/sql-data-types.md#from-the-name-of-the-type-in-the-database-recommended)):

```ts
import { withSqlDataType } from "ts-sql-query"

class TProduct extends Table<DBConnection, 'TProduct'> {
    id = this.autogeneratedPrimaryKey('id', 'int')
    code = this.column('code', 'string', withSqlDataType(typesConnection.sqlDataTypeFrom('varchar(20)')))
    constructor() {
        super('product')
    }
}
```

Leave `driverTypeOf` of a query runner for a type only one driver has. Everything else, the families of the types, writing the type as an object and what each database does with it, is in [The type of a column in the database](../advanced/sql-data-types.md).
