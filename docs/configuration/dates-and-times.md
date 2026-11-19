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

### How each database keeps a duration

PostgreSQL and Oracle have a type for a length of time, an interval; the other databases keep a duration as its [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601#Durations) text, the text Temporal gives it (`P1Y2M3DT4H5M6.789S`):

| Database | The column | What it keeps | What is read back |
|---|---|---|---|
| PostgreSQL | `interval` | Each field as sent, the fraction of a second rounded to microseconds; weeks as days | `PT24H` as `PT24H`, `P2W` as `P14D` |
| Oracle | `INTERVAL DAY TO SECOND` | Days to seconds, with the digits of the fraction of the column | `PT24H` as `P1D` |
| Oracle | `INTERVAL YEAR TO MONTH`, when the column says it (below) | Years and months | `P14M` as `P1Y2M` |
| MariaDB, MySQL, SQLite, SQL Server | A text, like `varchar(64)` | The ISO 8601 text of the duration, all of it, up to the nanosecond | The same text: `PT24H` as `PT24H`, `P2W` as `P2W` |

On Oracle, declare the precision of the column: `INTERVAL DAY TO SECOND` keeps up to 99 days and six digits of fraction, and a duration of 100 days is rejected by Oracle; `INTERVAL DAY(9) TO SECOND(9)` keeps up to 999999999 days and nanoseconds. The same for the years of `INTERVAL YEAR(9) TO MONTH`.

### A column that keeps it in its own way

A column says how it keeps its durations with its [SQL data type](../advanced/data-types/sql-data-types.md): a text keeps the ISO 8601 text on any database, also on PostgreSQL and Oracle, where it holds what one interval of Oracle can't, like `P1M1D`; on Oracle an `INTERVAL YEAR TO MONTH` keeps the years and months. `withSqlDataType` is exported by `ts-sql-query`:

```typescriptreact
spanText = this.column('span_text', 'duration', withSqlDataType({ family: 'character string', length: 64 }))
spanCalendar = this.column('span_calendar', 'duration', withSqlDataType({ family: 'interval', fields: 'year to month' }))
```

An interval of Oracle holds either years and months or days to seconds, never both: a duration that doesn't fit the one of its column, like `P1M` for an `INTERVAL DAY TO SECOND` or `P1D` for an `INTERVAL YEAR TO MONTH`, is rejected with `INVALID_VALUE_TO_SEND_TO_DATABASE` instead of losing a part.

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
        date_add(date_add(date_add(published_at, interval tsq_duration_part(rollout_time, 'M') month), interval tsq_duration_part(rollout_time, 'D') day), interval (tsq_duration_part(rollout_time, 'S') * 1000000 + tsq_duration_part(rollout_time, 'N') div 1000) microsecond) as rolloutEndedAt 
    from project_release 
    order by version
    ```
=== "MySQL"
    ```mysql
    select 
        version as version, 
        date_add(released_on, interval ? month) as supportEndsOn, 
        date_add(date_add(date_add(published_at, interval tsq_duration_part(rollout_time, 'M') month), interval tsq_duration_part(rollout_time, 'D') day), interval (tsq_duration_part(rollout_time, 'S') * 1000000 + tsq_duration_part(rollout_time, 'N') div 1000) microsecond) as rolloutEndedAt 
    from project_release 
    order by version
    ```
=== "Oracle"
    ```oracle
    select 
        version as "version", 
        to_char((add_months(released_on, :0) - greatest(0, extract(day from add_months(released_on, :0)) - extract(day from released_on))), 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "supportEndsOn", 
        to_char(cast(published_at + rollout_time as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "rolloutEndedAt" 
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
        strftime('%Y-%m-%dT%H:%M:%fZ', date(date(published_at, 'start of month', (tsq_duration_part(rollout_time, 'M')) || ' months'), (min(cast(strftime('%d', published_at) as integer), cast(strftime('%d', date(published_at, 'start of month', (tsq_duration_part(rollout_time, 'M')) || ' months'), '+1 months', '-1 days') as integer)) - 1) || ' days') || ' ' || strftime('%H:%M:%f', published_at), (tsq_duration_part(rollout_time, 'D')) || ' days', (tsq_duration_part(rollout_time, 'S') + tsq_duration_part(rollout_time, 'N') / 1000000000.0) || ' seconds') as rolloutEndedAt 
    from project_release 
    order by version
    ```
=== "SQL Server"
    ```sqlserver
    select 
        version as version, 
        dateadd(month, @0, released_on) as supportEndsOn, 
        dateadd(nanosecond, dbo.tsq_duration_part(rollout_time, 'N'), cast(dateadd(second, dbo.tsq_duration_part(rollout_time, 'S') % 86400, dateadd(day, (dbo.tsq_duration_part(rollout_time, 'D') + dbo.tsq_duration_part(rollout_time, 'S') / 86400), dateadd(month, dbo.tsq_duration_part(rollout_time, 'M'), published_at))) as datetime2)) as rolloutEndedAt 
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

The fields of a duration given as a value must be integers with one sign, as `Temporal.Duration.from` asks: `{ days: 1, hours: -1 }`, `{ days: 1.5 }` or `{}` are rejected with `INVALID_VALUE_TO_SEND_TO_DATABASE` before the query is sent. The result keeps the digits of the fraction of a second the database keeps (see [The digits each database keeps](#the-digits-each-database-keeps)); SQLite computes with milliseconds.

### A duration kept as text: the function `tsq_duration_part`

On MariaDB, MySQL, SQLite and SQL Server, and in a column of PostgreSQL or Oracle that keeps a duration as text, a duration is its ISO 8601 text. To add one that the database holds, like `tRelease.rolloutTime`, the query reads its parts with `tsq_duration_part`, a function of the library: create it once in the database. A duration given as a value doesn't need it, and neither does reading, writing or comparing a duration. Without the function, the query fails with the error of the database for a function that doesn't exist.

=== "MariaDB"
    ```sql
    DROP FUNCTION IF EXISTS tsq_duration_part;
    DELIMITER //
    CREATE FUNCTION tsq_duration_part(d VARCHAR(100), part CHAR(1)) RETURNS BIGINT DETERMINISTIC NO SQL
    BEGIN
        DECLARE i INT DEFAULT 1;
        DECLARE n INT;
        DECLARE c CHAR(1);
        DECLARE num VARCHAR(40) DEFAULT '';
        DECLARE in_time BOOLEAN DEFAULT FALSE;
        DECLARE sgn INT DEFAULT 1;
        DECLARE r BIGINT DEFAULT 0;
        IF d IS NULL THEN RETURN NULL; END IF;
        SET d = UPPER(TRIM(d));
        SET n = CHAR_LENGTH(d);
        IF LEFT(d, 1) = '-' THEN SET sgn = -1, i = 2; ELSEIF LEFT(d, 1) = '+' THEN SET i = 2; END IF;
        SET i = i + 1;
        WHILE i <= n DO
            SET c = SUBSTRING(d, i, 1);
            IF c = 'T' THEN SET in_time = TRUE;
            ELSEIF c BETWEEN '0' AND '9' OR c = '.' OR c = ',' THEN SET num = CONCAT(num, IF(c = ',', '.', c));
            ELSE
                IF part = 'M' AND NOT in_time AND c = 'Y' THEN SET r = r + 12 * CAST(num AS SIGNED);
                ELSEIF part = 'M' AND NOT in_time AND c = 'M' THEN SET r = r + CAST(num AS SIGNED);
                ELSEIF part = 'D' AND c = 'W' THEN SET r = r + 7 * CAST(num AS SIGNED);
                ELSEIF part = 'D' AND c = 'D' THEN SET r = r + CAST(num AS SIGNED);
                ELSEIF part = 'S' AND in_time AND c = 'H' THEN SET r = r + 3600 * CAST(num AS SIGNED);
                ELSEIF part = 'S' AND in_time AND c = 'M' THEN SET r = r + 60 * CAST(num AS SIGNED);
                ELSEIF part = 'S' AND c = 'S' THEN SET r = r + CAST(SUBSTRING_INDEX(num, '.', 1) AS SIGNED);
                ELSEIF part = 'N' AND c = 'S' AND LOCATE('.', num) > 0 THEN SET r = CAST(RPAD(SUBSTRING_INDEX(num, '.', -1), 9, '0') AS SIGNED);
                END IF;
                SET num = '';
            END IF;
            SET i = i + 1;
        END WHILE;
        RETURN sgn * r;
    END
    //
    DELIMITER ;
    ```
=== "MySQL"
    ```sql
    DROP FUNCTION IF EXISTS tsq_duration_part;
    DELIMITER //
    CREATE FUNCTION tsq_duration_part(d VARCHAR(100), part CHAR(1)) RETURNS BIGINT DETERMINISTIC NO SQL
    BEGIN
        DECLARE i INT DEFAULT 1;
        DECLARE n INT;
        DECLARE c CHAR(1);
        DECLARE num VARCHAR(40) DEFAULT '';
        DECLARE in_time BOOLEAN DEFAULT FALSE;
        DECLARE sgn INT DEFAULT 1;
        DECLARE r BIGINT DEFAULT 0;
        IF d IS NULL THEN RETURN NULL; END IF;
        SET d = UPPER(TRIM(d));
        SET n = CHAR_LENGTH(d);
        IF LEFT(d, 1) = '-' THEN SET sgn = -1, i = 2; ELSEIF LEFT(d, 1) = '+' THEN SET i = 2; END IF;
        SET i = i + 1;
        WHILE i <= n DO
            SET c = SUBSTRING(d, i, 1);
            IF c = 'T' THEN SET in_time = TRUE;
            ELSEIF c BETWEEN '0' AND '9' OR c = '.' OR c = ',' THEN SET num = CONCAT(num, IF(c = ',', '.', c));
            ELSE
                IF part = 'M' AND NOT in_time AND c = 'Y' THEN SET r = r + 12 * CAST(num AS SIGNED);
                ELSEIF part = 'M' AND NOT in_time AND c = 'M' THEN SET r = r + CAST(num AS SIGNED);
                ELSEIF part = 'D' AND c = 'W' THEN SET r = r + 7 * CAST(num AS SIGNED);
                ELSEIF part = 'D' AND c = 'D' THEN SET r = r + CAST(num AS SIGNED);
                ELSEIF part = 'S' AND in_time AND c = 'H' THEN SET r = r + 3600 * CAST(num AS SIGNED);
                ELSEIF part = 'S' AND in_time AND c = 'M' THEN SET r = r + 60 * CAST(num AS SIGNED);
                ELSEIF part = 'S' AND c = 'S' THEN SET r = r + CAST(SUBSTRING_INDEX(num, '.', 1) AS SIGNED);
                ELSEIF part = 'N' AND c = 'S' AND LOCATE('.', num) > 0 THEN SET r = CAST(RPAD(SUBSTRING_INDEX(num, '.', -1), 9, '0') AS SIGNED);
                END IF;
                SET num = '';
            END IF;
            SET i = i + 1;
        END WHILE;
        RETURN sgn * r;
    END
    //
    DELIMITER ;
    ```
=== "Oracle"
    ```sql
    CREATE OR REPLACE FUNCTION tsq_duration_part(d IN VARCHAR2, part IN VARCHAR2) RETURN NUMBER DETERMINISTIC IS
        s VARCHAR2(100);
        i PLS_INTEGER := 1;
        n PLS_INTEGER;
        c VARCHAR2(1);
        num VARCHAR2(40);
        in_time BOOLEAN := FALSE;
        sgn NUMBER := 1;
        r NUMBER := 0;
    BEGIN
        IF d IS NULL THEN RETURN NULL; END IF;
        s := UPPER(TRIM(d));
        n := LENGTH(s);
        IF SUBSTR(s, 1, 1) = '-' THEN sgn := -1; i := 2; ELSIF SUBSTR(s, 1, 1) = '+' THEN i := 2; END IF;
        i := i + 1;
        WHILE i <= n LOOP
            c := SUBSTR(s, i, 1);
            IF c = 'T' THEN in_time := TRUE;
            ELSIF c BETWEEN '0' AND '9' OR c = '.' OR c = ',' THEN num := num || CASE WHEN c = ',' THEN '.' ELSE c END;
            ELSE
                IF part = 'M' AND NOT in_time AND c = 'Y' THEN r := r + 12 * TO_NUMBER(num);
                ELSIF part = 'M' AND NOT in_time AND c = 'M' THEN r := r + TO_NUMBER(num);
                ELSIF part = 'D' AND c = 'W' THEN r := r + 7 * TO_NUMBER(num);
                ELSIF part = 'D' AND c = 'D' THEN r := r + TO_NUMBER(num);
                ELSIF part = 'S' AND in_time AND c = 'H' THEN r := r + 3600 * TO_NUMBER(num);
                ELSIF part = 'S' AND in_time AND c = 'M' THEN r := r + 60 * TO_NUMBER(num);
                ELSIF part = 'S' AND c = 'S' THEN r := r + TO_NUMBER(CASE WHEN INSTR(num, '.') > 0 THEN SUBSTR(num, 1, INSTR(num, '.') - 1) ELSE num END);
                ELSIF part = 'N' AND c = 'S' AND INSTR(num, '.') > 0 THEN r := TO_NUMBER(RPAD(SUBSTR(num, INSTR(num, '.') + 1), 9, '0'));
                END IF;
                num := NULL;
            END IF;
            i := i + 1;
        END LOOP;
        RETURN sgn * r;
    END;
    ```
===+ "PostgreSQL"
    ```sql
    CREATE OR REPLACE FUNCTION tsq_duration_part(d text, part text) RETURNS bigint LANGUAGE plpgsql IMMUTABLE AS $$
    DECLARE
        s text;
        i integer := 1;
        n integer;
        c text;
        num text := '';
        in_time boolean := false;
        sgn integer := 1;
        r bigint := 0;
    BEGIN
        IF d IS NULL THEN RETURN NULL; END IF;
        s := upper(trim(d));
        n := length(s);
        IF substr(s, 1, 1) = '-' THEN sgn := -1; i := 2; ELSIF substr(s, 1, 1) = '+' THEN i := 2; END IF;
        i := i + 1;
        WHILE i <= n LOOP
            c := substr(s, i, 1);
            IF c = 'T' THEN in_time := true;
            ELSIF position(c in '0123456789.,') > 0 THEN num := num || CASE WHEN c = ',' THEN '.' ELSE c END;
            ELSE
                IF part = 'M' AND NOT in_time AND c = 'Y' THEN r := r + 12 * num::bigint;
                ELSIF part = 'M' AND NOT in_time AND c = 'M' THEN r := r + num::bigint;
                ELSIF part = 'D' AND c = 'W' THEN r := r + 7 * num::bigint;
                ELSIF part = 'D' AND c = 'D' THEN r := r + num::bigint;
                ELSIF part = 'S' AND in_time AND c = 'H' THEN r := r + 3600 * num::bigint;
                ELSIF part = 'S' AND in_time AND c = 'M' THEN r := r + 60 * num::bigint;
                ELSIF part = 'S' AND c = 'S' THEN r := r + split_part(num, '.', 1)::bigint;
                ELSIF part = 'N' AND c = 'S' AND position('.' in num) > 0 THEN r := rpad(split_part(num, '.', 2), 9, '0')::bigint;
                END IF;
                num := '';
            END IF;
            i := i + 1;
        END LOOP;
        RETURN sgn * r;
    END;
    $$;
    ```
=== "SQLite"
    `registerSqliteFunctions` registers it, written in JavaScript, with the other functions of the library: see [The SQL functions of the library](query-runners/recommended/bun_sqlite.md#the-sql-functions-of-the-library). Bun SQL's SQLite has no way to register a function.
=== "SQL Server"
    ```sql
    CREATE OR ALTER FUNCTION dbo.tsq_duration_part(@d NVARCHAR(100), @part CHAR(1)) RETURNS BIGINT WITH SCHEMABINDING AS
    BEGIN
        IF @d IS NULL RETURN NULL;
        DECLARE @s NVARCHAR(100) = UPPER(LTRIM(RTRIM(@d))), @i INT = 1, @n INT, @c NCHAR(1), @num NVARCHAR(40) = N'', @inTime BIT = 0, @sign INT = 1, @r BIGINT = 0;
        SET @n = LEN(@s);
        IF LEFT(@s, 1) = N'-' BEGIN SET @sign = -1; SET @i = 2; END ELSE IF LEFT(@s, 1) = N'+' SET @i = 2;
        SET @i = @i + 1;
        WHILE @i <= @n
        BEGIN
            SET @c = SUBSTRING(@s, @i, 1);
            IF @c = N'T' SET @inTime = 1;
            ELSE IF @c LIKE N'[0-9]' OR @c = N'.' OR @c = N',' SET @num = @num + CASE WHEN @c = N',' THEN N'.' ELSE @c END;
            ELSE
            BEGIN
                IF @part = 'M' AND @inTime = 0 AND @c = N'Y' SET @r = @r + 12 * CAST(@num AS BIGINT);
                ELSE IF @part = 'M' AND @inTime = 0 AND @c = N'M' SET @r = @r + CAST(@num AS BIGINT);
                ELSE IF @part = 'D' AND @c = N'W' SET @r = @r + 7 * CAST(@num AS BIGINT);
                ELSE IF @part = 'D' AND @c = N'D' SET @r = @r + CAST(@num AS BIGINT);
                ELSE IF @part = 'S' AND @inTime = 1 AND @c = N'H' SET @r = @r + 3600 * CAST(@num AS BIGINT);
                ELSE IF @part = 'S' AND @inTime = 1 AND @c = N'M' SET @r = @r + 60 * CAST(@num AS BIGINT);
                ELSE IF @part = 'S' AND @c = N'S' SET @r = @r + CAST(CASE WHEN CHARINDEX(N'.', @num) > 0 THEN LEFT(@num, CHARINDEX(N'.', @num) - 1) ELSE @num END AS BIGINT);
                ELSE IF @part = 'N' AND @c = N'S' AND CHARINDEX(N'.', @num) > 0 SET @r = CAST(LEFT(SUBSTRING(@num, CHARINDEX(N'.', @num) + 1, 40) + N'000000000', 9) AS BIGINT);
                SET @num = N'';
            END
            SET @i = @i + 1;
        END
        RETURN @sign * @r;
    END
    GO
    ```


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
        date_add(date_add(makedate(year(released_on), 1), interval month(released_on) - 1 month), interval 1 - 1 day) as monthOfRelease, 
        sec_to_time(mod((2 * (floor(time_to_sec(cutoff_time)) * 1000000 + microsecond(cutoff_time)) * 1000 + 21600000000000) div 43200000000000 * 21600000000000, 86400000000000) div 1000 * 0.000001) as cutoffSlot 
    from project_release 
    order by version
    ```
=== "MySQL"
    ```mysql
    select 
        version as version, 
        date_add(date_add(makedate(year(released_on), 1), interval month(released_on) - 1 month), interval 1 - 1 day) as monthOfRelease, 
        sec_to_time(mod((2 * (floor(time_to_sec(cutoff_time)) * 1000000 + microsecond(cutoff_time)) * 1000 + 21600000000000) div 43200000000000 * 21600000000000, 86400000000000) div 1000 * 0.000001) as cutoffSlot 
    from project_release 
    order by version
    ```
=== "Oracle"
    ```oracle
    select 
        version as "version", 
        to_char((add_months(date '0001-01-01', (extract(year from released_on) - 1) * 12 + extract(month from released_on) - 1) + 1 - 1), 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "monthOfRelease", 
        to_char(cast(timestamp '1970-01-01 00:00:00' + numtodsinterval(mod(trunc((2 * (extract(hour from (cast(cutoff_time as timestamp(9)) - trunc(cutoff_time))) * 3600 + extract(minute from (cast(cutoff_time as timestamp(9)) - trunc(cutoff_time))) * 60 + extract(second from (cast(cutoff_time as timestamp(9)) - trunc(cutoff_time)))) * 1000000000 + 21600000000000) / 43200000000000) * 21600000000000, 86400000000000) / 1000000000, 'second') as timestamp(9)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "cutoffSlot" 
    from project_release 
    order by "version"
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        version as version, 
        make_date(cast(extract(year from released_on) as integer), cast(extract(month from released_on) as integer), 1) as "monthOfRelease", 
        time '00:00' + make_interval(secs => (((2 * (round(extract(epoch from cast(cutoff_time as time)) * 1000000)::bigint * 1000) + 21600000000000) / 43200000000000) * 21600000000000) / 1000000000.0) as "cutoffSlot" 
    from project_release 
    order by version
    ```
=== "SQLite"
    ```sqlite
    select 
        version as version, 
        date(printf('%04d-%02d-%02d', cast(strftime('%Y', released_on) as integer), cast(strftime('%m', released_on) as integer), 1)) as monthOfRelease, 
        strftime('%H:%M:%fZ', '00:00:00', ((cast((2 * cast(round((julianday(cutoff_time) - julianday(date(cutoff_time))) * 86400000) as integer) * 1000000 + 21600000000000) / 43200000000000 as integer) * 21600000000000) / 1000000000.0) || ' seconds') as cutoffSlot 
    from project_release 
    order by version
    ```
=== "SQL Server"
    ```sqlserver
    select 
        version as version, 
        datefromparts(datepart(year, released_on), datepart(month, released_on), 1) as monthOfRelease, 
        dateadd(nanosecond, ((2 * (cast(datediff(second, cast('00:00' as time), cast(cutoff_time as time)) as bigint) * 1000000000 + datepart(nanosecond, cutoff_time)) + cast(21600000000000 as bigint)) / cast(43200000000000 as bigint) * cast(21600000000000 as bigint)) % 1000000000, dateadd(second, ((2 * (cast(datediff(second, cast('00:00' as time), cast(cutoff_time as time)) as bigint) * 1000000000 + datepart(nanosecond, cutoff_time)) + cast(21600000000000 as bigint)) / cast(43200000000000 as bigint) * cast(21600000000000 as bigint)) / 1000000000 % 86400, cast('00:00' as time(7)))) as cutoffSlot 
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
- **Bun SQL on MySQL 8** sends a text parameter that MySQL converts to a time wrongly (`'10:07:30'` is `00:00:00`): a `plainTime` given as a value and rounded is another time there. A column is read right, and so is every value with the other drivers and with MariaDB.
- **Oracle has no type for a time of the day**: a `plainTime` is kept in a `DATE` or a `TIMESTAMP` on 1970-01-01, as a `localTime` is.
- **An interval of PostgreSQL with fields of different signs**, like `-1 days +02:03:00` or `1 mon -1 days`, can't be a `Temporal.Duration`, whose fields have one sign: reading it is rejected with `INVALID_VALUE_RECEIVED_FROM_DATABASE`. The library never sends one.
- **A column with a zone**, like `timestamptz` on PostgreSQL: a `plainDateTime` reads the date and time it has in the zone of the database. On SQL Server, a `datetimeoffset` is read, and its parts given, in UTC.
