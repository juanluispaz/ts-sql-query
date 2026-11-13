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
| `customInt`                     | *custom*             | Your type, with the operations of `int`                           |
| `customBigint`                  | *custom*             | Your type, with the operations of `bigint`                        |
| `customDouble`                  | *custom*             | Your type, with the operations of `double`                        |
| `customDecimal`                 | *custom*             | Your type: an exact decimal number, sent and read as its text      |
| `customUuid`                    | *custom*             | Your type, with the operations of `uuid`                          |
| `customLocalDate`               | *custom*             | Your type, with the operations of `localDate`                     |
| `customLocalTime`               | *custom*             | Your type, with the operations of `localTime`                     |
| `customLocalDateTime`           | *custom*             | Your type, with the operations of `localDateTime`                 |
| `enum`                          | *custom*             | Your type: can be compared for equality, like `equals` and `in`   |
| `custom`                        | *custom*             | Your type: can be compared for equality, like `equals` and `in`   |
| `customComparable`              | *custom*             | Your type: also can be ordered, like `lessThan` and `between`     |

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
this.column<MyIntType, 'MyIntTypeName'>('ColumnName', 'customInt', 'MyIntTypeName')
this.column<MyBigintType, 'MyBigintTypeName'>('ColumnName', 'customBigint', 'MyBigintTypeName')
this.column<MyDoubleType, 'MyDoubleTypeName'>('ColumnName', 'customDouble', 'MyDoubleTypeName')
this.column<MyDecimalType, 'MyDecimalTypeName'>('ColumnName', 'customDecimal', 'MyDecimalTypeName')
this.column<MyUuidType, 'MyUuidTypeName'>('ColumnName', 'customUuid', 'MyUuidTypeName')
this.column<MyDateType, 'MyDateTypeName'>('ColumnName', 'customLocalDate', 'MyDateTypeName')
this.column<MyTimeType, 'MyTimeTypeName'>('ColumnName', 'customLocalTime', 'MyTimeTypeName')
this.column<MyDateTimeType, 'MyDateTimeTypeName'>('ColumnName', 'customLocalDateTime', 'MyDateTimeTypeName')
this.column<MyEnumType, 'MyEnumTypeName'>('ColumnName', 'enum', 'MyEnumTypeName')
this.column<MyCustomType, 'MyCustomTypeName'>('ColumnName', 'custom', 'MyCustomTypeName')
this.column<MyCustomComparableType, 'MyCustomComparableTypeName'>('ColumnName', 'customComparable', 'MyCustomComparableTypeName')
```

A custom type takes two generic arguments: your TypeScript type, and its type name, the same text you pass after the type of the column. The type name is part of the type of the column: another column or expression can be compared with it, or assigned to it, only when it has the same type name.

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
| The same, with your own type for it, like the one of a decimal library | `customDecimal` | Your type, with a [conversion](#custom-types) from and to the text of the number. |
| Text | `string` | An empty string [has no value](connection.md#allowing-empty-string) by default. |
| True or false | `boolean` | Oracle and SQL Server store it as a number or a bit, with `0` and `1`. For other representations, like `'Y'` and `'N'`, see [Custom booleans values](../advanced/custom-booleans-values.md). |
| A UUID | `uuid` | It's a `string` in your code, and how it's stored depends on the database, as in the tip above. |
| A date with no time, like a birthday | `localDate` | A `Date` at 10:00 UTC of the day: read it with `getUTCFullYear`, `getUTCMonth` and `getUTCDate`. See [Read the values with the UTC getters](time-zones.md#read-the-values-with-the-utc-getters). |
| A time with no date, like an opening time | `localTime` | A `Date` on 1970-01-01: read it with `getUTCHours`, `getUTCMinutes` and `getUTCSeconds`. |
| A date with time, like the moment something happened | `localDateTime` | A `Date` whose UTC getters are the stored digits, in any zone of your application. This is the type for a column that stores an instant too, like `timestamptz` on PostgreSQL, which gives the instant. See [Time zones](time-zones.md). |
| One of a fixed list of values | `enum` | With a union of your values as its TypeScript type. |
| A value your code gives a type of its own, like an id with a TypeScript brand | The `custom...` type with the operations it needs | It's converted as the built-in type its [custom type](#custom-types) is based on, like a `customInt` as an `int`. |
| A value that only your code understands, like a JSON document | `custom`, or `customComparable` if the database can order it | With the [conversion registered](#custom-types). |

On SQLite, with a `localdate` [strategy of dates](supported-databases/sqlite.md#working-with-date-and-time), the default, a `localTime` and a `localDateTime` hold the stored text in their local getters instead: see [Time zones](time-zones.md#the-rule-every-value-in-the-database-is-in-utc).

## Custom types

A custom type (`customInt`, `customBigint`, `customDouble`, `customDecimal`, `customUuid`, `customLocalDate`, `customLocalTime`, `customLocalDateTime`, `enum`, `custom` and `customComparable`) gives a column your own TypeScript type, and its name (the last argument of the column, like `'Cents'`) identifies it. The first argument of the column is which custom type it is, a `CustomType`: it says which operations the column offers in a query, and how its values are converted.

| Custom type | Its values are converted as |
|---|---|
| `customInt` | `int` |
| `customBigint` | `bigint` |
| `customDouble` | `double` |
| `customDecimal` | A decimal number as text: see [Exact decimals](#exact-decimals) |
| `customUuid` | `uuid` |
| `customLocalDate` | `localDate` |
| `customLocalTime` | `localTime` |
| `customLocalDateTime` | `localDateTime` |
| `enum`, `custom` and `customComparable` | Not converted: the value is returned as it comes |

The custom type decides, whatever the name you give it: a `customLocalDate` named `'localDateTime'` is converted as a `localDate`.

So an int with a TypeScript brand needs nothing else; its values are checked and converted as those of an `int`:

```typescriptreact
type Cents = number & { readonly __brand: 'Cents' }

