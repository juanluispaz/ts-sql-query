---
search:
  boost: 0.5
---
# SQL Server functions

Some queries call a function that SQL Server doesn't have built in. This page says what each one is for and when a query calls it; its code is in a file of SQL to run once in the database (see [Creating them](#creating-them)). A query that calls a function the database doesn't have fails with the error of the database for a function that doesn't exist; the other queries work without it, so you only need the functions of what you use.

They are of these kinds, and all of them are in [one file](#creating-them):

- **The ones a query always needs**, the ones of durations: a query that uses one calls it (see [Dates and times](../../configuration/dates-and-times.md)).
- **The optional ones**, `tsq_round_to`, `tsq_ticks_between`, `tsq_time_of_ticks`, `tsq_datetime_of_ticks`, `tsq_duration_sum`, `tsq_duration_total_of`, `tsq_duration_round_of`, `tsq_greatest_strict` and `tsq_least_strict`: a query calls them only with `libraryFunctions = 'installed'` on the connection; without it, the SQL of SQL Server does the same with less (see each one).

## Which function each query needs

| Function | A query calls it when | It calls |
|---|---|---|
| [`tsq_duration_part`](#tsq_duration_part) | it adds a duration of the database, reads its fields, its sign or its total, or negates it | — |
| [`tsq_duration_text`](#tsq_duration_text) | `until` or `since` computes a duration | — |
| [`tsq_duration_round`](#tsq_duration_round) | `until` or `since` in months or years, or rounded to a week, a month or a year | `tsq_duration_text` |
| [`tsq_duration_total`](#tsq_duration_total) | `total` of a duration | — |
| [`tsq_duration_add`](#tsq_duration_add) | `add` or `subtract` of two durations | `tsq_duration_text` |
| [`tsq_round_to`](#tsq_round_to) | `round` of a time, a date and time or an instant, or `until` or `since` with a rounding, with `libraryFunctions = 'installed'` | — |
| [`tsq_ticks_between`](#tsq_ticks_between) | `until` or `since` of two dates and times or two instants, with `libraryFunctions = 'installed'` | — |
| [`tsq_time_of_ticks`](#tsq_time_of_ticks) | `round` of a time, with `libraryFunctions = 'installed'` | — |
| [`tsq_datetime_of_ticks`](#tsq_datetime_of_ticks) | `round` of a date and time or an instant, with `libraryFunctions = 'installed'` | — |
| [`tsq_duration_sum`](#tsq_duration_sum) | `add` or `subtract` of two durations, with `libraryFunctions = 'installed'` | `tsq_duration_part`, `tsq_duration_add` |
| [`tsq_duration_total_of`](#tsq_duration_total_of) | `total` of a duration, with `libraryFunctions = 'installed'` | `tsq_duration_part`, `tsq_duration_total` |
| [`tsq_duration_round_of`](#tsq_duration_round_of) | `until` or `since` of two dates or two dates and times in months or years, or rounded to a week, a month or a year, with `libraryFunctions = 'installed'` | `tsq_duration_round` |
| [`tsq_greatest_strict` and `tsq_least_strict`](#tsq_greatest_strict-and-tsq_least_strict) | `minValue` or `maxValue` is written, with `libraryFunctions = 'installed'` | — |

## Creating them

[`tsq-functions.sql`](functions/tsq-functions.sql) creates every function of the library on SQL Server, in the order they need, dropping the one of the same name first: run it as it is, with the client of your database, like `sqlcmd -d <database> -i tsq-functions.sql`, or in the editor you use. Each function is described below; a query that doesn't use one doesn't need it. `tsq_duration_sum`, `tsq_duration_total_of` and `tsq_duration_round_of` call others with schema binding, which can't be changed while they exist: the file drops them first. A query calls the ones of the setting `libraryFunctions` only with it (see each one).

## `tsq_duration_part`

`tsq_duration_part` reads a part of the ISO 8601 text of a duration: its months, its days, the whole seconds of its time and the nanoseconds of the second, to add it; each field as written; its sign; or its largest field that isn't zero. SQL Server keeps a duration as that text, so a query calls it to add a duration the database holds, like a column, to a date or to another duration, to read its fields, its sign or its total, or to negate it. A duration given as a value doesn't need it to be added, and neither does reading, writing or comparing a duration. See [A duration kept as text](../../configuration/dates-and-times.md#a-duration-kept-as-text-the-function-tsq_duration_part).

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_duration_text`

`tsq_duration_text` writes the ISO 8601 text of a duration from its fields, the text of Temporal's `toString`. A query calls it to give the duration that `until` or `since` computes (see [The duration between two dates and times](../../configuration/dates-and-times.md#the-duration-between-two-dates-and-times)), and `tsq_duration_round` and `tsq_duration_add` call it to write their result: create it before them.

`tsq_duration_round` and `tsq_duration_add` are created `WITH SCHEMABINDING` on it, and SQL Server doesn't change `tsq_duration_text` while they exist. On a database that has them, drop them first with the code below, and create them again after `tsq_duration_text`.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_duration_round`

`tsq_duration_round` gives the duration from one date and time to another as Temporal's `until` with a largest unit of weeks, months or years, rounded as Temporal rounds it, counting from the first value. A query calls it when `until` or `since` has a largest unit of a month or a year, and when it rounds to the calendar: a largest unit of a week with a `smallestUnit` or a `roundingIncrement` other than the defaults (see [The options of `until` and `since`](../../configuration/dates-and-times.md#the-options-of-until-and-since)). It calls `tsq_duration_text`.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_duration_total`

`tsq_duration_total` gives a duration in one unit, as Temporal's `total`: it adds the duration to the date of reference, when there is one, and divides with integers, so the `double` is rounded once. A query calls it for every `total` (see [The total of a duration in a unit](../../configuration/dates-and-times.md#the-total-of-a-duration-in-a-unit)). Without a date of reference, a duration with years, months or weeks makes it fail, with an error converting a text to a number, because a function of SQL Server can't raise one.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_duration_add`

`tsq_duration_add` adds or subtracts two durations, as Temporal's `add` and `subtract` of a `Temporal.Duration`: a day is 24 hours, the sum is written up to the largest field of the two, and a duration with years, months or weeks makes it fail. A query calls it for `add` and `subtract` of a duration to another one (see [Durations added and subtracted together](../../configuration/dates-and-times.md#durations-added-and-subtracted-together)). It takes, of each duration, its largest field that isn't zero, which `tsq_duration_part` gives with `'largest'`. It calls `tsq_duration_text`.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_round_to`

`dbo.tsq_round_to` rounds an integer to a multiple of a step in a rounding mode of Temporal (`'ceil'`, `'floor'`, `'expand'`, `'trunc'`, `'halfCeil'`, `'halfFloor'`, `'halfExpand'`, `'halfTrunc'`, `'halfEven'`), as Temporal rounds: `-90` to a step of `60` in `'halfEven'` is `-120`. A query rounds with it the time since midnight of `round` of a time, a date and time or an instant (see [Changing a field and rounding](../../configuration/dates-and-times.md#changing-a-field-and-rounding)), and the difference of `until` and `since` with a `smallestUnit`, a `roundingIncrement` or a `roundingMode` (see [The options of `until` and `since`](../../configuration/dates-and-times.md#the-options-of-until-and-since)). With `libraryFunctions = 'installed'` the query calls it and writes the value once; without it, the query writes the rounding inline, with the value two to four times.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_ticks_between`

`dbo.tsq_ticks_between` gives the hundreds of nanoseconds, the unit a `datetime2(7)` keeps, from one date and time to another: the days of their dates and the time of their times of the day. A query computes with it the difference of `until` and `since` of two dates and times, and of two instants, in their dates and times in UTC. With `libraryFunctions = 'installed'` the query calls it and writes each value once; without it, the query writes each value twice.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_time_of_ticks`

`dbo.tsq_time_of_ticks` gives the time of the day of a number of hundreds of nanoseconds since midnight, going round at midnight: `round` of a time builds its result with it. With `libraryFunctions = 'installed'` the query calls it and writes the number once; without it, the query writes it twice, in two `dateadd`.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_datetime_of_ticks`

`dbo.tsq_datetime_of_ticks` gives a date plus a number of hundreds of nanoseconds, a `datetime2(7)`: `round` of a date and time or an instant builds its result with it. With `libraryFunctions = 'installed'` the query calls it and writes the number once; without it, the query writes it twice, in two `dateadd`.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_duration_sum`

`dbo.tsq_duration_sum` adds or subtracts two durations given whole, as their ISO 8601 text, the way SQL Server keeps them: it calls `tsq_duration_add` with the parts `tsq_duration_part` reads of each one. With `libraryFunctions = 'installed'` a query calls it for `add` and `subtract` of a duration to another one (see [Durations added and subtracted together](../../configuration/dates-and-times.md#durations-added-and-subtracted-together)), and writes each duration once, a duration given as a value as its ISO 8601 text; without it, the query calls `tsq_duration_add` with the parts of each one, the duration written four times. Create it after `tsq_duration_part` and `tsq_duration_add`.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_duration_total_of`

`dbo.tsq_duration_total_of` gives a duration given whole in one unit, as Temporal's `total`: it calls `tsq_duration_total` with the parts `tsq_duration_part` reads of it. With `libraryFunctions = 'installed'` a query calls it for `total` (see [The total of a duration in a unit](../../configuration/dates-and-times.md#the-total-of-a-duration-in-a-unit)) and writes the duration once; without it, the query writes it five times. A difference that `until` or `since` computes is given by its parts, as without the function. Create it after `tsq_duration_part` and `tsq_duration_total`.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_duration_round_of`

`dbo.tsq_duration_round_of` gives the duration from one date or date and time to another, given whole, as Temporal's `until` in months or years, or rounded to the calendar: it calls `tsq_duration_round` with the year, the month, the day and the nanoseconds of the day of each one. With `libraryFunctions = 'installed'` a query calls it where it would call `tsq_duration_round` (see [The duration between two dates and times](../../configuration/dates-and-times.md#the-duration-between-two-dates-and-times)), except for two months of a year, and writes each value once; without it, the query writes each value four times. Create it after `tsq_duration_round`. A value is given as its date and time in UTC.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_greatest_strict` and `tsq_least_strict`

`minValue` and `maxValue` give NULL when an operand is NULL, as their type says, with a `CASE` around `greatest` and `least`. With `libraryFunctions = 'installed'`, a query calls these functions of the library instead, which give the same and write each operand once (see [Propagating NULL through a function instead of a `CASE`](index.md#propagating-null-through-a-function-instead-of-a-case)); without it, a query doesn't call them. `minValue` returns the larger of the two values, so it calls `tsq_greatest_strict`, and `maxValue` calls `tsq_least_strict`.

A scalar function is not polymorphic on SQL Server, so `float` covers the numeric operands (`int` / `bigint` widen to it), and the `CASE` comparison works on every version (no dependency on the 2022+ `least` / `greatest`):

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).
