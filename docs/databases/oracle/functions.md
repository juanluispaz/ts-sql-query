---
search:
  boost: 0.5
---
# Oracle functions

Some queries call a function that Oracle doesn't have built in. This page says what each one is for and when a query calls it; its code is in a file of SQL to run once in the database (see [Creating them](#creating-them)). A query that calls a function the database doesn't have fails with the error of the database for a function that doesn't exist; the other queries work without it, so you only need the functions of what you use.

They are of these kinds:

- **The ones a query always needs**, the ones of durations and of differences of zoned dates and times in days: a query that uses one calls it (see [Dates and times](../../configuration/dates-and-times.md)).
- **The optional ones**, `tsq_zoned_of_wall`, `tsq_zoned_of_text`, `tsq_zoned_hours_in_day`, `tsq_zoned_round_day`, `tsq_zoned_plus_date`, `tsq_round_to`, `tsq_datetime_round`, `tsq_nanoseconds_between`, `tsq_duration_sum`, `tsq_duration_total_of`, `tsq_duration_round_of`, `tsq_ds_interval_text`, `tsq_ym_interval_text`, `tsq_duration_negated`, `tsq_time_plus_duration`, `tsq_instant_plus_duration`, `tsq_day_in_month_or_error`, `tsq_utc_of_epoch`, `tsq_date_with`, the SQL macros of the Temporal values and `tsq_string_util.concat_strict`: a query calls them only with `libraryFunctions = 'installed'` on the connection; without it, the SQL of Oracle does the same with less (see each one).
- **The ones of the uuid strategy** `'custom-functions'`, `tsq_uuid_to_raw` and `tsq_raw_to_uuid`, in two forms to choose, in files of their own.

## Which function each query needs