costCents = this.column<Cents, 'Cents'>('cost_cents', 'customInt', 'Cents')
```

!!! important

    Register the conversion of an `enum`, a `custom` or a `customComparable`, and of a custom type whose values in your code aren't those of the type it is based on, like a `customDouble` kept as text. Without it, an `enum`, a `custom` or a `customComparable` is returned as it comes, and that depends on where it comes from: from a plain column you get what the driver gives, which can be different in each driver, and from [an array aggregate](../queries/aggregate-as-object-array.md#how-the-values-go-through-json) you get what is in the JSON. A number there is its text, so that no digit is lost, and it's the conversion that decides what to do with it.

The conversion is written in the connection, so it applies everywhere that type is used, or in a type adapter of one column: see [Type adapters](../advanced/type-adapters.md), which also covers how to send a value of a custom type with another SQL type, like a `customDouble` kept as text.

## Exact decimals

JavaScript has no decimal type yet (there is a [proposal](https://github.com/tc39/proposal-decimal) to add one), and a `number` keeps about 16 significant digits. An exact decimal is kept as the text of the number, like `'12345678901234567890.1234567891'`, which keeps all the digits and the scale, like the `0` of `1.50`. There are two types for it, and everything this section says applies to both:

- `stringDecimal`: the value is a `string`. Choose it when a string is enough in your code.
- `customDecimal`: the value has your own TypeScript type, like a branded string or the decimal type of a library of your choice. The conversion from and to the text, if your type isn't a string, goes in a [type adapter](../advanced/type-adapters.md).

```typescriptreact
amount = this.optionalColumn('amount', 'stringDecimal')

