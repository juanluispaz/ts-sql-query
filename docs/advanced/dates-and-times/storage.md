---
search:
  boost: 0.55
---
<!-- doc-code-library-functions -->
# How each database keeps dates and times

In which column of each database a date and time, a duration, a zoned date and time, a month of a year and a day of a month are kept, how many digits of a second each one keeps, and how to keep them in another way.

## The digits each database keeps

A Temporal value goes to the database with all its digits, up to the nanosecond, and comes back with all the ones the column keeps. A value with more digits than the column keeps is rounded or cut by the database, as with any other way of sending it. Measured with a column of six digits of fraction, and seven on SQL Server, sending `23:59:58.123456789`:

| Database | Keeps | Reads back |
|---|---|---|
| MariaDB | Microseconds, the digits beyond dropped | `23:59:58.123456` |
| MySQL | Microseconds, rounded | `23:59:58.123457` |
| Oracle | Microseconds in a `TIMESTAMP`, rounded | `23:59:58.123457` |
| PostgreSQL | Microseconds, rounded | `23:59:58.123457` |
| SQLite | What the [format of its dates](../../databases/sqlite/index.md#working-with-date-and-time) says: milliseconds by default | `23:59:58.123` |
| SQL Server | Hundreds of nanoseconds in a `datetime2(7)`, rounded | `23:59:58.1234568` |

An Oracle `TIMESTAMP(9)`, or `TIMESTAMP(9) WITH TIME ZONE`, keeps the nanoseconds. A constant selected as it is comes back as it was sent, with all its digits, unless the database converts it: PostgreSQL and SQL Server round it to the digits of their type.

## How each database keeps a duration

PostgreSQL and Oracle have a type for a length of time, an interval; the other databases keep a duration as its [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601#Durations) text, the text Temporal gives it (`P1Y2M3DT4H5M6.789S`):

| Database | The column | What it keeps | What is read back |
|---|---|---|---|
| PostgreSQL | `interval` | Each field as sent, the fraction of a second rounded to microseconds; weeks as days | `PT24H` as `PT24H`, `P2W` as `P14D` |
| Oracle | `INTERVAL DAY TO SECOND` | Days to seconds, with the digits of the fraction of the column | `PT24H` as `P1D` |
| Oracle | `INTERVAL YEAR TO MONTH`, when the column says it (below) | Years and months | `P14M` as `P1Y2M` |
| MariaDB, MySQL, SQLite, SQL Server | A text, like `varchar(64)` | The ISO 8601 text of the duration, all of it, up to the nanosecond | The same text: `PT24H` as `PT24H`, `P2W` as `P2W` |

On Oracle, declare the precision of an interval column: see [A duration in an interval](../../databases/oracle/index.md#a-duration-in-an-interval).

A duration of the query written in a column that keeps it another way, like an interval column in an `update` of a column of text, is kept as that column keeps it: in a column of text, its ISO 8601 text, the one the library writes for a duration it sends; in an interval, the interval of its parts. On PostgreSQL the text is written by the function of the library [`tsq_interval_text`](../../databases/postgresql/functions.md#tsq_interval_text); on Oracle a duration with a part the interval of the column doesn't keep (months in an `INTERVAL DAY TO SECOND`) makes the query fail.

## The digits of the fraction of a second of a duration kept in a text

A duration kept as text is written with every digit of its fraction of a second, up to the nanosecond: `PT1.123456789S`. To keep fewer, which takes less space, the connection says how many with the protected method `getDurationFractionDigits`, from 0 to 9; the digits beyond are truncated, as Temporal's `toString({ fractionalSecondDigits, roundingMode: 'trunc' })` does. With 3, the milliseconds:

<!-- doc-code-snippet-template: mysql -->
```ts
import { MySqlConnection } from 'ts-sql-query/mysql'

class DBConnection extends MySqlConnection<'DBConnection'> {
    protected override getDurationFractionDigits(): number {
        return 3
    }
}
```

| Duration | Kept with 9 (the default) | Kept with 3 | Kept with 0 |
|---|---|---|---|
| `PT1.123456789S` | `PT1.123456789S` | `PT1.123S` | `PT1S` |
| `-PT2H0.9999S` | `-PT2H0.9999S` | `-PT2H0.999S` | `-PT2H` |
| `-PT0.0009S` | `-PT0.0009S` | `PT0S` | `PT0S` |

It applies to the durations sent to be kept as text, in a value or a column of the query, on every database where a duration is text: MariaDB, MySQL, SQLite and SQL Server, and a column of PostgreSQL or Oracle that keeps it as text. A duration a query computes, like the one of `until`, keeps the digits of the database, and an interval keeps the ones of its column. Another number is rejected with `INVALID_CONFIGURATION` when a duration is sent.

## A column that keeps a duration in its own way

A column says how it keeps its durations with its [SQL data type](../data-types/sql-data-types.md): a text keeps the ISO 8601 text on any database, also on PostgreSQL and Oracle, where it holds what one interval of Oracle can't, like `P1M1D`; on Oracle an `INTERVAL YEAR TO MONTH` keeps the years and months. `withSqlDataType` is exported by `ts-sql-query`:

```typescriptreact
spanText = this.column('span_text', 'duration', withSqlDataType({ family: 'character string', length: 64 }))
spanCalendar = this.column('span_calendar', 'duration', withSqlDataType({ family: 'interval', fields: 'year to month' }))
```

An interval of Oracle holds either years and months or days to seconds, never both: a duration that doesn't fit the one of its column is rejected (see [A duration in an interval](../../databases/oracle/index.md#a-duration-in-an-interval)).

## How each database keeps a zoned date and time

| Database | The column | Computes with the rules of the zones |
|---|---|---|
| MariaDB, MySQL, SQLite, SQL Server | A text, like `varchar(100)`: the [RFC 9557](https://www.rfc-editor.org/rfc/rfc9557) text of Temporal's `toString`, `2024-03-02T12:05:00+01:00[Europe/Madrid]` | No |
| Oracle | `TIMESTAMP WITH TIME ZONE`, with the region of its zone; or a text, when the column says it (below): the RFC 9557 text, a value computed in the query written with its offset and its region in capitals | Yes |
| PostgreSQL | A text, like `text`: the RFC 9557 text, a value computed in the query kept as its instant in UTC with a `Z` (`2024-03-02T11:05:00.000000Z[Europe/Madrid]`); or none, computed in the query from a `timestamptz` and a zone | Yes |

The library writes the text as Temporal's `toString` does: the wall clock in its zone with the digits of the fraction of a second it has, the offset rounded to the minute, and the zone in brackets. It reads it as `Temporal.ZonedDateTime.from(text, { offset: 'prefer' })` does: the value written; a text with a `Z` instead of the offset, written by another program, as that instant in its zone; and when the zone no longer has the offset written at that wall clock, because its rules changed, the wall clock in its zone.

A column says it keeps the text with its [SQL data type](../data-types/sql-data-types.md), which on Oracle chooses the text instead of a `TIMESTAMP WITH TIME ZONE` (on the other databases a text is what it keeps anyway); `withSqlDataType` is exported by `ts-sql-query`:

```typescriptreact
startsAt = this.column('starts_at', 'zonedDateTime', withSqlDataType({ family: 'character string', length: 100 }))
```

From the text, without the rules of the zones, the database gives its wall clock and its parts (`toPlainDateTime()`, `year()`, `hour()`, ...), its offset, its zone, its instant (the wall clock minus the offset) and its epoch, with the digits of the fraction of a second it computes with: microseconds on MariaDB and MySQL, 100 nanoseconds on SQL Server, milliseconds on SQLite. A zoned date and time is compared (`equals`, `in`, `lessThan`, `between`, ...), ordered and taken by `min` and `max` by its instant, as Temporal's `compare` and as on Oracle and PostgreSQL: the same instant in two zones is equal. What needs the rules of the zones, like `toZonedDateTimeISO`, `withTimeZone` or the arithmetic below, doesn't compile on MariaDB, MySQL, SQLite and SQL Server; PostgreSQL computes it on a column of text as on any other zoned date and time.

The query writes these computations inline, with the text of the column several times in each one. With the functions of the library in the database and `libraryFunctions = 'installed'` on the connection, it calls one that reads the text, writing the column once: `tsq_zoned_wall` and `tsq_zoned_utc` on MariaDB and MySQL, `tsq_zoned_wall` on SQLite, `tsq_zoned_of_text` on Oracle, and `tsq_zone` on PostgreSQL (see the functions of [MariaDB](../../databases/mariadb/functions.md#tsq_zoned_wall), [MySQL](../../databases/mysql/functions.md#tsq_zoned_wall), [Oracle](../../databases/oracle/functions.md#tsq_zoned_of_text), [PostgreSQL](../../databases/postgresql/functions.md#tsq_zone) and [SQLite](../../databases/sqlite/functions.md#which-functions-each-setting-needs)). The result is the same.

What to keep in mind:

- A comparison and an order by compute the instant of each row from its text, so an index of the column isn't used for them. Where that matters, keep the instant in a column of its own and the zone in another, and index the instant.
- `groupBy` and `distinct` take the text: the same instant in two zones is two groups. `min` and `max` of the same instant in two zones give either one.
- In a text with a `Z` from another program, the parts the query gives are the ones in UTC; the value the library reads is right.
- When the offset written isn't the one the zone has now at that wall clock (its rules changed, or the offset of seconds of a zone before its standard time, written rounded to the minute), the instant the query computes is the one of the offset written, and the value read keeps the wall clock.

## The dates a month of a year and a day of a month are stored in

The connection says the day of the date a month of a year is stored in, `dayOfStoredYearMonths` (from 1 to 28, a day every month has; 1 by default), and the year of the date a day of a month is stored in, `yearOfStoredMonthDays` (a leap year; 1972 by default), the ones of Temporal by default. Another one is for a database whose dates were stored by another program on another day or year, so a value of the library compares with them:

```ts
import { PostgreSqlConnection } from 'ts-sql-query/postgresql'

class DBConnection extends PostgreSqlConnection<'DBConnection'> {
    protected override dayOfStoredYearMonths = 15
    protected override yearOfStoredMonthDays = 2000
}
```

The value read is given with the reference of Temporal whatever the date it is stored in. A day not every month has, or a year without February 29, is rejected with `INVALID_CONFIGURATION`.
