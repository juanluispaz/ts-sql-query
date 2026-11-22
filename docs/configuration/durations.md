---
search:
  boost: 0.55
---
<!-- doc-code-library-functions -->
# Durations

A `duration` is a length of time: how long something took or lasts, like the 45 minutes a rollout took. It is a `Temporal.Duration`, with its fields from years to nanoseconds. It isn't a time of the day: 25 hours is a duration, and `plainTime` has no 25:00.

!!! info "The SQL of this page is the one with the functions of the library"

    Every query of this page shows the SQL it sends with `libraryFunctions = 'installed'`. Without it, the result is the same, and the SQL of some operations is longer: it writes inline what the function computes.

The value is read and sent as a `Temporal.Duration`, here the time the rollout of each release took:

```ts
const rollouts = await connection.selectFrom(tRelease)
    .select({
        version: tRelease.version,
        rolloutTime: tRelease.rolloutTime,
    })
    .orderBy('version')
    .executeSelectMany()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        version as version, 
        rollout_time as rolloutTime 
    from project_release 
    order by version
    ```
=== "MySQL"
    ```mysql
    select 
        version as version, 
        rollout_time as rolloutTime 
    from project_release 
    order by version
    ```
=== "Oracle"
    ```oracle
    select 
        version as "version", 
        rollout_time as "rolloutTime" 
    from project_release 
    order by "version"
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        version as version, 
        rollout_time as "rolloutTime" 
    from project_release 
    order by version
    ```
=== "SQLite"
    ```sqlite
    select 
        version as version, 
        rollout_time as rolloutTime 
    from project_release 
    order by version
    ```
=== "SQL Server"
    ```sqlserver
    select 
        version as version, 
        rollout_time as rolloutTime 
    from project_release 
    order by version
    ```

The parameters are: `[]`

| version | rolloutTime |
|---|---|
| `'0.9.0'` | `P2D` |
| `'1.2.0'` | `P1DT12H` |
| `'1.3.0-beta.1'` | `PT45M` |

## Comparing durations

A duration is compared only for equality: `equals`, `notEquals`, `in`, `notIn` and the other operations of an `EqualableValueSource` in the [Value expressions API](../api/value-expressions.md), here the releases whose rollout took 45 minutes:

```ts
const quick = await connection.selectFrom(tRelease)
    .where(tRelease.rolloutTime.equals(Temporal.Duration.from({ minutes: 45 })))
    .select({ version: tRelease.version })
    .executeSelectMany()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select version as version 
    from project_release 
    where rollout_time = ?
    ```
=== "MySQL"
    ```mysql
    select version as version 
    from project_release 
    where rollout_time = ?
    ```
=== "Oracle"
    ```oracle
    select version as "version" 
    from project_release 
    where rollout_time = to_dsinterval(:0)
    ```
===+ "PostgreSQL"
    ```postgresql
    select version as version 
    from project_release 
    where rollout_time = $1
    ```
=== "SQLite"
    ```sqlite
    select version as version 
    from project_release 
    where rollout_time = ?1
    ```
=== "SQL Server"
    ```sqlserver
    select version as version 
    from project_release 
    where rollout_time = @0
    ```

The parameters are: `[ Duration PT45M ]` (on MariaDB and MySQL and SQLite and SQL Server: `[ 'PT45M' ]`)

| version |
|---|
| `'1.3.0-beta.1'` |

There is no `lessThan` or `greaterThan`: whether 1 month is longer than 30 days depends on the month, so Temporal doesn't order two durations without a date to count from, and neither does a query.

Two durations of the same length written differently, like `P1D` and `PT24H`, are equal or not depending on how the column keeps them (see the next section):

| How the column keeps it | `P1D` and `PT24H` | `PT90M` and `PT1H30M` |
|---|---|---|
| An `interval` of PostgreSQL | Equal; also `P1M` and `P30D`, and `P1Y` and `P360D`, as PostgreSQL compares a month as 30 days | Equal |
| An `INTERVAL DAY TO SECOND` of Oracle | Equal | Equal |
| Its ISO 8601 text | Different: the texts are compared | Different |

