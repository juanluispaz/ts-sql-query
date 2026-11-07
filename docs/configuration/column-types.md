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
| `customDouble`                  | *custom*             | Your type, with the operations of `double`                        |
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
this.column<MyIntType>('ColumnName', 'customInt', 'MyIntTypeName')
this.column<MyDoubleType>('ColumnName', 'customDouble', 'MyDoubleTypeName')
this.column<MyUuidType>('ColumnName', 'customUuid', 'MyUuidTypeName')
this.column<MyDateType>('ColumnName', 'customLocalDate', 'MyDateTypeName')
this.column<MyTimeType>('ColumnName', 'customLocalTime', 'MyTimeTypeName')
this.column<MyDateTimeType>('ColumnName', 'customLocalDateTime', 'MyDateTimeTypeName')
this.column<MyEnumType>('ColumnName', 'enum', 'MyEnumTypeName')
this.column<MyCustomType>('ColumnName', 'custom', 'MyCustomTypeName')
this.column<MyCustomComparableType>('ColumnName', 'customComparable', 'MyCustomComparableTypeName')
```

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
| A decimal number that must stay exact, like money | `customDouble` | With your own type for it, and the [conversion registered](#custom-types). The library doesn't convert it, so you receive what the driver gives. |
| Text | `string` | An empty string [has no value](connection.md#allowing-empty-string) by default. |
| True or false | `boolean` | Oracle and SQL Server store it as a number or a bit, with `0` and `1`. For other representations, like `'Y'` and `'N'`, see [Custom booleans values](../advanced/custom-booleans-values.md). |
| A UUID | `uuid` | It's a `string` in your code, and how it's stored depends on the database, as in the tip above. |
| A date with no time, like a birthday | `localDate` | A `Date`: read it with `getFullYear`, `getMonth` and `getDate`. See [`localDate` and `localTime`](time-zones.md#localdate-and-localtime-are-not-affected). |
| A time with no date, like an opening time | `localTime` | A `Date`: read it with `getHours`, `getMinutes` and `getSeconds`. |
| A date with time, like the moment something happened | `localDateTime` | A `Date`. This is the type for a column that stores an instant too, like `timestamptz` on PostgreSQL. Which zone it's read in is in [Time zones](time-zones.md). |
| One of a fixed list of values | `enum` | With a union of your values as its TypeScript type. |
| A value your code gives a type of its own, like an id with a TypeScript brand | The `custom...` type with the operations it needs | With the [conversion registered](#custom-types). |
| A value that only your code understands, like a JSON document | `custom`, or `customComparable` if the database can order it | With the [conversion registered](#custom-types). |

## Custom types

A custom type (`customInt`, `customDouble`, `customUuid`, `customLocalDate`, `customLocalTime`, `customLocalDateTime`, `enum`, `custom` and `customComparable`) gives a column your own TypeScript type, and its name (the last argument of the column, like `'MyIntTypeName'`) identifies it. The first word of the type only says which operations the column offers in a query; the library knows nothing about what your type contains, so it doesn't convert its values.

!!! important

    Register how each custom type is converted, also `customInt` and `customDouble`. Without it, the value is returned as it comes, and that depends on where it comes from: from a plain column you get what the driver gives, which can be different in each driver, and from [an array aggregate](../queries/aggregate-as-object-array.md#how-the-values-go-through-json) you get what is in the JSON. A number there is its text, so that no digit is lost, and it's the conversion that decides what to do with it.

The best place to register it is the connection, so it applies everywhere that type is used. These are the three methods to implement, and all of them receive the name of the type:

- `transformValueFromDB`: converts a value that comes from the database.
- `transformValueToDB`: converts a value that is sent to the database.
- `transformPlaceholder`: changes how the parameter is written in the SQL, like adding a cast. PostgreSQL needs a cast in some positions, and the library only writes it for the types it knows.

A typical case is a type that the database holds as a type the library knows, like an int with a TypeScript brand. Then you can call `super` with that type, and the library handles the value in the same way, with the same checks:

```ts
import type { TypeCategory } from "ts-sql-query" // or "ts-sql-query/TypeAdapter"
class DBConnection extends PostgreSqlConnection<'DBConnection'> {
    protected override transformValueFromDB(value: unknown, type: string, typeCategory: TypeCategory) {
        if (type === 'MyIntTypeName') {
            return super.transformValueFromDB(value, 'int', 'int');
        }
        return super.transformValueFromDB(value, type, typeCategory);
    }
    protected override transformValueToDB(value: unknown, type: string, typeCategory: TypeCategory) {
        if (type === 'MyIntTypeName') {
            return super.transformValueToDB(value, 'int', 'int');
        }
        return super.transformValueToDB(value, type, typeCategory);
    }
    protected override transformPlaceholder(placeholder: string, type: string, typeCategory: TypeCategory, forceTypeCast: boolean, valueSentToDB: unknown): string {
        if (type === 'MyIntTypeName') {
            return super.transformPlaceholder(placeholder, 'int', 'int', forceTypeCast, valueSentToDB);
        }
        return super.transformPlaceholder(placeholder, type, typeCategory, forceTypeCast, valueSentToDB);
    }
}
```

When the value needs a conversion of its own, write it there: see [Global type adapter](#global-type-adapter). If only one column needs it, use a [type adapter](#type-adapters) in that column.

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
    transformPlaceholder(placeholder: string, type: string, typeCategory: TypeCategory, forceTypeCast: boolean, valueSentToDB: unknown, next: DefaultTypeAdapter): string {
        // You can force a type cast in the query if you want. With this code, the parameter in the SQL will look like $1::bytea
        // By default, in PostgreSQL only, a type cast is generated when forceTypeCast is true
        if (type === 'RgbColor') {
            return placeholder + '::bytea'
        }
        return next.transformPlaceholder(placeholder, type, typeCategory, forceTypeCast, valueSentToDB)
    }
}
```

And you can define the column as:

```typescriptreact
this.column<RgbColor>('ColumnName', 'custom', 'RgbColor', new RgbColorTypeAdapter())
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
    protected override transformPlaceholder(placeholder: string, type: string, typeCategory: TypeCategory, forceTypeCast: boolean, valueSentToDB: unknown): string {
        // You can force a type cast in the query if you want. With this code, the parameter in the SQL will look like $1::bytea
        // By default, in PostgreSql only, a type cast is generated when forceTypeCast is true
        if (type === 'RgbColor') {
            return placeholder + '::bytea'
        }
        return super.transformPlaceholder(placeholder, type, typeCategory, forceTypeCast, valueSentToDB)
    }
}
```

And you can define the column as:

```typescriptreact
this.column<RgbColor>('ColumnName', 'custom', 'RgbColor')
```
