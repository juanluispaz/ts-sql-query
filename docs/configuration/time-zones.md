---
search:
  boost: 0.55
---
# Time zones

A date and time either has a known zone or it doesn't:

- An **instant** is an exact moment, the same everywhere: a `Temporal.Instant`, a JavaScript `Date`, a PostgreSQL `timestamptz`.
- A **date and time without zone** is only its digits, `2024-01-14 12:30:00`: a `Temporal.PlainDateTime`, or a `timestamp` or `datetime` column. It doesn't say whether that is half past twelve in Madrid or in Tokyo, two instants hours apart.

When an instant is stored in a column without zone, or such a column is read as an instant, the zone that is missing has to come from somewhere. The library takes it from one rule: **the database is in UTC, and the session of each connection stays in the zone of the database.** This page says what that rule means for each type, how to check it and how to set it up.

## The rule: the database and its session in UTC

The zone your application runs in doesn't change the values the library sends and reads. What matters is the zone of the database, the one in which it gives its current date and time (`now()`, `current_timestamp`, a default), and the zone of the session, which takes the zone of the database when nothing sets another.

What each type gives with the database in UTC:

| Type | The value in your code | What the zone of the database does to it |
|---|---|---|
| `plainDate`, `plainTime`, `plainDateTime` | The digits of the column | Nothing: no zone takes part. Only a column with zone, like `timestamptz`, gives its date and time in the zone of the database |
| `instant` | The exact moment | In a column without zone, it is kept as its date and time in UTC |
| `zonedDateTime` | The exact moment and its zone | Nothing: the value carries its own zone |
| `localDate`, `localTime`, `localDateTime` | A `Date` | See [Dates as `Date`](dates-as-date.md) |

