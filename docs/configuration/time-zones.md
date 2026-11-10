---
search:
  boost: 0.55
---
# Time zones

A JavaScript `Date` is an **instant**: a single number, milliseconds since the epoch. It is not "half past twelve"; it is a fixed point on the world's timeline that *happens to be* half past twelve if you look at it from a particular place.

Many temporal columns are not instants. `TIMESTAMP` / `DATETIME` stores a **wall clock**: the characters `2024-01-14 12:30:00`, and nothing else. It doesn't record whether that is half past twelve in Madrid or in Tokyo, two instants hours apart. So turning that column into a `Date` needs a zone, and the column doesn't supply one.

ts-sql-query answers that with one rule: **every value in the database is in UTC.** The digits of a column without zone are the UTC digits of the `Date`, when it's sent and when it's read, whatever zone your application runs in. This page answers:

- What `Date` you receive for each data type, and which getters to read it with.
- What still depends on a zone: the database session's zone, for a few column types and for SQL that mixes a wall clock with an instant.
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

When the zone is part of the value you need, read the column as text formatted by the database, with a [fragment](../queries/sql-fragments.md) of type `string`: on Oracle `to_char(<column>, 'YYYY-MM-DD"T"HH24:MI:SS.FF9TZH:TZM')`, which gives `2024-01-14T19:30:15.123456000+09:00`, or with `TZR` instead of `TZH:TZM` for the name of the region, like `EUROPE/MADRID`; on SQL Server `convert(nvarchar(40), <column>, 126)`, which gives `2024-01-14T19:30:15.1234567+09:00`. The text keeps the zone and the whole fraction of a second. To write a zone, send the text and convert it in the SQL: on Oracle `to_timestamp_tz(<text>, 'YYYY-MM-DD"T"HH24:MI:SS.FF TZR')`, which reads an offset (`2024-01-14T19:30:15.123+09:00`) or a region (`2024-07-01T19:30:15.123 Europe/Madrid`); on SQL Server `cast(<text> as datetimeoffset)`. If you only need to show a value in the zone it belongs to, keep the name of that zone in a column of its own, next to the instant.

!!! warning "This is not the safest option: it buys a different set of problems"

    Once values from several zones coexist in one column you inherit questions the other kinds never raise: comparisons and `ORDER BY` need a normalization the engine does for you but that is easy to reason about wrongly; a `GROUP BY` per day depends on *whose* day; two values can be equal as instants yet not identical as values; and every consumer has to decide whether it wants the stored zone or its own.

    Reach for it when **the original zone is part of the fact you are recording**, like an airline schedule. If you only need to know *when* something happened, kind 3 records exactly that.

## What still depends on the database's zone

The zone of your application doesn't change the values the library sends and reads. The zone of the **database session** still does in two places:

