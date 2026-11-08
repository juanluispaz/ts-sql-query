---
search:
  boost: 0.55
---
# Column types

Each column you [map](mapping.md) has a type, which decides two things: the TypeScript type of its values, and the operations a query offers for it. This page has the types, which one to choose, and how to convert values on their way to and from the database.

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
| A decimal number that must stay exact, like money | `customDecimal` | With your own type for it. The value is a text with all its digits; what each database keeps is in [Exact decimals](#exact-decimals). |
| Text | `string` | An empty string [has no value](connection.md#allowing-empty-string) by default. |
| True or false | `boolean` | Oracle and SQL Server store it as a number or a bit, with `0` and `1`. For other representations, like `'Y'` and `'N'`, see [Custom booleans values](../advanced/custom-booleans-values.md). |
| A UUID | `uuid` | It's a `string` in your code, and how it's stored depends on the database, as in the tip above. |
| A date with no time, like a birthday | `localDate` | A `Date`: read it with `getFullYear`, `getMonth` and `getDate`. See [`localDate` and `localTime`](time-zones.md#localdate-and-localtime-are-not-affected). |
| A time with no date, like an opening time | `localTime` | A `Date`: read it with `getHours`, `getMinutes` and `getSeconds`. |
| A date with time, like the moment something happened | `localDateTime` | A `Date`. This is the type for a column that stores an instant too, like `timestamptz` on PostgreSQL. Which zone it's read in is in [Time zones](time-zones.md). |
| One of a fixed list of values | `enum` | With a union of your values as its TypeScript type. |
| A value your code gives a type of its own, like an id with a TypeScript brand | The `custom...` type with the operations it needs | It's converted as the type of its [category](#custom-types), like a `customInt` as an `int`. |
| A value that only your code understands, like a JSON document | `custom`, or `customComparable` if the database can order it | With the [conversion registered](#custom-types). |

## Custom types

A custom type (`customInt`, `customBigint`, `customDouble`, `customDecimal`, `customUuid`, `customLocalDate`, `customLocalTime`, `customLocalDateTime`, `enum`, `custom` and `customComparable`) gives a column your own TypeScript type, and its name (the last argument of the column, like `'Cents'`) identifies it. The first word of the type is its category: it says which operations the column offers in a query, and how its values are converted.

| Category | Its values are converted as |
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

So an int with a TypeScript brand needs nothing else; its values are checked and converted as those of an `int`:

```typescriptreact
type Cents = number & { readonly __brand: 'Cents' }

costCents = this.column<Cents, 'Cents'>('cost_cents', 'customInt', 'Cents')
```

!!! important

    Register the conversion of an `enum`, a `custom` or a `customComparable`, and of a custom type whose values in your code aren't those of its category, like a `customDouble` kept as text. Without it, an `enum`, a `custom` or a `customComparable` is returned as it comes, and that depends on where it comes from: from a plain column you get what the driver gives, which can be different in each driver, and from [an array aggregate](../queries/aggregate-as-object-array.md#how-the-values-go-through-json) you get what is in the JSON. A number there is its text, so that no digit is lost, and it's the conversion that decides what to do with it.

The best place to register it is the connection, so it applies everywhere that type is used. These are the methods to implement, and all of them receive the name of the type and its category:

- `transformValueFromDB`: converts a value that comes from the database.
- `transformValueToDB`: converts a value that is sent to the database.
- `transformPlaceholder`, optional: changes how the parameter is written in the SQL, like wrapping it in a function.

The SQL type a parameter is sent with comes from [its category](#how-a-value-is-sent-to-the-database); the `typesByName` option of the query runner gives a type of your own another one.

For example, a `customDouble` kept as text, so that no digit is lost: it's read as the text the database gives, and sent as it is. A [`customDecimal`](#exact-decimals) does this without a conversion of your own:

```ts
import type { TypeCategory } from "ts-sql-query" // or "ts-sql-query/TypeAdapter"
class DBConnection extends PostgreSqlConnection<'DBConnection'> {
    protected override transformValueFromDB(value: unknown, type: string, typeCategory: TypeCategory) {
        if (type === 'ExactDecimal' && value !== null && value !== undefined) {
            return String(value);
        }
        return super.transformValueFromDB(value, type, typeCategory);
    }
    protected override transformValueToDB(value: unknown, type: string, typeCategory: TypeCategory) {
        if (type === 'ExactDecimal') {
            return value;
        }
        return super.transformValueToDB(value, type, typeCategory);
    }
}
```

On PostgreSQL, its parameter must have the type `numeric`, not the `float8` of a `double`. With `pg`, declare it in the query runner:

```ts
import { Pool } from 'pg';
import { PgPoolQueryRunner } from "ts-sql-query/queryRunners/PgPoolQueryRunner";

const pool = new Pool({ /* … */ });

async function main() {
    const connection = new DBConnection(new PgPoolQueryRunner(pool, { typesByName: { ExactDecimal: 'numeric' } }));
    // Do your queries here
    connection // ...
}
```

Then `connection.const<ExactDecimal, 'ExactDecimal'>(amount, 'customDouble', 'ExactDecimal')` selected on its own is written `select $1::numeric as result`, with the parameter `[ '12345678901234567890.123456789' ]`, and the result keeps every digit. `pg` and Bun SQL write the cast only where the query needs a type; compared with a `numeric` column, the column gives it. With postgres.js and PGlite, declare the oid of `numeric`, `typesByName: { ExactDecimal: 1700 }`: the parameter is sent as a `numeric` everywhere, and the SQL is `select $1 as result`.

On SQL Server, a `customDouble` is sent as a `float`, which loses digits too. Declare the type `nvarchar`: the text arrives with all its digits, and SQL Server converts it where a `decimal` is expected, like in an insert or a comparison with a `decimal` column:

<!-- doc-code-snippet-template: sqlserver -->
```ts
import mssql from 'mssql'
import { MssqlPoolPromiseQueryRunner } from "ts-sql-query/queryRunners/MssqlPoolPromiseQueryRunner";

const { ConnectionPool, TYPES } = mssql

const poolPromise = new ConnectionPool({
    user: '...',
    password: '...',
    server: 'localhost',
    database: '...'
}).connect();

async function main() {
    const connection = new DBConnection(new MssqlPoolPromiseQueryRunner(poolPromise, { typesByName: { ExactDecimal: TYPES.NVarChar } }));
    // Do your queries here
    connection // ...
}
```

`TYPES.Decimal` doesn't serve for it: the driver turns the value into a JavaScript number, so `TYPES.Decimal(38, 10)` loses the digits of a long decimal, and `TYPES.Decimal` without arguments is `decimal(18, 0)`, which rounds the fraction away.

When only one column needs its own conversion, use a [type adapter](#type-adapters) in that column. When the conversion is generic, see [Global type adapter](#global-type-adapter).

## Exact decimals

A `customDecimal` is a decimal number with your own TypeScript type, whose value is the text of the number, like `'12345678901234567890.1234567891'`. A JavaScript `number` keeps about 16 significant digits; the text keeps all of them, and the scale, like the `0` of `1.50`.

```typescriptreact
type Amount = string & { readonly __brand: 'Amount' }

amount = this.optionalColumn<Amount, 'Amount'>('amount', 'customDecimal', 'Amount')
```

The text sent to the database uses a point as the decimal separator and has no exponent, like `'-0.25'`; another text, like `'1,50'` or `'1e3'`, is rejected with `INVALID_VALUE_TO_SEND_TO_DATABASE`. A text read from the database is returned as it comes, with a `0` added before a leading point (`.5` is `'0.5'`).

The operations that keep the value exact return a `customDecimal`: `add`, `subtract`, `multiply`, `modulo`, `abs`, `ceil`, `floor`, `round`, `roundn`, `minValue`, `maxValue` and `sum`. There is no `divide`: the division of two decimals isn't exact, and each database rounds it its own way. The ones whose result can't be exact return a `double`: `power`, `sqrt`, `cbrt`, `exp`, `ln`, `log10`, `logn`, the trigonometric functions and `average`.

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
        amount + cast(? as decimal(11, 10)) as `next` 
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
        case when amount is null then null else decimal_add(amount, ?1) end as next 
    from exact_amount 
    where decimal_cmp(price, ?2) > 0 
    order by id
    ```
=== "SQL Server"
    ```sqlserver
    select 
        id as id, 
        convert(nvarchar(41), amount) as amount, 
        convert(nvarchar(41), amount + @0) as [next] 
    from exact_amount 
    where price > @1 
    order by id
    ```

The parameters are: `[ '0.0000000001', '1' ]`

For a row with the amount `12345678901234567890.1234567891` and the price `1.50`, the row read is `{ id: 1, amount: '12345678901234567890.1234567891', next: '12345678901234567890.1234567892' }`. On SQLite the query uses functions you register in the connection of the driver: see below.

What each database keeps, for a `decimal(38, 10)` and a `decimal(10, 2)` column:

| Database | Reading a value | Sending a value | Adding, comparing and ordering |
|---|---|---|---|
| MariaDB, MySQL | All the digits, with the scale of the column: `'1.50'` | As text, written as `cast(? as decimal(P, S))` with the digits of the value where it isn't assigned to a column; a value wider than `decimal(65, 30)` is rejected | Exact |
| Oracle | All the digits, without the zeros at the end of the decimals: `'1.5'` for `1.50` | As text | Exact |
| PostgreSQL | All the digits, with the scale of the column: `'1.50'` | As a `numeric` | Exact |
| SQLite | The text stored | The text, as it is | Exact with the default decimal strategy: see below |
| SQL Server | All the digits, with the scale of the column: `'1.50'`; the outermost query converts the value to text with `convert(nvarchar(41), …)` | As an `nvarchar` | Exact |

In every database, a `customDecimal` in an [array aggregate](../queries/aggregate-as-object-array.md) is read from the JSON with all its digits.

On SQL Server the conversion to text goes only in the select that returns the rows, so the database compares, groups and orders the numbers, not their text. An order by of a converted column is written with its expression, and a compound query, or a `selectDistinctFrom` ordered by a converted column, is wrapped in a select that converts the columns:

```sql
select o_1_.id as id, convert(nvarchar(41), o_1_.shifted) as shifted from (select id as id, price + @0 as shifted from exact_amount where id in (@1, @2) union select id as id, price + @3 as shifted from exact_amount where id in (@4, @5)) as o_1_ order by o_1_.shifted
```

If a select adds columns of its own with `customizeQuery({ beforeColumns })`, the wrapping select passes them on too: it selects the converted columns and every column of the wrapped select, where the converted ones have another alias (`price_tsq_raw`).

On MariaDB and MySQL, a text parameter would be computed as a floating point number, and compared as one in an `in` or a `between`; the cast keeps it exact. The widest decimal of these databases has 65 digits, 30 of them decimals: the cast of a value with more gives `999…9` without an error, and no column can hold it, so it's rejected with `INVALID_VALUE_TO_SEND_TO_DATABASE` before the query is sent.

Oracle reads the text with a point as the decimal separator, the one the library always sends. A session that uses another separator (`NLS_NUMERIC_CHARACTERS`) rejects the value with `ORA-01722`.

SQLite has no exact decimal type, and a column declared `decimal` turns the text into a floating point number when it stores it: store a `customDecimal` in a `TEXT` column of a `STRICT` table. How the library computes and compares it is the decimal strategy of the connection: by default, with functions you register in the connection of the driver, which make every operation exact. See [Exact decimals: the decimal strategies](supported-databases/sqlite.md#exact-decimals-the-decimal-strategies).

## How a value is sent to the database

Each parameter of a query goes with the name of its type and its category, and the category decides which SQL type it has in the databases where the library declares one:

| Category | PostgreSQL type, where the query needs one | SQL Server parameter type |
|---|---|---|
| `boolean` | `bool` | `bit` |
| `int`, `customInt` | `int4` | `int` |
| `bigint`, `customBigint` | `int8` | `bigint` |
| `double`, `customDouble` | `float8` | `float` |
| `customDecimal` | `numeric` | `nvarchar`, the text |
| `string` | `text` | `nvarchar` |
| `uuid`, `customUuid` | `uuid` | `uniqueidentifier` |
| `localDate`, `customLocalDate` | `date` | `date` |
| `localTime`, `customLocalTime` | `time` | `time` |
| `localDateTime`, `customLocalDateTime` | `timestamp` | `datetime2` |
| `enum`, `custom`, `customComparable` | By the value: `int4` or `int8` for a whole number, `float8` for one with decimals, `int8` for a `bigint`, and none otherwise | By the value, and a text always as `nvarchar` |

PostgreSQL gets the type only where it can't tell it from the rest of the query, like a constant selected on its own or a row of [`Values`](mapping.md#mapping-constant-values-as-view). How it gets it depends on the query runner: `pg` and Bun SQL write it as a cast in the SQL (`select $1::int4 as result`); postgres.js and PGlite send the parameter with its type, and the SQL has no cast (`select $1 as result`). A `null` of one of these categories is a parameter too, with its type: `$1::int4` with the parameter `null` on `pg`. Oracle declares it for a `null` of a number, a date or a time, and for a date or a time returned with `returning`: `NUMBER` or `TIMESTAMP`, as the driver sends their values. On MariaDB, MySQL and SQLite, and on Oracle for the rest, the driver sends each value as JavaScript gives it.

So the category also says how big the value can be in the database: a `customInt` is a 32-bit integer, like an `int`, and a value of your own type that needs 64 bits goes in a `customBigint`; a `customDouble` is a floating point number, and an exact decimal is a [`customDecimal`](#exact-decimals).

The `typesByName` option of the query runners of PostgreSQL, SQL Server and Oracle sends the parameters of a type name with the type you declare instead; each query runner's page has its shape.

## Type adapters

A type adapter controls how the value of one column is sent to the database and received from it. It goes as the last argument of the column definition.

For example, to store an RGB colour as three bytes in the database and handle it in your application as an object with the properties `r`, `g` and `b`:

```ts
import { type DefaultTypeAdapter, type TypeAdapter, type TypeCategory } from "ts-sql-query" // or "ts-sql-query/TypeAdapter"

interface RgbColor {r: number, g: number, b: number}

function isRgbColor(value: any): value is RgbColor {
    return typeof value === 'object'
        && typeof value.r === 'number'
        && typeof value.g === 'number'
        && typeof value.b === 'number'
}

class RgbColorTypeAdapter implements TypeAdapter {
    transformValueFromDB(value: unknown, type: string, typeCategory: TypeCategory, next: DefaultTypeAdapter): unknown {
        if (type === 'RgbColor' && value) {
            if (value instanceof Uint8Array && value.length == 3) {
                return {r: value[0], g: value[1], b: value[2]};
            }
            throw new Error(`Cannot decode database value ${value} (type ${typeof value}) as RgbColor`);
        }
        return next.transformValueFromDB(value, type, typeCategory);
    }

    transformValueToDB(value: RgbColor, type: string, typeCategory: TypeCategory, next: DefaultTypeAdapter): unknown {
        if (type === 'RgbColor' && value) {
            if (isRgbColor(value)) {
                return Uint8Array.of(value.r, value.g, value.b);
            }
            throw new Error(`Cannot encode value ${value} for database`);
        }
        return next.transformValueToDB(value, type, typeCategory)
    }

    // Optional
    transformPlaceholder(placeholder: string, type: string, typeCategory: TypeCategory, valueSentToDB: unknown, next: DefaultTypeAdapter): string {
        // You can write a type cast in the query if you want. With this code, the parameter in the SQL will look like $1::bytea
        if (type === 'RgbColor') {
            return placeholder + '::bytea'
        }
        return next.transformPlaceholder(placeholder, type, typeCategory, valueSentToDB)
    }
}
```

And you can define the column as:

```typescriptreact
this.column<RgbColor, 'RgbColor'>('ColumnName', 'custom', 'RgbColor', new RgbColorTypeAdapter())
```

!!! important

    - The type adapter receives every value sent to or coming from the database, also `null` and `undefined`, so it has to handle them.
    - The `type` parameter says what type is expected: process the value only if it's the one your rule applies to.
    - `next` is the default implementation: call it for what your rule doesn't handle.
    - An error thrown here arrives through the promise of the query, as it is.

!!! tip

    Use a column-specific type adapter when the transformation logic only applies to a single field — for example, the `CustomBooleanTypeAdapter` used in the [Custom boolean values](../advanced/custom-booleans-values.md) section, where a specific column may store booleans as `'Y'`/`'N'`.

    However, when the transformation is generic and applicable to many columns or tables — such as with the `RgbColor` example — it's better to define the adapter globally in the connection object. This improves consistency and avoids repeating the logic for every field.

## Global type adapter

When the same conversion applies to every column of a type, write it in the connection object, so it isn't repeated in each column definition:

```ts
import type { TypeCategory } from "ts-sql-query" // or "ts-sql-query/TypeAdapter"
interface RgbColor {r: number, g: number, b: number}

function isRgbColor(value: any): value is RgbColor {
    return typeof value === 'object'
        && typeof value.r === 'number'
        && typeof value.g === 'number'
        && typeof value.b === 'number'
}

class DBConnection extends PostgreSqlConnection<'DBConnection'> {
    protected override transformValueFromDB(value: unknown, type: string, typeCategory: TypeCategory) {
        if (type === 'RgbColor' && value) {
            if (value instanceof Uint8Array && value.length == 3) {
                return { r: value[0], g: value[1], b: value[2] };
            }
            throw new Error(`Cannot decode database value ${value} (type ${typeof value}) as RgbColor`);
        }
        return super.transformValueFromDB(value, type, typeCategory);
    }
    protected override transformValueToDB(value: unknown, type: string, typeCategory: TypeCategory) {
        if (type === 'RgbColor' && value) {
            if (isRgbColor(value)) {
                return Uint8Array.of(value.r, value.g, value.b);
            }
            throw new Error(`Cannot encode value ${value} for database`);
        }
        return super.transformValueToDB(value, type, typeCategory);
    }   
    protected override transformPlaceholder(placeholder: string, type: string, typeCategory: TypeCategory, valueSentToDB: unknown): string {
        // You can write a type cast in the query if you want. With this code, the parameter in the SQL will look like $1::bytea
        if (type === 'RgbColor') {
            return placeholder + '::bytea'
        }
        return super.transformPlaceholder(placeholder, type, typeCategory, valueSentToDB)
    }
}
```

And you can define the column as:

```typescriptreact
this.column<RgbColor, 'RgbColor'>('ColumnName', 'custom', 'RgbColor')
```
