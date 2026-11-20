---
search:
  boost: 0.55
---
# Dates and times

A date, a time of the day or both reach your code in one of two ways: as a [Temporal](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal) value of JavaScript, or as a `Date`. This page says what each one is, why Temporal is the one we recommend, what you need to use it, and what a query can do with these values: compare them, take their parts, and turn a date into a date and time. It also covers [instants](#instants), an exact moment like the one a release was deployed, as a `Temporal.Instant`, and [durations](#durations), a length of time like the 45 minutes a task took, as a `Temporal.Duration`. Where the zone of each value comes from, and how to set up the zones of your database and your application, is in [Time zones](time-zones.md).

## The types

The same column of the database can be read either way; you choose with the type you give the column:

| Column type      | TypeScript type          | What it holds                         | The same column with a `Date` |
|------------------|--------------------------|---------------------------------------|-------------------------------|
| `plainDate`      | `Temporal.PlainDate`     | A date without time, like a birthday  | `localDate`                   |
| `plainTime`      | `Temporal.PlainTime`     | A time of the day, like an opening time | `localTime`                 |
| `plainDateTime`  | `Temporal.PlainDateTime` | A date and a time of the day          | `localDateTime`               |
| `instant`        | `Temporal.Instant`       | An exact moment, the same everywhere, like the one a release was deployed | `localDateTime` |
| `zonedDateTime`  | `Temporal.ZonedDateTime` | An exact moment in a time zone, like a meeting at 09:00 in Madrid; only on Oracle | None |
| `duration`       | `Temporal.Duration`      | A length of time, like 1 day and 12 hours | None                      |

```typescriptreact
releasedOn = this.column('released_on', 'plainDate')
cutoffTime = this.column('cutoff_time', 'plainTime')
publishedAt = this.column('published_at', 'plainDateTime')
rolloutTime = this.optionalColumn('rollout_time', 'duration')
deployedAt = this.optionalColumn('deployed_at', 'instant')
```

Their classes are `PlainDateType`, `PlainTimeType`, `PlainDateTimeType`, `InstantType`, `ZonedDateTimeType` and `DurationType`, exported by `ts-sql-query`, and a type of yours can extend their families, `PlainDatesType`, `PlainTimesType`, `PlainDateTimesType`, `InstantsType`, `ZonedDateTimesType` and `DurationsType`, as in [Data types of your own](../advanced/data-types/own-data-types.md#the-families).

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

## Instants

An `instant` is an exact moment, the same everywhere: when a release was deployed, when a payment was made. It is a `Temporal.Instant`, with nanoseconds. It isn't a date and a time of the day: `2024-01-16T09:30:15Z` is 10:30:15 in Madrid and 18:30:15 in Tokyo, the same instant. A `plainDateTime` is the other way round, a wall clock without a zone, like a meeting at 10:00 wherever you are. A `localDateTime` is also an instant, as a `Date`, which stops at the millisecond.

The value is compared, assigned and sent as a `Temporal.Instant`, and instants are ordered by their moment. The offset of the text it is written with is only how it is written: `2024-01-16T10:30:15+01:00` is `2024-01-16T09:30:15Z`. Here, the releases deployed from that instant on:

```ts
const deployments = await connection.selectFrom(tRelease)
    .where(tRelease.deployedAt.greaterOrEqual(Temporal.Instant.from('2024-01-16T10:30:15+01:00')))
    .select({
        version: tRelease.version,
        deployedAt: tRelease.deployedAt,
    })
    .orderBy('deployedAt')
    .executeSelectMany()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        version as version, 
        deployed_at as deployedAt 
    from project_release 
    where deployed_at >= ? 
    order by deployedAt
    ```
=== "MySQL"
    ```mysql
    select 
        version as version, 
        deployed_at as deployedAt 
    from project_release 
    where deployed_at >= ? 
    order by deployedAt
    ```
=== "Oracle"
    ```oracle
    select 
        version as "version", 
        to_char(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "deployedAt" 
    from project_release 
    where deployed_at >= to_timestamp(:0, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') 
    order by project_release.deployed_at
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        version as version, 
        deployed_at as "deployedAt" 
    from project_release 
    where deployed_at >= $1 
    order by "deployedAt"
    ```
=== "SQLite"
    ```sqlite
    select 
        version as version, 
        deployed_at as deployedAt 
    from project_release 
    where deployed_at >= ?1 
    order by deployedAt
    ```
=== "SQL Server"
    ```sqlserver
    select 
        version as version, 
        deployed_at as deployedAt 
    from project_release 
    where deployed_at >= @0 
    order by deployedAt
    ```

The parameters are: `[ Instant 2024-01-16T09:30:15Z ]` (on SQLite: `[ '2024-01-16T09:30:15.000Z' ]`)

| version | deployedAt |
|---|---|
| `'1.2.0'` | `2024-01-16T09:30:15.123456Z` (on SQLite: `2024-01-16T09:30:15.123Z`) |
| `'0.9.0'` | `2024-03-02T11:05:00Z` |

An instant can be kept in any column of a date and a time:

- **A column that keeps the instant** (`timestamptz`, `TIMESTAMP WITH TIME ZONE`, `datetimeoffset`): what you read is the instant written. The library writes it with the offset `+00:00`; one written with another offset by another program is read as its instant. A MySQL and MariaDB `TIMESTAMP` and an Oracle `TIMESTAMP WITH LOCAL TIME ZONE` keep the instant too, converted with the zone of the session, which must be the zone of the database.
- **A column without a zone** keeps the wall clock of the instant in the zone of the database: in UTC, `2024-01-16 09:30:15.123456`. With a [database outside UTC](time-zones.md#a-database-outside-utc), the database converts it with its session.

| Database | Keeps the instant | Keeps its wall clock |
|---|---|---|
| MariaDB | `TIMESTAMP(6)`, converted with the zone of the session, from 1970 to 2106 (MariaDB 13) | `DATETIME(6)` |
| MySQL | `TIMESTAMP(6)`, converted with the zone of the session, from 1970 to 2038 | `DATETIME(6)` |
| Oracle | `TIMESTAMP(9) WITH TIME ZONE`, or `TIMESTAMP(9) WITH LOCAL TIME ZONE`, converted with the zone of the session | `TIMESTAMP(9)`, `DATE` |
| PostgreSQL | `timestamptz` | `timestamp` |
| SQLite | none: it keeps an instant as it keeps a `localDateTime`, in the [format of its dates](supported-databases/sqlite/index.md#working-with-date-and-time) | |
| SQL Server | `datetimeoffset(7)` | `datetime2(7)` |

On SQLite a `localdate` format keeps the wall clock of the instant in the zone of the application. With [`sqliteRunsInApplicationTimeZone`](supported-databases/sqlite/index.md#the-date-functions-and-the-time-zone), the arithmetic of the instant takes it to UTC and back with the modifiers `'utc'` and `'localtime'`; without it, the zone of the application must be UTC.

The [four kinds of temporal column](time-zones.md#the-four-kinds-of-temporal-column) explain what each one does with the zone. On MySQL and MariaDB a `TIMESTAMP` rejects an instant outside its range, from `1970-01-01T00:00:01Z` to `2038-01-19T03:14:07Z` on MySQL, and to `2106-02-07T06:28:15Z` on MariaDB 13; a `DATETIME(6)` in UTC also holds the instants before and after it.

### The epoch of an instant, and its date and time

An instant has no year, month or hour of its own: as in Temporal, they depend on the zone they are seen in. Its date and time in the zone of the database, UTC unless you [declare another](time-zones.md#a-database-outside-utc), are `toPlainDateTime()`, `toPlainDate()` and `toPlainTime()`, which Temporal writes `instant.toZonedDateTimeISO(zone).toPlainDateTime()`; the parts are taken from them, like `toPlainDateTime().hour()`. The other way round, `toInstant()` of a `plainDateTime` is the instant of that wall clock in the zone of the database. `epochMilliseconds()` and `epochNanoseconds()` count from `1970-01-01T00:00:00Z`, as Temporal's: the milliseconds as a number, rounded down, also before 1970, and the nanoseconds as a `bigint`.

```ts
const deployments = await connection.selectFrom(tRelease)
    .where(tRelease.deployedAt.isNotNull())
    .select({
        version: tRelease.version,
        deployedOn: tRelease.deployedAt.toPlainDate(),
        deployedMs: tRelease.deployedAt.epochMilliseconds(),
        published: tRelease.publishedAt.toInstant(),
    })
    .orderBy('version')
    .executeSelectMany()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        version as version, 
        date(deployed_at) as deployedOn, 
        floor(timestampdiff(microsecond, '1970-01-01 00:00:00', deployed_at) / 1000) as deployedMs, 
        published_at as published 
    from project_release 
    where deployed_at is not null 
    order by version
    ```
=== "MySQL"
    ```mysql
    select 
        version as version, 
        date(deployed_at) as deployedOn, 
        floor(timestampdiff(microsecond, '1970-01-01 00:00:00', deployed_at) / 1000) as deployedMs, 
        published_at as published 
    from project_release 
    where deployed_at is not null 
    order by version
    ```
=== "Oracle"
    ```oracle
    select 
        version as "version", 
        to_char(trunc(cast(cast(deployed_at as timestamp(9) with time zone) at local as timestamp(9))), 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "deployedOn", 
        (trunc(timestamp '1970-01-01 00:00:00' + (deployed_at - timestamp '1970-01-01 00:00:00')) - date '1970-01-01') * 86400000 + to_number(to_char(timestamp '1970-01-01 00:00:00' + (deployed_at - timestamp '1970-01-01 00:00:00'), 'SSSSSFF3')) as "deployedMs", 
        to_char(sys_extract_utc(cast(published_at as timestamp(9) with time zone)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "published" 
    from project_release 
    where deployed_at is not null 
    order by "version"
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        version as version, 
        cast(deployed_at::timestamp as date) as "deployedOn", 
        floor(extract(epoch from deployed_at) * 1000) as "deployedMs", 
        published_at as published 
    from project_release 
    where deployed_at is not null 
    order by version
    ```
=== "SQLite"
    ```sqlite
    select 
        version as version, 
        date(deployed_at) as deployedOn, 
        round(unixepoch(deployed_at, 'subsec') * 1000) as deployedMs, 
        published_at as published 
    from project_release 
    where deployed_at is not null 
    order by version
    ```
=== "SQL Server"
    ```sqlserver
    select 
        version as version, 
        cast(cast(switchoffset(deployed_at, '+00:00') as datetime2) as date) as deployedOn, 
        datediff_big(millisecond, '1970-01-01 00:00:00', deployed_at) as deployedMs, 
        published_at as published 
    from project_release 
    where deployed_at is not null 
    order by version
    ```

The parameters are: `[]`

| version | deployedOn | deployedMs | published |
|---|---|---|---|
| `'0.9.0'` | `2024-03-02` | `1709377500000` | `2024-03-02T11:00:00Z` |
| `'1.2.0'` | `2024-01-16` | `1705397415123` | `2024-01-16T09:00:00Z` |

The other way round, `connection.instantFromEpochMilliseconds(value)` and `connection.instantFromEpochNanoseconds(value)` give the instant of a number of milliseconds or nanoseconds since `1970-01-01T00:00:00Z`, as Temporal's `Temporal.Instant.fromEpochMilliseconds` and `fromEpochNanoseconds`. Of a value of the query, like a column that keeps a Unix time in milliseconds, the database computes it, with the digits it keeps. A number (a `bigint` for the nanoseconds) is the `Temporal.Instant` sent as a value:

```ts
const deployedBefore = await connection.selectFrom(tRelease)
    .where(tRelease.deployedAt.lessThan(connection.instantFromEpochMilliseconds(1705400000000)))
    .select({
        version: tRelease.version,
        deployedAt: tRelease.deployedAt,
        sameInstant: connection.instantFromEpochMilliseconds(tRelease.deployedAt.epochMilliseconds()),
    })
    .orderBy('version')
    .executeSelectMany()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        version as version, 
        deployed_at as deployedAt, 
        date_add(date_add(date '1970-01-01', interval (floor(timestampdiff(microsecond, '1970-01-01 00:00:00', deployed_at) / 1000) - ((floor(timestampdiff(microsecond, '1970-01-01 00:00:00', deployed_at) / 1000) % 86400000 + 86400000) % 86400000)) div 86400000 day), interval (((floor(timestampdiff(microsecond, '1970-01-01 00:00:00', deployed_at) / 1000) % 86400000 + 86400000) % 86400000) * 1000000) div 1000 microsecond) as sameInstant 
    from project_release 
    where deployed_at < ? 
    order by version
    ```
=== "MySQL"
    ```mysql
    select 
        version as version, 
        deployed_at as deployedAt, 
        date_add(date_add(date '1970-01-01', interval (floor(timestampdiff(microsecond, '1970-01-01 00:00:00', deployed_at) / 1000) - ((floor(timestampdiff(microsecond, '1970-01-01 00:00:00', deployed_at) / 1000) % 86400000 + 86400000) % 86400000)) div 86400000 day), interval (((floor(timestampdiff(microsecond, '1970-01-01 00:00:00', deployed_at) / 1000) % 86400000 + 86400000) % 86400000) * 1000000) div 1000 microsecond) as sameInstant 
    from project_release 
    where deployed_at < ? 
    order by version
    ```
=== "Oracle"
    ```oracle
    select 
        version as "version", 
        to_char(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "deployedAt", 
        to_char(sys_extract_utc(cast(from_tz(cast((date '1970-01-01' + trunc(((trunc(timestamp '1970-01-01 00:00:00' + (deployed_at - timestamp '1970-01-01 00:00:00')) - date '1970-01-01') * 86400000 + to_number(to_char(timestamp '1970-01-01 00:00:00' + (deployed_at - timestamp '1970-01-01 00:00:00'), 'SSSSSFF3')) - (mod((mod((trunc(timestamp '1970-01-01 00:00:00' + (deployed_at - timestamp '1970-01-01 00:00:00')) - date '1970-01-01') * 86400000 + to_number(to_char(timestamp '1970-01-01 00:00:00' + (deployed_at - timestamp '1970-01-01 00:00:00'), 'SSSSSFF3')), 86400000) + 86400000), 86400000))) / 86400000)) as timestamp(9)) + numtodsinterval(((mod((mod((trunc(timestamp '1970-01-01 00:00:00' + (deployed_at - timestamp '1970-01-01 00:00:00')) - date '1970-01-01') * 86400000 + to_number(to_char(timestamp '1970-01-01 00:00:00' + (deployed_at - timestamp '1970-01-01 00:00:00'), 'SSSSSFF3')), 86400000) + 86400000), 86400000)) * 1000000) / 1000000000, 'second'), '+00:00') as timestamp(9) with time zone)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "sameInstant" 
    from project_release 
    where deployed_at < to_timestamp(:0, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') 
    order by "version"
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        version as version, 
        deployed_at as "deployedAt", 
        (date '1970-01-01' + cast(((cast(floor(extract(epoch from deployed_at) * 1000) as bigint) - ((cast(floor(extract(epoch from deployed_at) * 1000) as bigint) % 86400000 + 86400000) % 86400000)) / 86400000) as integer)) + make_interval(secs => (((cast(floor(extract(epoch from deployed_at) * 1000) as bigint) % 86400000 + 86400000) % 86400000) * 1000000) / 1000000000.0) as "sameInstant" 
    from project_release 
    where deployed_at < $1 
    order by version
    ```
=== "SQLite"
    ```sqlite
    select 
        version as version, 
        deployed_at as deployedAt, 
        strftime('%Y-%m-%dT%H:%M:%fZ', date('1970-01-01', (cast((round(unixepoch(deployed_at, 'subsec') * 1000) - ((round(unixepoch(deployed_at, 'subsec') * 1000) % 86400000 + 86400000) % 86400000)) / 86400000 as integer)) || ' days'), ((((round(unixepoch(deployed_at, 'subsec') * 1000) % 86400000 + 86400000) % 86400000) * 1000000) / 1000000000.0) || ' seconds') as sameInstant 
    from project_release 
    where deployed_at < ?1 
    order by version
    ```
=== "SQL Server"
    ```sqlserver
    select 
        version as version, 
        deployed_at as deployedAt, 
        dateadd(nanosecond, (((cast(datediff_big(millisecond, '1970-01-01 00:00:00', deployed_at) as bigint) % 86400000 + 86400000) % 86400000) * 1000000) % 1000000000, dateadd(second, (((cast(datediff_big(millisecond, '1970-01-01 00:00:00', deployed_at) as bigint) % 86400000 + 86400000) % 86400000) * 1000000) / 1000000000, cast(dateadd(day, (cast(datediff_big(millisecond, '1970-01-01 00:00:00', deployed_at) as bigint) - ((cast(datediff_big(millisecond, '1970-01-01 00:00:00', deployed_at) as bigint) % 86400000 + 86400000) % 86400000)) / 86400000, cast('1970-01-01' as date)) as datetime2))) as sameInstant 
    from project_release 
    where deployed_at < @0 
    order by version
    ```

The parameters are: `[ Instant 2024-01-16T10:13:20Z ]` (on SQLite: `[ '2024-01-16T10:13:20.000Z' ]`)

| version | deployedAt | sameInstant |
|---|---|---|
| `'1.2.0'` | `2024-01-16T09:30:15.123456Z` (on SQLite: `2024-01-16T09:30:15.123Z`) | `2024-01-16T09:30:15.123Z` |

`epochNanoseconds()` holds every instant on PostgreSQL, MariaDB, MySQL and Oracle, which compute it as a decimal. On SQL Server and SQLite it is a 64-bit integer, so an instant before 1678 or after 2262 makes the query fail. SQLite keeps an instant to the millisecond, and its drivers give an integer beyond 2^53, like the nanoseconds of today, as a rounded number unless their big-integer mode is on: the library then rejects reading it with `PRECISION_LOST_RECEIVING_VALUE_FROM_DATABASE`, and the value can still be compared in the query.

### The arithmetic of an instant

An instant has Temporal's arithmetic, with the units of the time alone, since without a zone a day has no fixed length:

- `add` and `subtract` take a `Temporal.Duration` or its fields, of hours and smaller units: `add({ hours: 48 })`. A duration with days, weeks, months or years is rejected before the query is sent, as Temporal rejects it. They also take a duration of the query, like a column: `add(tRelease.rolloutTime)`. Its value is only known by the database, so the query fails when it has days, weeks, months or years. An interval of Oracle keeps `PT48H` as 2 days, so it fails there too; PostgreSQL's interval and a duration kept as text keep its hours.
- `until` and `since` give the duration to or from another instant, in seconds and smaller units by default: `largestUnit` asks for minutes or hours, and `smallestUnit`, `roundingIncrement` and `roundingMode` round it, as for a [date and time](#the-options-of-until-and-since).
- `round` rounds it to a unit, or to multiples of an increment of the unit that divides a day, like 90 minutes, in the mode given (`halfExpand` by default): `round({ smallestUnit: 'hour', roundingMode: 'floor' })`. Before 1970 it rounds as after it: `trunc` and `floor` give the same instant.

```ts
const deployments = await connection.selectFrom(tRelease)
    .where(tRelease.deployedAt.isNotNull())
    .select({
        version: tRelease.version,
        afterPublishing: tRelease.deployedAt.since(tRelease.publishedAt.toInstant(), { largestUnit: 'hour' }),
        hour: tRelease.deployedAt.round({ smallestUnit: 'hour', roundingMode: 'floor' }),
        reviewBy: tRelease.deployedAt.round({ smallestUnit: 'hour', roundingMode: 'ceil' }).add({ hours: 48 }),
    })
    .orderBy('version')
    .executeSelectMany()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        version as version, 
        tsq_duration_text(0, 0, 0, 0, -(datediff(date(published_at), date(deployed_at)) * cast(86400000000000 as decimal(65)) + ((floor(time_to_sec(published_at)) * 1000000 + microsecond(published_at)) * 1000 - (floor(time_to_sec(deployed_at)) * 1000000 + microsecond(deployed_at)) * 1000)), 'hour') as afterPublishing, 
        date_add(date(deployed_at), interval ((floor(time_to_sec(deployed_at)) * 1000000 + microsecond(deployed_at)) * 1000 div 3600000000000 * 3600000000000) div 1000 microsecond) as hour, 
        date_add(date_add(date(deployed_at), interval (((floor(time_to_sec(deployed_at)) * 1000000 + microsecond(deployed_at)) * 1000 + 3599999999999) div 3600000000000 * 3600000000000) div 1000 microsecond), interval ? microsecond) as reviewBy 
    from project_release 
    where deployed_at is not null 
    order by version
    ```
=== "MySQL"
    ```mysql
    select 
        version as version, 
        tsq_duration_text(0, 0, 0, 0, -(datediff(date(published_at), date(deployed_at)) * cast(86400000000000 as decimal(65)) + ((floor(time_to_sec(published_at)) * 1000000 + microsecond(published_at)) * 1000 - (floor(time_to_sec(deployed_at)) * 1000000 + microsecond(deployed_at)) * 1000)), 'hour') as afterPublishing, 
        date_add(date(deployed_at), interval ((floor(time_to_sec(deployed_at)) * 1000000 + microsecond(deployed_at)) * 1000 div 3600000000000 * 3600000000000) div 1000 microsecond) as hour, 
        date_add(date_add(date(deployed_at), interval (((floor(time_to_sec(deployed_at)) * 1000000 + microsecond(deployed_at)) * 1000 + 3599999999999) div 3600000000000 * 3600000000000) div 1000 microsecond), interval ? microsecond) as reviewBy 
    from project_release 
    where deployed_at is not null 
    order by version
    ```
=== "Oracle"
    ```oracle
    select 
        version as "version", 
        tsq_duration_text(0, 0, 0, 0, -((trunc(sys_extract_utc(cast(published_at as timestamp(9) with time zone))) - trunc(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone)))) * 86400000000000 + ((extract(hour from (cast(sys_extract_utc(cast(published_at as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(published_at as timestamp(9) with time zone))))) * 3600 + extract(minute from (cast(sys_extract_utc(cast(published_at as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(published_at as timestamp(9) with time zone))))) * 60 + extract(second from (cast(sys_extract_utc(cast(published_at as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(published_at as timestamp(9) with time zone)))))) * 1000000000 - (extract(hour from (cast(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone))))) * 3600 + extract(minute from (cast(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone))))) * 60 + extract(second from (cast(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone)))))) * 1000000000)), 'hour') as "afterPublishing", 
        to_char(sys_extract_utc(cast(from_tz(cast(trunc(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone))) as timestamp(9)) + numtodsinterval((trunc((extract(hour from (cast(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone))))) * 3600 + extract(minute from (cast(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone))))) * 60 + extract(second from (cast(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone)))))) * 1000000000 / 3600000000000) * 3600000000000) / 1000000000, 'second'), '+00:00') as timestamp(9) with time zone)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "hour", 
        to_char(sys_extract_utc(cast(from_tz(sys_extract_utc(cast(from_tz(cast(trunc(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone))) as timestamp(9)) + numtodsinterval((trunc(((extract(hour from (cast(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone))))) * 3600 + extract(minute from (cast(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone))))) * 60 + extract(second from (cast(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone)) as timestamp(9)) - trunc(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone)))))) * 1000000000 + 3599999999999) / 3600000000000) * 3600000000000) / 1000000000, 'second'), '+00:00') as timestamp(9) with time zone)) + numtodsinterval(:0, 'second'), '+00:00') as timestamp(9) with time zone)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "reviewBy" 
    from project_release 
    where deployed_at is not null 
    order by "version"
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        version as version, 
        make_interval(hours => cast(div(-((cast(published_at as date) - cast(deployed_at as date)) * 86400000000000::numeric + ((round(extract(epoch from cast(published_at as time)) * 1000000)::bigint * 1000) - (round(extract(epoch from cast(deployed_at as time)) * 1000000)::bigint * 1000))), 3600000000000) as integer), secs => -((cast(published_at as date) - cast(deployed_at as date)) * 86400000000000::numeric + ((round(extract(epoch from cast(published_at as time)) * 1000000)::bigint * 1000) - (round(extract(epoch from cast(deployed_at as time)) * 1000000)::bigint * 1000))) % 3600000000000 / 1000000000.0) as "afterPublishing", 
        cast(deployed_at as date) + make_interval(secs => (((round(extract(epoch from cast(deployed_at as time)) * 1000000)::bigint * 1000) / 3600000000000) * 3600000000000) / 1000000000.0) as hour, 
        cast(deployed_at as date) + make_interval(secs => ((((round(extract(epoch from cast(deployed_at as time)) * 1000000)::bigint * 1000) + 3599999999999) / 3600000000000) * 3600000000000) / 1000000000.0) + $1::interval as "reviewBy" 
    from project_release 
    where deployed_at is not null 
    order by version
    ```
=== "SQLite"
    ```sqlite
    select 
        version as version, 
        tsq_duration_text(0, 0, 0, 0, cast(-(cast(julianday(date(published_at)) - julianday(date(deployed_at)) as integer) * 86400000000000 + (cast(round((julianday(published_at) - julianday(date(published_at))) * 86400000) as integer) * 1000000 - cast(round((julianday(deployed_at) - julianday(date(deployed_at))) * 86400000) as integer) * 1000000)) as text), 'hour') as afterPublishing, 
        strftime('%Y-%m-%dT%H:%M:%fZ', date(deployed_at), ((cast(cast(round((julianday(deployed_at) - julianday(date(deployed_at))) * 86400000) as integer) * 1000000 / 3600000000000 as integer) * 3600000000000) / 1000000000.0) || ' seconds') as hour, 
        strftime('%Y-%m-%dT%H:%M:%fZ', strftime('%Y-%m-%dT%H:%M:%fZ', date(deployed_at), ((cast((cast(round((julianday(deployed_at) - julianday(date(deployed_at))) * 86400000) as integer) * 1000000 + 3599999999999) / 3600000000000 as integer) * 3600000000000) / 1000000000.0) || ' seconds'), ?1) as reviewBy 
    from project_release 
    where deployed_at is not null 
    order by version
    ```
=== "SQL Server"
    ```sqlserver
    select 
        version as version, 
        dbo.tsq_duration_text(0, 0, 0, 0, -(datediff(day, cast(cast(switchoffset(deployed_at, '+00:00') as datetime2) as date), cast(cast(switchoffset(published_at, '+00:00') as datetime2) as date)) * cast(86400000000000 as decimal(38)) + ((cast(datediff(second, cast('00:00' as time), cast(cast(switchoffset(published_at, '+00:00') as datetime2) as time)) as bigint) * 1000000000 + datepart(nanosecond, cast(switchoffset(published_at, '+00:00') as datetime2))) - (cast(datediff(second, cast('00:00' as time), cast(cast(switchoffset(deployed_at, '+00:00') as datetime2) as time)) as bigint) * 1000000000 + datepart(nanosecond, cast(switchoffset(deployed_at, '+00:00') as datetime2))))), 'hour') as afterPublishing, 
        dateadd(nanosecond, ((cast(datediff(second, cast('00:00' as time), cast(cast(switchoffset(deployed_at, '+00:00') as datetime2) as time)) as bigint) * 1000000000 + datepart(nanosecond, cast(switchoffset(deployed_at, '+00:00') as datetime2))) / cast(3600000000000 as bigint) * cast(3600000000000 as bigint)) % 1000000000, dateadd(second, ((cast(datediff(second, cast('00:00' as time), cast(cast(switchoffset(deployed_at, '+00:00') as datetime2) as time)) as bigint) * 1000000000 + datepart(nanosecond, cast(switchoffset(deployed_at, '+00:00') as datetime2))) / cast(3600000000000 as bigint) * cast(3600000000000 as bigint)) / 1000000000, cast(cast(cast(switchoffset(deployed_at, '+00:00') as datetime2) as date) as datetime2))) as hour, 
        dateadd(day, @0, cast(switchoffset(dateadd(nanosecond, (((cast(datediff(second, cast('00:00' as time), cast(cast(switchoffset(deployed_at, '+00:00') as datetime2) as time)) as bigint) * 1000000000 + datepart(nanosecond, cast(switchoffset(deployed_at, '+00:00') as datetime2))) + cast(3599999999999 as bigint)) / cast(3600000000000 as bigint) * cast(3600000000000 as bigint)) % 1000000000, dateadd(second, (((cast(datediff(second, cast('00:00' as time), cast(cast(switchoffset(deployed_at, '+00:00') as datetime2) as time)) as bigint) * 1000000000 + datepart(nanosecond, cast(switchoffset(deployed_at, '+00:00') as datetime2))) + cast(3599999999999 as bigint)) / cast(3600000000000 as bigint) * cast(3600000000000 as bigint)) / 1000000000, cast(cast(cast(switchoffset(deployed_at, '+00:00') as datetime2) as date) as datetime2))), '+00:00') as datetime2)) as reviewBy 
    from project_release 
    where deployed_at is not null 
    order by version
    ```

The parameters are: `[ Duration PT172800S ]` (on MariaDB and MySQL: `[ 172800000000n ]`; on Oracle: `[ 172800n ]`; on SQLite: `[ '172800 seconds' ]`; on SQL Server: `[ 2 ]`)

| version | afterPublishing | hour | reviewBy |
|---|---|---|---|
| `'0.9.0'` | `PT5M` | `2024-03-02T11:00:00Z` | `2024-03-04T12:00:00Z` |
| `'1.2.0'` | `PT30M15.123456S` (on SQLite: `PT30M15.123S`) | `2024-01-16T09:00:00Z` | `2024-01-18T10:00:00Z` |

The arithmetic is computed on the wall clock of the instant in UTC, where there is no summer time, also with a [database outside UTC](time-zones.md#a-database-outside-utc).

`currentInstant()` of the connection gives the instant of now in the database, with the digits of the fraction of a second it gives:

<!-- doc-code-snippet-result: "2024-05-06 10:11:12.345678+00" -->
```ts
const now = await connection.selectFromNoTable()
    .selectOneColumn(connection.currentInstant())
    .executeSelectOne()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select utc_timestamp(6) as result
    ```
=== "MySQL"
    ```mysql
    select utc_timestamp(6) as result
    ```
=== "Oracle"
    ```oracle
    select to_char(sys_extract_utc(cast(systimestamp as timestamp(9) with time zone)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "result" 
    from dual
    ```
===+ "PostgreSQL"
    ```postgresql
    select current_timestamp as result
    ```
=== "SQLite"
    ```sqlite
    select strftime('%Y-%m-%dT%H:%M:%fZ', 'now') as result
    ```
=== "SQL Server"
    ```sqlserver
    select sysutcdatetime() as result
    ```

The parameters are: `[]`

## Zoned dates and times

A `zonedDateTime` is an exact moment seen in a time zone: a `Temporal.ZonedDateTime`, an instant with its zone, an IANA name like `Europe/Madrid` or an offset like `+05:30`. The zone gives it its date and time there, and its rules: when a wall clock is repeated or skipped by a change to summer time. Use it where the zone is part of the value, like the start of a meeting that must stay at 09:00 in Madrid. An `instant` is the same moment without a zone, and a `plainDateTime` a wall clock without one.

Oracle and PostgreSQL compute with the rules of the zones. Oracle also keeps a zone with each value, in a `TIMESTAMP WITH TIME ZONE`, so a column can be a `zonedDateTime`. PostgreSQL keeps an instant without its zone (a `timestamptz`), so there a zoned date and time is computed in the query: the instant of a column in the zone the query gives it, from a column or a value (keep the instant in a `timestamptz` and the zone in a `text`). On MariaDB, MySQL, SQLite and SQL Server a query with a `zonedDateTime` fails when it is built, with `UNSUPPORTED_QUERY`, and nothing is sent.

An instant goes to a zone with `toZonedDateTimeISO(zone)`, and a wall clock with `toZonedDateTime(zone)`, as in Temporal. A wall clock that the zone repeats (02:30 on 2024-10-27 in Madrid) or skips (02:30 on 2024-03-31) takes the instant `disambiguation` says, as Temporal: `'compatible'`, the default, the earlier of a repeated one and the later of a skipped one (03:30), `'earlier'` and `'later'` what they say, and `'reject'` makes the query fail. On PostgreSQL that takes a function of the library; without it, a wall clock the zone repeats is the later instant (see [A wall clock the zone repeats, on PostgreSQL](#a-wall-clock-the-zone-repeats-on-postgresql)). Here, the deployments and the publications of the releases in Madrid:

```ts
const releases = await connection.selectFrom(tRelease)
    .select({
        version: tRelease.version,
        deployedInMadrid: tRelease.deployedAt.toZonedDateTimeISO('Europe/Madrid'),
        publishedInMadrid: tRelease.publishedAt.toZonedDateTime('Europe/Madrid'),
        publishedInstant: tRelease.publishedAt.toZonedDateTime('Europe/Madrid').toInstant(),
    })
    .orderBy('version')
    .executeSelectMany()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    -- Not available on MariaDB
    ```
=== "MySQL"
    ```mysql
    -- Not available on MySQL
    ```
=== "Oracle"
    ```oracle
    select 
        version as "version", 
        nullif(to_char(sys_extract_utc(from_tz(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone)), '+00:00') at time zone 'Europe/Madrid'), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') || '[' || to_char(from_tz(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone)), '+00:00') at time zone 'Europe/Madrid', 'TZR') || ']', '[]') as "deployedInMadrid", 
        nullif(to_char(sys_extract_utc(from_tz(case when not (cast((from_tz((cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) - interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(published_at as timestamp(9))) and cast((from_tz((cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) + interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(published_at as timestamp(9)) then (cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) + interval '1' day))) else (cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) - interval '1' day))) end, '+00:00') at time zone 'Europe/Madrid'), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') || '[' || to_char(from_tz(case when not (cast((from_tz((cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) - interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(published_at as timestamp(9))) and cast((from_tz((cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) + interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(published_at as timestamp(9)) then (cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) + interval '1' day))) else (cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) - interval '1' day))) end, '+00:00') at time zone 'Europe/Madrid', 'TZR') || ']', '[]') as "publishedInMadrid", 
        to_char(sys_extract_utc(cast((from_tz(case when not (cast((from_tz((cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) - interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(published_at as timestamp(9))) and cast((from_tz((cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) + interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(published_at as timestamp(9)) then (cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) + interval '1' day))) else (cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) - interval '1' day))) end, '+00:00') at time zone 'Europe/Madrid') as timestamp(9) with time zone)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') as "publishedInstant" 
    from project_release 
    order by "version"
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        version as version, 
        to_char((deployed_at::timestamptz) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z" BC') || '[Europe/Madrid]' as "deployedInMadrid", 
        to_char(((published_at at time zone 'Europe/Madrid')) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z" BC') || '[Europe/Madrid]' as "publishedInMadrid", 
        ((published_at at time zone 'Europe/Madrid')) as "publishedInstant" 
    from project_release 
    order by version
    ```
=== "SQLite"
    ```sqlite
    -- Not available on SQLite
    ```
=== "SQL Server"
    ```sqlserver
    -- Not available on SQL Server
    ```

The parameters are: `[]`

| version | deployedInMadrid | publishedInMadrid | publishedInstant |
|---|---|---|---|
| `'0.9.0'` | `2024-03-02T12:05:00+01:00[Europe/Madrid]` | `2024-03-02T11:00:00+01:00[Europe/Madrid]` | `2024-03-02T10:00:00Z` |
| `'1.2.0'` | `2024-01-16T10:30:15.123456+01:00[Europe/Madrid]` | `2024-01-16T09:00:00+01:00[Europe/Madrid]` | `2024-01-16T08:00:00Z` |
| `'1.3.0-beta.1'` | `undefined` | `2024-02-21T10:00:00+01:00[Europe/Madrid]` | `2024-02-21T09:00:00Z` |

A zone given as a value is checked as Temporal checks it before the query is sent, and written in the SQL as its name (Oracle takes no parameter after `at time zone`; PostgreSQL gets an offset like `+05:30` as an interval, as it reads such a text as a POSIX zone, west of UTC). A string of the query, like a column with the zone of each user, is taken as it is, and the database rejects a zone it doesn't know (`ORA-01882`, *time zone "…" not recognized*); on PostgreSQL `timeZoneId()` gives it as written, where Temporal writes a name in its own case.

On PostgreSQL the query knows the zone of a zoned date and time from what computes it: `toZonedDateTimeISO`, `toZonedDateTime`, `withTimeZone`, a value, and the arithmetic below, which keeps the zone it starts from. A zoned date and time of another expression, like `valueWhenNull` of two of them, a `case`, an aggregate or a column of a subquery, may have a zone in each row the query doesn't know: its instant and its comparisons work, but reading it, its parts or its arithmetic fail when the query is built (`UNSUPPORTED_QUERY`), and so does a column of the type `zonedDateTime` and one inside an aggregated array. Its value has the digits of a `timestamptz`, up to the microsecond, also with Bun SQL.

A `zonedDateTime` has the methods of Temporal that give its parts and its instant:

| Method | What it gives |
|---|---|
| `toInstant()` | its instant, an `instant` |
| `toPlainDateTime()`, `toPlainDate()`, `toPlainTime()` | its date and time, its date, its time of the day in its zone |
| `year()`, `month()`, `day()`, `dayOfWeek()`, `dayOfYear()`, `hour()`, `minute()`, `second()`, `millisecond()`, `microsecond()` | its parts in its zone, as a `plainDateTime`'s |
| `timeZoneId()` | the name of its zone, as Temporal writes it (`'Europe/Madrid'`, `'+05:30'`) |
| `offset()`, `offsetNanoseconds()` | its offset from UTC at its instant, as text (`'+01:00'`) and in nanoseconds |
| `epochMilliseconds()`, `epochNanoseconds()` | the milliseconds and nanoseconds of its instant since `1970-01-01T00:00:00Z` |
| `withTimeZone(zone)` | the same instant in another zone |

Two zoned dates and times are compared and ordered by their instant, as Temporal's `ZonedDateTime.compare`: `equals` finds the same instant in another zone too, where Temporal's `equals` also compares the zone.

### The arithmetic of a zoned date and time

A zoned date and time adds, subtracts, changes its fields, rounds and counts the time to another one as Temporal does, with the rules of its zone. Its years, months, weeks and days count on the calendar of its zone: a day later is the same time of the day on the next day, even when the zone changes its offset in between and that day has 23 or 25 hours. Its hours and smaller units count on its instant: 24 hours later is exactly 24 hours later. Here, the follow-up of each release, four weeks and a day after its publication in Madrid; Madrid goes to summer time on 2024-03-31, the day of the follow-up of 0.9.0:

```ts
const published = tRelease.publishedAt.toZonedDateTime('Europe/Madrid')
const followUp = published.add({ weeks: 4, days: 1 })
const followUps = await connection.selectFrom(tRelease)
    .select({
        version: tRelease.version,
        followUp: followUp,
        daysToFollowUp: published.until(followUp, { largestUnit: 'day' }),
        hoursToFollowUp: published.until(followUp),
        hoursInThatDay: followUp.hoursInDay(),
    })
    .orderBy('version')
    .executeSelectMany()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    -- Not available on MariaDB
    ```
=== "MySQL"
    ```mysql
    -- Not available on MySQL
    ```
=== "Oracle"
    ```oracle
    select 
        version as "version", 
        nullif(to_char(sys_extract_utc((select from_tz(case when not (cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:0, 'day')) - (cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:0, 'day')) - interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:0, 'day')) - interval '1' day))), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) = (cast(tsq_z.x as timestamp(9)) + numtodsinterval(:0, 'day'))) and cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:0, 'day')) - (cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:0, 'day')) + interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:0, 'day')) + interval '1' day))), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) = (cast(tsq_z.x as timestamp(9)) + numtodsinterval(:0, 'day')) then ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:0, 'day')) - (cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:0, 'day')) + interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:0, 'day')) + interval '1' day))) else ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:0, 'day')) - (cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:0, 'day')) - interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:0, 'day')) - interval '1' day))) end, '+00:00') at time zone to_char(tsq_z.x, 'TZR') from (select from_tz(case when not (cast((from_tz((cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) - interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(published_at as timestamp(9))) and cast((from_tz((cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) + interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(published_at as timestamp(9)) then (cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) + interval '1' day))) else (cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) - interval '1' day))) end, '+00:00') at time zone 'Europe/Madrid' as x from dual where rownum = 1) tsq_z)), 'YYYY-MM-DD"T"HH24:MI:SS.FF9"Z" BC', 'NLS_DATE_LANGUAGE=AMERICAN') || '[' || to_char((select from_tz(case when not (cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:0, 'day')) - (cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:0, 'day')) - interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:0, 'day')) - interval '1' day))), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) = (cast(tsq_z.x as timestamp(9)) + numtodsinterval(:0, 'day'))) and cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:0, 'day')) - (cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:0, 'day')) + interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:0, 'day')) + interval '1' day))), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) = (cast(tsq_z.x as timestamp(9)) + numtodsinterval(:0, 'day')) then ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:0, 'day')) - (cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:0, 'day')) + interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:0, 'day')) + interval '1' day))) else ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:0, 'day')) - (cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:0, 'day')) - interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:0, 'day')) - interval '1' day))) end, '+00:00') at time zone to_char(tsq_z.x, 'TZR') from (select from_tz(case when not (cast((from_tz((cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) - interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(published_at as timestamp(9))) and cast((from_tz((cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) + interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(published_at as timestamp(9)) then (cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) + interval '1' day))) else (cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) - interval '1' day))) end, '+00:00') at time zone 'Europe/Madrid' as x from dual where rownum = 1) tsq_z), 'TZR') || ']', '[]') as "followUp", 
        tsq_zoned_until(from_tz(case when not (cast((from_tz((cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) - interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(published_at as timestamp(9))) and cast((from_tz((cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) + interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(published_at as timestamp(9)) then (cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) + interval '1' day))) else (cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) - interval '1' day))) end, '+00:00') at time zone 'Europe/Madrid', (select from_tz(case when not (cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:1, 'day')) - (cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:1, 'day')) - interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:1, 'day')) - interval '1' day))), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) = (cast(tsq_z.x as timestamp(9)) + numtodsinterval(:1, 'day'))) and cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:1, 'day')) - (cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:1, 'day')) + interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:1, 'day')) + interval '1' day))), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) = (cast(tsq_z.x as timestamp(9)) + numtodsinterval(:1, 'day')) then ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:1, 'day')) - (cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:1, 'day')) + interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:1, 'day')) + interval '1' day))) else ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:1, 'day')) - (cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:1, 'day')) - interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:1, 'day')) - interval '1' day))) end, '+00:00') at time zone to_char(tsq_z.x, 'TZR') from (select from_tz(case when not (cast((from_tz((cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) - interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(published_at as timestamp(9))) and cast((from_tz((cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) + interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(published_at as timestamp(9)) then (cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) + interval '1' day))) else (cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) - interval '1' day))) end, '+00:00') at time zone 'Europe/Madrid' as x from dual where rownum = 1) tsq_z), 'day', 'nanosecond', 1, 'trunc', 1) as "daysToFollowUp", 
        tsq_duration_text(0, 0, 0, 0, ((trunc(sys_extract_utc((select from_tz(case when not (cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:2, 'day')) - (cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:2, 'day')) - interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:2, 'day')) - interval '1' day))), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) = (cast(tsq_z.x as timestamp(9)) + numtodsinterval(:2, 'day'))) and cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:2, 'day')) - (cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:2, 'day')) + interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:2, 'day')) + interval '1' day))), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) = (cast(tsq_z.x as timestamp(9)) + numtodsinterval(:2, 'day')) then ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:2, 'day')) - (cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:2, 'day')) + interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:2, 'day')) + interval '1' day))) else ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:2, 'day')) - (cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:2, 'day')) - interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:2, 'day')) - interval '1' day))) end, '+00:00') at time zone to_char(tsq_z.x, 'TZR') from (select from_tz(case when not (cast((from_tz((cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) - interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(published_at as timestamp(9))) and cast((from_tz((cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) + interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(published_at as timestamp(9)) then (cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) + interval '1' day))) else (cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) - interval '1' day))) end, '+00:00') at time zone 'Europe/Madrid' as x from dual where rownum = 1) tsq_z))) - trunc(sys_extract_utc(from_tz(case when not (cast((from_tz((cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) - interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(published_at as timestamp(9))) and cast((from_tz((cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) + interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(published_at as timestamp(9)) then (cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) + interval '1' day))) else (cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) - interval '1' day))) end, '+00:00') at time zone 'Europe/Madrid'))) * 86400000000000 + ((extract(hour from (cast(sys_extract_utc((select from_tz(case when not (cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) - (cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) - interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) - interval '1' day))), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) = (cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day'))) and cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) - (cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) + interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) + interval '1' day))), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) = (cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) then ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) - (cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) + interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) + interval '1' day))) else ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) - (cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) - interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) - interval '1' day))) end, '+00:00') at time zone to_char(tsq_z.x, 'TZR') from (select from_tz(case when not (cast((from_tz((cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) - interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(published_at as timestamp(9))) and cast((from_tz((cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) + interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(published_at as timestamp(9)) then (cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) + interval '1' day))) else (cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) - interval '1' day))) end, '+00:00') at time zone 'Europe/Madrid' as x from dual where rownum = 1) tsq_z)) as timestamp(9)) - trunc(sys_extract_utc((select from_tz(case when not (cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) - (cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) - interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) - interval '1' day))), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) = (cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day'))) and cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) - (cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) + interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) + interval '1' day))), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) = (cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) then ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) - (cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) + interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) + interval '1' day))) else ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) - (cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) - interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) - interval '1' day))) end, '+00:00') at time zone to_char(tsq_z.x, 'TZR') from (select from_tz(case when not (cast((from_tz((cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) - interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(published_at as timestamp(9))) and cast((from_tz((cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) + interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(published_at as timestamp(9)) then (cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) + interval '1' day))) else (cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) - interval '1' day))) end, '+00:00') at time zone 'Europe/Madrid' as x from dual where rownum = 1) tsq_z))))) * 3600 + extract(minute from (cast(sys_extract_utc((select from_tz(case when not (cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) - (cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) - interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) - interval '1' day))), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) = (cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day'))) and cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) - (cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) + interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) + interval '1' day))), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) = (cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) then ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) - (cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) + interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) + interval '1' day))) else ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) - (cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) - interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) - interval '1' day))) end, '+00:00') at time zone to_char(tsq_z.x, 'TZR') from (select from_tz(case when not (cast((from_tz((cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) - interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(published_at as timestamp(9))) and cast((from_tz((cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) + interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(published_at as timestamp(9)) then (cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) + interval '1' day))) else (cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) - interval '1' day))) end, '+00:00') at time zone 'Europe/Madrid' as x from dual where rownum = 1) tsq_z)) as timestamp(9)) - trunc(sys_extract_utc((select from_tz(case when not (cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) - (cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) - interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) - interval '1' day))), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) = (cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day'))) and cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) - (cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) + interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) + interval '1' day))), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) = (cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) then ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) - (cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) + interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) + interval '1' day))) else ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) - (cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) - interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) - interval '1' day))) end, '+00:00') at time zone to_char(tsq_z.x, 'TZR') from (select from_tz(case when not (cast((from_tz((cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) - interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(published_at as timestamp(9))) and cast((from_tz((cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) + interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(published_at as timestamp(9)) then (cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) + interval '1' day))) else (cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) - interval '1' day))) end, '+00:00') at time zone 'Europe/Madrid' as x from dual where rownum = 1) tsq_z))))) * 60 + extract(second from (cast(sys_extract_utc((select from_tz(case when not (cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) - (cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) - interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) - interval '1' day))), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) = (cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day'))) and cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) - (cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) + interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) + interval '1' day))), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) = (cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) then ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) - (cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) + interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) + interval '1' day))) else ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) - (cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) - interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) - interval '1' day))) end, '+00:00') at time zone to_char(tsq_z.x, 'TZR') from (select from_tz(case when not (cast((from_tz((cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) - interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(published_at as timestamp(9))) and cast((from_tz((cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) + interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(published_at as timestamp(9)) then (cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) + interval '1' day))) else (cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) - interval '1' day))) end, '+00:00') at time zone 'Europe/Madrid' as x from dual where rownum = 1) tsq_z)) as timestamp(9)) - trunc(sys_extract_utc((select from_tz(case when not (cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) - (cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) - interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) - interval '1' day))), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) = (cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day'))) and cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) - (cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) + interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) + interval '1' day))), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) = (cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) then ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) - (cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) + interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) + interval '1' day))) else ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) - (cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) - interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:3, 'day')) - interval '1' day))) end, '+00:00') at time zone to_char(tsq_z.x, 'TZR') from (select from_tz(case when not (cast((from_tz((cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) - interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(published_at as timestamp(9))) and cast((from_tz((cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) + interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(published_at as timestamp(9)) then (cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) + interval '1' day))) else (cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) - interval '1' day))) end, '+00:00') at time zone 'Europe/Madrid' as x from dual where rownum = 1) tsq_z)))))) * 1000000000 - (extract(hour from (cast(sys_extract_utc(from_tz(case when not (cast((from_tz((cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) - interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(published_at as timestamp(9))) and cast((from_tz((cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) + interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(published_at as timestamp(9)) then (cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) + interval '1' day))) else (cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) - interval '1' day))) end, '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - trunc(sys_extract_utc(from_tz(case when not (cast((from_tz((cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) - interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(published_at as timestamp(9))) and cast((from_tz((cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) + interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(published_at as timestamp(9)) then (cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) + interval '1' day))) else (cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) - interval '1' day))) end, '+00:00') at time zone 'Europe/Madrid')))) * 3600 + extract(minute from (cast(sys_extract_utc(from_tz(case when not (cast((from_tz((cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) - interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(published_at as timestamp(9))) and cast((from_tz((cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) + interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(published_at as timestamp(9)) then (cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) + interval '1' day))) else (cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) - interval '1' day))) end, '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - trunc(sys_extract_utc(from_tz(case when not (cast((from_tz((cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) - interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(published_at as timestamp(9))) and cast((from_tz((cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) + interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(published_at as timestamp(9)) then (cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) + interval '1' day))) else (cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) - interval '1' day))) end, '+00:00') at time zone 'Europe/Madrid')))) * 60 + extract(second from (cast(sys_extract_utc(from_tz(case when not (cast((from_tz((cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) - interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(published_at as timestamp(9))) and cast((from_tz((cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) + interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(published_at as timestamp(9)) then (cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) + interval '1' day))) else (cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) - interval '1' day))) end, '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - trunc(sys_extract_utc(from_tz(case when not (cast((from_tz((cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) - interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(published_at as timestamp(9))) and cast((from_tz((cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) + interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(published_at as timestamp(9)) then (cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) + interval '1' day))) else (cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) - interval '1' day))) end, '+00:00') at time zone 'Europe/Madrid'))))) * 1000000000)), 'hour') as "hoursToFollowUp", 
        (select (extract(day from (case when not (cast((from_tz((cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9)) - (cast((from_tz((cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9)) - interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - (cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9)) - interval '1' day))), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) = cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9))) and cast((from_tz((cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9)) - (cast((from_tz((cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9)) + interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - (cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9)) + interval '1' day))), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) = cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9)) then (cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9)) - (cast((from_tz((cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9)) + interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - (cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9)) + interval '1' day))) else (cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9)) - (cast((from_tz((cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9)) - interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - (cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9)) - interval '1' day))) end - case when not (cast((from_tz((cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) - (cast((from_tz((cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) - interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - (cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) - interval '1' day))), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) = cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9))) and cast((from_tz((cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) - (cast((from_tz((cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) + interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - (cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) + interval '1' day))), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) = cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) then (cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) - (cast((from_tz((cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) + interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - (cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) + interval '1' day))) else (cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) - (cast((from_tz((cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) - interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - (cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) - interval '1' day))) end)) * 24 + extract(hour from (case when not (cast((from_tz((cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9)) - (cast((from_tz((cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9)) - interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - (cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9)) - interval '1' day))), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) = cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9))) and cast((from_tz((cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9)) - (cast((from_tz((cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9)) + interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - (cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9)) + interval '1' day))), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) = cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9)) then (cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9)) - (cast((from_tz((cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9)) + interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - (cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9)) + interval '1' day))) else (cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9)) - (cast((from_tz((cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9)) - interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - (cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9)) - interval '1' day))) end - case when not (cast((from_tz((cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) - (cast((from_tz((cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) - interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - (cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) - interval '1' day))), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) = cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9))) and cast((from_tz((cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) - (cast((from_tz((cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) + interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - (cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) + interval '1' day))), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) = cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) then (cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) - (cast((from_tz((cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) + interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - (cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) + interval '1' day))) else (cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) - (cast((from_tz((cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) - interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - (cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) - interval '1' day))) end)) + extract(minute from (case when not (cast((from_tz((cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9)) - (cast((from_tz((cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9)) - interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - (cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9)) - interval '1' day))), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) = cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9))) and cast((from_tz((cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9)) - (cast((from_tz((cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9)) + interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - (cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9)) + interval '1' day))), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) = cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9)) then (cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9)) - (cast((from_tz((cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9)) + interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - (cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9)) + interval '1' day))) else (cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9)) - (cast((from_tz((cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9)) - interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - (cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9)) - interval '1' day))) end - case when not (cast((from_tz((cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) - (cast((from_tz((cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) - interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - (cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) - interval '1' day))), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) = cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9))) and cast((from_tz((cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) - (cast((from_tz((cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) + interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - (cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) + interval '1' day))), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) = cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) then (cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) - (cast((from_tz((cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) + interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - (cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) + interval '1' day))) else (cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) - (cast((from_tz((cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) - interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - (cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) - interval '1' day))) end)) / 60 + extract(second from (case when not (cast((from_tz((cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9)) - (cast((from_tz((cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9)) - interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - (cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9)) - interval '1' day))), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) = cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9))) and cast((from_tz((cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9)) - (cast((from_tz((cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9)) + interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - (cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9)) + interval '1' day))), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) = cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9)) then (cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9)) - (cast((from_tz((cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9)) + interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - (cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9)) + interval '1' day))) else (cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9)) - (cast((from_tz((cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9)) - interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - (cast(trunc(cast(tsq_z.x as timestamp(9))) + 1 as timestamp(9)) - interval '1' day))) end - case when not (cast((from_tz((cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) - (cast((from_tz((cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) - interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - (cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) - interval '1' day))), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) = cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9))) and cast((from_tz((cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) - (cast((from_tz((cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) + interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - (cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) + interval '1' day))), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) = cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) then (cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) - (cast((from_tz((cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) + interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - (cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) + interval '1' day))) else (cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) - (cast((from_tz((cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) - interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - (cast(trunc(cast(tsq_z.x as timestamp(9))) as timestamp(9)) - interval '1' day))) end)) / 3600) from (select (select from_tz(case when not (cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:4, 'day')) - (cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:4, 'day')) - interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:4, 'day')) - interval '1' day))), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) = (cast(tsq_z.x as timestamp(9)) + numtodsinterval(:4, 'day'))) and cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:4, 'day')) - (cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:4, 'day')) + interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:4, 'day')) + interval '1' day))), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) = (cast(tsq_z.x as timestamp(9)) + numtodsinterval(:4, 'day')) then ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:4, 'day')) - (cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:4, 'day')) + interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:4, 'day')) + interval '1' day))) else ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:4, 'day')) - (cast((from_tz(((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:4, 'day')) - interval '1' day), '+00:00') at time zone to_char(tsq_z.x, 'TZR')) as timestamp(9)) - ((cast(tsq_z.x as timestamp(9)) + numtodsinterval(:4, 'day')) - interval '1' day))) end, '+00:00') at time zone to_char(tsq_z.x, 'TZR') from (select from_tz(case when not (cast((from_tz((cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) - interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(published_at as timestamp(9))) and cast((from_tz((cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) + interval '1' day))), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) = cast(published_at as timestamp(9)) then (cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) + interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) + interval '1' day))) else (cast(published_at as timestamp(9)) - (cast((from_tz((cast(published_at as timestamp(9)) - interval '1' day), '+00:00') at time zone 'Europe/Madrid') as timestamp(9)) - (cast(published_at as timestamp(9)) - interval '1' day))) end, '+00:00') at time zone 'Europe/Madrid' as x from dual where rownum = 1) tsq_z) as x from dual where rownum = 1) tsq_z) as "hoursInThatDay" 
    from project_release 
    order by "version"
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        version as version, 
        to_char(((((((published_at at time zone 'Europe/Madrid')) at time zone 'Europe/Madrid') + make_interval(days => $1)) at time zone 'Europe/Madrid')) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z" BC') || '[Europe/Madrid]' as "followUp", 
        tsq_zoned_until(((published_at at time zone 'Europe/Madrid')), 'Europe/Madrid', ((((((published_at at time zone 'Europe/Madrid')) at time zone 'Europe/Madrid') + make_interval(days => $2)) at time zone 'Europe/Madrid')), 'Europe/Madrid', 'day', 'nanosecond', 1, 'trunc', 1) as "daysToFollowUp", 
        make_interval(hours => cast(div(((cast((((((((published_at at time zone 'Europe/Madrid')) at time zone 'Europe/Madrid') + make_interval(days => $3)) at time zone 'Europe/Madrid')) at time zone 'UTC') as date) - cast((((published_at at time zone 'Europe/Madrid')) at time zone 'UTC') as date)) * 86400000000000::numeric + ((round(extract(epoch from cast((((((((published_at at time zone 'Europe/Madrid')) at time zone 'Europe/Madrid') + make_interval(days => $4)) at time zone 'Europe/Madrid')) at time zone 'UTC') as time)) * 1000000)::bigint * 1000) - (round(extract(epoch from cast((((published_at at time zone 'Europe/Madrid')) at time zone 'UTC') as time)) * 1000000)::bigint * 1000))), 3600000000000) as integer), secs => ((cast((((((((published_at at time zone 'Europe/Madrid')) at time zone 'Europe/Madrid') + make_interval(days => $5)) at time zone 'Europe/Madrid')) at time zone 'UTC') as date) - cast((((published_at at time zone 'Europe/Madrid')) at time zone 'UTC') as date)) * 86400000000000::numeric + ((round(extract(epoch from cast((((((((published_at at time zone 'Europe/Madrid')) at time zone 'Europe/Madrid') + make_interval(days => $6)) at time zone 'Europe/Madrid')) at time zone 'UTC') as time)) * 1000000)::bigint * 1000) - (round(extract(epoch from cast((((published_at at time zone 'Europe/Madrid')) at time zone 'UTC') as time)) * 1000000)::bigint * 1000))) % 3600000000000 / 1000000000.0) as "hoursToFollowUp", 
        (select (extract(epoch from ((date_trunc('day', (tsq_z.x at time zone 'Europe/Madrid')) + interval '1 day') at time zone 'Europe/Madrid') - ((date_trunc('day', (tsq_z.x at time zone 'Europe/Madrid'))) at time zone 'Europe/Madrid')) / 3600)::float8 from (select (((((published_at at time zone 'Europe/Madrid')) at time zone 'Europe/Madrid') + make_interval(days => $7)) at time zone 'Europe/Madrid') as x offset 0) tsq_z) as "hoursInThatDay" 
    from project_release 
    order by version
    ```
=== "SQLite"
    ```sqlite
    -- Not available on SQLite
    ```
=== "SQL Server"
    ```sqlserver
    -- Not available on SQL Server
    ```

The parameters are: `[
  29, 29, 29, 29,
  29, 29, 29
]` (on Oracle: `[ 29, 29, 29, 29, 29 ]`)

| version | followUp | daysToFollowUp | hoursToFollowUp | hoursInThatDay |
|---|---|---|---|---|
| `'0.9.0'` | `2024-03-31T11:00:00+02:00[Europe/Madrid]` | `P29D` | `PT695H` | `23` |
| `'1.2.0'` | `2024-02-14T09:00:00+01:00[Europe/Madrid]` | `P29D` | `PT696H` | `24` |
| `'1.3.0-beta.1'` | `2024-03-21T10:00:00+01:00[Europe/Madrid]` | `P29D` | `PT696H` | `24` |

The follow-up of 0.9.0 is at 11:00 in Madrid, like its publication, 29 days later, but 695 hours later, as one of those days has 23 hours.

| Method | What it does |
|---|---|
| `add(duration, { overflow })`, `subtract(duration, { overflow })` | Its years, months, weeks and days are added to its date and time in its zone, and that wall clock is taken back to the zone as `'compatible'` disambiguates it (moved forward when the zone skips it, the earlier one when it repeats it); then its hours and smaller units are added to that instant. The day is kept in the month (January 31 plus a month is February 29), or with `{ overflow: 'reject' }` the query fails when the month hasn't it. The duration is a `Temporal.Duration`, its fields (`{ days: 1, hours: 2 }`) or a `duration` of the query |
| `with(fields, { overflow, disambiguation, offset })` | The fields of its date and time in its zone given in place of its own, as `with` of a `plainDateTime`, and that wall clock taken back to its zone. It keeps its offset when the zone still has it for that wall clock (`offset: 'prefer'`, the default), so a value in the hour the zone repeats stays in the same one; the field `offset` (`{ hour: 2, offset: '+01:00' }`) gives another one. `offset: 'use'` takes the offset as it is, `'ignore'` disambiguates the wall clock as `disambiguation` says, and `'reject'` makes the query fail when the zone hasn't the offset |
| `withPlainTime(time)` | At the time of the day given (a `Temporal.PlainTime` or a `plainTime` of the query) on its date in its zone; without one, at the start of its day |
| `startOfDay()` | The start of its day in its zone: its midnight, or the first instant of the day when the zone skips midnight |
| `hoursInDay()` | The hours of its day in its zone, a `double`: 23 or 25 where the zone changes its offset that day |
| `round(unit)`, `round({ smallestUnit, roundingIncrement, roundingMode })` | To a day, the start of its day or of the next one, the nearer one by the length of the day in its zone; to a unit of the time, its date and time in its zone rounded, as a `plainDateTime`'s, and taken back to its zone keeping its offset when it can. `'halfExpand'` by default |
| `until(other, options)`, `since(other, options)` | The duration to (or from) another zoned date and time. In hours by default, the difference of their instants, with the units and the rounding of an instant. With a `largestUnit` of days or larger (or a `smallestUnit` of days), the days of the calendar in their zone, each one with its length there, with every option of Temporal: both must be in the same zone, or the query fails, as Temporal rejects it. This difference is computed by the function `tsq_zoned_until` of the library |

Every wall clock these methods take back to the zone that the zone repeats is, on PostgreSQL without the functions of the library, the later instant (see the next section).

Temporal's `getTimeZoneTransition` has no equivalent: neither database gives a way to find the changes of offset of a zone. A zoned date and time is always in the ISO calendar.

On Oracle a `duration` of the query kept in an `INTERVAL DAY TO SECOND` has 24 hours as a day (`PT28H` is kept as `P1DT4H`, and read so): added to a zoned date and time, that day is a day of the calendar, as for the value read. PostgreSQL's interval keeps its days and its time apart, as Temporal.

### A wall clock the zone repeats, on PostgreSQL

PostgreSQL takes a wall clock to its zone (`timestamp at time zone`) moving one the zone skips forward, as Temporal, and taking the later instant of one it repeats, where Temporal's `'compatible'` takes the earlier one. That is what a query gives by default: `toZonedDateTime(zone)` and `toZonedDateTime(zone, { disambiguation: 'later' })` of 02:30 on 2024-10-27 in Madrid are `2024-10-27T02:30:00+01:00[Europe/Madrid]` (01:30 in UTC), `add({ days: 1 })` of `2024-10-26T02:30:00+02:00[Europe/Madrid]` gives that same instant, and `startOfDay()` of a day whose midnight the zone repeats (2012-11-04 in Havana) is the second midnight. `disambiguation: 'earlier'` and `'reject'` fail when the query is built, with `UNSUPPORTED_QUERY`, and nothing is sent. Every other day and hour is Temporal's.

With the function of the library `tsq_zoned_of_wall` in the database (its code is in [PostgreSQL functions](supported-databases/postgresql/functions.md#tsq_zoned_of_wall)), set `temporalFunctions` to `'installed'` on the connection, and every disambiguation is Temporal's: the same three are `2024-10-27T02:30:00+02:00[Europe/Madrid]` (00:30 in UTC) and Havana's first midnight, at the cost of a call to the function in each wall clock taken to its zone. Its default is `'not installed'`.

```ts
import { PostgreSqlConnection } from 'ts-sql-query/postgresql'

class DBConnection extends PostgreSqlConnection<'DBConnection'> {
    protected override temporalFunctions = 'installed' as const
}
```

Oracle gives every disambiguation as Temporal without functions.

### The functions `tsq_zoned_until` and `tsq_zoned_of_wall`

`until` and `since` of two zoned dates and times in days or larger units count the days of the calendar in their zone, with the length of each one there, and round as Temporal rounds, which needs variables: it is done by `tsq_zoned_until`, a function of the library (on PostgreSQL with `tsq_zoned_of_wall`, which it uses, and which takes a wall clock to its zone as Temporal, the one `temporalFunctions` uses). Create it once in the database, on Oracle after [`tsq_duration_text`](#the-functions-tsq_duration_text-and-tsq_duration_round), which it uses; without it, the query fails with the error of the database for a function that doesn't exist. Two zoned dates and times in different zones make it fail (`ORA-20001` on Oracle).

Their code for each database (MariaDB, MySQL, SQLite and SQL Server have no zoned dates and times):

| Database | The code |
|---|---|
| MariaDB | — |
| MySQL | — |
| Oracle | [`tsq_zoned_until`](supported-databases/oracle/functions.md#tsq_zoned_until) |
| PostgreSQL | [`tsq_zoned_of_wall`](supported-databases/postgresql/functions.md#tsq_zoned_of_wall) and [`tsq_zoned_until`](supported-databases/postgresql/functions.md#tsq_zoned_until) |
| SQLite | — |
| SQL Server | — |

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

### The fields of a duration

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
        case when substr(rollout_time, 1, 1) = '-' then substr(rollout_time, 2) when tsq_duration_part(rollout_time, 'sign') = 0 then rollout_time when substr(rollout_time, 1, 1) = '+' then concat('-', substr(rollout_time, 2)) else concat('-', rollout_time) end as back 
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
        case when substr(rollout_time, 1, 1) = '-' then substr(rollout_time, 2) when tsq_duration_part(rollout_time, 'sign') = 0 then rollout_time when substr(rollout_time, 1, 1) = '+' then concat('-', substr(rollout_time, 2)) else concat('-', rollout_time) end as back 
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
        case when substr(rollout_time, 1, 1) = '-' then substr(rollout_time, 2) when tsq_duration_part(rollout_time, 'sign') = 0 then rollout_time when substr(rollout_time, 1, 1) = '+' then '-' || substr(rollout_time, 2) else '-' || rollout_time end as back 
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
        case when substring(rollout_time, 1, 1) = '-' then substring(rollout_time, 2, 100) when dbo.tsq_duration_part(rollout_time, 'sign') = 0 then rollout_time when substring(rollout_time, 1, 1) = '+' then '-' + substring(rollout_time, 2, 100) else '-' + rollout_time end as back 
    from project_release 
    order by version
    ```

The parameters are: `[]`

| version | days | hours | minutes | sign | back |
|---|---|---|---|---|---|
| `'0.9.0'` | `2` | `0` | `0` | `1` | `-P2D` |
| `'1.2.0'` | `1` | `12` | `0` | `1` | `-P1DT12H` |
| `'1.3.0-beta.1'` | `0` | `0` | `45` | `1` | `-PT45M` |

The fields are the ones of the duration as the database keeps it, as Temporal reads it: a duration kept as text has the fields written (`PT90M` has 90 minutes and no hours, as `Temporal.Duration.from('PT90M')`); an interval of PostgreSQL has its months (as years and months), its days and its time in hours, minutes and seconds, and no weeks; an interval of Oracle has days to seconds, or years and months. A duration kept as text reads them with the function `tsq_duration_part` (see [below](#a-duration-kept-as-text-the-function-tsq_duration_part)).

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

### Rejecting a day the month hasn't

As in Temporal, `add`, `subtract` and `with` take the option `overflow` as their last argument. `'constrain'`, the default, takes a day the month hasn't to its last day, as above; `'reject'` rejects it: `add({ months: 1 }, { overflow: 'reject' })` of January 31st, or `with({ month: 2 }, { overflow: 'reject' })` of a day 30, make the query fail with an error of the database, as Temporal throws a `RangeError`. A day that is in the month gives the same value with both. With `with`, a field given out of its range (`{ month: 13 }`, `{ hour: 25 }`), or a day the year and the month given haven't, is rejected with `INVALID_VALUE_TO_SEND_TO_DATABASE` before the query is sent.

MariaDB, MySQL and SQLite have no date that fails: there the error is the one of a subquery that returns two rows (MariaDB and MySQL) or of an integer overflow (SQLite), written to fail only for a day the month hasn't.

### A duration kept as text: the function `tsq_duration_part`

On MariaDB, MySQL, SQLite and SQL Server, and in a column of PostgreSQL or Oracle that keeps a duration as text, a duration is its ISO 8601 text. To add one that the database holds, like `tRelease.rolloutTime`, to a date or to another duration, or to read its fields, its sign or its total, or to negate it, the query reads its parts with `tsq_duration_part`, a function of the library: create it once in the database. A duration given as a value doesn't need it to be added, and neither does reading, writing or comparing a duration. Without the function, the query fails with the error of the database for a function that doesn't exist.

Its code for each database:

| Database | The code |
|---|---|
| MariaDB | [`tsq_duration_part`](supported-databases/mariadb/functions.md#tsq_duration_part) |
| MySQL | [`tsq_duration_part`](supported-databases/mysql/functions.md#tsq_duration_part) |
| Oracle | [`tsq_duration_part`](supported-databases/oracle/functions.md#tsq_duration_part) |
| PostgreSQL | [`tsq_duration_part`](supported-databases/postgresql/functions.md#tsq_duration_part) |
| SQLite | registered by `registerSqliteFunctions`: see [SQLite functions and extensions](supported-databases/sqlite/functions.md#the-functions-of-durations) |
| SQL Server | [`tsq_duration_part`](supported-databases/sqlserver/functions.md#tsq_duration_part) |

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
        tsq_duration_text(0, 0, 0, datediff(date(published_at), released_on), 0, 'hour') as toPublication, 
        tsq_duration_text(0, 0, 0, 0, -(datediff(date(timestamp(released_on)), date(published_at)) * cast(86400000000000 as decimal(65)) + ((floor(time_to_sec(timestamp(released_on))) * 1000000 + microsecond(timestamp(released_on))) * 1000 - (floor(time_to_sec(published_at)) * 1000000 + microsecond(published_at)) * 1000)), 'hour') as publishedAfter, 
        tsq_duration_text(0, ((cast(year(?) as signed) * 12 + cast(month(?) as signed)) * 32 + cast(dayofmonth(?) as signed) - (cast(year(released_on) as signed) * 12 + cast(month(released_on) as signed)) * 32 - cast(dayofmonth(released_on) as signed)) div 32, 0, datediff(?, date_add(released_on, interval ((cast(year(?) as signed) * 12 + cast(month(?) as signed)) * 32 + cast(dayofmonth(?) as signed) - (cast(year(released_on) as signed) * 12 + cast(month(released_on) as signed)) * 32 - cast(dayofmonth(released_on) as signed)) div 32 month)), 0, 'hour') as untilEndOfJune 
    from project_release 
    order by version
    ```
=== "MySQL"
    ```mysql
    select 
        version as version, 
        tsq_duration_text(0, 0, 0, datediff(date(published_at), released_on), 0, 'hour') as toPublication, 
        tsq_duration_text(0, 0, 0, 0, -(datediff(date(timestamp(released_on)), date(published_at)) * cast(86400000000000 as decimal(65)) + ((floor(time_to_sec(timestamp(released_on))) * 1000000 + microsecond(timestamp(released_on))) * 1000 - (floor(time_to_sec(published_at)) * 1000000 + microsecond(published_at)) * 1000)), 'hour') as publishedAfter, 
        tsq_duration_text(0, ((cast(year(?) as signed) * 12 + cast(month(?) as signed)) * 32 + cast(dayofmonth(?) as signed) - (cast(year(released_on) as signed) * 12 + cast(month(released_on) as signed)) * 32 - cast(dayofmonth(released_on) as signed)) div 32, 0, datediff(?, date_add(released_on, interval ((cast(year(?) as signed) * 12 + cast(month(?) as signed)) * 32 + cast(dayofmonth(?) as signed) - (cast(year(released_on) as signed) * 12 + cast(month(released_on) as signed)) * 32 - cast(dayofmonth(released_on) as signed)) div 32 month)), 0, 'hour') as untilEndOfJune 
    from project_release 
    order by version
    ```
=== "Oracle"
    ```oracle
    select 
        version as "version", 
        tsq_duration_text(0, 0, 0, (trunc(published_at) - released_on), 0, 'hour') as "toPublication", 
        tsq_duration_text(0, 0, 0, 0, -((trunc(cast(released_on as timestamp(9))) - trunc(published_at)) * 86400000000000 + ((extract(hour from (cast(cast(released_on as timestamp(9)) as timestamp(9)) - trunc(cast(released_on as timestamp(9))))) * 3600 + extract(minute from (cast(cast(released_on as timestamp(9)) as timestamp(9)) - trunc(cast(released_on as timestamp(9))))) * 60 + extract(second from (cast(cast(released_on as timestamp(9)) as timestamp(9)) - trunc(cast(released_on as timestamp(9)))))) * 1000000000 - (extract(hour from (cast(published_at as timestamp(9)) - trunc(published_at))) * 3600 + extract(minute from (cast(published_at as timestamp(9)) - trunc(published_at))) * 60 + extract(second from (cast(published_at as timestamp(9)) - trunc(published_at)))) * 1000000000)), 'hour') as "publishedAfter", 
        tsq_duration_text(0, trunc(((extract(year from to_date(:0, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) * 12 + extract(month from to_date(:0, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'))) * 32 + extract(day from to_date(:0, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) - (extract(year from released_on) * 12 + extract(month from released_on)) * 32 - extract(day from released_on)) / 32), 0, (to_date(:0, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN') - (add_months(released_on, trunc(((extract(year from to_date(:0, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) * 12 + extract(month from to_date(:0, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'))) * 32 + extract(day from to_date(:0, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) - (extract(year from released_on) * 12 + extract(month from released_on)) * 32 - extract(day from released_on)) / 32)) - greatest(0, extract(day from add_months(released_on, trunc(((extract(year from to_date(:0, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) * 12 + extract(month from to_date(:0, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'))) * 32 + extract(day from to_date(:0, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) - (extract(year from released_on) * 12 + extract(month from released_on)) * 32 - extract(day from released_on)) / 32))) - extract(day from released_on)))), 0, 'hour') as "untilEndOfJune" 
    from project_release 
    order by "version"
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        version as version, 
        make_interval(days => (cast(published_at as date) - released_on)) as "toPublication", 
        make_interval(hours => cast(div(-((cast(cast(released_on as timestamp) as date) - cast(published_at as date)) * 86400000000000::numeric + ((round(extract(epoch from cast(cast(released_on as timestamp) as time)) * 1000000)::bigint * 1000) - (round(extract(epoch from cast(published_at as time)) * 1000000)::bigint * 1000))), 3600000000000) as integer), secs => -((cast(cast(released_on as timestamp) as date) - cast(published_at as date)) * 86400000000000::numeric + ((round(extract(epoch from cast(cast(released_on as timestamp) as time)) * 1000000)::bigint * 1000) - (round(extract(epoch from cast(published_at as time)) * 1000000)::bigint * 1000))) % 3600000000000 / 1000000000.0) as "publishedAfter", 
        make_interval(months => (((cast(extract(year from $1::date) as integer) * 12 + cast(extract(month from $1::date) as integer)) * 32 + cast(extract(day from $1::date) as integer) - (cast(extract(year from released_on) as integer) * 12 + cast(extract(month from released_on) as integer)) * 32 - cast(extract(day from released_on) as integer)) / 32), days => ($1::date - cast(released_on + make_interval(months => (((cast(extract(year from $1::date) as integer) * 12 + cast(extract(month from $1::date) as integer)) * 32 + cast(extract(day from $1::date) as integer) - (cast(extract(year from released_on) as integer) * 12 + cast(extract(month from released_on) as integer)) * 32 - cast(extract(day from released_on) as integer)) / 32)) as date))) as "untilEndOfJune" 
    from project_release 
    order by version
    ```
=== "SQLite"
    ```sqlite
    select 
        version as version, 
        tsq_duration_text(0, 0, 0, cast(julianday(date(date(published_at))) - julianday(date(released_on)) as integer), 0, 'hour') as toPublication, 
        tsq_duration_text(0, 0, 0, 0, cast(-(cast(julianday(date(strftime('%Y-%m-%dT%H:%M:%fZ', released_on))) - julianday(date(published_at)) as integer) * 86400000000000 + (cast(round((julianday(strftime('%Y-%m-%dT%H:%M:%fZ', released_on)) - julianday(date(strftime('%Y-%m-%dT%H:%M:%fZ', released_on)))) * 86400000) as integer) * 1000000 - cast(round((julianday(published_at) - julianday(date(published_at))) * 86400000) as integer) * 1000000)) as text), 'hour') as publishedAfter, 
        tsq_duration_text(0, cast(((cast(strftime('%Y', ?1) as integer) * 12 + cast(strftime('%m', ?1) as integer)) * 32 + cast(strftime('%d', ?1) as integer) - (cast(strftime('%Y', released_on) as integer) * 12 + cast(strftime('%m', released_on) as integer)) * 32 - cast(strftime('%d', released_on) as integer)) / 32 as integer), 0, cast(julianday(date(?1)) - julianday(date(date(date(released_on), 'start of month', (cast(((cast(strftime('%Y', ?1) as integer) * 12 + cast(strftime('%m', ?1) as integer)) * 32 + cast(strftime('%d', ?1) as integer) - (cast(strftime('%Y', released_on) as integer) * 12 + cast(strftime('%m', released_on) as integer)) * 32 - cast(strftime('%d', released_on) as integer)) / 32 as integer)) || ' months'), (min(cast(strftime('%d', date(released_on)) as integer), cast(strftime('%d', date(date(released_on), 'start of month', (cast(((cast(strftime('%Y', ?1) as integer) * 12 + cast(strftime('%m', ?1) as integer)) * 32 + cast(strftime('%d', ?1) as integer) - (cast(strftime('%Y', released_on) as integer) * 12 + cast(strftime('%m', released_on) as integer)) * 32 - cast(strftime('%d', released_on) as integer)) / 32 as integer)) || ' months'), '+1 months', '-1 days') as integer)) - 1) || ' days')) as integer), 0, 'hour') as untilEndOfJune 
    from project_release 
    order by version
    ```
=== "SQL Server"
    ```sqlserver
    select 
        version as version, 
        dbo.tsq_duration_text(0, 0, 0, datediff(day, released_on, cast(switchoffset(published_at, '+00:00') as date)), 0, 'hour') as toPublication, 
        dbo.tsq_duration_text(0, 0, 0, 0, -(datediff(day, cast(published_at as date), cast(cast(released_on as datetime2) as date)) * cast(86400000000000 as decimal(38)) + ((cast(datediff(second, cast('00:00' as time), cast(cast(released_on as datetime2) as time)) as bigint) * 1000000000 + datepart(nanosecond, cast(released_on as datetime2))) - (cast(datediff(second, cast('00:00' as time), cast(published_at as time)) as bigint) * 1000000000 + datepart(nanosecond, published_at)))), 'hour') as publishedAfter, 
        dbo.tsq_duration_text(0, ((datepart(year, @0) * 12 + datepart(month, @0)) * 32 + datepart(day, @0) - (datepart(year, released_on) * 12 + datepart(month, released_on)) * 32 - datepart(day, released_on)) / 32, 0, datediff(day, dateadd(month, ((datepart(year, @0) * 12 + datepart(month, @0)) * 32 + datepart(day, @0) - (datepart(year, released_on) * 12 + datepart(month, released_on)) * 32 - datepart(day, released_on)) / 32, released_on), @0), 0, 'hour') as untilEndOfJune 
    from project_release 
    order by version
    ```

The parameters are: `[ PlainDate 2024-06-30 ]` (on MariaDB and MySQL: `[ PlainDate 2024-06-30, PlainDate 2024-06-30, PlainDate 2024-06-30, PlainDate 2024-06-30, PlainDate 2024-06-30, PlainDate 2024-06-30, PlainDate 2024-06-30 ]`; on SQLite: `[ '2024-06-30' ]`)

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

On MariaDB, MySQL, Oracle, SQLite and SQL Server the query writes the text of the duration with `tsq_duration_text`, a function of the library. A rounding whose largest unit is a week, a month or a year (a `smallestUnit` or a `roundingIncrement` other than the defaults) is done by `tsq_duration_round`, on every database, PostgreSQL too: it counts the weeks, months and years from the first value and rounds them as Temporal does, which a query without variables would write many times over. Create them once in the database, as `tsq_duration_part`; without them, the query fails with the error of the database for a function that doesn't exist.

Their code for each database:

| Database | The code |
|---|---|
| MariaDB | [`tsq_duration_text`](supported-databases/mariadb/functions.md#tsq_duration_text) and [`tsq_duration_round`](supported-databases/mariadb/functions.md#tsq_duration_round) |
| MySQL | [`tsq_duration_text`](supported-databases/mysql/functions.md#tsq_duration_text) and [`tsq_duration_round`](supported-databases/mysql/functions.md#tsq_duration_round) |
| Oracle | [`tsq_duration_text`](supported-databases/oracle/functions.md#tsq_duration_text) and [`tsq_duration_round`](supported-databases/oracle/functions.md#tsq_duration_round) |
| PostgreSQL | [`tsq_duration_round`](supported-databases/postgresql/functions.md#tsq_duration_round) |
| SQLite | registered by `registerSqliteFunctions`: see [SQLite functions and extensions](supported-databases/sqlite/functions.md#the-functions-of-durations) |
| SQL Server | [`tsq_duration_text`](supported-databases/sqlserver/functions.md#tsq_duration_text) and [`tsq_duration_round`](supported-databases/sqlserver/functions.md#tsq_duration_round) |

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
        tsq_duration_total(tsq_duration_part(rollout_time, 'M'), tsq_duration_part(rollout_time, 'weeks'), tsq_duration_part(rollout_time, 'days'), tsq_duration_part(rollout_time, 'S'), tsq_duration_part(rollout_time, 'N'), 0, 0, 0, 'hour') as hours, 
        tsq_duration_total(tsq_duration_part(rollout_time, 'M'), tsq_duration_part(rollout_time, 'weeks'), tsq_duration_part(rollout_time, 'days'), tsq_duration_part(rollout_time, 'S'), tsq_duration_part(rollout_time, 'N'), cast(year(released_on) as signed), cast(month(released_on) as signed), cast(dayofmonth(released_on) as signed), 'month') as months, 
        tsq_duration_total(0, 0, -truncate((datediff(date(timestamp(released_on)), date(published_at)) * cast(86400000000000 as decimal(65)) + ((floor(time_to_sec(timestamp(released_on))) * 1000000 + microsecond(timestamp(released_on))) * 1000 - (floor(time_to_sec(published_at)) * 1000000 + microsecond(published_at)) * 1000)) / 86400000000000, 0), truncate(-((datediff(date(timestamp(released_on)), date(published_at)) * cast(86400000000000 as decimal(65)) + ((floor(time_to_sec(timestamp(released_on))) * 1000000 + microsecond(timestamp(released_on))) * 1000 - (floor(time_to_sec(published_at)) * 1000000 + microsecond(published_at)) * 1000)) % 86400000000000) / 1000000000, 0), -((datediff(date(timestamp(released_on)), date(published_at)) * cast(86400000000000 as decimal(65)) + ((floor(time_to_sec(timestamp(released_on))) * 1000000 + microsecond(timestamp(released_on))) * 1000 - (floor(time_to_sec(published_at)) * 1000000 + microsecond(published_at)) * 1000)) % 86400000000000) % 1000000000, 0, 0, 0, 'day') as daysToPublication 
    from project_release 
    order by version
    ```
=== "MySQL"
    ```mysql
    select 
        version as version, 
        tsq_duration_total(tsq_duration_part(rollout_time, 'M'), tsq_duration_part(rollout_time, 'weeks'), tsq_duration_part(rollout_time, 'days'), tsq_duration_part(rollout_time, 'S'), tsq_duration_part(rollout_time, 'N'), 0, 0, 0, 'hour') as hours, 
        tsq_duration_total(tsq_duration_part(rollout_time, 'M'), tsq_duration_part(rollout_time, 'weeks'), tsq_duration_part(rollout_time, 'days'), tsq_duration_part(rollout_time, 'S'), tsq_duration_part(rollout_time, 'N'), cast(year(released_on) as signed), cast(month(released_on) as signed), cast(dayofmonth(released_on) as signed), 'month') as months, 
        tsq_duration_total(0, 0, -truncate((datediff(date(timestamp(released_on)), date(published_at)) * cast(86400000000000 as decimal(65)) + ((floor(time_to_sec(timestamp(released_on))) * 1000000 + microsecond(timestamp(released_on))) * 1000 - (floor(time_to_sec(published_at)) * 1000000 + microsecond(published_at)) * 1000)) / 86400000000000, 0), truncate(-((datediff(date(timestamp(released_on)), date(published_at)) * cast(86400000000000 as decimal(65)) + ((floor(time_to_sec(timestamp(released_on))) * 1000000 + microsecond(timestamp(released_on))) * 1000 - (floor(time_to_sec(published_at)) * 1000000 + microsecond(published_at)) * 1000)) % 86400000000000) / 1000000000, 0), -((datediff(date(timestamp(released_on)), date(published_at)) * cast(86400000000000 as decimal(65)) + ((floor(time_to_sec(timestamp(released_on))) * 1000000 + microsecond(timestamp(released_on))) * 1000 - (floor(time_to_sec(published_at)) * 1000000 + microsecond(published_at)) * 1000)) % 86400000000000) % 1000000000, 0, 0, 0, 'day') as daysToPublication 
    from project_release 
    order by version
    ```
=== "Oracle"
    ```oracle
    select 
        version as "version", 
        tsq_duration_total(0, 0, extract(day from rollout_time), extract(hour from rollout_time) * 3600 + extract(minute from rollout_time) * 60 + trunc(extract(second from rollout_time)), mod(extract(second from rollout_time) * 1000000000, 1000000000), 0, 0, 0, 'hour') as "hours", 
        tsq_duration_total(0, 0, extract(day from rollout_time), extract(hour from rollout_time) * 3600 + extract(minute from rollout_time) * 60 + trunc(extract(second from rollout_time)), mod(extract(second from rollout_time) * 1000000000, 1000000000), extract(year from released_on), extract(month from released_on), extract(day from released_on), 'month') as "months", 
        tsq_duration_total(0, 0, -trunc(((trunc(cast(released_on as timestamp(9))) - trunc(published_at)) * 86400000000000 + ((extract(hour from (cast(cast(released_on as timestamp(9)) as timestamp(9)) - trunc(cast(released_on as timestamp(9))))) * 3600 + extract(minute from (cast(cast(released_on as timestamp(9)) as timestamp(9)) - trunc(cast(released_on as timestamp(9))))) * 60 + extract(second from (cast(cast(released_on as timestamp(9)) as timestamp(9)) - trunc(cast(released_on as timestamp(9)))))) * 1000000000 - (extract(hour from (cast(published_at as timestamp(9)) - trunc(published_at))) * 3600 + extract(minute from (cast(published_at as timestamp(9)) - trunc(published_at))) * 60 + extract(second from (cast(published_at as timestamp(9)) - trunc(published_at)))) * 1000000000)) / 86400000000000), trunc(-(mod(((trunc(cast(released_on as timestamp(9))) - trunc(published_at)) * 86400000000000 + ((extract(hour from (cast(cast(released_on as timestamp(9)) as timestamp(9)) - trunc(cast(released_on as timestamp(9))))) * 3600 + extract(minute from (cast(cast(released_on as timestamp(9)) as timestamp(9)) - trunc(cast(released_on as timestamp(9))))) * 60 + extract(second from (cast(cast(released_on as timestamp(9)) as timestamp(9)) - trunc(cast(released_on as timestamp(9)))))) * 1000000000 - (extract(hour from (cast(published_at as timestamp(9)) - trunc(published_at))) * 3600 + extract(minute from (cast(published_at as timestamp(9)) - trunc(published_at))) * 60 + extract(second from (cast(published_at as timestamp(9)) - trunc(published_at)))) * 1000000000)), 86400000000000)) / 1000000000), mod(-(mod(((trunc(cast(released_on as timestamp(9))) - trunc(published_at)) * 86400000000000 + ((extract(hour from (cast(cast(released_on as timestamp(9)) as timestamp(9)) - trunc(cast(released_on as timestamp(9))))) * 3600 + extract(minute from (cast(cast(released_on as timestamp(9)) as timestamp(9)) - trunc(cast(released_on as timestamp(9))))) * 60 + extract(second from (cast(cast(released_on as timestamp(9)) as timestamp(9)) - trunc(cast(released_on as timestamp(9)))))) * 1000000000 - (extract(hour from (cast(published_at as timestamp(9)) - trunc(published_at))) * 3600 + extract(minute from (cast(published_at as timestamp(9)) - trunc(published_at))) * 60 + extract(second from (cast(published_at as timestamp(9)) - trunc(published_at)))) * 1000000000)), 86400000000000)), 1000000000), 0, 0, 0, 'day') as "daysToPublication" 
    from project_release 
    order by "version"
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        version as version, 
        tsq_duration_total(cast(extract(year from rollout_time) * 12 + extract(month from rollout_time) as bigint), 0, cast(extract(day from rollout_time) as bigint), cast(extract(hour from rollout_time) * 3600 + extract(minute from rollout_time) * 60 + trunc(extract(second from rollout_time)) as bigint), cast(extract(microseconds from rollout_time) as bigint) % 1000000 * 1000, 0, 0, 0, 'hour') as hours, 
        tsq_duration_total(cast(extract(year from rollout_time) * 12 + extract(month from rollout_time) as bigint), 0, cast(extract(day from rollout_time) as bigint), cast(extract(hour from rollout_time) * 3600 + extract(minute from rollout_time) * 60 + trunc(extract(second from rollout_time)) as bigint), cast(extract(microseconds from rollout_time) as bigint) % 1000000 * 1000, cast(extract(year from released_on) as integer), cast(extract(month from released_on) as integer), cast(extract(day from released_on) as integer), 'month') as months, 
        tsq_duration_total(0, 0, -cast(div(((cast(cast(released_on as timestamp) as date) - cast(published_at as date)) * 86400000000000::numeric + ((round(extract(epoch from cast(cast(released_on as timestamp) as time)) * 1000000)::bigint * 1000) - (round(extract(epoch from cast(published_at as time)) * 1000000)::bigint * 1000))), 86400000000000) as integer), cast(div(-(((cast(cast(released_on as timestamp) as date) - cast(published_at as date)) * 86400000000000::numeric + ((round(extract(epoch from cast(cast(released_on as timestamp) as time)) * 1000000)::bigint * 1000) - (round(extract(epoch from cast(published_at as time)) * 1000000)::bigint * 1000))) % 86400000000000), 1000000000) as bigint), cast(-(((cast(cast(released_on as timestamp) as date) - cast(published_at as date)) * 86400000000000::numeric + ((round(extract(epoch from cast(cast(released_on as timestamp) as time)) * 1000000)::bigint * 1000) - (round(extract(epoch from cast(published_at as time)) * 1000000)::bigint * 1000))) % 86400000000000) % 1000000000 as bigint), 0, 0, 0, 'day') as "daysToPublication" 
    from project_release 
    order by version
    ```
=== "SQLite"
    ```sqlite
    select 
        version as version, 
        tsq_duration_total(tsq_duration_part(rollout_time, 'M'), tsq_duration_part(rollout_time, 'weeks'), tsq_duration_part(rollout_time, 'days'), tsq_duration_part(rollout_time, 'S'), tsq_duration_part(rollout_time, 'N'), 0, 0, 0, 'hour') as hours, 
        tsq_duration_total(tsq_duration_part(rollout_time, 'M'), tsq_duration_part(rollout_time, 'weeks'), tsq_duration_part(rollout_time, 'days'), tsq_duration_part(rollout_time, 'S'), tsq_duration_part(rollout_time, 'N'), cast(strftime('%Y', released_on) as integer), cast(strftime('%m', released_on) as integer), cast(strftime('%d', released_on) as integer), 'month') as months, 
        tsq_duration_total(0, 0, -cast((cast(julianday(date(strftime('%Y-%m-%dT%H:%M:%fZ', released_on))) - julianday(date(published_at)) as integer) * 86400000000000 + (cast(round((julianday(strftime('%Y-%m-%dT%H:%M:%fZ', released_on)) - julianday(date(strftime('%Y-%m-%dT%H:%M:%fZ', released_on)))) * 86400000) as integer) * 1000000 - cast(round((julianday(published_at) - julianday(date(published_at))) * 86400000) as integer) * 1000000)) / 86400000000000 as integer), 0, cast(-((cast(julianday(date(strftime('%Y-%m-%dT%H:%M:%fZ', released_on))) - julianday(date(published_at)) as integer) * 86400000000000 + (cast(round((julianday(strftime('%Y-%m-%dT%H:%M:%fZ', released_on)) - julianday(date(strftime('%Y-%m-%dT%H:%M:%fZ', released_on)))) * 86400000) as integer) * 1000000 - cast(round((julianday(published_at) - julianday(date(published_at))) * 86400000) as integer) * 1000000)) % 86400000000000) as text), 0, 0, 0, 'day') as daysToPublication 
    from project_release 
    order by version
    ```
=== "SQL Server"
    ```sqlserver
    select 
        version as version, 
        dbo.tsq_duration_total(dbo.tsq_duration_part(rollout_time, 'M'), dbo.tsq_duration_part(rollout_time, 'weeks'), dbo.tsq_duration_part(rollout_time, 'days'), dbo.tsq_duration_part(rollout_time, 'S'), dbo.tsq_duration_part(rollout_time, 'N'), 0, 0, 0, 'hour') as hours, 
        dbo.tsq_duration_total(dbo.tsq_duration_part(rollout_time, 'M'), dbo.tsq_duration_part(rollout_time, 'weeks'), dbo.tsq_duration_part(rollout_time, 'days'), dbo.tsq_duration_part(rollout_time, 'S'), dbo.tsq_duration_part(rollout_time, 'N'), datepart(year, released_on), datepart(month, released_on), datepart(day, released_on), 'month') as months, 
        dbo.tsq_duration_total(0, 0, -round((datediff(day, cast(published_at as date), cast(cast(released_on as datetime2) as date)) * cast(86400000000000 as decimal(38)) + ((cast(datediff(second, cast('00:00' as time), cast(cast(released_on as datetime2) as time)) as bigint) * 1000000000 + datepart(nanosecond, cast(released_on as datetime2))) - (cast(datediff(second, cast('00:00' as time), cast(published_at as time)) as bigint) * 1000000000 + datepart(nanosecond, published_at)))) / cast(86400000000000 as bigint), 0, 1), cast(round(-((datediff(day, cast(published_at as date), cast(cast(released_on as datetime2) as date)) * cast(86400000000000 as decimal(38)) + ((cast(datediff(second, cast('00:00' as time), cast(cast(released_on as datetime2) as time)) as bigint) * 1000000000 + datepart(nanosecond, cast(released_on as datetime2))) - (cast(datediff(second, cast('00:00' as time), cast(published_at as time)) as bigint) * 1000000000 + datepart(nanosecond, published_at)))) % cast(86400000000000 as bigint)) / 1000000000, 0, 1) as bigint), cast(-((datediff(day, cast(published_at as date), cast(cast(released_on as datetime2) as date)) * cast(86400000000000 as decimal(38)) + ((cast(datediff(second, cast('00:00' as time), cast(cast(released_on as datetime2) as time)) as bigint) * 1000000000 + datepart(nanosecond, cast(released_on as datetime2))) - (cast(datediff(second, cast('00:00' as time), cast(published_at as time)) as bigint) * 1000000000 + datepart(nanosecond, published_at)))) % cast(86400000000000 as bigint)) % 1000000000 as bigint), 0, 0, 0, 'day') as daysToPublication 
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

Without a date of reference, a duration with years, months or weeks fails the query, as Temporal's `total` throws: the type of the value doesn't tell which fields it has. The error is the one of the function below, which says it needs a date of reference (on SQL Server, an error converting that text to a number, because a function there can't raise one).

On Oracle, a date before 15 October 1582 is in the Julian calendar: a total counted across that day isn't the one of Temporal (see [Dates before 1582](supported-databases/oracle/index.md#dates-before-1582)).

### The function `tsq_duration_total`

`total` is computed by `tsq_duration_total`, a function of the library, on every database: it adds the duration to the date of reference and divides with integers, so the `double` is rounded once, as Temporal rounds it. It takes the months of the duration (its years too), its weeks, its days, the whole seconds of its time and the nanoseconds of the second, the year, the month and the day of the date of reference (`0, 0, 0` without one) and the unit. Create it once in the database, as `tsq_duration_part`; without it, the query fails with the error of the database for a function that doesn't exist.

Its code for each database:

| Database | The code |
|---|---|
| MariaDB | [`tsq_duration_total`](supported-databases/mariadb/functions.md#tsq_duration_total) |
| MySQL | [`tsq_duration_total`](supported-databases/mysql/functions.md#tsq_duration_total) |
| Oracle | [`tsq_duration_total`](supported-databases/oracle/functions.md#tsq_duration_total) |
| PostgreSQL | [`tsq_duration_total`](supported-databases/postgresql/functions.md#tsq_duration_total) |
| SQLite | registered by `registerSqliteFunctions`: see [SQLite functions and extensions](supported-databases/sqlite/functions.md#the-functions-of-durations) |
| SQL Server | [`tsq_duration_total`](supported-databases/sqlserver/functions.md#tsq_duration_total) |

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
        tsq_duration_add(tsq_duration_part(rollout_time, 'largest'), tsq_duration_part(rollout_time, 'days'), tsq_duration_part(rollout_time, 'S'), tsq_duration_part(rollout_time, 'N'), 4, 0, 43200, 0, 1) as withMargin, 
        tsq_duration_add(tsq_duration_part(rollout_time, 'largest'), tsq_duration_part(rollout_time, 'days'), tsq_duration_part(rollout_time, 'S'), tsq_duration_part(rollout_time, 'N'), 5, 0, 900, 0, -1) as shorter 
    from project_release 
    order by version
    ```
=== "MySQL"
    ```mysql
    select 
        version as version, 
        tsq_duration_add(tsq_duration_part(rollout_time, 'largest'), tsq_duration_part(rollout_time, 'days'), tsq_duration_part(rollout_time, 'S'), tsq_duration_part(rollout_time, 'N'), 4, 0, 43200, 0, 1) as withMargin, 
        tsq_duration_add(tsq_duration_part(rollout_time, 'largest'), tsq_duration_part(rollout_time, 'days'), tsq_duration_part(rollout_time, 'S'), tsq_duration_part(rollout_time, 'N'), 5, 0, 900, 0, -1) as shorter 
    from project_release 
    order by version
    ```
=== "Oracle"
    ```oracle
    select 
        version as "version", 
        tsq_duration_add(case when extract(day from rollout_time) <> 0 then 3 when extract(hour from rollout_time) <> 0 then 4 when extract(minute from rollout_time) <> 0 then 5 when trunc(extract(second from rollout_time)) <> 0 then 6 when mod(abs(extract(second from rollout_time)) * 1000000000, 1000000000) >= 1000000 then 7 when mod(abs(extract(second from rollout_time)) * 1000000000, 1000000000) >= 1000 then 8 when mod(abs(extract(second from rollout_time)) * 1000000000, 1000000000) <> 0 then 9 else 10 end, extract(day from rollout_time), extract(hour from rollout_time) * 3600 + extract(minute from rollout_time) * 60 + trunc(extract(second from rollout_time)), mod(extract(second from rollout_time) * 1000000000, 1000000000), 4, 0, 43200, 0, 1) as "withMargin", 
        tsq_duration_add(case when extract(day from rollout_time) <> 0 then 3 when extract(hour from rollout_time) <> 0 then 4 when extract(minute from rollout_time) <> 0 then 5 when trunc(extract(second from rollout_time)) <> 0 then 6 when mod(abs(extract(second from rollout_time)) * 1000000000, 1000000000) >= 1000000 then 7 when mod(abs(extract(second from rollout_time)) * 1000000000, 1000000000) >= 1000 then 8 when mod(abs(extract(second from rollout_time)) * 1000000000, 1000000000) <> 0 then 9 else 10 end, extract(day from rollout_time), extract(hour from rollout_time) * 3600 + extract(minute from rollout_time) * 60 + trunc(extract(second from rollout_time)), mod(extract(second from rollout_time) * 1000000000, 1000000000), 5, 0, 900, 0, -1) as "shorter" 
    from project_release 
    order by "version"
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        version as version, 
        tsq_duration_add(case when extract(year from rollout_time) <> 0 or extract(month from rollout_time) <> 0 then 1 when extract(day from rollout_time) <> 0 then 3 when extract(hour from rollout_time) <> 0 then 4 when extract(minute from rollout_time) <> 0 then 5 when trunc(extract(second from rollout_time)) <> 0 then 6 when abs(cast(extract(microseconds from rollout_time) as bigint) % 1000000) >= 1000 then 7 when abs(cast(extract(microseconds from rollout_time) as bigint) % 1000000) <> 0 then 8 else 10 end, cast(extract(day from rollout_time) as bigint), cast(extract(hour from rollout_time) * 3600 + extract(minute from rollout_time) * 60 + trunc(extract(second from rollout_time)) as bigint), cast(extract(microseconds from rollout_time) as bigint) % 1000000 * 1000, 4, 0, 43200, 0, 1) as "withMargin", 
        tsq_duration_add(case when extract(year from rollout_time) <> 0 or extract(month from rollout_time) <> 0 then 1 when extract(day from rollout_time) <> 0 then 3 when extract(hour from rollout_time) <> 0 then 4 when extract(minute from rollout_time) <> 0 then 5 when trunc(extract(second from rollout_time)) <> 0 then 6 when abs(cast(extract(microseconds from rollout_time) as bigint) % 1000000) >= 1000 then 7 when abs(cast(extract(microseconds from rollout_time) as bigint) % 1000000) <> 0 then 8 else 10 end, cast(extract(day from rollout_time) as bigint), cast(extract(hour from rollout_time) * 3600 + extract(minute from rollout_time) * 60 + trunc(extract(second from rollout_time)) as bigint), cast(extract(microseconds from rollout_time) as bigint) % 1000000 * 1000, 5, 0, 900, 0, -1) as shorter 
    from project_release 
    order by version
    ```
=== "SQLite"
    ```sqlite
    select 
        version as version, 
        tsq_duration_add(tsq_duration_part(rollout_time, 'largest'), tsq_duration_part(rollout_time, 'days'), tsq_duration_part(rollout_time, 'S'), tsq_duration_part(rollout_time, 'N'), 4, 0, 43200, 0, 1) as withMargin, 
        tsq_duration_add(tsq_duration_part(rollout_time, 'largest'), tsq_duration_part(rollout_time, 'days'), tsq_duration_part(rollout_time, 'S'), tsq_duration_part(rollout_time, 'N'), 5, 0, 900, 0, -1) as shorter 
    from project_release 
    order by version
    ```
=== "SQL Server"
    ```sqlserver
    select 
        version as version, 
        dbo.tsq_duration_add(dbo.tsq_duration_part(rollout_time, 'largest'), dbo.tsq_duration_part(rollout_time, 'days'), dbo.tsq_duration_part(rollout_time, 'S'), dbo.tsq_duration_part(rollout_time, 'N'), 4, 0, 43200, 0, 1) as withMargin, 
        dbo.tsq_duration_add(dbo.tsq_duration_part(rollout_time, 'largest'), dbo.tsq_duration_part(rollout_time, 'days'), dbo.tsq_duration_part(rollout_time, 'S'), dbo.tsq_duration_part(rollout_time, 'N'), 5, 0, 900, 0, -1) as shorter 
    from project_release 
    order by version
    ```

The parameters are: `[]`

| version | withMargin | shorter |
|---|---|---|
| `'0.9.0'` | `P2DT12H` | `P1DT23H45M` |
| `'1.2.0'` | `P2D` | `P1DT11H45M` |
| `'1.3.0-beta.1'` | `PT12H45M` | `PT30M` |

A month, a year and a week have no fixed length: a duration with years, months or weeks, given or of the database, fails the query, as Temporal's `add` throws. To add them, add each duration to a date (see [Adding and subtracting a duration](#adding-and-subtracting-a-duration)).

As with `until` and `since`, on PostgreSQL the sum is an interval, which keeps it as days and a time (`PT120M` is read as `PT2H`) with its microseconds; on the other databases, Oracle too, it is the ISO 8601 text Temporal writes.

### The function `tsq_duration_add`

The sum is computed by `tsq_duration_add`, a function of the library, on every database. It takes, of each duration, its largest field that isn't zero (`tsq_duration_part` gives it with `'largest'`), its days, the whole seconds of its time and the nanoseconds of the second, and the sign of the second one (1 to add it, -1 to subtract it). Create it once in the database, as `tsq_duration_part`; on MariaDB, MySQL, Oracle and SQL Server it writes the text with `tsq_duration_text` (see [The functions `tsq_duration_text` and `tsq_duration_round`](#the-functions-tsq_duration_text-and-tsq_duration_round)). Without it, the query fails with the error of the database for a function that doesn't exist.

Its code for each database:

| Database | The code |
|---|---|
| MariaDB | [`tsq_duration_add`](supported-databases/mariadb/functions.md#tsq_duration_add) |
| MySQL | [`tsq_duration_add`](supported-databases/mysql/functions.md#tsq_duration_add) |
| Oracle | [`tsq_duration_add`](supported-databases/oracle/functions.md#tsq_duration_add) |
| PostgreSQL | [`tsq_duration_add`](supported-databases/postgresql/functions.md#tsq_duration_add) |
| SQLite | registered by `registerSqliteFunctions`: see [SQLite functions and extensions](supported-databases/sqlite/functions.md#the-functions-of-durations) |
| SQL Server | [`tsq_duration_add`](supported-databases/sqlserver/functions.md#tsq_duration_add) |

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
        time '00:00' + make_interval(secs => (((2 * (round(extract(epoch from cutoff_time) * 1000000)::bigint * 1000) + 21600000000000) / 43200000000000) * 21600000000000) / 1000000000.0) as "cutoffSlot" 
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
| SQLite | What the [format of its dates](supported-databases/sqlite/index.md#working-with-date-and-time) says: milliseconds by default | `23:59:58.123` |
| SQL Server | Hundreds of nanoseconds in a `datetime2(7)`, rounded | `23:59:58.1234568` |

An Oracle `TIMESTAMP(9)`, or `TIMESTAMP(9) WITH TIME ZONE`, keeps the nanoseconds. A constant selected as it is comes back as it was sent, with all its digits, unless the database converts it: PostgreSQL and SQL Server round it to the digits of their type.

## Known limits

- **Bun SQL** gives a `timestamp` (PostgreSQL) or a `datetime` (MySQL and MariaDB) as a `Date`, and has no way to give its text: a `plainDateTime` or an `instant` read through it stops at the millisecond. A `date` and a `time` keep all their digits. The other drivers of these databases read every digit.
- **A year before 1.** In Temporal the year before 1 is 0 (1 BC), and the one before it -1. PostgreSQL and Oracle keep these dates, but `year()` gives the year as they number it, with no year 0: -1 for 1 BC and -44 for 44 BC, where the value read is `-000043-03-15`. SQL Server rejects a date before the year 1, and an instant before the year 1.
- **Bun SQL on MySQL 8** sends a text parameter that MySQL converts to a time wrongly (`'10:07:30'` is `00:00:00`): a `plainTime` given as a value and rounded is another time there. A column is read right, and so is every value with the other drivers and with MariaDB.
- **Oracle has no type for a time of the day**: a `plainTime` is kept in a `DATE` or a `TIMESTAMP` on 1970-01-01, as a `localTime` is.
- **A difference of more than 292 years on SQLite**, like `until` of two instants or of two dates and times, has more nanoseconds than its 64-bit integers: the query fails with the error of `tsq_duration_text` or `tsq_duration_total`. The other databases compute it with decimal numbers.
- **Grouping by the arithmetic of a zoned date and time that isn't a column, on Oracle**: a zoned date and time computed in the query (like `toZonedDateTimeISO(zone)` of an instant) or given as a value is computed once in a scalar subquery when an operation of its arithmetic uses it, and Oracle doesn't accept a subquery in the `group by` (*ORA-22818*). The arithmetic of a column has no subquery.
- **A zoned date and time before 1900 on Oracle**: Oracle keeps the offset of the local mean time of a zone (like `-00:14:44` in Madrid) without its seconds, so the date and time of an instant there, and the instant of a wall clock there, are some seconds off from Temporal's. A zoned date and time read keeps its instant.
- **An interval of PostgreSQL with fields of different signs**, like `-1 days +02:03:00` or `1 mon -1 days`, can't be a `Temporal.Duration`, whose fields have one sign: reading it is rejected with `INVALID_VALUE_RECEIVED_FROM_DATABASE`. The library never sends one.
- **A column with a zone**, like `timestamptz` on PostgreSQL: a `plainDateTime` reads the date and time it has in the zone of the database. On SQL Server, a `datetimeoffset` is read, and its parts given, in UTC.
