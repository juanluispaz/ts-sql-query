---
search:
  boost: 0.55
---
<!-- doc-code-library-functions -->
# Dates and times without zone

!!! info "The SQL of this page is the one with the functions of the library"

    Every query of this page shows the SQL it sends with `libraryFunctions = 'installed'`. Without it, the result is the same, and the SQL of some operations is longer: it writes inline what the function computes.

## The parts of a value

Each part is an `int` (or the type the table says), computed by the database, with the meaning and the name it has in Temporal:

| Method | Gives | Of | The `Date` type's method |
|---|---|---|---|
| `year()` | The year | `plainDate`, `plainDateTime` | `getFullYear()` |
| `month()` | The month, from 1 (January) to 12 | `plainDate`, `plainDateTime` | `getMonth()`, from 0 |
| `day()` | The day of the month, from 1 to 31 | `plainDate`, `plainDateTime` | `getDate()` |
| `dayOfWeek()` | The day of the week, from 1 (Monday) to 7 (Sunday) | `plainDate`, `plainDateTime` | `getDay()`, from 0 (Sunday) |
| `dayOfYear()` | The day of the year, from 1 to 366 | `plainDate`, `plainDateTime` | — |
| `hour()`, `minute()` | The hour, from 0 to 23, and the minute | `plainTime`, `plainDateTime` | `getHours()`, `getMinutes()` |
| `second()` | The second, from 0 to 59, without its fraction | `plainTime`, `plainDateTime` | `getSeconds()` |
| `millisecond()` | The millisecond of the second, from 0 to 999 | `plainTime`, `plainDateTime` | `getMilliseconds()` |
| `microsecond()` | The microsecond of the millisecond, from 0 to 999 | `plainTime`, `plainDateTime` | — |
| `monthCode()` | The code of the month, `'M01'` to `'M12'`, a `string` | `plainDate`, `plainDateTime` | — |
| `daysInMonth()` | The days of its month, from 28 to 31 | `plainDate`, `plainDateTime` | — |
| `daysInYear()` | The days of its year, 365 or 366 | `plainDate`, `plainDateTime` | — |
| `monthsInYear()` | The months of its year, 12 | `plainDate`, `plainDateTime` | — |
| `inLeapYear()` | Whether its year has February 29, a `boolean` | `plainDate`, `plainDateTime` | — |

```ts
const releases = await connection.selectFrom(tRelease)
    .select({
        version: tRelease.version,
        month: tRelease.releasedOn.month(),
        dayOfWeek: tRelease.releasedOn.dayOfWeek(),
        publishedHour: tRelease.publishedAt.hour(),
    })
    .orderBy('version')
    .executeSelectMany()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        version as version, 
        month(released_on) as month, 
        weekday(released_on) + 1 as dayOfWeek, 
        hour(published_at) as publishedHour 
    from project_release 
    order by version
    ```
=== "MySQL"
    ```mysql
    select 
        version as version, 
        month(released_on) as month, 
        weekday(released_on) + 1 as dayOfWeek, 
        hour(published_at) as publishedHour 
    from project_release 
    order by version
    ```
=== "Oracle"
    ```oracle
    select 
        version as "version", 
        extract(month from released_on) as "month", 
        trunc(released_on) - trunc(released_on, 'IW') + 1 as "dayOfWeek", 
        extract(hour from published_at) as "publishedHour" 
    from project_release 
    order by "version"
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        version as version, 
        extract(month from released_on) as month, 
        extract(isodow from released_on) as "dayOfWeek", 
        extract(hour from published_at) as "publishedHour" 
    from project_release 
    order by version
    ```
=== "SQLite"
    ```sqlite
    select 
        version as version, 
        cast(strftime('%m', released_on) as integer) as month, 
        (cast(strftime('%w', released_on) as integer) + 6) % 7 + 1 as dayOfWeek, 
        cast(strftime('%H', published_at) as integer) as publishedHour 
    from project_release 
    order by version
    ```
=== "SQL Server"
    ```sqlserver
    select 
        version as version, 
        datepart(month, released_on) as month, 
        (datepart(weekday, released_on) + @@datefirst + 5) % 7 + 1 as dayOfWeek, 
        datepart(hour, switchoffset(published_at, '+00:00')) as publishedHour 
    from project_release 
    order by version
    ```

