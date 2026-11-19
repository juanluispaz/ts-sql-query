---
search:
  boost: 0.55
---
# Dates and times

A date, a time of the day or both reach your code in one of two ways: as a [Temporal](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal) value of JavaScript, or as a `Date`. This page says what each one is, why Temporal is the one we recommend, what you need to use it, and what a query can do with these values: compare them, take their parts, and turn a date into a date and time. It also covers [durations](#durations), a length of time like the 45 minutes a task took, as a `Temporal.Duration`. Where the zone of each value comes from, and how to set up the zones of your database and your application, is in [Time zones](time-zones.md).

## The types

The same column of the database can be read either way; you choose with the type you give the column:

| Column type      | TypeScript type          | What it holds                         | The same column with a `Date` |
|------------------|--------------------------|---------------------------------------|-------------------------------|
| `plainDate`      | `Temporal.PlainDate`     | A date without time, like a birthday  | `localDate`                   |
| `plainTime`      | `Temporal.PlainTime`     | A time of the day, like an opening time | `localTime`                 |
| `plainDateTime`  | `Temporal.PlainDateTime` | A date and a time of the day          | `localDateTime`               |
| `duration`       | `Temporal.Duration`      | A length of time, like 1 day and 12 hours | None                      |

```typescriptreact
releasedOn = this.column('released_on', 'plainDate')
cutoffTime = this.column('cutoff_time', 'plainTime')
publishedAt = this.column('published_at', 'plainDateTime')
rolloutTime = this.optionalColumn('rollout_time', 'duration')
```

Their classes are `PlainDateType`, `PlainTimeType`, `PlainDateTimeType` and `DurationType`, exported by `ts-sql-query`, and a type of yours can extend their families, `PlainDatesType`, `PlainTimesType`, `PlainDateTimesType` and `DurationsType`, as in [Data types of your own](../advanced/data-types/own-data-types.md#the-families).

## Why Temporal

A `Date` is an instant: a number of milliseconds since 1970-01-01 UTC, the same moment everywhere. A date or a time stored without a zone is not an instant, so the library puts its digits in the UTC getters of the `Date` (see [Read the values with the UTC getters](time-zones.md#read-the-values-with-the-utc-getters)), and you have to read it with them. A Temporal value without zone holds the digits themselves, so there is no zone to keep in mind:

- `release.releasedOn.toString()` is `'2024-01-15'` in any zone of your application, and `release.releasedOn.month` is `1`.
- It keeps every digit of the fraction of a second the database keeps, where a `Date` stops at the millisecond.
- A `Temporal.PlainDate` has no time and a `Temporal.PlainTime` has no date, so neither can be mistaken for the other.

The `local…` types stay fully supported: choose them when your code already works with `Date`.

## What you need

- A runtime with `Temporal`. Node 26 and Bun 1.4 have it. In another runtime, install a polyfill in the global object (`globalThis.Temporal`) before the first query; the library reads `Temporal` from there when it converts a value. Without it, converting a value of these types is rejected with `TEMPORAL_NOT_AVAILABLE`, and the rest of the library works as usual.
- The types of `Temporal` in TypeScript: `"lib": ["esnext"]`, or `"esnext.temporal"` added to your `lib`. Without them your code still compiles, but the values of these types have the type `never`.

## Temporal values in a query

A value is compared, assigned or sent as a parameter as a Temporal value of its type, here the releases from February 2024 on:

```ts
const releases = await connection.selectFrom(tRelease)
    .where(tRelease.releasedOn.greaterOrEqual(Temporal.PlainDate.from('2024-02-01')))
    .select({
        version: tRelease.version,
        releasedOn: tRelease.releasedOn,
        cutoffTime: tRelease.cutoffTime,
        publishedAt: tRelease.publishedAt,
    })
    .orderBy('releasedOn')
    .executeSelectMany()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        version as version, 
        released_on as releasedOn, 
        cutoff_time as cutoffTime, 
        published_at as publishedAt 
    from project_release 
    where released_on >= ? 
    order by releasedOn
    ```
=== "MySQL"
    ```mysql
    select 
        version as version, 
        released_on as releasedOn, 
        cutoff_time as cutoffTime, 
        published_at as publishedAt 
    from project_release 
    where released_on >= ? 
    order by releasedOn
    ```
=== "Oracle"
    ```oracle
    select 
        version as "version", 
        to_char(released_on, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "releasedOn", 
        to_char(cast(cutoff_time as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "cutoffTime", 
        to_char(cast(published_at as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "publishedAt" 
    from project_release 
    where released_on >= to_date(:0, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') 
    order by project_release.released_on
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        version as version, 
        released_on as "releasedOn", 
        cutoff_time as "cutoffTime", 
        published_at as "publishedAt" 
    from project_release 
    where released_on >= $1 
    order by "releasedOn"
    ```
=== "SQLite"
    ```sqlite
    select 
        version as version, 
        released_on as releasedOn, 
        cutoff_time as cutoffTime, 
        published_at as publishedAt 
    from project_release 
    where released_on >= ?1 
    order by releasedOn
    ```
=== "SQL Server"
    ```sqlserver
    select 
        version as version, 
        released_on as releasedOn, 
        cutoff_time as cutoffTime, 
        published_at as publishedAt 
    from project_release 
    where released_on >= @0 
    order by releasedOn
    ```

The parameters are: `[ PlainDate 2024-02-01 ]` (on SQLite: `[ '2024-02-01' ]`)

| version | releasedOn | cutoffTime | publishedAt |
|---|---|---|---|
| `'1.3.0-beta.1'` | `2024-02-20` | `18:30:00` | `2024-02-21T10:00:00` |
| `'0.9.0'` | `2024-03-01` | `16:00:00` | `2024-03-02T11:00:00` |

A value of another type is rejected with `INVALID_VALUE_TO_SEND_TO_DATABASE`: a `Date`, a text, or a `Temporal.PlainDateTime` given to a `plainDate`.

## The parts of a value

Each part is an `int`, computed by the database, with the meaning and the name it has in Temporal:

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
        to_char(cast(cast(released_on as timestamp(9)) + to_dsinterval('0 ' || to_char(cast(cutoff_time as timestamp(9)), 'HH24:MI:SS.FF9')) as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "deadline", 
        to_char(trunc(published_at), 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "publishedOn" 
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

## The current date and time

`currentPlainDate()`, `currentPlainTime()` and `currentPlainDateTime()` of the connection give the date and the time of the database as Temporal values, as `currentDate()`, `currentTime()` and `currentDateTime()` give them as a `Date`:

<!-- doc-code-snippet-result: { "today": "2024-05-06", "now": "2024-05-06 10:11:12.345678" } -->
```ts
const { today, now } = await connection.selectFromNoTable()
    .select({
        today: connection.currentPlainDate(),
        now: connection.currentPlainDateTime(),
    })
    .executeSelectOne()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        current_date as today, 
        current_timestamp as `now`
    ```
=== "MySQL"
    ```mysql
    select 
        current_date as today, 
        current_timestamp as `now`
    ```
=== "Oracle"
    ```oracle
    select 
        to_char(trunc(current_timestamp), 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "today", 
        to_char(cast(current_timestamp as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "now" 
    from dual
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        current_date as today, 
        current_timestamp as now
    ```
=== "SQLite"
    ```sqlite
    select 
        date('now') as today, 
        strftime('%Y-%m-%dT%H:%M:%fZ', 'now') as now
    ```
=== "SQL Server"
    ```sqlserver
    select 
        current_date as today, 
        current_timestamp as now
    ```

The parameters are: `[]`

## Durations

A `duration` is a length of time: how long something took or lasts, like the 45 minutes a rollout took. It is a `Temporal.Duration`, with its fields from years to nanoseconds. It isn't a time of the day: 25 hours is a duration, and `plainTime` has no 25:00.

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

### Comparing durations

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
| Its microseconds | Equal | Equal |

### How each database keeps a duration

PostgreSQL and Oracle have a type for a length of time, an interval; the other databases keep a duration as its ISO 8601 text, the default, or as its number of microseconds:

| Database | The column | What it keeps | What is read back |
|---|---|---|---|
| PostgreSQL | `interval` | Each field as sent, the fraction of a second rounded to microseconds; weeks as days | `PT24H` as `PT24H`, `P2W` as `P14D` |
| Oracle | `INTERVAL DAY TO SECOND` | Days to seconds, with the digits of the fraction of the column | `PT24H` as `P1D` |
| Oracle | `INTERVAL YEAR TO MONTH`, when the column says it (below) | Years and months | `P14M` as `P1Y2M` |
| MariaDB, MySQL, SQLite, SQL Server | A text, like `varchar(64)`; the default | The ISO 8601 text of the duration, all of it | The same text: `PT24H` as `PT24H` |
| MariaDB, MySQL, SQLite, SQL Server | An integer, like `bigint`, with `'microseconds as integer'` | Its microseconds; the nanoseconds are dropped | Days and longer as hours: `P1D` as `PT24H`, `PT90M` as `PT1H30M` |

On Oracle, declare the precision of the column: `INTERVAL DAY TO SECOND` keeps up to 99 days and six digits of fraction, and a duration of 100 days is rejected by Oracle; `INTERVAL DAY(9) TO SECOND(9)` keeps up to 999999999 days and nanoseconds. The same for the years of `INTERVAL YEAR(9) TO MONTH`.

### Where there is no interval: `durationStrategy`

On MariaDB, MySQL, SQLite and SQL Server the field `durationStrategy` of the connection says how its duration columns keep their values:

- `'ISO 8601 text'`, the default: any duration, with all its fields, compared as text.
- `'microseconds as integer'`: a duration without years nor months, a week being 7 days and a day 24 hours, compared by its length. A duration with years or months is rejected with `INVALID_VALUE_TO_SEND_TO_DATABASE`, because a month has no fixed number of microseconds.

<!-- doc-code-snippet-template: mysql -->
```ts
import { MySqlConnection } from "ts-sql-query/mysql";

class DBConnection extends MySqlConnection<'DBConnection'> {
    protected override durationStrategy = 'microseconds as integer' as const
}
```

### A column that keeps it in its own way

A column can say how it keeps its durations with its [SQL data type](../advanced/data-types/sql-data-types.md), whatever the database and the strategy of the connection: a text keeps the ISO 8601 text, an exact integer the microseconds, and on Oracle an `INTERVAL YEAR TO MONTH` the years and months. `withSqlDataType` is exported by `ts-sql-query`:

```typescriptreact
spanText = this.column('span_text', 'duration', withSqlDataType({ family: 'character string', length: 64 }))
spanMicros = this.column('span_micros', 'duration', withSqlDataType({ family: 'exact numeric', bytes: 8, scale: 0 }))
spanCalendar = this.column('span_calendar', 'duration', withSqlDataType({ family: 'interval', fields: 'year to month' }))
```

An interval of Oracle holds either years and months or days to seconds, never both: a duration that doesn't fit the one of its column, like `P1M` for an `INTERVAL DAY TO SECOND` or `P1D` for an `INTERVAL YEAR TO MONTH`, is rejected with `INVALID_VALUE_TO_SEND_TO_DATABASE` instead of losing a part.

## The digits each database keeps

A Temporal value goes to the database with all its digits, up to the nanosecond, and comes back with all the ones the column keeps. A value with more digits than the column keeps is rounded or cut by the database, as with any other way of sending it. Measured with a column of six digits of fraction, and seven on SQL Server, sending `23:59:58.123456789`:

| Database | Keeps | Reads back |
|---|---|---|
| MariaDB | Microseconds, the digits beyond dropped | `23:59:58.123456` |
| MySQL | Microseconds, rounded | `23:59:58.123457` |
| Oracle | Microseconds in a `TIMESTAMP`, rounded | `23:59:58.123457` |
| PostgreSQL | Microseconds, rounded | `23:59:58.123457` |
| SQLite | What the [format of its dates](supported-databases/sqlite.md#working-with-date-and-time) says: milliseconds by default | `23:59:58.123` |
| SQL Server | Hundreds of nanoseconds in a `datetime2(7)`, rounded | `23:59:58.1234568` |

## Known limits

- **Bun SQL** gives a `timestamp` (PostgreSQL) or a `datetime` (MySQL and MariaDB) as a `Date`, and has no way to give its text: a `plainDateTime` read through it stops at the millisecond. A `date` and a `time` keep all their digits. The other drivers of these databases read every digit.
- **A year before 1.** In Temporal the year before 1 is 0 (1 BC), and the one before it -1. PostgreSQL and Oracle keep these dates, but `year()` gives the year as they number it, with no year 0: -1 for 1 BC and -44 for 44 BC, where the value read is `-000043-03-15`. SQL Server rejects a date before the year 1.
- **Oracle has no type for a time of the day**: a `plainTime` is kept in a `DATE` or a `TIMESTAMP` on 1970-01-01, as a `localTime` is.
- **An interval of PostgreSQL with fields of different signs**, like `-1 days +02:03:00` or `1 mon -1 days`, can't be a `Temporal.Duration`, whose fields have one sign: reading it is rejected with `INVALID_VALUE_RECEIVED_FROM_DATABASE`. The library never sends one.
- **A column with a zone**, like `timestamptz` on PostgreSQL: a `plainDateTime` reads the date and time it has in the zone of the database. On SQL Server, a `datetimeoffset` is read, and its parts given, in UTC.
