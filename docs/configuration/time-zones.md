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

It is not about collations, the other setting of a session: see [Collations & case sensitivity](collations.md). On SQLite the library writes and reads the text or the number itself, with the strategy you choose; see [SQLite → Working with Date and Time](supported-databases/sqlite.md#working-with-date-and-time).

## The rule: every value in the database is in UTC

| Data type | What you read | What is stored when you send a `Date` |
|---|---|---|
| `localDate` | A `Date` at 10:00 UTC of the stored day | The day of its UTC getters |
| `localTime` | A `Date` on 1970-01-01 whose UTC getters are the stored time | The time of its UTC getters |
| `localDateTime`, in a column without zone | A `Date` whose UTC getters are the stored digits | The digits of its UTC getters |
| `localDateTime`, in a column with zone, like `timestamptz` | The instant | The instant |

On SQLite the [strategy of dates](supported-databases/sqlite.md#working-with-date-and-time) decides. With a `localdate` strategy, the default, a `localTime` and a `localDateTime` are in the zone of the application: the stored text is in their **local** getters, and a `Date` is stored with its local getters, so `2024-01-14 12:30:00.000` is read in `Europe/Madrid` as `2024-01-14T11:30:00.000Z`. The `UTC` and numeric strategies follow the rule. A `localDate` is at 10:00 UTC of its day on SQLite too.

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

### Read the values with the UTC getters

The value is still a `Date`, and JavaScript gives its local getters and its local formatting just as readily:

```typescriptreact
row.signedOffAt.getUTCHours()     // 12 — the stored hour, in any zone
row.signedOffAt.getHours()        // the stored hour converted to the zone of the process
row.signedOffAt.toISOString()     // 2024-01-14T12:30:00.000Z — the stored digits
row.signedOffAt.toLocaleString()  // in the zone of the process

row.birthday.getUTCDate()         // 14 — the stored day
row.birthday.toISOString()        // 2024-01-14T10:00:00.000Z — the 10:00 means nothing

row.opensAt.getUTCHours()         // 9, for a time stored as 09:15
row.opensAt.getHours()            // 10 in Madrid in winter, 4 in New York
```

Use the UTC getters (`getUTCFullYear`, `getUTCMonth`, `getUTCDate`, `getUTCHours`, `getUTCMinutes`, `getUTCSeconds`), and format with an explicit zone: `new Intl.DateTimeFormat('en', { timeZone: 'UTC' })`. Convert to a local zone only when you show the value to a person, and only for an instant.

A `localDate` is at 10:00 UTC so that its local getters still give the same day from UTC-10 to UTC+13; outside that range they give another day. Its UTC getters give the stored day everywhere. Its time and `getTime()` mean nothing for a date with no time.

### The date functions of a query give the parts in UTC

`getFullYear()`, `getMonth()`, `getDate()`, `getDay()`, `getHours()`, `getMinutes()`, `getSeconds()` and `getMilliseconds()` of a value in a query are computed by the database, and give the parts in UTC: the same as the `getUTCFullYear()`, `getUTCMonth()`, … of the `Date` you read, not its local getters. `getTime()` gives the same as the `getTime()` of that `Date` (see [What `getTime()` does and does not promise](#what-gettime-does-and-does-not-promise)). In a column without zone the parts are its digits; in a column with zone, the parts of the instant in UTC. On SQLite, `sqliteRunsInApplicationTimeZone` makes them work in the zone of the application instead (see [SQLite](supported-databases/sqlite.md#the-date-functions-and-the-time-zone)).

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

When the zone is part of the value you need, keep the value as text: the database gives the column as text with its zone, and converts the text you send. On Oracle `to_char(<column>, 'YYYY-MM-DD"T"HH24:MI:SS.FF9TZH:TZM')` gives `2024-01-14T19:30:15.123456000+09:00`, or the name of the region with `TZR` instead of `TZH:TZM`, like `EUROPE/MADRID`, and `to_timestamp_tz(<text>, 'YYYY-MM-DD"T"HH24:MI:SS.FF TZR')` reads an offset (`2024-01-14T19:30:15.123+09:00`) or a region (`2024-07-01T19:30:15.123 Europe/Madrid`); on SQL Server `convert(nvarchar(40), <column>, 126)` gives `2024-01-14T19:30:15.1234567+09:00`, and `cast(<text> as datetimeoffset)` reads it. The text keeps the zone and the whole fraction of a second. A [type adapter](../advanced/type-adapters.md) on the column writes that SQL in every query, with `transformProjection` for the value read and `transformPlaceholder` for the value sent, and the value in your code is the text; the column still compares and orders by the instant: see [A date and time with its time zone](supported-databases/oracle.md#a-date-and-time-with-its-time-zone) on Oracle and [A date and time with its offset](supported-databases/sqlserver.md#a-date-and-time-with-its-offset) on SQL Server. In a single query, a [fragment](../queries/sql-fragments.md) of type `string` with the same SQL reads the text too. If you only need to show a value in the zone it belongs to, keep the name of that zone in a column of its own, next to the instant.

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

The library then lets the database complete the zone of a `localDateTime` or a `localTime` with its session, which must be in that zone: a `Date` is still an instant, and the database turns it into its wall clock and back. On PostgreSQL leave the session unset, or set it to that same zone. On Oracle set the environment variable `ORA_SDTZ` to that same zone, `ORA_SDTZ=Europe/Madrid`: without it oracledb gives the session the offset of the process, which doesn't follow summer time (see [oracledb → Connection requirements](query-runners/recommended/oracledb.md#connection-requirements)).

=== "Oracle"
    | | What the library writes | Example, in `Europe/Madrid` |
    |---|---|---|
    | A `localDateTime` sent as the value of a column (an insert, the set of an update) | `:0`, the parameter sent as a `TIMESTAMP WITH LOCAL TIME ZONE` | `2024-01-14T09:15:30.123Z` is stored as `2024-01-14 10:15:30.123` |
    | A `localDateTime` compared | `starts_at = cast(:0 as timestamp)`, or `cast(:0 as date)` for a value of whole seconds of a `DATE` column; the index of the column is used | `2024-01-14T09:15:30.123Z` finds `2024-01-14 10:15:30.123` |
    | A `localDateTime` read | `cast(starts_at as timestamp with time zone)` | `2024-01-14 10:15:30.123` is read as `2024-01-14T09:15:30.123Z` |
    | The date functions | `extract(hour from sys_extract_utc(cast(starts_at as timestamp with time zone)))` | `getHours()` gives `9`, the hour of the `Date` in UTC |
    | A `localTime` | completed with a day, the `localTimeReferenceDate`, instead of the day it is stored with: `cast(timestamp '1970-01-01 00:00:00' + (t - trunc(t)) as timestamp with time zone)` | `18:00` is read as `1970-01-01T17:00:00.000Z` |

===+ "PostgreSQL"
    | | What the library writes | Example, in `Europe/Madrid` |
    |---|---|---|
    | A `localDateTime` sent | `$1::timestamptz` (pg, Bun SQL), or the parameter sent as a `timestamptz` (postgres.js, PGlite) | `2024-01-14T09:15:30.123Z` is stored as `2024-01-14 10:15:30.123`, and compared with it |
    | A `localDateTime` read | `starts_at::timestamptz` | `2024-01-14 10:15:30.123` is read as `2024-01-14T09:15:30.123Z` |
    | The date functions | `extract(hour from (starts_at::timestamptz at time zone 'UTC'))` | `getHours()` gives `9`, the hour of the `Date` in UTC |
    | A `localTime` | completed with a day, the `localTimeReferenceDate` | `18:00` is read as `1970-01-01T17:00:00.000Z` |

A `localDate` doesn't change: a date has no instant. A column with zone (`timestamptz`, `TIMESTAMP WITH TIME ZONE`) reads the same as before, its instant.

A `localTime` has no day, and its offset depends on the day: 18:00 in Madrid is 17:00 UTC in winter and 16:00 UTC in summer. `localTimeReferenceDate` says which day completes it: `'1970-01-01'` by default, the day of a `localTime`, a date of yours as `'YYYY-MM-DD'`, or `'today'`, the current date of the database, which gives the offset of today. The `Date` read keeps that day. For anything finer, like the day of another column, use a [type adapter](../advanced/type-adapters.md).

A wall clock the zone repeats when it changes back from summer time (`2024-10-27 02:30` in Madrid) is taken in winter time. One it skips when it changes to summer time (`2024-03-31 02:30`) can't have been written by the library, only by another program: PostgreSQL moves it forward (`03:30`), and Oracle rejects reading it, or a date function of it, with `ORA-01878`.

On Oracle, `DBTIMEZONE`, the zone in which Oracle keeps its `TIMESTAMP WITH LOCAL TIME ZONE` columns, must be an offset, like `+00:00`, its default; it isn't the zone of the data. With a region, like `Europe/Madrid`, oracledb can't send a `TIMESTAMP WITH LOCAL TIME ZONE` and the query fails with `NJS-201`.

**Only on PostgreSQL and Oracle.** The other databases can't complete the zone for every date, so a `databaseTimeZone` other than UTC is rejected at the first query with `INVALID_CONFIGURATION`, before anything is sent:

- **MariaDB and MySQL**: the only function that converts with the session, `convert_tz`, returns a value before 1970 without converting it, and without an error.
- **SQL Server**: `AT TIME ZONE` knows only the zones of Windows, groups of countries with the rules of today: `Romance Standard Time`, the one of Madrid, gives `+02:00` on 1960-07-14, when Madrid was at `+01:00`.
- **SQLite**: its [strategies of dates](supported-databases/sqlite.md#working-with-date-and-time) decide.

## Per database

Which column types fall in which kind, and what the session zone does:

=== "MariaDB"
    | kind | types |
    |---|---|
    | 1 — no handling | `DATE`, `TIME`, `DATETIME` |
    | 2 — pinned, delivered without the zone | `TIMESTAMP` (stored as UTC, converted with the session zone) |
    | 3 — pinned, delivered with the zone | *none* |
    | 4 — zone stored per value | *none* |

    The zone of the database is the server's `time_zone`: `SYSTEM` by default, the zone of the operating system of the machine it runs on, or the one set in the server. It must be UTC. The session takes it unless something sets another: leave it so, since a `TIMESTAMP` column and `now()` follow the session. Bun SQL sets the session to `+00:00`, which is right only with the server in UTC. The query runner can't read either without a query of its own, so it doesn't check them. With both in UTC, `now()` and `utc_timestamp()` give the same time:

    ```sql
    SELECT @@global.time_zone, @@session.time_zone, now(), utc_timestamp();
    ```

    !!! warning "`TIMESTAMP` is not this engine's `timestamptz`"

        "Stored as UTC" reads like "safe", but it is kind 2, not kind 3: the conversion uses the **session's** zone and what reaches the driver is a bare wall clock. With the session in UTC it holds the UTC digits, as a `DATETIME` does.

=== "MySQL"
    | kind | types |
    |---|---|
    | 1 — no handling | `DATE`, `TIME`, `DATETIME` |
    | 2 — pinned, delivered without the zone | `TIMESTAMP` (stored as UTC, converted with the session zone) |
    | 3 — pinned, delivered with the zone | *none* |
    | 4 — zone stored per value | *none* |

    The zone of the database is the server's `time_zone`: `SYSTEM` by default, the zone of the operating system of the machine it runs on, or the one set in the server. It must be UTC. The session takes it unless something sets another: leave it so, since a `TIMESTAMP` column and `now()` follow the session. Bun SQL sets the session to `+00:00`, which is right only with the server in UTC. The query runner can't read either without a query of its own, so it doesn't check them. With both in UTC, `now()` and `utc_timestamp()` give the same time:

    ```sql
    SELECT @@global.time_zone, @@session.time_zone, now(), utc_timestamp();
    ```

    !!! warning "`TIMESTAMP` is not this engine's `timestamptz`"

        "Stored as UTC" reads like "safe", but it is kind 2, not kind 3: the conversion uses the **session's** zone and what reaches the driver is a bare wall clock. With the session in UTC it holds the UTC digits, as a `DATETIME` does.

=== "Oracle"
    | kind | types |
    |---|---|
    | 1 — no handling | `DATE`, `TIMESTAMP` |
    | 2 — pinned, delivered without the zone | `TIMESTAMP WITH LOCAL TIME ZONE` (normalized to the database zone, converted with the session zone) |
    | 3 — pinned, delivered with the zone | *none* |
    | 4 — zone stored per value | `TIMESTAMP WITH TIME ZONE` |

    The zone of the database is the one of `SYSTIMESTAMP`: the zone of the server's operating system, or `DBTIMEZONE` when the pluggable database sets `TIME_AT_DBTIMEZONE = DATABASE`. It must be UTC, unless you declare it (see [A database outside UTC](#a-database-outside-utc)). oracledb sets the session zone when it opens a connection: the one of the environment variable `ORA_SDTZ`, or else the offset of the process at that moment. A `TIMESTAMP WITH LOCAL TIME ZONE` is read and written in the session zone, a `DATE` or a `TIMESTAMP` given back by a `returning` is converted with it, and `current_date` and `localtimestamp` come in it. So the query runner requires the session in the zone of the database: in UTC, `ORA_SDTZ` set to UTC, or not set with the process in UTC; in a zone you declare, `ORA_SDTZ` set to it. See [oracledb → Connection requirements](query-runners/recommended/oracledb.md#connection-requirements).

    ```sql
    SELECT sessiontimezone, to_char(systimestamp, 'TZR') FROM dual;
    ```

    A `DATE` or `TIMESTAMP` holding a wall clock that doesn't exist in the zone of the process comes back moved: see [Known limits](#known-limits).

===+ "PostgreSQL"
    | kind | types |
    |---|---|
    | 1 — no handling | `date`, `time`, `timestamp` (`timestamp without time zone`) |
    | 2 — pinned, delivered without the zone | *none* |
    | 3 — pinned, delivered with the zone | `timestamptz` (`timestamp with time zone`) |
    | 4 — zone stored per value | *none*: despite the name, `timestamptz` stores no zone |

    The zone of the database is the server's `timezone` setting, which `initdb` takes from the machine where the server is installed (a container is in UTC). It must be UTC. The session takes it unless a connection sets another, and pg, postgres.js and Bun SQL set none: leave it so. It must show `UTC` or `Etc/UTC`:

    ```sql
    SHOW TimeZone;
    ```

    PGlite writes the zone of the process into its database when it creates it, as a fixed offset, unless it's created with `postgresqlconf: ["timezone = 'UTC'"]`, and a database in a directory keeps that zone: see [pglite → Connection requirements](query-runners/recommended/pglite.md#connection-requirements).

=== "SQLite"
    SQLite has **no temporal types at all**: a date is text, a number or an integer, and *you* choose which. In ts-sql-query that choice is `getDateTimeFormat()`; see [SQLite → Working with Date and Time](supported-databases/sqlite.md#working-with-date-and-time). The `UTC` text strategies and the numeric ones keep every value in UTC; the `localdate` ones, the default, write and read the wall clock of the zone of the process.

    !!! tip "SQLite has only one zone"

        There is no server and no session: SQLite runs **inside your process**, and it takes the zone the process started with from the C library. `datetime('now', 'localtime')` follows your `TZ`:

        ```
        TZ=UTC             localtime = 12:37:58   utc = 12:37:58
        TZ=Europe/Madrid   localtime = 14:37:58   utc = 12:37:58
        ```

        Set the zone when the process starts: on Bun with `bun:sqlite`, changing `process.env.TZ` afterwards changes JavaScript and not SQLite, and the two disagree. With a `localdate` strategy, pin your application's zone anyway: it is what keeps the stored text consistent across the machines that write it.

        The date functions of the database work in UTC by default, so they can differ from what JavaScript gives when the process doesn't run in UTC. See [The date functions and the time zone](supported-databases/sqlite.md#the-date-functions-and-the-time-zone).

=== "SQL Server"
    | kind | types |
    |---|---|
    | 1 — no handling | `date`, `time`, `datetime`, `datetime2`, `smalldatetime` |
    | 2 — pinned, delivered without the zone | *none* |
    | 3 — pinned, delivered with the zone | *none* |
    | 4 — zone stored per value | `datetimeoffset` |

    !!! warning "SQL Server has no session time zone"

        There is nothing to `SET`: the engine uses the **server's operating-system zone**, and every session sees the same one. That is the zone of the database: `getdate()`, `current_timestamp` and a default with them give the date and time in it, and so do `currentDate()`, `currentTime()` and `currentDateTime()`. It must be UTC, as it is in a container. The query runner can't read it.

        ```sql
        SELECT CURRENT_TIMEZONE();   -- the server's OS zone
        ```

    The driver, tedious, sends and reads a date and a time in UTC with its option `useUTC`, which is on by default. When the process doesn't run in UTC, the query runner rejects a pool with `useUTC: false`: see [mssql → Connection requirements](query-runners/recommended/mssql.md#connection-requirements).

## Known limits

- **Oracle: a wall clock that doesn't exist in the zone of the process.** oracledb builds the `Date` of a `DATE` or a `TIMESTAMP` in the zone of the process, and the query runner takes its digits back as UTC. A stored time that the zone of the process skips when it changes to summer time, like `2024-03-31 02:30:00` with the process in `Europe/Madrid`, has already been moved an hour by oracledb: it's read as `03:30`, and written back as `03:30`. So is such a time given as a constant or as the argument of a fragment and selected as it is. Inside an [aggregated array](../queries/aggregate-as-object-array.md) the value is built by the database and keeps its time. With the process in UTC every value is exact, and so is every `localDateTime` and `localTime` of a [database outside UTC](#a-database-outside-utc), which is read as its instant.
- **A PGlite database created without `timezone = 'UTC'` by a process that doesn't run in UTC.** PGlite writes the zone of that process into the database, as a fixed offset, and a database in a directory keeps it when it's opened again. The values the library sends and reads are right, but what the database computes in the session zone isn't: a wall clock that the SQL turns into an instant, like a constant `localDateTime` selected and inserted into a `timestamptz` column, and the date functions of a `timestamptz`, like `getHours()`. Create the database with `postgresqlconf: ["timezone = 'UTC'"]` (see [pglite → Connection requirements](query-runners/recommended/pglite.md#connection-requirements)).
- **A column of kind 4** keeps the instant, not the offset it was written with, as said [above](#4-the-zone-stored-with-each-value).
- **A column of kind 4 with a value stored with an offset other than `+00:00`**, written by another program or a session in another zone: the value read is its instant, and the date functions of a query give the parts of that instant in UTC, except `getHours()` of a PostgreSQL `timetz`, which gives the hour of its own offset. Values the library writes are stored in UTC and are not affected.
- **A value outside the calendar.** A date or a time whose digits a `Date` of that day can't keep is rejected with `INVALID_VALUE_RECEIVED_FROM_DATABASE`, instead of becoming another day: a day the month doesn't have, like `2024-02-30`, that MySQL and MariaDB keep with the SQL mode `ALLOW_INVALID_DATES`, a zero date like `0000-00-00`, that they keep without `NO_ZERO_DATE`, and the end of the day `24:00:00`, that PostgreSQL's `time` and MySQL's and MariaDB's `TIME` accept. To keep such a value, read it with a custom type of your own.

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

    It happens: a legacy writer keeps storing wall clocks in a fixed zone. Here the value's zone is application knowledge, so put it where application knowledge belongs: a [type adapter](../advanced/type-adapters.md) on a `customLocalDateTime` column, converting in `transformValueFromDB` / `transformValueToDB`. Keep that conversion in one place; spreading it through the queries is how the original problem was made.

Moving a kind 1 column to kind 3 removes the question for good, but it is a data migration: the existing values must be interpreted in *some* zone to be converted. Do it on new columns first, and don't reach for kind 4 unless the original zone is part of what you are recording.

## What `getTime()` does and does not promise

`getTime()` mirrors `Date.prototype.getTime()`: milliseconds since the epoch, computed **by the database**, exact across the whole range a JavaScript `Date` can hold, including instants before 1970.

```ts
const tRelease = new class TRelease extends Table<DBConnection, 'TRelease'> {
    id = this.autogeneratedPrimaryKey('id', 'int');
    signedOffAt = this.optionalColumn('signed_off_at', 'localDateTime');
    constructor() {
        super('project_release'); // table name in the database
    }
}();

const row = await connection.selectFrom(tRelease)
    .where(tRelease.id.equals(1))
    .select({
        value: tRelease.signedOffAt,             // a Date, built by the application
        epoch: tRelease.signedOffAt.getTime(),   // milliseconds, computed by the database
    })
    .executeSelectOne();
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        signed_off_at as `value`, 
        floor(timestampdiff(microsecond, '1970-01-01 00:00:00', signed_off_at) / 1000) as epoch 
    from project_release 
    where id = ?
    ```
=== "MySQL"
    ```mysql
    select 
        signed_off_at as value, 
        floor(timestampdiff(microsecond, '1970-01-01 00:00:00', signed_off_at) / 1000) as epoch 
    from project_release 
    where id = ?
    ```
=== "Oracle"
    ```oracle
    select 
        signed_off_at as "value", 
        (trunc(timestamp '1970-01-01 00:00:00' + (signed_off_at - timestamp '1970-01-01 00:00:00')) - date '1970-01-01') * 86400000 + to_number(to_char(timestamp '1970-01-01 00:00:00' + (signed_off_at - timestamp '1970-01-01 00:00:00'), 'SSSSSFF3')) as "epoch" 
    from project_release 
    where id = :0
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        signed_off_at as value, 
        floor(extract(epoch from signed_off_at) * 1000) as epoch 
    from project_release 
    where id = $1
    ```
=== "SQLite"
    ```sqlite
    select 
        signed_off_at as value, 
        round(unixepoch(signed_off_at, 'subsec') * 1000) as epoch 
    from project_release 
    where id = ?1
    ```
=== "SQL Server"
    ```sqlserver
    select 
        signed_off_at as value, 
        datediff_big(millisecond, '1970-01-01 00:00:00', signed_off_at) as epoch 
    from project_release 
    where id = @0
    ```

The parameters are: `[ 1 ]`

The result type is:
```tsx
const row: {
    value?: Date;
    epoch?: number;
}
```

On a column without zone the database counts from the digits as if they were UTC, as the library reads them, so the two agree in any zone of the process. A PostgreSQL `timestamp` column holding `2024-01-14 12:30:00`:

```
TZ=UTC               value.getTime() = 1705235400000   epoch = 1705235400000
TZ=Europe/Madrid     value.getTime() = 1705235400000   epoch = 1705235400000
TZ=America/New_York  value.getTime() = 1705235400000   epoch = 1705235400000
```

On a column with zone it counts the instant, the same as the `getTime()` of the `Date` read, whatever offset the value was stored with. On a column of kind 2 the database counts from the wall clock of the session, so `getTime()` is right only with the session in UTC, as the value itself. On SQLite, the `localdate` strategies are read as the zone of the process and `getTime()` reads them as UTC, unless you set [`sqliteRunsInApplicationTimeZone`](supported-databases/sqlite.md#the-date-functions-and-the-time-zone).
