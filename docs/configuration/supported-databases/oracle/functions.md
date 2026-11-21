---
search:
  boost: 0.5
---
# Oracle functions

Some queries call a function that Oracle doesn't have built in. This page says what each one is for and when a query calls it; its code is in a file of SQL to run once in the database (see [Creating them](#creating-them)). A query that calls a function the database doesn't have fails with the error of the database for a function that doesn't exist; the other queries work without it, so you only need the functions of what you use.

They are of these kinds:

- **The ones a query always needs**, the ones of durations and of differences of zoned dates and times in days: a query that uses one calls it (see [Dates and times](../../dates-and-times.md)).
- **The optional ones**, `tsq_zoned_of_wall` and `tsq_string_util.concat_strict`: a query calls them only with `libraryFunctions = 'installed'` on the connection; without it, the SQL of Oracle does the same with less (see each one).
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
| [`tsq_string_util.concat_strict`](#tsq_string_utilconcat_strict) | `concat` or an affix pattern is written, with `libraryFunctions = 'installed'` | — |
| [`tsq_uuid_to_raw` and `tsq_raw_to_uuid`](#tsq_uuid_to_raw-and-tsq_raw_to_uuid) | a uuid is read or written with the `'custom-functions'` uuid strategy | — |

## Creating them

[`tsq-functions.sql`](functions/tsq-functions.sql) creates every function of the library on Oracle, in the order they need, dropping the one of the same name first: run it as it is, with the client of your database, like `sqlplus <user>/<password>@<service> @tsq-functions.sql`, or in the editor you use. Each function is described below; a query that doesn't use one doesn't need it. A query calls the ones of the setting `libraryFunctions` only with it (see each one).

## `tsq_duration_part`

`tsq_duration_part` reads a part of the ISO 8601 text of a duration: its months, its days, the whole seconds of its time and the nanoseconds of the second, to add it; each field as written; its sign; or its largest field that isn't zero. Oracle keeps a duration in an interval, and only a column that keeps it as text needs it (see [A column that keeps it in its own way](../../dates-and-times.md#a-column-that-keeps-it-in-its-own-way)): a query calls it to add a duration of such a column to a date or to another duration, to read its fields, its sign or its total, or to negate it. A duration given as a value doesn't need it to be added, and neither does reading, writing or comparing a duration. See [A duration kept as text](../../dates-and-times.md#a-duration-kept-as-text-the-function-tsq_duration_part).

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_duration_text`

`tsq_duration_text` writes the ISO 8601 text of a duration from its fields, the text of Temporal's `toString`. A query calls it to give the duration that `until` or `since` computes (see [The duration between two dates and times](../../dates-and-times.md#the-duration-between-two-dates-and-times)), and `tsq_duration_round`, `tsq_duration_add` and `tsq_zoned_until` call it to write their result: create it before them.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_duration_round`

`tsq_duration_round` gives the duration from one date and time to another as Temporal's `until` with a largest unit of weeks, months or years, rounded as Temporal rounds it, counting from the first value. A query calls it when `until` or `since` has a largest unit of a month or a year, and when it rounds to the calendar: a largest unit of a week with a `smallestUnit` or a `roundingIncrement` other than the defaults (see [The options of `until` and `since`](../../dates-and-times.md#the-options-of-until-and-since)). It calls `tsq_duration_text`.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_duration_total`

`tsq_duration_total` gives a duration in one unit, as Temporal's `total`: it adds the duration to the date of reference, when there is one, and divides with integers, so the `double` is rounded once. A query calls it for every `total` (see [The total of a duration in a unit](../../dates-and-times.md#the-total-of-a-duration-in-a-unit)). Without a date of reference, a duration with years, months or weeks makes it fail, with an error that says it needs a date of reference.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_duration_add`

`tsq_duration_add` adds or subtracts two durations, as Temporal's `add` and `subtract` of a `Temporal.Duration`: a day is 24 hours, the sum is written up to the largest field of the two, and a duration with years, months or weeks makes it fail. A query calls it for `add` and `subtract` of a duration to another one (see [Durations added and subtracted together](../../dates-and-times.md#durations-added-and-subtracted-together)). It takes, of each duration, its largest field that isn't zero, which `tsq_duration_part` gives with `'largest'`. It calls `tsq_duration_text`.

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_zoned_of_wall`

`tsq_zoned_of_wall` gives the instant of a wall clock (a `TIMESTAMP`) in a zone, a region or an offset like `+05:30`, as a `TIMESTAMP WITH TIME ZONE` in it, as Temporal's `disambiguation` takes it: `'compatible'`, `'earlier'`, `'later'` or `'reject'`, which fails with `ORA-20001` for a wall clock the zone repeats or skips. With a preferred offset (like `'+02:00'`), it is the wall clock with that offset when the zone gives it back with it, Temporal's `offset: 'prefer'`. `tsq_zoned_until` calls it: create it first. A query calls it in each wall clock taken to its zone when the connection has `libraryFunctions = 'installed'`; without that setting, Oracle takes the later instant of a wall clock its zone repeats, and fails for one it skips (see [A wall clock the zone repeats or skips](../../dates-and-times.md#a-wall-clock-the-zone-repeats-or-skips)).

Its code is in [`tsq-functions.sql`](functions/tsq-functions.sql).

## `tsq_zoned_until`

`tsq_zoned_until` gives the duration from one zoned date and time to another as Temporal's `until` with a largest unit of days or larger: it counts the days of the calendar in their zone, each one with its length there (23 or 25 hours where the zone changes its offset), and rounds as Temporal rounds. A query calls it for `until` and `since` of two zoned dates and times in days or larger units (see [The functions `tsq_zoned_until` and `tsq_zoned_of_wall`](../../dates-and-times.md#the-functions-tsq_zoned_until-and-tsq_zoned_of_wall)). Two zoned dates and times in different zones make it fail with `ORA-20001`. It calls `tsq_duration_text` and `tsq_zoned_of_wall`: create it after them.

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