| Function | A query calls it when | It calls |
|---|---|---|
| [`tsq_duration_part`](#tsq_duration_part) | a duration of a column that keeps it as text is added, has its fields, its sign or its total read, or is negated | — |
| [`tsq_duration_text`](#tsq_duration_text) | `until` or `since` computes a duration | — |
| [`tsq_duration_round`](#tsq_duration_round) | `until` or `since` in months or years, or rounded to a week, a month or a year | `tsq_duration_text` |
| [`tsq_duration_total`](#tsq_duration_total) | `total` of a duration | — |
| [`tsq_duration_add`](#tsq_duration_add) | `add` or `subtract` of two durations | `tsq_duration_text` |
| [`tsq_zoned_of_wall`](#tsq_zoned_of_wall) | a wall clock is taken to its zone, with `libraryFunctions = 'installed'` | — |
| [`tsq_zoned_until`](#tsq_zoned_until) | `until` or `since` of two zoned dates and times, in days or larger units | `tsq_duration_text`, `tsq_zoned_of_wall` |
| [`tsq_zoned_of_text`](#tsq_zoned_of_text) | a zoned date and time kept as its text is compared, ordered, read or computed with, with `libraryFunctions = 'installed'` | — |
| [`tsq_zoned_hours_in_day`](#tsq_zoned_hours_in_day) | `hoursInDay()` of a zoned date and time, with `libraryFunctions = 'installed'` | `tsq_zoned_of_wall` |
| [`tsq_zoned_round_day`](#tsq_zoned_round_day) | `round` of a zoned date and time to a day, with `libraryFunctions = 'installed'` | `tsq_zoned_of_wall` |
| [`tsq_zoned_plus_date`](#tsq_zoned_plus_date) | `add` or `subtract` of a zoned date and time with years, months, weeks or days, with `libraryFunctions = 'installed'` | `tsq_zoned_of_wall`, `tsq_day_in_month_or_error` |
| [`tsq_round_to`](#tsq_round_to) | `round` of a time, a date and time or an instant, or `until` or `since` with a rounding, with `libraryFunctions = 'installed'` | — |
| [`tsq_datetime_round`](#tsq_datetime_round) | `round` of a date and time, an instant or the wall clock of a zoned date and time, with `libraryFunctions = 'installed'` | `tsq_round_to` |
| [`tsq_nanoseconds_between`](#tsq_nanoseconds_between) | `until` or `since` of two dates and times or two instants, with `libraryFunctions = 'installed'` | — |
| [`tsq_duration_sum`](#tsq_duration_sum) | `add` or `subtract` of two durations, with `libraryFunctions = 'installed'` | `tsq_duration_part`, `tsq_duration_add` |
| [`tsq_duration_total_of`](#tsq_duration_total_of) | `total` of a duration, with `libraryFunctions = 'installed'` | `tsq_duration_part`, `tsq_duration_total` |
| [`tsq_duration_round_of`](#tsq_duration_round_of) | `until` or `since` of two dates or two dates and times in months or years, or rounded to a week, a month or a year, with `libraryFunctions = 'installed'` | `tsq_duration_round` |
| [`tsq_ds_interval_text` and `tsq_ym_interval_text`](#tsq_ds_interval_text-and-tsq_ym_interval_text) | a duration kept in an interval is added, subtracted or has its total computed, with `libraryFunctions = 'installed'` | — |
| [`tsq_duration_negated`](#tsq_duration_negated) | `negated()` of a duration of a column that keeps it as text, with `libraryFunctions = 'installed'` | `tsq_duration_part` |
| [`tsq_time_plus_duration` and `tsq_instant_plus_duration`](#tsq_time_plus_duration-and-tsq_instant_plus_duration) | an interval of days to seconds of the query (a column, a computation) is added to or subtracted from a time or an instant, with `libraryFunctions = 'installed'` | — |
| [`tsq_day_in_month_or_error`](#tsq_day_in_month_or_error) | `add`, `subtract` or `with` of a date or a date and time with `{ overflow: 'reject' }`, with `libraryFunctions = 'installed'` | — |
| [`tsq_utc_of_epoch`](#tsq_utc_of_epoch) | `instantFromEpochMilliseconds` or `instantFromEpochNanoseconds` of a value of the query, with `libraryFunctions = 'installed'` | — |
| [`tsq_date_with`](#tsq_date_with) | `with` of a date, or `toPlainDate` of a month of a year or of a day of a month, with `libraryFunctions = 'installed'` | — |
| [The SQL macros of the Temporal values](#the-sql-macros-of-the-temporal-values) | a Temporal value is read, with `libraryFunctions = 'installed'`, from Oracle 23.4 | — |
| [`tsq_string_util.concat_strict`](#tsq_string_utilconcat_strict) | `concat` or an affix pattern is written, with `libraryFunctions = 'installed'` | — |
| [`tsq_uuid_to_raw` and `tsq_raw_to_uuid`](#tsq_uuid_to_raw-and-tsq_raw_to_uuid) | a uuid is read or written with the `'custom-functions'` uuid strategy | — |

## Creating them

[`tsq-functions.sql`](functions/tsq-functions.sql) creates every function of the library on Oracle, in the order they need, dropping the one of the same name first: run it as it is, with the client of your database, like `sqlplus <user>/<password>@<service> @tsq-functions.sql`, or in the editor you use. Each function is described below; a query that doesn't use one doesn't need it. A query calls the ones of the setting `libraryFunctions` only with it (see each one).

## `tsq_duration_part`

`tsq_duration_part` reads a part of the ISO 8601 text of a duration: its months, its days, the whole seconds of its time and the nanoseconds of the second, to add it; each field as written; its sign; or its largest field that isn't zero. Oracle keeps a duration in an interval, and only a column that keeps it as text needs it (see [A column that keeps a duration in its own way](../../advanced/dates-and-times/storage.md#a-column-that-keeps-a-duration-in-its-own-way)): a query calls it to add a duration of such a column to a date or to another duration, to read its fields, its sign or its total, or to negate it. A duration given as a value doesn't need it to be added, and neither does reading, writing or comparing a duration. See [The functions of the library it uses](../../configuration/durations.md#the-functions-of-the-library-it-uses).

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_duration_text`

`tsq_duration_text` writes the ISO 8601 text of a duration from its fields, the text of Temporal's `toString`. A query calls it to give the duration that `until` or `since` computes (see [The duration between two dates and times](../../configuration/plain-dates-and-times.md#the-duration-between-two-dates-and-times)), and `tsq_duration_round`, `tsq_duration_add` and `tsq_zoned_until` call it to write their result: create it before them.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_duration_round`

`tsq_duration_round` gives the duration from one date and time to another as Temporal's `until` with a largest unit of weeks, months or years, rounded as Temporal rounds it, counting from the first value. A query calls it when `until` or `since` has a largest unit of a month or a year, and when it rounds to the calendar: a largest unit of a week with a `smallestUnit` or a `roundingIncrement` other than the defaults (see [The options of `until` and `since`](../../configuration/plain-dates-and-times.md#the-options-of-until-and-since)). It calls `tsq_duration_text`.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_duration_total`

`tsq_duration_total` gives a duration in one unit, as Temporal's `total`: it adds the duration to the date of reference, when there is one, and divides with integers, so the `double` is rounded once. A query calls it for every `total` (see [The total of a duration in a unit](../../configuration/durations.md#the-total-of-a-duration-in-a-unit)). Without a date of reference, a duration with years, months or weeks makes it fail, with an error that says it needs a date of reference.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_duration_add`

`tsq_duration_add` adds or subtracts two durations, as Temporal's `add` and `subtract` of a `Temporal.Duration`: a day is 24 hours, the sum is written up to the largest field of the two, and a duration with years, months or weeks makes it fail. A query calls it for `add` and `subtract` of a duration to another one (see [Durations added and subtracted together](../../configuration/durations.md#durations-added-and-subtracted-together)). It takes, of each duration, its largest field that isn't zero, which `tsq_duration_part` gives with `'largest'`. It calls `tsq_duration_text`.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_zoned_of_wall`

`tsq_zoned_of_wall` gives the instant of a wall clock (a `TIMESTAMP`) in a zone, a region or an offset like `+05:30`, as a `TIMESTAMP WITH TIME ZONE` in it, as Temporal's `disambiguation` takes it: `'compatible'`, `'earlier'`, `'later'` or `'reject'`, which fails with `ORA-20001` for a wall clock the zone repeats or skips. With a preferred offset (like `'+02:00'`), it is the wall clock with that offset when the zone gives it back with it, Temporal's `offset: 'prefer'`. `tsq_zoned_until` calls it: create it first. A query calls it in each wall clock taken to its zone when the connection has `libraryFunctions = 'installed'`; without that setting, Oracle takes the later instant of a wall clock its zone repeats, and fails for one it skips (see [A wall clock the zone repeats or skips](../../configuration/zoned-dates-and-times.md#a-wall-clock-the-zone-repeats-or-skips)).

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_zoned_until`

`tsq_zoned_until` gives the duration from one zoned date and time to another as Temporal's `until` with a largest unit of days or larger: it counts the days of the calendar in their zone, each one with its length there (23 or 25 hours where the zone changes its offset), and rounds as Temporal rounds. A query calls it for `until` and `since` of two zoned dates and times in days or larger units (see [The functions of the library it uses](../../configuration/zoned-dates-and-times.md#the-functions-of-the-library-it-uses)). Two zoned dates and times in different zones make it fail with `ORA-20001`. It calls `tsq_duration_text` and `tsq_zoned_of_wall`: create it after them.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_zoned_of_text`

`tsq_zoned_of_text` gives the `TIMESTAMP WITH TIME ZONE` of the RFC 9557 text of a zoned date and time: its date and time with its offset, a `Z` being `+00:00`, in the zone in brackets, `2024-03-02T12:05:00+01:00[Europe/Madrid]` in `Europe/Madrid`. A column declared to keep a zoned date and time as its text (see [How each database keeps a zoned date and time](../../advanced/dates-and-times/storage.md#how-each-database-keeps-a-zoned-date-and-time)) is that value in every query that uses it: compared, ordered, read, its parts, its instant, its arithmetic. With `libraryFunctions = 'installed'` a query calls it and writes the column once; without it, the query writes the same computation inline, with the column five times, in every place the column is used.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_zoned_hours_in_day`

`tsq_zoned_hours_in_day` gives `hoursInDay()` of a zoned date and time, as Temporal: the hours from the start of its day to the start of the next one in its zone, 23 or 25 where the zone changes its offset that day. With `libraryFunctions = 'installed'` the query calls it and writes the value once; without it, the query writes the start of both days inline. It calls `tsq_zoned_of_wall`: create it first.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_zoned_round_day`

`tsq_zoned_round_day` gives `round` of a zoned date and time to a day, as Temporal: the start of its day or of the next one in its zone, the nearer one by the length of its day, in the mode given. With `libraryFunctions = 'installed'` the query calls it and writes the value once; without it, the query writes the start of both days inline, each one twice. It calls `tsq_zoned_of_wall`: create it first.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_zoned_plus_date`

`tsq_zoned_plus_date` gives `add` and `subtract` of a zoned date and time with years, months, weeks or days, as Temporal: the months and the days added to its wall clock in its zone, the day kept in the month (or the query failing with `{ overflow: 'reject' }` when the month hasn't it), and that wall clock taken back to its zone as `'compatible'` disambiguates it; the value itself when the duration has none of them. The hours and smaller units of the duration are then added to that instant, outside the function. With `libraryFunctions = 'installed'` the query calls it and writes the value once; without it, the query writes the computation inline, with the wall clock in its zone several times and a computed value named in a scalar subquery. It calls `tsq_zoned_of_wall` and `tsq_day_in_month_or_error`: create them first.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_round_to`

`tsq_round_to` rounds an integer to a multiple of a step in a rounding mode of Temporal (`'ceil'`, `'floor'`, `'expand'`, `'trunc'`, `'halfCeil'`, `'halfFloor'`, `'halfExpand'`, `'halfTrunc'`, `'halfEven'`), as Temporal rounds: `-90` to a step of `60` in `'halfEven'` is `-120`. A query rounds with it the time since midnight of `round` of a time, a date and time or an instant (see [Changing a field and rounding](../../configuration/plain-dates-and-times.md#changing-a-field-and-rounding)), and the difference of `until` and `since` with a `smallestUnit`, a `roundingIncrement` or a `roundingMode` (see [The options of `until` and `since`](../../configuration/plain-dates-and-times.md#the-options-of-until-and-since)). With `libraryFunctions = 'installed'` the query calls it and writes the value once; without it, the query writes the rounding inline, with the value two to four times.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_datetime_round`

`tsq_datetime_round` gives `round` of a date and time (a `TIMESTAMP` or a `DATE`), as Temporal: its time since midnight in nanoseconds rounded to the step in the mode given with `tsq_round_to`, added to its date (the next day for the end of the day). `round` of an instant calls it with the date and time of the instant in UTC, and `round` of a zoned date and time to an hour or a smaller unit with its wall clock in its zone. With `libraryFunctions = 'installed'` the query calls it and writes the value once; without it, the query writes the value several times, for its date and for its time of the day. It calls `tsq_round_to`: create it first.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_nanoseconds_between`

`tsq_nanoseconds_between` gives the nanoseconds from one date and time (a `TIMESTAMP` or a `DATE`) to another: the days of their dates and the nanoseconds of their times of the day. A query computes with it the difference of `until` and `since` of two dates and times, and of two instants, in their wall clocks in UTC. With `libraryFunctions = 'installed'` the query calls it and writes each value once; without it, the query writes each value twice.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_duration_sum`

`tsq_duration_sum` adds or subtracts two durations given whole, as their ISO 8601 text: it calls `tsq_duration_add` with the parts `tsq_duration_part` reads of each one. With `libraryFunctions = 'installed'` a query calls it for `add` and `subtract` of a duration to another one (see [Durations added and subtracted together](../../configuration/durations.md#durations-added-and-subtracted-together)), and writes each duration once, a duration given as a value as its ISO 8601 text; without it, the query calls `tsq_duration_add` with the parts of each one, the duration written four times. A duration kept in an interval is given as its text, with `tsq_ds_interval_text` or `tsq_ym_interval_text`. Create it after `tsq_duration_part` and `tsq_duration_add`.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_duration_total_of`

`tsq_duration_total_of` gives a duration given whole in one unit, as Temporal's `total`: it calls `tsq_duration_total` with the parts `tsq_duration_part` reads of it. With `libraryFunctions = 'installed'` a query calls it for `total` (see [The total of a duration in a unit](../../configuration/durations.md#the-total-of-a-duration-in-a-unit)) and writes the duration once; without it, the query writes it five times. A difference that `until` or `since` computes is given by its parts, as without the function. Create it after `tsq_duration_part` and `tsq_duration_total`.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_duration_round_of`

`tsq_duration_round_of` gives the duration from one date or date and time to another, given whole, as Temporal's `until` in months or years, or rounded to the calendar: it calls `tsq_duration_round` with the year, the month, the day and the nanoseconds of the day of each one. With `libraryFunctions = 'installed'` a query calls it where it would call `tsq_duration_round` (see [The duration between two dates and times](../../configuration/plain-dates-and-times.md#the-duration-between-two-dates-and-times)), except for two months of a year, and writes each value once; without it, the query writes each value four times. Create it after `tsq_duration_round`.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_ds_interval_text` and `tsq_ym_interval_text`

`tsq_ds_interval_text` gives the ISO 8601 text of an `INTERVAL DAY TO SECOND`, with all the digits of its fraction (`P1DT12H0M0.000000000S`), and `tsq_ym_interval_text` the one of an `INTERVAL YEAR TO MONTH` (`-P1Y2M`). With `libraryFunctions = 'installed'` a query gives a duration kept in an interval to `tsq_duration_sum` and `tsq_duration_total_of` as that text, written once.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_duration_negated`

`tsq_duration_negated` negates the ISO 8601 text of a duration: without its minus, or with one; a duration of zero as it is, as Temporal writes it. With `libraryFunctions = 'installed'` a query calls it for `negated()` and writes the text once; without it, the query writes it five times.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_time_plus_duration` and `tsq_instant_plus_duration`

`tsq_time_plus_duration` and `tsq_instant_plus_duration` add an interval of days to seconds of the query, given whole, to a time of the day (kept on the date of the stored times, the last argument) or an instant, or subtract it, as Temporal's `add` and `subtract` (see [Adding and subtracting a duration](../../configuration/plain-dates-and-times.md#adding-and-subtracting-a-duration)): its years and months first, keeping the day in the month, then its weeks and days, then its time. A time goes round at midnight. An instant takes only a duration of hours and smaller units: one with days, weeks, months or years makes the query fail. With `libraryFunctions = 'installed'` a query calls them and writes the duration once; without it, the query writes the same computation inline, with the duration several times.

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

## The SQL macros of the Temporal values

oracledb gives a date and a time only as a `Date`, which drops the digits below the millisecond and the years before 1, and the formats of the session decide how a text is read: a query reads each Temporal value as its text, written with a format of its own, all its digits and the era always written, in English whatever the language of the session,, like `to_char(released_on, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')`. The SQL macros of the library are those conversions, written once in a scalar SQL macro, which Oracle expands where the query uses it: the query reads `tsq_text_of_date(released_on)`, and costs what the expression it expands to costs (Oracle doesn't take a macro inside the argument of another one, so the parameters keep their conversion as it is).

| Macro | It is |
|---|---|
| `tsq_text_of_date(value)` | the text of a date, `YYYY-MM-DD BC` |
| `tsq_text_of_timestamp(value)` | the text of a date and time, or of a time (a `TIMESTAMP` on the date of the stored times), `YYYY-MM-DD"T"HH24:MI:SS.FF9 BC` |
| `tsq_text_of_utc(value)` | the text of the date and time in UTC of an instant the query computes, with a `Z` |
| `tsq_text_of_instant(value)` | the text of an instant: its date and time in UTC, with a `Z` |
| `tsq_text_of_zoned(value)` | the text of a zoned date and time: its date and time with its offset, and its zone in brackets |

A query uses them with `libraryFunctions = 'installed'` from Oracle 23.4. Oracle 21 has scalar SQL macros, but fails with `ORA-07445` expanding one whose argument has a scalar subquery, which the arithmetic of the dates and times writes; on Oracle 21 and 19 set `compatibilityVersion` to its version (`21_000_000`, `19_000_000`) and the query writes the conversions inline. The macros are created on Oracle 21 too; on Oracle 19, which hasn't them, creating them fails, and SQL*Plus goes on with the rest of the file.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_string_util.concat_strict`

`concat` and the patterns of `startsWith`, `endsWith` and `contains` give NULL when an operand is NULL, with a `CASE` around `||`. With `libraryFunctions = 'installed'`, a query calls this function of the library instead, which gives the same and writes each operand once (see [Propagating NULL through a function instead of a `CASE`](index.md#propagating-null-through-a-function-instead-of-a-case)); without it, a query doesn't call it.

!!! warning "It must be a package, not a standalone function"

    Oracle cannot overload standalone subprograms — a second `CREATE OR REPLACE FUNCTION` of the same name **replaces** the first. Overloads live in a package, and you want the overloads: without them a `CLOB` argument is implicitly converted to `VARCHAR2` and silently truncated at 32767 characters.

    Four overloads, not two. With only `(VARCHAR2, VARCHAR2)` and `(CLOB, CLOB)`, Oracle cannot resolve the commonest call of all — a `CLOB` column against a `VARCHAR2` literal — and raises `ORA-06553: PLS-307: too many declarations of ... match this call`. The two mixed overloads are what make it resolvable. `NVARCHAR2` and `NCLOB` arguments reach these through implicit conversion and need no overloads of their own.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_uuid_to_raw` and `tsq_raw_to_uuid`

The `'custom-functions'` [uuid strategy](index.md#uuid-strategies) keeps a uuid in a `RAW(16)` and converts it with `tsq_uuid_to_raw` and `tsq_raw_to_uuid`, on any version of Oracle. The text read is in lower case, as the other strategies and databases give it. The `'built-in'` strategy doesn't need them: it calls Oracle's own `UUID_TO_RAW` and `RAW_TO_UUID` of Oracle 23.9, which keep the bytes as they are for version 4 uuids only.

Their code comes in two forms; create the one of the version of uuid your application makes:

| File | Keeps the 16 bytes | For |
|---|---|---|
| [`tsq-uuid-functions.sql`](functions/tsq-uuid-functions.sql) | As they are | Version 7, whose time comes first, so the values sort as they were made and an index grows at its end; and version 4, random, whose order doesn't matter |
| [`tsq-uuid-functions-time-first.sql`](functions/tsq-uuid-functions-time-first.sql) | With the high part of the time first, then its middle and its low part | Version 1, whose time is split with its low part first: so its values sort as they were made too. It scrambles the order of a version 7 |

Choose one before keeping uuids: a uuid kept by one form is read as another uuid by the other.
