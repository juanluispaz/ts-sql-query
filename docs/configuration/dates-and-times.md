---
search:
  boost: 0.55
---
<!-- doc-code-library-functions -->
# Dates and times

A date, a time of the day or both reach your code in one of two ways: as a [Temporal](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal) value of JavaScript, or as a `Date`. This page says what each one is, why Temporal is the one we recommend, what you need to use it, and what a query can do with these values: compare them, take their parts, and turn a date into a date and time. It also covers [instants](instants.md#instants), an exact moment like the one a release was deployed, as a `Temporal.Instant`, and [durations](durations.md#durations), a length of time like the 45 minutes a task took, as a `Temporal.Duration`. Where the zone of each value comes from, and how to set up the zones of your database and your application, is in [Time zones](time-zones.md).

## The types

The same column of the database can be read either way; you choose with the type you give the column:

| Column type      | TypeScript type          | What it holds                         | The same column with a `Date` |
|------------------|--------------------------|---------------------------------------|-------------------------------|
| `plainDate`      | `Temporal.PlainDate`     | A date without time, like a birthday  | `localDate`                   |
| `plainTime`      | `Temporal.PlainTime`     | A time of the day, like an opening time | `localTime`                 |
| `plainDateTime`  | `Temporal.PlainDateTime` | A date and a time of the day          | `localDateTime`               |
| `plainYearMonth` | `Temporal.PlainYearMonth` | A month of a year, like the month of an invoice | None                 |
| `plainMonthDay`  | `Temporal.PlainMonthDay` | A day of a month, like a birthday that repeats every year | None          |
| `instant`        | `Temporal.Instant`       | An exact moment, the same everywhere, like the one a release was deployed | `localDateTime` |
| `zonedDateTime`  | `Temporal.ZonedDateTime` | An exact moment in a time zone, like a meeting at 09:00 in Madrid; kept as its text on MariaDB, MySQL, PostgreSQL, SQLite and SQL Server | None |
| `duration`       | `Temporal.Duration`      | A length of time, like 1 day and 12 hours | None                      |

```typescriptreact
releasedOn = this.column('released_on', 'plainDate')
cutoffTime = this.column('cutoff_time', 'plainTime')
publishedAt = this.column('published_at', 'plainDateTime')
rolloutTime = this.optionalColumn('rollout_time', 'duration')
deployedAt = this.optionalColumn('deployed_at', 'instant')
```

Their classes are `PlainDateType`, `PlainTimeType`, `PlainDateTimeType`, `PlainYearMonthType`, `PlainMonthDayType`, `InstantType`, `ZonedDateTimeType` and `DurationType`, exported by `ts-sql-query`, and a type of yours can extend their families, `PlainDatesType`, `PlainTimesType`, `PlainDateTimesType`, `PlainYearMonthsType`, `PlainMonthDaysType`, `InstantsType`, `ZonedDateTimesType` and `DurationsType`, as in [Data types of your own](../advanced/data-types/own-data-types.md#the-families).

What a query does with each one is in its page: [Dates and times without zone](plain-dates-and-times.md), [Instants](instants.md), [Zoned dates and times](zoned-dates-and-times.md), [Durations](durations.md), and [Months of a year and days of a month](months-and-days.md). The `local…` types, with `Date`, are in [Dates as `Date`](dates-as-date.md).

## Why Temporal

A `Date` is an instant: a number of milliseconds since 1970-01-01 UTC, the same moment everywhere. A date or a time stored without a zone is not an instant, so the library puts its digits in the UTC getters of the `Date` (see [Read the values with the UTC getters](dates-as-date.md#read-the-values-with-the-utc-getters)), and you have to read it with them. A Temporal value without zone holds the digits themselves, so there is no zone to keep in mind:

- `release.releasedOn.toString()` is `'2024-01-15'` in any zone of your application, and `release.releasedOn.month` is `1`.
- It keeps every digit of the fraction of a second the database keeps, where a `Date` stops at the millisecond.
- A `Temporal.PlainDate` has no time and a `Temporal.PlainTime` has no date, so neither can be mistaken for the other.

The `local…` types stay fully supported: choose them when your code already works with `Date`.

## What you need

- A runtime with `Temporal`. Node 26 and Bun 1.4 have it. In another runtime, install a polyfill in the global object (`globalThis.Temporal`) before the first query; the library reads `Temporal` from there when it converts a value. Without it, converting a value of these types is rejected with `TEMPORAL_NOT_AVAILABLE`, and the rest of the library works as usual.
- The types of `Temporal` in TypeScript: `"lib": ["esnext"]`, or `"esnext.temporal"` added to your `lib`. Without them your code still compiles, but the values of these types have the type `never`.
- The functions of the library in the database, for the operations that the database doesn't have: some a query always needs (the ones of durations), and the rest are optional. Create them with the file of SQL of [your database](../databases/postgresql/functions.md) and set `libraryFunctions = 'installed'` on the connection: then a query calls them where the SQL of the database alone would write a value several times.

    ```ts
    class DBConnection extends PostgreSqlConnection<'DBConnection'> {
        protected override libraryFunctions = 'installed' as const
    }
    ```

!!! info "The SQL of this page is the one with the functions of the library"

    Every query of this page shows the SQL it sends with `libraryFunctions = 'installed'`. Without it, the result is the same, and the SQL of some operations is longer: it writes inline what the function computes.

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
        tsq_text_of_date(released_on) as "releasedOn", 
        tsq_text_of_timestamp(cutoff_time) as "cutoffTime", 
        tsq_text_of_timestamp(published_at) as "publishedAt" 
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
        tsq_text_of_date(trunc(current_timestamp)) as "today", 
        tsq_text_of_timestamp(localtimestamp) as "now" 
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

## The digits each database keeps

A Temporal value goes to the database with all its digits, up to the nanosecond, and comes back with all the ones the column keeps. A value with more digits than the column keeps is rounded or cut by the database, as with any other way of sending it. Measured with a column of six digits of fraction, and seven on SQL Server, sending `23:59:58.123456789`:

| Database | Keeps | Reads back |
|---|---|---|
| MariaDB | Microseconds, the digits beyond dropped | `23:59:58.123456` |
| MySQL | Microseconds, rounded | `23:59:58.123457` |
| Oracle | Microseconds in a `TIMESTAMP`, rounded | `23:59:58.123457` |
| PostgreSQL | Microseconds, rounded | `23:59:58.123457` |
| SQLite | What the [format of its dates](../databases/sqlite/index.md#working-with-date-and-time) says: milliseconds by default | `23:59:58.123` |
| SQL Server | Hundreds of nanoseconds in a `datetime2(7)`, rounded | `23:59:58.1234568` |

An Oracle `TIMESTAMP(9)`, or `TIMESTAMP(9) WITH TIME ZONE`, keeps the nanoseconds. A constant selected as it is comes back as it was sent, with all its digits, unless the database converts it: PostgreSQL and SQL Server round it to the digits of their type.

## Known limits

- **Bun SQL** gives a `timestamp` (PostgreSQL) or a `datetime` (MySQL and MariaDB) as a `Date`, and has no way to give its text: a `plainDateTime` or an `instant` read through it stops at the millisecond. A `date` and a `time` keep all their digits. The other drivers of these databases read every digit.
- **A year before 1.** In Temporal the year before 1 is 0 (1 BC), and the one before it -1. PostgreSQL and Oracle keep these dates, but `year()` gives the year as they number it, with no year 0: -1 for 1 BC and -44 for 44 BC, where the value read is `-000043-03-15`. SQL Server rejects a date before the year 1, and an instant before the year 1.
- **Bun SQL on MySQL 8** sends a text parameter that MySQL converts to a time wrongly (`'10:07:30'` is `00:00:00`): a `plainTime` given as a value and rounded is another time there. A column is read right, and so is every value with the other drivers and with MariaDB.
- **Oracle has no type for a time of the day**: a `plainTime` is kept in a `DATE` or a `TIMESTAMP` on one date, as a `localTime` is: `dateOfStoredTimes`, 1972-01-01 by default (see [A time of the day](../databases/oracle/index.md#a-time-of-the-day)).
- **A difference of more than 292 years on SQLite**, like `until` of two instants or of two dates and times, has more nanoseconds than its 64-bit integers: the query fails with the error of `tsq_duration_text` or `tsq_duration_total`. The other databases compute it with decimal numbers.
- **Grouping by the arithmetic of a zoned date and time that isn't a column, on Oracle**: a zoned date and time computed in the query (like `toZonedDateTimeISO(zone)` of an instant) or given as a value is computed once in a scalar subquery when an operation of its arithmetic uses it, and Oracle doesn't accept a subquery in the `group by` (*ORA-22818*). The arithmetic of a column has no subquery.
- **A zoned date and time in local mean time on Oracle**: Oracle keeps the offset of the local mean time of a zone (like `-00:14:44` in Madrid until 1900, or `-03:50:40` in Asunción until 1931) without its seconds, so the date and time of an instant there, and the instant of a wall clock there, are some seconds off from Temporal's. A zoned date and time read keeps its instant.
- **An interval of PostgreSQL with fields of different signs**, like `-1 days +02:03:00` or `1 mon -1 days`, can't be a `Temporal.Duration`, whose fields have one sign: reading it is rejected with `INVALID_VALUE_RECEIVED_FROM_DATABASE`. The library never sends one.
- **A column with a zone**, like `timestamptz` on PostgreSQL: a `plainDateTime` reads the date and time it has in the zone of the database. On SQL Server, a `datetimeoffset` is read, and its parts given, in UTC.
