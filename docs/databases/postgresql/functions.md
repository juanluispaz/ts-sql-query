---
search:
  boost: 0.5
---
# PostgreSQL functions

Some queries call a function that PostgreSQL doesn't have built in. This page says what each one is for and when a query calls it; its code is in a file of SQL to run once in the database (see [Creating them](#creating-them)). A query that calls a function the database doesn't have fails with the error of the database for a function that doesn't exist; the other queries work without it, so you only need the functions of what you use.

They are of these kinds, and all of them are in [one file](#creating-them):

- **The ones a query always needs**, the ones of durations and of differences of zoned dates and times in days: a query that uses one calls it (see [Dates and times](../../configuration/dates-and-times.md)).
- **The optional ones**, `tsq_zoned_of_wall`, `tsq_zone`, `tsq_zoned_offset`, `tsq_greatest_strict` and `tsq_least_strict`: a query calls them only with `libraryFunctions = 'installed'` on the connection; without it, the SQL of PostgreSQL does the same with less (see each one).

## Which function each query needs

| Function | A query calls it when | It calls |
|---|---|---|
| [`tsq_duration_part`](#tsq_duration_part) | a duration of a column that keeps it as text is added, has its fields, its sign or its total read, or is negated | — |
| [`tsq_duration_round`](#tsq_duration_round) | `until` or `since` in months or years, or rounded to a week, a month or a year | — |
| [`tsq_duration_total`](#tsq_duration_total) | `total` of a duration | — |
| [`tsq_duration_add`](#tsq_duration_add) | `add` or `subtract` of two durations | — |
| [`tsq_zoned_of_wall`](#tsq_zoned_of_wall) | a wall clock is taken to its zone, with `libraryFunctions = 'installed'` | — |
| [`tsq_zoned_until`](#tsq_zoned_until) | `until` or `since` of two zoned dates and times, in days or larger units | `tsq_zoned_of_wall` |
| [`tsq_zone`](#tsq_zone) | a zoned date and time whose zone is a value of the query, like the text of a column, is seen in its zone, with `libraryFunctions = 'installed'` | — |
| [`tsq_zoned_offset`](#tsq_zoned_offset) | `offset()` of a zoned date and time, with `libraryFunctions = 'installed'` | `tsq_zone` |
| [`tsq_greatest_strict` and `tsq_least_strict`](#tsq_greatest_strict-and-tsq_least_strict) | `minValue` or `maxValue` is written, with `libraryFunctions = 'installed'` | — |

## Creating them

[`tsq-functions.sql`](functions/tsq-functions.sql) creates every function of the library on PostgreSQL, in the order they need, dropping the one of the same name first: run it as it is, with the client of your database, like `psql -d <database> -f tsq-functions.sql`, or in the editor you use. Each function is described below; a query that doesn't use one doesn't need it. A query calls the ones of the setting `libraryFunctions` only with it (see each one).

## `tsq_duration_part`

`tsq_duration_part` reads a part of the ISO 8601 text of a duration: its months, its days, the whole seconds of its time and the nanoseconds of the second, to add it; each field as written; its sign; or its largest field that isn't zero. PostgreSQL keeps a duration in an interval, and only a column that keeps it as text needs it (see [A column that keeps it in its own way](../../configuration/dates-and-times.md#a-column-that-keeps-it-in-its-own-way)): a query calls it to add a duration of such a column to a date or to another duration, to read its fields, its sign or its total, or to negate it. A duration given as a value doesn't need it to be added, and neither does reading, writing or comparing a duration. See [A duration kept as text](../../configuration/dates-and-times.md#a-duration-kept-as-text-the-function-tsq_duration_part).

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_duration_round`

`tsq_duration_round` gives the duration from one date and time to another as Temporal's `until` with a largest unit of weeks, months or years, rounded as Temporal rounds it, counting from the first value. A query calls it when `until` or `since` has a largest unit of a month or a year, and when it rounds to the calendar: a largest unit of a week with a `smallestUnit` or a `roundingIncrement` other than the defaults (see [The options of `until` and `since`](../../configuration/dates-and-times.md#the-options-of-until-and-since)).

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_duration_total`

`tsq_duration_total` gives a duration in one unit, as Temporal's `total`: it adds the duration to the date of reference, when there is one, and divides with integers, so the `double` is rounded once. A query calls it for every `total` (see [The total of a duration in a unit](../../configuration/dates-and-times.md#the-total-of-a-duration-in-a-unit)). Without a date of reference, a duration with years, months or weeks makes it fail, with an error that says it needs a date of reference.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_duration_add`

`tsq_duration_add` adds or subtracts two durations, as Temporal's `add` and `subtract` of a `Temporal.Duration`: a day is 24 hours, the sum is written up to the largest field of the two, and a duration with years, months or weeks makes it fail. A query calls it for `add` and `subtract` of a duration to another one (see [Durations added and subtracted together](../../configuration/dates-and-times.md#durations-added-and-subtracted-together)). It takes, of each duration, its largest field that isn't zero, which `tsq_duration_part` gives with `'largest'`.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_zoned_of_wall`

`tsq_zoned_of_wall` gives the instant of a wall clock in a zone, a name or an offset like `+05:30`, as Temporal's `disambiguation` takes it: `'compatible'`, `'earlier'`, `'later'` or `'reject'`, which fails for a wall clock the zone repeats or skips. `tsq_zoned_until` calls it: create it first. A query calls it in each wall clock taken to its zone when the connection has `libraryFunctions = 'installed'`; without that setting, PostgreSQL takes the later instant of a wall clock its zone repeats (see [A wall clock the zone repeats or skips](../../configuration/dates-and-times.md#a-wall-clock-the-zone-repeats-or-skips)).

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_zoned_until`

`tsq_zoned_until` gives the duration from one zoned date and time to another as Temporal's `until` with a largest unit of days or larger: it counts the days of the calendar in their zone, each one with its length there (23 or 25 hours where the zone changes its offset), and rounds as Temporal rounds. A query calls it for `until` and `since` of two zoned dates and times in days or larger units (see [The functions `tsq_zoned_until` and `tsq_zoned_of_wall`](../../configuration/dates-and-times.md#the-functions-tsq_zoned_until-and-tsq_zoned_of_wall)). Two zoned dates and times in different zones make it fail, as in Temporal. It calls `tsq_zoned_of_wall`: create it after that one.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_zone`

`tsq_zone` gives a zone of Temporal, a name or an offset like `+05:30`, as `at time zone` takes it: PostgreSQL reads a text like `+05:30` as a POSIX zone, west of UTC, so the sign of an offset is inverted. A query sees a zoned date and time in its zone, to read its date and time, its parts or its arithmetic; when the zone is a value of the query, like the zone in brackets of a column that keeps a zoned date and time as its text (see [How each database keeps a zoned date and time](../../configuration/dates-and-times.md#how-each-database-keeps-a-zoned-date-and-time)), it calls it with `libraryFunctions = 'installed'` and writes the zone once; without it, the query writes a `case` with the zone three times, in every place the zone is used. A zone given as a value is written in the query as PostgreSQL takes it, without the function.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_zoned_offset`

`tsq_zoned_offset` gives the offset of an instant in a zone of Temporal as Temporal writes it: `+01:00`, with its seconds when it has them (`-00:14:44`). A query calls it for `offset()` of a zoned date and time with `libraryFunctions = 'installed'`; without it, the query writes the same computation inline. It calls `tsq_zone`: create it first.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_greatest_strict` and `tsq_least_strict`

`minValue` and `maxValue` give NULL when an operand is NULL, as their type says, with a `CASE` around `greatest` and `least`. With `libraryFunctions = 'installed'`, a query calls these functions of the library instead, which give the same and write each operand once (see [Propagating NULL through a function instead of a `CASE`](index.md#propagating-null-through-a-function-instead-of-a-case)); without it, a query doesn't call them. `minValue` returns the larger of the two values, so it calls `tsq_greatest_strict`, and `maxValue` calls `tsq_least_strict`.

Create the functions with `anycompatible` (PostgreSQL 14+) so they keep the operand's numeric type — `int` stays `int`, `double precision` stays `double precision`:

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).
