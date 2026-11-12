---
search:
  boost: 0.59
---
<!-- doc-code-template: sqlite -->
# SQLite

This page has what is particular to SQLite: what it offers and what it doesn't, how to declare its version, how dates are stored, why the insensitive operations only fold ASCII, the UUID strategies, and the versions. To define the connection and map your tables, the pages to read are [Connection](../connection.md) and [Mapping](../mapping.md).

## Defining the connection

```ts
import { SqliteConnection } from "ts-sql-query/sqlite";

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
import { SqliteConnection } from "ts-sql-query/sqlite";
import type { SqliteDateTimeFormat, SqliteDateTimeFormatType } from "ts-sql-query/sqlite";

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
import { SqliteConnection } from "ts-sql-query/sqlite";

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

    Outside that range, a `localDate` you read gives another day in the local getters of JavaScript, as [Time zones](../time-zones.md#read-the-values-with-the-utc-getters) says. If you write that `Date` back, that other day is stored.

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

- `uuid-extension`: *(default strategy)* In this case, the UUID is represented and stored as `blob` data type of length 16. This requires the functions `uuid`, `uuid_str` and `uuid_blob` of the [UUID extension](https://sqlite.org/src/file?name=ext/misc/uuid.c): some builds of SQLite have them built in, like the one of macOS, which Bun uses there, with a `uuid()` of version 4 UUIDs, and on the drivers that register functions written in JavaScript [`registerSqliteFunctions`](#registering-the-functions) registers them, replacing those with a `uuid()` of version 7 UUIDs. To compile and load SQLite's uuid extension yourself, see [SQLite functions and extensions](sqlite-extensions.md).
- `string`: In this case, the UUID is represented as string and stored in a column with `text` data type and length 36 characters. The library sends and reads the text of a uuid in lower case, the case the other strategies and databases give it: a uuid sent in upper case is stored and read in lower case, and an equality with it finds the uuid stored by the library.
- `string as sent`: as `string`, but the text of a uuid is sent and read as it is, in the case it has. A uuid stored in upper case is read in upper case, and an equality compares the text as the column's collation does. Choose it for a column that other applications fill in upper case and compare as it is.

You can configure the strategy by overriding the `uuidStrategy` field in your connection class:

```ts
import { SqliteConnection } from "ts-sql-query/sqlite";