- **A column of kind 2**: MySQL and MariaDB `TIMESTAMP`, Oracle `TIMESTAMP WITH LOCAL TIME ZONE`. The engine converts with the session zone, so the session must be in UTC.
- **SQL that mixes a wall clock with an instant**: on PostgreSQL, a `timestamp` cast to `timestamptz`, a `timestamp` compared with `current_timestamp`, `date_trunc` of a `timestamptz`, a `timestamp` value inserted into a `timestamptz` column. The engine resolves the wall clock in the session zone.
With the session in UTC, both agree with the rule. The [Per database](#per-database) tabs say where the session zone comes from, and [The database's zone](#the-databases-zone) how to set it.

## Per database

Which column types fall in which kind, and what the session zone does:

=== "MariaDB"
    | kind | types |
    |---|---|
    | 1 — no handling | `DATE`, `TIME`, `DATETIME` |
    | 2 — pinned, delivered without the zone | `TIMESTAMP` (stored as UTC, converted with the session zone) |
    | 3 — pinned, delivered with the zone | *none* |
    | 4 — zone stored per value | *none* |

    The session zone is `time_zone`, which defaults to `SYSTEM`, the server's operating-system zone. A `TIMESTAMP` column needs it in UTC. The query runner can't read it without a query of its own, so it doesn't check it:

    ```sql
    SELECT @@session.time_zone;
    SET SESSION time_zone = '+00:00';
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

    The session zone is `time_zone`, which defaults to `SYSTEM`, the server's operating-system zone. A `TIMESTAMP` column needs it in UTC. The query runner can't read it without a query of its own, so it doesn't check it:

    ```sql
    SELECT @@session.time_zone;
    SET SESSION time_zone = '+00:00';
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

    oracledb sets the session zone when it opens a connection: the one of the environment variable `ORA_SDTZ`, or else the offset of the process at that moment. The library sends a date or a time as a `TIMESTAMP WITH TIME ZONE` in UTC, which Oracle converts with the session zone where it is compared with or stored in a `DATE` or a `TIMESTAMP`. So when the process doesn't run in UTC, the query runner requires `ORA_SDTZ` set to UTC: see [oracledb → Connection requirements](query-runners/recommended/oracledb.md#connection-requirements).

    ```sql
    SELECT sessiontimezone FROM dual;
    ```

    A `DATE` or `TIMESTAMP` holding a wall clock that doesn't exist in the zone of the process comes back moved: see [Known limits](#known-limits).

===+ "PostgreSQL"
    | kind | types |
    |---|---|
    | 1 — no handling | `date`, `time`, `timestamp` (`timestamp without time zone`) |
    | 2 — pinned, delivered without the zone | *none* |
    | 3 — pinned, delivered with the zone | `timestamptz` (`timestamp with time zone`) |
    | 4 — zone stored per value | *none*: despite the name, `timestamptz` stores no zone |

    The session zone is `TimeZone`, defaulting to the server's `timezone` setting. The values the library sends and reads don't depend on it; only SQL that mixes a `timestamp` with a `timestamptz` does:

    ```sql
    SHOW TimeZone;
    SET TIME ZONE 'UTC';
    ```

    PGlite takes the session zone from the process, as a fixed offset, unless the database is created with `postgresqlconf: ["timezone = 'UTC'"]`: see [pglite → Connection requirements](query-runners/recommended/pglite.md#connection-requirements).

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

        There is nothing to `SET`: the engine uses the **server's operating-system zone**, and every session sees the same one. The values the library sends and reads don't depend on it.

        ```sql
        SELECT CURRENT_TIMEZONE();   -- the server's OS zone
        ```

    The driver, tedious, sends and reads a date and a time in UTC with its option `useUTC`, which is on by default. When the process doesn't run in UTC, the query runner rejects a pool with `useUTC: false`: see [mssql → Connection requirements](query-runners/recommended/mssql.md#connection-requirements).

## Known limits

- **Oracle: a wall clock that doesn't exist in the zone of the process.** oracledb builds the `Date` of a `DATE` or a `TIMESTAMP` in the zone of the process, and the query runner takes its digits back as UTC. A stored time that the zone of the process skips when it changes to summer time, like `2024-03-31 02:30:00` with the process in `Europe/Madrid`, has already been moved an hour by oracledb: it's read as `03:30`, and written back as `03:30`. Inside an [aggregated array](../queries/aggregate-as-object-array.md) the value is built by the database and keeps its time. With the process in UTC every value is exact.
- **PGlite created without `timezone = 'UTC'`, in a process that doesn't run in UTC.** PGlite takes the session zone from the process, as a fixed offset. The values the library sends and reads are right, but what the database computes in the session zone isn't: a wall clock that the SQL turns into an instant, like a constant `localDateTime` selected and inserted into a `timestamptz` column, and the date functions of a `timestamptz`, like `getHours()`. Create the database with `postgresqlconf: ["timezone = 'UTC'"]` (see [pglite → Connection requirements](query-runners/recommended/pglite.md#connection-requirements)).
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

Prefer a server that already runs in UTC. Where the engine has a session zone, you can also set it per connection: run the statement of the [Per database](#per-database) tabs when the connection is opened, so every connection in the pool gets it. The hook is driver-specific: see [pg](query-runners/recommended/pg.md#running-a-statement-on-each-new-connection) (`pool.on('connect', …)`). On Oracle, set `ORA_SDTZ`, which oracledb reads when it opens a connection.

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
2. **For kind 1 and kind 2, find out in which zone the digits were written.** If whoever wrote them ran in UTC, or wrote UTC on purpose, there is nothing to do. For kind 2, also set the session in UTC.
3. **If they were written in another zone**, the library reads them as UTC, so each value comes out shifted by that zone's offset. Convert the stored values to UTC once, or, if you can't, read and write that column through a type adapter (below).

!!! tip "What if the stored values were written in a zone you cannot change?"

    It happens: a legacy writer keeps storing wall clocks in a fixed zone. Here the value's zone is application knowledge, so put it where application knowledge belongs: a [type adapter](column-types.md#type-adapters) on a `customLocalDateTime` column, converting in `transformValueFromDB` / `transformValueToDB`. Keep that conversion in one place; spreading it through the queries is how the original problem was made.

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
        signed_off_at as value, 
        round(timestampdiff(microsecond, '1970-01-01 00:00:00', signed_off_at) / 1000) as epoch 
    from project_release 
    where id = ?
    ```
=== "MySQL"
    ```mysql
    select 
        signed_off_at as `value`, 
        round(timestampdiff(microsecond, '1970-01-01 00:00:00', signed_off_at) / 1000) as epoch 
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
        round(extract(epoch from signed_off_at) * 1000) as epoch 
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
        signed_off_at as [value], 
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