A database installed on a machine outside UTC, with nothing configured, is in the zone of that machine: its values without zone are in that zone, and an instant or a `Date` read from them, or written to them, is off by the difference, an hour in Madrid in winter. The library can't see that zone without a query of its own, so it doesn't detect it: you put the database in UTC, or you [declare its zone](#when-your-database-isnt-in-utc).

## Check the zone of your database

=== "MariaDB"
    The database is in UTC when `now()` and `utc_timestamp()` give the same time:

    ```mariadb
    SELECT @@global.time_zone, @@session.time_zone, now(), utc_timestamp();
    ```
=== "MySQL"
    The database is in UTC when `now()` and `utc_timestamp()` give the same time:

    ```mysql
    SELECT @@global.time_zone, @@session.time_zone, now(), utc_timestamp();
    ```
=== "Oracle"
    Both must be UTC, or `+00:00`:

    ```oracle
    SELECT sessiontimezone, to_char(systimestamp, 'TZR') FROM dual;
    ```
===+ "PostgreSQL"
    It must show `UTC` or `Etc/UTC`:

    ```postgresql
    SHOW TimeZone;
    ```
=== "SQLite"
    SQLite has no server and no session: it runs inside your process, and the library writes and reads the text or the number of each date itself, with the [strategy of dates](../databases/sqlite/index.md#working-with-date-and-time) you choose.
=== "SQL Server"
    SQL Server uses the zone of the operating system of the server, and it has no session zone:

    ```sqlserver
    SELECT CURRENT_TIMEZONE();
    ```

What each database does with each type of its columns, and with its zone and the one of the session, is in the page of the database: [MariaDB](../databases/mariadb/index.md#time-zones), [MySQL](../databases/mysql/index.md#time-zones), [Oracle](../databases/oracle/index.md#time-zones), [PostgreSQL](../databases/postgresql/index.md#time-zones), [SQLite](../databases/sqlite/index.md#time-zones), [SQL Server](../databases/sqlserver/index.md#time-zones).

## Putting the database in UTC

**A container.** The official images of the databases already run in UTC (`postgres`, `mysql`, `mariadb`, `mcr.microsoft.com/mssql/server`, `gvenzl/oracle-free`), so a stock container needs nothing. To make it explicit, or on a base image you don't control, one environment variable covers every engine: it sets the zone of the operating system of the container, which each engine picks up.

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

If your integration tests start the database with Testcontainers, the same variable goes in the environment of the container:

```typescriptreact
const container = await new PostgreSqlContainer('postgres:18')
    .withEnvironment({ TZ: 'UTC' })
    .start()
```

**A database installed on a machine** takes the zone of the machine. Put the server in UTC before it holds data:

| Database | How |
|---|---|
| MariaDB | `SET GLOBAL time_zone = '+00:00'`, or the same in its configuration |
| MySQL | `SET PERSIST time_zone = '+00:00'` |
| Oracle | `TIME_AT_DBTIMEZONE = DATABASE` with `DBTIMEZONE` in UTC, set in the pluggable database with `scope = spfile` and the pluggable database reopened |
| PostgreSQL | `timezone = 'UTC'` in `postgresql.conf`, or `ALTER SYSTEM SET timezone = 'UTC'` and a reload of the configuration |
| SQL Server | Only with the zone of its operating system |

!!! warning "Changing the zone of a database that already holds values"

    It changes the zone of the database, not the values: the values without zone written before stay in the old zone, next to the new ones. Convert them first: see [You already have a database](../advanced/dates-and-times/outside-utc.md#you-already-have-a-database).

**The session.** Don't set the zone of the session, not even to UTC over a database that isn't in UTC: setting the session doesn't change the zone of the data. On Oracle, oracledb sets the session itself: set the environment variable `ORA_SDTZ=UTC`, which the query runner requires when the process doesn't run in UTC. A session put in another zone by `ORA_SDTZ`, by the `options` of pg (`-c TimeZone=…`) or by the `connection` of postgres.js is rejected at the first query.

## The application's zone

The application doesn't need to run in UTC. Running it in UTC is still the advice:

- The query runners of Oracle and SQL Server need nothing from you: `ORA_SDTZ` and `useUTC` are only required when the process doesn't run in UTC.
- On Oracle, a `DATE` or a `TIMESTAMP` holding a wall clock that the zone of the process skips is read exactly (see [oracledb](../databases/oracle/query-runners/oracledb.md#a-wall-clock-that-doesnt-exist-in-the-zone-of-the-process)).
- Your own code that uses `Date` agrees with the database: `new Date(2024, 0, 14)`, `toString()`, a log line, a library that formats in the local zone.
- On SQLite, the `localdate` strategies and the date functions agree with the other databases.

It is what cloud providers give you by default. Your development machine is the exception: it runs in your own zone. Set it when the process starts:

```bash
TZ=UTC node app.js
```

Or from JavaScript, when you don't control how the process is launched, like a serverless entry point, a test runner or a bundled CLI:

```ts
process.env.TZ = 'UTC'
```

!!! warning "It has to run first"

    Node caches the zone the first time it is needed, so this must be set **before any `Date` is created**, including by an imported module. Put it at the very top of your entry point, above the other imports, or in a tiny module you import first:

    ```ts
    // timezone.ts — imported before anything else
    process.env.TZ = 'UTC'
    ```

The query runners that need a setting only outside UTC decide whether the process runs in UTC when they are created: by `process.env.TZ` when it is set, with a name of UTC like `UTC`, `Etc/UTC` or `GMT`, and otherwise by the zone the runtime resolves.

## When your database isn't in UTC

- **On PostgreSQL and Oracle**, declare the zone of the database in the connection, with `databaseTimeZone` and an IANA name like `'Europe/Madrid'`: see [A database outside UTC](../advanced/dates-and-times/outside-utc.md#a-database-outside-utc).
- **On MariaDB, MySQL, SQLite and SQL Server** that isn't supported: a `databaseTimeZone` other than UTC is rejected at the first query with `INVALID_CONFIGURATION`, before anything is sent. On SQLite, the [strategy of dates](../databases/sqlite/index.md#working-with-date-and-time) says in which zone each date is kept.
- **When the values already stored were written in another zone**, see [You already have a database](../advanced/dates-and-times/outside-utc.md#you-already-have-a-database).

What each kind of temporal column does with the zone, like a `timestamptz` of PostgreSQL or a `TIMESTAMP` of MySQL, and what the session changes, is in [Temporal columns and the session](../advanced/dates-and-times/column-kinds-and-session.md).