class DBConnection extends SqliteConnection<'DBConnection'> {
    protected override uuidStrategy = 'string' as const
}
```

!!! tip "Generating UUIDs"

    When generating UUIDs on the application side, prefer **UUID v7** over UUID v4. With the `'string'` strategy v7 sorts chronologically by lexicographic comparison of its 36-character text representation; with the `'uuid-extension'` strategy the blob of `uuid_blob` keeps the bytes in the order of the text, so v7 sorts on the primary-key index too. The `uuid()` that `registerSqliteFunctions` registers generates v7. See the [column types](../column-types.md) page for more context.

## Exact decimals: the decimal strategies

SQLite has no exact decimal type. A column declared `decimal`, `numeric` or `money` has numeric affinity, and SQLite turns the text of an [exact decimal](../column-types.md#exact-decimals) (a `stringDecimal` or a `customDecimal`) into a floating point number when it stores it: `'1.50'` is stored as `1.5`, and a value of 30 digits loses the last ones, without an error. Store it in a `TEXT` column of a `STRICT` table, which keeps the text as it was sent and accepts nothing else:

```sql
create table exact_amount (
    id integer primary key,
    amount text,
    price text
) strict;
```

SQLite compares and orders that text as text, and computes with it in floating point. The decimal strategy of the connection says how the library writes the operations of a `stringDecimal` or a `customDecimal`; everything below applies to both. In every strategy an operation is exact, or the library rejects the query with `UNSUPPORTED_QUERY` before sending it; it never gives a number that has lost digits nor rows compared as texts. There are three strategies, each in two variants:

| Strategy | What the library writes | What it needs | What is rejected |
|---|---|---|---|
| `decimal-extension and tsq-functions` | The functions of SQLite's [decimal extension](https://sqlite.org/floatingpoint.html#the_decimal_c_extension) (`decimal_add`, `decimal_sub`, `decimal_mul`, `decimal_sum`, `decimal_cmp`) for the arithmetic, the sums and the comparisons of order; plain SQL for the order by, `min`, `max`, the grouping and `abs`; and the functions of the library `tsq_decimal_ceil`, `tsq_decimal_floor`, `tsq_decimal_round` and `tsq_decimal_mod`, which the extension doesn't have | The extension loaded, or its functions in JavaScript, and the four functions of the library | Nothing |
| `decimal-functions` | The functions of the decimal extension and the ones of the library, also for the order by, the grouping, `min`, `max` and `abs` (`tsq_decimal_key`, `tsq_decimal_min`, `tsq_decimal_max`, `tsq_decimal_abs`) | The functions of the extension and of the library | Nothing |
| `text` | Plain SQL | Nothing | The arithmetic: `add`, `subtract`, `multiply`, `modulo`, `ceil`, `floor`, `round`, `roundn` and `sum` |

Each strategy has a **canonical text** variant, named with ` with canonical text` at the end (`canonical text` for `text`). **The default is `decimal-extension and tsq-functions with canonical text`.** In a canonical text variant the library writes every `customDecimal` in its canonical text: without zeros before the integer part (`0` when it is zero), without zeros at the end of the fraction, and without a minus sign for a zero. `007.50` is written as `7.5`, `-0.00` as `0` and `.5` as `0.5`, in every value it sends (an insert, an update, a comparison) and in every computed value it stores or reads. In return, it takes the values stored as written so, and compares their text directly: an equality, `in`, `notIn`, `is`, the group by, `distinct`, the duplicates of a `union`, `intersect` or `except` and the distinct aggregates compare the text, which is faster and can use an ordinary index of the column (`SEARCH t USING COVERING INDEX` for an equality and an `in`, measured with bun:sqlite). The order by, the ranges, `min` and `max` stay exact as in the strategy without the variant.

| | Without the variant | With canonical text |
|---|---|---|
| What is stored | The text as you send it (`1.50` stays `1.50`) | The canonical text (`1.50` is stored as `1.5`) |
| What is read | The text stored, with its scale | The canonical text: the scale of a value isn't kept |
| Equality, `in`, group by, `distinct` | By the number: `1.5` equals `1.50` | By the text, which is the same for the same number |
| A distinct select with a `customDecimal` column and a `group by` or an aggregate | Rejected: the distinct of its rows would compare their texts | Allowed |
| A value written by something else than the library | Any text of a decimal | Must be in canonical text: a value like `1.50` written by another program, or by SQL you write, isn't equal to `1.5` in an equality, and is a group of its own |

The canonical text is a contract: use a canonical text variant when the library writes the values of those columns, or when you normalize what others write. To turn the values a table already has into their canonical text, run once, for each column:

```sql
update exact_amount set price = (
    select case when i = '' and f = '' then '0'
                else s || (case when i = '' then '0' else i end) || (case when f <> '' then '.' || f else '' end) end
    from (select case when substr(price, 1, 1) = '-' then '-' else '' end as s,
                 ltrim(substr(ltrim(price, '-'), 1, instr(ltrim(price, '-') || '.', '.') - 1), '0') as i,
                 rtrim(substr(ltrim(price, '-'), instr(ltrim(price, '-') || '.', '.') + 1), '0') as f)
) where price is not null;
```

It turns `007.50` into `7.5`, `-0.00` and `0.0` into `0`, `.5` into `0.5`, `1.500` into `1.5`, and leaves `100` as it is.

Plain SQL compares the numbers by their parts: the sign, where the point goes and the significant digits, so `1.5` equals `1.50` and `001.50`, `-0.00` equals `0`, `9` comes before `10`, and two values of 30 digits that differ in the last one are different. It is exact, but without the canonical text it takes longer than a function written in JavaScript, which does that work once per row. On a million rows in canonical text, the median of three runs of the SQL each strategy writes:

In milliseconds, on bun:sqlite 3.51 / node:sqlite 3.53 / better-sqlite3 3.53.4 (macOS), the functions in JavaScript, without an index on the key (with one, the comparisons of `decimal-functions` took under a millisecond on bun:sqlite, see [below](#an-index-on-the-key-of-a-decimal)):

| Operation | `text` | `canonical text` | `decimal-extension and tsq-functions` | `… with canonical text` *(default)* | `decimal-functions` | `… with canonical text` |
|---|---|---|---|---|---|---|
| An equality | 1196 / 1277 / 1046 | 32 / 32 / 31 | 379 / 442 / 331 | 32 / 34 / 31 | 472 / 778 / 604 | 29 / 32 / 30 |
| A range (`greaterThan`) | 1676 / 2124 / 1567 | 1631 / 2010 / 1578 | 441 / 560 / 382 | 440 / 561 / 375 | 492 / 850 / 643 | 499 / 858 / 674 |
| Order by | 3832 / 4773 / 3552 | 1101 / 1225 / 1051 | 3799 / 4725 / 3550 | 1081 / 1225 / 1060 | 841 / 1285 / 986 | 866 / 1280 / 997 |
| Group by | 1548 / 1678 / 1452 | 388 / 551 / 400 | 1546 / 1709 / 1440 | 387 / 550 / 402 | 972 / 1349 / 1046 | 384 / 556 / 402 |
| Distinct | 1595 / 1710 / 1515 | 525 / 1365 / 538 | 1582 / 1748 / 1537 | 508 / 1449 / 523 | 1194 / 1644 / 1322 | 570 / 1462 / 534 |
| `min` and `max` | 3271 / 4393 / 3674 | 1318 / 1818 / 1361 | 3261 / 4318 / 3797 | 1369 / 1841 / 1511 | 1276 / 1372 / 1019 | 1288 / 1350 / 1021 |
| `add`, read | rejected | rejected | 651 / 1035 / 584 | 1008 / 1306 / 830 | 790 / 1034 / 576 | 1058 / 1263 / 829 |
| `sum` | rejected | rejected | 325 / 357 / 290 | 326 / 353 / 287 | 327 / 376 / 285 | 341 / 364 / 289 |

The text as it is, which isn't exact, takes about 30 ms for an equality, 320 ms to 500 ms for the order by and 370 ms to 470 ms for a group by. With the canonical text the equalities and the groupings cost what the text costs, and the order by, `min` and `max` of `decimal-extension and tsq-functions` cost about what the functions of the library cost; without it, plain SQL takes 3 to 4 times longer than `decimal-functions` there. A computed value read in canonical text costs between a quarter and a half more, for the subquery that turns it into its canonical text.

A group of numbers equal with different scales (`1.5` and `1.50`), in a strategy without the canonical text, gives the text of one of its rows; the distinct values (`countDistinct`, `sumDistinct`, `averageDistinct` and the distinct arrays) are the distinct numbers, each in its normal form: `1.50` is `1.5`.

You can change the strategy by overriding the `decimalStrategy` field in your connection class:

```ts
import { SqliteConnection } from "ts-sql-query/sqlite";

