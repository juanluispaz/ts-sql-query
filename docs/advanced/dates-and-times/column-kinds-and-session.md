---
search:
  boost: 0.55
---
# Temporal columns and the session

What each database does with the zone of a temporal column, and with the zone of the session. The rule, and how to set the zones up, is in [Time zones](../../configuration/time-zones.md).

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

When the zone is part of the value you need, keep the value as text: the database gives the column as text with its zone, and converts the text you send. On Oracle `to_char(<column>, 'YYYY-MM-DD"T"HH24:MI:SS.FF9TZH:TZM')` gives `2024-01-14T19:30:15.123456000+09:00`, or the name of the region with `TZR` instead of `TZH:TZM`, like `EUROPE/MADRID`, and `to_timestamp_tz(<text>, 'YYYY-MM-DD"T"HH24:MI:SS.FF TZR')` reads an offset (`2024-01-14T19:30:15.123+09:00`) or a region (`2024-07-01T19:30:15.123 Europe/Madrid`); on SQL Server `convert(nvarchar(40), <column>, 126)` gives `2024-01-14T19:30:15.1234567+09:00`, and `cast(<text> as datetimeoffset)` reads it. The text keeps the zone and the whole fraction of a second. A [type adapter](../data-types/type-adapters.md) on the column writes that SQL in every query, with `transformProjection` for the value read and `transformPlaceholder` for the value sent, and the value in your code is the text; the column still compares and orders by the instant: see [A date and time with its time zone](../../databases/oracle/index.md#a-date-and-time-with-its-time-zone) on Oracle and [A date and time with its offset](../../databases/sqlserver/index.md#a-date-and-time-with-its-offset) on SQL Server. In a single query, a [fragment](../../queries/sql-fragments.md) of type `string` with the same SQL reads the text too. If you only need to show a value in the zone it belongs to, keep the name of that zone in a column of its own, next to the instant.

!!! warning "This is not the safest option: it buys a different set of problems"

    Once values from several zones coexist in one column you inherit questions the other kinds never raise: comparisons and `ORDER BY` need a normalization the engine does for you but that is easy to reason about wrongly; a `GROUP BY` per day depends on *whose* day; two values can be equal as instants yet not identical as values; and every consumer has to decide whether it wants the stored zone or its own.

    Reach for it when **the original zone is part of the fact you are recording**, like an airline schedule. If you only need to know *when* something happened, kind 3 records exactly that.

## The zone of the database and the session

The zone of your application doesn't change the values the library sends and reads. Two zones of the database do:

- **The zone of the database.** A column without zone holds a wall clock, and the zone that gives it its meaning is the database's: the zone in which the database gives its current date and time (`now()`, `current_timestamp`, a default) when the connection sets nothing. It comes from the server, which takes it from the machine it was installed on or has it in its configuration, and some engines let it be set on the database itself (see the [Per database](../../configuration/time-zones.md#per-database) tabs). The library reads and writes those digits as UTC, so **the database must be in UTC**, unless you declare its zone (see [A database outside UTC](outside-utc.md#a-database-outside-utc)). A database installed on a machine outside UTC with nothing configured is in the zone of that machine: its values without zone are in that zone, and, taken as UTC, each one is read and written off by the difference, an hour in Madrid in winter. The library can't see that zone without a query of its own, so it can't detect it: you declare it.
- **The session**: the zone a connection sets (`SET TIME ZONE`, `SET time_zone`, `ALTER SESSION`, or an option of the driver); when nothing sets one, it is the zone of the database. **The session must be in the zone of the database**, so in UTC. The engine uses it for a column of kind 2 (MySQL and MariaDB `TIMESTAMP`, Oracle `TIMESTAMP WITH LOCAL TIME ZONE`), for SQL that mixes a wall clock with an instant (on PostgreSQL: the date functions of a `timestamptz`, like `getHours()`, a constant `localDateTime` inserted into a `timestamptz` column, a `timestamp` compared with `current_timestamp`, `date_trunc` of a `timestamptz`), and for its current date and time. A session in another zone breaks them, and what the database produces in it (`now()`, a default, a trigger) is stored in the zone of the session, not in the zone of the data. That includes a session set to UTC over a database that isn't: setting the session doesn't change the zone of the data.

What the drivers do with the session by default: pg, postgres.js, Bun SQL PostgreSQL, mysql2 and mariadb leave it in the zone of the database; Bun SQL MySQL and MariaDB set it to `+00:00`; oracledb sets it itself (see the Oracle tab); SQL Server has no session zone. Where the query runner can read the session from the configuration (`ORA_SDTZ` for oracledb, the `options` of pg, the `connection` of postgres.js), it rejects at the first query a session that isn't in the zone of the database; a `SET` of yours isn't seen. [The database's zone](../../configuration/time-zones.md#the-databases-zone) says how to put the database in UTC.

## What a column with a zone gives

- **A column with a zone**, like `timestamptz` on PostgreSQL: a `plainDateTime` reads the date and time it has in the zone of the database. On SQL Server, a `datetimeoffset` is read, and its parts given, in UTC.
- **A column of kind 4 with a value stored with an offset other than `+00:00`**, written by another program or a session in another zone: the value read is its instant, and the date functions of a query give the parts of that instant in UTC, except `getHours()` of a PostgreSQL `timetz` in a database in UTC, which gives the hour of its own offset (in a [database outside UTC](outside-utc.md#a-database-outside-utc) it gives the hour in UTC). Values the library writes are stored in UTC and are not affected.
