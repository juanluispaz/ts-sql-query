---
search:
  boost: 0.55
---
# Time zones

A JavaScript `Date` is an **instant**: a single number, milliseconds since the epoch. It is not "half past twelve"; it is a fixed point on the world's timeline that *happens to be* half past twelve if you look at it from a particular place.

Many temporal columns are not instants. `TIMESTAMP` / `DATETIME` stores a **wall clock**: the characters `2024-01-14 12:30:00`, and nothing else. It doesn't record whether that is half past twelve in Madrid or in Tokyo, two instants hours apart. So turning that column into a `Date` needs a zone, and the column doesn't supply one.

ts-sql-query answers that with one rule: **every value in the database is in UTC.** The digits of a column without zone are the UTC digits of the `Date`, when it's sent and when it's read, whatever zone your application runs in. This page answers:

- What `Date` you receive for each data type, and which getters to read it with.
- What still depends on a zone: the zone of the database, which must be UTC, and the zone of the session, which must stay the database's.
- What each driver needs from its connection, the limits that remain, and what to do with data already written in another zone.

!!! tip "A Temporal value has no zone to keep in mind"

    With the `plainDate`, `plainTime` and `plainDateTime` types the value in your code is a `Temporal.PlainDate`, a `Temporal.PlainTime` or a `Temporal.PlainDateTime`: the digits of the column, not an instant, so no zone of your application takes part and there are no getters to choose. The zone of the database still says what a column with a zone, like `timestamptz`, gives: the date and time it has in that zone. See [Dates and times](dates-and-times.md).