type Amount = string & { readonly __brand: 'Amount' }
price = this.optionalColumn<Amount, 'Amount'>('price', 'customDecimal', 'Amount')
```

A `stringDecimal` is compared and computed only with another `stringDecimal` or a string, and a `customDecimal` only with values of its own type, so the two don't mix.

The text sent to the database uses a point as the decimal separator and has no exponent, like `'-0.25'`; another text, like `'1,50'` or `'1e3'`, is rejected with `INVALID_VALUE_TO_SEND_TO_DATABASE`. A text read from the database is returned as it comes, with a `0` added before a leading point (`.5` is `'0.5'`).

The operations that keep the value exact return the same type, `stringDecimal` or `customDecimal`: `add`, `subtract`, `multiply`, `modulo`, `abs`, `ceil`, `floor`, `round`, `roundn`, `minValue`, `maxValue` and `sum`. There is no `divide`: the division of two decimals isn't exact, and each database rounds it its own way. The ones whose result can't be exact return a `double`: `power`, `sqrt`, `cbrt`, `exp`, `ln`, `log10`, `logn`, the trigonometric functions and `average`.

A query with a `customDecimal` column, here `tExactAmount` with `amount` as a `decimal(38, 10)` and `price` as a `decimal(10, 2)`:

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

In every database, a `customDecimal` in an [array aggregate](../queries/aggregate-as-object-array.md) is read from the JSON with all its digits.

On SQL Server the conversion to text goes only in the select that returns the rows, so the database compares, groups and orders the numbers, not their text. An order by of a converted column is written with its expression, and a compound query, or a `selectDistinctFrom` ordered by a converted column, is wrapped in a select that converts the columns:

```sql
select o_1_.id as id, convert(nvarchar(41), o_1_.shifted) as shifted from (select id as id, price + cast(@0 as decimal(1, 0)) as shifted from exact_amount where id in (@1, @2) union select id as id, price + cast(@3 as decimal(1, 0)) as shifted from exact_amount where id in (@4, @5)) as o_1_ order by o_1_.shifted
```

If a select adds columns of its own with `customizeQuery({ beforeColumns })`, the wrapping select passes them on too: it selects the converted columns and every column of the wrapped select, where the converted ones have another alias (`price_tsq_raw`).

On MariaDB and MySQL, a text parameter would be computed as a floating point number, and compared as one in an `in` or a `between`; the cast keeps it exact. The widest decimal of these databases has 65 digits, 30 of them decimals: the cast of a value with more gives `999…9` without an error, and no column can hold it, so it's rejected with `INVALID_VALUE_TO_SEND_TO_DATABASE` before the query is sent.

On SQL Server, a text parameter alone would be cut to the width of the text it's converted to, two of them would be joined as texts by `+`, and a modulo rejects it; the cast keeps it a number. The widest decimal of SQL Server has 38 digits: a value with more is rejected with `INVALID_VALUE_TO_SEND_TO_DATABASE` before the query is sent.

Oracle's numbers keep 38 significant digits: a computation with a value of more is rounded without an error, and no column can hold it, so it's rejected with `INVALID_VALUE_TO_SEND_TO_DATABASE` before the query is sent.

Oracle reads the text with a point as the decimal separator, the one the library always sends. A session that uses another separator (`NLS_NUMERIC_CHARACTERS`) rejects the value with `ORA-01722`.

SQLite has no exact decimal type, and a column declared `decimal` turns the text into a floating point number when it stores it: store a `customDecimal` in a `TEXT` column of a `STRICT` table. How the library computes and compares it is the decimal strategy of the connection, and every strategy is exact or rejects the query. By default it writes the functions of SQLite's decimal extension, plain SQL and a few functions of the library, which you register in the connection of the driver, and it stores and reads every value in its canonical text (`1.50` as `1.5`), which compares as text. See [Exact decimals: the decimal strategies](supported-databases/sqlite.md#exact-decimals-the-decimal-strategies), and [SQLite functions and extensions](supported-databases/sqlite-extensions.md) for registering those functions or loading SQLite's extension.

## How a value is sent to the database

Each parameter of a query goes with its type, the one requested for it: by default the type of its column or value, or the one a type adapter requests with `setRequestedType`, like a `string` for a date sent as its text. That type decides which SQL type the parameter has in the databases where the library declares one:

| Type | PostgreSQL type, where the query needs one | SQL Server parameter type |
|---|---|---|
| `boolean` | `bool` | `bit` |
| `int`, `customInt` | `int4` | `int` |
| `bigint`, `customBigint` | `int8` | `bigint` |
| `double`, `customDouble` | `float8` | `float` |
| `stringDecimal`, `customDecimal` | `numeric` | `nvarchar`, the text |
| `string` | `text` | `nvarchar` |
| `uuid`, `customUuid` | `uuid` | `uniqueidentifier` |
| `localDate`, `customLocalDate` | `date` | `date` |
| `localTime`, `customLocalTime` | `time` | `time` |
| `localDateTime`, `customLocalDateTime` | `timestamp` | `datetime2` |
| `enum`, `custom`, `customComparable` | By the value: `int4` or `int8` for a whole number, `float8` for one with decimals, `int8` for a `bigint`, and none otherwise | By the value, and a text always as `nvarchar` |

PostgreSQL gets the type only where it can't tell it from the rest of the query, like a constant selected on its own or a row of [`Values`](mapping.md#mapping-constant-values-as-view). How it gets it depends on the query runner: `pg` and Bun SQL write it as a cast in the SQL (`select $1::int4 as result`); postgres.js and PGlite send the parameter with its type, and the SQL has no cast (`select $1 as result`). A `null` of one of these types is a parameter too, with its type: `$1::int4` with the parameter `null` on `pg`. Oracle declares it for a `null` of a number, a date or a time, and for a date or a time returned with `returning`: `NUMBER` or `TIMESTAMP`, as the driver sends their values. On MariaDB, MySQL and SQLite, and on Oracle for the rest, the driver sends each value as JavaScript gives it.

So the type also says how big the value can be in the database: a `customInt` is a 32-bit integer, like an `int`, and a value of your own type that needs 64 bits goes in a `customBigint`; a `customDouble` is a floating point number, and an exact decimal is a [`customDecimal`](#exact-decimals).

The `typesByName` option of the query runners of PostgreSQL, SQL Server and Oracle sends the parameters of a type name, the name of the type requested for them, with the type you declare instead; each query runner's page has its shape.
