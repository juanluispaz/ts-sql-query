---
search:
  boost: 0.5
---
# Type adapters

A type adapter changes how a value is converted on its way to the database and back: the value sent, the SQL of its parameter, and the SQL of the value as it leaves the database. Use one when the conversion of the library for the [data type](data-types.md) of a column isn't the one you need: a value of your own type the library doesn't know, like an RGB colour kept as bytes, a custom type whose values aren't those of the type it is based on, like a decimal kept as text, or a value the database must give in another form, like a date as its text.

The conversion goes in one of two places:

- In a column, as the last argument of its definition: a [type adapter of a column](#the-type-adapter-of-a-column) applies only to that column.
- In the connection, overriding its transformations: [a conversion for every column of a type](#a-conversion-for-every-column-of-a-type) applies everywhere that type is used, and it's the `next` the type adapters of the columns call.

Every transformation receives what it converts and a context with the type of the value, the original one and the one requested for it (see [The original and the requested type](#the-original-and-the-requested-type)). The signatures and every property of the contexts are in the [Type adapters API](../api/type-adapters.md).

## The type adapter of a column

A type adapter controls how the value of one column is sent to the database and received from it. It goes as the last argument of the column definition.

For example, to store an RGB colour as three bytes in the database and handle it in your application as an object with the properties `r`, `g` and `b`:

```ts
import { type DefaultTypeAdapter, type TypeAdapter, type TypeAdapterValueFromDBContext, type TypeAdapterValueToDBContext, type TypeAdapterPlaceholderContext } from "ts-sql-query"

interface RgbColor {r: number, g: number, b: number}

function isRgbColor(value: any): value is RgbColor {
    return typeof value === 'object'
        && typeof value.r === 'number'
        && typeof value.g === 'number'
        && typeof value.b === 'number'
}

class RgbColorTypeAdapter implements TypeAdapter {
    transformValueFromDB(value: unknown, context: TypeAdapterValueFromDBContext, next: DefaultTypeAdapter): unknown {
        if (context.requestedType === 'RgbColor' && value) {
            if (value instanceof Uint8Array && value.length == 3) {
                return {r: value[0], g: value[1], b: value[2]};
            }
            throw new Error(`Cannot decode database value ${value} (type ${typeof value}) as RgbColor`);
        }
        return next.transformValueFromDB(value, context);
    }

    transformValueToDB(value: RgbColor, context: TypeAdapterValueToDBContext, next: DefaultTypeAdapter): unknown {
        if (context.requestedType === 'RgbColor' && value) {
            if (isRgbColor(value)) {
                return Uint8Array.of(value.r, value.g, value.b);
            }
            throw new Error(`Cannot encode value ${value} for database`);
        }
        return next.transformValueToDB(value, context)
    }

    // Optional
    transformPlaceholder(placeholder: string, context: TypeAdapterPlaceholderContext, next: DefaultTypeAdapter): string {
        // You can write a type cast in the query if you want. With this code, the parameter in the SQL will look like $1::bytea
        if (context.requestedType === 'RgbColor') {
            return placeholder + '::bytea'
        }
        return next.transformPlaceholder(placeholder, context)
    }
}
```

And you can define the column as:

```typescriptreact
this.column<RgbColor, 'RgbColor'>('ColumnName', 'custom', 'RgbColor', new RgbColorTypeAdapter())
```

!!! important

    - The type adapter receives every value sent to or coming from the database, also `null` and `undefined`, so it has to handle them.
    - `context.requestedType` says the type requested for the value: process the value only if it's the one your rule applies to.
    - `next` is the default implementation: call it for what your rule doesn't handle.
    - An error thrown here arrives through the promise of the query, as it is.

!!! tip

    Use a column-specific type adapter when the transformation logic only applies to a single field — for example, the `CustomBooleanTypeAdapter` used in the [Custom boolean values](../advanced/custom-booleans-values.md) section, where a specific column may store booleans as `'Y'`/`'N'`.

    However, when the transformation is generic and applicable to many columns or tables — such as with the `RgbColor` example — it's better to define the adapter globally in the connection object. This improves consistency and avoids repeating the logic for every field.

## A conversion for every column of a type

When the same conversion applies to every column of a type, write it in the connection object, so it isn't repeated in each column definition:

```ts
import type { TypeAdapterValueFromDBContext, TypeAdapterValueToDBContext, TypeAdapterPlaceholderContext } from "ts-sql-query"
interface RgbColor {r: number, g: number, b: number}

function isRgbColor(value: any): value is RgbColor {
    return typeof value === 'object'
        && typeof value.r === 'number'
        && typeof value.g === 'number'
        && typeof value.b === 'number'
}

class DBConnection extends PostgreSqlConnection<'DBConnection'> {
    protected override transformValueFromDB(value: unknown, context: TypeAdapterValueFromDBContext) {
        if (context.requestedType === 'RgbColor' && value) {
            if (value instanceof Uint8Array && value.length == 3) {
                return { r: value[0], g: value[1], b: value[2] };
            }
            throw new Error(`Cannot decode database value ${value} (type ${typeof value}) as RgbColor`);
        }
        return super.transformValueFromDB(value, context);
    }
    protected override transformValueToDB(value: unknown, context: TypeAdapterValueToDBContext) {
        if (context.requestedType === 'RgbColor' && value) {
            if (isRgbColor(value)) {
                return Uint8Array.of(value.r, value.g, value.b);
            }
            throw new Error(`Cannot encode value ${value} for database`);
        }
        return super.transformValueToDB(value, context);
    }   
    protected override transformPlaceholder(placeholder: string, context: TypeAdapterPlaceholderContext): string {
        // You can write a type cast in the query if you want. With this code, the parameter in the SQL will look like $1::bytea
        if (context.requestedType === 'RgbColor') {
            return placeholder + '::bytea'
        }
        return super.transformPlaceholder(placeholder, context)
    }
}
```

And you can define the column as:

```typescriptreact
this.column<RgbColor, 'RgbColor'>('ColumnName', 'custom', 'RgbColor')
```

The connection's `transformProjection` is overridden the same way, and says how its SQL compares in the same context. It's the `next` of the type adapters, so it converts every column of the type, unless the type adapter of the column writes its SQL without calling `next`. Call `super.transformProjection(...)` for the values it doesn't convert:

```ts
import type { TypeAdapterProjectionContext } from "ts-sql-query"

class DBConnection extends PostgreSqlConnection<'DBConnection'> {
    protected override transformProjection(sql: string, context: TypeAdapterProjectionContext): string {
        if (context.requestedType === 'Birthday' && context.output === 'resultColumn') {
            context.comparison = 'equality'
            context.setRequestedType('string')
            return "to_char(" + sql + ", 'DD/MM/YYYY')"
        }
        return super.transformProjection(sql, context)
    }
}
```

### A custom type kept as text

Register the conversion of an `enum`, a `custom` or a `customComparable`, and of a custom type whose values in your code aren't those of the type it is based on: without it, the value is converted as the [data type](data-types.md#custom-types) says.

Write it in the connection, as above, so it applies everywhere that type is used:

- `transformValueFromDB`: converts a value that comes from the database.
- `transformValueToDB`: converts a value that is sent to the database.
- `transformPlaceholder`, optional: changes how the parameter is written in the SQL, like wrapping it in a function.

The SQL type a parameter is sent with comes from [the type requested for it](data-types.md#how-a-value-is-sent-to-the-database), by default its own; the `typesByName` option of the query runner gives a type of your own another one.

For example, a `customDouble` kept as text, so that no digit is lost: it's read as the text the database gives, and sent as it is. A [`customDecimal`](data-types.md#exact-decimals) does this without a conversion of your own:

```ts
import type { TypeAdapterValueFromDBContext, TypeAdapterValueToDBContext } from "ts-sql-query"
class DBConnection extends PostgreSqlConnection<'DBConnection'> {
    protected override transformValueFromDB(value: unknown, context: TypeAdapterValueFromDBContext) {
        if (context.requestedType === 'ExactDecimal' && value !== null && value !== undefined) {
            return String(value);
        }
        return super.transformValueFromDB(value, context);
    }
    protected override transformValueToDB(value: unknown, context: TypeAdapterValueToDBContext) {
        if (context.requestedType === 'ExactDecimal') {
            return value;
        }
        return super.transformValueToDB(value, context);
    }
}
```

On PostgreSQL, its parameter must have the type `numeric`, not the `float8` of a `double`. With `pg`, declare it in the query runner:

```ts
import { Pool } from 'pg';
import { PgPoolQueryRunner } from "ts-sql-query/postgresql/pg";

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
import { MssqlPoolPromiseQueryRunner } from "ts-sql-query/sqlserver/mssql";

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

## The original and the requested type

A value has two types in the context, so that what was declared and what is sent or read never get confused:

- The **original type**, `originalType` and `originalCustomType`: the one declared in the library, like `column('released_on', 'customLocalDate', 'ReleaseDay')` or `const(1, 'int')`. It never changes.
- The **requested type**, `requestedType` and `requestedCustomType`: the type the value is communicated with to the query runner and the database. By default it is the original one. A transformation can request another with `setRequestedType`, and the next type adapter of the chain and the conversion of the library decide by the type requested. It can be requested again, and `resetRequestedType()` requests the original type again.

`originalType` and `requestedType` are the name of the type, like `'int'` or `'ReleaseDay'`; `originalCustomType` and `requestedCustomType` say which custom type it is, as a column declares it, and are `undefined` for a built-in type.

`setRequestedType` takes a type as a column does: a built-in one by its name, like `setRequestedType('string')`, and a custom one with which custom type it is, like `setRequestedType('customLocalDate', 'ReleaseDay')`.

What the requested type is in each transformation:

| Transformation | The requested type is | Can request another |
|---|---|---|
| `transformValueToDB` | the type the value is sent with: the query runner sends the parameter as that type, with the cast or the type of the driver of that type | yes |
| `transformPlaceholder` | the type the value was sent with | no |
| `transformProjection` | the type of the value the SQL returned gives, which the query runner receives; it is read only when the SQL is converted | yes |
| `transformValueFromDB` | the type of the value received: the one `transformProjection` requested | yes, for what it gives `next` |

For example, on PostgreSQL, an adapter that sends a `Birthday` as its text `DD/MM/YYYY` requests a `string`, so `next` checks a text and the query runner sends a text, and converts that text to a date where the placeholder is written:

```ts
import type { TypeAdapter } from "ts-sql-query"

const dayMonthYear: TypeAdapter = {
    transformValueFromDB(value, context, next) {
        return next.transformValueFromDB(value, context)
    },
    transformValueToDB(value, context, next) {
        if (value instanceof Date) {
            context.setRequestedType('string')
            const day = String(value.getUTCDate()).padStart(2, '0')
            const month = String(value.getUTCMonth() + 1).padStart(2, '0')
            return next.transformValueToDB(day + '/' + month + '/' + value.getUTCFullYear(), context)
        }
        return next.transformValueToDB(value, context)
    },
    transformPlaceholder(placeholder, context, next) {
        if (context.requestedType === 'string') {
            return 'to_date(' + placeholder + ", 'DD/MM/YYYY')"
        }
        return next.transformPlaceholder(placeholder, context)
    },
}

const tCustomerBirthday = new class TCustomerBirthday extends Table<DBConnection, 'TCustomerBirthday'> {
    id = this.primaryKey('id', 'int')
    birthday = this.optionalColumn<Date, 'Birthday'>('birthday', 'customLocalDate', 'Birthday', dayMonthYear)
    constructor() {
        super('customer')
    }
}()

const customers = connection.selectFrom(tCustomerBirthday)
    .where(tCustomerBirthday.birthday.equals(new Date('2000-01-15')))
    .select({
        id: tCustomerBirthday.id
    })
    .executeSelectMany()
```

```postgresql
select id as id 
from customer 
where birthday = to_date($1, 'DD/MM/YYYY')
```

The parameters are: `[ '15/01/2000' ]`

The result type is:
```tsx
const customers: Promise<{
    id: number;
}[]>
```

The query runner sends the parameter as a text, the type requested: where the database must receive the type of the parameter, `pg` writes `$1::text`, and without the requested type it would write the cast of a date, `to_date($1::date, 'DD/MM/YYYY')`, which PostgreSQL rejects. The context of the query has both types of the parameter (see [Get the type of each parameter](../advanced/query-execution-metadata.md#get-the-type-of-each-parameter)).

An adapter whose `transformProjection` requests a `string`, like the text of a date (see [The SQL of a value read from the database](#the-sql-of-a-value-read-from-the-database)), receives that text in `transformValueFromDB`; when it gives `next` a value of the original type, it requests the original type again with `resetRequestedType()`.

## The SQL of a value read from the database

`transformValueFromDB` receives the value as the driver gives it. When the database must give the value in another form, for example as a text the driver doesn't change, `transformProjection` writes the SQL of the value as it leaves the database, and `transformValueFromDB` reads what arrives. It's the pair of `transformPlaceholder`, which writes the SQL of a value sent to the database.

It receives the SQL of the value as the library writes it, and its context has the type of the value and where the value leaves, its `output`: `'resultColumn'`, a column of the result of the query, also of the `returning` of an insert, an update or a delete, or `'aggregatedArrayValue'`, a value inside the JSON of an aggregated array (see [Inside the JSON of an aggregated array](#inside-the-json-of-an-aggregated-array)). It returns the SQL to write there. `next.transformProjection(...)` writes the conversion of the library: SQL Server writes a decimal of a column of the result as its text, `convert(nvarchar(41), ...)`, so the driver doesn't round it; on the other databases, and for the other types, it returns the SQL it receives.

For example, on PostgreSQL, an adapter that has the database give a day as the text `DD/MM/YYYY` and reads that text as the day:

```ts
import { type DefaultTypeAdapter, type TypeAdapter, type TypeAdapterProjectionContext, type TypeAdapterValueFromDBContext, type TypeAdapterValueToDBContext } from "ts-sql-query"

class DayAsTextTypeAdapter implements TypeAdapter {
    transformValueFromDB(value: unknown, context: TypeAdapterValueFromDBContext, next: DefaultTypeAdapter): unknown {
        const parts = typeof value === 'string' ? /^(\d\d)\/(\d\d)\/(\d{4})$/.exec(value) : null
        if (parts) {
            // The text DD/MM/YYYY, read as the day YYYY-MM-DD: next converts it as the original type
            context.resetRequestedType()
            return next.transformValueFromDB(parts[3] + '-' + parts[2] + '-' + parts[1], context)
        }
        return next.transformValueFromDB(value, context)
    }

    transformValueToDB(value: unknown, context: TypeAdapterValueToDBContext, next: DefaultTypeAdapter): unknown {
        return next.transformValueToDB(value, context)
    }

    transformProjection(sql: string, context: TypeAdapterProjectionContext, next: DefaultTypeAdapter): string {
        // In a column of the result and inside the JSON of an aggregated array
        if (context.output === 'resultColumn' || context.output === 'aggregatedArrayValue') {
            // DD/MM/YYYY compares as the day, but doesn't order as it
            context.comparison = 'equality'
            // The value the database gives is a text
            context.setRequestedType('string')
            return "to_char(" + sql + ", 'DD/MM/YYYY')"
        }
        return next.transformProjection(sql, context)
    }
}

const tCustomerBirthday = new class TCustomerBirthday extends Table<DBConnection, 'TCustomerBirthday'> {
    id = this.primaryKey('id', 'int')
    birthday = this.optionalColumn<Date, 'Birthday'>('birthday', 'customLocalDate', 'Birthday', new DayAsTextTypeAdapter())
    companyId = this.column('company_id', 'int')
    constructor() {
        super('customer')
    }
}()

const customers = connection.selectFrom(tCustomerBirthday)
    .where(tCustomerBirthday.birthday.greaterOrEqual(new Date('2000-01-01')))
    .select({
        id: tCustomerBirthday.id,
        birthday: tCustomerBirthday.birthday
    })
    .orderBy('birthday')
    .executeSelectMany()
```

```postgresql
select id as id, to_char(birthday, 'DD/MM/YYYY') as birthday 
from customer 
where birthday >= $1 
order by customer.birthday
```

The parameters are: `[ 2000-01-01T00:00:00.000Z ]`

The result type is:
```tsx
const customers: Promise<{
    id: number;
    birthday?: Date;
}[]>
```

The text `DD/MM/YYYY` doesn't order as the day does (`01/03/2024` comes before `15/01/2024`), and the conversion only changes what the database returns, not how the query uses the value:

| Where the column is | What is written |
|---|---|
| The columns of the select that is executed, the columns of the `returning` of an insert, an update or a delete, and the value of a function called with `executeFunction` | The SQL of `transformProjection` |
| The id that `executeInsert` reads by itself, in an insert without `returning` | The value |
| The where, the group by and the having | The value |
| A subquery or a `with` | The value; the select that returns a column of the `with` converts it |
| An order by of the column, like `orderBy('birthday')` | The value when the converted SQL doesn't order like it (`'equality'`, `'columnEquality'` or `'none'`): the order by writes the column, not its alias, which is the text. With `'value'`, the alias |
| A compound select (`union`, `intersect`, `except`) | The value when the converted SQL doesn't compare like it across the arms (`'columnEquality'` or `'none'`), or the order by names a column that doesn't order like it: the query is written inside a select that converts its columns, `select to_char(o_1_.birthday, 'DD/MM/YYYY') as birthday from (select ... union select ...) as o_1_ order by o_1_.birthday`. Otherwise each arm converts the column |
| A `selectDistinct` | The value when the converted SQL doesn't compare like it (`'none'`), or the select is ordered by a column that doesn't order like it: the select is written inside a select that converts its columns, `select to_char(o_1_.birthday, 'DD/MM/YYYY') as birthday from (select distinct birthday as birthday from customer) as o_1_`. Otherwise the distinct select converts the column |
| A value inside the JSON of an aggregated array | The SQL of `transformProjection` with `'aggregatedArrayValue'`; see [Inside the JSON of an aggregated array](#inside-the-json-of-an-aggregated-array) |

### How the converted SQL compares

Where the query compares or orders the value, the converted SQL can give another result than the value: two days written as `MM/YYYY` are the same text when they are in the same month, and `DD/MM/YYYY` orders otherwise than the day. `transformProjection` says, in its context, with `comparison`, how the SQL it returns compares with the value, for each type and each `output`, and the query uses the value only where it has to:

| `comparison` | The converted SQL | Example | The query |
|---|---|---|---|
| `'value'` (the default) | Compares and orders like the value | A day as `YYYY-MM-DD` | Has the converted SQL in place, and nothing else changes: the order by is the alias, a union and a distinct compare the texts |
| `'equality'` | Equal values give equal SQL and different values different SQL, but it orders otherwise | A day as `DD/MM/YYYY` | Orders by the value: the order by writes the column, a distinct select ordered by it is wrapped, and so is a compound select ordered by it |
| `'columnEquality'` | As `'equality'`, but only among the values of one column: equal values of two columns or expressions can give different SQL | The text of a decimal, whose scale is the one of its column: `1.5` in a `decimal(10, 1)` and `1.50` in a `decimal(10, 2)` | Orders by the value as with `'equality'`, and a compound select is wrapped, because its arms compare values of different selects. A distinct select compares the values of one column, so it converts in place |
| `'none'` | Neither compares nor orders like the value | A day as `MM/YYYY`; a date and time as text with its offset, where the same instant has several texts | Also compares the value: a compound select and a distinct select are wrapped, and the distinct of an aggregated array is applied to the values |

When neither the type adapter nor the connection says it, `comparison` is `'value'`. The conversion of the library, `next.transformProjection(...)`, says `'columnEquality'` for a decimal in a column of the result on SQL Server, whose text it writes (it orders as a text, and two equal decimals of columns of different scales give different texts). So an adapter that converts a value without saying how it compares gets the converted SQL in place: say `'equality'` or `'none'` when the converted SQL doesn't keep the order or the equality of the value. `comparison` is read only when `transformProjection` converts the value. The library may call `transformProjection` with an empty `sql` to know whether it converts the value, so it must say the same whatever the `sql` it receives.

### Inside the JSON of an aggregated array

An aggregated array (`aggregateAsArray`, `aggregateAsArrayOfOneColumn`, or a select used with `forUseAsInlineAggregatedArrayValue`, see [Aggregate as an object array](../queries/aggregate-as-object-array.md)) reaches the driver as a JSON text, and each value inside it is one of that JSON. For a value of the JSON, `transformProjection` receives `'aggregatedArrayValue'` and returns the SQL of the value that goes in the JSON, of any type the JSON function of the database takes: a text, like `DD/MM/YYYY`, or a number. `transformValueFromDB` receives each value of the JSON as its text, a number too, with all its digits. On SQL Server before 2025, where the library writes the JSON itself, a converted value goes in it as a string. When it doesn't convert the value, the value goes in the JSON as the library writes it on that database, and `next.transformProjection(...)` returns the SQL it receives, except with a [database outside UTC](time-zones.md#a-database-outside-utc) on PostgreSQL and Oracle, where a `localDateTime` or a `localTime` goes with its zone.

With the adapter above, which gives the text `DD/MM/YYYY` in both places, the birthdays of the customers of each company:

```ts
const companies = connection.selectFrom(tCustomerBirthday)
    .select({
        companyId: tCustomerBirthday.companyId,
        customers: connection.aggregateAsArray({
            id: tCustomerBirthday.id,
            birthday: tCustomerBirthday.birthday
        })
    })
    .groupBy('companyId')
    .executeSelectMany()
```

```postgresql
select company_id as "companyId", 
    (json_agg(json_build_object('id', id, 'birthday', to_char(birthday, 'DD/MM/YYYY'))))::text as customers 
from customer 
group by company_id
```

The parameters are: `[]`

The result type is:
```tsx
const companies: Promise<{
    companyId: number;
    customers: {
        id: number;
        birthday?: Date;
    }[];
}[]>
```

`'resultColumn'` and `'aggregatedArrayValue'` are told apart, so an adapter can give a value one form in a column of the result and another inside the JSON, also when the same query selects the value in both places. Inside a select used as an aggregated array, the value keeps its SQL:

| Where the value is | What is compared or ordered |
|---|---|
| The distinct, the order by and the limit of a select used with `forUseAsInlineAggregatedArrayValue`, and the arms of a compound select used so | The value: the JSON is written over that select, `json_agg(json_build_object('birthday', to_char(a_1_.birthday, 'DD/MM/YYYY'))) from (select distinct birthday as birthday from customer) as a_1_`. On SQL Server, the JSON of a select of objects is the select itself with `for json path`, with the converted SQL in place, when that compares and orders as the select needs: with `'value'`, and with `'equality'` when the order by doesn't name the value; otherwise the library writes the JSON over the select |
| The distinct of `aggregateAsArrayDistinct` and `aggregateAsArrayOfOneColumnDistinct` | The text when the converted SQL compares like the value (`'value'`, `'equality'` or `'columnEquality'`, which compares the values of one column): the distinct is inside the aggregate, over what goes in the JSON, `json_agg(distinct to_char(birthday, 'DD/MM/YYYY'))`. With `'none'`, when the aggregate is the only column of a select without group by, the value: the select is written as the aggregate over a select of the distinct values, `select json_agg(to_char(a_1_.result, 'MM/YYYY')) from (select distinct birthday as result from customer) as a_1_`. Otherwise, and always on MariaDB, the text: two values with the same text are in the array once |

!!! important

    - `transformProjection` only writes SQL: it can't add parameters.
    - When it doesn't convert the value, return what `next.transformProjection(...)` returns. The library calls it with an empty `sql` to know whether a column is converted, so it must return an empty text when it doesn't convert.
    - When the converted SQL gives a value of another type than the column, like the text of a date, request it with `context.setRequestedType(...)`, like `setRequestedType('string')`: the query runner receives it in the context of the query (`requestedType`), and on Oracle the `returning` of the column is received in an out parameter of that type, of the type of the column otherwise. `transformValueFromDB` receives the value with that requested type; when it gives `next` a value of the original type, like the day read from the text, it requests the original type again with `context.resetRequestedType()`.
    - On MariaDB, the distinct of `aggregateAsArrayDistinct` and `aggregateAsArrayOfOneColumnDistinct` is always inside the aggregate: MariaDB doesn't see a column of the outer query in a derived table, so a correlated select can't be written over the distinct values.
    - On MariaDB, a converted old value of an update (`oldValues()`) is inside the SQL of the conversion, and MariaDB 13.0.2 returns the new value there ([MDEV-40126](https://jira.mariadb.org/browse/MDEV-40126)); see [Update returning old values](../queries/update.md#update-returning-old-values).
