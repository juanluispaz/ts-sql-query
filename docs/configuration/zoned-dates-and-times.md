---
search:
  boost: 0.55
---
<!-- doc-code-library-functions -->
# Zoned dates and times

A `zonedDateTime` is an exact moment seen in a time zone: a `Temporal.ZonedDateTime`, an instant with its zone, an IANA name like `Europe/Madrid` or an offset like `+05:30`. The zone gives it its date and time there, and its rules: when a wall clock is repeated or skipped by a change to summer time. Use it where the zone is part of the value, like the start of a meeting that must stay at 09:00 in Madrid. An `instant` is the same moment without a zone, and a `plainDateTime` a wall clock without one.

!!! info "The SQL of this page is the one with the functions of the library"

    Every query of this page shows the SQL it sends with `libraryFunctions = 'installed'`. Without it, the result is the same, and the SQL of some operations is longer: it writes inline what the function computes.

Oracle and PostgreSQL compute with the rules of the zones, the ones of the time zone data of the database, which may be older than the ones of Temporal in the application (the data of Oracle 21 has no summer time in Egypt in 2023). Oracle also keeps a zone with each value, in a `TIMESTAMP WITH TIME ZONE`, so a column can be a `zonedDateTime`. PostgreSQL keeps an instant without its zone (a `timestamptz`), so there a column keeps a zoned date and time as its text, which PostgreSQL computes with the rules of its zone, or the query computes one from an instant and a zone: the instant of a column in the zone the query gives it, from a column or a value (the instant in a `timestamptz` and the zone in a `text`). MariaDB, MySQL, SQLite and SQL Server keep it as its text too, which gives its parts and its instant (see [How each database keeps a zoned date and time](../advanced/dates-and-times/storage.md#how-each-database-keeps-a-zoned-date-and-time)); what computes with the rules of the zones, like the queries below, doesn't compile there, because the zones of these databases give other results than Temporal's (see [Computing with the zones on the other databases](#computing-with-the-zones-on-the-other-databases)).

An instant goes to a zone with `toZonedDateTimeISO(zone)`, and a wall clock with `toZonedDateTime(zone)`, as in Temporal. A wall clock that the zone repeats (02:30 on 2024-10-27 in Madrid) or skips (02:30 on 2024-03-31) takes the instant `disambiguation` says, as Temporal: `'compatible'`, the default, the earlier of a repeated one and the later of a skipped one (03:30), `'earlier'` and `'later'` what they say, and `'reject'` makes the query fail. That takes a function of the library; without it, a wall clock the zone repeats is the later instant, and on Oracle one it skips makes the query fail (see [A wall clock the zone repeats or skips](#a-wall-clock-the-zone-repeats-or-skips)). Here, the deployments and the publications of the releases in Madrid:

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
        tsq_text_of_zoned(from_tz(sys_extract_utc(cast(deployed_at as timestamp(9) with time zone)), '+00:00') at time zone 'Europe/Madrid') as "deployedInMadrid", 
        tsq_text_of_zoned(tsq_zoned_of_wall(cast(published_at as timestamp(9)), 'Europe/Madrid', 'compatible')) as "publishedInMadrid", 
        tsq_text_of_instant((tsq_zoned_of_wall(cast(published_at as timestamp(9)), 'Europe/Madrid', 'compatible'))) as "publishedInstant" 
    from project_release 
    order by "version"
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        version as version, 
        to_char((deployed_at::timestamptz) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z" BC') || '[Europe/Madrid]' as "deployedInMadrid", 
        to_char((tsq_zoned_of_wall(published_at, 'Europe/Madrid', 'compatible')) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z" BC') || '[Europe/Madrid]' as "publishedInMadrid", 
        (tsq_zoned_of_wall(published_at, 'Europe/Madrid', 'compatible')) as "publishedInstant" 
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

On PostgreSQL the query knows the zone of a zoned date and time from what computes it: `toZonedDateTimeISO`, `toZonedDateTime`, `withTimeZone`, a value, the text of a column, and the arithmetic below, which keeps the zone it starts from. A zoned date and time of another expression, like `valueWhenNull` of two of them, a `case`, an aggregate or a column of a subquery, may have a zone in each row the query doesn't know: its instant and its comparisons work, but reading it, its parts or its arithmetic fail when the query is built (`UNSUPPORTED_QUERY`). Inside an aggregated array it is read with its zone, but for the zone of the text of a column in an aggregated array with `distinct`, an order by, a limit or an offset, which fails when the query is built. Its value has the digits of a `timestamptz`, up to the microsecond, also with Bun SQL.

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

## How each database keeps it

Oracle keeps a zoned date and time in a `TIMESTAMP WITH TIME ZONE`, with its zone. The other databases keep it as its text, like `2024-03-02T12:05:00+01:00[Europe/Madrid]`, in a column like `varchar(100)`; on PostgreSQL a query can also compute one from an instant and a zone. A comparison of a column of text computes the instant of each row, so an index of the column isn't used for it. The detail, and how to declare a column of text on Oracle, is in [How each database keeps a zoned date and time](../advanced/dates-and-times/storage.md#how-each-database-keeps-a-zoned-date-and-time).


## Computing with the zones on the other databases

Taking an instant or a wall clock to a zone, changing the zone of a zoned date and time and its arithmetic (`toZonedDateTimeISO`, `toZonedDateTime`, `withTimeZone`, `add`, `subtract`, `with`, `withPlainTime`, `startOfDay`, `hoursInDay`, `round`, `until`, `since`) are offered only on Oracle and PostgreSQL. On MariaDB, MySQL, SQLite and SQL Server they don't compile, because what these databases have gives other results than Temporal's, without an error:

| Database | What it has | Where it differs from Temporal |
|---|---|---|
| MariaDB, MySQL | `convert_tz`, with the time zone tables loaded in the server | A value before 1970 is left unconverted; after 2037 the summer time is lost (MySQL 8 and later, MariaDB 13) or the value is left unconverted; a wall clock the zone skips goes to the start of the change; an unknown zone gives `null` |
| SQL Server | `AT TIME ZONE`, with the names of the zones of Windows | The rules of today are applied to the past (1969 in Madrid is `+02:00`, `+01:00` in Temporal), and the zones of Windows merge several of IANA (Paris and Brussels take the history of Madrid) |
| SQLite | No zones | — |

On these databases, keep the instant in a column of its own and the zone in another, or the zoned date and time as its text, and compute with the zones in the application, with Temporal: read the instant and the zone and take it to its zone with `toZonedDateTimeISO(zone)`. The instant in a column of its own is also what an index serves for its comparisons.

## The arithmetic of a zoned date and time

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
        tsq_text_of_zoned(tsq_zoned_plus_date(tsq_zoned_of_wall(cast(published_at as timestamp(9)), 'Europe/Madrid', 'compatible'), 0, :0, 0)) as "followUp", 
        tsq_zoned_until(tsq_zoned_of_wall(cast(published_at as timestamp(9)), 'Europe/Madrid', 'compatible'), tsq_zoned_plus_date(tsq_zoned_of_wall(cast(published_at as timestamp(9)), 'Europe/Madrid', 'compatible'), 0, :1, 0), 'day', 'nanosecond', 1, 'trunc', 1) as "daysToFollowUp", 
        tsq_duration_text(0, 0, 0, 0, tsq_nanoseconds_between(sys_extract_utc(tsq_zoned_of_wall(cast(published_at as timestamp(9)), 'Europe/Madrid', 'compatible')), sys_extract_utc(tsq_zoned_plus_date(tsq_zoned_of_wall(cast(published_at as timestamp(9)), 'Europe/Madrid', 'compatible'), 0, :2, 0))), 'hour') as "hoursToFollowUp", 
        tsq_zoned_hours_in_day(tsq_zoned_plus_date(tsq_zoned_of_wall(cast(published_at as timestamp(9)), 'Europe/Madrid', 'compatible'), 0, :3, 0)) as "hoursInThatDay" 
    from project_release 
    order by "version"
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        version as version, 
        to_char((tsq_zoned_plus_date(tsq_zoned_of_wall(published_at, 'Europe/Madrid', 'compatible'), 'Europe/Madrid', 0, $1, 0)) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z" BC') || '[Europe/Madrid]' as "followUp", 
        tsq_zoned_until(tsq_zoned_of_wall(published_at, 'Europe/Madrid', 'compatible'), 'Europe/Madrid', tsq_zoned_plus_date(tsq_zoned_of_wall(published_at, 'Europe/Madrid', 'compatible'), 'Europe/Madrid', 0, $2, 0), 'Europe/Madrid', 'day', 'nanosecond', 1, 'trunc', 1) as "daysToFollowUp", 
        (extract(epoch from ((tsq_zoned_plus_date(tsq_zoned_of_wall(published_at, 'Europe/Madrid', 'compatible'), 'Europe/Madrid', 0, $3, 0)) at time zone 'UTC') - ((tsq_zoned_of_wall(published_at, 'Europe/Madrid', 'compatible')) at time zone 'UTC')) || ' seconds')::interval as "hoursToFollowUp", 
        tsq_zoned_hours_in_day(tsq_zoned_plus_date(tsq_zoned_of_wall(published_at, 'Europe/Madrid', 'compatible'), 'Europe/Madrid', 0, $4, 0), 'Europe/Madrid') as "hoursInThatDay" 
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

The parameters are: `[ 29, 29, 29, 29 ]`

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

Without the functions of the library, every wall clock these methods take back to the zone that the zone repeats is the later instant, and on Oracle one it skips makes the query fail (see the next section).

Temporal's `getTimeZoneTransition` has no equivalent: neither database gives a way to find the changes of offset of a zone. A zoned date and time is always in the ISO calendar.

On Oracle a `duration` of the query kept in an `INTERVAL DAY TO SECOND` has 24 hours as a day (`PT28H` is kept as `P1DT4H`, and read so): added to a zoned date and time, that day is a day of the calendar, as for the value read. PostgreSQL's interval keeps its days and its time apart, as Temporal.

## A wall clock the zone repeats or skips

Without the functions of the library, a query takes a wall clock to its zone as the database itself does. PostgreSQL (`timestamp at time zone`) moves one the zone skips forward, as Temporal, and takes the later instant of one it repeats, where Temporal's `'compatible'` takes the earlier one. Oracle (`from_tz`) takes the later instant too, and fails for one the zone skips, with `ORA-01878`. So, by default, `toZonedDateTime(zone)` and `toZonedDateTime(zone, { disambiguation: 'later' })` of 02:30 on 2024-10-27 in Madrid are `2024-10-27T02:30:00+01:00[Europe/Madrid]` (01:30 in UTC), `add({ days: 1 })` of `2024-10-26T02:30:00+02:00[Europe/Madrid]` gives that same instant, and `startOfDay()` of a day whose midnight the zone repeats (2012-11-04 in Havana) is the second midnight; on Oracle `toZonedDateTime('Europe/Madrid')` of 02:30 on 2024-03-31, which Madrid skips, makes the query fail. `disambiguation: 'earlier'` and `'reject'` fail when the query is built, with `UNSUPPORTED_QUERY`, and nothing is sent. Every other day and hour is Temporal's.

With the function of the library `tsq_zoned_of_wall` in the database (its code is in [Oracle functions](../databases/oracle/functions.md#tsq_zoned_of_wall) and [PostgreSQL functions](../databases/postgresql/functions.md#tsq_zoned_of_wall)), set `libraryFunctions` to `'installed'` on the connection (`OracleConnection` or `PostgreSqlConnection`), and every disambiguation is Temporal's: the same three are `2024-10-27T02:30:00+02:00[Europe/Madrid]` (00:30 in UTC) and Havana's first midnight, and a wall clock the zone skips is moved forward, at the cost of a call to the function in each wall clock taken to its zone. Its default is `'not installed'`.

```ts
import { PostgreSqlConnection } from 'ts-sql-query/postgresql'

class DBConnection extends PostgreSqlConnection<'DBConnection'> {
    protected override libraryFunctions = 'installed' as const
}
```

## The functions of the library it uses

Some operations of this page need functions of the library in the database; without them, the query fails with the error of the database for a function that doesn't exist. Create them once with the file of SQL of your database ([MariaDB](../databases/mariadb/functions.md), [MySQL](../databases/mysql/functions.md), [Oracle](../databases/oracle/functions.md), [PostgreSQL](../databases/postgresql/functions.md), [SQLite](../databases/sqlite/functions.md), [SQL Server](../databases/sqlserver/functions.md)), and on SQLite register them with `registerSqliteFunctions` of the query runner; that page also says how each one computes.

| Operation | Function | Databases |
|---|---|---|
| `until` and `since` in days or larger units | `tsq_zoned_until` and `tsq_zoned_of_wall`, and `tsq_duration_text` on Oracle | Oracle, PostgreSQL |

Two zoned dates and times in different zones make `tsq_zoned_until` fail (`ORA-20001` on Oracle).

With `libraryFunctions = 'installed'` on the connection, a query also calls the optional functions of the library, and its SQL is shorter; the result is the same.
