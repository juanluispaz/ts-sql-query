---
search:
  boost: 0.5
---
# PostgreSQL functions

Some queries call a function that PostgreSQL doesn't have built in. This page says what each one is for and when a query calls it; its code is in a file of SQL to run once in the database (see [Creating them](#creating-them)). A query that calls a function the database doesn't have fails with the error of the database for a function that doesn't exist; the other queries work without it, so you only need the functions of what you use.

They are of these kinds, and all of them are in [one file](#creating-them):

- **The ones a query always needs**, the ones of durations and of differences of zoned dates and times in days: a query that uses one calls it (see [Dates and times](../../configuration/dates-and-times.md)).
- **The optional ones**, `tsq_zoned_of_wall`, `tsq_zone`, `tsq_zoned_offset`, `tsq_zoned_hours_in_day`, `tsq_zoned_round_day`, `tsq_zoned_plus_date`, `tsq_round_to`, `tsq_duration_sum`, `tsq_duration_total_of`, `tsq_duration_round_of`, `tsq_duration_negated`, `tsq_date_plus_duration`, `tsq_instant_plus_duration`, `tsq_day_in_month_or_error`, `tsq_utc_of_epoch`, `tsq_date_with`, `tsq_greatest_strict` and `tsq_least_strict`: a query calls them only with `libraryFunctions = 'installed'` on the connection; without it, the SQL of PostgreSQL does the same with less (see each one).

## Which function each query needs

| Function | A query calls it when | It calls |
|---|---|---|
| [`tsq_duration_part`](#tsq_duration_part) | a duration of a column that keeps it as text is added, has its fields, its sign or its total read, or is negated | — |
| [`tsq_duration_round`](#tsq_duration_round) | `until` or `since` in months or years, or rounded to a week, a month or a year | — |
| [`tsq_duration_total`](#tsq_duration_total) | `total` of a duration | — |
| [`tsq_duration_add`](#tsq_duration_add) | `add` or `subtract` of two durations | — |
| [`tsq_duration_text`](#tsq_duration_text) | a duration of fields of the query (`connection.duration`) is written in a column that keeps its text | — |
| [`tsq_interval_text`](#tsq_interval_text) | a duration of the query kept in an interval is written in a column that keeps its text | — |
| [`tsq_zoned_of_wall`](#tsq_zoned_of_wall) | a wall clock is taken to its zone, with `libraryFunctions = 'installed'` | — |
| [`tsq_zoned_until`](#tsq_zoned_until) | `until` or `since` of two zoned dates and times, in days or larger units | `tsq_zoned_of_wall` |
| [`tsq_zone`](#tsq_zone) | a zoned date and time whose zone is a value of the query, like the text of a column, is seen in its zone, with `libraryFunctions = 'installed'` | — |
| [`tsq_zoned_offset`](#tsq_zoned_offset) | `offset()` of a zoned date and time, with `libraryFunctions = 'installed'` | `tsq_zone` |
| [`tsq_zoned_hours_in_day`](#tsq_zoned_hours_in_day) | `hoursInDay()` of a zoned date and time, with `libraryFunctions = 'installed'` | `tsq_zone`, `tsq_zoned_of_wall` |
| [`tsq_zoned_round_day`](#tsq_zoned_round_day) | `round` of a zoned date and time to a day, with `libraryFunctions = 'installed'` | `tsq_zone`, `tsq_zoned_of_wall` |
| [`tsq_zoned_plus_date`](#tsq_zoned_plus_date) | `add` or `subtract` of a zoned date and time with years, months, weeks or days, with `libraryFunctions = 'installed'` | `tsq_zone`, `tsq_zoned_of_wall`, `tsq_day_in_month_or_error` |
| [`tsq_round_to`](#tsq_round_to) | `round` in `'halfEven'` of a time, a date and time or an instant, or `until` or `since` with a rounding, with `libraryFunctions = 'installed'` | — |
| [`tsq_duration_sum`](#tsq_duration_sum) | `add` or `subtract` of two durations, with `libraryFunctions = 'installed'` | `tsq_duration_part`, `tsq_duration_add` |
| [`tsq_duration_total_of`](#tsq_duration_total_of) | `total` of a duration, with `libraryFunctions = 'installed'` | `tsq_duration_part`, `tsq_duration_total` |
| [`tsq_duration_round_of`](#tsq_duration_round_of) | `until` or `since` of two dates or two dates and times in months or years, or rounded to a week, a month or a year, with `libraryFunctions = 'installed'` | `tsq_duration_round` |
| [`tsq_duration_negated`](#tsq_duration_negated) | `negated()` of a duration of a column that keeps it as text, with `libraryFunctions = 'installed'` | `tsq_duration_part` |
| [`tsq_date_plus_duration` and `tsq_instant_plus_duration`](#tsq_date_plus_duration-and-tsq_instant_plus_duration) | an interval of the query (a column, a computation) is added to or subtracted from a date or an instant, with `libraryFunctions = 'installed'` | — |
| [`tsq_day_in_month_or_error`](#tsq_day_in_month_or_error) | `add`, `subtract` or `with` of a date or a date and time with `{ overflow: 'reject' }`, with `libraryFunctions = 'installed'` | — |
| [`tsq_utc_of_epoch`](#tsq_utc_of_epoch) | `instantFromEpochMilliseconds` or `instantFromEpochNanoseconds` of a value of the query, with `libraryFunctions = 'installed'` | — |
| [`tsq_date_with`](#tsq_date_with) | `with` of a date, or `toPlainDate` of a month of a year or of a day of a month, with `libraryFunctions = 'installed'` | — |
| [`tsq_greatest_strict` and `tsq_least_strict`](#tsq_greatest_strict-and-tsq_least_strict) | `minValue` or `maxValue` is written, with `libraryFunctions = 'installed'` | — |

## Creating them

[`tsq-functions.sql`](functions/tsq-functions.sql) creates every function of the library on PostgreSQL, in the order they need, dropping the one of the same name first: run it as it is, with the client of your database, like `psql -d <database> -f tsq-functions.sql`, or in the editor you use. Each function is described below; a query that doesn't use one doesn't need it. A query calls the ones of the setting `libraryFunctions` only with it (see each one).

## `tsq_duration_part`

`tsq_duration_part` reads a part of the ISO 8601 text of a duration: its months, its days, the whole seconds of its time and the nanoseconds of the second, to add it; each field as written; its sign; or its largest field that isn't zero. PostgreSQL keeps a duration in an interval, and only a column that keeps it as text needs it (see [A column that keeps a duration in its own way](../../advanced/dates-and-times/storage.md#a-column-that-keeps-a-duration-in-its-own-way)): a query calls it to add a duration of such a column to a date or to another duration, to read its fields, its sign or its total, or to negate it. A duration given as a value doesn't need it to be added, and neither does reading, writing or comparing a duration. See [The functions of the library it uses](../../configuration/durations.md#the-functions-of-the-library-it-uses).

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_duration_round`

`tsq_duration_round` gives the duration from one date and time to another as Temporal's `until` with a largest unit of weeks, months or years, rounded as Temporal rounds it, counting from the first value. A query calls it when `until` or `since` has a largest unit of a month or a year, and when it rounds to the calendar: a largest unit of a week with a `smallestUnit` or a `roundingIncrement` other than the defaults (see [The options of `until` and `since`](../../configuration/plain-dates-and-times.md#the-options-of-until-and-since)).

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_duration_total`

`tsq_duration_total` gives a duration in one unit, as Temporal's `total`: it adds the duration to the date of reference, when there is one, and divides with integers, so the `double` is rounded once. A query calls it for every `total` (see [The total of a duration in a unit](../../configuration/durations.md#the-total-of-a-duration-in-a-unit)). Without a date of reference, a duration with years, months or weeks makes it fail, with an error that says it needs a date of reference.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_duration_add`

`tsq_duration_add` adds or subtracts two durations, as Temporal's `add` and `subtract` of a `Temporal.Duration`: a day is 24 hours, the sum is written up to the largest field of the two, and a duration with years, months or weeks makes it fail. A query calls it for `add` and `subtract` of a duration to another one (see [Durations added and subtracted together](../../configuration/durations.md#durations-added-and-subtracted-together)). It takes, of each duration, its largest field that isn't zero, which `tsq_duration_part` gives with `'largest'`.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_duration_text`

`tsq_duration_text` writes the ISO 8601 text of a duration from its fields, the text of Temporal's `toString`: its years, months, weeks, days, hours and minutes as they are given, and the time in nanoseconds balanced up to the unit it is given. A query calls it when it writes a duration of fields of the query, `connection.duration`, in a column that keeps its text, so its fields are kept as given, as a `Temporal.Duration` sent is written (see [A duration of fields of the query](../../configuration/durations.md#a-duration-of-fields-of-the-query)).

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_interval_text`

`tsq_interval_text` writes the ISO 8601 text of an interval, the one the library writes for a duration it sends: its years and months, its days and its time in hours, minutes and seconds, as PostgreSQL keeps them, with the sign of the duration. A query calls it when it writes a duration of the query kept in an interval, like an `interval` column, in a column that keeps its text (see [How each database keeps a duration](../../advanced/dates-and-times/storage.md#how-each-database-keeps-a-duration)). An interval with parts of different signs, like `-1 days +02:00:00`, which a `Temporal.Duration` can't hold, makes it fail.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_zoned_of_wall`

`tsq_zoned_of_wall` gives the instant of a wall clock in a zone, a name or an offset like `+05:30`, as Temporal's `disambiguation` takes it: `'compatible'`, `'earlier'`, `'later'` or `'reject'`, which fails for a wall clock the zone repeats or skips. `tsq_zoned_until` calls it: create it first. A query calls it in each wall clock taken to its zone when the connection has `libraryFunctions = 'installed'`; without that setting, PostgreSQL takes the later instant of a wall clock its zone repeats (see [A wall clock the zone repeats or skips](../../configuration/zoned-dates-and-times.md#a-wall-clock-the-zone-repeats-or-skips)).

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_zoned_until`

`tsq_zoned_until` gives the duration from one zoned date and time to another as Temporal's `until` with a largest unit of days or larger: it counts the days of the calendar in their zone, each one with its length there (23 or 25 hours where the zone changes its offset), and rounds as Temporal rounds. A query calls it for `until` and `since` of two zoned dates and times in days or larger units (see [The functions of the library it uses](../../configuration/zoned-dates-and-times.md#the-functions-of-the-library-it-uses)). Two zoned dates and times in different zones make it fail, as in Temporal. It calls `tsq_zoned_of_wall`: create it after that one.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_zone`

`tsq_zone` gives a zone of Temporal, a name or an offset like `+05:30`, as `at time zone` takes it: PostgreSQL reads a text like `+05:30` as a POSIX zone, west of UTC, so the sign of an offset is inverted. A query sees a zoned date and time in its zone, to read its date and time, its parts or its arithmetic; when the zone is a value of the query, like the zone in brackets of a column that keeps a zoned date and time as its text (see [How each database keeps a zoned date and time](../../advanced/dates-and-times/storage.md#how-each-database-keeps-a-zoned-date-and-time)), it calls it with `libraryFunctions = 'installed'` and writes the zone once; without it, the query writes a `case` with the zone three times, in every place the zone is used. A zone given as a value is written in the query as PostgreSQL takes it, without the function.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_zoned_offset`

`tsq_zoned_offset` gives the offset of an instant in a zone of Temporal as Temporal writes it: `+01:00`, with its seconds when it has them (`-00:14:44`). A query calls it for `offset()` of a zoned date and time with `libraryFunctions = 'installed'`; without it, the query writes the same computation inline. It calls `tsq_zone`: create it first.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_zoned_hours_in_day`

`tsq_zoned_hours_in_day` gives `hoursInDay()` of a zoned date and time, as Temporal: the hours from the start of its day to the start of the next one in its zone, 23 or 25 where the zone changes its offset that day. With `libraryFunctions = 'installed'` the query calls it and writes the value once; without it, the query writes the start of both days inline. It calls `tsq_zone` and `tsq_zoned_of_wall`: create them first.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_zoned_round_day`

`tsq_zoned_round_day` gives `round` of a zoned date and time to a day, as Temporal: the start of its day or of the next one in its zone, the nearer one by the length of its day, in the mode given. With `libraryFunctions = 'installed'` the query calls it and writes the value once; without it, the query writes the start of both days inline, each one twice. It calls `tsq_zone` and `tsq_zoned_of_wall`: create them first.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_zoned_plus_date`

`tsq_zoned_plus_date` gives `add` and `subtract` of a zoned date and time with years, months, weeks or days, as Temporal: the months and the days added to its wall clock in its zone, the day kept in the month (or the query failing with `{ overflow: 'reject' }` when the month hasn't it), and that wall clock taken back to its zone as `'compatible'` disambiguates it; the value itself when the duration has none of them. The hours and smaller units of the duration are then added to that instant, outside the function. With `libraryFunctions = 'installed'` the query calls it and writes the value once; without it, the query writes the computation inline, with the wall clock in its zone several times. It calls `tsq_zone`, `tsq_zoned_of_wall` and `tsq_day_in_month_or_error`: create them first.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_round_to`

`tsq_round_to` rounds an integer to a multiple of a step in a rounding mode of Temporal (`'ceil'`, `'floor'`, `'expand'`, `'trunc'`, `'halfCeil'`, `'halfFloor'`, `'halfExpand'`, `'halfTrunc'`, `'halfEven'`), as Temporal rounds: `-90` to a step of `60` in `'halfEven'` is `-120`. A query rounds with it the time since midnight of `round` in `'halfEven'` of a time, a date and time or an instant, which PostgreSQL's `date_bin` doesn't round that way (see [Changing a field and rounding](../../configuration/plain-dates-and-times.md#changing-a-field-and-rounding)), and the difference of `until` and `since` with a `smallestUnit`, a `roundingIncrement` or a `roundingMode` (see [The options of `until` and `since`](../../configuration/plain-dates-and-times.md#the-options-of-until-and-since)). With `libraryFunctions = 'installed'` the query calls it and writes the value once; without it, the query writes the rounding inline, with the value three times for `round` and twice for `until` and `since`.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_duration_sum`

`tsq_duration_sum` adds or subtracts two durations given whole, as an `interval` or their ISO 8601 text, for a column that keeps it as text: it calls `tsq_duration_add` with the parts `tsq_duration_part` reads of each one. With `libraryFunctions = 'installed'` a query calls it for `add` and `subtract` of a duration to another one (see [Durations added and subtracted together](../../configuration/durations.md#durations-added-and-subtracted-together)), and writes each duration once, a duration given as a value as its ISO 8601 text; without it, the query calls `tsq_duration_add` with the parts of each one, the duration written four times. It takes each one as an `interval` or as a text, so its parts are read as without it, also of an interval with fields of different signs. Create it after `tsq_duration_part` and `tsq_duration_add`.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_duration_total_of`

`tsq_duration_total_of` gives a duration given whole in one unit, as Temporal's `total`: it calls `tsq_duration_total` with the parts `tsq_duration_part` reads of it. With `libraryFunctions = 'installed'` a query calls it for `total` (see [The total of a duration in a unit](../../configuration/durations.md#the-total-of-a-duration-in-a-unit)) and writes the duration once; without it, the query writes it five times. A difference that `until` or `since` computes is given by its parts, as without the function. Create it after `tsq_duration_part` and `tsq_duration_total`.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_duration_round_of`

`tsq_duration_round_of` gives the duration from one date or date and time to another, given whole, as Temporal's `until` in months or years, or rounded to the calendar: it calls `tsq_duration_round` with the year, the month, the day and the nanoseconds of the day of each one. With `libraryFunctions = 'installed'` a query calls it where it would call `tsq_duration_round` (see [The duration between two dates and times](../../configuration/plain-dates-and-times.md#the-duration-between-two-dates-and-times)), except for two months of a year, and writes each value once; without it, the query writes each value four times. Create it after `tsq_duration_round`.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_duration_negated`

`tsq_duration_negated` negates the ISO 8601 text of a duration: without its minus, or with one; a duration of zero as it is, as Temporal writes it. With `libraryFunctions = 'installed'` a query calls it for `negated()` and writes the text once; without it, the query writes it five times.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_date_plus_duration` and `tsq_instant_plus_duration`

`tsq_date_plus_duration` and `tsq_instant_plus_duration` add an interval of the query, given whole, to a date or an instant, or subtract it, as Temporal's `add` and `subtract` (see [Adding and subtracting a duration](../../configuration/plain-dates-and-times.md#adding-and-subtracting-a-duration)): its years and months first, keeping the day in the month, then its weeks and days, then its time. A date takes the whole days of its time. An instant takes only a duration of hours and smaller units: one with days, weeks, months or years makes the query fail. With `libraryFunctions = 'installed'` a query calls them and writes the duration once; without it, the query writes the same computation inline, with the duration several times.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_day_in_month_or_error`

`tsq_day_in_month_or_error` gives 0, or fails, when the day of a date or a date and time isn't in the month that some months reach from it, as Temporal's `overflow: 'reject'` (see [Rejecting a day the month hasn't](../../configuration/plain-dates-and-times.md#rejecting-a-day-the-month-hasnt)). With `libraryFunctions = 'installed'` a query checks the day with it and writes the value once more; without it, the query writes the value four times more.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_utc_of_epoch`

`tsq_utc_of_epoch` gives the date and time in UTC of an instant given as a number of units since `1970-01-01T00:00Z`, of the nanoseconds given each (`1000000` for milliseconds, `1` for nanoseconds), as Temporal's `Instant.fromEpochMilliseconds` and `fromEpochNanoseconds` (see [The epoch of an instant, and its date and time](../../configuration/instants.md#the-epoch-of-an-instant-and-its-date-and-time)). With `libraryFunctions = 'installed'` a query calls it for a number of the query and writes it once; without it, the query writes it five or six times.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_date_with`

`tsq_date_with` gives a date with the year, the month and the day given in place of its own (a null keeps its own), as Temporal's `with`: a day the month hasn't is its last day, or makes the query fail with `overflow: 'reject'`. With `libraryFunctions = 'installed'` a query calls it for `with` of a date (see [Changing a field and rounding](../../configuration/plain-dates-and-times.md#changing-a-field-and-rounding)) and for `toPlainDate` of a month of a year and of a day of a month (see [A month of a year and a day of a month](../../configuration/months-and-days.md#a-month-of-a-year-and-a-day-of-a-month)), and writes the date once; without it, the query writes it several times.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_greatest_strict` and `tsq_least_strict`

`minValue` and `maxValue` give NULL when an operand is NULL, as their type says, with a `CASE` around `greatest` and `least`. With `libraryFunctions = 'installed'`, a query calls these functions of the library instead, which give the same and write each operand once (see [Propagating NULL through a function instead of a `CASE`](index.md#propagating-null-through-a-function-instead-of-a-case)); without it, a query doesn't call them. `minValue` returns the larger of the two values, so it calls `tsq_greatest_strict`, and `maxValue` calls `tsq_least_strict`.

Create the functions with `anycompatible` (PostgreSQL 14+) so they keep the operand's numeric type — `int` stays `int`, `double precision` stays `double precision`:

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).
