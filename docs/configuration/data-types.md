---
search:
  boost: 0.55
---
# Data types

Each column you [map](mapping.md) has a type, which decides two things: the TypeScript type of its values, and the operations a query offers for it. This page has the types and which one to choose; a type of your own, its methods, and converting the values in your own way are in [Data types of your own](../advanced/data-types/own-data-types.md) and the pages next to it.

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
| `dnumDecimal`                   | `Dnum`               | Exact decimal number, as a [dnum](https://github.com/bpierre/dnum) |
| `ScaledBigInt<2>`, with the scale of the column | `ScaledBigInt<2>` | Exact decimal number of a fixed scale, as a `bigint`: `150n` is `1.50` (see [Scaled bigints](#scaled-bigints)) |
| `plainDate`                     | `Temporal.PlainDate` | Date without time, as a Temporal value                            |
| `plainTime`                     | `Temporal.PlainTime` | Time without date, as a Temporal value                            |
| `plainDateTime`                 | `Temporal.PlainDateTime` | Date with time, as a Temporal value                           |
| `plainYearMonth`                | `Temporal.PlainYearMonth` | Month of a year, as a Temporal value                         |
| `plainMonthDay`                 | `Temporal.PlainMonthDay` | Day of a month, as a Temporal value                           |
| `instant`                       | `Temporal.Instant`   | Exact moment, as a Temporal value                                 |
| `zonedDateTime`                 | `Temporal.ZonedDateTime` | Moment in a time zone, as a Temporal value                    |
| `duration`                      | `Temporal.Duration`  | Length of time, as a Temporal value                               |
| `localDate`                     | `Date`               | Date without time, as a `Date`                                    |
| `localTime`                     | `Date`               | Time without date, as a `Date`                                    |
| `localDateTime`                 | `Date`               | Date with time, as a `Date`                                       |
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
this.column('ColumnName', 'dnumDecimal')
this.column('ColumnName', 'ScaledBigInt<2>')
this.column('ColumnName', 'plainDate')
this.column('ColumnName', 'plainTime')
this.column('ColumnName', 'plainDateTime')
this.column('ColumnName', 'plainYearMonth')
this.column('ColumnName', 'plainMonthDay')
this.column('ColumnName', 'instant')
this.column('ColumnName', 'zonedDateTime')
this.column('ColumnName', 'duration')
this.column('ColumnName', 'localDate')
this.column('ColumnName', 'localTime')
this.column('ColumnName', 'localDateTime')
this.column('ColumnName', UnitsType)
```

The types of the library have a class too, `BooleanType`, `IntType`, `BigintType`, `DoubleType`, `StringType`, `UuidType`, `StringDecimalType`, `DnumDecimalType`, `PlainDateType`, `PlainTimeType`, `PlainDateTimeType`, `PlainYearMonthType`, `PlainMonthDayType`, `DurationType`, `InstantType`, `ZonedDateTimeType`, `LocalDateType`, `LocalTimeType` and `LocalDateTimeType`, exported by `ts-sql-query`, and the one of a scaled bigint of a scale is `ScaledBigIntType.of(2)`. A method that takes a type takes its class too, so `this.column('ColumnName', IntType)` is the same column as `this.column('ColumnName', 'int')`, and `this.column('ColumnName', 'ScaledBigInt<2>')` the same as `this.column('ColumnName', 'ScaledBigInt<2>')`.

!!! tip "Generating UUIDs"

    **Which version**: prefer **UUID v7** (timestamp-first, as defined in [RFC 9562](https://www.rfc-editor.org/rfc/rfc9562)) over UUID v4. Because v7 encodes the creation time in its leading bytes, primary keys built on v7 stay roughly time-ordered, which keeps index B-trees compact and reduces write amplification on inserts — without giving up the uniqueness guarantees of a random UUID.

    **Where to generate it**: whichever UUID version you choose, prefer letting the database produce the value as a column `DEFAULT` over generating it in application code. The database is a single authoritative source (which also fixes the timestamp authority for v7), removes the application's runtime dependency on a UUID library, and produces the same shape regardless of which caller issues the `INSERT`. Generate it in the application only when the value must be known before the `INSERT` — for example to reference it in related records inserted in the same transaction or to return it eagerly to a caller. With the `uuid` package the application-side path for v7 is `import { v7 as uuidv7 } from 'uuid'`.

    The generators of each database are on its page: [MariaDB](../databases/mariadb/index.md#uuid-strategies), [MySQL](../databases/mysql/index.md#uuid-strategies), [Oracle](../databases/oracle/index.md#uuid-strategies), [PostgreSQL](../databases/postgresql/index.md#uuid-handling), [SQLite](../databases/sqlite/index.md#uuid-strategies) and [SQL Server](../databases/sqlserver/index.md#uuid-management).

## Which type to choose

Choose by the values your code handles, not only by the type of the column in the database:

| You have | Use | What to know |
|---|---|---|
| A whole number that fits in a JavaScript `number` | `int` | Reading a number past `Number.MAX_SAFE_INTEGER` is rejected with `PRECISION_LOST_RECEIVING_VALUE_FROM_DATABASE`, instead of giving you a rounded value. Sending a number with decimals is rejected too. |
| A whole number that can be larger, like a 64-bit counter | `bigint` | The value in your code is a `bigint`. Some drivers round large integers unless you configure them: see the [query runner](query-runners/index.md#which-one-for-your-database) of your driver. The query is rejected rather than giving you a rounded value. |
| A number with decimals, when a JavaScript `number` is enough | `double` | The value becomes a `number`, whatever the column is. A `decimal` column with more digits than a `number` holds loses them. |
| A decimal number that must stay exact, like money | `stringDecimal` | The value is a `string` with all its digits; what each database keeps is in [Exact decimals](#exact-decimals). |
| The same, to compute with it in your code with the [dnum](https://github.com/bpierre/dnum) library | `dnumDecimal` | The value is a `Dnum`, the integer of its digits and the number of its decimals: `[150n, 2]` is `1.50`. |
| The same, with the decimals of the column fixed, like money in a `decimal(10, 2)`, to compute with integers in your code | `'ScaledBigInt<2>'` | The value is a `ScaledBigInt<2>`, a `bigint` with the scale in its type: `150n` is `1.50`. See [Scaled bigints](#scaled-bigints). |
| The same, with your own type for it, like the one of a decimal library | A class that extends `DecimalsType`, or `DnumDecimalsType` for a dnum | Your type, with a [conversion](../advanced/data-types/branded-and-opaque-types.md#a-value-of-a-class-of-yours) from and to the text of the number, or a dnum of your own. |
| Text | `string` | An empty string [has no value](connection.md#allowing-empty-string) by default. |
| True or false | `boolean` | Oracle and SQL Server store it as a number or a bit, with `0` and `1`. For other representations, like `'Y'` and `'N'`, see [Custom booleans values](../advanced/data-types/custom-booleans-values.md). |
| A UUID | `uuid` | It's a `string` in your code, and how it's stored depends on the database, as in the tip above. |
| A date with no time, like a birthday | `plainDate` | A `Temporal.PlainDate`, the date and nothing else, in any zone of your application. The types of [Dates and times](dates-and-times.md), recommended for dates and times: they need a runtime with `Temporal`, or a polyfill. |
| A time with no date, like an opening time | `plainTime` | A `Temporal.PlainTime`, with every digit of the fraction of a second the database keeps. |
| A date with time, like the moment something happened | `plainDateTime` | A `Temporal.PlainDateTime`, with the digits the database keeps; of a column that stores an instant, like `timestamptz` on PostgreSQL, the date and time it has in the zone of the database. |
| An exact moment in a time zone, like a meeting at 09:00 in Madrid | `zonedDateTime` | A `Temporal.ZonedDateTime`, an instant with its zone; only Oracle keeps it: see [Zoned dates and times](zoned-dates-and-times.md#zoned-dates-and-times). |
| An exact moment, like the one a payment was made | `instant` | A `Temporal.Instant`, the same moment everywhere, with the digits the database keeps; of a column without zone, the instant of its wall clock in the zone of the database: see [Instants](instants.md#instants). |
| A length of time, like how long a task took | `duration` | A `Temporal.Duration`, compared only for equality. PostgreSQL and Oracle keep it in an interval; the other databases as its ISO 8601 text: see [Durations](durations.md#durations). |
| A date with no time as a `Date` | `localDate` | A `Date` at 10:00 UTC of the day: read it with `getUTCFullYear`, `getUTCMonth` and `getUTCDate`. See [Read the values with the UTC getters](dates-as-date.md#read-the-values-with-the-utc-getters). |
| A time as a `Date` | `localTime` | A `Date` on 1970-01-01: read it with `getUTCHours`, `getUTCMinutes` and `getUTCSeconds`. |
| A date with time as a `Date` | `localDateTime` | A `Date` whose UTC getters are the stored digits, in any zone of your application. This is the type for a column that stores an instant too, like `timestamptz` on PostgreSQL, which gives the instant. See [Time zones](time-zones.md). |
| One of a fixed list of values, like a status | A class that extends `EnumType` | With a union of your values as its TypeScript type, compared for equality: see [Your own types](#your-own-types). |
| A value your code gives a type of its own, like an id with a TypeScript brand | A class of the [family](../advanced/data-types/own-data-types.md#the-families) with the operations it needs | It's converted as its family says, like an `IntegersType` as an `int`. |
| A value that only your code understands, like a JSON document | A class that extends `EqualableType`, or `ComparableType` if the database can order it | With the [conversion registered](../advanced/data-types/own-data-types.md#its-conversions-a-type-adapter-in-the-class). |

On SQLite, with a `localdate` [strategy of dates](../databases/sqlite/index.md#working-with-date-and-time), the default, a `localTime` and a `localDateTime` hold the stored text in their local getters instead: see [Time zones](dates-as-date.md#the-rule-every-value-in-the-database-is-in-utc).

## Your own types

A type of yours gives a column your own TypeScript type, like a number of units in stock that your code doesn't mix with other numbers. It is a class that extends a family of the library, which says the operations its values offer in a query and how they are converted. An integer with a TypeScript brand needs nothing else; its values are checked and converted as those of an `int`:

```typescriptreact
import { IntegersType } from 'ts-sql-query'

declare const unitsBrand: unique symbol
type Units = number & { readonly [unitsBrand]: true }

abstract class UnitsType extends IntegersType<Units, 'Units'> {
    static override readonly type = 'Units'
}

stock = this.column('stock', UnitsType)
```

A value of a fixed list, like the status of an issue, is a class that extends `EnumType`, with the union of the values as its TypeScript type and the values themselves in `values`:

```typescriptreact
import { EnumType } from 'ts-sql-query'

type IssueStatus = 'open' | 'in_progress' | 'closed'

abstract class IssueStatusType extends EnumType<IssueStatus, 'IssueStatus'> {
    static override readonly type = 'IssueStatus'
    static override readonly values = ['open', 'in_progress', 'closed'] as const
}

status = this.column('status', IssueStatusType)
```

A column of `IssueStatusType` takes and gives only values of `IssueStatus`, and is compared for equality: `equals`, `notEquals`, `in`, `notIn`, `isNull` and the rest, without an order. Its values are sent and read as they are, with no conversion, so the column keeps the same values as your code, like the text `'open'`; for values kept in another form, like a number for each status, give the class its conversion (see [its conversions](../advanced/data-types/own-data-types.md#its-conversions-a-type-adapter-in-the-class)).

Only the values of `values` are sent and read. A value to send that isn't one of them, like one that came from JSON, is rejected with `INVALID_VALUE_TO_SEND_TO_DATABASE`, and nothing is sent to the database; a value read that isn't one of them, like a status added to the table and not to your code, is rejected with `INVALID_VALUE_RECEIVED_FROM_DATABASE`. A value read in another form, like the text `'2'` of an enumeration of numbers, is given as the value of the list, `2`. `values = null` says that any value goes, with nothing checked; a class without `values` is rejected with `INVALID_CONFIGURATION` when a value of it is sent or read. `IssueStatusType.values` gives the list to your code, like to fill a select of a form.

### A type for a specific use

A type used in a single column doesn't need a class declared apart: its family makes it with `of`, given the type name and what the family needs:

```typescriptreact
import { EnumType, IntegersType } from 'ts-sql-query'

activity = this.column('activity', EnumType.of('WorklogActivity', ['coding', 'review', 'meeting']))
stock = this.column('stock', IntegersType.of<Units, 'Units'>('Units'))
```

`EnumType.of` takes the values, and its TypeScript type is their union, here `'coding' | 'review' | 'meeting'`; with a type of yours and `null` instead of the values, `EnumType.of<IssueStatus, 'IssueStatus'>('IssueStatus', null)`, any value goes. `ScaledBigIntsType.of<Price, 'Price'>('Price', 2)` takes the scale (see [Scaled bigints](#scaled-bigints)), and the other families only the type name. A family gives the same class each time for the same type name, wherever it's written, so two columns with `EnumType.of('WorklogActivity', [...])` have the same type; the same type name with other values or another scale is rejected with `INVALID_CONFIGURATION`. A data type, like `IntType`, has no `of`. A type used in many places is better a class declared once, imported where it's used.

A column of `UnitsType` is compared, computed and assigned only with values of `Units`. Its class also says, as statics, [its type in the database](../advanced/data-types/own-data-types.md#its-type-in-the-database), by default the one of its family (an integer of 4 bytes here), and [how its values are converted](../advanced/data-types/own-data-types.md#its-conversions-a-type-adapter-in-the-class), like a type adapter of the whole type. What else a type of yours can do:

- [Data types of your own](../advanced/data-types/own-data-types.md): the class, the families and what each one does, its type in the database, its conversions as a type adapter in the class, and giving the type by its name, like `'Units'`.
- [Branded and opaque types](../advanced/data-types/branded-and-opaque-types.md): branding a type with a `unique symbol`, a value of a class of yours, and combining your type with other values, like multiplying units by a plain number.
- [Methods of your own](../advanced/data-types/methods-of-your-own.md): a method with SQL of your own, and the operations of your type in a dynamic filter.
- [Type adapters](../advanced/data-types/type-adapters.md): converting the values in your own way, for every column of a type or for one.
- [Data types API](../api/data-types.md): every static, method and type a class of a data type has.

## Exact decimals

JavaScript has no decimal type yet (there is a [proposal](https://github.com/tc39/proposal-decimal) to add one), and a `number` keeps about 16 significant digits. An exact decimal keeps all the digits and the decimals, like the `0` of `1.50`. There are four types for it, and everything this section says applies to all of them:

- `stringDecimal`: the value is the text of the number, a `string` like `'12345678901234567890.1234567891'`. Choose it when a string is enough in your code.
- `dnumDecimal`: the value is a `Dnum`, the representation of the [dnum](https://github.com/bpierre/dnum) library, `readonly [value: bigint, decimals: number]`: the integer of its digits and the number of its decimals, so `[150n, 2]` is `1.50` and `[-5n, 3]` is `-0.005`. Choose it to compute with dnum in your code. The library exports the type `Dnum` and doesn't depend on dnum: the values of dnum are of this type, so they go to the queries and come from them as they are.
- `ScaledBigInt<S>`, the data type `'ScaledBigInt<S>'`: the value is a `bigint` with the scale of the column in its type, so `ScaledBigInt<2>` keeps cents and `150n` is `1.50`. Choose it for a column whose decimals are fixed, like an amount of money in a `decimal(10, 2)`, to compute with integers in your code. At run time the value is a plain `bigint`: the scale is only in its type and in the class of the column. See [Scaled bigints](#scaled-bigints).
- A class of yours that extends `DecimalsType`: the value has your own TypeScript type, like a branded string or the decimal type of a library of your choice. The conversion from and to the text, if your type isn't a string, goes in the class, as in [a value of a class of yours](../advanced/data-types/branded-and-opaque-types.md#a-value-of-a-class-of-yours), or in a [type adapter](../advanced/data-types/type-adapters.md). A class that extends `DnumDecimalsType` has a dnum as its value, like `dnumDecimal`, with a type of yours, like a branded `Dnum`.

```typescriptreact
amount = this.optionalColumn('amount', 'stringDecimal')

total = this.optionalColumn('total', 'dnumDecimal')

type Amount = string & { readonly __brand: 'Amount' }
abstract class AmountType extends DecimalsType<Amount, 'Amount'> {
    static override readonly type = 'Amount'
}
price = this.optionalColumn('price', AmountType)

type Cost = Dnum & { readonly __brand: 'Cost' }
abstract class CostType extends DnumDecimalsType<Cost, 'Cost'> {
    static override readonly type = 'Cost'
}
cost = this.optionalColumn('cost', CostType)

fee = this.optionalColumn('fee', 'ScaledBigInt<2>')
```

A `stringDecimal` is compared and computed only with another `stringDecimal` or a string, a `dnumDecimal` only with another `dnumDecimal` or a `Dnum`, a `ScaledBigInt<2>` only with another `ScaledBigInt<2>` (not one of another scale, nor a plain `bigint`), and a decimal of yours only with values of its own type, so they don't mix.

The text sent to the database uses a point as the decimal separator and has no exponent, like `'-0.25'`; another text, like `'1,50'` or `'1e3'`, is rejected with `INVALID_VALUE_TO_SEND_TO_DATABASE`. A dnum is sent as its text with all its decimals: `[150n, 2]` as `'1.50'`. A dnum whose decimals aren't a whole number of 0 or more, like `[15n, -1]` or `[15n, 0.5]`, is rejected with `INVALID_VALUE_TO_SEND_TO_DATABASE`, as the functions of dnum reject a negative number of decimals. In the database, a value is its number, whatever its decimals: `price.equals([15n, 1])` is true for the price `1.50`. A text read from the database keeps all its digits, with a `0` added before a leading point (`.5` is `'0.5'`); its decimals are the ones of [The decimals of a value read](#the-decimals-of-a-value-read).

The operations that keep the value exact return the same type, `stringDecimal`, `dnumDecimal`, `ScaledBigInt` or yours: `add`, `subtract`, `multiply`, `modulo`, `abs`, `ceil`, `floor`, `round`, `roundn`, `minValue`, `maxValue` and `sum`. A `ScaledBigInt` has no `multiply`: the product of two values of the scale 2 has 4 decimals, which its type can't keep. There is no `divide`: the division of two decimals isn't exact, and each database rounds it its own way. The ones whose result can't be exact return a `double`: `power`, `sqrt`, `cbrt`, `exp`, `ln`, `log10`, `logn`, the trigonometric functions and `average`.

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

### The decimals of a value read

A value read has the decimals of the first of these that knows them:

1. The database. MariaDB, MySQL, PostgreSQL and SQL Server write the scale of the column or of the computation in the text of the value (`1.50` for a `decimal(10, 2)`). Oracle doesn't, but its driver says the scale of a `NUMBER(10, 2)` column, and the value gets it.
2. The [SQL data type](#the-type-of-the-column-in-the-database) of the column, when you declare it with its scale, like `numeric(10, 2)`, where the database doesn't say the decimals: on SQLite, which keeps the text of the value as it is, and on Oracle for a computed value, a value of a `returning` and a value inside an [array aggregate](../queries/aggregate-as-object-array.md).
3. The value received: the decimals of its text. On Oracle a computed value has only the decimals it needs (`price * 2` is `3`), and on SQLite, by default, every value is in its canonical text (`1.5`).

To give a value the decimals of the database or of its SQL data type, zeros are added or removed at the end of its decimals; a digit other than a zero is never removed, so the value never loses a digit: with 3 decimals `1.50` is `1.500`, and with 2 decimals `0.0000000000` is `0.00` and `12345678901234567890.1234567891` stays as it is. The decimals are the same for a `stringDecimal` (`'1.500'`), a `dnumDecimal` (`[1500n, 3]`) and a decimal of yours.

A query with `dnumDecimal` columns, here `tDnumAmount`, the same table as before:

```ts
const rows = await connection.selectFrom(tDnumAmount)
    .where(tDnumAmount.price.greaterOrEqual([15n, 1]))
    .select({
        id: tDnumAmount.id,
        price: tDnumAmount.price,
        twice: tDnumAmount.price.multiply([2n, 0]),
    })
    .orderBy('id')
    .executeSelectMany()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        price as price, 
        price * cast(? as decimal(1, 0)) as twice 
    from exact_amount 
    where price >= cast(? as decimal(2, 1)) 
    order by id
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        price as price, 
        price * cast(? as decimal(1, 0)) as twice 
    from exact_amount 
    where price >= cast(? as decimal(2, 1)) 
    order by id
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        price as "price", 
        price * :0 as "twice" 
    from exact_amount 
    where price >= :1 
    order by "id"
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        price as price, 
        price * $1 as twice 
    from exact_amount 
    where price >= $2 
    order by id
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        price as price, 
        (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select decimal_mul(price, ?1) as tsq_v)) as twice 
    from exact_amount 
    where decimal_cmp(price, ?2) >= 0 
    order by id
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        convert(nvarchar(41), price) as price, 
        convert(nvarchar(41), price * cast(@0 as decimal(1, 0))) as twice 
    from exact_amount 
    where price >= cast(@1 as decimal(2, 1)) 
    order by id
    ```

The parameters are: `[ '2', '1.5' ]`

For the rows with the prices `1.50` and `1234.56`, the rows read are `[{ id: 1, price: [150n, 2], twice: [300n, 2] }, { id: 5, price: [123456n, 2], twice: [246912n, 2] }]`. On Oracle the computed value has the decimals it needs (`[3n, 0]` and `[246912n, 2]`). On SQLite every value has its canonical text (`[15n, 1]` and `[3n, 0]`); a price whose column declares the SQL data type `numeric(10, 2)` is `[150n, 2]` there too.

### Scaled bigints

A `ScaledBigInt<S>` is a `bigint` with its scale in its type: `ScaledBigInt<2>` keeps cents (`150n` is `1.50`). The scale is the number of decimals of the column; a column without decimals is a `bigint`. A negative scale, or one that isn't an integer, is rejected with `INVALID_CONFIGURATION`, and a negative literal doesn't compile. The column says its scale with the type name of its data type, the one TypeScript writes, `'ScaledBigInt<2>'`, which every scale has without registering it, or with its class, `ScaledBigIntType.of(2)`, made once for each scale: `this.column('price', 'ScaledBigInt<2>')`, `connection.const(value, 'ScaledBigInt<2>')`, `DynamicCondition<{ price: 'ScaledBigInt<2>' }>`. Its SQL data type is `{ family: 'exact numeric', scale: 2 }`. A name with a negative scale, like `'ScaledBigInt<-2>'`, doesn't compile; one whose scale isn't an integer, like `'ScaledBigInt<1.5>'`, has no data type and is rejected with `UNKNOWN_DATA_TYPE`. `scaledBigInt(150n, 2)` gives a `bigint` the type `ScaledBigInt<2>`, and `ScaleOf<T>` is the scale of a type.

Any scale works, by its name, so the scale is the one of the column. Some usual ones, as examples:

| Scale | Usual for |
|---|---|
| 2 | Money in most currencies, in cents: `decimal(10, 2)` |
| 3 | The currencies with thousandths, like the Kuwaiti and the Bahraini dinar |
| 4 | Unit prices and exchange rates; the `money` of SQL Server |
| 6 | Coordinates in degrees, to about 10 cm; the USDC token |
| 8 | Bitcoin, in satoshis |
| 18 | Ether, in wei, in a column wide enough, like `decimal(38, 18)` |

A currency without decimals, like the yen, is a `bigint`.

```typescriptreact
import { ScaledBigIntsType, type ScaledBigInt, type SqlDataType } from "ts-sql-query"

price = this.optionalColumn('price', 'ScaledBigInt<2>')

// A type of yours, of the scale 2: a class of the family, which says the scale in its SQL data type
type Fee = ScaledBigInt<2> & { readonly __brand: 'Fee' }
abstract class FeeType extends ScaledBigIntsType<Fee, 'Fee'> {
    static override readonly type = 'Fee'
    static override readonly sqlDataType: SqlDataType = { family: 'exact numeric', scale: 2 }
}
fee = this.optionalColumn('fee', FeeType)
```

A type of yours of the family says its scale in its SQL data type, as an integer of yours says its size (see [Data types of your own](../advanced/data-types/own-data-types.md)); one that doesn't say it is rejected with `INVALID_CONFIGURATION` when a value is converted. For a single column, the family makes it with its scale: `this.optionalColumn('fee', ScaledBigIntsType.of<Fee, 'Fee'>('Fee', 2))` (see [A type for a specific use](#a-type-for-a-specific-use)). The scale of its SQL data type and the one of its values (`ScaleOf<Fee>`) must be the same: the type of the values doesn't check it.

A value is sent as the text of its decimal at its scale: `150n` of the scale 2 is `'1.50'`. It's read at its scale whatever the decimals the database gives: `1.5`, `1.50` and `1.5000` are `150n`. A value with a digit other than a zero beyond its scale, like `1.234` read as a `ScaledBigInt<2>`, is rejected with `PRECISION_LOST_RECEIVING_VALUE_FROM_DATABASE`: the value is never cut. The operations of [Exact decimals](#exact-decimals) keep the scale, except `multiply` and `divide`, which a `ScaledBigInt` doesn't have; to multiply, compute it in your code, or in the query with another exact decimal type.

A column of a negative scale, like `numeric(7, -2)` on PostgreSQL 15 and later and `NUMBER(7, -2)` on Oracle, keeps multiples of a power of 10: it rounds what it stores to hundreds (`12345` is stored as `12300`), to save space. Its values are integers, which the database writes with their zeros (`12300`) and without decimals, so the value of such a column is an integer: a `bigint` (`12300n`), a `stringDecimal` (`'12300'`) or a `dnumDecimal` (`[12300n, 0]`). `sqlDataTypeFrom('numeric(7, -2)')` reads its scale, -2, and a value of a column that declares it has no decimals. MariaDB, MySQL, SQL Server and SQLite have no negative scale.

A query with the column `price` of `tScaledAmount`, of the scale 2:

```ts
const rows = await connection.selectFrom(tScaledAmount)
    .where(tScaledAmount.price.greaterOrEqual(scaledBigInt(150n, 2)))
    .select({
        id: tScaledAmount.id,
        price: tScaledAmount.price,
        next: tScaledAmount.price.add(scaledBigInt(1n, 2)),
    })
    .orderBy('id')
    .executeSelectMany()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        id as id, 
        price as price, 
        price + cast(? as decimal(3, 2)) as next 
    from exact_amount 
    where price >= cast(? as decimal(3, 2)) 
    order by id
    ```
=== "MySQL"
    ```mysql
    select 
        id as id, 
        price as price, 
        price + cast(? as decimal(3, 2)) as next 
    from exact_amount 
    where price >= cast(? as decimal(3, 2)) 
    order by id
    ```
=== "Oracle"
    ```oracle
    select 
        id as "id", 
        price as "price", 
        price + :0 as "next" 
    from exact_amount 
    where price >= :1 
    order by "id"
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        id as id, 
        price as price, 
        price + $1 as next 
    from exact_amount 
    where price >= $2 
    order by id
    ```
=== "SQLite"
    ```sqlite
    select 
        id as id, 
        price as price, 
        (select case when typeof(tsq_v) <> 'text' then tsq_v when instr(tsq_v, '.') = 0 then (case when tsq_v = '-0' then '0' else tsq_v end) when rtrim(rtrim(tsq_v, '0'), '.') in ('-0', '-', '') then '0' else rtrim(rtrim(tsq_v, '0'), '.') end from (select case when price is null then null else decimal_add(price, ?1) end as tsq_v)) as next 
    from exact_amount 
    where decimal_cmp(price, ?2) >= 0 
    order by id
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        convert(nvarchar(41), price) as price, 
        convert(nvarchar(41), price + cast(@0 as decimal(3, 2))) as next 
    from exact_amount 
    where price >= cast(@1 as decimal(3, 2)) 
    order by id
    ```

The parameters are: `[ '0.01', '1.50' ]` (on SQLite: `[ '0.01', '1.5' ]`)

For the rows with the prices `1.50` and `1234.56`, the rows read are `[{ id: 1, price: 150n, next: 151n }, { id: 5, price: 123456n, next: 123457n }]`, on every database.

### What each database keeps

What each database keeps, for a `decimal(38, 10)` and a `decimal(10, 2)` column:

| Database | Reading a value | Sending a value | Adding, comparing and ordering |
|---|---|---|---|
| MariaDB, MySQL | All the digits, with the scale of the column: `'1.50'` | As text, written as `cast(? as decimal(P, S))` with the digits of the value where it isn't assigned to a column; a value wider than `decimal(65, 30)` is rejected | Exact |
| Oracle | All the digits, with the scale of the column: `'1.50'`; a computed value, a value of a `returning` and a value in an array aggregate, without the zeros at the end of its decimals (`'3'` for `1.50 * 2`), unless the SQL data type of the column says its decimals | As text; a value of more than 38 significant digits is rejected | Exact |
| PostgreSQL | All the digits, with the scale of the column: `'1.50'` | As a `numeric` | Exact |
| SQLite | By default, the canonical text: `'1.5'` for `1.50`; with a strategy without the canonical text, the text stored. With the decimals of the column when its SQL data type says them | By default, the canonical text; otherwise the text, as it is | Exact or rejected, by the decimal strategy: see below |
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

SQLite has no exact decimal type, and a column declared `decimal` turns the text into a floating point number when it stores it: store an exact decimal in a `TEXT` column of a `STRICT` table. How the library computes and compares it is the decimal strategy of the connection, and every strategy is exact or rejects the query. By default it writes the functions of SQLite's decimal extension, plain SQL and a few functions of the library, which you register in the connection of the driver, and it stores and reads every value in its canonical text (`1.50` as `1.5`), which compares as text. See [Exact decimals: the decimal strategies](../databases/sqlite/index.md#exact-decimals-the-decimal-strategies), and [SQLite functions and extensions](../databases/sqlite/functions.md) for registering those functions or loading SQLite's extension.

## The type of the column in the database

The data type says what a value is in TypeScript; it doesn't say what the column is in the database: a `string` can be a `varchar(20)` or an `nvarchar(max)`. Tell it, and the library and the query runners use it where it gives a better query, on every driver of the database: on SQL Server an ASCII text of a `varchar` column is sent as a `varchar`, so the index of the column is sought instead of scanned; on Oracle a `CLOB` column given back by a `returning` arrives whole. The value given to the column and the values compared with it take it.

The recommended way is to write the type as you see it in the database, and let a connection turn it into what the library reads, with `sqlDataTypeFrom`. `typesConnection` is a connection of your connection class that executes nothing, made once in a module the tables import (see [how to create it](../advanced/data-types/sql-data-types.md#from-the-name-of-the-type-in-the-database-recommended)):

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

Leave `driverTypeOf` of a query runner for a type only one driver has. Everything else, how each type is sent to the database, the families of the types, writing the type as an object and what each database does with it, is in [The type of a column in the database](../advanced/data-types/sql-data-types.md).
