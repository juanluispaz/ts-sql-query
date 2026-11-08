---
search:
  boost: 0.59
---
<!-- doc-code-template: sqlite -->
# SQLite

This page has what is particular to SQLite: what it offers and what it doesn't, how to declare its version, how dates are stored, why the insensitive operations only fold ASCII, the UUID strategies, and the versions. To define the connection and map your tables, the pages to read are [Connection](../connection.md) and [Mapping](../mapping.md).

## Defining the connection

```ts
import { SqliteConnection } from "ts-sql-query/connections/SqliteConnection";

class DBConnection extends SqliteConnection<'DBConnection'> { }
```

Create a connection object for each request, and don't share it between concurrent requests: see [Instantiating the connection](../connection.md#instantiating-the-connection-with-the-database-connection).

!!! tip

    If you use [better-sqlite3](https://www.npmjs.com/package/better-sqlite3) or [sqlite-wasm](https://www.npmjs.com/package/@sqlite.org/sqlite-wasm) to connect to the database you can run your queries synchronously. See [BetterSqlite3QueryRunner](../query-runners/recommended/better-sqlite3.md), [Sqlite3WasmOO1QueryRunner](../query-runners/recommended/sqlite-wasm-OO1.md) and [Synchronous query runners](../../advanced/synchronous-query-runners.md) for more information.

## What it offers and what it doesn't

What isn't offered doesn't compile on this connection. On a version older than the one shown, the database rejects the query. Each link goes to the page that explains the feature, with all the databases side by side.

| What | On this database |
|---|---|
| [`returning` in an insert](../../queries/insert.md#availability-per-database) | From SQLite 3.35 |
| [`returning` in an update](../../queries/update.md#availability-in-each-database) | From SQLite 3.35 |
| [`returning` in a delete](../../queries/delete.md#availability-in-each-database) | From SQLite 3.35 |
| [`oldValues()` in an update](../../queries/update.md#availability-in-each-database) | Not offered |
| [Insert on conflict](../../queries/insert-on-conflict.md#what-each-database-offers) | `onConflictDoNothing`, `onConflictDoUpdateSet` and `onConflictOn`. `onConflictOnConstraint` isn't offered |
| Other tables in an [update](../../queries/update.md#availability-in-each-database) or a [delete](../../queries/delete.md#availability-in-each-database) | `from` in an update. `using` and a join right after `update` or `deleteFrom` aren't offered |
| [Compound queries](../../queries/compound-select.md#availability-in-each-database) | `union`, `unionAll`, `intersect`, `except`, `minus`. Their `All` versions aren't offered |
| [Recursive queries](../../queries/recursive-select.md#availability-in-each-database) | `recursiveUnionAll`, `recursiveUnion`. `startWith` and `connectBy` aren't offered |
| [Arrays of objects from an aggregate](../../queries/aggregate-as-object-array.md#availability-in-each-database) | Yes, also the `Distinct` versions |
| [`stringConcatDistinct`, `anyValue`](../../queries/aggregate-and-group-by.md#how-each-function-is-written-in-each-database) | `anyValue` yes; [`stringConcatDistinct` without a separator](#stringconcatdistinct-has-no-separator) |
| [Sequences](../mapping.md#using-a-sequence) | Not offered: SQLite doesn't have them |
| [Stored procedures](../mapping.md#calling-a-stored-procedure) and [functions](../mapping.md#calling-a-function-of-the-database) | SQLite has no stored procedures, and rejects the statement. A function exists only if you register it in the driver |
| [Isolation levels](../../queries/transaction.md#what-each-database-offers) | You can't choose one: transactions are always serializable |

## Working with Date and Time

`ts-sql-query` provides multiple strategies to handle date and time that are compatible with [SQLite’s date and time functions](https://www.sqlite.org/lang_datefunc.html). To define the strategy to be used, you must overwrite the `getDateTimeFormat` function; this function receives as an argument the type of date to handle (`date`, `time`, `dateTime`) and returns the strategy to use for that specific case. In addition, there are three properties (`treatUnexpectedIntegerDateTimeAsJulian`, `treatUnexpectedStringDateTimeAsUTC`, and `unexpectedUnixDateTimeAreMilliseconds`) that allow controlling how unexpected formats are interpreted. Example:

```ts
import { SqliteConnection } from "ts-sql-query/connections/SqliteConnection";
import type { SqliteDateTimeFormat, SqliteDateTimeFormatType } from "ts-sql-query/connections/SqliteConfiguration";

class DBConnection extends SqliteConnection<'DBConnection'> {
    protected override getDateTimeFormat(type: SqliteDateTimeFormatType): SqliteDateTimeFormat {
        switch(type) {
            case 'date':
                return 'localdate milliseconds as text'
            case 'time':
                return 'UTC milliseconds as text'
            case 'dateTime':
                return 'Unix time seconds as integer'
        }
    }
    protected override treatUnexpectedIntegerDateTimeAsJulian = false
    protected override treatUnexpectedStringDateTimeAsUTC = true
}
```

## Date and time strategies

SQLite has no types for dates and times: a value is a text or a number, and the strategy says which. A `localDate` is a calendar day in every strategy: it's written as the application reads it, in its own zone, so `2021-09-25` stays the 25th.

### Strategies as text

The text strategies differ in four things: the zone, the separator between the date and the time, a `Z` at the end, and the precision. These are the values they write for 18:00:00.250 of 2021-09-25, with the application in UTC:

| Strategy | Date time | Time | Zone |
|---|---|---|---|
| `localdate seconds as text` | `2021-09-25 18:00:00` | `18:00:00` | The application's |
| `localdate milliseconds as text` *(default)* | `2021-09-25 18:00:00.250` | `18:00:00.250` | The application's |
| `localdate seconds as text using T separator` | `2021-09-25T18:00:00` | `18:00:00` | The application's |
| `localdate milliseconds as text using T separator` | `2021-09-25T18:00:00.250` | `18:00:00.250` | The application's |
| `UTC seconds as text` | `2021-09-25 18:00:00` | `18:00:00` | UTC |
| `UTC milliseconds as text` | `2021-09-25 18:00:00.250` | `18:00:00.250` | UTC |
| `UTC seconds as text using T separator` | `2021-09-25T18:00:00` | `18:00:00` | UTC |
| `UTC milliseconds as text using T separator` | `2021-09-25T18:00:00.250` | `18:00:00.250` | UTC |
| `UTC seconds as text using Z timezone` | `2021-09-25 18:00:00Z` | `18:00:00Z` | UTC |
| `UTC milliseconds as text using Z timezone` | `2021-09-25 18:00:00.250Z` | `18:00:00.250Z` | UTC |
| `UTC seconds as text using T separator and Z timezone` | `2021-09-25T18:00:00Z` | `18:00:00Z` | UTC |
| `UTC milliseconds as text using T separator and Z timezone` | `2021-09-25T18:00:00.250Z` | `18:00:00.250Z` | UTC |

The date is always `2021-09-25`, with no `Z`, because SQLite doesn't accept one after a date alone. The column type is *TEXT*. In JavaScript, always use *1970-01-01* as the date of a time value.

A strategy writes all its values with the same width: with `seconds`, never with decimals; with `milliseconds`, always with three, also when they are `.000`. SQLite compares these values as text, and two widths in the same column would compare wrong: `10:00:00.500Z` sorts before `10:00:00Z`, because a dot sorts before a `Z`.

How to choose the precision:

- **`milliseconds`** keeps the milliseconds of a `Date`. `currentTimestamp()` and `currentTime()` have them too.
- **`seconds`** writes what SQLite's own functions write: `UTC seconds as text` is the text of `current_timestamp` and `datetime('now')`. Choose it when other code writes in the same columns, like a `default current_timestamp` in the schema, a trigger or another tool. The milliseconds of a `Date` are dropped when it's written, and a value compared with a column is dropped to the second too, as in `Unix time seconds as integer`.

Reading accepts any of these texts in any of these strategies, with decimals or without, and with a `Z` or without.

The strategies that read the zone of the application have a limitation: `getTime()`, computed by the database, reads the text as if it were in UTC, so it gives another instant when the application doesn't run in UTC, unless you set [`sqliteRunsInApplicationTimeZone`](#the-date-functions-and-the-time-zone).

### Strategies as numbers

- `Julian day as real number`:
    - Dates and time are expressed as [Julian day](https://en.wikipedia.org/wiki/Julian_day).
    - **Column type in sqlite**: *REAL*
    - **Date format**: *NNNNNNNNNN.5*. Example: `2459482.5` (*2021-09-25*).
    - **Time format**: *0.NNNNNNNNNN*. Example: `0.75` (*18:00:00*). This value is the fraction of the day that has passed since midnight, in UTC, from 0 to 1. In JavaScript, always use *1970-01-01* as the base date when representing a time value.
    - **Date time format**: *NNNNNNNNNN.NNNNNNNNNN*. Example: `2459483.25` (*2021-09-25 18:00:00*)
- `Unix time seconds as integer`
    - Dates and time are expressed as the number of seconds from the beginning of the UNIX time (*1970-01-01*).
    - **Column type in sqlite**: *INTEGER*
    - **Date format**: *NNNNNNNNNN*. Example: `1632528000` (*2021-09-25*).
    - **Time format**: *NNNNNNNNNN*. Example: `64800` (*18:00:00*). This value is a number that expresses the number of seconds for the provided time on the first day of the calendar (*1970-01-01*). In JavaScript, always use *1970-01-01* as the base date when representing a time value.
    - **Date time format**: *NNNNNNNNNN*. Example: `1632592800` (*2021-09-25 18:00:00*)
- `Unix time milliseconds as integer`
    - Dates and time are expressed as the number of milliseconds from the beginning of the UNIX time (*1970-01-01*).
    - **Column type in sqlite**: *INTEGER*
    - **Date format**: *NNNNNNNNNNNNN*. Example: `1632528000000` (*2021-09-25*).
    - **Time format**: *NNNNNNNNNNNNN*. Example: `64800000` (*18:00:00*). This value is a number that expresses the number of milliseconds for the provided time on the first day of the calendar (*1970-01-01*). In JavaScript, always use *1970-01-01* as the base date when representing a time value.
    - **Date time format**: *NNNNNNNNNNNNN*. Example: `1632592800000` (*2021-09-25 18:00:00*)

### Values generated by the database

A value that SQLite writes on its own, like the `default` of a column or a trigger, must have the text of the strategy, or the rows don't compare well with the ones the library writes. These are the expressions that `currentDate()`, `currentTime()` and `currentTimestamp()` use. In a `default`, write them between parentheses: `created_at text default (strftime('%Y-%m-%d %H:%M:%f', 'now', 'localtime'))`.

| Strategy | Date time | Time |
|---|---|---|
| `localdate seconds as text` | `datetime('now', 'localtime')` | `time('now', 'localtime')` |
| `localdate milliseconds as text` | `strftime('%Y-%m-%d %H:%M:%f', 'now', 'localtime')` | `strftime('%H:%M:%f', 'now', 'localtime')` |
| `localdate seconds as text using T separator` | `strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime')` | `time('now', 'localtime')` |
| `localdate milliseconds as text using T separator` | `strftime('%Y-%m-%dT%H:%M:%f', 'now', 'localtime')` | `strftime('%H:%M:%f', 'now', 'localtime')` |
| `UTC seconds as text` | `datetime('now')`, or `current_timestamp` | `time('now')` |
| `UTC milliseconds as text` | `strftime('%Y-%m-%d %H:%M:%f', 'now')` | `strftime('%H:%M:%f', 'now')` |
| `UTC seconds as text using T separator` | `strftime('%Y-%m-%dT%H:%M:%S', 'now')` | `time('now')` |
| `UTC milliseconds as text using T separator` | `strftime('%Y-%m-%dT%H:%M:%f', 'now')` | `strftime('%H:%M:%f', 'now')` |
| `UTC seconds as text using Z timezone` | `strftime('%Y-%m-%d %H:%M:%SZ', 'now')` | `strftime('%H:%M:%SZ', 'now')` |
| `UTC milliseconds as text using Z timezone` | `strftime('%Y-%m-%d %H:%M:%fZ', 'now')` | `strftime('%H:%M:%fZ', 'now')` |
| `UTC seconds as text using T separator and Z timezone` | `strftime('%Y-%m-%dT%H:%M:%SZ', 'now')` | `strftime('%H:%M:%SZ', 'now')` |
| `UTC milliseconds as text using T separator and Z timezone` | `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')` | `strftime('%H:%M:%fZ', 'now')` |
| `Julian day as real number` | `julianday('now')` | `julianday(strftime('1970-01-01 %H:%M:%f', 'now')) - julianday('1970-01-01')` |
| `Unix time seconds as integer` | `unixepoch('now')` | `unixepoch(strftime('1970-01-01 %H:%M:%S', 'now'))` |
| `Unix time milliseconds as integer` | `cast(unixepoch('now', 'subsec') * 1000 as integer)` | `cast(unixepoch(strftime('1970-01-01 %H:%M:%f', 'now'), 'subsec') * 1000 as integer)` |

`current_timestamp` only fits `UTC seconds as text`: in the `localdate` strategies it writes the UTC clock, which is read as the local one, and in the numeric ones it writes a text. `unixepoch()` is from SQLite 3.38 and `'subsec'` from 3.42.

For a date, the library writes the day of the application: `date('now', 'localtime')`. `currentDate()` gives that day in the `localdate` strategies; in the others it gives the UTC day unless you set [`sqliteRunsInApplicationTimeZone`](#the-date-functions-and-the-time-zone).

## The date functions and the time zone

The date functions that the database computes, like `getTime()`, `getHours()` or `currentDate()`, work in UTC. When the process doesn't run in UTC, they can give something different from what JavaScript gives for the same value, with no error.

These are the results with the process in `Europe/Madrid`, for the value `2024-01-14T23:30:15.250Z`, which there is 00:30:15 of the 15th:

| Expression | Formats | JavaScript gives | By default | With `sqliteRunsInApplicationTimeZone` |
|---|---|---|---|---|
| `getTime()` of a date time | `localdate` | `1705275015250` | `1705278615250` | `1705275015250` |
| `getDate()` of a date time | UTC and numeric | `15` | `14` | `15` |
| `getHours()` of a date time | UTC and numeric | `0` | `23` | `0` |
| `getHours()` of a time saved as 18:30 | UTC and numeric | `18` | `17` | `18` |
| `currentDate()` | UTC and numeric | The local day | The UTC day | The local day |

The option says that SQLite runs in the same zone as your application:

```ts
import { SqliteConnection } from "ts-sql-query/connections/SqliteConnection";

class DBConnection extends SqliteConnection<'DBConnection'> {
    protected override sqliteRunsInApplicationTimeZone = true
}
```

What it changes in the SQL:

| Expression | Formats | By default | With the option |
|---|---|---|---|
| `getTime()` | `localdate` | `round(unixepoch(x, 'subsec') * 1000)` | `round(unixepoch(x, 'utc', 'subsec') * 1000)` |
| `getFullYear()`, `getMonth()`, `getDate()`, `getDay()`, `getHours()`, `getMinutes()`, `getSeconds()` of a date time | UTC text, Julian day | `strftime('%H', x)` | `strftime('%H', x, 'localtime')` |
| The same | Unix time | `strftime('%H', x, 'unixepoch')` | `strftime('%H', x, 'unixepoch', 'localtime')` |
| `getHours()`, `getMinutes()`, `getSeconds()` of a time | UTC text | `strftime('%H', x)` | `strftime('%H', '1970-01-01 ' \|\| x, 'localtime')` |
| The same | Julian day | `strftime('%H', x + 2440587.5)` | `strftime('%H', x + 2440587.5, 'localtime')` |
| The same | Unix time | `strftime('%H', x, 'unixepoch')` | `strftime('%H', x, 'unixepoch', 'localtime')` |
| `currentDate()` | UTC and numeric | `date('now')` | `date('now', 'localtime')` |

It changes nothing else, because nothing else depends on the zone: the getters of a `localDate`, which is a calendar day; the getters of a `localdate` text, which is already what the clock said; `getTime()` in the UTC and numeric formats; `getMilliseconds()`; `currentTime()` and `currentTimestamp()`.

What the option costs:

- Those expressions are slower: about 8 times in `getTime()`, over 300,000 rows.
- SQLite rejects them in a `check` and in an index, because their result depends on the zone. An index on `unixepoch(x)` isn't used by `unixepoch(x, 'utc')`.

Use it when you read those functions in a process that doesn't run in UTC. If the process runs in UTC, you don't need it: the results are the same.

The zone must be set when the process starts, with `TZ` or in the operating system. SQLite reads it from the C library, not from JavaScript: on Node, changing `process.env.TZ` afterwards reaches SQLite, and on Bun with `bun:sqlite` it doesn't. So on Bun, in a process started in another zone, `process.env.TZ = 'UTC'` leaves the two zones different: without this option too, `currentTime()` and `currentTimestamp()` in the `localdate` formats are wrong.

!!! warning "A date outside UTC-10 to UTC+13"

    Outside that range, a `localDate` you read gives another day in the local getters of JavaScript, as [Time zones](../time-zones.md#localdate-and-localtime-are-not-affected) says. If you write that `Date` back, that other day is stored.

## Dealing with different date and time formats coming from the database

When a value is returned from the database that is different from the defined strategy, `ts-sql-query` tries to parse the value to respect the format returned from the database and respect the semantic of the expected datatype. You can configure the way how to interpret the value when the default behaviour doesn't match with the situation in the database using the following properties:

- `treatUnexpectedIntegerDateTimeAsJulian`: (default *false*)
    - When a string representation is expected, but a numeric value is received, if the value is an integer, it is treated as UNIX time; if it has decimals, it is treated as Julian day. 
    - The problem with this approach is that any Julian date set at noon is an integer value in JavaScript; then, the value is misunderstood. 
    - However, you can force to ignore the UNIX time and always consider the value as Julian day if you set this property to *true*. 
- `treatUnexpectedStringDateTimeAsUTC`: (default *false*)
    - When a numeric representation is expected (UNIX time or Julian day), but a string representation is received. 
    - If that string representation doesn't have a defined timezone, the value is treated as local date-time (the time zone is the same as the running application). 
    - If you set this property to *true*, you force to treat this case as UTC time.
- `unexpectedUnixDateTimeAreMilliseconds`: (default *false*)
    - When a string representation is expected, but a numeric value is received, if the value is an integer, it is treated as UNIX time; if it has decimals, it is treated as Julian day. 
    - By default, this unexpected UNIX time is understood as the number of seconds from the beginning of the UNIX time (*1970-01-01*).
    - If you set this property to *true*, you force to treat this UNIX time as the number of milliseconds from the beginning of the UNIX time (*1970-01-01*).

## Collations & case sensitivity

SQLite's default collation is case- and accent-**sensitive** for `=` (`BINARY`), but its `LIKE` folds **ASCII** case regardless of the column collation. The built-in collations are only `BINARY`, `NOCASE` (ASCII-only case folding) and `RTRIM` — the npm SQLite builds are non-ICU, so there are no language collations. Force a collation per value with `.collate('BINARY' | 'NOCASE')`, or connection-wide with `insensitiveCollation` — but `.collate()` does not reach `LIKE` (use `PRAGMA case_sensitive_like` for that). `REPLACE` ignores collation, so `replaceAll` is byte-wise case-sensitive; for a case-insensitive replace, register a UDF and set [`replaceAllInsensitiveFunction`](../collations.md#sqlite-register-a-udf-or-accept-the-case-sensitive-fallback). See the dedicated [Collations & case sensitivity](../collations.md) page and the [SQLite tab](../collations.md#per-database). The ASCII-only limitation below is the sharp edge to know about.

## Case-insensitive operations fold ASCII only

SQLite's built-in `lower()` / `upper()` fold the 26 ASCII letters and leave every other character untouched — `lower('CAFÉ')` is `cafÉ`, not `café`. The standard SQLite builds shipped by the npm drivers do not include ICU, so this is what your application gets out of the box.

This affects **every `*Insensitive` operation**. Unless you set `insensitiveCollation`, the library implements them as `lower(a) like lower(b)`, so on SQLite:

```ts
tCustomer.lastName.containsInsensitive('é')   // does NOT match a last name containing 'É'
```

The call is typed and the SQL is valid — the query simply returns fewer rows than the data contains.

**Setting `insensitiveCollation: 'NOCASE'` does not fix this** — SQLite's `NOCASE` collation is also ASCII-only. Without an ICU-enabled SQLite there is no configuration that makes non-ASCII case folding work, so if your data is non-ASCII and you need case-insensitive matching, either normalise the case in your application before storing/querying, or deploy an ICU build and use a collation it provides.

Note that `.length()` is **not** affected: it counts characters correctly on SQLite, including non-ASCII ones.

## UUID strategies

`ts-sql-query` offers you different strategies to handle UUIDs in Sqlite:

- `uuid-extension`: *(default strategy)* In this case, the UUID is represented and stored as `blob` data type of length 16. This requires the [UUID extension](https://sqlite.org/src/file?name=ext/misc/uuid.c) or another compatible implementation (if you use better-sqlite3 you can [provide your own one](../query-runners/recommended/better-sqlite3.md#better-sqlite3-and-uuids)).
- `string`: In this case, the UUID is represented as string and stored in a column with `text` data type and length 36 characters.

You can configure the strategy by overriding the `uuidStrategy` field in your connection class:

```ts
import { SqliteConnection } from "ts-sql-query/connections/SqliteConnection";

class DBConnection extends SqliteConnection<'DBConnection'> {
    protected override uuidStrategy = 'string' as const
}
```

!!! tip "Generating UUIDs"

    When generating UUIDs on the application side, prefer **UUID v7** over UUID v4. With the `'string'` strategy v7 sorts chronologically by lexicographic comparison of its 36-character text representation; with the `'uuid-extension'` strategy this depends on the `uuid_blob` function you register — the snippets recommended in the [better-sqlite3](../query-runners/recommended/better-sqlite3.md#better-sqlite3-and-uuids) and [node:sqlite](../query-runners/recommended/node_sqlite.md#nodesqlite-and-uuids) pages preserve the canonical byte order, so v7 sorts on the primary-key index. See the [column types](../column-types.md) page for more context.

## Exact decimals: the decimal strategies

SQLite has no exact decimal type. A column declared `decimal`, `numeric` or `money` has numeric affinity, and SQLite turns the text of a [`customDecimal`](../column-types.md#exact-decimals) into a floating point number when it stores it: `'1.50'` is stored as `1.5`, and a value of 30 digits loses the last ones, without an error. Store a `customDecimal` in a `TEXT` column of a `STRICT` table, which keeps the text as it was sent and accepts nothing else:

```sql
create table exact_amount (
    id integer primary key,
    amount text,
    price text
) strict;
```

SQLite compares and orders that text as text, and computes with it in floating point. The decimal strategy of the connection says how the library writes the operations of a `customDecimal`:

| Strategy | What the library writes | What it needs | What is exact |
|---|---|---|---|
| `decimal-functions` *(default)* | The functions of SQLite's decimal extension and the `tsq_` functions of the library | The functions below, registered in the connection of the driver | Every operation of a `customDecimal` |
| `decimal-extension` | Only the functions of SQLite's [decimal extension](https://sqlite.org/floatingpoint.html#the_decimal_c_extension): `decimal_add`, `decimal_sub`, `decimal_mul`, `decimal_sum` and `decimal_cmp` | The extension loaded, or the same functions in JavaScript | Storing and reading, `add`, `subtract`, `multiply`, `abs`, `sum`, `minValue`, `maxValue` and every comparison (`equals`, `lessThan`, `in`, `between`, `is`…). The order by, `min`, `max`, `group by`, `distinct` and the compound queries compare the text; `ceil`, `floor`, `round`, `roundn` and `modulo` are rejected with `UNSUPPORTED_QUERY` |
| `text` | Plain SQL | Nothing | Storing and reading, and the equality of the same text (`equals`, `in`, `is`): `'1.5'` and `'1.50'` are different. A range (`lessThan`, `between`…) and an order by compare the numbers the texts are in floating point, exact within about 15 significant digits; `minValue`, `maxValue`, `min`, `max`, `group by`, `distinct` and the compound queries compare the text. The arithmetic of a `customDecimal` (`add`, `subtract`, `multiply`, `modulo`, `abs`, `ceil`, `floor`, `round`, `roundn`, `sum`) is rejected with `UNSUPPORTED_QUERY` before the query is sent |

You can change the strategy by overriding the `decimalStrategy` field in your connection class:

```ts
import { SqliteConnection } from "ts-sql-query/connections/SqliteConnection";

class DBConnection extends SqliteConnection<'DBConnection'> {
    protected override decimalStrategy = 'text' as const
}
```

With `decimal-functions` the library writes these functions, and none of SQLite: the extension's `decimal_add(a, b)`, `decimal_sub(a, b)`, `decimal_mul(a, b)`, `decimal_cmp(a, b)` and the aggregate `decimal_sum(x)`, and its own `tsq_decimal_key(x)` (a text whose order is the order of the numbers, for the order by, the group by and the distinct), `tsq_decimal_abs(x)`, `tsq_decimal_ceil(x)`, `tsq_decimal_floor(x)`, `tsq_decimal_round(x, n)`, `tsq_decimal_mod(a, b)` and the aggregates `tsq_decimal_min(x)` and `tsq_decimal_max(x)`. A query that uses one of them fails with `no such function` when it isn't registered.

This module implements all of them with `BigInt`, with the results of the extension and of the other databases; the page of each driver shows it again with how to register its functions: [better-sqlite3](../query-runners/recommended/better-sqlite3.md#better-sqlite3-and-exact-decimals), [bun:sqlite](../query-runners/recommended/bun_sqlite.md#bunsqlite-and-exact-decimals), [node:sqlite](../query-runners/recommended/node_sqlite.md#nodesqlite-and-exact-decimals) and [sqlite-wasm OO1](../query-runners/recommended/sqlite-wasm-OO1.md#sqlite-wasm-oo1-and-exact-decimals). Bun SQL can't register functions: use the `text` strategy with it.

```typescriptreact title="decimalFunctions.ts"
// The functions the decimal strategies of SqliteConnection write, in JavaScript, for a driver that registers
// functions written in JavaScript. `decimal-extension` writes decimal_add, decimal_sub, decimal_mul, decimal_cmp and
// decimal_sum, the functions of SQLite's decimal extension (ext/misc/decimal.c), with its results; `decimal-functions`
// writes them and the tsq_ ones. The SQLite page of the documentation shows this file as it is.

// The functions of SQLite's decimal extension (ext/misc/decimal.c) that the `decimal-extension` decimal strategy
// writes, in JavaScript, for the connectors that can't load the extension (the SQLite page of the documentation
// gives this same code). They give the results of the extension: decimal_add and decimal_sub keep the largest
// scale, decimal_mul keeps the decimals of both operands but trims the zeros at the end down to the smaller scale,
// decimal_sum keeps the largest scale, is 0 when every value is null and null without rows, decimal_cmp gives -1, 0
// or 1, a null operand gives null, and a zero keeps the sign of the operation that gave it ('-0.00'). The
// extension's decimal_add and decimal_sub fail with "out of memory" on a null operand; these return null (the
// library never sends them one).
export interface ExactDecimal { negative: boolean, digits: bigint, scale: number }
export function parseExactDecimal(value: unknown): ExactDecimal | null {
    if (value === null || value === undefined) return null
    const text = String(value).trim()
    let negative = false
    let i = 0
    if (text[i] === '-') { negative = true; i++ } else if (text[i] === '+') { i++ }
    let digits = ''
    let pointAt = -1
    let exponent = 0
    for (; i < text.length; i++) {
        const c = text[i]!
        if (c >= '0' && c <= '9') {
            digits += c
        } else if (c === '.') {
            pointAt = digits.length
        } else if (c === 'e' || c === 'E') {
            exponent = parseInt(text.substring(i + 1), 10) || 0
            break
        }
    }
    let scale = pointAt < 0 ? 0 : digits.length - pointAt
    let magnitude = BigInt(digits || '0')
    scale -= exponent
    if (scale < 0) {
        magnitude *= 10n ** BigInt(-scale)
        scale = 0
    }
    return { negative: negative && magnitude !== 0n, digits: magnitude, scale }
}
export function formatExactDecimal(value: ExactDecimal): string {
    const text = value.digits.toString().padStart(value.scale + 1, '0')
    const integerPart = text.substring(0, text.length - value.scale)
    const fraction = value.scale > 0 ? '.' + text.substring(text.length - value.scale) : ''
    return (value.negative ? '-' : '') + integerPart + fraction
}
export function addExactDecimals(a: ExactDecimal, b: ExactDecimal): ExactDecimal {
    const scale = Math.max(a.scale, b.scale)
    const x = a.digits * 10n ** BigInt(scale - a.scale)
    const y = b.digits * 10n ** BigInt(scale - b.scale)
    if (a.negative === b.negative) return { negative: a.negative, digits: x + y, scale }
    return x < y ? { negative: !a.negative, digits: y - x, scale } : { negative: a.negative, digits: x - y, scale }
}
export function decimalAdd(a: unknown, b: unknown): string | null {
    const x = parseExactDecimal(a)
    const y = parseExactDecimal(b)
    return x && y ? formatExactDecimal(addExactDecimals(x, y)) : null
}
export function decimalSub(a: unknown, b: unknown): string | null {
    const x = parseExactDecimal(a)
    const y = parseExactDecimal(b)
    return x && y ? formatExactDecimal(addExactDecimals(x, { ...y, negative: !y.negative })) : null
}
export function decimalMul(a: unknown, b: unknown): string | null {
    const x = parseExactDecimal(a)
    const y = parseExactDecimal(b)
    if (!x || !y) return null
    let digits = x.digits * y.digits
    let scale = x.scale + y.scale
    const minScale = Math.min(x.scale, y.scale)
    while (scale > minScale && digits % 10n === 0n) {
        digits /= 10n
        scale--
    }
    return formatExactDecimal({ negative: x.negative !== y.negative, digits, scale })
}
export function decimalCmp(a: unknown, b: unknown): number | null {
    const x = parseExactDecimal(a)
    const y = parseExactDecimal(b)
    if (!x || !y) return null
    const difference = addExactDecimals(x, { ...y, negative: !y.negative })
    return difference.digits === 0n ? 0 : difference.negative ? -1 : 1
}
// decimal_sum: the state is null until a row is seen
export function decimalSumStep(total: ExactDecimal | null, value: unknown): ExactDecimal {
    const sum = total ?? { negative: false, digits: 0n, scale: 0 }
    const x = parseExactDecimal(value)
    return x ? addExactDecimals(sum, x) : sum
}
export function decimalSumResult(total: ExactDecimal | null): string | null {
    return total ? formatExactDecimal(total) : null
}
// The functions of the `decimal-functions` decimal strategy that the decimal extension doesn't have, named with the
// prefix of the library (tsq_) so no function of SQLite or of an extension has their name.
// tsq_decimal_key: a text whose order is the order of the numbers, the same for 1.5 and 1.50: '1' for zero; for a
// positive number '2', its exponent (where the point goes, from the first significant digit) plus 500000000 in 10
// digits, and its significant digits; for a negative number '0', the same with every digit inverted (9 - digit),
// and '~' at the end, so a longer number, of greater magnitude, comes before.
export function decimalKey(value: unknown): string | null {
    const x = parseExactDecimal(value)
    if (!x) return null
    if (x.digits === 0n) return '1'
    const text = x.digits.toString()
    const exponent = (text.length - x.scale + 500000000).toString().padStart(10, '0')
    const significant = text.replace(/0+$/, '')
    if (!x.negative) return '2' + exponent + significant
    const invert = (digits: string) => digits.replace(/[0-9]/g, digit => String(9 - Number(digit)))
    return '0' + invert(exponent) + invert(significant) + '~'
}
// tsq_decimal_abs, tsq_decimal_ceil, tsq_decimal_floor, tsq_decimal_round and tsq_decimal_mod: the operations of
// the other databases on a decimal, with their scales: abs and mod keep the scale (mod the larger of both, with the
// sign of the dividend, null when dividing by zero), ceil and floor have no decimals, and round(x, n) has n decimals
// (none when n is negative), rounding half away from zero.
export function decimalAbs(value: unknown): string | null {
    const x = parseExactDecimal(value)
    return x ? formatExactDecimal({ ...x, negative: false }) : null
}
export function decimalToInteger(value: unknown, up: (negative: boolean) => boolean): string | null {
    const x = parseExactDecimal(value)
    if (!x) return null
    const divisor = 10n ** BigInt(x.scale)
    let digits = x.digits / divisor
    if (x.digits % divisor !== 0n && up(x.negative)) digits += 1n
    return formatExactDecimal({ negative: x.negative && digits !== 0n, digits, scale: 0 })
}
export function decimalCeil(value: unknown): string | null {
    // The magnitude goes up for a positive number and down (truncated) for a negative one
    return decimalToInteger(value, negative => !negative)
}
export function decimalFloor(value: unknown): string | null {
    return decimalToInteger(value, negative => negative)
}
export function decimalRound(value: unknown, places: unknown): string | null {
    const x = parseExactDecimal(value)
    if (!x || places === null || places === undefined) return null
    const n = Number(places)
    if (n >= x.scale) {
        return formatExactDecimal({ ...x, digits: x.digits * 10n ** BigInt(n - x.scale), scale: n })
    }
    const divisor = 10n ** BigInt(x.scale - n)
    let digits = x.digits / divisor
    if ((x.digits % divisor) * 2n >= divisor) digits += 1n
    const scale = Math.max(n, 0)
    if (n < 0) digits *= 10n ** BigInt(-n)
    return formatExactDecimal({ negative: x.negative && digits !== 0n, digits, scale })
}
export function decimalMod(a: unknown, b: unknown): string | null {
    const x = parseExactDecimal(a)
    const y = parseExactDecimal(b)
    if (!x || !y || y.digits === 0n) return null
    const scale = Math.max(x.scale, y.scale)
    const digits = (x.digits * 10n ** BigInt(scale - x.scale)) % (y.digits * 10n ** BigInt(scale - y.scale))
    return formatExactDecimal({ negative: x.negative && digits !== 0n, digits, scale })
}
// tsq_decimal_min and tsq_decimal_max: the value, with its scale, that is the smallest or the largest number; the
// first one when several are equal, and null without values
export interface DecimalChoice { value: unknown, number: ExactDecimal }
export function decimalMinStep(chosen: DecimalChoice | null, value: unknown): DecimalChoice | null {
    const x = parseExactDecimal(value)
    if (!x) return chosen
    return !chosen || decimalCmp(value, chosen.value)! < 0 ? { value, number: x } : chosen
}
export function decimalMaxStep(chosen: DecimalChoice | null, value: unknown): DecimalChoice | null {
    const x = parseExactDecimal(value)
    if (!x) return chosen
    return !chosen || decimalCmp(value, chosen.value)! > 0 ? { value, number: x } : chosen
}
export function decimalChoiceResult(chosen: DecimalChoice | null): unknown {
    return chosen ? chosen.value : null
}
```

A function written in JavaScript costs more than the ones of SQLite. Ordering 100,000 rows of a `TEXT` column, measured on macOS with Bun 1.4 and Node 26: 16 ms by the text and 60 ms by `tsq_decimal_key` on bun:sqlite, 29 ms and 97 ms on node:sqlite, 19 ms and 79 ms on better-sqlite3. A comparison written with `decimal_cmp` can't use an index of the column.

## `stringConcatDistinct` has no separator

SQLite's `GROUP_CONCAT` rejects `DISTINCT` together with a separator argument: `DISTINCT aggregates must have exactly one argument`. So `SqliteConnection` only has `stringConcatDistinct(value)`, with the default separator `,`, and the version with a separator doesn't compile. Use `stringConcat(value, separator)` if you need a separator and don't need `distinct`.

## Compatibility version

The `compatibilityVersion` property says which SQLite version the SQL must work on, encoded as the integer `major * 1_000_000 + minor * 1_000 + patch` — e.g. `3_035_000` for SQLite 3.35.0, `3_029_000` for SQLite 3.29.0. The numeric separator `_` is for readability only (`3_035_000 === 3035000`). The default is `Number.POSITIVE_INFINITY` (latest), so every supported feature is emitted.

You can set this to your real database version (whatever it is) regardless of whether ts-sql-query currently uses it — extra granularity is harmless and future-proof.

Recognised breakpoints (with the default `Number.POSITIVE_INFINITY` every breakpoint below is enabled — the list reads as the bar you need to clear to keep each feature):

- `>= 3_042_000`: target SQLite 3.42+ (released *2023-05-16*). The `'subsec'` modifier (added in SQLite 3.42) is used with `unixepoch()` to obtain Unix-milliseconds values directly, instead of going through `julianday()` arithmetic.
- `>= 3_038_000`: target SQLite 3.38+ (released *2022-02-22*). The `unixepoch()` function (added in SQLite 3.38) is used to obtain Unix-seconds values, instead of `cast(strftime('%s', ...) as integer)`.
- `>= 3_035_000`: target SQLite 3.35+ (released *2021-03-12*). Uses native `NULLS FIRST` / `NULLS LAST` syntax in `ORDER BY`, and the `RETURNING` clause (added in SQLite 3.35 for `DELETE`, `INSERT` and `UPDATE`) on `INSERT` to retrieve the last inserted ID directly from the statement.
- `>= 3_030_000`: target SQLite 3.30 to 3.34 (3.30 released *2019-10-04*). Uses native `NULLS FIRST` / `NULLS LAST` syntax in `ORDER BY`. The `RETURNING` clause is not emitted on `INSERT`; `last_insert_rowid()` is used to retrieve the inserted ID instead.
- `< 3_030_000`: target SQLite 3.29 or older. `NULLS FIRST` / `NULLS LAST` ordering is emulated. The `RETURNING` clause is not emitted on `INSERT`; `last_insert_rowid()` is used to retrieve the inserted ID instead.

```ts
import { SqliteConnection } from "ts-sql-query/connections/SqliteConnection";

class DBConnection extends SqliteConnection<'DBConnection'> {
    protected override compatibilityVersion = 3_029_000
}
```
