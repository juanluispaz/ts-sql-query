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
| `duration`       | `Temporal.Duration`      | A length of time, like 1 day and 12 hours | None                      |

```typescriptreact
releasedOn = this.column('released_on', 'plainDate')
cutoffTime = this.column('cutoff_time', 'plainTime')
publishedAt = this.column('published_at', 'plainDateTime')
rolloutTime = this.optionalColumn('rollout_time', 'duration')
deployedAt = this.optionalColumn('deployed_at', 'instant')
```

Their classes are `PlainDateType`, `PlainTimeType`, `PlainDateTimeType`, `InstantType` and `DurationType`, exported by `ts-sql-query`, and a type of yours can extend their families, `PlainDatesType`, `PlainTimesType`, `PlainDateTimesType`, `InstantsType` and `DurationsType`, as in [Data types of your own](../advanced/data-types/own-data-types.md#the-families).

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
| SQLite | none: it keeps an instant as it keeps a `localDateTime`, in the [format of its dates](supported-databases/sqlite.md#working-with-date-and-time) | |
| SQL Server | `datetimeoffset(7)` | `datetime2(7)` |

On SQLite a `localdate` format keeps the wall clock of the instant in the zone of the application. With [`sqliteRunsInApplicationTimeZone`](supported-databases/sqlite.md#the-date-functions-and-the-time-zone), the arithmetic of the instant takes it to UTC and back with the modifiers `'utc'` and `'localtime'`; without it, the zone of the application must be UTC.

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

=== "MariaDB"
    ```sql
    DROP FUNCTION IF EXISTS tsq_duration_part;
    DELIMITER //
    CREATE FUNCTION tsq_duration_part(d VARCHAR(100), part VARCHAR(10)) RETURNS BIGINT DETERMINISTIC NO SQL
    BEGIN
        DECLARE i INT DEFAULT 1;
        DECLARE n INT;
        DECLARE c CHAR(1);
        DECLARE num VARCHAR(40) DEFAULT '';
        DECLARE in_time BOOLEAN DEFAULT FALSE;
        DECLARE sgn INT DEFAULT 1;
        DECLARE r BIGINT DEFAULT 0;
        DECLARE nonzero BOOLEAN DEFAULT FALSE;
        DECLARE lg INT DEFAULT 10;
        DECLARE f BIGINT;
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
                IF REPLACE(REPLACE(num, '0', ''), '.', '') <> '' THEN
                    SET nonzero = TRUE;
                    SET f = CAST(RPAD(IF(LOCATE('.', num) > 0, SUBSTRING_INDEX(num, '.', -1), ''), 9, '0') AS SIGNED);
                    SET lg = LEAST(lg, CASE WHEN c = 'Y' THEN 0 WHEN c = 'M' AND NOT in_time THEN 1 WHEN c = 'W' THEN 2 WHEN c = 'D' THEN 3 WHEN c = 'H' THEN 4 WHEN c = 'M' THEN 5
                        WHEN CAST(SUBSTRING_INDEX(num, '.', 1) AS SIGNED) <> 0 THEN 6 WHEN f >= 1000000 THEN 7 WHEN f >= 1000 THEN 8 ELSE 9 END);
                END IF;
                IF part = 'M' AND NOT in_time AND c = 'Y' THEN SET r = r + 12 * CAST(num AS SIGNED);
                ELSEIF part = 'M' AND NOT in_time AND c = 'M' THEN SET r = r + CAST(num AS SIGNED);
                ELSEIF part = 'D' AND c = 'W' THEN SET r = r + 7 * CAST(num AS SIGNED);
                ELSEIF part = 'D' AND c = 'D' THEN SET r = r + CAST(num AS SIGNED);
                ELSEIF part = 'S' AND in_time AND c = 'H' THEN SET r = r + 3600 * CAST(num AS SIGNED);
                ELSEIF part = 'S' AND in_time AND c = 'M' THEN SET r = r + 60 * CAST(num AS SIGNED);
                ELSEIF part = 'S' AND c = 'S' THEN SET r = r + CAST(SUBSTRING_INDEX(num, '.', 1) AS SIGNED);
                ELSEIF part = 'N' AND c = 'S' AND LOCATE('.', num) > 0 THEN SET r = CAST(RPAD(SUBSTRING_INDEX(num, '.', -1), 9, '0') AS SIGNED);
                ELSEIF part = 'years' AND NOT in_time AND c = 'Y' OR part = 'months' AND NOT in_time AND c = 'M' OR part = 'weeks' AND c = 'W' OR part = 'days' AND c = 'D' OR part = 'hours' AND in_time AND c = 'H' OR part = 'minutes' AND in_time AND c = 'M' OR part = 'seconds' AND c = 'S' THEN SET r = CAST(SUBSTRING_INDEX(num, '.', 1) AS SIGNED);
                END IF;
                SET num = '';
            END IF;
            SET i = i + 1;
        END WHILE;
        IF part = 'sign' THEN RETURN IF(nonzero, sgn, 0); END IF;
        IF part = 'largest' THEN RETURN lg; END IF;
        RETURN sgn * r;
    END
    //
    DELIMITER ;
    ```
=== "MySQL"
    ```sql
    DROP FUNCTION IF EXISTS tsq_duration_part;
    DELIMITER //
    CREATE FUNCTION tsq_duration_part(d VARCHAR(100), part VARCHAR(10)) RETURNS BIGINT DETERMINISTIC NO SQL
    BEGIN
        DECLARE i INT DEFAULT 1;
        DECLARE n INT;
        DECLARE c CHAR(1);
        DECLARE num VARCHAR(40) DEFAULT '';
        DECLARE in_time BOOLEAN DEFAULT FALSE;
        DECLARE sgn INT DEFAULT 1;
        DECLARE r BIGINT DEFAULT 0;
        DECLARE nonzero BOOLEAN DEFAULT FALSE;
        DECLARE lg INT DEFAULT 10;
        DECLARE f BIGINT;
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
                IF REPLACE(REPLACE(num, '0', ''), '.', '') <> '' THEN
                    SET nonzero = TRUE;
                    SET f = CAST(RPAD(IF(LOCATE('.', num) > 0, SUBSTRING_INDEX(num, '.', -1), ''), 9, '0') AS SIGNED);
                    SET lg = LEAST(lg, CASE WHEN c = 'Y' THEN 0 WHEN c = 'M' AND NOT in_time THEN 1 WHEN c = 'W' THEN 2 WHEN c = 'D' THEN 3 WHEN c = 'H' THEN 4 WHEN c = 'M' THEN 5
                        WHEN CAST(SUBSTRING_INDEX(num, '.', 1) AS SIGNED) <> 0 THEN 6 WHEN f >= 1000000 THEN 7 WHEN f >= 1000 THEN 8 ELSE 9 END);
                END IF;
                IF part = 'M' AND NOT in_time AND c = 'Y' THEN SET r = r + 12 * CAST(num AS SIGNED);
                ELSEIF part = 'M' AND NOT in_time AND c = 'M' THEN SET r = r + CAST(num AS SIGNED);
                ELSEIF part = 'D' AND c = 'W' THEN SET r = r + 7 * CAST(num AS SIGNED);
                ELSEIF part = 'D' AND c = 'D' THEN SET r = r + CAST(num AS SIGNED);
                ELSEIF part = 'S' AND in_time AND c = 'H' THEN SET r = r + 3600 * CAST(num AS SIGNED);
                ELSEIF part = 'S' AND in_time AND c = 'M' THEN SET r = r + 60 * CAST(num AS SIGNED);
                ELSEIF part = 'S' AND c = 'S' THEN SET r = r + CAST(SUBSTRING_INDEX(num, '.', 1) AS SIGNED);
                ELSEIF part = 'N' AND c = 'S' AND LOCATE('.', num) > 0 THEN SET r = CAST(RPAD(SUBSTRING_INDEX(num, '.', -1), 9, '0') AS SIGNED);
                ELSEIF part = 'years' AND NOT in_time AND c = 'Y' OR part = 'months' AND NOT in_time AND c = 'M' OR part = 'weeks' AND c = 'W' OR part = 'days' AND c = 'D' OR part = 'hours' AND in_time AND c = 'H' OR part = 'minutes' AND in_time AND c = 'M' OR part = 'seconds' AND c = 'S' THEN SET r = CAST(SUBSTRING_INDEX(num, '.', 1) AS SIGNED);
                END IF;
                SET num = '';
            END IF;
            SET i = i + 1;
        END WHILE;
        IF part = 'sign' THEN RETURN IF(nonzero, sgn, 0); END IF;
        IF part = 'largest' THEN RETURN lg; END IF;
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
        nonzero BOOLEAN := FALSE;
        lg NUMBER := 10;
        f NUMBER;
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
                IF TRANSLATE(num, 'x0.', 'x') IS NOT NULL THEN
                    nonzero := TRUE;
                    f := TO_NUMBER(RPAD(CASE WHEN INSTR(num, '.') > 0 THEN SUBSTR(num, INSTR(num, '.') + 1) END || '0', 9, '0'));
                    lg := LEAST(lg, CASE WHEN c = 'Y' THEN 0 WHEN c = 'M' AND NOT in_time THEN 1 WHEN c = 'W' THEN 2 WHEN c = 'D' THEN 3 WHEN c = 'H' THEN 4 WHEN c = 'M' THEN 5
                        WHEN TO_NUMBER(CASE WHEN INSTR(num, '.') > 0 THEN SUBSTR(num, 1, INSTR(num, '.') - 1) ELSE num END) <> 0 THEN 6 WHEN f >= 1000000 THEN 7 WHEN f >= 1000 THEN 8 ELSE 9 END);
                END IF;
                IF part = 'M' AND NOT in_time AND c = 'Y' THEN r := r + 12 * TO_NUMBER(num);
                ELSIF part = 'M' AND NOT in_time AND c = 'M' THEN r := r + TO_NUMBER(num);
                ELSIF part = 'D' AND c = 'W' THEN r := r + 7 * TO_NUMBER(num);
                ELSIF part = 'D' AND c = 'D' THEN r := r + TO_NUMBER(num);
                ELSIF part = 'S' AND in_time AND c = 'H' THEN r := r + 3600 * TO_NUMBER(num);
                ELSIF part = 'S' AND in_time AND c = 'M' THEN r := r + 60 * TO_NUMBER(num);
                ELSIF part = 'S' AND c = 'S' THEN r := r + TO_NUMBER(CASE WHEN INSTR(num, '.') > 0 THEN SUBSTR(num, 1, INSTR(num, '.') - 1) ELSE num END);
                ELSIF part = 'N' AND c = 'S' AND INSTR(num, '.') > 0 THEN r := TO_NUMBER(RPAD(SUBSTR(num, INSTR(num, '.') + 1), 9, '0'));
                ELSIF part = 'years' AND NOT in_time AND c = 'Y' OR part = 'months' AND NOT in_time AND c = 'M' OR part = 'weeks' AND c = 'W' OR part = 'days' AND c = 'D' OR part = 'hours' AND in_time AND c = 'H' OR part = 'minutes' AND in_time AND c = 'M' OR part = 'seconds' AND c = 'S' THEN r := TO_NUMBER(CASE WHEN INSTR(num, '.') > 0 THEN SUBSTR(num, 1, INSTR(num, '.') - 1) ELSE num END);
                END IF;
                num := NULL;
            END IF;
            i := i + 1;
        END LOOP;
        IF part = 'sign' THEN RETURN CASE WHEN nonzero THEN sgn ELSE 0 END; END IF;
        IF part = 'largest' THEN RETURN lg; END IF;
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
        nonzero boolean := false;
        lg integer := 10;
        f bigint;
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
                IF translate(num, '0.', '') <> '' THEN
                    nonzero := true;
                    f := rpad(split_part(num, '.', 2), 9, '0')::bigint;
                    lg := least(lg, CASE WHEN c = 'Y' THEN 0 WHEN c = 'M' AND NOT in_time THEN 1 WHEN c = 'W' THEN 2 WHEN c = 'D' THEN 3 WHEN c = 'H' THEN 4 WHEN c = 'M' THEN 5
                        WHEN split_part(num, '.', 1)::bigint <> 0 THEN 6 WHEN f >= 1000000 THEN 7 WHEN f >= 1000 THEN 8 ELSE 9 END);
                END IF;
                IF part = 'M' AND NOT in_time AND c = 'Y' THEN r := r + 12 * num::bigint;
                ELSIF part = 'M' AND NOT in_time AND c = 'M' THEN r := r + num::bigint;
                ELSIF part = 'D' AND c = 'W' THEN r := r + 7 * num::bigint;
                ELSIF part = 'D' AND c = 'D' THEN r := r + num::bigint;
                ELSIF part = 'S' AND in_time AND c = 'H' THEN r := r + 3600 * num::bigint;
                ELSIF part = 'S' AND in_time AND c = 'M' THEN r := r + 60 * num::bigint;
                ELSIF part = 'S' AND c = 'S' THEN r := r + split_part(num, '.', 1)::bigint;
                ELSIF part = 'N' AND c = 'S' AND position('.' in num) > 0 THEN r := rpad(split_part(num, '.', 2), 9, '0')::bigint;
                ELSIF part = 'years' AND NOT in_time AND c = 'Y' OR part = 'months' AND NOT in_time AND c = 'M' OR part = 'weeks' AND c = 'W' OR part = 'days' AND c = 'D' OR part = 'hours' AND in_time AND c = 'H' OR part = 'minutes' AND in_time AND c = 'M' OR part = 'seconds' AND c = 'S' THEN r := split_part(num, '.', 1)::bigint;
                END IF;
                num := '';
            END IF;
            i := i + 1;
        END LOOP;
        IF part = 'sign' THEN RETURN CASE WHEN nonzero THEN sgn ELSE 0 END; END IF;
        IF part = 'largest' THEN RETURN lg; END IF;
        RETURN sgn * r;
    END;
    $$;
    ```
=== "SQLite"
    `registerSqliteFunctions` registers it, written in JavaScript, with the other functions of the library: see [The SQL functions of the library](query-runners/recommended/bun_sqlite.md#the-sql-functions-of-the-library). Bun SQL's SQLite has no way to register a function.
=== "SQL Server"
    ```sql
    CREATE OR ALTER FUNCTION dbo.tsq_duration_part(@d NVARCHAR(100), @part VARCHAR(10)) RETURNS BIGINT WITH SCHEMABINDING AS
    BEGIN
        IF @d IS NULL RETURN NULL;
        DECLARE @s NVARCHAR(100) = UPPER(LTRIM(RTRIM(@d))), @i INT = 1, @n INT, @c NCHAR(1), @num NVARCHAR(40) = N'', @inTime BIT = 0, @sign INT = 1, @r BIGINT = 0, @nonzero BIT = 0, @largest INT = 10, @f BIGINT;
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
                IF REPLACE(REPLACE(@num, N'0', N''), N'.', N'') <> N''
                BEGIN
                    SET @nonzero = 1;
                    SET @f = CAST(LEFT(CASE WHEN CHARINDEX(N'.', @num) > 0 THEN SUBSTRING(@num, CHARINDEX(N'.', @num) + 1, 40) ELSE N'' END + N'000000000', 9) AS BIGINT);
                    SET @largest = (SELECT MIN(v) FROM (VALUES (@largest), (CASE WHEN @c = N'Y' THEN 0 WHEN @c = N'M' AND @inTime = 0 THEN 1 WHEN @c = N'W' THEN 2 WHEN @c = N'D' THEN 3 WHEN @c = N'H' THEN 4 WHEN @c = N'M' THEN 5
                        WHEN CAST(CASE WHEN CHARINDEX(N'.', @num) > 0 THEN LEFT(@num, CHARINDEX(N'.', @num) - 1) ELSE @num END AS BIGINT) <> 0 THEN 6 WHEN @f >= 1000000 THEN 7 WHEN @f >= 1000 THEN 8 ELSE 9 END)) AS t(v));
                END
                IF @part = 'M' AND @inTime = 0 AND @c = N'Y' SET @r = @r + 12 * CAST(@num AS BIGINT);
                ELSE IF @part = 'M' AND @inTime = 0 AND @c = N'M' SET @r = @r + CAST(@num AS BIGINT);
                ELSE IF @part = 'D' AND @c = N'W' SET @r = @r + 7 * CAST(@num AS BIGINT);
                ELSE IF @part = 'D' AND @c = N'D' SET @r = @r + CAST(@num AS BIGINT);
                ELSE IF @part = 'S' AND @inTime = 1 AND @c = N'H' SET @r = @r + 3600 * CAST(@num AS BIGINT);
                ELSE IF @part = 'S' AND @inTime = 1 AND @c = N'M' SET @r = @r + 60 * CAST(@num AS BIGINT);
                ELSE IF @part = 'S' AND @c = N'S' SET @r = @r + CAST(CASE WHEN CHARINDEX(N'.', @num) > 0 THEN LEFT(@num, CHARINDEX(N'.', @num) - 1) ELSE @num END AS BIGINT);
                ELSE IF @part = 'N' AND @c = N'S' AND CHARINDEX(N'.', @num) > 0 SET @r = CAST(LEFT(SUBSTRING(@num, CHARINDEX(N'.', @num) + 1, 40) + N'000000000', 9) AS BIGINT);
                ELSE IF @part = 'years' AND @inTime = 0 AND @c = N'Y' OR @part = 'months' AND @inTime = 0 AND @c = N'M' OR @part = 'weeks' AND @c = N'W' OR @part = 'days' AND @c = N'D' OR @part = 'hours' AND @inTime = 1 AND @c = N'H' OR @part = 'minutes' AND @inTime = 1 AND @c = N'M' OR @part = 'seconds' AND @c = N'S' SET @r = CAST(CASE WHEN CHARINDEX(N'.', @num) > 0 THEN LEFT(@num, CHARINDEX(N'.', @num) - 1) ELSE @num END AS BIGINT);
                SET @num = N'';
            END
            SET @i = @i + 1;
        END
        IF @part = 'sign' RETURN CASE WHEN @nonzero = 1 THEN @sign ELSE 0 END;
        IF @part = 'largest' RETURN @largest;
        RETURN @sign * @r;
    END
    GO
    ```


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

=== "MariaDB"
    ```sql
    DROP FUNCTION IF EXISTS tsq_duration_text;
    DELIMITER //
    CREATE FUNCTION tsq_duration_text(y BIGINT, mo BIGINT, w BIGINT, d BIGINT, ns DECIMAL(65, 0), unit VARCHAR(6)) RETURNS VARCHAR(100) CHARACTER SET ascii DETERMINISTIC NO SQL
    BEGIN
        DECLARE r VARCHAR(100) DEFAULT '';
        DECLARE t VARCHAR(100) DEFAULT '';
        DECLARE neg BOOLEAN;
        DECLARE f BIGINT;
        IF y IS NULL OR mo IS NULL OR w IS NULL OR d IS NULL OR ns IS NULL THEN RETURN NULL; END IF;
        SET neg = y < 0 OR mo < 0 OR w < 0 OR d < 0 OR ns < 0;
        IF y <> 0 THEN SET r = CONCAT(r, ABS(y), 'Y'); END IF;
        IF mo <> 0 THEN SET r = CONCAT(r, ABS(mo), 'M'); END IF;
        IF w <> 0 THEN SET r = CONCAT(r, ABS(w), 'W'); END IF;
        IF d <> 0 THEN SET r = CONCAT(r, ABS(d), 'D'); END IF;
        SET ns = ABS(ns);
        IF unit = 'hour' AND ns >= 3600000000000 THEN SET t = CONCAT(t, ns DIV 3600000000000, 'H'), ns = ns MOD 3600000000000; END IF;
        IF unit <> 'second' AND ns >= 60000000000 THEN SET t = CONCAT(t, ns DIV 60000000000, 'M'), ns = ns MOD 60000000000; END IF;
        IF ns > 0 THEN
            SET f = ns MOD 1000000000;
            SET t = CONCAT(t, ns DIV 1000000000, IF(f > 0, CONCAT('.', TRIM(TRAILING '0' FROM LPAD(f, 9, '0'))), ''), 'S');
        END IF;
        IF r = '' AND t = '' THEN RETURN 'PT0S'; END IF;
        RETURN CONCAT(IF(neg, '-', ''), 'P', r, IF(t = '', '', CONCAT('T', t)));
    END
    //
    DELIMITER ;

    DROP FUNCTION IF EXISTS tsq_duration_round;
    DELIMITER //
    CREATE FUNCTION tsq_duration_round(y1 INT, m1 INT, d1 INT, ns1 BIGINT, y2 INT, m2 INT, d2 INT, ns2 BIGINT, largest_unit VARCHAR(5), smallest_unit VARCHAR(11), increment BIGINT, rounding_mode VARCHAR(10), negation INT) RETURNS VARCHAR(100) CHARACTER SET ascii DETERMINISTIC NO SQL
    BEGIN
        DECLARE v_day BIGINT DEFAULT 86400000000000;
        DECLARE v_one DATE;
        DECLARE v_two DATE;
        DECLARE v_adjusted DATE;
        DECLARE v_t BIGINT;
        DECLARE v_k INT;
        DECLARE v_ya INT;
        DECLARE v_ma INT;
        DECLARE v_da INT;
        DECLARE v_years BIGINT DEFAULT 0;
        DECLARE v_months BIGINT DEFAULT 0;
        DECLARE v_weeks BIGINT DEFAULT 0;
        DECLARE v_days BIGINT;
        DECLARE v_sign BIGINT;
        DECLARE v_mode VARCHAR(12);
        DECLARE v_r1 BIGINT;
        DECLARE v_start DATE;
        DECLARE v_end DATE;
        DECLARE v_num BIGINT;
        DECLARE v_den BIGINT;
        DECLARE v_whole BIGINT;
        DECLARE v_rest BIGINT;
        DECLARE v_steps BIGINT;
        DECLARE v_step BIGINT;
        DECLARE v_to_round BIGINT;
        DECLARE v_rounded BIGINT;
        IF y1 IS NULL OR m1 IS NULL OR d1 IS NULL OR ns1 IS NULL OR y2 IS NULL OR m2 IS NULL OR d2 IS NULL OR ns2 IS NULL OR largest_unit IS NULL OR smallest_unit IS NULL OR increment IS NULL OR rounding_mode IS NULL OR negation IS NULL THEN RETURN NULL; END IF;
        SET v_one = DATE_ADD(DATE_ADD(MAKEDATE(y1, 1), INTERVAL m1 - 1 MONTH), INTERVAL d1 - 1 DAY);
        SET v_two = DATE_ADD(DATE_ADD(MAKEDATE(y2, 1), INTERVAL m2 - 1 MONTH), INTERVAL d2 - 1 DAY);
        SET v_adjusted = v_two, v_t = ns2 - ns1;
        IF v_t > 0 AND v_two < v_one THEN
            SET v_adjusted = DATE_ADD(v_two, INTERVAL 1 DAY), v_t = v_t - v_day;
        ELSEIF v_t < 0 AND v_two > v_one THEN
            SET v_adjusted = DATE_SUB(v_two, INTERVAL 1 DAY), v_t = v_t + v_day;
        END IF;
        IF largest_unit = 'week' THEN
            SET v_weeks = DATEDIFF(v_adjusted, v_one) DIV 7;
            SET v_days = DATEDIFF(v_adjusted, v_one) - v_weeks * 7;
        ELSE
            SET v_ya = YEAR(v_adjusted), v_ma = MONTH(v_adjusted), v_da = DAY(v_adjusted);
            SET v_k = ((v_ya * 12 + v_ma) * 32 + v_da - (y1 * 12 + m1) * 32 - d1) DIV 32;
            IF largest_unit = 'year' THEN SET v_years = v_k DIV 12; END IF;
            SET v_months = v_k - v_years * 12;
            SET v_days = DATEDIFF(v_adjusted, DATE_ADD(v_one, INTERVAL v_k MONTH));
        END IF;
        SET v_sign = IF(DATEDIFF(v_two, v_one) * v_day + ns2 - ns1 < 0, -1, 1);
        SET v_mode = CASE rounding_mode
            WHEN 'ceil' THEN IF(v_sign < 0, 'zero', 'infinity')
            WHEN 'floor' THEN IF(v_sign < 0, 'infinity', 'zero')
            WHEN 'halfCeil' THEN IF(v_sign < 0, 'halfZero', 'halfInfinity')
            WHEN 'halfFloor' THEN IF(v_sign < 0, 'halfInfinity', 'halfZero')
            WHEN 'expand' THEN 'infinity' WHEN 'trunc' THEN 'zero' WHEN 'halfExpand' THEN 'halfInfinity' WHEN 'halfTrunc' THEN 'halfZero'
            ELSE 'halfEven' END;
        IF smallest_unit IN ('year', 'month', 'week') THEN
            IF smallest_unit = 'year' THEN
                SET v_r1 = v_years DIV increment * increment;
                SET v_start = DATE_ADD(v_one, INTERVAL v_r1 * 12 MONTH);
                SET v_end = DATE_ADD(v_one, INTERVAL (v_r1 + increment * v_sign) * 12 MONTH);
            ELSEIF smallest_unit = 'month' THEN
                SET v_r1 = v_months DIV increment * increment;
                SET v_start = DATE_ADD(v_one, INTERVAL v_years * 12 + v_r1 MONTH);
                SET v_end = DATE_ADD(v_one, INTERVAL v_years * 12 + v_r1 + increment * v_sign MONTH);
            ELSE
                SET v_r1 = IF(largest_unit = 'week', v_weeks, v_days DIV 7) DIV increment * increment;
                SET v_start = DATE_ADD(DATE_ADD(v_one, INTERVAL v_years * 12 + v_months MONTH), INTERVAL v_r1 * 7 DAY);
                SET v_end = DATE_ADD(DATE_ADD(v_one, INTERVAL v_years * 12 + v_months MONTH), INTERVAL (v_r1 + increment * v_sign) * 7 DAY);
            END IF;
            SET v_num = ABS(DATEDIFF(v_two, v_start) * v_day + ns2 - ns1);
            SET v_den = ABS(DATEDIFF(v_end, v_start) * v_day);
            SET v_whole = v_num DIV v_den;
            SET v_rest = v_num - v_whole * v_den;
            SET v_steps = v_whole + IF(v_rest <> 0 AND (v_mode = 'infinity' OR v_mode LIKE 'half%' AND (2 * v_rest > v_den OR 2 * v_rest = v_den AND (v_mode = 'halfInfinity' OR v_mode = 'halfEven' AND (ABS(v_r1) DIV increment + v_whole) % 2 <> 0))), 1, 0);
            SET v_days = 0, v_t = 0;
            IF smallest_unit = 'year' THEN
                SET v_years = v_r1 + increment * v_sign * v_steps, v_months = 0;
            ELSEIF smallest_unit = 'month' THEN
                SET v_months = v_r1 + increment * v_sign * v_steps;
                IF v_steps > 0 AND largest_unit = 'year' AND v_sign * DATEDIFF(DATE_ADD(v_one, INTERVAL v_years * 12 + v_months MONTH), DATE_ADD(v_one, INTERVAL (v_years + v_sign) * 12 MONTH)) >= 0 THEN
                    SET v_years = v_years + v_sign, v_months = 0;
                END IF;
            ELSE
                SET v_weeks = v_r1 + increment * v_sign * v_steps;
            END IF;
        ELSE
            SET v_step = CASE smallest_unit WHEN 'day' THEN v_day WHEN 'hour' THEN 3600000000000 WHEN 'minute' THEN 60000000000 WHEN 'second' THEN 1000000000 WHEN 'millisecond' THEN 1000000 WHEN 'microsecond' THEN 1000 ELSE 1 END * increment;
            SET v_to_round = v_days * v_day + v_t;
            SET v_rest = ABS(v_to_round % v_step);
            SET v_rounded = v_to_round - v_to_round % v_step;
            IF v_rest <> 0 AND (v_mode = 'infinity' OR v_mode LIKE 'half%' AND (2 * v_rest > v_step OR 2 * v_rest = v_step AND (v_mode = 'halfInfinity' OR v_mode = 'halfEven' AND (v_rounded DIV v_step) % 2 <> 0))) THEN
                SET v_rounded = v_rounded + v_step * v_sign;
            END IF;
            SET v_days = v_rounded DIV v_day;
            SET v_t = v_rounded - v_days * v_day;
            IF v_rounded DIV v_day <> v_to_round DIV v_day THEN
                IF largest_unit = 'week' THEN
                    IF v_sign * (DATEDIFF(v_two, DATE_ADD(v_one, INTERVAL (v_weeks + v_sign) * 7 DAY)) * v_day + ns2 - ns1 + v_rounded - v_to_round) >= 0 THEN
                        SET v_weeks = v_weeks + v_sign, v_days = 0, v_t = 0;
                    END IF;
                ELSEIF v_sign * (DATEDIFF(v_two, DATE_ADD(v_one, INTERVAL v_years * 12 + v_months + v_sign MONTH)) * v_day + ns2 - ns1 + v_rounded - v_to_round) >= 0 THEN
                    SET v_days = 0, v_t = 0;
                    IF largest_unit = 'year' AND v_sign * (DATEDIFF(v_two, DATE_ADD(v_one, INTERVAL (v_years + v_sign) * 12 MONTH)) * v_day + ns2 - ns1 + v_rounded - v_to_round) >= 0 THEN
                        SET v_years = v_years + v_sign, v_months = 0;
                    ELSE
                        SET v_months = v_months + v_sign;
                    END IF;
                END IF;
            END IF;
        END IF;
        RETURN tsq_duration_text(v_years * negation, v_months * negation, v_weeks * negation, v_days * negation, v_t * negation, 'hour');
    END
    //
    DELIMITER ;
    ```
=== "MySQL"
    ```sql
    DROP FUNCTION IF EXISTS tsq_duration_text;
    DELIMITER //
    CREATE FUNCTION tsq_duration_text(y BIGINT, mo BIGINT, w BIGINT, d BIGINT, ns DECIMAL(65, 0), unit VARCHAR(6)) RETURNS VARCHAR(100) CHARACTER SET ascii DETERMINISTIC NO SQL
    BEGIN
        DECLARE r VARCHAR(100) DEFAULT '';
        DECLARE t VARCHAR(100) DEFAULT '';
        DECLARE neg BOOLEAN;
        DECLARE f BIGINT;
        IF y IS NULL OR mo IS NULL OR w IS NULL OR d IS NULL OR ns IS NULL THEN RETURN NULL; END IF;
        SET neg = y < 0 OR mo < 0 OR w < 0 OR d < 0 OR ns < 0;
        IF y <> 0 THEN SET r = CONCAT(r, ABS(y), 'Y'); END IF;
        IF mo <> 0 THEN SET r = CONCAT(r, ABS(mo), 'M'); END IF;
        IF w <> 0 THEN SET r = CONCAT(r, ABS(w), 'W'); END IF;
        IF d <> 0 THEN SET r = CONCAT(r, ABS(d), 'D'); END IF;
        SET ns = ABS(ns);
        IF unit = 'hour' AND ns >= 3600000000000 THEN SET t = CONCAT(t, ns DIV 3600000000000, 'H'), ns = ns MOD 3600000000000; END IF;
        IF unit <> 'second' AND ns >= 60000000000 THEN SET t = CONCAT(t, ns DIV 60000000000, 'M'), ns = ns MOD 60000000000; END IF;
        IF ns > 0 THEN
            SET f = ns MOD 1000000000;
            SET t = CONCAT(t, ns DIV 1000000000, IF(f > 0, CONCAT('.', TRIM(TRAILING '0' FROM LPAD(f, 9, '0'))), ''), 'S');
        END IF;
        IF r = '' AND t = '' THEN RETURN 'PT0S'; END IF;
        RETURN CONCAT(IF(neg, '-', ''), 'P', r, IF(t = '', '', CONCAT('T', t)));
    END
    //
    DELIMITER ;

    DROP FUNCTION IF EXISTS tsq_duration_round;
    DELIMITER //
    CREATE FUNCTION tsq_duration_round(y1 INT, m1 INT, d1 INT, ns1 BIGINT, y2 INT, m2 INT, d2 INT, ns2 BIGINT, largest_unit VARCHAR(5), smallest_unit VARCHAR(11), increment BIGINT, rounding_mode VARCHAR(10), negation INT) RETURNS VARCHAR(100) CHARACTER SET ascii DETERMINISTIC NO SQL
    BEGIN
        DECLARE v_day BIGINT DEFAULT 86400000000000;
        DECLARE v_one DATE;
        DECLARE v_two DATE;
        DECLARE v_adjusted DATE;
        DECLARE v_t BIGINT;
        DECLARE v_k INT;
        DECLARE v_ya INT;
        DECLARE v_ma INT;
        DECLARE v_da INT;
        DECLARE v_years BIGINT DEFAULT 0;
        DECLARE v_months BIGINT DEFAULT 0;
        DECLARE v_weeks BIGINT DEFAULT 0;
        DECLARE v_days BIGINT;
        DECLARE v_sign BIGINT;
        DECLARE v_mode VARCHAR(12);
        DECLARE v_r1 BIGINT;
        DECLARE v_start DATE;
        DECLARE v_end DATE;
        DECLARE v_num BIGINT;
        DECLARE v_den BIGINT;
        DECLARE v_whole BIGINT;
        DECLARE v_rest BIGINT;
        DECLARE v_steps BIGINT;
        DECLARE v_step BIGINT;
        DECLARE v_to_round BIGINT;
        DECLARE v_rounded BIGINT;
        IF y1 IS NULL OR m1 IS NULL OR d1 IS NULL OR ns1 IS NULL OR y2 IS NULL OR m2 IS NULL OR d2 IS NULL OR ns2 IS NULL OR largest_unit IS NULL OR smallest_unit IS NULL OR increment IS NULL OR rounding_mode IS NULL OR negation IS NULL THEN RETURN NULL; END IF;
        SET v_one = DATE_ADD(DATE_ADD(MAKEDATE(y1, 1), INTERVAL m1 - 1 MONTH), INTERVAL d1 - 1 DAY);
        SET v_two = DATE_ADD(DATE_ADD(MAKEDATE(y2, 1), INTERVAL m2 - 1 MONTH), INTERVAL d2 - 1 DAY);
        SET v_adjusted = v_two, v_t = ns2 - ns1;
        IF v_t > 0 AND v_two < v_one THEN
            SET v_adjusted = DATE_ADD(v_two, INTERVAL 1 DAY), v_t = v_t - v_day;
        ELSEIF v_t < 0 AND v_two > v_one THEN
            SET v_adjusted = DATE_SUB(v_two, INTERVAL 1 DAY), v_t = v_t + v_day;
        END IF;
        IF largest_unit = 'week' THEN
            SET v_weeks = DATEDIFF(v_adjusted, v_one) DIV 7;
            SET v_days = DATEDIFF(v_adjusted, v_one) - v_weeks * 7;
        ELSE
            SET v_ya = YEAR(v_adjusted), v_ma = MONTH(v_adjusted), v_da = DAY(v_adjusted);
            SET v_k = ((v_ya * 12 + v_ma) * 32 + v_da - (y1 * 12 + m1) * 32 - d1) DIV 32;
            IF largest_unit = 'year' THEN SET v_years = v_k DIV 12; END IF;
            SET v_months = v_k - v_years * 12;
            SET v_days = DATEDIFF(v_adjusted, DATE_ADD(v_one, INTERVAL v_k MONTH));
        END IF;
        SET v_sign = IF(DATEDIFF(v_two, v_one) * v_day + ns2 - ns1 < 0, -1, 1);
        SET v_mode = CASE rounding_mode
            WHEN 'ceil' THEN IF(v_sign < 0, 'zero', 'infinity')
            WHEN 'floor' THEN IF(v_sign < 0, 'infinity', 'zero')
            WHEN 'halfCeil' THEN IF(v_sign < 0, 'halfZero', 'halfInfinity')
            WHEN 'halfFloor' THEN IF(v_sign < 0, 'halfInfinity', 'halfZero')
            WHEN 'expand' THEN 'infinity' WHEN 'trunc' THEN 'zero' WHEN 'halfExpand' THEN 'halfInfinity' WHEN 'halfTrunc' THEN 'halfZero'
            ELSE 'halfEven' END;
        IF smallest_unit IN ('year', 'month', 'week') THEN
            IF smallest_unit = 'year' THEN
                SET v_r1 = v_years DIV increment * increment;
                SET v_start = DATE_ADD(v_one, INTERVAL v_r1 * 12 MONTH);
                SET v_end = DATE_ADD(v_one, INTERVAL (v_r1 + increment * v_sign) * 12 MONTH);
            ELSEIF smallest_unit = 'month' THEN
                SET v_r1 = v_months DIV increment * increment;
                SET v_start = DATE_ADD(v_one, INTERVAL v_years * 12 + v_r1 MONTH);
                SET v_end = DATE_ADD(v_one, INTERVAL v_years * 12 + v_r1 + increment * v_sign MONTH);
            ELSE
                SET v_r1 = IF(largest_unit = 'week', v_weeks, v_days DIV 7) DIV increment * increment;
                SET v_start = DATE_ADD(DATE_ADD(v_one, INTERVAL v_years * 12 + v_months MONTH), INTERVAL v_r1 * 7 DAY);
                SET v_end = DATE_ADD(DATE_ADD(v_one, INTERVAL v_years * 12 + v_months MONTH), INTERVAL (v_r1 + increment * v_sign) * 7 DAY);
            END IF;
            SET v_num = ABS(DATEDIFF(v_two, v_start) * v_day + ns2 - ns1);
            SET v_den = ABS(DATEDIFF(v_end, v_start) * v_day);
            SET v_whole = v_num DIV v_den;
            SET v_rest = v_num - v_whole * v_den;
            SET v_steps = v_whole + IF(v_rest <> 0 AND (v_mode = 'infinity' OR v_mode LIKE 'half%' AND (2 * v_rest > v_den OR 2 * v_rest = v_den AND (v_mode = 'halfInfinity' OR v_mode = 'halfEven' AND (ABS(v_r1) DIV increment + v_whole) % 2 <> 0))), 1, 0);
            SET v_days = 0, v_t = 0;
            IF smallest_unit = 'year' THEN
                SET v_years = v_r1 + increment * v_sign * v_steps, v_months = 0;
            ELSEIF smallest_unit = 'month' THEN
                SET v_months = v_r1 + increment * v_sign * v_steps;
                IF v_steps > 0 AND largest_unit = 'year' AND v_sign * DATEDIFF(DATE_ADD(v_one, INTERVAL v_years * 12 + v_months MONTH), DATE_ADD(v_one, INTERVAL (v_years + v_sign) * 12 MONTH)) >= 0 THEN
                    SET v_years = v_years + v_sign, v_months = 0;
                END IF;
            ELSE
                SET v_weeks = v_r1 + increment * v_sign * v_steps;
            END IF;
        ELSE
            SET v_step = CASE smallest_unit WHEN 'day' THEN v_day WHEN 'hour' THEN 3600000000000 WHEN 'minute' THEN 60000000000 WHEN 'second' THEN 1000000000 WHEN 'millisecond' THEN 1000000 WHEN 'microsecond' THEN 1000 ELSE 1 END * increment;
            SET v_to_round = v_days * v_day + v_t;
            SET v_rest = ABS(v_to_round % v_step);
            SET v_rounded = v_to_round - v_to_round % v_step;
            IF v_rest <> 0 AND (v_mode = 'infinity' OR v_mode LIKE 'half%' AND (2 * v_rest > v_step OR 2 * v_rest = v_step AND (v_mode = 'halfInfinity' OR v_mode = 'halfEven' AND (v_rounded DIV v_step) % 2 <> 0))) THEN
                SET v_rounded = v_rounded + v_step * v_sign;
            END IF;
            SET v_days = v_rounded DIV v_day;
            SET v_t = v_rounded - v_days * v_day;
            IF v_rounded DIV v_day <> v_to_round DIV v_day THEN
                IF largest_unit = 'week' THEN
                    IF v_sign * (DATEDIFF(v_two, DATE_ADD(v_one, INTERVAL (v_weeks + v_sign) * 7 DAY)) * v_day + ns2 - ns1 + v_rounded - v_to_round) >= 0 THEN
                        SET v_weeks = v_weeks + v_sign, v_days = 0, v_t = 0;
                    END IF;
                ELSEIF v_sign * (DATEDIFF(v_two, DATE_ADD(v_one, INTERVAL v_years * 12 + v_months + v_sign MONTH)) * v_day + ns2 - ns1 + v_rounded - v_to_round) >= 0 THEN
                    SET v_days = 0, v_t = 0;
                    IF largest_unit = 'year' AND v_sign * (DATEDIFF(v_two, DATE_ADD(v_one, INTERVAL (v_years + v_sign) * 12 MONTH)) * v_day + ns2 - ns1 + v_rounded - v_to_round) >= 0 THEN
                        SET v_years = v_years + v_sign, v_months = 0;
                    ELSE
                        SET v_months = v_months + v_sign;
                    END IF;
                END IF;
            END IF;
        END IF;
        RETURN tsq_duration_text(v_years * negation, v_months * negation, v_weeks * negation, v_days * negation, v_t * negation, 'hour');
    END
    //
    DELIMITER ;
    ```
=== "Oracle"
    ```sql
    CREATE OR REPLACE FUNCTION tsq_duration_text(y IN NUMBER, mo IN NUMBER, w IN NUMBER, d IN NUMBER, ns IN NUMBER, unit IN VARCHAR2) RETURN VARCHAR2 DETERMINISTIC IS
        r VARCHAR2(100);
        t VARCHAR2(100);
        rest NUMBER;
        f NUMBER;
    BEGIN
        IF y IS NULL OR mo IS NULL OR w IS NULL OR d IS NULL OR ns IS NULL THEN RETURN NULL; END IF;
        IF y <> 0 THEN r := r || TO_CHAR(ABS(y)) || 'Y'; END IF;
        IF mo <> 0 THEN r := r || TO_CHAR(ABS(mo)) || 'M'; END IF;
        IF w <> 0 THEN r := r || TO_CHAR(ABS(w)) || 'W'; END IF;
        IF d <> 0 THEN r := r || TO_CHAR(ABS(d)) || 'D'; END IF;
        rest := ABS(ns);
        IF unit = 'hour' AND rest >= 3600000000000 THEN t := t || TO_CHAR(TRUNC(rest / 3600000000000)) || 'H'; rest := MOD(rest, 3600000000000); END IF;
        IF unit <> 'second' AND rest >= 60000000000 THEN t := t || TO_CHAR(TRUNC(rest / 60000000000)) || 'M'; rest := MOD(rest, 60000000000); END IF;
        IF rest > 0 THEN
            f := MOD(rest, 1000000000);
            t := t || TO_CHAR(TRUNC(rest / 1000000000));
            IF f > 0 THEN t := t || '.' || RTRIM(LPAD(TO_CHAR(f), 9, '0'), '0'); END IF;
            t := t || 'S';
        END IF;
        IF r IS NULL AND t IS NULL THEN RETURN 'PT0S'; END IF;
        RETURN CASE WHEN y < 0 OR mo < 0 OR w < 0 OR d < 0 OR ns < 0 THEN '-' END || 'P' || r || CASE WHEN t IS NOT NULL THEN 'T' || t END;
    END;

    CREATE OR REPLACE FUNCTION tsq_duration_round(y1 IN NUMBER, m1 IN NUMBER, d1 IN NUMBER, ns1 IN NUMBER, y2 IN NUMBER, m2 IN NUMBER, d2 IN NUMBER, ns2 IN NUMBER, largest_unit IN VARCHAR2, smallest_unit IN VARCHAR2, increment IN NUMBER, rounding_mode IN VARCHAR2, negation IN NUMBER) RETURN VARCHAR2 DETERMINISTIC IS
        v_day CONSTANT NUMBER := 86400000000000;
        v_one DATE;
        v_two DATE;
        v_adjusted DATE;
        v_t NUMBER;
        v_k NUMBER;
        v_years NUMBER := 0;
        v_months NUMBER := 0;
        v_weeks NUMBER := 0;
        v_days NUMBER;
        v_sign NUMBER;
        v_mode VARCHAR2(12);
        v_r1 NUMBER;
        v_start DATE;
        v_end DATE;
        v_num NUMBER;
        v_den NUMBER;
        v_whole NUMBER;
        v_rest NUMBER;
        v_steps NUMBER;
        v_step NUMBER;
        v_to_round NUMBER;
        v_rounded NUMBER;
        -- add_months gives the last day of a month to the last day of another: the days it moves past the day are taken back
        FUNCTION plus_months(d IN DATE, k IN NUMBER) RETURN DATE IS
        BEGIN
            RETURN ADD_MONTHS(d, k) - GREATEST(0, EXTRACT(DAY FROM ADD_MONTHS(d, k)) - EXTRACT(DAY FROM d));
        END;
    BEGIN
        IF y1 IS NULL OR m1 IS NULL OR d1 IS NULL OR ns1 IS NULL OR y2 IS NULL OR m2 IS NULL OR d2 IS NULL OR ns2 IS NULL OR largest_unit IS NULL OR smallest_unit IS NULL OR increment IS NULL OR rounding_mode IS NULL OR negation IS NULL THEN RETURN NULL; END IF;
        v_one := ADD_MONTHS(DATE '0001-01-01', (y1 - 1) * 12 + m1 - 1) + d1 - 1;
        v_two := ADD_MONTHS(DATE '0001-01-01', (y2 - 1) * 12 + m2 - 1) + d2 - 1;
        v_adjusted := v_two;
        v_t := ns2 - ns1;
        IF v_t > 0 AND v_two < v_one THEN
            v_adjusted := v_two + 1;
            v_t := v_t - v_day;
        ELSIF v_t < 0 AND v_two > v_one THEN
            v_adjusted := v_two - 1;
            v_t := v_t + v_day;
        END IF;
        IF largest_unit = 'week' THEN
            v_weeks := TRUNC((v_adjusted - v_one) / 7);
            v_days := (v_adjusted - v_one) - v_weeks * 7;
        ELSE
            v_k := TRUNC(((EXTRACT(YEAR FROM v_adjusted) * 12 + EXTRACT(MONTH FROM v_adjusted)) * 32 + EXTRACT(DAY FROM v_adjusted) - (y1 * 12 + m1) * 32 - d1) / 32);
            IF largest_unit = 'year' THEN v_years := TRUNC(v_k / 12); END IF;
            v_months := v_k - v_years * 12;
            v_days := v_adjusted - plus_months(v_one, v_k);
        END IF;
        v_sign := CASE WHEN (v_two - v_one) * v_day + ns2 - ns1 < 0 THEN -1 ELSE 1 END;
        v_mode := CASE rounding_mode
            WHEN 'ceil' THEN CASE WHEN v_sign < 0 THEN 'zero' ELSE 'infinity' END
            WHEN 'floor' THEN CASE WHEN v_sign < 0 THEN 'infinity' ELSE 'zero' END
            WHEN 'halfCeil' THEN CASE WHEN v_sign < 0 THEN 'halfZero' ELSE 'halfInfinity' END
            WHEN 'halfFloor' THEN CASE WHEN v_sign < 0 THEN 'halfInfinity' ELSE 'halfZero' END
            WHEN 'expand' THEN 'infinity' WHEN 'trunc' THEN 'zero' WHEN 'halfExpand' THEN 'halfInfinity' WHEN 'halfTrunc' THEN 'halfZero'
            ELSE 'halfEven' END;
        IF smallest_unit IN ('year', 'month', 'week') THEN
            IF smallest_unit = 'year' THEN
                v_r1 := TRUNC(v_years / increment) * increment;
                v_start := plus_months(v_one, v_r1 * 12);
                v_end := plus_months(v_one, (v_r1 + increment * v_sign) * 12);
            ELSIF smallest_unit = 'month' THEN
                v_r1 := TRUNC(v_months / increment) * increment;
                v_start := plus_months(v_one, v_years * 12 + v_r1);
                v_end := plus_months(v_one, v_years * 12 + v_r1 + increment * v_sign);
            ELSE
                v_r1 := TRUNC(CASE WHEN largest_unit = 'week' THEN v_weeks ELSE TRUNC(v_days / 7) END / increment) * increment;
                v_start := plus_months(v_one, v_years * 12 + v_months) + v_r1 * 7;
                v_end := plus_months(v_one, v_years * 12 + v_months) + (v_r1 + increment * v_sign) * 7;
            END IF;
            v_num := ABS((v_two - v_start) * v_day + ns2 - ns1);
            v_den := ABS((v_end - v_start) * v_day);
            v_whole := TRUNC(v_num / v_den);
            v_rest := v_num - v_whole * v_den;
            v_steps := v_whole + CASE WHEN v_rest <> 0 AND (v_mode = 'infinity' OR v_mode LIKE 'half%' AND (2 * v_rest > v_den OR 2 * v_rest = v_den AND (v_mode = 'halfInfinity' OR v_mode = 'halfEven' AND MOD(TRUNC(ABS(v_r1) / increment) + v_whole, 2) <> 0))) THEN 1 ELSE 0 END;
            v_days := 0;
            v_t := 0;
            IF smallest_unit = 'year' THEN
                v_years := v_r1 + increment * v_sign * v_steps;
                v_months := 0;
            ELSIF smallest_unit = 'month' THEN
                v_months := v_r1 + increment * v_sign * v_steps;
                IF v_steps > 0 AND largest_unit = 'year' AND v_sign * (plus_months(v_one, v_years * 12 + v_months) - plus_months(v_one, (v_years + v_sign) * 12)) >= 0 THEN
                    v_years := v_years + v_sign;
                    v_months := 0;
                END IF;
            ELSE
                v_weeks := v_r1 + increment * v_sign * v_steps;
            END IF;
        ELSE
            v_step := CASE smallest_unit WHEN 'day' THEN v_day WHEN 'hour' THEN 3600000000000 WHEN 'minute' THEN 60000000000 WHEN 'second' THEN 1000000000 WHEN 'millisecond' THEN 1000000 WHEN 'microsecond' THEN 1000 ELSE 1 END * increment;
            v_to_round := v_days * v_day + v_t;
            v_rest := ABS(MOD(v_to_round, v_step));
            v_rounded := v_to_round - MOD(v_to_round, v_step);
            IF v_rest <> 0 AND (v_mode = 'infinity' OR v_mode LIKE 'half%' AND (2 * v_rest > v_step OR 2 * v_rest = v_step AND (v_mode = 'halfInfinity' OR v_mode = 'halfEven' AND MOD(TRUNC(v_rounded / v_step), 2) <> 0))) THEN
                v_rounded := v_rounded + v_step * v_sign;
            END IF;
            v_days := TRUNC(v_rounded / v_day);
            v_t := v_rounded - v_days * v_day;
            IF TRUNC(v_rounded / v_day) <> TRUNC(v_to_round / v_day) THEN
                IF largest_unit = 'week' THEN
                    IF v_sign * ((v_two - (v_one + (v_weeks + v_sign) * 7)) * v_day + ns2 - ns1 + v_rounded - v_to_round) >= 0 THEN
                        v_weeks := v_weeks + v_sign;
                        v_days := 0;
                        v_t := 0;
                    END IF;
                ELSIF v_sign * ((v_two - plus_months(v_one, v_years * 12 + v_months + v_sign)) * v_day + ns2 - ns1 + v_rounded - v_to_round) >= 0 THEN
                    v_days := 0;
                    v_t := 0;
                    IF largest_unit = 'year' AND v_sign * ((v_two - plus_months(v_one, (v_years + v_sign) * 12)) * v_day + ns2 - ns1 + v_rounded - v_to_round) >= 0 THEN
                        v_years := v_years + v_sign;
                        v_months := 0;
                    ELSE
                        v_months := v_months + v_sign;
                    END IF;
                END IF;
            END IF;
        END IF;
        RETURN tsq_duration_text(v_years * negation, v_months * negation, v_weeks * negation, v_days * negation, v_t * negation, 'hour');
    END;
    ```
===+ "PostgreSQL"
    ```sql
    CREATE OR REPLACE FUNCTION tsq_duration_round(y1 integer, m1 integer, d1 integer, ns1 bigint, y2 integer, m2 integer, d2 integer, ns2 bigint, largest_unit text, smallest_unit text, increment bigint, rounding_mode text, negation integer) RETURNS interval LANGUAGE plpgsql IMMUTABLE STRICT AS $$
    DECLARE
        day_ns CONSTANT bigint := 86400000000000;
        one date := make_date(y1, m1, d1);
        two date := make_date(y2, m2, d2);
        adjusted date := make_date(y2, m2, d2);
        t bigint := ns2 - ns1;
        k integer;
        years bigint := 0;
        months bigint := 0;
        weeks bigint := 0;
        days bigint;
        sgn bigint;
        um text;
        r1 bigint;
        start_day date;
        end_day date;
        num bigint;
        den bigint;
        whole bigint;
        rest bigint;
        steps bigint;
        step bigint;
        to_round bigint;
        rounded bigint;
    BEGIN
        IF t > 0 AND two < one THEN
            adjusted := two + 1;
            t := t - day_ns;
        ELSIF t < 0 AND two > one THEN
            adjusted := two - 1;
            t := t + day_ns;
        END IF;
        IF largest_unit = 'week' THEN
            weeks := (adjusted - one) / 7;
            days := (adjusted - one) - weeks * 7;
        ELSE
            k := ((extract(year from adjusted)::integer * 12 + extract(month from adjusted)::integer) * 32 + extract(day from adjusted)::integer - (y1 * 12 + m1) * 32 - d1) / 32;
            IF largest_unit = 'year' THEN
                years := k / 12;
            END IF;
            months := k - years * 12;
            days := adjusted - (one + make_interval(months => k))::date;
        END IF;
        sgn := CASE WHEN (two - one)::bigint * day_ns + ns2 - ns1 < 0 THEN -1 ELSE 1 END;
        um := CASE rounding_mode
            WHEN 'ceil' THEN CASE WHEN sgn < 0 THEN 'zero' ELSE 'infinity' END
            WHEN 'floor' THEN CASE WHEN sgn < 0 THEN 'infinity' ELSE 'zero' END
            WHEN 'halfCeil' THEN CASE WHEN sgn < 0 THEN 'halfZero' ELSE 'halfInfinity' END
            WHEN 'halfFloor' THEN CASE WHEN sgn < 0 THEN 'halfInfinity' ELSE 'halfZero' END
            WHEN 'expand' THEN 'infinity' WHEN 'trunc' THEN 'zero' WHEN 'halfExpand' THEN 'halfInfinity' WHEN 'halfTrunc' THEN 'halfZero'
            ELSE 'halfEven' END;
        IF smallest_unit IN ('year', 'month', 'week') THEN
            IF smallest_unit = 'year' THEN
                r1 := years / increment * increment;
                start_day := (one + make_interval(months => (r1 * 12)::integer))::date;
                end_day := (one + make_interval(months => ((r1 + increment * sgn) * 12)::integer))::date;
            ELSIF smallest_unit = 'month' THEN
                r1 := months / increment * increment;
                start_day := (one + make_interval(months => (years * 12 + r1)::integer))::date;
                end_day := (one + make_interval(months => (years * 12 + r1 + increment * sgn)::integer))::date;
            ELSE
                r1 := (CASE WHEN largest_unit = 'week' THEN weeks ELSE days / 7 END) / increment * increment;
                start_day := (one + make_interval(months => (years * 12 + months)::integer))::date + (r1 * 7)::integer;
                end_day := (one + make_interval(months => (years * 12 + months)::integer))::date + ((r1 + increment * sgn) * 7)::integer;
            END IF;
            num := abs((two - start_day)::bigint * day_ns + ns2 - ns1);
            den := abs((end_day - start_day)::bigint * day_ns);
            whole := num / den;
            rest := num - whole * den;
            steps := whole + CASE WHEN rest <> 0 AND (um = 'infinity' OR um LIKE 'half%' AND (2 * rest > den OR 2 * rest = den AND (um = 'halfInfinity' OR um = 'halfEven' AND (abs(r1) / increment + whole) % 2 <> 0))) THEN 1 ELSE 0 END;
            days := 0;
            t := 0;
            IF smallest_unit = 'year' THEN
                years := r1 + increment * sgn * steps;
                months := 0;
            ELSIF smallest_unit = 'month' THEN
                months := r1 + increment * sgn * steps;
                IF steps > 0 AND largest_unit = 'year' AND sgn * ((one + make_interval(months => (years * 12 + months)::integer))::date - (one + make_interval(months => ((years + sgn) * 12)::integer))::date) >= 0 THEN
                    years := years + sgn;
                    months := 0;
                END IF;
            ELSE
                weeks := r1 + increment * sgn * steps;
            END IF;
        ELSE
            step := CASE smallest_unit WHEN 'day' THEN day_ns WHEN 'hour' THEN 3600000000000 WHEN 'minute' THEN 60000000000 WHEN 'second' THEN 1000000000 WHEN 'millisecond' THEN 1000000 WHEN 'microsecond' THEN 1000 ELSE 1 END * increment;
            to_round := days * day_ns + t;
            rest := abs(to_round % step);
            rounded := to_round - to_round % step;
            IF rest <> 0 AND (um = 'infinity' OR um LIKE 'half%' AND (2 * rest > step OR 2 * rest = step AND (um = 'halfInfinity' OR um = 'halfEven' AND (rounded / step) % 2 <> 0))) THEN
                rounded := rounded + step * sgn;
            END IF;
            days := rounded / day_ns;
            t := rounded - days * day_ns;
            IF rounded / day_ns <> to_round / day_ns THEN
                IF largest_unit = 'week' THEN
                    IF sgn * ((two - (one + ((weeks + sgn) * 7)::integer))::bigint * day_ns + ns2 - ns1 + rounded - to_round) >= 0 THEN
                        weeks := weeks + sgn;
                        days := 0;
                        t := 0;
                    END IF;
                ELSIF sgn * ((two - (one + make_interval(months => (years * 12 + months + sgn)::integer))::date)::bigint * day_ns + ns2 - ns1 + rounded - to_round) >= 0 THEN
                    days := 0;
                    t := 0;
                    IF largest_unit = 'year' AND sgn * ((two - (one + make_interval(months => ((years + sgn) * 12)::integer))::date)::bigint * day_ns + ns2 - ns1 + rounded - to_round) >= 0 THEN
                        years := years + sgn;
                        months := 0;
                    ELSE
                        months := months + sgn;
                    END IF;
                END IF;
            END IF;
        END IF;
        RETURN make_interval(years => (years * negation)::integer, months => (months * negation)::integer, weeks => (weeks * negation)::integer, days => (days * negation)::integer, secs => t * negation / 1000000000.0);
    END
    $$;
    ```
=== "SQLite"
    `registerSqliteFunctions` registers both, written in JavaScript, with the other functions of the library: see [The SQL functions of the library](query-runners/recommended/bun_sqlite.md#the-sql-functions-of-the-library). Bun SQL's SQLite has no way to register a function.
=== "SQL Server"
    ```sql
    DROP FUNCTION IF EXISTS dbo.tsq_duration_round;
    DROP FUNCTION IF EXISTS dbo.tsq_duration_add;
    GO

    CREATE OR ALTER FUNCTION dbo.tsq_duration_text(@y BIGINT, @mo BIGINT, @w BIGINT, @d BIGINT, @ns DECIMAL(38, 0), @unit VARCHAR(6)) RETURNS VARCHAR(100) WITH SCHEMABINDING AS
    BEGIN
        IF @y IS NULL OR @mo IS NULL OR @w IS NULL OR @d IS NULL OR @ns IS NULL RETURN NULL;
        DECLARE @neg BIT = CASE WHEN @y < 0 OR @mo < 0 OR @w < 0 OR @d < 0 OR @ns < 0 THEN 1 ELSE 0 END, @r VARCHAR(100) = '', @t VARCHAR(100) = '';
        DECLARE @hour BIGINT = 3600000000000, @minute BIGINT = 60000000000, @second BIGINT = 1000000000, @f BIGINT, @frac VARCHAR(9);
        IF @y <> 0 SET @r = @r + CAST(ABS(@y) AS VARCHAR(20)) + 'Y';
        IF @mo <> 0 SET @r = @r + CAST(ABS(@mo) AS VARCHAR(20)) + 'M';
        IF @w <> 0 SET @r = @r + CAST(ABS(@w) AS VARCHAR(20)) + 'W';
        IF @d <> 0 SET @r = @r + CAST(ABS(@d) AS VARCHAR(20)) + 'D';
        SET @ns = ABS(@ns);
        IF @unit = 'hour' AND @ns >= @hour BEGIN SET @t = @t + CAST(FLOOR(@ns / @hour) AS VARCHAR(20)) + 'H'; SET @ns = @ns % @hour; END
        IF @unit <> 'second' AND @ns >= @minute BEGIN SET @t = @t + CAST(FLOOR(@ns / @minute) AS VARCHAR(20)) + 'M'; SET @ns = @ns % @minute; END
        IF @ns > 0
        BEGIN
            SET @f = @ns % @second;
            SET @t = @t + CAST(FLOOR(@ns / @second) AS VARCHAR(20));
            IF @f > 0
            BEGIN
                SET @frac = RIGHT('000000000' + CAST(@f AS VARCHAR(9)), 9);
                WHILE RIGHT(@frac, 1) = '0' SET @frac = LEFT(@frac, LEN(@frac) - 1);
                SET @t = @t + '.' + @frac;
            END
            SET @t = @t + 'S';
        END
        IF @r = '' AND @t = '' RETURN 'PT0S';
        RETURN CASE WHEN @neg = 1 THEN '-' ELSE '' END + 'P' + @r + CASE WHEN @t = '' THEN '' ELSE 'T' + @t END;
    END
    GO

    CREATE OR ALTER FUNCTION dbo.tsq_duration_round(@y1 INT, @m1 INT, @d1 INT, @ns1 BIGINT, @y2 INT, @m2 INT, @d2 INT, @ns2 BIGINT, @largest VARCHAR(5), @smallest VARCHAR(11), @increment BIGINT, @mode VARCHAR(10), @negation INT) RETURNS VARCHAR(100) WITH SCHEMABINDING AS
    BEGIN
        IF @y1 IS NULL OR @m1 IS NULL OR @d1 IS NULL OR @ns1 IS NULL OR @y2 IS NULL OR @m2 IS NULL OR @d2 IS NULL OR @ns2 IS NULL OR @largest IS NULL OR @smallest IS NULL OR @increment IS NULL OR @mode IS NULL OR @negation IS NULL RETURN NULL;
        DECLARE @day BIGINT = 86400000000000, @one DATE = DATEFROMPARTS(@y1, @m1, @d1), @two DATE = DATEFROMPARTS(@y2, @m2, @d2);
        DECLARE @adjusted DATE = @two, @t BIGINT = @ns2 - @ns1, @k INT, @years BIGINT = 0, @months BIGINT = 0, @weeks BIGINT = 0, @days BIGINT;
        DECLARE @sign BIGINT, @um VARCHAR(12), @r1 BIGINT, @start DATE, @end DATE, @num BIGINT, @den BIGINT, @whole BIGINT, @rest BIGINT, @steps BIGINT, @step BIGINT, @toRound BIGINT, @rounded BIGINT;
        IF @t > 0 AND @two < @one BEGIN SET @adjusted = DATEADD(day, 1, @two); SET @t = @t - @day; END
        ELSE IF @t < 0 AND @two > @one BEGIN SET @adjusted = DATEADD(day, -1, @two); SET @t = @t + @day; END
        IF @largest = 'week'
        BEGIN
            SET @weeks = DATEDIFF(day, @one, @adjusted) / 7;
            SET @days = DATEDIFF(day, @one, @adjusted) - @weeks * 7;
        END
        ELSE
        BEGIN
            SET @k = ((YEAR(@adjusted) * 12 + MONTH(@adjusted)) * 32 + DAY(@adjusted) - (@y1 * 12 + @m1) * 32 - @d1) / 32;
            IF @largest = 'year' SET @years = @k / 12;
            SET @months = @k - @years * 12;
            SET @days = DATEDIFF(day, DATEADD(month, @k, @one), @adjusted);
        END
        SET @sign = CASE WHEN CAST(DATEDIFF(day, @one, @two) AS BIGINT) * @day + @ns2 - @ns1 < 0 THEN -1 ELSE 1 END;
        SET @um = CASE @mode
            WHEN 'ceil' THEN CASE WHEN @sign < 0 THEN 'zero' ELSE 'infinity' END
            WHEN 'floor' THEN CASE WHEN @sign < 0 THEN 'infinity' ELSE 'zero' END
            WHEN 'halfCeil' THEN CASE WHEN @sign < 0 THEN 'halfZero' ELSE 'halfInfinity' END
            WHEN 'halfFloor' THEN CASE WHEN @sign < 0 THEN 'halfInfinity' ELSE 'halfZero' END
            WHEN 'expand' THEN 'infinity' WHEN 'trunc' THEN 'zero' WHEN 'halfExpand' THEN 'halfInfinity' WHEN 'halfTrunc' THEN 'halfZero'
            ELSE 'halfEven' END;
        IF @smallest IN ('year', 'month', 'week')
        BEGIN
            IF @smallest = 'year'
            BEGIN
                SET @r1 = @years / @increment * @increment;
                SET @start = DATEADD(month, @r1 * 12, @one);
                SET @end = DATEADD(month, (@r1 + @increment * @sign) * 12, @one);
            END
            ELSE IF @smallest = 'month'
            BEGIN
                SET @r1 = @months / @increment * @increment;
                SET @start = DATEADD(month, @years * 12 + @r1, @one);
                SET @end = DATEADD(month, @years * 12 + @r1 + @increment * @sign, @one);
            END
            ELSE
            BEGIN
                SET @r1 = CASE WHEN @largest = 'week' THEN @weeks ELSE @days / 7 END / @increment * @increment;
                SET @start = DATEADD(day, @r1 * 7, DATEADD(month, @years * 12 + @months, @one));
                SET @end = DATEADD(day, (@r1 + @increment * @sign) * 7, DATEADD(month, @years * 12 + @months, @one));
            END
            SET @num = ABS(CAST(DATEDIFF(day, @start, @two) AS BIGINT) * @day + @ns2 - @ns1);
            SET @den = ABS(CAST(DATEDIFF(day, @start, @end) AS BIGINT) * @day);
            SET @whole = @num / @den;
            SET @rest = @num - @whole * @den;
            SET @steps = @whole + CASE WHEN @rest <> 0 AND (@um = 'infinity' OR @um LIKE 'half%' AND (2 * @rest > @den OR 2 * @rest = @den AND (@um = 'halfInfinity' OR @um = 'halfEven' AND (ABS(@r1) / @increment + @whole) % 2 <> 0))) THEN 1 ELSE 0 END;
            SET @days = 0;
            SET @t = 0;
            IF @smallest = 'year' BEGIN SET @years = @r1 + @increment * @sign * @steps; SET @months = 0; END
            ELSE IF @smallest = 'month'
            BEGIN
                SET @months = @r1 + @increment * @sign * @steps;
                IF @steps > 0 AND @largest = 'year' AND @sign * DATEDIFF(day, DATEADD(month, (@years + @sign) * 12, @one), DATEADD(month, @years * 12 + @months, @one)) >= 0 BEGIN SET @years = @years + @sign; SET @months = 0; END
            END
            ELSE SET @weeks = @r1 + @increment * @sign * @steps;
        END
        ELSE
        BEGIN
            SET @step = CASE @smallest WHEN 'day' THEN @day WHEN 'hour' THEN CAST(3600000000000 AS BIGINT) WHEN 'minute' THEN CAST(60000000000 AS BIGINT) WHEN 'second' THEN 1000000000 WHEN 'millisecond' THEN 1000000 WHEN 'microsecond' THEN 1000 ELSE 1 END * @increment;
            SET @toRound = @days * @day + @t;
            SET @rest = ABS(@toRound % @step);
            SET @rounded = @toRound - @toRound % @step;
            IF @rest <> 0 AND (@um = 'infinity' OR @um LIKE 'half%' AND (2 * @rest > @step OR 2 * @rest = @step AND (@um = 'halfInfinity' OR @um = 'halfEven' AND (@rounded / @step) % 2 <> 0))) SET @rounded = @rounded + @step * @sign;
            SET @days = @rounded / @day;
            SET @t = @rounded - @days * @day;
            IF @rounded / @day <> @toRound / @day
            BEGIN
                IF @largest = 'week'
                BEGIN
                    IF @sign * (CAST(DATEDIFF(day, DATEADD(day, (@weeks + @sign) * 7, @one), @two) AS BIGINT) * @day + @ns2 - @ns1 + @rounded - @toRound) >= 0 BEGIN SET @weeks = @weeks + @sign; SET @days = 0; SET @t = 0; END
                END
                ELSE IF @sign * (CAST(DATEDIFF(day, DATEADD(month, @years * 12 + @months + @sign, @one), @two) AS BIGINT) * @day + @ns2 - @ns1 + @rounded - @toRound) >= 0
                BEGIN
                    SET @days = 0;
                    SET @t = 0;
                    IF @largest = 'year' AND @sign * (CAST(DATEDIFF(day, DATEADD(month, (@years + @sign) * 12, @one), @two) AS BIGINT) * @day + @ns2 - @ns1 + @rounded - @toRound) >= 0 BEGIN SET @years = @years + @sign; SET @months = 0; END
                    ELSE SET @months = @months + @sign;
                END
            END
        END
        RETURN dbo.tsq_duration_text(@years * @negation, @months * @negation, @weeks * @negation, @days * @negation, @t * @negation, 'hour');
    END
    GO
    ```

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

On Oracle, a date before 15 October 1582 is in the Julian calendar: a total counted across that day isn't the one of Temporal (see [Dates before 1582](supported-databases/oracle.md#dates-before-1582)).

### The function `tsq_duration_total`

`total` is computed by `tsq_duration_total`, a function of the library, on every database: it adds the duration to the date of reference and divides with integers, so the `double` is rounded once, as Temporal rounds it. It takes the months of the duration (its years too), its weeks, its days, the whole seconds of its time and the nanoseconds of the second, the year, the month and the day of the date of reference (`0, 0, 0` without one) and the unit. Create it once in the database, as `tsq_duration_part`; without it, the query fails with the error of the database for a function that doesn't exist.

=== "MariaDB"
    ```sql
    DROP FUNCTION IF EXISTS tsq_duration_total;
    DELIMITER //
    CREATE FUNCTION tsq_duration_total(months BIGINT, weeks BIGINT, days BIGINT, seconds BIGINT, nanoseconds BIGINT, y INT, m INT, d INT, unit VARCHAR(11)) RETURNS DOUBLE DETERMINISTIC NO SQL
    BEGIN
        DECLARE v_day DECIMAL(65, 0) DEFAULT 86400000000000;
        DECLARE v_t DECIMAL(65, 0);
        DECLARE v_time_of_day DECIMAL(65, 0);
        DECLARE v_one DATE;
        DECLARE v_two DATE;
        DECLARE v_adjusted DATE;
        DECLARE v_sign INT;
        DECLARE v_k INT;
        DECLARE v_ya INT;
        DECLARE v_ma INT;
        DECLARE v_da INT;
        DECLARE v_r1 INT;
        DECLARE v_start DATE;
        DECLARE v_end DATE;
        DECLARE v_a DECIMAL(65, 0);
        DECLARE v_b DECIMAL(65, 0);
        DECLARE v_x DECIMAL(65, 0);
        DECLARE v_s INT DEFAULT 0;
        DECLARE v_q DECIMAL(65, 0);
        DECLARE v_rest DECIMAL(65, 0);
        DECLARE v_result DOUBLE;
        IF months IS NULL OR weeks IS NULL OR days IS NULL OR seconds IS NULL OR nanoseconds IS NULL OR y IS NULL OR m IS NULL OR d IS NULL OR unit IS NULL THEN RETURN NULL; END IF;
        SET v_t = seconds * CAST(1000000000 AS DECIMAL(65, 0)) + nanoseconds;
        IF m = 0 THEN
            IF months <> 0 OR weeks <> 0 OR unit IN ('year', 'month', 'week') THEN
                SIGNAL SQLSTATE '22023' SET MESSAGE_TEXT = 'tsq_duration_total: a duration with years, months or weeks, or a total in years, months or weeks, needs a date of reference';
            END IF;
            SET v_a = days * v_day + v_t;
        ELSE
            -- The duration added to the date at 00:00: the months, then the weeks, the days and the whole days of the time
            SET v_time_of_day = MOD(v_t, v_day);
            IF v_time_of_day < 0 THEN SET v_time_of_day = v_time_of_day + v_day; END IF;
            SET v_one = DATE_ADD(DATE_ADD(MAKEDATE(y, 1), INTERVAL m - 1 MONTH), INTERVAL d - 1 DAY);
            SET v_two = DATE_ADD(DATE_ADD(v_one, INTERVAL months MONTH), INTERVAL weeks * 7 + days + (v_t - v_time_of_day) DIV v_day DAY);
            IF unit IN ('year', 'month', 'week') THEN
                IF v_two = v_one AND v_time_of_day = 0 THEN RETURN 0; END IF;
                -- The whole units to the end without passing it (as until), and the progress to the next one
                SET v_adjusted = IF(v_time_of_day > 0 AND v_two < v_one, DATE_ADD(v_two, INTERVAL 1 DAY), v_two);
                SET v_sign = IF(DATEDIFF(v_two, v_one) * v_day + v_time_of_day < 0, -1, 1);
                IF unit = 'week' THEN
                    SET v_r1 = DATEDIFF(v_adjusted, v_one) DIV 7;
                ELSE
                    SET v_ya = YEAR(v_adjusted), v_ma = MONTH(v_adjusted), v_da = DAY(v_adjusted);
                    SET v_k = ((v_ya * 12 + v_ma) * 32 + v_da - (y * 12 + m) * 32 - d) DIV 32;
                    SET v_r1 = IF(unit = 'month', v_k, v_k DIV 12);
                END IF;
                SET v_start = IF(unit = 'week', DATE_ADD(v_one, INTERVAL 7 * v_r1 DAY), DATE_ADD(v_one, INTERVAL IF(unit = 'month', v_r1, 12 * v_r1) MONTH));
                SET v_end = IF(unit = 'week', DATE_ADD(v_one, INTERVAL 7 * (v_r1 + v_sign) DAY), DATE_ADD(v_one, INTERVAL IF(unit = 'month', v_r1 + v_sign, 12 * (v_r1 + v_sign)) MONTH));
                IF ABS(DATEDIFF(v_two, v_start) * v_day + v_time_of_day) >= ABS(DATEDIFF(v_end, v_start) * v_day) THEN
                    -- The end beyond the next unit (the day of the date wasn't in the month of the end): from that unit
                    SET v_r1 = v_r1 + v_sign, v_start = v_end;
                    SET v_end = IF(unit = 'week', DATE_ADD(v_one, INTERVAL 7 * (v_r1 + v_sign) DAY), DATE_ADD(v_one, INTERVAL IF(unit = 'month', v_r1 + v_sign, 12 * (v_r1 + v_sign)) MONTH));
                END IF;
                SET v_b = ABS(DATEDIFF(v_end, v_start) * v_day);
                SET v_a = v_r1 * v_b + v_sign * ABS(DATEDIFF(v_two, v_start) * v_day + v_time_of_day);
            ELSE
                SET v_a = DATEDIFF(v_two, v_one) * v_day + v_time_of_day;
            END IF;
        END IF;
        IF unit NOT IN ('year', 'month', 'week') THEN
            SET v_b = CASE unit WHEN 'day' THEN 86400000000000 WHEN 'hour' THEN 3600000000000 WHEN 'minute' THEN 60000000000 WHEN 'second' THEN 1000000000 WHEN 'millisecond' THEN 1000000 WHEN 'microsecond' THEN 1000 ELSE 1 END;
        END IF;
        -- a / b rounded once: the integer q from 2^52 to 2^53 and the exponent s with q * 2^-s the nearest to it
        IF v_a = 0 THEN RETURN 0; END IF;
        SET v_x = ABS(v_a);
        WHILE v_x >= v_b * 9007199254740992 DO
            SET v_b = v_b * 2, v_s = v_s - 1;
        END WHILE;
        WHILE v_x < v_b * 4503599627370496 DO
            SET v_x = v_x * 2, v_s = v_s + 1;
        END WHILE;
        SET v_rest = MOD(v_x, v_b);
        SET v_q = (v_x - v_rest) / v_b;
        IF 2 * v_rest > v_b OR 2 * v_rest = v_b AND MOD(v_q, 2) = 1 THEN SET v_q = v_q + 1; END IF;
        SET v_result = v_q;
        RETURN IF(v_a < 0, -1, 1) * v_result * POW(2, -v_s);
    END
    //
    DELIMITER ;
    ```
=== "MySQL"
    ```sql
    DROP FUNCTION IF EXISTS tsq_duration_total;
    DELIMITER //
    CREATE FUNCTION tsq_duration_total(months BIGINT, weeks BIGINT, days BIGINT, seconds BIGINT, nanoseconds BIGINT, y INT, m INT, d INT, unit VARCHAR(11)) RETURNS DOUBLE DETERMINISTIC NO SQL
    BEGIN
        DECLARE v_day DECIMAL(65, 0) DEFAULT 86400000000000;
        DECLARE v_t DECIMAL(65, 0);
        DECLARE v_time_of_day DECIMAL(65, 0);
        DECLARE v_one DATE;
        DECLARE v_two DATE;
        DECLARE v_adjusted DATE;
        DECLARE v_sign INT;
        DECLARE v_k INT;
        DECLARE v_ya INT;
        DECLARE v_ma INT;
        DECLARE v_da INT;
        DECLARE v_r1 INT;
        DECLARE v_start DATE;
        DECLARE v_end DATE;
        DECLARE v_a DECIMAL(65, 0);
        DECLARE v_b DECIMAL(65, 0);
        DECLARE v_x DECIMAL(65, 0);
        DECLARE v_s INT DEFAULT 0;
        DECLARE v_q DECIMAL(65, 0);
        DECLARE v_rest DECIMAL(65, 0);
        DECLARE v_result DOUBLE;
        IF months IS NULL OR weeks IS NULL OR days IS NULL OR seconds IS NULL OR nanoseconds IS NULL OR y IS NULL OR m IS NULL OR d IS NULL OR unit IS NULL THEN RETURN NULL; END IF;
        SET v_t = seconds * CAST(1000000000 AS DECIMAL(65, 0)) + nanoseconds;
        IF m = 0 THEN
            IF months <> 0 OR weeks <> 0 OR unit IN ('year', 'month', 'week') THEN
                SIGNAL SQLSTATE '22023' SET MESSAGE_TEXT = 'tsq_duration_total: a duration with years, months or weeks, or a total in years, months or weeks, needs a date of reference';
            END IF;
            SET v_a = days * v_day + v_t;
        ELSE
            -- The duration added to the date at 00:00: the months, then the weeks, the days and the whole days of the time
            SET v_time_of_day = MOD(v_t, v_day);
            IF v_time_of_day < 0 THEN SET v_time_of_day = v_time_of_day + v_day; END IF;
            SET v_one = DATE_ADD(DATE_ADD(MAKEDATE(y, 1), INTERVAL m - 1 MONTH), INTERVAL d - 1 DAY);
            SET v_two = DATE_ADD(DATE_ADD(v_one, INTERVAL months MONTH), INTERVAL weeks * 7 + days + (v_t - v_time_of_day) DIV v_day DAY);
            IF unit IN ('year', 'month', 'week') THEN
                IF v_two = v_one AND v_time_of_day = 0 THEN RETURN 0; END IF;
                -- The whole units to the end without passing it (as until), and the progress to the next one
                SET v_adjusted = IF(v_time_of_day > 0 AND v_two < v_one, DATE_ADD(v_two, INTERVAL 1 DAY), v_two);
                SET v_sign = IF(DATEDIFF(v_two, v_one) * v_day + v_time_of_day < 0, -1, 1);
                IF unit = 'week' THEN
                    SET v_r1 = DATEDIFF(v_adjusted, v_one) DIV 7;
                ELSE
                    SET v_ya = YEAR(v_adjusted), v_ma = MONTH(v_adjusted), v_da = DAY(v_adjusted);
                    SET v_k = ((v_ya * 12 + v_ma) * 32 + v_da - (y * 12 + m) * 32 - d) DIV 32;
                    SET v_r1 = IF(unit = 'month', v_k, v_k DIV 12);
                END IF;
                SET v_start = IF(unit = 'week', DATE_ADD(v_one, INTERVAL 7 * v_r1 DAY), DATE_ADD(v_one, INTERVAL IF(unit = 'month', v_r1, 12 * v_r1) MONTH));
                SET v_end = IF(unit = 'week', DATE_ADD(v_one, INTERVAL 7 * (v_r1 + v_sign) DAY), DATE_ADD(v_one, INTERVAL IF(unit = 'month', v_r1 + v_sign, 12 * (v_r1 + v_sign)) MONTH));
                IF ABS(DATEDIFF(v_two, v_start) * v_day + v_time_of_day) >= ABS(DATEDIFF(v_end, v_start) * v_day) THEN
                    -- The end beyond the next unit (the day of the date wasn't in the month of the end): from that unit
                    SET v_r1 = v_r1 + v_sign, v_start = v_end;
                    SET v_end = IF(unit = 'week', DATE_ADD(v_one, INTERVAL 7 * (v_r1 + v_sign) DAY), DATE_ADD(v_one, INTERVAL IF(unit = 'month', v_r1 + v_sign, 12 * (v_r1 + v_sign)) MONTH));
                END IF;
                SET v_b = ABS(DATEDIFF(v_end, v_start) * v_day);
                SET v_a = v_r1 * v_b + v_sign * ABS(DATEDIFF(v_two, v_start) * v_day + v_time_of_day);
            ELSE
                SET v_a = DATEDIFF(v_two, v_one) * v_day + v_time_of_day;
            END IF;
        END IF;
        IF unit NOT IN ('year', 'month', 'week') THEN
            SET v_b = CASE unit WHEN 'day' THEN 86400000000000 WHEN 'hour' THEN 3600000000000 WHEN 'minute' THEN 60000000000 WHEN 'second' THEN 1000000000 WHEN 'millisecond' THEN 1000000 WHEN 'microsecond' THEN 1000 ELSE 1 END;
        END IF;
        -- a / b rounded once: the integer q from 2^52 to 2^53 and the exponent s with q * 2^-s the nearest to it
        IF v_a = 0 THEN RETURN 0; END IF;
        SET v_x = ABS(v_a);
        WHILE v_x >= v_b * 9007199254740992 DO
            SET v_b = v_b * 2, v_s = v_s - 1;
        END WHILE;
        WHILE v_x < v_b * 4503599627370496 DO
            SET v_x = v_x * 2, v_s = v_s + 1;
        END WHILE;
        SET v_rest = MOD(v_x, v_b);
        SET v_q = (v_x - v_rest) / v_b;
        IF 2 * v_rest > v_b OR 2 * v_rest = v_b AND MOD(v_q, 2) = 1 THEN SET v_q = v_q + 1; END IF;
        SET v_result = v_q;
        RETURN IF(v_a < 0, -1, 1) * v_result * POW(2, -v_s);
    END
    //
    DELIMITER ;
    ```
=== "Oracle"
    ```sql
    CREATE OR REPLACE FUNCTION tsq_duration_total(months IN NUMBER, weeks IN NUMBER, days IN NUMBER, seconds IN NUMBER, nanoseconds IN NUMBER, y IN NUMBER, m IN NUMBER, d IN NUMBER, unit IN VARCHAR2) RETURN BINARY_DOUBLE DETERMINISTIC IS
        v_day CONSTANT NUMBER := 86400000000000;
        v_t NUMBER;
        v_time_of_day NUMBER;
        v_one DATE;
        v_two DATE;
        v_adjusted DATE;
        v_sign NUMBER;
        v_k NUMBER;
        v_r1 NUMBER;
        v_start DATE;
        v_end DATE;
        v_a NUMBER;
        v_b NUMBER;
        v_x NUMBER;
        v_s NUMBER := 0;
        v_q NUMBER;
        v_rest NUMBER;
        -- add_months gives the last day of a month to the last day of another: the days it moves past the day are taken back
        FUNCTION plus_months(dt IN DATE, k IN NUMBER) RETURN DATE IS
        BEGIN
            RETURN ADD_MONTHS(dt, k) - GREATEST(0, EXTRACT(DAY FROM ADD_MONTHS(dt, k)) - EXTRACT(DAY FROM dt));
        END;
        -- The date plus a number of weeks, months or years, the day kept in the month
        FUNCTION units_from(n IN NUMBER) RETURN DATE IS
        BEGIN
            RETURN CASE WHEN unit = 'week' THEN v_one + 7 * n ELSE plus_months(v_one, CASE WHEN unit = 'month' THEN n ELSE 12 * n END) END;
        END;
    BEGIN
        IF months IS NULL OR weeks IS NULL OR days IS NULL OR seconds IS NULL OR nanoseconds IS NULL OR y IS NULL OR m IS NULL OR d IS NULL OR unit IS NULL THEN RETURN NULL; END IF;
        v_t := seconds * 1000000000 + nanoseconds;
        IF m = 0 THEN
            IF months <> 0 OR weeks <> 0 OR unit IN ('year', 'month', 'week') THEN
                RAISE_APPLICATION_ERROR(-20001, 'tsq_duration_total: a duration with years, months or weeks, or a total in years, months or weeks, needs a date of reference');
            END IF;
            v_a := days * v_day + v_t;
        ELSE
            -- The duration added to the date at 00:00: the months, then the weeks, the days and the whole days of the time
            v_time_of_day := MOD(v_t, v_day);
            IF v_time_of_day < 0 THEN v_time_of_day := v_time_of_day + v_day; END IF;
            v_one := ADD_MONTHS(DATE '0001-01-01', (y - 1) * 12 + m - 1) + d - 1;
            v_two := plus_months(v_one, months) + weeks * 7 + days + (v_t - v_time_of_day) / v_day;
            IF unit IN ('year', 'month', 'week') THEN
                IF v_two = v_one AND v_time_of_day = 0 THEN RETURN 0; END IF;
                -- The whole units to the end without passing it (as until), and the progress to the next one
                v_adjusted := CASE WHEN v_time_of_day > 0 AND v_two < v_one THEN v_two + 1 ELSE v_two END;
                v_sign := CASE WHEN (v_two - v_one) * v_day + v_time_of_day < 0 THEN -1 ELSE 1 END;
                IF unit = 'week' THEN
                    v_r1 := TRUNC((v_adjusted - v_one) / 7);
                ELSE
                    v_k := TRUNC(((EXTRACT(YEAR FROM v_adjusted) * 12 + EXTRACT(MONTH FROM v_adjusted)) * 32 + EXTRACT(DAY FROM v_adjusted) - (y * 12 + m) * 32 - d) / 32);
                    v_r1 := CASE WHEN unit = 'month' THEN v_k ELSE TRUNC(v_k / 12) END;
                END IF;
                v_start := units_from(v_r1);
                v_end := units_from(v_r1 + v_sign);
                IF ABS((v_two - v_start) * v_day + v_time_of_day) >= ABS((v_end - v_start) * v_day) THEN
                    -- The end beyond the next unit (the day of the date wasn't in the month of the end): from that unit
                    v_r1 := v_r1 + v_sign;
                    v_start := v_end;
                    v_end := units_from(v_r1 + v_sign);
                END IF;
                v_b := ABS((v_end - v_start) * v_day);
                v_a := v_r1 * v_b + v_sign * ABS((v_two - v_start) * v_day + v_time_of_day);
            ELSE
                v_a := (v_two - v_one) * v_day + v_time_of_day;
            END IF;
        END IF;
        IF unit NOT IN ('year', 'month', 'week') THEN
            v_b := CASE unit WHEN 'day' THEN 86400000000000 WHEN 'hour' THEN 3600000000000 WHEN 'minute' THEN 60000000000 WHEN 'second' THEN 1000000000 WHEN 'millisecond' THEN 1000000 WHEN 'microsecond' THEN 1000 ELSE 1 END;
        END IF;
        -- a / b rounded once: the integer q from 2^52 to 2^53 and the exponent s with q * 2^-s the nearest to it
        IF v_a = 0 THEN RETURN 0; END IF;
        v_x := ABS(v_a);
        WHILE v_x >= v_b * 9007199254740992 LOOP
            v_b := v_b * 2;
            v_s := v_s - 1;
        END LOOP;
        WHILE v_x < v_b * 4503599627370496 LOOP
            v_x := v_x * 2;
            v_s := v_s + 1;
        END LOOP;
        v_rest := MOD(v_x, v_b);
        v_q := (v_x - v_rest) / v_b;
        IF 2 * v_rest > v_b OR 2 * v_rest = v_b AND MOD(v_q, 2) = 1 THEN v_q := v_q + 1; END IF;
        RETURN CASE WHEN v_a < 0 THEN -1 ELSE 1 END * TO_BINARY_DOUBLE(v_q) * POWER(2d, -v_s);
    END;
    ```
===+ "PostgreSQL"
    ```sql
    CREATE OR REPLACE FUNCTION tsq_duration_total(months bigint, weeks bigint, days bigint, seconds bigint, nanoseconds bigint, y integer, m integer, d integer, unit text) RETURNS double precision LANGUAGE plpgsql IMMUTABLE STRICT AS $$
    DECLARE
        day_ns CONSTANT numeric := 86400000000000;
        unit_ns CONSTANT numeric := CASE unit WHEN 'day' THEN 86400000000000 WHEN 'hour' THEN 3600000000000 WHEN 'minute' THEN 60000000000 WHEN 'second' THEN 1000000000 WHEN 'millisecond' THEN 1000000 WHEN 'microsecond' THEN 1000 ELSE 1 END;
        t numeric := seconds * 1000000000::numeric + nanoseconds;
        time_of_day numeric;
        one date;
        two date;
        adjusted date;
        sgn integer;
        k integer;
        r1 integer;
        start_day date;
        end_day date;
        a numeric;
        b numeric;
        x numeric;
        s integer := 0;
        q numeric;
        rest numeric;
    BEGIN
        IF m = 0 THEN
            IF months <> 0 OR weeks <> 0 OR unit IN ('year', 'month', 'week') THEN
                RAISE EXCEPTION 'tsq_duration_total: a duration with years, months or weeks, or a total in years, months or weeks, needs a date of reference';
            END IF;
            a := days * day_ns + t;
            b := unit_ns;
        ELSE
            -- The duration added to the date at 00:00: the months, then the weeks, the days and the whole days of the time
            time_of_day := mod(t, day_ns);
            IF time_of_day < 0 THEN
                time_of_day := time_of_day + day_ns;
            END IF;
            one := make_date(y, m, d);
            two := (one + make_interval(months => months::integer))::date + (weeks * 7 + days + (t - time_of_day) / day_ns)::integer;
            IF unit NOT IN ('year', 'month', 'week') THEN
                a := (two - one) * day_ns + time_of_day;
                b := unit_ns;
            ELSE
                IF two = one AND time_of_day = 0 THEN
                    RETURN 0;
                END IF;
                -- The whole units to the end without passing it (as until), and the progress to the next one
                adjusted := CASE WHEN time_of_day > 0 AND two < one THEN two + 1 ELSE two END;
                sgn := CASE WHEN (two - one) * day_ns + time_of_day < 0 THEN -1 ELSE 1 END;
                IF unit = 'week' THEN
                    r1 := (adjusted - one) / 7;
                ELSE
                    k := ((extract(year from adjusted)::integer * 12 + extract(month from adjusted)::integer) * 32 + extract(day from adjusted)::integer - (y * 12 + m) * 32 - d) / 32;
                    r1 := CASE WHEN unit = 'month' THEN k ELSE k / 12 END;
                END IF;
                start_day := CASE WHEN unit = 'week' THEN one + 7 * r1 ELSE (one + make_interval(months => CASE WHEN unit = 'month' THEN r1 ELSE 12 * r1 END))::date END;
                end_day := CASE WHEN unit = 'week' THEN one + 7 * (r1 + sgn) ELSE (one + make_interval(months => CASE WHEN unit = 'month' THEN r1 + sgn ELSE 12 * (r1 + sgn) END))::date END;
                IF abs((two - start_day) * day_ns + time_of_day) >= abs((end_day - start_day) * day_ns) THEN
                    -- The end beyond the next unit (the day of the date wasn't in the month of the end): from that unit
                    r1 := r1 + sgn;
                    start_day := end_day;
                    end_day := CASE WHEN unit = 'week' THEN one + 7 * (r1 + sgn) ELSE (one + make_interval(months => CASE WHEN unit = 'month' THEN r1 + sgn ELSE 12 * (r1 + sgn) END))::date END;
                END IF;
                b := abs((end_day - start_day) * day_ns);
                a := r1 * b + sgn * abs((two - start_day) * day_ns + time_of_day);
            END IF;
        END IF;
        -- a / b rounded once: the integer q from 2^52 to 2^53 and the exponent s with q * 2^-s the nearest to it
        IF a = 0 THEN
            RETURN 0;
        END IF;
        x := abs(a);
        WHILE x >= b * 9007199254740992 LOOP
            b := b * 2;
            s := s - 1;
        END LOOP;
        WHILE x < b * 4503599627370496 LOOP
            x := x * 2;
            s := s + 1;
        END LOOP;
        q := div(x, b);
        rest := x - q * b;
        IF 2 * rest > b OR 2 * rest = b AND mod(q, 2) = 1 THEN
            q := q + 1;
        END IF;
        RETURN CASE WHEN a < 0 THEN -1 ELSE 1 END * q::double precision * power(2::double precision, -s);
    END
    $$;
    ```
=== "SQLite"
    `registerSqliteFunctions` registers it, written in JavaScript, with the other functions of the library: see [The SQL functions of the library](query-runners/recommended/bun_sqlite.md#the-sql-functions-of-the-library). Bun SQL's SQLite has no way to register a function.
=== "SQL Server"
    ```sql
    CREATE OR ALTER FUNCTION dbo.tsq_duration_total(@months BIGINT, @weeks BIGINT, @days BIGINT, @seconds BIGINT, @nanoseconds BIGINT, @y INT, @m INT, @d INT, @unit VARCHAR(11)) RETURNS FLOAT WITH SCHEMABINDING AS
    BEGIN
        IF @months IS NULL OR @weeks IS NULL OR @days IS NULL OR @seconds IS NULL OR @nanoseconds IS NULL OR @y IS NULL OR @m IS NULL OR @d IS NULL OR @unit IS NULL RETURN NULL;
        DECLARE @day DECIMAL(38, 0) = 86400000000000, @t DECIMAL(38, 0) = CAST(@seconds AS DECIMAL(38, 0)) * 1000000000 + @nanoseconds, @timeOfDay DECIMAL(38, 0);
        DECLARE @one DATE, @two DATE, @adjusted DATE, @sign INT, @k INT, @r1 INT, @start DATE, @end DATE;
        DECLARE @a DECIMAL(38, 0), @b DECIMAL(38, 0), @x DECIMAL(38, 0), @s INT = 0, @q DECIMAL(38, 0), @rest DECIMAL(38, 0);
        IF @m = 0
        BEGIN
            IF @months <> 0 OR @weeks <> 0 OR @unit IN ('year', 'month', 'week')
                RETURN CAST('tsq_duration_total: a duration with years, months or weeks, or a total in years, months or weeks, needs a date of reference, unit ' + @unit AS INT);
            SET @a = @days * @day + @t;
        END
        ELSE
        BEGIN
            -- The duration added to the date at 00:00: the months, then the weeks, the days and the whole days of the time
            SET @timeOfDay = @t % @day;
            IF @timeOfDay < 0 SET @timeOfDay = @timeOfDay + @day;
            SET @one = DATEFROMPARTS(@y, @m, @d);
            SET @two = DATEADD(day, CAST(@weeks * 7 + @days + (@t - @timeOfDay) / @day AS INT), DATEADD(month, @months, @one));
            IF @unit IN ('year', 'month', 'week')
            BEGIN
                IF @two = @one AND @timeOfDay = 0 RETURN 0;
                -- The whole units to the end without passing it (as until), and the progress to the next one
                SET @adjusted = CASE WHEN @timeOfDay > 0 AND @two < @one THEN DATEADD(day, 1, @two) ELSE @two END;
                SET @sign = CASE WHEN DATEDIFF(day, @one, @two) * @day + @timeOfDay < 0 THEN -1 ELSE 1 END;
                IF @unit = 'week'
                    SET @r1 = DATEDIFF(day, @one, @adjusted) / 7;
                ELSE
                BEGIN
                    SET @k = ((YEAR(@adjusted) * 12 + MONTH(@adjusted)) * 32 + DAY(@adjusted) - (@y * 12 + @m) * 32 - @d) / 32;
                    SET @r1 = CASE WHEN @unit = 'month' THEN @k ELSE @k / 12 END;
                END
                SET @start = CASE WHEN @unit = 'week' THEN DATEADD(day, 7 * @r1, @one) ELSE DATEADD(month, CASE WHEN @unit = 'month' THEN @r1 ELSE 12 * @r1 END, @one) END;
                SET @end = CASE WHEN @unit = 'week' THEN DATEADD(day, 7 * (@r1 + @sign), @one) ELSE DATEADD(month, CASE WHEN @unit = 'month' THEN @r1 + @sign ELSE 12 * (@r1 + @sign) END, @one) END;
                IF ABS(DATEDIFF(day, @start, @two) * @day + @timeOfDay) >= ABS(DATEDIFF(day, @start, @end) * @day)
                BEGIN
                    -- The end beyond the next unit (the day of the date wasn't in the month of the end): from that unit
                    SET @r1 = @r1 + @sign;
                    SET @start = @end;
                    SET @end = CASE WHEN @unit = 'week' THEN DATEADD(day, 7 * (@r1 + @sign), @one) ELSE DATEADD(month, CASE WHEN @unit = 'month' THEN @r1 + @sign ELSE 12 * (@r1 + @sign) END, @one) END;
                END
                SET @b = ABS(DATEDIFF(day, @start, @end) * @day);
                SET @a = @r1 * @b + @sign * ABS(DATEDIFF(day, @start, @two) * @day + @timeOfDay);
            END
            ELSE
                SET @a = DATEDIFF(day, @one, @two) * @day + @timeOfDay;
        END
        IF @unit NOT IN ('year', 'month', 'week')
            SET @b = CASE @unit WHEN 'day' THEN 86400000000000 WHEN 'hour' THEN 3600000000000 WHEN 'minute' THEN 60000000000 WHEN 'second' THEN 1000000000 WHEN 'millisecond' THEN 1000000 WHEN 'microsecond' THEN 1000 ELSE 1 END;
        -- a / b rounded once: the integer q from 2^52 to 2^53 and the exponent s with q * 2^-s the nearest to it
        IF @a = 0 RETURN 0;
        SET @x = ABS(@a);
        WHILE @x >= @b * 9007199254740992 BEGIN SET @b = @b * 2; SET @s = @s - 1; END
        WHILE @x < @b * 4503599627370496 BEGIN SET @x = @x * 2; SET @s = @s + 1; END
        SET @rest = @x % @b;
        SET @q = (@x - @rest) / @b;
        IF 2 * @rest > @b OR 2 * @rest = @b AND @q % 2 = 1 SET @q = @q + 1;
        RETURN CASE WHEN @a < 0 THEN -1 ELSE 1 END * CAST(@q AS FLOAT) * POWER(CAST(2 AS FLOAT), -@s);
    END
    GO
    ```

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

=== "MariaDB"
    ```sql
    DROP FUNCTION IF EXISTS tsq_duration_add;
    DELIMITER //
    CREATE FUNCTION tsq_duration_add(largest1 INT, days1 BIGINT, seconds1 BIGINT, nanoseconds1 BIGINT, largest2 INT, days2 BIGINT, seconds2 BIGINT, nanoseconds2 BIGINT, sgn INT) RETURNS VARCHAR(100) CHARACTER SET ascii DETERMINISTIC NO SQL
    BEGIN
        DECLARE v_day DECIMAL(65, 0) DEFAULT 86400000000000;
        DECLARE v_largest INT;
        DECLARE v_total DECIMAL(65, 0);
        DECLARE v_days DECIMAL(65, 0) DEFAULT 0;
        IF largest1 IS NULL OR days1 IS NULL OR seconds1 IS NULL OR nanoseconds1 IS NULL OR largest2 IS NULL OR days2 IS NULL OR seconds2 IS NULL OR nanoseconds2 IS NULL OR sgn IS NULL THEN RETURN NULL; END IF;
        SET v_largest = LEAST(largest1, largest2);
        IF v_largest <= 2 THEN
            SIGNAL SQLSTATE '22023' SET MESSAGE_TEXT = 'tsq_duration_add: a duration with years, months or weeks can''t be added nor subtracted';
        END IF;
        SET v_total = (days1 + sgn * days2) * v_day + (seconds1 + sgn * seconds2) * CAST(1000000000 AS DECIMAL(65, 0)) + nanoseconds1 + sgn * nanoseconds2;
        IF v_largest = 3 THEN SET v_days = (v_total - MOD(v_total, v_day)) DIV v_day; END IF;
        RETURN tsq_duration_text(0, 0, 0, v_days, v_total - v_days * v_day, CASE WHEN v_largest <= 4 THEN 'hour' WHEN v_largest = 5 THEN 'minute' ELSE 'second' END);
    END
    //
    DELIMITER ;
    ```
=== "MySQL"
    ```sql
    DROP FUNCTION IF EXISTS tsq_duration_add;
    DELIMITER //
    CREATE FUNCTION tsq_duration_add(largest1 INT, days1 BIGINT, seconds1 BIGINT, nanoseconds1 BIGINT, largest2 INT, days2 BIGINT, seconds2 BIGINT, nanoseconds2 BIGINT, sgn INT) RETURNS VARCHAR(100) CHARACTER SET ascii DETERMINISTIC NO SQL
    BEGIN
        DECLARE v_day DECIMAL(65, 0) DEFAULT 86400000000000;
        DECLARE v_largest INT;
        DECLARE v_total DECIMAL(65, 0);
        DECLARE v_days DECIMAL(65, 0) DEFAULT 0;
        IF largest1 IS NULL OR days1 IS NULL OR seconds1 IS NULL OR nanoseconds1 IS NULL OR largest2 IS NULL OR days2 IS NULL OR seconds2 IS NULL OR nanoseconds2 IS NULL OR sgn IS NULL THEN RETURN NULL; END IF;
        SET v_largest = LEAST(largest1, largest2);
        IF v_largest <= 2 THEN
            SIGNAL SQLSTATE '22023' SET MESSAGE_TEXT = 'tsq_duration_add: a duration with years, months or weeks can''t be added nor subtracted';
        END IF;
        SET v_total = (days1 + sgn * days2) * v_day + (seconds1 + sgn * seconds2) * CAST(1000000000 AS DECIMAL(65, 0)) + nanoseconds1 + sgn * nanoseconds2;
        IF v_largest = 3 THEN SET v_days = (v_total - MOD(v_total, v_day)) DIV v_day; END IF;
        RETURN tsq_duration_text(0, 0, 0, v_days, v_total - v_days * v_day, CASE WHEN v_largest <= 4 THEN 'hour' WHEN v_largest = 5 THEN 'minute' ELSE 'second' END);
    END
    //
    DELIMITER ;
    ```
=== "Oracle"
    ```sql
    CREATE OR REPLACE FUNCTION tsq_duration_add(largest1 IN NUMBER, days1 IN NUMBER, seconds1 IN NUMBER, nanoseconds1 IN NUMBER, largest2 IN NUMBER, days2 IN NUMBER, seconds2 IN NUMBER, nanoseconds2 IN NUMBER, sgn IN NUMBER) RETURN VARCHAR2 DETERMINISTIC IS
        v_day CONSTANT NUMBER := 86400000000000;
        v_largest NUMBER;
        v_total NUMBER;
        v_days NUMBER := 0;
    BEGIN
        IF largest1 IS NULL OR days1 IS NULL OR seconds1 IS NULL OR nanoseconds1 IS NULL OR largest2 IS NULL OR days2 IS NULL OR seconds2 IS NULL OR nanoseconds2 IS NULL OR sgn IS NULL THEN RETURN NULL; END IF;
        v_largest := LEAST(largest1, largest2);
        IF v_largest <= 2 THEN
            RAISE_APPLICATION_ERROR(-20001, 'tsq_duration_add: a duration with years, months or weeks can''t be added nor subtracted');
        END IF;
        v_total := (days1 + sgn * days2) * v_day + (seconds1 + sgn * seconds2) * 1000000000 + nanoseconds1 + sgn * nanoseconds2;
        IF v_largest = 3 THEN v_days := TRUNC(v_total / v_day); END IF;
        RETURN tsq_duration_text(0, 0, 0, v_days, v_total - v_days * v_day, CASE WHEN v_largest <= 4 THEN 'hour' WHEN v_largest = 5 THEN 'minute' ELSE 'second' END);
    END;
    ```
===+ "PostgreSQL"
    ```sql
    CREATE OR REPLACE FUNCTION tsq_duration_add(largest1 bigint, days1 bigint, seconds1 bigint, nanoseconds1 bigint, largest2 bigint, days2 bigint, seconds2 bigint, nanoseconds2 bigint, sgn integer) RETURNS interval LANGUAGE plpgsql IMMUTABLE STRICT AS $$
    DECLARE
        day_ns CONSTANT numeric := 86400000000000;
        largest bigint := least(largest1, largest2);
        total numeric := (days1 + sgn * days2) * day_ns + (seconds1 + sgn * seconds2) * 1000000000::numeric + nanoseconds1 + sgn * nanoseconds2;
        days numeric := 0;
        t numeric;
    BEGIN
        IF largest <= 2 THEN
            RAISE EXCEPTION 'tsq_duration_add: a duration with years, months or weeks can''t be added nor subtracted';
        END IF;
        IF largest = 3 THEN
            days := div(total, day_ns);
        END IF;
        t := total - days * day_ns;
        RETURN make_interval(days => days::integer, secs => div(t, 1000000000)::double precision) + make_interval(secs => mod(t, 1000000000) / 1000000000.0);
    END
    $$;
    ```
=== "SQLite"
    `registerSqliteFunctions` registers it, written in JavaScript, with the other functions of the library: see [The SQL functions of the library](query-runners/recommended/bun_sqlite.md#the-sql-functions-of-the-library). Bun SQL's SQLite has no way to register a function.
=== "SQL Server"
    ```sql
    CREATE OR ALTER FUNCTION dbo.tsq_duration_add(@largest1 INT, @days1 BIGINT, @seconds1 BIGINT, @nanoseconds1 BIGINT, @largest2 INT, @days2 BIGINT, @seconds2 BIGINT, @nanoseconds2 BIGINT, @sign INT) RETURNS VARCHAR(100) WITH SCHEMABINDING AS
    BEGIN
        IF @largest1 IS NULL OR @days1 IS NULL OR @seconds1 IS NULL OR @nanoseconds1 IS NULL OR @largest2 IS NULL OR @days2 IS NULL OR @seconds2 IS NULL OR @nanoseconds2 IS NULL OR @sign IS NULL RETURN NULL;
        DECLARE @day DECIMAL(38, 0) = 86400000000000, @largest INT = CASE WHEN @largest1 < @largest2 THEN @largest1 ELSE @largest2 END, @total DECIMAL(38, 0), @days DECIMAL(38, 0) = 0;
        IF @largest <= 2
            RETURN CAST(CAST('tsq_duration_add: a duration with years, months or weeks can''t be added nor subtracted, sign ' + CAST(@sign AS VARCHAR(2)) AS INT) AS VARCHAR(100));
        SET @total = CAST(@days1 + @sign * @days2 AS DECIMAL(38, 0)) * @day + CAST(@seconds1 + @sign * @seconds2 AS DECIMAL(38, 0)) * 1000000000 + @nanoseconds1 + @sign * @nanoseconds2;
        IF @largest = 3 SET @days = (@total - @total % @day) / @day;
        RETURN dbo.tsq_duration_text(0, 0, 0, @days, @total - @days * @day, CASE WHEN @largest <= 4 THEN 'hour' WHEN @largest = 5 THEN 'minute' ELSE 'second' END);
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
| SQLite | What the [format of its dates](supported-databases/sqlite.md#working-with-date-and-time) says: milliseconds by default | `23:59:58.123` |
| SQL Server | Hundreds of nanoseconds in a `datetime2(7)`, rounded | `23:59:58.1234568` |

An Oracle `TIMESTAMP(9)`, or `TIMESTAMP(9) WITH TIME ZONE`, keeps the nanoseconds. A constant selected as it is comes back as it was sent, with all its digits, unless the database converts it: PostgreSQL and SQL Server round it to the digits of their type.

## Known limits

- **Bun SQL** gives a `timestamp` (PostgreSQL) or a `datetime` (MySQL and MariaDB) as a `Date`, and has no way to give its text: a `plainDateTime` or an `instant` read through it stops at the millisecond. A `date` and a `time` keep all their digits. The other drivers of these databases read every digit.
- **A year before 1.** In Temporal the year before 1 is 0 (1 BC), and the one before it -1. PostgreSQL and Oracle keep these dates, but `year()` gives the year as they number it, with no year 0: -1 for 1 BC and -44 for 44 BC, where the value read is `-000043-03-15`. SQL Server rejects a date before the year 1, and an instant before the year 1.
- **Bun SQL on MySQL 8** sends a text parameter that MySQL converts to a time wrongly (`'10:07:30'` is `00:00:00`): a `plainTime` given as a value and rounded is another time there. A column is read right, and so is every value with the other drivers and with MariaDB.
- **Oracle has no type for a time of the day**: a `plainTime` is kept in a `DATE` or a `TIMESTAMP` on 1970-01-01, as a `localTime` is.
- **A difference of more than 292 years on SQLite**, like `until` of two instants or of two dates and times, has more nanoseconds than its 64-bit integers: the query fails with the error of `tsq_duration_text` or `tsq_duration_total`. The other databases compute it with decimal numbers.
- **An interval of PostgreSQL with fields of different signs**, like `-1 days +02:03:00` or `1 mon -1 days`, can't be a `Temporal.Duration`, whose fields have one sign: reading it is rejected with `INVALID_VALUE_RECEIVED_FROM_DATABASE`. The library never sends one.
- **A column with a zone**, like `timestamptz` on PostgreSQL: a `plainDateTime` reads the date and time it has in the zone of the database. On SQL Server, a `datetimeoffset` is read, and its parts given, in UTC.