## How each database keeps a duration

PostgreSQL and Oracle have a type for a length of time, an interval; the other databases keep a duration as its [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601#Durations) text, the text Temporal gives it (`P1Y2M3DT4H5M6.789S`):

| Database | The column | What it keeps | What is read back |
|---|---|---|---|
| PostgreSQL | `interval` | Each field as sent, the fraction of a second rounded to microseconds; weeks as days | `PT24H` as `PT24H`, `P2W` as `P14D` |
| Oracle | `INTERVAL DAY TO SECOND` | Days to seconds, with the digits of the fraction of the column | `PT24H` as `P1D` |
| Oracle | `INTERVAL YEAR TO MONTH`, when the column says it (below) | Years and months | `P14M` as `P1Y2M` |
| MariaDB, MySQL, SQLite, SQL Server | A text, like `varchar(64)` | The ISO 8601 text of the duration, all of it, up to the nanosecond | The same text: `PT24H` as `PT24H`, `P2W` as `P2W` |

On Oracle, declare the precision of an interval column: see [A duration in an interval](../databases/oracle/index.md#a-duration-in-an-interval).

## The digits of the fraction of a second kept in a text

A duration kept as text is written with every digit of its fraction of a second, up to the nanosecond: `PT1.123456789S`. To keep fewer, which takes less space, the connection says how many with the protected method `getDurationFractionDigits`, from 0 to 9; the digits beyond are truncated, as Temporal's `toString({ fractionalSecondDigits, roundingMode: 'trunc' })` does. With 3, the milliseconds:

<!-- doc-code-snippet-template: mysql -->
```ts
import { MySqlConnection } from 'ts-sql-query/mysql'

class DBConnection extends MySqlConnection<'DBConnection'> {
    protected override getDurationFractionDigits(): number {
        return 3
    }
}
```

| Duration | Kept with 9 (the default) | Kept with 3 | Kept with 0 |
|---|---|---|---|
| `PT1.123456789S` | `PT1.123456789S` | `PT1.123S` | `PT1S` |
| `-PT2H0.9999S` | `-PT2H0.9999S` | `-PT2H0.999S` | `-PT2H` |
| `-PT0.0009S` | `-PT0.0009S` | `PT0S` | `PT0S` |

It applies to the durations sent to be kept as text, in a value or a column of the query, on every database where a duration is text: MariaDB, MySQL, SQLite and SQL Server, and a column of PostgreSQL or Oracle that keeps it as text. A duration a query computes, like the one of `until`, keeps the digits of the database, and an interval keeps the ones of its column. Another number is rejected with `INVALID_CONFIGURATION` when a duration is sent.

## A column that keeps it in its own way

A column says how it keeps its durations with its [SQL data type](../advanced/data-types/sql-data-types.md): a text keeps the ISO 8601 text on any database, also on PostgreSQL and Oracle, where it holds what one interval of Oracle can't, like `P1M1D`; on Oracle an `INTERVAL YEAR TO MONTH` keeps the years and months. `withSqlDataType` is exported by `ts-sql-query`:

```typescriptreact
spanText = this.column('span_text', 'duration', withSqlDataType({ family: 'character string', length: 64 }))
spanCalendar = this.column('span_calendar', 'duration', withSqlDataType({ family: 'interval', fields: 'year to month' }))
```

An interval of Oracle holds either years and months or days to seconds, never both: a duration that doesn't fit the one of its column is rejected (see [A duration in an interval](../databases/oracle/index.md#a-duration-in-an-interval)).

## The fields of a duration

A duration in a query has the fields and methods of Temporal's: `years()`, `months()`, `weeks()`, `days()`, `hours()`, `minutes()`, `seconds()` (without its fraction), `milliseconds()`, `microseconds()` and `nanoseconds()` (each from 0 to 999) give each field as an `int` with the sign of the duration; `sign()` gives -1, 0 or 1; `negated()` and `abs()` give the duration with the opposite sign and without its sign. Here the fields of the time each rollout took, and that time negated:

```ts
const releases = await connection.selectFrom(tRelease)
    .select({
        version: tRelease.version,
        days: tRelease.rolloutTime.days(),
        hours: tRelease.rolloutTime.hours(),
        minutes: tRelease.rolloutTime.minutes(),
        sign: tRelease.rolloutTime.sign(),
        back: tRelease.rolloutTime.negated(),
    })
    .orderBy('version')
    .executeSelectMany()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        version as version, 
        tsq_duration_part(rollout_time, 'days') as days, 
        tsq_duration_part(rollout_time, 'hours') as hours, 
        tsq_duration_part(rollout_time, 'minutes') as minutes, 
        tsq_duration_part(rollout_time, 'sign') as sign, 
        tsq_duration_negated(rollout_time) as back 
    from project_release 
    order by version
    ```
=== "MySQL"
    ```mysql
    select 
        version as version, 
        tsq_duration_part(rollout_time, 'days') as days, 
        tsq_duration_part(rollout_time, 'hours') as hours, 
        tsq_duration_part(rollout_time, 'minutes') as minutes, 
        tsq_duration_part(rollout_time, 'sign') as sign, 
        tsq_duration_negated(rollout_time) as back 
    from project_release 
    order by version
    ```
=== "Oracle"
    ```oracle
    select 
        version as "version", 
        extract(day from rollout_time) as "days", 
        extract(hour from rollout_time) as "hours", 
        extract(minute from rollout_time) as "minutes", 
        sign(extract(day from rollout_time) * 86400 + extract(hour from rollout_time) * 3600 + extract(minute from rollout_time) * 60 + extract(second from rollout_time)) as "sign", 
        (rollout_time * -1) as "back" 
    from project_release 
    order by "version"
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        version as version, 
        cast(extract(day from rollout_time) as integer) as days, 
        cast(extract(hour from rollout_time) as integer) as hours, 
        cast(extract(minute from rollout_time) as integer) as minutes, 
        cast(sign(extract(epoch from rollout_time)) as integer) as sign, 
        -rollout_time as back 
    from project_release 
    order by version
    ```
=== "SQLite"
    ```sqlite
    select 
        version as version, 
        tsq_duration_part(rollout_time, 'days') as days, 
        tsq_duration_part(rollout_time, 'hours') as hours, 
        tsq_duration_part(rollout_time, 'minutes') as minutes, 
        tsq_duration_part(rollout_time, 'sign') as sign, 
        tsq_duration_negated(rollout_time) as back 
    from project_release 
    order by version
    ```
=== "SQL Server"
    ```sqlserver
    select 
        version as version, 
        dbo.tsq_duration_part(rollout_time, 'days') as days, 
        dbo.tsq_duration_part(rollout_time, 'hours') as hours, 
        dbo.tsq_duration_part(rollout_time, 'minutes') as minutes, 
        dbo.tsq_duration_part(rollout_time, 'sign') as sign, 
        dbo.tsq_duration_negated(rollout_time) as back 
    from project_release 
    order by version
    ```

The parameters are: `[]`

| version | days | hours | minutes | sign | back |
|---|---|---|---|---|---|
| `'0.9.0'` | `2` | `0` | `0` | `1` | `-P2D` |
| `'1.2.0'` | `1` | `12` | `0` | `1` | `-P1DT12H` |
| `'1.3.0-beta.1'` | `0` | `0` | `45` | `1` | `-PT45M` |

The fields are the ones of the duration as the database keeps it, as Temporal reads it: a duration kept as text has the fields written (`PT90M` has 90 minutes and no hours, as `Temporal.Duration.from('PT90M')`); an interval of PostgreSQL has its months (as years and months), its days and its time in hours, minutes and seconds, and no weeks; an interval of Oracle has days to seconds, or years and months. A duration kept as text reads them with the function `tsq_duration_part` (see [The functions of the library it uses](#the-functions-of-the-library-it-uses)).

## The total of a duration in a unit

`total` gives a duration in one unit, as a `double` with the fraction of the unit, as Temporal's `total` does: `PT36H` is 1.5 days. It takes the unit (`'day'`, `'hour'`, … `'nanosecond'`, in the singular or the plural), or `{ unit }`, and a day is 24 hours. A month, a year and a week have no fixed length: a unit of them, or a duration with years, months or weeks, needs a date of reference, `relativeTo`, a `plainDate` or a `plainDateTime` (only its date counts), given as a Temporal value or as a value of the query, like a column. The duration is added to that date as `add` adds it, and the unit is counted from it with the days of the calendar there: from January 15, 2024, `P1DT12H` is 1.5 of the 31 days of January, 0.048 months. Here the time of each rollout in hours, and in months from its release, and the days from the release to the publication, a duration that `since` computes:

```ts
const releases = await connection.selectFrom(tRelease)
    .select({
        version: tRelease.version,
        hours: tRelease.rolloutTime.total('hours'),
        months: tRelease.rolloutTime.total({ unit: 'month', relativeTo: tRelease.releasedOn }),
        daysToPublication: tRelease.publishedAt.since(tRelease.releasedOn.toPlainDateTime()).total('days'),
    })
    .orderBy('version')
    .executeSelectMany()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        version as version, 
        tsq_duration_total_of(rollout_time, 0, 0, 0, 'hour') as hours, 
        tsq_duration_total_of(rollout_time, cast(year(released_on) as signed), cast(month(released_on) as signed), cast(dayofmonth(released_on) as signed), 'month') as months, 
        tsq_duration_total(0, 0, 0, -timestampdiff(microsecond, published_at, timestamp(released_on)) div 1000000, (-timestampdiff(microsecond, published_at, timestamp(released_on)) % 1000000) * 1000, 0, 0, 0, 'day') as daysToPublication 
    from project_release 
    order by version
    ```
=== "MySQL"
    ```mysql
    select 
        version as version, 
        tsq_duration_total_of(rollout_time, 0, 0, 0, 'hour') as hours, 
        tsq_duration_total_of(rollout_time, cast(year(released_on) as signed), cast(month(released_on) as signed), cast(dayofmonth(released_on) as signed), 'month') as months, 
        tsq_duration_total(0, 0, 0, -timestampdiff(microsecond, published_at, timestamp(released_on)) div 1000000, (-timestampdiff(microsecond, published_at, timestamp(released_on)) % 1000000) * 1000, 0, 0, 0, 'day') as daysToPublication 
    from project_release 
    order by version
    ```
=== "Oracle"
    ```oracle
    select 
        version as "version", 
        tsq_duration_total_of(tsq_ds_interval_text(rollout_time), 0, 0, 0, 'hour') as "hours", 
        tsq_duration_total_of(tsq_ds_interval_text(rollout_time), extract(year from released_on), extract(month from released_on), extract(day from released_on), 'month') as "months", 
        tsq_duration_total(0, 0, 0, trunc(-tsq_nanoseconds_between(published_at, cast(released_on as timestamp(9))) / 1000000000), (mod(-tsq_nanoseconds_between(published_at, cast(released_on as timestamp(9))), 1000000000)), 0, 0, 0, 'day') as "daysToPublication" 
    from project_release 
    order by "version"
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        version as version, 
        tsq_duration_total_of(rollout_time, 0, 0, 0, 'hour') as hours, 
        tsq_duration_total_of(rollout_time, cast(extract(year from released_on) as integer), cast(extract(month from released_on) as integer), cast(extract(day from released_on) as integer), 'month') as months, 
        tsq_duration_total(0, 0, 0, (-(extract(epoch from cast(released_on as timestamp) - published_at) * 1000000)::bigint / 1000000), (-(extract(epoch from cast(released_on as timestamp) - published_at) * 1000000)::bigint % 1000000) * 1000, 0, 0, 0, 'day') as "daysToPublication" 
    from project_release 
    order by version
    ```
=== "SQLite"
    ```sqlite
    select 
        version as version, 
        tsq_duration_total_of(rollout_time, 0, 0, 0, 'hour') as hours, 
        tsq_duration_total_of(rollout_time, cast(strftime('%Y', released_on) as integer), cast(strftime('%m', released_on) as integer), cast(strftime('%d', released_on) as integer), 'month') as months, 
        tsq_duration_total(0, 0, 0, 0, cast(-cast(round((julianday(strftime('%Y-%m-%dT%H:%M:%fZ', released_on)) - julianday(published_at)) * 86400000) as integer) * 1000000 as text), 0, 0, 0, 'day') as daysToPublication 
    from project_release 
    order by version
    ```
=== "SQL Server"
    ```sqlserver
    select 
        version as version, 
        dbo.tsq_duration_total_of(rollout_time, 0, 0, 0, 'hour') as hours, 
        dbo.tsq_duration_total_of(rollout_time, datepart(year, released_on), datepart(month, released_on), datepart(day, released_on), 'month') as months, 
        dbo.tsq_duration_total(0, 0, 0, -dbo.tsq_ticks_between(published_at, cast(released_on as datetime2)) / 10000000, (-dbo.tsq_ticks_between(published_at, cast(released_on as datetime2)) % 10000000) * 100, 0, 0, 0, 'day') as daysToPublication 
    from project_release 
    order by version
    ```

The parameters are: `[]`

| version | hours | months | daysToPublication |
|---|---|---|---|
| `'0.9.0'` | `48` | `0.06451612903225806` | `1.4583333333333333` |
| `'1.2.0'` | `36` | `0.04838709677419355` | `1.375` |
| `'1.3.0-beta.1'` | `0.75` | `0.0010775862068965517` | `1.4166666666666667` |

The number is the one Temporal's `total` gives, to the last digit. What applies to what:

| Unit | Without `relativeTo` | With `relativeTo` |
|---|---|---|
| `'day'` and the units of the time | a day is 24 hours; a duration with years, months or weeks fails the query | the duration is added to the date; a day is 24 hours |
| `'week'`, `'month'`, `'year'` | doesn't compile | counted from the date: a month or a year has the days of the calendar there |

Without a date of reference, a duration with years, months or weeks fails the query, as Temporal's `total` throws: the type of the value doesn't tell which fields it has. The error is the one of the function `tsq_duration_total` (see [The functions of the library it uses](#the-functions-of-the-library-it-uses)), which says it needs a date of reference (on SQL Server, an error converting that text to a number, because a function there can't raise one).

On Oracle, a date before 15 October 1582 is in the Julian calendar: a total counted across that day isn't the one of Temporal (see [Dates before 1582](../databases/oracle/index.md#dates-before-1582)).

## Durations added and subtracted together

`add` and `subtract` of a duration give it plus or minus another one, as Temporal's `add` and `subtract` of a `Temporal.Duration` do. The other one is a `Temporal.Duration`, its fields (`{ hours: 12 }`), or a value of the type duration, like a column. A day is 24 hours, and the sum is written up to the largest field of the two: `PT90M` plus `PT30M` is `PT120M`, in minutes, and `P1D` plus `PT25H` is `P2DT1H`. Here the time of each rollout with a margin of 12 hours, and 15 minutes shorter:

```ts
const releases = await connection.selectFrom(tRelease)
    .select({
        version: tRelease.version,
        withMargin: tRelease.rolloutTime.add({ hours: 12 }),
        shorter: tRelease.rolloutTime.subtract(Temporal.Duration.from('PT15M')),
    })
    .orderBy('version')
    .executeSelectMany()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        version as version, 
        tsq_duration_sum(rollout_time, 'PT12H', 1) as withMargin, 
        tsq_duration_sum(rollout_time, 'PT15M', -1) as shorter 
    from project_release 
    order by version
    ```
=== "MySQL"
    ```mysql
    select 
        version as version, 
        tsq_duration_sum(rollout_time, 'PT12H', 1) as withMargin, 
        tsq_duration_sum(rollout_time, 'PT15M', -1) as shorter 
    from project_release 
    order by version
    ```
=== "Oracle"
    ```oracle
    select 
        version as "version", 
        tsq_duration_sum(tsq_ds_interval_text(rollout_time), 'PT12H', 1) as "withMargin", 
        tsq_duration_sum(tsq_ds_interval_text(rollout_time), 'PT15M', -1) as "shorter" 
    from project_release 
    order by "version"
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        version as version, 
        tsq_duration_sum(rollout_time, 'PT12H'::text, 1) as "withMargin", 
        tsq_duration_sum(rollout_time, 'PT15M'::text, -1) as shorter 
    from project_release 
    order by version
    ```
=== "SQLite"
    ```sqlite
    select 
        version as version, 
        tsq_duration_sum(rollout_time, 'PT12H', 1) as withMargin, 
        tsq_duration_sum(rollout_time, 'PT15M', -1) as shorter 
    from project_release 
    order by version
    ```
=== "SQL Server"
    ```sqlserver
    select 
        version as version, 
        dbo.tsq_duration_sum(rollout_time, 'PT12H', 1) as withMargin, 
        dbo.tsq_duration_sum(rollout_time, 'PT15M', -1) as shorter 
    from project_release 
    order by version
    ```

The parameters are: `[]`

| version | withMargin | shorter |
|---|---|---|
| `'0.9.0'` | `P2DT12H` | `P1DT23H45M` |
| `'1.2.0'` | `P2D` | `P1DT11H45M` |
| `'1.3.0-beta.1'` | `PT12H45M` | `PT30M` |

A month, a year and a week have no fixed length: a duration with years, months or weeks, given or of the database, fails the query, as Temporal's `add` throws. To add them, add each duration to a date (see [Adding and subtracting a duration](plain-dates-and-times.md#adding-and-subtracting-a-duration)).

As with `until` and `since`, on PostgreSQL the sum is an interval, which keeps it as days and a time (`PT120M` is read as `PT2H`) with its microseconds; on the other databases, Oracle too, it is the ISO 8601 text Temporal writes.

## The functions of the library it uses

Some operations of this page are computed by functions of the library: create them once in the database with the file of SQL of the functions of your database ([MariaDB](../databases/mariadb/functions.md), [MySQL](../databases/mysql/functions.md), [Oracle](../databases/oracle/functions.md), [PostgreSQL](../databases/postgresql/functions.md), [SQLite](../databases/sqlite/functions.md#the-functions-of-durations), [SQL Server](../databases/sqlserver/functions.md)), and on SQLite register them with `registerSqliteFunctions` of the query runner; without them, the query fails with the error of the database for a function that doesn't exist.

| Function | What it computes | Databases |
|---|---|---|
| `tsq_duration_part` | Reading the fields, the sign or the total of a duration the database holds, like `tRelease.rolloutTime`, negating it, or adding it to another duration: it reads the parts of its ISO 8601 text. Reading, writing or comparing a duration doesn't need it, and neither does a duration given as a value | MariaDB, MySQL, SQLite, SQL Server, and a column of Oracle or PostgreSQL that keeps a duration as text |
| `tsq_duration_total` | `total`: it adds the duration to the date of reference and divides with integers, so the `double` is rounded once, as Temporal rounds it | Every database |
| `tsq_duration_add` | `add` and `subtract` of two durations: it takes, of each duration, its largest field that isn't zero, its days, the whole seconds of its time and the nanoseconds of the second | Every database |
| `tsq_duration_text` | The text of the sum, which `tsq_duration_add` writes | MariaDB, MySQL, Oracle, SQL Server |

With `libraryFunctions = 'installed'` on the connection, a query calls `tsq_duration_total_of` and `tsq_duration_sum` instead of `tsq_duration_total` and `tsq_duration_add`, which take each duration whole and write it once, and the other optional functions of the queries of this page; the result is the same.
