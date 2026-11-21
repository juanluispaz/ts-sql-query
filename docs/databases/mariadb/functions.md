---
search:
  boost: 0.5
---
# MariaDB functions

Some queries call a function that MariaDB doesn't have built in. This page says what each one is for and when a query calls it; its code is in a file of SQL to run once in the database (see [Creating them](#creating-them)). A query that calls a function the database doesn't have fails with the error of the database for a function that doesn't exist; the other queries work without it, so you only need the functions of what you use.

They are the functions of the library, whose names start with `tsq_`, of two kinds, all of them in [one file](#creating-them):

- **The ones a query always needs**, the ones of durations: a query that uses one calls it (see [Dates and times](../../configuration/dates-and-times.md)).
- **The optional ones**, `tsq_zoned_wall` and `tsq_zoned_utc`: a query calls them only with `libraryFunctions = 'installed'` on the connection; without it, the SQL of MariaDB does the same, writing the text of the value more times (see each one).

## Which function each query needs

| Function | A query calls it when | It calls |
|---|---|---|
| [`tsq_duration_part`](#tsq_duration_part) | it adds a duration of the database, reads its fields, its sign or its total, or negates it | — |
| [`tsq_duration_text`](#tsq_duration_text) | `until` or `since` computes a duration | — |
| [`tsq_duration_round`](#tsq_duration_round) | `until` or `since` in months or years, or rounded to a week, a month or a year | `tsq_duration_text` |
| [`tsq_duration_total`](#tsq_duration_total) | `total` of a duration | — |
| [`tsq_duration_add`](#tsq_duration_add) | `add` or `subtract` of two durations | `tsq_duration_text` |
| [`tsq_zoned_wall`](#tsq_zoned_wall) | the date and time or a part of a zoned date and time kept as its text is read, with `libraryFunctions = 'installed'` | — |
| [`tsq_zoned_utc`](#tsq_zoned_utc) | the instant of a zoned date and time kept as its text is compared, ordered or read, with `libraryFunctions = 'installed'` | `tsq_zoned_wall` |

## Creating them

[`tsq-functions.sql`](functions/tsq-functions.sql) creates every function of the library on MariaDB, in the order they need, dropping the one of the same name first: run it as it is, with the client of your database, like `mariadb <database> < tsq-functions.sql`, or in the editor you use. Each function is described below; a query that doesn't use one doesn't need it. A query calls the ones of the setting `libraryFunctions` only with it (see each one).

## `tsq_duration_part`

`tsq_duration_part` reads a part of the ISO 8601 text of a duration: its months, its days, the whole seconds of its time and the nanoseconds of the second, to add it; each field as written; its sign; or its largest field that isn't zero. MariaDB keeps a duration as that text, so a query calls it to add a duration the database holds, like a column, to a date or to another duration, to read its fields, its sign or its total, or to negate it. A duration given as a value doesn't need it to be added, and neither does reading, writing or comparing a duration. See [A duration kept as text](../../configuration/dates-and-times.md#a-duration-kept-as-text-the-function-tsq_duration_part).

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

`tsq_zoned_wall` gives the date and time of the RFC 9557 text of a zoned date and time, the text before its offset: `2024-03-02T12:05:00+01:00[Europe/Madrid]` is `2024-03-02 12:05:00`. MariaDB keeps a zoned date and time as that text (see [How each database keeps a zoned date and time](../../configuration/dates-and-times.md#how-each-database-keeps-a-zoned-date-and-time)), so a query reads its date and time, its parts (`hour()`, `day()`, …) and `toPlainDateTime()` from it. With `libraryFunctions = 'installed'` a query calls it and writes the column once; without it, the query writes the same computation inline, with the column three times. `tsq_zoned_utc` calls it: create it first.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_zoned_utc`

`tsq_zoned_utc` gives the instant of the RFC 9557 text of a zoned date and time as its date and time in UTC: its date and time minus its offset, a `Z` being `+00:00`. A query compares, orders and reads the instant of a zoned date and time with it (`equals`, `lessThan`, `orderBy`, `toInstant()`, `epochMilliseconds()`, …). With `libraryFunctions = 'installed'` a query calls it and writes the column once; without it, the query writes the same computation inline, with the column seven times.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).
