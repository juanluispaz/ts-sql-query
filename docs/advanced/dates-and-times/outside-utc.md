---
search:
  boost: 0.55
---
# A database outside UTC

What to do when the zone of the database isn't UTC, or when the values already stored were written in another zone. The rule, and how to set the zones up, is in [Time zones](../../configuration/time-zones.md).

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

The library then lets the database complete the zone of a `localDateTime` or a `localTime` with its session, which must be in that zone: a `Date` is still an instant, and the database turns it into its wall clock and back. On PostgreSQL leave the session unset, or set it to that same zone. On Oracle set the environment variable `ORA_SDTZ` to that same zone, `ORA_SDTZ=Europe/Madrid`: without it oracledb gives the session the offset of the process, which doesn't follow summer time (see [oracledb → Connection requirements](../../databases/oracle/query-runners/oracledb.md#connection-requirements)).

What the library writes for each value is in the page of each one: [Oracle](../../databases/oracle/index.md#a-database-outside-utc) and [PostgreSQL](../../databases/postgresql/index.md#a-database-outside-utc).


A `localDate` doesn't change: a date has no instant. A column with zone (`timestamptz`, `TIMESTAMP WITH TIME ZONE`) reads the same as before, its instant.

A `localTime` has no day, and its offset depends on the day: 18:00 in Madrid is 17:00 UTC in winter and 16:00 UTC in summer. `dateToConvertTimesBetweenZones` says which date it is converted between the zone of the database and UTC with: `'1972-01-01'` by default, a date of yours as `'YYYY-MM-DD'`, or `'today'`, the current date of the database, which gives the offset of today. The `Date` read keeps that day, and a `Date` sent is converted with the offset of its own day: send a `localTime` on that same day, like the `Date` you read, so it is stored as the time it is read as (with `'2024-07-14'`, 18:00 in Madrid is `2024-07-14T16:00:00.000Z`). For anything finer, like the day of another column, use a [type adapter](../data-types/type-adapters.md).

A wall clock the zone repeats when it changes back from summer time (`2024-10-27 02:30` in Madrid) is taken in winter time. One it skips when it changes to summer time (`2024-03-31 02:30`) can't have been written by the library, only by another program: PostgreSQL moves it forward (`03:30`), and Oracle rejects reading it, or a date function of it, with `ORA-01878`.

On Oracle, `DBTIMEZONE`, the zone in which Oracle keeps its `TIMESTAMP WITH LOCAL TIME ZONE` columns, must be an offset, like `+00:00`, its default; it isn't the zone of the data. With a region, like `Europe/Madrid`, oracledb can't send a `TIMESTAMP WITH LOCAL TIME ZONE` and the query fails with `NJS-201`.

**Only on PostgreSQL and Oracle.** The other databases can't complete the zone for every date, so a `databaseTimeZone` other than UTC is rejected at the first query with `INVALID_CONFIGURATION`, before anything is sent:

- **MariaDB and MySQL**: the only function that converts with the session, `convert_tz`, returns a value before 1970 without converting it, and without an error.
- **SQL Server**: `AT TIME ZONE` knows only the zones of Windows, groups of countries with the rules of today: `Romance Standard Time`, the one of Madrid, gives `+02:00` on 1960-07-14, when Madrid was at `+01:00`.
- **SQLite**: its [strategies of dates](../../databases/sqlite/index.md#working-with-date-and-time) decide.

## You already have a database

The rule assumes that the digits of every column without zone are UTC. Check that before anything else:

1. **Find out which kind your temporal columns are.** Kind 3 and kind 4 hold instants, and nothing on this page can shift them.
2. **Find out the zone of the database**, with the query of its [Per database](../../configuration/time-zones.md#per-database) tab. If it isn't UTC, declare it in the connection on PostgreSQL or Oracle (see [A database outside UTC](#a-database-outside-utc)); on the other databases it isn't supported: its values without zone are in its zone, and the library takes them as UTC.
3. **For kind 1 and kind 2, find out in which zone the digits were written.** If the database is in UTC and whoever wrote them wrote UTC, there is nothing to do.
4. **If some were written in another zone**, the library reads them as UTC, so each one comes out shifted by that zone's offset. Convert the stored values to UTC once, or, if you can't, read and write that column through a type adapter (below).

!!! tip "What if the stored values were written in a zone you cannot change?"

    It happens: a legacy writer keeps storing wall clocks in a fixed zone. Here the value's zone is application knowledge, so put it where application knowledge belongs: a [type adapter](../data-types/type-adapters.md) on a column of a `LocalDateTimesType` of yours, converting in `transformValueFromDB` / `transformValueToDB`. Keep that conversion in one place; spreading it through the queries is how the original problem was made.

Moving a kind 1 column to kind 3 removes the question for good, but it is a data migration: the existing values must be interpreted in *some* zone to be converted. Do it on new columns first, and don't reach for kind 4 unless the original zone is part of what you are recording.