The parameters are: `[]`

| version | month | dayOfWeek | publishedHour |
|---|---|---|---|
| `'0.9.0'` | `3` | `5` (Friday) | `11` |
| `'1.2.0'` | `1` | `1` (Monday) | `9` |
| `'1.3.0-beta.1'` | `2` | `2` (Tuesday) | `10` |

A part is a value like any other: it can be compared, ordered or used in a computation, like `tRelease.releasedOn.dayOfWeek().equals(1)` for the releases of a Monday.

## A date at a time of the day

The conversions between the three types are the ones of Temporal:

| Method | Of | Gives |
|---|---|---|
| `toPlainDate()` | `plainDateTime` | Its date, a `plainDate` |
| `toPlainTime()` | `plainDateTime` | Its time of the day, a `plainTime` |
| `toPlainDateTime()` | `plainDate` | The date at 00:00, a `plainDateTime` |
| `toPlainDateTime(time)` | `plainDate` | The date at the time given, a `Temporal.PlainTime` or a `plainTime` of the query |

Here the deadline of each release is its date at its cutoff time, and the query finds the releases published after it:

```ts
const deadline = tRelease.releasedOn.toPlainDateTime(tRelease.cutoffTime)
const late = await connection.selectFrom(tRelease)
    .where(tRelease.publishedAt.greaterThan(deadline))
    .select({
        version: tRelease.version,
        deadline: deadline,
        publishedOn: tRelease.publishedAt.toPlainDate(),
    })
    .orderBy('deadline')
    .executeSelectMany()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        version as version, 
        timestamp(released_on, cutoff_time) as deadline, 
        date(published_at) as publishedOn 
    from project_release 
    where published_at > timestamp(released_on, cutoff_time) 
    order by deadline
    ```
=== "MySQL"
    ```mysql
    select 
        version as version, 
        timestamp(released_on, cutoff_time) as deadline, 
        date(published_at) as publishedOn 
    from project_release 
    where published_at > timestamp(released_on, cutoff_time) 
    order by deadline
    ```
=== "Oracle"
    ```oracle
    select 
        version as "version", 
        tsq_text_of_timestamp(cast(released_on as timestamp(9)) + to_dsinterval('0 ' || to_char(cast(cutoff_time as timestamp(9)), 'HH24:MI:SS.FF9'))) as "deadline", 
        tsq_text_of_date(trunc(published_at)) as "publishedOn" 
    from project_release 
    where published_at > (cast(released_on as timestamp(9)) + to_dsinterval('0 ' || to_char(cast(cutoff_time as timestamp(9)), 'HH24:MI:SS.FF9'))) 
    order by cast(project_release.released_on as timestamp(9)) + to_dsinterval('0 ' || to_char(cast(project_release.cutoff_time as timestamp(9)), 'HH24:MI:SS.FF9'))
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        version as version, 
        released_on + cutoff_time as deadline, 
        cast(published_at as date) as "publishedOn" 
    from project_release 
    where published_at > (released_on + cutoff_time) 
    order by deadline
    ```
=== "SQLite"
    ```sqlite
    select 
        version as version, 
        strftime('%Y-%m-%dT%H:%M:%fZ', date(released_on) || ' ' || strftime('%H:%M:%f', cutoff_time)) as deadline, 
        date(published_at) as publishedOn 
    from project_release 
    where published_at > strftime('%Y-%m-%dT%H:%M:%fZ', date(released_on) || ' ' || strftime('%H:%M:%f', cutoff_time)) 
    order by deadline
    ```
=== "SQL Server"
    ```sqlserver
    select 
        version as version, 
        dateadd(day, datediff(day, 0, released_on), cast(cutoff_time as datetime2)) as deadline, 
        cast(switchoffset(published_at, '+00:00') as date) as publishedOn 
    from project_release 
    where published_at > dateadd(day, datediff(day, 0, released_on), cast(cutoff_time as datetime2)) 
    order by deadline
    ```

The parameters are: `[]`

| version | deadline | publishedOn |
|---|---|---|
| `'1.2.0'` | `2024-01-15T17:00:00` | `2024-01-16` |
| `'1.3.0-beta.1'` | `2024-02-20T18:30:00` | `2024-02-21` |
| `'0.9.0'` | `2024-03-01T16:00:00` | `2024-03-02` |

