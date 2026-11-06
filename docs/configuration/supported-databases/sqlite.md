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
                return 'localdate as text'
            case 'time':
                return 'UTC as text'
            case 'dateTime':
                return 'Unix time seconds as integer'
        }
    }
    protected override treatUnexpectedIntegerDateTimeAsJulian = false
    protected override treatUnexpectedStringDateTimeAsUTC = true
}
```

## Date and time strategies

- `localdate as text`: *(default strategy)*
    - Dates and time are interpreted to be in the same timezone of the running application.
    - **Column type in sqlite**: *TEXT*
    - **Date format**: *YYYY-MM-DD*. Example: `2021-09-25`
    - **Time format**: *HH:MM:SS.SSS*. Example: `18:00:00`. In JavaScript, always use *1970-01-01* as the base date when representing a time value.
    - **Date time format**: *YYYY-MM-DD HH:MM:SS.SSS*. Example: `2021-09-25 18:00:00`
    - **Limitation**: `getTime()`, computed by the database, reads the text as if it were in UTC, so it gives another instant when the application doesn't run in UTC.
- `localdate as text using T separator`
    - Dates and time are interpreted to be in the same timezone of the running application.
    - **Column type in sqlite**: *TEXT*
    - **Date format**: *YYYY-MM-DD*. Example: `2021-09-25`
    - **Time format**: *HH:MM:SS.SSS*. Example: `18:00:00`. In JavaScript, always use *1970-01-01* as the base date when representing a time value.
    - **Date time format**: *YYYY-MM-DD***T***HH:MM:SS.SSS*. Example: `2021-09-25T18:00:00`
    - **Limitation**: `getTime()`, computed by the database, reads the text as if it were in UTC, so it gives another instant when the application doesn't run in UTC.
- `UTC as text`
    - Dates and time are interpreted to be in the UTC timezone.
    - **Column type in sqlite**: *TEXT*
    - **Date format**: *YYYY-MM-DD*. Example: `2021-09-25`
    - **Time format**: *HH:MM:SS.SSS*. Example: `18:00:00`. In JavaScript, always use *1970-01-01* as the base date when representing a time value.
    - **Date time format**: *YYYY-MM-DD HH:MM:SS.SSS*. Example: `2021-09-25 18:00:00`
- `UTC as text using T separator`:
    - Dates and time are interpreted to be in the UTC timezone.
    - **Column type in sqlite**: *TEXT*
    - **Date format**: *YYYY-MM-DD*. Example: `2021-09-25`
    - **Time format**: *HH:MM:SS.SSS*. Example: `18:00:00`. In JavaScript, always use *1970-01-01* as the base date when representing a time value.
    - **Date time format**: *YYYY-MM-DD***T***HH:MM:SS.SSS*. Example: `2021-09-25T18:00:00`
- `UTC as text using Z timezone`:
    - Dates and time are interpreted to be in the UTC timezone.
    - **Column type in sqlite**: *TEXT*
    - **Date format**: *YYYY-MM-DD*. Example: `2021-09-25`. No **Z** is used here because it is not supported by sqlite.
    - **Time format**: *HH:MM:SS.SSS***Z**. Example: `18:00:00Z`. In JavaScript, always use *1970-01-01* as the base date when representing a time value.
    - **Date time format**: *YYYY-MM-DD HH:MM:SS.SSS***Z**. Example: `2021-09-25 18:00:00Z`
- `UTC as text using T separator and Z timezone`:
    - Dates and time are interpreted to be in the UTC timezone.
    - **Column type in sqlite**: *TEXT*
    - **Date format**: *YYYY-MM-DD*. Example: `2021-09-25`. No **Z** is used here because it is not supported by sqlite.
    - **Time format**: *HH:MM:SS.SSS***Z**. Example: `18:00:00Z`. In JavaScript, always use *1970-01-01* as the base date when representing a time value.
    - **Date time format**: *YYYY-MM-DD***T***HH:MM:SS.SSS***Z**. Example: `2021-09-25T18:00:00Z`
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
