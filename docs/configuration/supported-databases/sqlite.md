---
search:
  boost: 0.59
---
# SQLite

This page describes how `ts-sql-query` integrates with **[SQLite](https://sqlite.org)**, including dialect-specific behaviors, configuration options, and available features. It covers the proper setup of a SQLite connection, guidelines for connection management, and advanced behaviors such as UUID handling.

!!! info

    To configure the database dialect, extend the appropriate database connection class when defining your connection. You must choose the correct database type to ensure that the generated SQL queries follow the dialect expected by that database.

!!! warning "Do not share connections between requests"

    A `ts-sql-query` connection object — along with the query runner instances passed to its constructor — represents a **dedicated connection** to the database.

    Therefore, **you must not share the same connection object between concurrent HTTP requests**. Instead, create a new connection object for each request, along with its own query runners.

    Even if the query runner internally uses a connection pool, the `ts-sql-query` connection still represents a single active connection, acquired from the pool. It must be treated as such and never reused across requests.

## Usage Example

```ts
import { SqliteConnection } from "ts-sql-query/connections/SqliteConnection";

class DBConnection extends SqliteConnection<'DBConnection'> { }
```

!!! tip

    If you use [better-sqlite3](https://www.npmjs.com/package/better-sqlite3) or [sqlite-wasm](https://www.npmjs.com/package/@sqlite.org/sqlite-wasm) to connect to the database you can run your queries synchronously. See [BetterSqlite3QueryRunner](../query-runners/recommended/better-sqlite3.md), [Sqlite3WasmOO1QueryRunner](../query-runners/recommended/sqlite-wasm-OO1.md) and [Synchronous query runners](../../advanced/synchronous-query-runners.md) for more information.

## Working with Date and Time

`ts-sql-query` provides multiple strategies to handle date and time that are compatible with [SQLite’s date and time functions](https://www.sqlite.org/lang_datefunc.html). To define the strategy to be used, you must overwrite the `getDateTimeFormat` function; this function receives as an argument the type of date to handle (`date`, `time`, `dateTime`) and returns the strategy to use for that specific case. In addition, there are three properties (`treatUnexpectedIntegerDateTimeAsJulian`, `treatUnexpectedStringDateTimeAsUTC`, and `unexpectedUnixDateTimeAreMilliseconds`) that allow controlling how unexpected formats are interpreted. Example:

```ts
import { SqliteConnection } from "ts-sql-query/connections/SqliteConnection";
import { SqliteDateTimeFormat, SqliteDateTimeFormatType } from "ts-sql-query/connections/SqliteConfiguration";

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

## Date and type strategies

- `localdate as text`: *(default strategy)*
    - Dates and time are interpreted to be in the same timezone of the running application.
    - **Column type in sqlite**: *TEXT*
    - **Date format**: *YYYY-MM-DD*. Example: `2021-09-25`
    - **Time format**: *HH:MM:SS.SSS*. Example: `18:00:00`. In JavaScript, always use *1970-01-01* as the base date when representing a time value.
    - **Date time format**: *YYYY-MM-DD HH:MM:SS.SSS*. Example: `2021-09-25 18:00:00`
    - **Limitation**: If you get the unix time in the database you will get the wrong value; the returned value will be like that date is in UTC timezone.
- `localdate as text using T separator`
    - Dates and time are interpreted to be in the same timezone of the running application.
    - **Column type in sqlite**: *TEXT*
    - **Date format**: *YYYY-MM-DD*. Example: `2021-09-25`
    - **Time format**: *HH:MM:SS.SSS*. Example: `18:00:00`. In JavaScript, always use *1970-01-01* as the base date when representing a time value.
    - **Date time format**: *YYYY-MM-DD***T***HH:MM:SS.SSS*. Example: `2021-09-25T18:00:00`
    - **Limitation**: If you get the unix time in the database you will get the wrong value; the returned value will be like that date is in UTC timezone.
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
    - **Time format**: *0.NNNNNNNNNN* or *-0.NNNNNNNNNN*. Example: `0.75` (*18:00:00*). This value is a number between -0.5 to 0.5 that express the time on the first day of the calendar (November 24, 4714 BC). In JavaScript, always use *1970-01-01* as the base date when representing a time value.
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

## Compatibility version

The `compatibilityVersion` property declares the minimum SQLite version the generated SQL must support, encoded as the integer `major * 1_000_000 + minor * 1_000 + patch` — e.g. `3_035_000` for SQLite 3.35.0, `3_029_000` for SQLite 3.29.0. The numeric separator `_` is for readability only (`3_035_000 === 3035000`). The default is `Number.POSITIVE_INFINITY` (latest), so every supported feature is emitted.

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

!!! warning "Limitation"

    [SQLite](https://www.sqlite.org/lang_aggfunc.html#groupconcat)'s `GROUP_CONCAT` rejects `DISTINCT` together with a separator argument (the engine raises `DISTINCT aggregates must have exactly one argument`). This is a hard SQLite restriction, not a version-bundled quirk. To prevent emitting SQL the engine will always reject, `ts-sql-query` does not expose the `stringConcatDistinct(value, separator)` overload on [SqliteConnection](sqlite.md) — only the no-separator form `stringConcatDistinct(value)` (default separator `,`) is typed. Use `stringConcat(value, separator)` if you need a custom separator and do not need distinct.