## Adding and subtracting a duration

`add` and `subtract` of a `plainDate`, a `plainTime` or a `plainDateTime` give the value plus or minus a duration, as Temporal's `add` and `subtract` do. The duration is a `Temporal.Duration`, its fields like `{ months: 18 }`, or a value of the type `duration`, like a column. Here the day the support of each release ends, 18 months after it was released, and the moment its rollout ended:

```ts
const releases = await connection.selectFrom(tRelease)
    .select({
        version: tRelease.version,
        supportEndsOn: tRelease.releasedOn.add({ months: 18 }),
        rolloutEndedAt: tRelease.publishedAt.add(tRelease.rolloutTime),
    })
    .orderBy('version')
    .executeSelectMany()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        version as version, 
        date_add(released_on, interval ? month) as supportEndsOn, 
        tsq_datetime_plus_duration(published_at, rollout_time, 1) as rolloutEndedAt 
    from project_release 
    order by version
    ```
=== "MySQL"
    ```mysql
    select 
        version as version, 
        date_add(released_on, interval ? month) as supportEndsOn, 
        tsq_datetime_plus_duration(published_at, rollout_time, 1) as rolloutEndedAt 
    from project_release 
    order by version
    ```
=== "Oracle"
    ```oracle
    select 
        version as "version", 
        tsq_text_of_date((add_months(released_on, :0) - greatest(0, extract(day from add_months(released_on, :0)) - extract(day from released_on)))) as "supportEndsOn", 
        tsq_text_of_timestamp(published_at + rollout_time) as "rolloutEndedAt" 
    from project_release 
    order by "version"
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        version as version, 
        cast(released_on + $1::interval as date) as "supportEndsOn", 
        published_at + rollout_time as "rolloutEndedAt" 
    from project_release 
    order by version
    ```
=== "SQLite"
    ```sqlite
    select 
        version as version, 
        date(date(released_on, 'start of month', ?1), (min(cast(strftime('%d', released_on) as integer), cast(strftime('%d', date(released_on, 'start of month', ?1), '+1 months', '-1 days') as integer)) - 1) || ' days') as supportEndsOn, 
        strftime('%Y-%m-%dT%H:%M:%fZ', tsq_datetime_plus_duration(strftime('%Y-%m-%d %H:%M:%f', published_at), rollout_time, 1)) as rolloutEndedAt 
    from project_release 
    order by version
    ```
=== "SQL Server"
    ```sqlserver
    select 
        version as version, 
        dateadd(month, @0, released_on) as supportEndsOn, 
        dbo.tsq_datetime_plus_duration(published_at, rollout_time, 1) as rolloutEndedAt 
    from project_release 
    order by version
    ```

The parameters are: `[ Duration P18M ]` (on MariaDB and MySQL and Oracle and SQL Server: `[ 18 ]`; on SQLite: `[ '18 months' ]`)

| version | supportEndsOn | rolloutEndedAt |
|---|---|---|
| `'0.9.0'` | `2025-09-01` | `2024-03-04T11:00:00` |
| `'1.2.0'` | `2025-07-15` | `2024-01-17T21:00:00` |
| `'1.3.0-beta.1'` | `2025-08-20` | `2024-02-21T10:45:00` |

The rules are the ones of Temporal, and the result is the same on every database: the years and months are added first, keeping the day in the month, then the weeks and days, then the time. `subtract` adds the duration negated.

| Value | Operation | Result | Why |
|---|---|---|---|
| `2024-01-31` (`plainDate`) | `add({ months: 1 })` | `2024-02-29` | February has no 31st: the day is kept in the month |
| `2024-02-29` | `add(Temporal.Duration.from('P1Y'))` | `2025-02-28` | The same in a year without February 29th |
| `2024-03-31` | `subtract({ months: 1 })` | `2024-02-29` | |
| `2024-03-01` (`plainDate`) | `add({ hours: 36 })` | `2024-03-02` | A date takes the whole days of the time: 36 hours are one day |
| `2024-03-01` | `subtract({ hours: 36 })` | `2024-02-29` | Minus 36 hours is minus one day |
| `23:30` (`plainTime`) | `add({ hours: 1 })` | `00:30` | A time goes round at midnight |
| `10:00` | `add({ days: 1, hours: 2 })` | `12:00` | A time takes only the time of the duration |
| `2024-02-28T23:00` (`plainDateTime`) | `add({ days: 1, hours: 2, minutes: 30 })` | `2024-03-01T01:30` | |

