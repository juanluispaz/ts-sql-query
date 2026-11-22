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

## Per database

Which column types of each database fall in which kind, and what its zone of the database and of the session does, is in the page of the database: [MariaDB](../databases/mariadb/index.md#time-zones), [MySQL](../databases/mysql/index.md#time-zones), [Oracle](../databases/oracle/index.md#time-zones), [PostgreSQL](../databases/postgresql/index.md#time-zones), [SQLite](../databases/sqlite/index.md#time-zones), [SQL Server](../databases/sqlserver/index.md#time-zones).

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

    It changes the zone of the database, not the values: the values without zone written before stay in the old zone, next to the new ones. Convert them first, see [You already have a database](../advanced/dates-and-times/outside-utc.md#you-already-have-a-database).

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