class DBConnection extends SqliteConnection<'DBConnection'> {
    protected override decimalStrategy = 'decimal-functions with canonical text' as const
}
```

The strategies with functions write these ones, and none of SQLite: the extension's `decimal_add(a, b)`, `decimal_sub(a, b)`, `decimal_mul(a, b)`, `decimal_cmp(a, b)` and the aggregate `decimal_sum(x)`, and the library's `tsq_decimal_ceil(x)`, `tsq_decimal_floor(x)`, `tsq_decimal_round(x, n)` and `tsq_decimal_mod(a, b)`; `decimal-functions` also `tsq_decimal_key(x)` (a text whose order is the order of the numbers, for the order by, the group by and the distinct), `tsq_decimal_abs(x)` and the aggregates `tsq_decimal_min(x)` and `tsq_decimal_max(x)`. The library's functions start with `tsq_`, so no function of SQLite or of an extension has their name. A query that uses one of them fails with `no such function` when the database doesn't have it.

### Registering the functions

On the drivers that register functions written in JavaScript, one call of `registerSqliteFunctions` registers all of them, with the ones of the [uuid strategy](#uuid-strategies) and `ci_replace`: see the page of [better-sqlite3](../query-runners/recommended/better-sqlite3.md#the-sql-functions-of-the-library), [bun:sqlite](../query-runners/recommended/bun_sqlite.md#the-sql-functions-of-the-library), [node:sqlite](../query-runners/recommended/node_sqlite.md#the-sql-functions-of-the-library) or [sqlite-wasm OO1](../query-runners/recommended/sqlite-wasm-OO1.md#the-sql-functions-of-the-library). The functions are written with `BigInt` and give the results of SQLite's decimal extension and, for the library's own, of the other databases. A decimal function or a `ci_replace` the database already has with the same name and number of arguments is left as it is: with SQLite's decimal extension loaded before the call, its functions, written in C, compute, and the call adds the library's own. The uuid functions are always registered, replacing the ones the database has (the `uuid()` of SQLite's uuid extension generates version 4 UUIDs, which don't sort by time); `skip` keeps them. To compile and load SQLite's decimal and uuid extensions, written in C, see [SQLite functions and extensions](sqlite-extensions.md).

!!! warning "Bun SQL can't register functions"

    Bun SQL for SQLite has no way to register a function nor to load an extension, so the strategies with functions don't work with it. With it, use the `canonical text` strategy (or `text`), which compares, orders and groups exactly and rejects the arithmetic; or, on Bun, use [bun:sqlite](../query-runners/recommended/bun_sqlite.md), which registers them.

### An index on the key of a decimal

With `decimal-functions` and its canonical text variant, the comparisons and the order by of a `customDecimal` use its key: `price.greaterThan('9.5')` is `tsq_decimal_key(price) > tsq_decimal_key(?)`, and without the canonical text the equality and `in` too. `registerSqliteFunctions` registers `tsq_decimal_key` as deterministic, so SQLite takes an index on that expression, and uses it for the same expression in a query:

```sql
create index exact_amount_price_key on exact_amount (tsq_decimal_key(price));
```

On a million rows with bun:sqlite, an equality, an `in` and a range with that index take under a millisecond (`SEARCH t USING COVERING INDEX`) where without it they take about half a second, and the order by reads the index (`SCAN t USING INDEX`) instead of sorting. Without the index, comparing by the key takes longer than comparing with `decimal_cmp`, which the other strategies with functions write: on a million rows, an equality takes 472 ms instead of 375 ms on bun:sqlite, 778 ms instead of 426 ms on node:sqlite and 604 ms instead of 330 ms on better-sqlite3. Create the index on the columns you compare or order by.

The index has two costs:

- Without the function registered, the table can still be read, but not written: an insert fails with `unknown function: tsq_decimal_key()`. Register the functions on every connection that writes it.
- With `pragma trusted_schema = off`, SQLite takes in the schema only the functions marked as innocuous, and only sqlite-wasm can mark them: on better-sqlite3, node:sqlite and bun:sqlite creating the index fails with `unsafe use of tsq_decimal_key()`.

A function written in JavaScript costs more than the ones of SQLite. Ordering 100,000 rows of a `TEXT` column, measured on macOS with Bun 1.4 and Node 26: 16 ms by the text and 60 ms by `tsq_decimal_key` on bun:sqlite, 29 ms and 97 ms on node:sqlite, 19 ms and 79 ms on better-sqlite3.

## `stringConcatDistinct` has no separator

SQLite's `GROUP_CONCAT` rejects `DISTINCT` together with a separator argument: `DISTINCT aggregates must have exactly one argument`. So `SqliteConnection` only has `stringConcatDistinct(value)`, with the default separator `,`, and the version with a separator doesn't compile. Use `stringConcat(value, separator)` if you need a separator and don't need `distinct`.

## The scale of `roundn`

The scale of `roundn` is a whole number of decimals. SQLite truncates a fractional one: its `round(2.345, 1.6)` is `2.3`, rounded to 1 decimal, while PostgreSQL, MySQL and MariaDB round the scale and give `2.35`. ts-sql-query rounds the scale on every database, ties away from zero, so `roundn(1.6)` is 2 decimals here too: a number is sent rounded (`round(?1, ?2)` with the params `[2.345, 2]`), and an expression that isn't an integer, like `priority.divide(2)`, is written rounded (`round(<scale>)`). An integer scale is sent and written as it is.

To keep SQLite's native behavior, set `usePlatformDependentRound = true` on the connection: the scale is then sent and written as it is, and SQLite truncates it.

```ts
import { SqliteConnection } from "ts-sql-query/sqlite";

class DBConnection extends SqliteConnection<'DBConnection'> {
    protected override usePlatformDependentRound = true
}
```

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
import { SqliteConnection } from "ts-sql-query/sqlite";

class DBConnection extends SqliteConnection<'DBConnection'> {
    protected override compatibilityVersion = 3_029_000
}
```