It is not about collations, the other setting of a session: see [Collations & case sensitivity](collations.md). On SQLite the library writes and reads the text or the number itself, with the strategy you choose; see [SQLite → Working with Date and Time](../databases/sqlite/index.md#working-with-date-and-time).

## The rule: every value in the database is in UTC

| Data type | What you read | What is stored when you send a `Date` |
|---|---|---|
| `localDate` | A `Date` at 10:00 UTC of the stored day | The day of its UTC getters |
| `localTime` | A `Date` on 1970-01-01 whose UTC getters are the stored time | The time of its UTC getters |
| `localDateTime`, in a column without zone | A `Date` whose UTC getters are the stored digits | The digits of its UTC getters |
| `localDateTime`, in a column with zone, like `timestamptz` | The instant | The instant |

On SQLite the [strategy of dates](../databases/sqlite/index.md#working-with-date-and-time) decides. With a `localdate` strategy, the default, a `localTime` and a `localDateTime` are in the zone of the application: the stored text is in their **local** getters, and a `Date` is stored with its local getters, so `2024-01-14 12:30:00.000` is read in `Europe/Madrid` as `2024-01-14T11:30:00.000Z`. The `UTC` and numeric strategies follow the rule. A `localDate` is at 10:00 UTC of its day on SQLite too.

The same holds for a value inside an [aggregated array](../queries/aggregate-as-object-array.md), for a `Date` compared with a column, and for a value you read and send back: it finds its row and stores the same digits.

A `timestamp` column holding `2024-01-14 12:30:00`, read with the process in three zones:

```
TZ=UTC               value.toISOString() = 2024-01-14T12:30:00.000Z   getUTCHours() = 12   getHours() = 12
TZ=Europe/Madrid     value.toISOString() = 2024-01-14T12:30:00.000Z   getUTCHours() = 12   getHours() = 13
TZ=America/New_York  value.toISOString() = 2024-01-14T12:30:00.000Z   getUTCHours() = 12   getHours() = 7
```

The `Date` is the same in every zone. Only the local getters of JavaScript change, because they convert the instant to the zone of the process.

Sending works the other way round. These two `Date`s, inserted from a process in `Europe/Madrid`:

```ts
new Date(Date.UTC(2024, 0, 14, 9, 15))   // stored as 2024-01-14 09:15:00, in any zone
new Date(2024, 0, 14, 9, 15)             // 09:15 in Madrid is 08:15 UTC: stored as 2024-01-14 08:15:00
```

The local constructor of `Date`, `new Date(2024, 0, 14, 9, 15)`, builds 09:15 *in the zone of the process*, so what is stored depends on where the code runs. Build the values with `Date.UTC(...)`, or from a text with a `Z`, like `new Date('2024-01-14T09:15:00Z')`.

## The four kinds of temporal column

What the library does is the same for all of them. They differ in what the **engine** does with the value, and that decides whether the database session's zone takes part.

### 1. No time-zone handling at all

The value is a wall clock, stored and returned verbatim. The engine never converts it, and the session zone doesn't touch it. This is the most common kind. With the rule above, the library stores and reads its digits as UTC.

Verified on PostgreSQL: the session zone has no effect on a `timestamp` column:

```
session UTC      2024-01-14 12:30:00
session Madrid   2024-01-14 12:30:00
session Tokyo    2024-01-14 12:30:00
```

### 2. Pinned to a zone, delivered without it

The column stores a normalized instant, and the engine converts on the way in and out **using the session's zone**, but what it hands the client is a bare wall clock. `TIMESTAMP` on MySQL and MariaDB works this way, and so does Oracle's `TIMESTAMP WITH LOCAL TIME ZONE`.

The library sends and reads the wall clock as UTC, so the value is right only when the session is in UTC. With the session in another zone, the engine converts the UTC digits as if they were in that zone, and the instant it stores is wrong by the offset.

### 3. Pinned to a zone, delivered with it

Same storage as kind 2, one normalized instant, but the value reaches the client **qualified**, so it identifies its own instant. PostgreSQL's `timestamptz` is the only type among the supported databases that does this. The same session, the same instant, two columns:

```
timestamptz  ->  2024-01-14 12:30:00+00
timestamp    ->  2024-01-14 12:30:00
```

The name surprises people: insert `12:30+05` and the `+05` is *gone*, because the value is normalized on the way in and re-rendered through the session zone on the way out:

```
insert  2024-01-14 12:30:00+05

session UTC      2024-01-14 07:30:00+00
session Madrid   2024-01-14 08:30:00+01
session Tokyo    2024-01-14 16:30:00+09
```

All three lines are the **same instant**, and that instant is what a `localDateTime` reads.

### 4. The zone stored with each value

The column keeps the zone or offset each value was written with, so rows can carry different zones at once. Verified on Oracle, two rows, two zones, each preserved:

```
2024-01-14 12:30 +05:00
2024-01-14 12:30 -08:00
```

A `localDateTime` reads the instant of each one: `2024-01-14 18:15:30.123 +09:00` is read as `2024-01-14T09:15:30.123Z`. The offset it was written with doesn't come back, because a `Date` has none: the drivers deliver this column as kind 3. oracledb (Thin mode) and tedious, the driver of mssql, discard the zone of an Oracle `TIMESTAMP WITH TIME ZONE` and of a SQL Server `datetimeoffset` when they decode the value, before the library sees it, and keep the time to the millisecond. A PostgreSQL `timetz` arrives as text with its offset, like `19:30:15.123+09`.

So a column of kind 4 works as a `localDateTime` as long as its instant is what you need, knowing what happens when you write it:

- **A value written from a `Date` is stored in UTC**: a row with `2024-01-14 17:30:15.123 +05:00` updated with the same instant keeps the instant and becomes `2024-01-14 12:30:15.123 +00:00`. The zone it had is lost.
- **A value assigned from another column** (`set a = b`) keeps the zone of that column, because it doesn't go through a `Date`.

When the zone is part of the value you need, keep the value as text: the database gives the column as text with its zone, and converts the text you send. On Oracle `to_char(<column>, 'YYYY-MM-DD"T"HH24:MI:SS.FF9TZH:TZM')` gives `2024-01-14T19:30:15.123456000+09:00`, or the name of the region with `TZR` instead of `TZH:TZM`, like `EUROPE/MADRID`, and `to_timestamp_tz(<text>, 'YYYY-MM-DD"T"HH24:MI:SS.FF TZR')` reads an offset (`2024-01-14T19:30:15.123+09:00`) or a region (`2024-07-01T19:30:15.123 Europe/Madrid`); on SQL Server `convert(nvarchar(40), <column>, 126)` gives `2024-01-14T19:30:15.1234567+09:00`, and `cast(<text> as datetimeoffset)` reads it. The text keeps the zone and the whole fraction of a second. A [type adapter](../advanced/data-types/type-adapters.md) on the column writes that SQL in every query, with `transformProjection` for the value read and `transformPlaceholder` for the value sent, and the value in your code is the text; the column still compares and orders by the instant: see [A date and time with its time zone](../databases/oracle/index.md#a-date-and-time-with-its-time-zone) on Oracle and [A date and time with its offset](../databases/sqlserver/index.md#a-date-and-time-with-its-offset) on SQL Server. In a single query, a [fragment](../queries/sql-fragments.md) of type `string` with the same SQL reads the text too. If you only need to show a value in the zone it belongs to, keep the name of that zone in a column of its own, next to the instant.

!!! warning "This is not the safest option: it buys a different set of problems"

    Once values from several zones coexist in one column you inherit questions the other kinds never raise: comparisons and `ORDER BY` need a normalization the engine does for you but that is easy to reason about wrongly; a `GROUP BY` per day depends on *whose* day; two values can be equal as instants yet not identical as values; and every consumer has to decide whether it wants the stored zone or its own.

    Reach for it when **the original zone is part of the fact you are recording**, like an airline schedule. If you only need to know *when* something happened, kind 3 records exactly that.

## The zone of the database and the session

The zone of your application doesn't change the values the library sends and reads. Two zones of the database do:

- **The zone of the database.** A column without zone holds a wall clock, and the zone that gives it its meaning is the database's: the zone in which the database gives its current date and time (`now()`, `current_timestamp`, a default) when the connection sets nothing. It comes from the server, which takes it from the machine it was installed on or has it in its configuration, and some engines let it be set on the database itself (see the [Per database](#per-database) tabs). The library reads and writes those digits as UTC, so **the database must be in UTC**, unless you declare its zone (see [A database outside UTC](#a-database-outside-utc)). A database installed on a machine outside UTC with nothing configured is in the zone of that machine: its values without zone are in that zone, and, taken as UTC, each one is read and written off by the difference, an hour in Madrid in winter. The library can't see that zone without a query of its own, so it can't detect it: you declare it.
- **The session**: the zone a connection sets (`SET TIME ZONE`, `SET time_zone`, `ALTER SESSION`, or an option of the driver); when nothing sets one, it is the zone of the database. **The session must be in the zone of the database**, so in UTC. The engine uses it for a column of kind 2 (MySQL and MariaDB `TIMESTAMP`, Oracle `TIMESTAMP WITH LOCAL TIME ZONE`), for SQL that mixes a wall clock with an instant (on PostgreSQL: the date functions of a `timestamptz`, like `getHours()`, a constant `localDateTime` inserted into a `timestamptz` column, a `timestamp` compared with `current_timestamp`, `date_trunc` of a `timestamptz`), and for its current date and time. A session in another zone breaks them, and what the database produces in it (`now()`, a default, a trigger) is stored in the zone of the session, not in the zone of the data. That includes a session set to UTC over a database that isn't: setting the session doesn't change the zone of the data.

What the drivers do with the session by default: pg, postgres.js, Bun SQL PostgreSQL, mysql2 and mariadb leave it in the zone of the database; Bun SQL MySQL and MariaDB set it to `+00:00`; oracledb sets it itself (see the Oracle tab); SQL Server has no session zone. Where the query runner can read the session from the configuration (`ORA_SDTZ` for oracledb, the `options` of pg, the `connection` of postgres.js), it rejects at the first query a session that isn't in the zone of the database; a `SET` of yours isn't seen. [The database's zone](#the-databases-zone) says how to put the database in UTC.

## A database outside UTC

A database that has always been in the zone it was installed in, like `Europe/Madrid`, holds its values without zone as wall clocks of that zone. On PostgreSQL and Oracle, declare that zone in the connection, with `databaseTimeZone` and an IANA name:

=== "Oracle"
    ```ts
    import { OracleConnection } from "ts-sql-query/oracle";

    class DBConnection extends OracleConnection<'DBConnection'> {
        protected override databaseTimeZone = 'Europe/Madrid'
    }
    ```

===+ "PostgreSQL"
    ```ts
    import { PostgreSqlConnection } from "ts-sql-query/postgresql";

    class DBConnection extends PostgreSqlConnection<'DBConnection'> {
        protected override databaseTimeZone = 'Europe/Madrid'
    }
    ```

The library then lets the database complete the zone of a `localDateTime` or a `localTime` with its session, which must be in that zone: a `Date` is still an instant, and the database turns it into its wall clock and back. On PostgreSQL leave the session unset, or set it to that same zone. On Oracle set the environment variable `ORA_SDTZ` to that same zone, `ORA_SDTZ=Europe/Madrid`: without it oracledb gives the session the offset of the process, which doesn't follow summer time (see [oracledb → Connection requirements](../databases/oracle/query-runners/oracledb.md#connection-requirements)).

=== "Oracle"
    | | What the library writes | Example, in `Europe/Madrid` |
    |---|---|---|
    | A `localDateTime` sent as the value of a column (an insert, the set of an update) | `:0`, the parameter sent as a `TIMESTAMP WITH LOCAL TIME ZONE` | `2024-01-14T09:15:30.123Z` is stored as `2024-01-14 10:15:30.123` |
    | A `localDateTime` compared | `starts_at = cast(:0 as timestamp)`, or `cast(:0 as date)` for a value of whole seconds of a `DATE` column; the index of the column is used | `2024-01-14T09:15:30.123Z` finds `2024-01-14 10:15:30.123` |
    | A `localDateTime` read | `cast(starts_at as timestamp with time zone)` | `2024-01-14 10:15:30.123` is read as `2024-01-14T09:15:30.123Z` |
    | The date functions | `extract(hour from sys_extract_utc(cast(starts_at as timestamp with time zone)))` | `getHours()` gives `9`, the hour of the `Date` in UTC |
    | A `localTime` sent, as the value of a column or compared | its time of the day on the date Oracle stores times on, `dateOfStoredTimes` (see [Oracle](../databases/oracle/index.md#a-time-of-the-day)): `timestamp '1972-01-01 00:00:00' + (cast(:0 as timestamp) - trunc(cast(:0 as timestamp)))` | `1970-01-01T17:00:00.000Z` is stored as `1972-01-01 18:00:00`, and `1969-12-31T23:30:00.000Z` as `1972-01-01 00:30:00` |
    | A `localTime` read | completed with a date, the `dateToConvertTimesBetweenZones`, instead of the date it is stored with: `cast(timestamp '1972-01-01 00:00:00' + (t - trunc(t)) as timestamp with time zone)` | `18:00` is read as `1972-01-01T17:00:00.000Z` |

===+ "PostgreSQL"
    | | What the library writes | Example, in `Europe/Madrid` |
    |---|---|---|
    | A `localDateTime` sent | `$1::timestamptz` (pg, Bun SQL), or the parameter sent as a `timestamptz` (postgres.js, PGlite) | `2024-01-14T09:15:30.123Z` is stored as `2024-01-14 10:15:30.123`, and compared with it |
    | A `localDateTime` read | `starts_at::timestamptz` | `2024-01-14 10:15:30.123` is read as `2024-01-14T09:15:30.123Z` |
    | The date functions | `extract(hour from (starts_at::timestamptz at time zone 'UTC'))` | `getHours()` gives `9`, the hour of the `Date` in UTC |
    | A `localTime` sent | `$1::timestamptz::time` (pg, Bun SQL), or the parameter sent as a `timestamptz` and `$1::time` (postgres.js, PGlite): its wall clock | `1970-01-01T17:00:00.000Z` is stored as `18:00` |
    | A `localTime` read | completed with a date, the `dateToConvertTimesBetweenZones` | `18:00` is read as `1972-01-01T17:00:00.000Z` |

On PostgreSQL a `localDateTime` and a `localTime` are sent as a `timestamptz` also when `driverTypeOf` of postgres.js or PGlite gives another type for them: that type would store the instant as UTC digits.

A `localDate` doesn't change: a date has no instant. A column with zone (`timestamptz`, `TIMESTAMP WITH TIME ZONE`) reads the same as before, its instant.

A `localTime` has no day, and its offset depends on the day: 18:00 in Madrid is 17:00 UTC in winter and 16:00 UTC in summer. `dateToConvertTimesBetweenZones` says which date it is converted between the zone of the database and UTC with: `'1972-01-01'` by default, a date of yours as `'YYYY-MM-DD'`, or `'today'`, the current date of the database, which gives the offset of today. The `Date` read keeps that day, and a `Date` sent is converted with the offset of its own day: send a `localTime` on that same day, like the `Date` you read, so it is stored as the time it is read as (with `'2024-07-14'`, 18:00 in Madrid is `2024-07-14T16:00:00.000Z`). For anything finer, like the day of another column, use a [type adapter](../advanced/data-types/type-adapters.md).

A wall clock the zone repeats when it changes back from summer time (`2024-10-27 02:30` in Madrid) is taken in winter time. One it skips when it changes to summer time (`2024-03-31 02:30`) can't have been written by the library, only by another program: PostgreSQL moves it forward (`03:30`), and Oracle rejects reading it, or a date function of it, with `ORA-01878`.

On Oracle, `DBTIMEZONE`, the zone in which Oracle keeps its `TIMESTAMP WITH LOCAL TIME ZONE` columns, must be an offset, like `+00:00`, its default; it isn't the zone of the data. With a region, like `Europe/Madrid`, oracledb can't send a `TIMESTAMP WITH LOCAL TIME ZONE` and the query fails with `NJS-201`.

**Only on PostgreSQL and Oracle.** The other databases can't complete the zone for every date, so a `databaseTimeZone` other than UTC is rejected at the first query with `INVALID_CONFIGURATION`, before anything is sent:

- **MariaDB and MySQL**: the only function that converts with the session, `convert_tz`, returns a value before 1970 without converting it, and without an error.
- **SQL Server**: `AT TIME ZONE` knows only the zones of Windows, groups of countries with the rules of today: `Romance Standard Time`, the one of Madrid, gives `+02:00` on 1960-07-14, when Madrid was at `+01:00`.
- **SQLite**: its [strategies of dates](../databases/sqlite/index.md#working-with-date-and-time) decide.

## Per database

Which column types of each database fall in which kind, and what its zone of the database and of the session does, is in the page of the database: [MariaDB](../databases/mariadb/index.md#time-zones), [MySQL](../databases/mysql/index.md#time-zones), [Oracle](../databases/oracle/index.md#time-zones), [PostgreSQL](../databases/postgresql/index.md#time-zones), [SQLite](../databases/sqlite/index.md#time-zones), [SQL Server](../databases/sqlserver/index.md#time-zones).

## Known limits

- **Oracle: a wall clock that doesn't exist in the zone of the process.** oracledb builds the `Date` of a `DATE` or a `TIMESTAMP` in the zone of the process, and the query runner takes its digits back as UTC. A stored time that the zone of the process skips when it changes to summer time, like `2024-03-31 02:30:00` with the process in `Europe/Madrid`, has already been moved an hour by oracledb: it's read as `03:30`, and written back as `03:30`. So is such a time given as a constant or as the argument of a fragment and selected as it is. Inside an [aggregated array](../queries/aggregate-as-object-array.md) the value is built by the database and keeps its time. With the process in UTC every value is exact, and so is every `localDateTime` and `localTime` of a [database outside UTC](#a-database-outside-utc), which is read as its instant.
- **A PGlite database created without `timezone = 'UTC'` by a process that doesn't run in UTC.** PGlite writes the zone of that process into the database, as a fixed offset, and a database in a directory keeps it when it's opened again. The values the library sends and reads are right, but what the database computes in the session zone isn't: a wall clock that the SQL turns into an instant, like a constant `localDateTime` selected and inserted into a `timestamptz` column, and the date functions of a `timestamptz`, like `getHours()`. Create the database with `postgresqlconf: ["timezone = 'UTC'"]` (see [pglite → Connection requirements](../databases/postgresql/query-runners/pglite.md#connection-requirements)).
- **A column of kind 4** keeps the instant, not the offset it was written with, as said [above](#4-the-zone-stored-with-each-value).
- **A column of kind 4 with a value stored with an offset other than `+00:00`**, written by another program or a session in another zone: the value read is its instant, and the date functions of a query give the parts of that instant in UTC, except `getHours()` of a PostgreSQL `timetz` in a database in UTC, which gives the hour of its own offset (in a [database outside UTC](#a-database-outside-utc) it gives the hour in UTC). Values the library writes are stored in UTC and are not affected.
- **A value outside the calendar.** A date or a time whose digits a `Date` of that day can't keep is rejected with `INVALID_VALUE_RECEIVED_FROM_DATABASE`, instead of becoming another day: a day the month doesn't have, like `2024-02-30`, that MySQL and MariaDB keep with the SQL mode `ALLOW_INVALID_DATES`, a zero date like `0000-00-00`, that they keep without `NO_ZERO_DATE`, and the end of the day `24:00:00`, that PostgreSQL's `time` and MySQL's and MariaDB's `TIME` accept. To keep such a value, read it with a type of your own.

## Setting the zones to UTC

None of what the library sends and reads requires the application to run in UTC. Running it in UTC is still the advice:

- The query runners of Oracle and SQL Server need nothing from you: `ORA_SDTZ` and `useUTC` are only required when the process doesn't run in UTC.
- The Oracle limit above disappears.
- Your own code agrees with the database: `new Date(2024, 0, 14)`, `getHours()`, `toString()`, a log line, a library that formats in the local zone.
- On SQLite, the `localdate` strategies and the date functions agree with the other databases.

It is what cloud providers give you by default, regardless of where the region physically is. Your development machine is the exception: it runs in your own zone.

### The application's zone

Either of these works; the environment variable is not required.

**From the environment:**

```bash
TZ=UTC node app.js
```

**From JavaScript**, useful when you do not control how the process is launched, like a serverless entry point, a test runner or a bundled CLI:

```ts
process.env.TZ = 'UTC'
```

!!! warning "It has to run first"

    Node caches the zone the first time it is needed, so this must be set **before any `Date` is created**, including by an imported module. Put it at the very top of your entry point, above the other imports, or in a tiny module you import first:

    ```ts
    // timezone.ts — imported before anything else
    process.env.TZ = 'UTC'
    ```

The query runners that need a setting only outside UTC decide whether the process runs in UTC when they are created: by `process.env.TZ` when it is set, with a name of UTC like `UTC`, `Etc/UTC` or `GMT`, and otherwise by the zone the runtime resolves. Never by the current offset, which is 0 in London only in winter.

### The database's zone

The database must be in UTC, and the session left in it:

- **A container**: the official images already are (below).
- **A database installed on your machine** takes the zone of the machine: PostgreSQL's `initdb` writes it into `postgresql.conf`, MySQL and MariaDB use it through `time_zone = SYSTEM`, SQL Server and Oracle use the one of the operating system. Put the server in UTC before it holds data: on PostgreSQL `timezone = 'UTC'` in `postgresql.conf`, or `ALTER SYSTEM SET timezone = 'UTC'` and a reload of the configuration; on MySQL `SET PERSIST time_zone = '+00:00'`; on MariaDB `SET GLOBAL time_zone = '+00:00'`, or the same in its configuration; on Oracle `TIME_AT_DBTIMEZONE = DATABASE` with `DBTIMEZONE` in UTC, set in the pluggable database with `scope = spfile` and the pluggable database reopened; on SQL Server only with the zone of its operating system.
- **The session**: don't set it to another zone, not even UTC over a database that isn't. On Oracle, oracledb sets it itself: set `ORA_SDTZ=UTC`, which the query runner requires when the process doesn't run in UTC. A session put in another zone by `ORA_SDTZ`, by the `options` of pg (`-c TimeZone=…`) or by the `connection` of postgres.js is rejected at the first query.

!!! warning "Changing the zone of a database that already holds values"

    It changes the zone of the database, not the values: the values without zone written before stay in the old zone, next to the new ones. Convert them first, see [You already have a database](#you-already-have-a-database).

### The database's zone in Docker

**The official images already run in UTC.** Every one of these images reports UTC out of the box:

| image | container zone |
|---|---|
| `postgres:18-alpine` | `UTC +0000` |
| `mysql:9` | `UTC +0000` |
| `mariadb:latest` | `UTC +0000` |
| `mcr.microsoft.com/mssql/server:2025-latest` | `UTC +0000` |
| `gvenzl/oracle-free:23-slim-faststart` | `UTC +0000` (and `DBTIMEZONE` / `SESSIONTIMEZONE` both `+00:00`) |

So a stock container usually needs nothing. Pin it explicitly when you build on a base image you do not control, or when you want the setting visible rather than inherited. **One environment variable covers every engine**: it sets the container's operating-system zone, which each engine then picks up:

```bash
docker run -e TZ=UTC postgres:18
```

```yaml
services:
  db:
    image: postgres:18
    environment:
      TZ: UTC
```

That it reaches the engine, and not just the container's shell:

```
docker run -e TZ=Europe/Madrid …

PostgreSQL   SHOW TimeZone         ->  Europe/Madrid
MySQL        @@system_time_zone    ->  CEST          (now() 14:54 while utc_timestamp() 12:54)
SQL Server   CURRENT_TIMEZONE()    ->  (UTC+01:00) Brussels, Copenhagen, Madrid, Paris
```

### Testcontainers

If your integration tests start the database themselves, the same variable goes through the environment the container is built with:

```typescriptreact
const container = await new PostgreSqlContainer('postgres:18')
    .withEnvironment({ TZ: 'UTC' })
    .start()
```

!!! warning "A suite that never leaves UTC can't see a mistake of zones"

    With the test process and the database both in UTC, local and UTC getters coincide, so code that reads a value with `getHours()` instead of `getUTCHours()`, or builds one with `new Date(2024, 0, 14)`, passes. If your application will run where the zone is another, at least one test should run in that zone, in a process started with it: the zone of a running process can't be changed reliably.

## You already have a database

The rule assumes that the digits of every column without zone are UTC. Check that before anything else:

1. **Find out which kind your temporal columns are.** Kind 3 and kind 4 hold instants, and nothing on this page can shift them.
2. **Find out the zone of the database**, with the query of its [Per database](#per-database) tab. If it isn't UTC, declare it in the connection on PostgreSQL or Oracle (see [A database outside UTC](#a-database-outside-utc)); on the other databases it isn't supported: its values without zone are in its zone, and the library takes them as UTC.
3. **For kind 1 and kind 2, find out in which zone the digits were written.** If the database is in UTC and whoever wrote them wrote UTC, there is nothing to do.
4. **If some were written in another zone**, the library reads them as UTC, so each one comes out shifted by that zone's offset. Convert the stored values to UTC once, or, if you can't, read and write that column through a type adapter (below).

!!! tip "What if the stored values were written in a zone you cannot change?"

    It happens: a legacy writer keeps storing wall clocks in a fixed zone. Here the value's zone is application knowledge, so put it where application knowledge belongs: a [type adapter](../advanced/data-types/type-adapters.md) on a column of a `LocalDateTimesType` of yours, converting in `transformValueFromDB` / `transformValueToDB`. Keep that conversion in one place; spreading it through the queries is how the original problem was made.

Moving a kind 1 column to kind 3 removes the question for good, but it is a data migration: the existing values must be interpreted in *some* zone to be converted. Do it on new columns first, and don't reach for kind 4 unless the original zone is part of what you are recording.