The fields of a duration given as a value must be integers with one sign, as `Temporal.Duration.from` asks: `{ days: 1, hours: -1 }`, `{ days: 1.5 }` or `{}` are rejected with `INVALID_VALUE_TO_SEND_TO_DATABASE` before the query is sent. The result keeps the digits of the fraction of a second the database keeps (see [The digits each database keeps](dates-and-times.md#the-digits-each-database-keeps)); SQLite computes with milliseconds.

### Rejecting a day the month hasn't

As in Temporal, `add`, `subtract` and `with` take the option `overflow` as their last argument. `'constrain'`, the default, takes a day the month hasn't to its last day, as above; `'reject'` rejects it: `add({ months: 1 }, { overflow: 'reject' })` of January 31st, or `with({ month: 2 }, { overflow: 'reject' })` of a day 30, make the query fail with an error of the database, as Temporal throws a `RangeError`. A day that is in the month gives the same value with both. With `with`, a field given out of its range (`{ month: 13 }`, `{ hour: 25 }`), or a day the year and the month given haven't, is rejected with `INVALID_VALUE_TO_SEND_TO_DATABASE` before the query is sent.

MariaDB, MySQL and SQLite have no date that fails: there the error is the one of a subquery that returns two rows (MariaDB and MySQL) or of an integer overflow (SQLite), written to fail only for a day the month hasn't.

With `libraryFunctions = 'installed'` on the connection, the day is checked by `tsq_day_in_month_or_error`, which writes the value once more, and a duration of the query added to a value is read once by a function of the library (see the functions of [your database](../databases/postgresql/functions.md#tsq_day_in_month_or_error)); the result is the same.

### A duration kept as text: the function `tsq_duration_part`

On MariaDB, MySQL, SQLite and SQL Server, and in a column of PostgreSQL or Oracle that keeps a duration as text, a duration is its ISO 8601 text. To add one that the database holds, like `tRelease.rolloutTime`, to a date or to another duration, or to read its fields, its sign or its total, or to negate it, the query reads its parts with `tsq_duration_part`, a function of the library: create it once in the database. A duration given as a value doesn't need it to be added, and neither does reading, writing or comparing a duration. Without the function, the query fails with the error of the database for a function that doesn't exist.

Its code for each database:

| Database | The code |
|---|---|
| MariaDB | [`tsq_duration_part`](../databases/mariadb/functions.md#tsq_duration_part) |
| MySQL | [`tsq_duration_part`](../databases/mysql/functions.md#tsq_duration_part) |
| Oracle | [`tsq_duration_part`](../databases/oracle/functions.md#tsq_duration_part) |
| PostgreSQL | [`tsq_duration_part`](../databases/postgresql/functions.md#tsq_duration_part) |
| SQLite | registered by `registerSqliteFunctions`: see [SQLite functions and extensions](../databases/sqlite/functions.md#the-functions-of-durations) |
| SQL Server | [`tsq_duration_part`](../databases/sqlserver/functions.md#tsq_duration_part) |

## The duration between two dates and times

`until` and `since` of a `plainDate`, a `plainTime` or a `plainDateTime` give the duration from the value to another one of the same type (`until`), or from the other one to the value (`since`), as Temporal's `until` and `since` do. The other one is a Temporal value or a value of the same type, like a column. The result is a `duration`. Here, for each release, the time from its release to its publication, in days and in hours, and the months and days from its release to the end of June:

```ts
const releases = await connection.selectFrom(tRelease)
    .select({
        version: tRelease.version,
        toPublication: tRelease.releasedOn.until(tRelease.publishedAt.toPlainDate()),
        publishedAfter: tRelease.publishedAt.since(tRelease.releasedOn.toPlainDateTime(), { largestUnit: 'hour' }),
        untilEndOfJune: tRelease.releasedOn.until(Temporal.PlainDate.from('2024-06-30'), { largestUnit: 'month' }),
    })
    .orderBy('version')
    .executeSelectMany()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        version as version, 
        tsq_duration_text(0, 0, 0, datediff(date(published_at), released_on), 0, 'day') as toPublication, 
        tsq_duration_text(0, 0, 0, 0, cast(-timestampdiff(microsecond, published_at, timestamp(released_on)) as decimal(65)) * 1000, 'hour') as publishedAfter, 
        tsq_duration_round_of(released_on, ?, 'month', 'day', 1, 'trunc', 1) as untilEndOfJune 
    from project_release 
    order by version
    ```
=== "MySQL"
    ```mysql
    select 
        version as version, 
        tsq_duration_text(0, 0, 0, datediff(date(published_at), released_on), 0, 'day') as toPublication, 
        tsq_duration_text(0, 0, 0, 0, cast(-timestampdiff(microsecond, published_at, timestamp(released_on)) as decimal(65)) * 1000, 'hour') as publishedAfter, 
        tsq_duration_round_of(released_on, ?, 'month', 'day', 1, 'trunc', 1) as untilEndOfJune 
    from project_release 
    order by version
    ```
=== "Oracle"
    ```oracle
    select 
        version as "version", 
        tsq_duration_text(0, 0, 0, (trunc(published_at) - released_on), 0, 'day') as "toPublication", 
        tsq_duration_text(0, 0, 0, 0, -tsq_nanoseconds_between(published_at, cast(released_on as timestamp(9))), 'hour') as "publishedAfter", 
        tsq_duration_round_of(released_on, to_date(:0, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'), 'month', 'day', 1, 'trunc', 1) as "untilEndOfJune" 
    from project_release 
    order by "version"
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        version as version, 
        make_interval(days => (cast(published_at as date) - released_on)) as "toPublication", 
        (extract(epoch from published_at - cast(released_on as timestamp)) || ' seconds')::interval as "publishedAfter", 
        tsq_duration_round_of(released_on, $1::date, 'month', 'day', 1, 'trunc', 1) as "untilEndOfJune" 
    from project_release 
    order by version
    ```
=== "SQLite"
    ```sqlite
    select 
        version as version, 
        tsq_duration_text(0, 0, 0, cast(julianday(date(date(published_at))) - julianday(date(released_on)) as integer), 0, 'day') as toPublication, 
        tsq_duration_text(0, 0, 0, 0, cast(-cast(round((julianday(strftime('%Y-%m-%dT%H:%M:%fZ', released_on)) - julianday(published_at)) * 86400000) as integer) * 1000000 as text), 'hour') as publishedAfter, 
        tsq_duration_round_of(strftime('%Y-%m-%d %H:%M:%f', released_on), strftime('%Y-%m-%d %H:%M:%f', ?1), 'month', 'day', 1, 'trunc', 1) as untilEndOfJune 
    from project_release 
    order by version
    ```
=== "SQL Server"
    ```sqlserver
    select 
        version as version, 
        dbo.tsq_duration_text(0, 0, 0, datediff(day, released_on, cast(switchoffset(published_at, '+00:00') as date)), 0, 'day') as toPublication, 
        dbo.tsq_duration_text(0, 0, 0, 0, cast(-dbo.tsq_ticks_between(published_at, cast(released_on as datetime2)) as decimal(38)) * 100, 'hour') as publishedAfter, 
        dbo.tsq_duration_round_of(switchoffset(released_on, '+00:00'), switchoffset(@0, '+00:00'), 'month', 'day', 1, 'trunc', 1) as untilEndOfJune 
    from project_release 
    order by version
    ```

The parameters are: `[ PlainDate 2024-06-30 ]` (on SQLite: `[ '2024-06-30' ]`)

| version | toPublication | publishedAfter | untilEndOfJune |
|---|---|---|---|
| `'0.9.0'` | `P1D` | `PT35H` | `P3M29D` |
| `'1.2.0'` | `P1D` | `PT33H` | `P5M15D` |
| `'1.3.0-beta.1'` | `P1D` | `PT34H` | `P4M10D` |

The duration is the one of Temporal on every database. Between two dates, or two dates and times, it is in days and smaller units, and between two times in hours and smaller units, unless `largestUnit` asks for larger ones. Months are counted from the first value without passing the second one, with the day of the first value, which is not kept in the month while counting; the days come after them, and then the time.

| Value | Operation | Result | Why |
|---|---|---|---|
| `2024-01-31` (`plainDate`) | `until(2024-03-30)` | `P59D` | In days by default |
| `2024-01-31` | `until(2024-02-29, { largestUnit: 'month' })` | `P29D` | A month from January 31st would be February 31st, past February 29th: no whole month |
| `2024-01-31` | `until(2024-03-01, { largestUnit: 'month' })` | `P1M1D` | A month reaches February 29th (the day kept in the month), and one day more |
| `2024-01-31` | `since(2024-03-30, { largestUnit: 'month' })` | `-P1M30D` | `since` counts from the value, as `until`, and negates the result |
| `2024-03-30` | `until(2024-01-31, { largestUnit: 'month' })` | `-P1M29D` | Counted back from March 30th |
| `2024-01-01` | `until(2024-03-15, { largestUnit: 'week' })` | `P10W4D` | |
| `2024-01-01T23:00` (`plainDateTime`) | `until(2024-01-02T01:00)` | `PT2H` | No whole day: 01:00 is before 23:00 |
| `10:00` (`plainTime`) | `until(08:30)` | `-PT1H30M` | A time doesn't go round at midnight |

On PostgreSQL the duration is an interval, which keeps months, days and a time: Temporal's `P14M` reads `P1Y2M`, its weeks are days (`P10W4D` reads `P74D`), and with a largest unit smaller than the hour the time reads in hours (`PT90M` reads `PT1H30M`); each is the same duration. The other databases keep the text Temporal writes.

### The options of `until` and `since`

The options are the ones of Temporal, and they are checked as Temporal checks them: options it rejects (a smallest unit larger than the largest one, a unit the type hasn't, an increment that doesn't divide the next unit) are rejected with `INVALID_VALUE_TO_SEND_TO_DATABASE` before the query is sent.

| Option | Values | Default |
|---|---|---|
| `largestUnit` | `'year'`, `'month'`, `'week'`, `'day'` for a date; `'hour'` to `'nanosecond'` for a time; all of them for a date and time; in the singular or the plural, or `'auto'` | `'auto'`: the day (the hour for a time), or the smallest unit when it is larger |
| `smallestUnit` | The same units | The day for a date, the nanosecond otherwise: no rounding |
| `roundingIncrement` | An integer from 1 to 10⁹ (a fraction is truncated); for a unit of the time, one that divides the next unit and is less than it | `1` |
| `roundingMode` | `'ceil'`, `'floor'`, `'expand'`, `'trunc'`, `'halfCeil'`, `'halfFloor'`, `'halfExpand'`, `'halfTrunc'`, `'halfEven'` | `'trunc'` |

| Value | Operation | Result |
|---|---|---|
| `10:00` | `until(08:30:00.5, { smallestUnit: 'second', roundingMode: 'floor' })` | `-PT1H30M` |
| `08:00` | `until(10:08, { smallestUnit: 'minute', roundingIncrement: 15, roundingMode: 'halfExpand' })` | `PT2H15M` |
| `2024-01-01` | `until(2024-03-17, { smallestUnit: 'month', roundingMode: 'halfExpand' })` | `P3M` |
| `2024-01-01` | `since(2024-03-15, { smallestUnit: 'month', roundingMode: 'ceil' })` | `-P2M` |
| `2024-01-01` | `until(2024-01-31, { largestUnit: 'month', smallestUnit: 'day', roundingIncrement: 7, roundingMode: 'ceil' })` | `P1M` |

As in Temporal, `since` is `until` with the mode negated (`'floor'` for `'ceil'`), negated: its result is rounded as the mode says for that result, so `'ceil'` takes `-P2M14D` up to `-P2M`. A rounding that reaches the next week, month or year from the first value gives it: 30 days rounded up to 35 pass February 1st, which is a month from January 1st.

### The functions `tsq_duration_text` and `tsq_duration_round`

On MariaDB, MySQL, Oracle, SQLite and SQL Server the query writes the text of the duration with `tsq_duration_text`, a function of the library. A difference in months or years, and one rounded with a largest unit of a week, a month or a year (a `smallestUnit` or a `roundingIncrement` other than the defaults), is computed by `tsq_duration_round`, on every database, PostgreSQL too: it counts the whole months from the first value without passing the second one, as Temporal does and no database does by itself, and rounds them as Temporal does, which a query without variables would write many times over. Create them once in the database, as `tsq_duration_part`; without them, the query fails with the error of the database for a function that doesn't exist.

With `libraryFunctions = 'installed'` on the connection, a query calls `tsq_duration_round_of` instead, which takes each date or date and time whole and writes it once; the result is the same.

Their code for each database:

| Database | The code |
|---|---|
| MariaDB | [`tsq_duration_text`](../databases/mariadb/functions.md#tsq_duration_text) and [`tsq_duration_round`](../databases/mariadb/functions.md#tsq_duration_round) |
| MySQL | [`tsq_duration_text`](../databases/mysql/functions.md#tsq_duration_text) and [`tsq_duration_round`](../databases/mysql/functions.md#tsq_duration_round) |
| Oracle | [`tsq_duration_text`](../databases/oracle/functions.md#tsq_duration_text) and [`tsq_duration_round`](../databases/oracle/functions.md#tsq_duration_round) |
| PostgreSQL | [`tsq_duration_round`](../databases/postgresql/functions.md#tsq_duration_round) |
| SQLite | registered by `registerSqliteFunctions`: see [SQLite functions and extensions](../databases/sqlite/functions.md#the-functions-of-durations) |
| SQL Server | [`tsq_duration_text`](../databases/sqlserver/functions.md#tsq_duration_text) and [`tsq_duration_round`](../databases/sqlserver/functions.md#tsq_duration_round) |

## Changing a field and rounding

`with` gives the value with some of its fields in place of its own, as Temporal's `with`: a `plainDate` takes `year`, `month` (or `monthCode`, like `'M02'`) and `day`; a `plainTime` takes `hour`, `minute`, `second`, `millisecond`, `microsecond` and `nanosecond`; a `plainDateTime` takes all of them. `round` of a `plainTime` or a `plainDateTime` rounds it as Temporal's `round`: to a unit, like `'minute'`, or with options. Here the first day of the month of each release, and its cutoff time rounded to slots of 6 hours:

```ts
const releases = await connection.selectFrom(tRelease)
    .select({
        version: tRelease.version,
        monthOfRelease: tRelease.releasedOn.with({ day: 1 }),
        cutoffSlot: tRelease.cutoffTime.round({ smallestUnit: 'hour', roundingIncrement: 6 }),
    })
    .orderBy('version')
    .executeSelectMany()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        version as version, 
        tsq_date_with(released_on, null, null, 1, 0) as monthOfRelease, 
        sec_to_time(mod(tsq_round_to((floor(time_to_sec(cutoff_time)) * 1000000 + microsecond(cutoff_time)), 21600000000, 'halfExpand'), 86400000000) * 0.000001) as cutoffSlot 
    from project_release 
    order by version
    ```
=== "MySQL"
    ```mysql
    select 
        version as version, 
        tsq_date_with(released_on, null, null, 1, 0) as monthOfRelease, 
        sec_to_time(mod(tsq_round_to((floor(time_to_sec(cutoff_time)) * 1000000 + microsecond(cutoff_time)), 21600000000, 'halfExpand'), 86400000000) * 0.000001) as cutoffSlot 
    from project_release 
    order by version
    ```
=== "Oracle"
    ```oracle
    select 
        version as "version", 
        tsq_text_of_date(tsq_date_with(released_on, null, null, 1, 0)) as "monthOfRelease", 
        tsq_text_of_timestamp(timestamp '1972-01-01 00:00:00' + numtodsinterval(mod(tsq_round_to(to_number(to_char(cutoff_time, 'SSSSSFF9')), 21600000000000, 'halfExpand'), 86400000000000) / 1000000000, 'second')) as "cutoffSlot" 
    from project_release 
    order by "version"
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        version as version, 
        tsq_date_with(released_on, null, null, 1, 0) as "monthOfRelease", 
        cast(date_bin(interval '6 hours', (date '2000-01-01' + cutoff_time) + interval '3 hours', date_trunc('day', (date '2000-01-01' + cutoff_time))) as time) as "cutoffSlot" 
    from project_release 
    order by version
    ```
=== "SQLite"
    ```sqlite
    select 
        version as version, 
        date(tsq_date_with(strftime('%Y-%m-%d', released_on), null, null, 1, 0)) as monthOfRelease, 
        strftime('%H:%M:%fZ', '00:00:00', ((cast(tsq_round_to(cast(cast(round((julianday(cutoff_time) - julianday(date(cutoff_time))) * 86400000) as integer) as text), 21600000, 'halfExpand') as integer)) / 1000.0) || ' seconds') as cutoffSlot 
    from project_release 
    order by version
    ```
=== "SQL Server"
    ```sqlserver
    select 
        version as version, 
        dbo.tsq_date_with(released_on, null, null, 1, 0) as monthOfRelease, 
        dbo.tsq_time_of_ticks(dbo.tsq_round_to((datediff_big(nanosecond, cast('00:00' as time), cast(cutoff_time as time)) / 100), cast(216000000000 as bigint), 'halfExpand')) as cutoffSlot 
    from project_release 
    order by version
    ```

The parameters are: `[]`

| version | monthOfRelease | cutoffSlot |
|---|---|---|
| `'0.9.0'` | `2024-03-01` | `18:00:00` |
| `'1.2.0'` | `2024-01-01` | `18:00:00` |
| `'1.3.0-beta.1'` | `2024-02-01` | `18:00:00` |

### The fields of `with`

The fields are integers (a fraction is dropped), as Temporal reads them. A field above its range is taken to the last value it can have, and the day to the last day of the month when the month has fewer; a field of a time below its range is taken to 0:

| Value | Operation | Result |
|---|---|---|
| `2024-01-31` | `with({ month: 2 })` | `2024-02-29` |
| `2024-01-31` | `with({ year: 2023, month: 2 })` | `2023-02-28` |
| `2024-04-15` | `with({ day: 31 })` | `2024-04-30` |
| `2024-01-31` | `with({ month: 13 })` | `2024-12-31` |
| `10:20:30.123` | `with({ hour: 25 })` | `23:20:30.123` |
| `10:20:30.123` | `with({ minute: -1 })` | `10:00:30.123` |

As in Temporal, a month or a day below 1, a month code of another month, or an object without any field of the type, like `{}` or `{ hour: 0 }` for a date, are rejected with `INVALID_VALUE_TO_SEND_TO_DATABASE` before the query is sent.

### The options of `round`

| Option | What it is |
|---|---|
| `smallestUnit` | The unit to round to: `'hour'`, `'minute'`, `'second'`, `'millisecond'`, `'microsecond'` or `'nanosecond'`, in the singular or the plural; also `'day'` for a `plainDateTime`. Given alone, `round('minute')` is the same as `round({ smallestUnit: 'minute' })` |
| `roundingIncrement` | Round to multiples of this many units, 1 by default. It must divide the next larger unit and be less than it: 15 minutes or 6 hours, not 7 minutes nor 24 hours; a day only by 1 |
| `roundingMode` | How: `'halfExpand'`, the default, rounds half way up; `'halfTrunc'` half way down; `'halfEven'` half way to the even multiple; `'ceil'` up; `'trunc'` down. As a time since midnight is never negative, `'expand'` is `'ceil'`, `'floor'` is `'trunc'`, `'halfCeil'` is `'halfExpand'` and `'halfFloor'` is `'halfTrunc'` |

| Value | Operation | Result |
|---|---|---|
| `10:07:30` | `round('minute')` | `10:08:00` |
| `23:59:59.5` | `round('second')` | `00:00:00`: a time goes round at midnight |
| `10:07:30` | `round({ smallestUnit: 'minute', roundingIncrement: 15, roundingMode: 'halfEven' })` | `10:00:00` |
| `10:22:30` | `round({ smallestUnit: 'minute', roundingIncrement: 15, roundingMode: 'halfEven' })` | `10:30:00` |
| `10:00:01` | `round({ smallestUnit: 'hour', roundingMode: 'ceil' })` | `11:00:00` |
| `2024-02-29T23:59:59.5` | `round('second')` | `2024-03-01T00:00:00`: the next day |
| `2024-02-29T12:00` | `round('day')` | `2024-03-01T00:00:00` |

Options Temporal rejects are rejected with `INVALID_VALUE_TO_SEND_TO_DATABASE` before the query is sent. A unit below the digits the database keeps changes nothing: SQLite keeps milliseconds, PostgreSQL, MariaDB and MySQL microseconds.

The query writes the rounding inline, with the value two to four times. With the functions of the library in the database and `libraryFunctions = 'installed'` on the connection, it calls `tsq_round_to`, which writes it once (see the functions of [your database](../databases/postgresql/functions.md#tsq_round_to)); the result is the same.
