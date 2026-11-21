---
search:
  boost: 0.5
---
# MySQL functions

Some queries call a function that MySQL doesn't have built in. This page says what each one is for and when a query calls it; its code is in a file of SQL to run once in the database (see [Creating them](#creating-them)). A query that calls a function the database doesn't have fails with the error of the database for a function that doesn't exist; the other queries work without it, so you only need the functions of what you use.

They are of two kinds:

- **The functions of the library**, whose names start with `tsq_`. The queries of durations call them (see [Dates and times](../../configuration/dates-and-times.md)). Create them with their file, as it is.
- **The optional ones**, `tsq_zoned_wall`, `tsq_zoned_utc` and `tsq_round_to`: a query calls them only with `libraryFunctions = 'installed'` on the connection; without it, the SQL of MySQL does the same, writing the text of the value more times (see each one).
- **Functions of your own**, which on MySQL 5.7, have the names of functions that MySQL has built in from version 8.0, and that the library calls. Their file is an example of them.

## Which function each query needs

| Function | A query calls it when | It calls |
|---|---|---|
| [`tsq_duration_part`](#tsq_duration_part) | it adds a duration of the database, reads its fields, its sign or its total, or negates it | — |
| [`tsq_duration_text`](#tsq_duration_text) | `until` or `since` computes a duration | — |
| [`tsq_duration_round`](#tsq_duration_round) | `until` or `since` in months or years, or rounded to a week, a month or a year | `tsq_duration_text` |
| [`tsq_duration_total`](#tsq_duration_total) | `total` of a duration | — |
| [`tsq_duration_add`](#tsq_duration_add) | `add` or `subtract` of two durations | `tsq_duration_text` |
| [`tsq_zoned_wall`](#tsq_zoned_wall) | the date and time or a part of a zoned date and time kept as its text is read, with `libraryFunctions = 'installed'` | — |
| [`tsq_zoned_utc`](#tsq_zoned_utc) | the instant of a zoned date and time kept as its text is compared, ordered or read, with `libraryFunctions = 'installed'`, before MySQL 8.0.19 | `tsq_zoned_wall` |
| [`tsq_round_to`](#tsq_round_to) | `round` of a time, a date and time or an instant, or `until` or `since` with a rounding, with `libraryFunctions = 'installed'` | — |
| [`UUID_TO_BIN` and `BIN_TO_UUID`](#uuid_to_bin-and-bin_to_uuid-for-mysql-57) | a uuid is read or written with the `'binary'` uuid strategy, on MySQL 5.7 | — |

## Creating them

[`tsq-functions.sql`](functions/tsq-functions.sql) creates every function of the library on MySQL, in the order they need, dropping the one of the same name first: run it as it is, with the client of your database, like `mysql <database> < tsq-functions.sql`, or in the editor you use. Each function is described below; a query that doesn't use one doesn't need it. A query calls the ones of the setting `libraryFunctions` only with it (see each one). The functions that stand in for the ones MySQL 5.7 lacks are in a file of their own.

## `tsq_duration_part`

`tsq_duration_part` reads a part of the ISO 8601 text of a duration: its months, its days, the whole seconds of its time and the nanoseconds of the second, to add it; each field as written; its sign; or its largest field that isn't zero. MySQL keeps a duration as that text, so a query calls it to add a duration the database holds, like a column, to a date or to another duration, to read its fields, its sign or its total, or to negate it. A duration given as a value doesn't need it to be added, and neither does reading, writing or comparing a duration. See [A duration kept as text](../../configuration/dates-and-times.md#a-duration-kept-as-text-the-function-tsq_duration_part).

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_duration_text`

`tsq_duration_text` writes the ISO 8601 text of a duration from its fields, the text of Temporal's `toString`. A query calls it to give the duration that `until` or `since` computes (see [The duration between two dates and times](../../configuration/dates-and-times.md#the-duration-between-two-dates-and-times)), and `tsq_duration_round` and `tsq_duration_add` call it to write their result: create it before them.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_duration_round`

`tsq_duration_round` gives the duration from one date and time to another as Temporal's `until` with a largest unit of weeks, months or years, rounded as Temporal rounds it, counting from the first value. A query calls it when `until` or `since` has a largest unit of a month or a year, and when it rounds to the calendar: a largest unit of a week with a `smallestUnit` or a `roundingIncrement` other than the defaults (see [The options of `until` and `since`](../../configuration/dates-and-times.md#the-options-of-until-and-since)). It calls `tsq_duration_text`.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_duration_total`

`tsq_duration_total` gives a duration in one unit, as Temporal's `total`: it adds the duration to the date of reference, when there is one, and divides with integers, so the `double` is rounded once. A query calls it for every `total` (see [The total of a duration in a unit](../../configuration/dates-and-times.md#the-total-of-a-duration-in-a-unit)). Without a date of reference, a duration with years, months or weeks makes it fail, with an error that says it needs a date of reference.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_duration_add`

`tsq_duration_add` adds or subtracts two durations, as Temporal's `add` and `subtract` of a `Temporal.Duration`: a day is 24 hours, the sum is written up to the largest field of the two, and a duration with years, months or weeks makes it fail. A query calls it for `add` and `subtract` of a duration to another one (see [Durations added and subtracted together](../../configuration/dates-and-times.md#durations-added-and-subtracted-together)). It takes, of each duration, its largest field that isn't zero, which `tsq_duration_part` gives with `'largest'`. It calls `tsq_duration_text`.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_zoned_wall`

`tsq_zoned_wall` gives the date and time of the RFC 9557 text of a zoned date and time, the text before its offset: `2024-03-02T12:05:00+01:00[Europe/Madrid]` is `2024-03-02 12:05:00`. MySQL keeps a zoned date and time as that text (see [How each database keeps a zoned date and time](../../configuration/dates-and-times.md#how-each-database-keeps-a-zoned-date-and-time)), so a query reads its date and time, its parts (`hour()`, `day()`, …) and `toPlainDateTime()` from it. With `libraryFunctions = 'installed'` a query calls it and writes the column once; without it, the query writes the same computation inline, with the column three times. `tsq_zoned_utc` calls it: create it first.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_zoned_utc`

`tsq_zoned_utc` gives the instant of the RFC 9557 text of a zoned date and time as its date and time in UTC: its date and time minus its offset, a `Z` being `+00:00`. A query compares, orders and reads the instant of a zoned date and time with it (`equals`, `lessThan`, `orderBy`, `toInstant()`, `epochMilliseconds()`, …). With `libraryFunctions = 'installed'` a query calls it and writes the column once; without it, the query writes the same computation inline, with the column seven times. From MySQL 8.0.19 the query doesn't call it: MySQL converts the text with its offset itself, with a `cast`.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_round_to`

`tsq_round_to` rounds an integer to a multiple of a step in a rounding mode of Temporal (`'ceil'`, `'floor'`, `'expand'`, `'trunc'`, `'halfCeil'`, `'halfFloor'`, `'halfExpand'`, `'halfTrunc'`, `'halfEven'`), as Temporal rounds: `-90` to a step of `60` in `'halfEven'` is `-120`. A query rounds with it the time since midnight of `round` of a time, a date and time or an instant (see [Changing a field and rounding](../../configuration/dates-and-times.md#changing-a-field-and-rounding)), and the difference of `until` and `since` with a `smallestUnit`, a `roundingIncrement` or a `roundingMode` (see [The options of `until` and `since`](../../configuration/dates-and-times.md#the-options-of-until-and-since)). With `libraryFunctions = 'installed'` the query calls it and writes the value once; without it, the query writes the rounding inline, with the value two to four times.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `UUID_TO_BIN` and `BIN_TO_UUID` for MySQL 5.7

The `'binary'` strategy relies on the `UUID_TO_BIN` / `BIN_TO_UUID` functions, which MySQL provides as built-ins from **version 8.0**. On **MySQL 5.7** they don't exist, so either use the [`'string'` strategy](index.md#uuid-strategies), or create the two functions yourself — MySQL resolves the names case-insensitively, so `ts-sql-query`'s emitted `uuid_to_bin(...)` / `bin_to_uuid(...)` resolve to them. The implementation below matches the 8.0 built-ins with the default swap flag (`0`, natural byte order), so values stored on 5.7 read back identically on 8.0+:

They store the 16 bytes as-is (no version-specific reordering), so they accept any UUID version — unlike MySQL's built-in swap form `UUID_TO_BIN(uuid, 1)`, which reorders the time fields of a v1 UUID. The `NULL` guard in `BIN_TO_UUID` returns `NULL` for a `NULL` input, matching the built-in (an unguarded `CONCAT_WS` would return a stray `----` string). `CHAR` results from a stored function take the database's default collation, so keep the connection collation aligned with it (on 5.7 that is `utf8mb4_general_ci`) to avoid an `Illegal mix of collations` error when a UUID string is compared against a literal.

The code is in [`uuid-functions-mysql-5.7.sql`](functions/uuid-functions-mysql-5.7.sql).
