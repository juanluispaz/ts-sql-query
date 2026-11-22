---
search:
  boost: 0.55
---
<!-- doc-code-library-functions -->
# Instants

An `instant` is an exact moment, the same everywhere: when a release was deployed, when a payment was made. It is a `Temporal.Instant`, with nanoseconds. It isn't a date and a time of the day: `2024-01-16T09:30:15Z` is 10:30:15 in Madrid and 18:30:15 in Tokyo, the same instant. A `plainDateTime` is the other way round, a wall clock without a zone, like a meeting at 10:00 wherever you are. A `localDateTime` is also an instant, as a `Date`, which stops at the millisecond.

!!! info "The SQL of this page is the one with the functions of the library"

    Every query of this page shows the SQL it sends with `libraryFunctions = 'installed'`. Without it, the result is the same, and the SQL of some operations is longer: it writes inline what the function computes.

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
        tsq_text_of_instant(deployed_at) as "deployedAt" 
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
- **A column without a zone** keeps the wall clock of the instant in the zone of the database: in UTC, `2024-01-16 09:30:15.123456`. With a [database outside UTC](../advanced/dates-and-times/outside-utc.md#a-database-outside-utc), the database converts it with its session.

| Database | Keeps the instant | Keeps its wall clock |
|---|---|---|
| MariaDB | `TIMESTAMP(6)`, converted with the zone of the session, from 1970 to 2106 (MariaDB 13) | `DATETIME(6)` |
| MySQL | `TIMESTAMP(6)`, converted with the zone of the session, from 1970 to 2038 | `DATETIME(6)` |
| Oracle | `TIMESTAMP(9) WITH TIME ZONE`, or `TIMESTAMP(9) WITH LOCAL TIME ZONE`, converted with the zone of the session | `TIMESTAMP(9)`, `DATE` |
| PostgreSQL | `timestamptz` | `timestamp` |
| SQLite | none: it keeps an instant as it keeps a `localDateTime`, in the [format of its dates](../databases/sqlite/index.md#working-with-date-and-time) | |
| SQL Server | `datetimeoffset(7)` | `datetime2(7)` |

On SQLite a `localdate` format keeps the wall clock of the instant in the zone of the application. With [`sqliteRunsInApplicationTimeZone`](../databases/sqlite/index.md#the-date-functions-and-the-time-zone), the arithmetic of the instant takes it to UTC and back with the modifiers `'utc'` and `'localtime'`; without it, the zone of the application must be UTC.

The [four kinds of temporal column](../advanced/dates-and-times/column-kinds-and-session.md#the-four-kinds-of-temporal-column) explain what each one does with the zone. On MySQL and MariaDB a `TIMESTAMP` rejects an instant outside its range, from `1970-01-01T00:00:01Z` to `2038-01-19T03:14:07Z` on MySQL, and to `2106-02-07T06:28:15Z` on MariaDB 13; a `DATETIME(6)` in UTC also holds the instants before and after it.

## The epoch of an instant, and its date and time

An instant has no year, month or hour of its own: as in Temporal, they depend on the zone they are seen in. Its date and time in the zone of the database, UTC unless you [declare another](../advanced/dates-and-times/outside-utc.md#a-database-outside-utc), are `toPlainDateTime()`, `toPlainDate()` and `toPlainTime()`, which Temporal writes `instant.toZonedDateTimeISO(zone).toPlainDateTime()`; the parts are taken from them, like `toPlainDateTime().hour()`. The other way round, `toInstant()` of a `plainDateTime` is the instant of that wall clock in the zone of the database. `epochMilliseconds()` and `epochNanoseconds()` count from `1970-01-01T00:00:00Z`, as Temporal's: the milliseconds as a number, rounded down, also before 1970, and the nanoseconds as a `bigint`.

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
        tsq_text_of_date(trunc(cast(cast(deployed_at as timestamp(9) with time zone) at local as timestamp(9)))) as "deployedOn", 
        (trunc(timestamp '1970-01-01 00:00:00' + (deployed_at - timestamp '1970-01-01 00:00:00')) - date '1970-01-01') * 86400000 + to_number(to_char(timestamp '1970-01-01 00:00:00' + (deployed_at - timestamp '1970-01-01 00:00:00'), 'SSSSSFF3')) as "deployedMs", 
        tsq_text_of_instant(published_at) as "published" 
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
        tsq_utc_of_epoch(floor(timestampdiff(microsecond, '1970-01-01 00:00:00', deployed_at) / 1000), 1000000) as sameInstant 
    from project_release 
    where deployed_at < ? 
    order by version
    ```
=== "MySQL"
    ```mysql
    select 
        version as version, 
        deployed_at as deployedAt, 
        tsq_utc_of_epoch(floor(timestampdiff(microsecond, '1970-01-01 00:00:00', deployed_at) / 1000), 1000000) as sameInstant 
    from project_release 
    where deployed_at < ? 
    order by version
    ```
=== "Oracle"
    ```oracle
    select 
        version as "version", 
        tsq_text_of_instant(deployed_at) as "deployedAt", 
        tsq_text_of_utc(tsq_utc_of_epoch((trunc(timestamp '1970-01-01 00:00:00' + (deployed_at - timestamp '1970-01-01 00:00:00')) - date '1970-01-01') * 86400000 + to_number(to_char(timestamp '1970-01-01 00:00:00' + (deployed_at - timestamp '1970-01-01 00:00:00'), 'SSSSSFF3')), 1000000)) as "sameInstant" 
    from project_release 
    where deployed_at < to_timestamp(:0, 'YYYY-MM-DD HH24:MI:SS.FF9 BC', 'NLS_DATE_LANGUAGE=AMERICAN') 
    order by "version"
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        version as version, 
        deployed_at as "deployedAt", 
        tsq_utc_of_epoch(cast(floor(extract(epoch from deployed_at) * 1000) as bigint), 1000000) as "sameInstant" 
    from project_release 
    where deployed_at < $1 
    order by version
    ```
=== "SQLite"
    ```sqlite
    select 
        version as version, 
        deployed_at as deployedAt, 
        strftime('%Y-%m-%dT%H:%M:%fZ', tsq_utc_of_epoch(cast(round(unixepoch(deployed_at, 'subsec') * 1000) as text), 1000000)) as sameInstant 
    from project_release 
    where deployed_at < ?1 
    order by version
    ```
=== "SQL Server"
    ```sqlserver
    select 
        version as version, 
        deployed_at as deployedAt, 
        dbo.tsq_utc_of_epoch(cast(datediff_big(millisecond, '1970-01-01 00:00:00', deployed_at) as bigint), 1000000) as sameInstant 
    from project_release 
    where deployed_at < @0 
    order by version
    ```

The parameters are: `[ Instant 2024-01-16T10:13:20Z ]` (on SQLite: `[ '2024-01-16T10:13:20.000Z' ]`)

| version | deployedAt | sameInstant |
|---|---|---|
| `'1.2.0'` | `2024-01-16T09:30:15.123456Z` (on SQLite: `2024-01-16T09:30:15.123Z`) | `2024-01-16T09:30:15.123Z` |

`epochNanoseconds()` holds every instant on PostgreSQL, MariaDB, MySQL and Oracle, which compute it as a decimal. On SQL Server and SQLite it is a 64-bit integer, so an instant before 1678 or after 2262 makes the query fail. SQLite keeps an instant to the millisecond, and its drivers give an integer beyond 2^53, like the nanoseconds of today, as a rounded number unless their big-integer mode is on: the library then rejects reading it with `PRECISION_LOST_RECEIVING_VALUE_FROM_DATABASE`, and the value can still be compared in the query.

## The arithmetic of an instant

An instant has Temporal's arithmetic, with the units of the time alone, since without a zone a day has no fixed length:

- `add` and `subtract` take a `Temporal.Duration` or its fields, of hours and smaller units: `add({ hours: 48 })`. A duration with days, weeks, months or years is rejected before the query is sent, as Temporal rejects it. They also take a duration of the query, like a column: `add(tRelease.rolloutTime)`. Its value is only known by the database, so the query fails when it has days, weeks, months or years. An interval of Oracle keeps `PT48H` as 2 days, so it fails there too; PostgreSQL's interval and a duration kept as text keep its hours. A field of the time can also be an `int` of the query, like a column (see [A field of the duration from the query](plain-dates-and-times.md#a-field-of-the-duration-from-the-query)); a field of days or more doesn't compile.
- `until` and `since` give the duration to or from another instant, in seconds and smaller units by default: `largestUnit` asks for minutes or hours, and `smallestUnit`, `roundingIncrement` and `roundingMode` round it, as for a [date and time](plain-dates-and-times.md#the-options-of-until-and-since).
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
        tsq_duration_text(0, 0, 0, 0, 0, 0, cast(-timestampdiff(microsecond, deployed_at, published_at) as decimal(65)) * 1000, 'hour') as afterPublishing, 
        date_add(date(deployed_at), interval tsq_round_to((floor(time_to_sec(deployed_at)) * 1000000 + microsecond(deployed_at)), 3600000000, 'trunc') microsecond) as hour, 
        date_add(date_add(date(deployed_at), interval tsq_round_to((floor(time_to_sec(deployed_at)) * 1000000 + microsecond(deployed_at)), 3600000000, 'ceil') microsecond), interval ? microsecond) as reviewBy 
    from project_release 
    where deployed_at is not null 
    order by version
    ```
=== "MySQL"
    ```mysql
    select 
        version as version, 
        tsq_duration_text(0, 0, 0, 0, 0, 0, cast(-timestampdiff(microsecond, deployed_at, published_at) as decimal(65)) * 1000, 'hour') as afterPublishing, 
        date_add(date(deployed_at), interval tsq_round_to((floor(time_to_sec(deployed_at)) * 1000000 + microsecond(deployed_at)), 3600000000, 'trunc') microsecond) as hour, 
        date_add(date_add(date(deployed_at), interval tsq_round_to((floor(time_to_sec(deployed_at)) * 1000000 + microsecond(deployed_at)), 3600000000, 'ceil') microsecond), interval ? microsecond) as reviewBy 
    from project_release 
    where deployed_at is not null 
    order by version
    ```
=== "Oracle"
    ```oracle
    select 
        version as "version", 
        tsq_duration_text(0, 0, 0, 0, 0, 0, -tsq_nanoseconds_between(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone)), sys_extract_utc(cast(published_at as timestamp(9) with time zone))), 'hour') as "afterPublishing", 
        tsq_text_of_utc(tsq_datetime_round(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone)), 3600000000000, 'trunc')) as "hour", 
        tsq_text_of_utc(tsq_datetime_round(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone)), 3600000000000, 'ceil') + numtodsinterval(:0, 'second')) as "reviewBy" 
    from project_release 
    where deployed_at is not null 
    order by "version"
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        version as version, 
        (extract(epoch from deployed_at - published_at) || ' seconds')::interval as "afterPublishing", 
        date_bin(interval '1 hours', deployed_at, date_trunc('day', deployed_at)) as hour, 
        date_bin(interval '1 hours', deployed_at + interval '1 hours' - interval '1 microsecond', date_trunc('day', deployed_at)) + $1::interval as "reviewBy" 
    from project_release 
    where deployed_at is not null 
    order by version
    ```
=== "SQLite"
    ```sqlite
    select 
        version as version, 
        tsq_duration_text(0, 0, 0, 0, 0, 0, cast(-cast(round((julianday(published_at) - julianday(deployed_at)) * 86400000) as integer) * 1000000 as text), 'hour') as afterPublishing, 
        strftime('%Y-%m-%dT%H:%M:%fZ', date(deployed_at), ((cast(tsq_round_to(cast(cast(round((julianday(deployed_at) - julianday(date(deployed_at))) * 86400000) as integer) as text), 3600000, 'trunc') as integer)) / 1000.0) || ' seconds') as hour, 
        strftime('%Y-%m-%dT%H:%M:%fZ', strftime('%Y-%m-%dT%H:%M:%fZ', date(deployed_at), ((cast(tsq_round_to(cast(cast(round((julianday(deployed_at) - julianday(date(deployed_at))) * 86400000) as integer) as text), 3600000, 'ceil') as integer)) / 1000.0) || ' seconds'), ?1) as reviewBy 
    from project_release 
    where deployed_at is not null 
    order by version
    ```
=== "SQL Server"
    ```sqlserver
    select 
        version as version, 
        dbo.tsq_duration_text(0, 0, 0, 0, 0, 0, cast(-dbo.tsq_ticks_between(cast(switchoffset(deployed_at, '+00:00') as datetime2), cast(switchoffset(published_at, '+00:00') as datetime2)) as decimal(38)) * 100, 'hour') as afterPublishing, 
        dbo.tsq_datetime_round(cast(switchoffset(deployed_at, '+00:00') as datetime2), 36000000000, 'trunc') as hour, 
        dateadd(day, @0, dbo.tsq_datetime_round(cast(switchoffset(deployed_at, '+00:00') as datetime2), 36000000000, 'ceil')) as reviewBy 
    from project_release 
    where deployed_at is not null 
    order by version
    ```

The parameters are: `[ Duration PT172800S ]` (on MariaDB and MySQL: `[ 172800000000n ]`; on Oracle: `[ 172800n ]`; on SQLite: `[ '172800 seconds' ]`; on SQL Server: `[ 2 ]`)

| version | afterPublishing | hour | reviewBy |
|---|---|---|---|
| `'0.9.0'` | `PT5M` | `2024-03-02T11:00:00Z` | `2024-03-04T12:00:00Z` |
| `'1.2.0'` | `PT30M15.123456S` (on SQLite: `PT30M15.123S`) | `2024-01-16T09:00:00Z` | `2024-01-18T10:00:00Z` |

The arithmetic is computed on the wall clock of the instant in UTC, where there is no summer time, also with a [database outside UTC](../advanced/dates-and-times/outside-utc.md#a-database-outside-utc).

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
    select tsq_text_of_instant(systimestamp) as "result" 
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
