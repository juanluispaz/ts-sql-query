---
search:
  boost: 0.55
---
<!-- doc-code-library-functions -->
# A month of a year and a day of a month

A `plainYearMonth` is a month of a year without a day, like the month of an invoice (`2024-03`), a `Temporal.PlainYearMonth`; a `plainMonthDay` is a day of a month without a year, like a birthday that repeats every year (`03-15`), a `Temporal.PlainMonthDay`. No database has a type for them: each is stored in a date, the one Temporal keeps inside it, its reference: the 1st of the month for a month of a year (`2024-03-01`), the year 1972, a leap year that has February 29, for a day of a month (`1972-03-15`). So the database compares, orders and computes them with its own dates, and an index of the column is used.

!!! info "The SQL of this page is the one with the functions of the library"

    Every query of this page shows the SQL it sends with `libraryFunctions = 'installed'`. Without it, the result is the same, and the SQL of some operations is longer: it writes inline what the function computes.

```typescriptreact
billingMonth = this.column('billing_month', 'plainYearMonth')
anniversary = this.column('anniversary', 'plainMonthDay')
```

A date read is accepted on any day or year, as Temporal's `from` takes one: `2024-03-15` in a column of months of a year is `2024-03`. The reference is part of the value, as in Temporal: a column whose dates another program stored on another day compares with a value of the library only when they are on the same day (see the setting below).

`toPlainYearMonth()` and `toPlainMonthDay()` of a `plainDate` give its month of the year and its day of the month. Here the month of each release, the next one and its days, the day of its release, and that day in 2025:

```ts
const releases = await connection.selectFrom(tRelease)
    .select({
        version: tRelease.version,
        month: tRelease.releasedOn.toPlainYearMonth(),
        nextMonth: tRelease.releasedOn.toPlainYearMonth().add({ months: 1 }),
        daysInMonth: tRelease.releasedOn.toPlainYearMonth().daysInMonth(),
        anniversary: tRelease.releasedOn.toPlainMonthDay(),
        anniversaryIn2025: tRelease.releasedOn.toPlainMonthDay().toPlainDate({ year: 2025 }),
    })
    .orderBy('version')
    .executeSelectMany()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        version as version, 
        cast(date_format(released_on, '%Y-%m-01') as date) as month, 
        date_add(cast(date_format(released_on, '%Y-%m-01') as date), interval ? month) as nextMonth, 
        day(last_day(released_on)) as daysInMonth, 
        cast(date_format(released_on, '1972-%m-%d') as date) as anniversary, 
        tsq_date_with(cast(date_format(released_on, '1972-%m-%d') as date), 2025, null, null, 0) as anniversaryIn2025 
    from project_release 
    order by version
    ```
=== "MySQL"
    ```mysql
    select 
        version as version, 
        cast(date_format(released_on, '%Y-%m-01') as date) as month, 
        date_add(cast(date_format(released_on, '%Y-%m-01') as date), interval ? month) as nextMonth, 
        day(last_day(released_on)) as daysInMonth, 
        cast(date_format(released_on, '1972-%m-%d') as date) as anniversary, 
        tsq_date_with(cast(date_format(released_on, '1972-%m-%d') as date), 2025, null, null, 0) as anniversaryIn2025 
    from project_release 
    order by version
    ```
=== "Oracle"
    ```oracle
    select 
        version as "version", 
        tsq_text_of_date(trunc(released_on, 'MM')) as "month", 
        tsq_text_of_date((add_months(trunc(released_on, 'MM'), :0) - greatest(0, extract(day from add_months(trunc(released_on, 'MM'), :0)) - extract(day from trunc(released_on, 'MM'))))) as "nextMonth", 
        extract(day from last_day(released_on)) as "daysInMonth", 
        tsq_text_of_date(to_date('1972' || to_char(released_on, 'MMDD'), 'YYYYMMDD')) as "anniversary", 
        tsq_text_of_date(tsq_date_with(to_date('1972' || to_char(released_on, 'MMDD'), 'YYYYMMDD'), 2025, null, null, 0)) as "anniversaryIn2025" 
    from project_release 
    order by "version"
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        version as version, 
        date_trunc('month', released_on)::date as month, 
        cast(date_trunc('month', released_on)::date + $1::interval as date) as "nextMonth", 
        extract(day from date_trunc('month', released_on) + interval '1 month - 1 day')::integer as "daysInMonth", 
        make_date(1972, cast(extract(month from released_on) as integer), cast(extract(day from released_on) as integer)) as anniversary, 
        tsq_date_with(make_date(1972, cast(extract(month from released_on) as integer), cast(extract(day from released_on) as integer)), 2025, null, null, 0) as "anniversaryIn2025" 
    from project_release 
    order by version
    ```
=== "SQLite"
    ```sqlite
    select 
        version as version, 
        date(released_on, 'start of month') as month, 
        date(date(date(released_on, 'start of month'), 'start of month', ?1), (min(cast(strftime('%d', date(released_on, 'start of month')) as integer), cast(strftime('%d', date(date(released_on, 'start of month'), 'start of month', ?1), '+1 months', '-1 days') as integer)) - 1) || ' days') as nextMonth, 
        cast(strftime('%d', released_on, 'start of month', '+1 months', '-1 days') as integer) as daysInMonth, 
        date(strftime('1972-%m-%d', released_on)) as anniversary, 
        date(tsq_date_with(strftime('%Y-%m-%d', date(strftime('1972-%m-%d', released_on))), 2025, null, null, 0)) as anniversaryIn2025 
    from project_release 
    order by version
    ```
=== "SQL Server"
    ```sqlserver
    select 
        version as version, 
        datefromparts(datepart(year, released_on), datepart(month, released_on), 1) as month, 
        dateadd(month, @0, datefromparts(datepart(year, released_on), datepart(month, released_on), 1)) as nextMonth, 
        day(eomonth(released_on)) as daysInMonth, 
        datefromparts(1972, datepart(month, released_on), datepart(day, released_on)) as anniversary, 
        dbo.tsq_date_with(datefromparts(1972, datepart(month, released_on), datepart(day, released_on)), 2025, null, null, 0) as anniversaryIn2025 
    from project_release 
    order by version
    ```

The parameters are: `[ Duration P1M ]` (on MariaDB and MySQL and Oracle and SQL Server: `[ 1 ]`; on SQLite: `[ '1 months' ]`)

| version | month | nextMonth | daysInMonth | anniversary | anniversaryIn2025 |
|---|---|---|---|---|---|
| `0.9.0` | `2024-03` | `2024-04` | 31 | `03-01` | `2025-03-01` |
| `1.2.0` | `2024-01` | `2024-02` | 31 | `01-15` | `2025-01-15` |
| `1.3.0-beta.1` | `2024-02` | `2024-03` | 29 | `02-20` | `2025-02-20` |

What each one has, with the meaning and the name it has in Temporal:

| Method | Gives | Of |
|---|---|---|
| `year()`, `month()` | The year, and the month from 1 to 12, as an `int` | `plainYearMonth` |
| `day()` | The day of the month, from 1 to 31, as an `int` | `plainMonthDay` |
| `monthCode()` | The code of the month, `'M01'` to `'M12'`, a `string` (a `Temporal.PlainMonthDay` has no `month`) | both |
| `daysInMonth()`, `daysInYear()`, `monthsInYear()`, `inLeapYear()` | The days of its month and of its year, its months, and whether its year has February 29 | `plainYearMonth` |
| `add`, `subtract` | Plus or minus a duration of years and months, a `Temporal.Duration` or its fields (`{ months: 1 }`); one with days, weeks or a time is rejected, as in Temporal | `plainYearMonth` |
| `with` | Another `year` or `month` (or `monthCode`); a month out of its range is taken to the nearest one (13 is December), or rejected with `{ overflow: 'reject' }` | `plainYearMonth` |
| `with` | Another `month` (or `monthCode`) or `day`, the day taken to the last one of the month in a leap year, or in the `year` given (February 29 in 2023 is the 28th), or rejected with `{ overflow: 'reject' }` | `plainMonthDay` |
| `until`, `since` | The duration to or from another month of a year, in years and months (see below) | `plainYearMonth` |
| `toPlainDate({ day })` | The date of that day of the month, taken to the last one of the month | `plainYearMonth` |
| `toPlainDate({ year })` | The date in that year (February 29 is the 28th in a year without it) | `plainMonthDay` |

A month of a year is compared and ordered (`lessThan`, `orderBy`); a day of a month only compared for equality, as Temporal has no order of them: `lessThan` of one doesn't compile.

`until` and `since` of a month of a year take every option of Temporal's: in years and months by default, `largestUnit: 'month'` for months only, and `smallestUnit` (`'year'` or `'month'`), `roundingIncrement` and `roundingMode`. Here the time from the month of each release to June 2025, in years and months, in months, and rounded to the year:

```ts
const june2025 = Temporal.PlainYearMonth.from('2025-06')
const releases = await connection.selectFrom(tRelease)
    .select({
        version: tRelease.version,
        untilJune: tRelease.releasedOn.toPlainYearMonth().until(june2025),
        inMonths: tRelease.releasedOn.toPlainYearMonth().until(june2025, { largestUnit: 'month' }),
        inYears: tRelease.releasedOn.toPlainYearMonth().until(june2025, { smallestUnit: 'year', roundingMode: 'halfExpand' }),
    })
    .orderBy('version')
    .executeSelectMany()
```

The executed query is:

=== "MariaDB"
    ```mariadb
    select 
        version as version, 
        tsq_duration_text(0, (cast(year(?) as signed) * 12 + cast(month(?) as signed) - (cast(year(released_on) as signed) * 12 + cast(month(released_on) as signed))), 0, 0, 0, 'year') as untilJune, 
        tsq_duration_text(0, (cast(year(?) as signed) * 12 + cast(month(?) as signed) - (cast(year(released_on) as signed) * 12 + cast(month(released_on) as signed))), 0, 0, 0, 'month') as inMonths, 
        tsq_duration_round_of(date_format(released_on, '%Y-%m-01'), date_format(?, '%Y-%m-01'), 'year', 'year', 1, 'halfExpand', 1) as inYears 
    from project_release 
    order by version
    ```
=== "MySQL"
    ```mysql
    select 
        version as version, 
        tsq_duration_text(0, (cast(year(?) as signed) * 12 + cast(month(?) as signed) - (cast(year(released_on) as signed) * 12 + cast(month(released_on) as signed))), 0, 0, 0, 'year') as untilJune, 
        tsq_duration_text(0, (cast(year(?) as signed) * 12 + cast(month(?) as signed) - (cast(year(released_on) as signed) * 12 + cast(month(released_on) as signed))), 0, 0, 0, 'month') as inMonths, 
        tsq_duration_round_of(date_format(released_on, '%Y-%m-01'), date_format(?, '%Y-%m-01'), 'year', 'year', 1, 'halfExpand', 1) as inYears 
    from project_release 
    order by version
    ```
=== "Oracle"
    ```oracle
    select 
        version as "version", 
        tsq_duration_text(0, (extract(year from to_date(:0, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) * 12 + extract(month from to_date(:0, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) - (extract(year from released_on) * 12 + extract(month from released_on))), 0, 0, 0, 'year') as "untilJune", 
        tsq_duration_text(0, (extract(year from to_date(:1, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) * 12 + extract(month from to_date(:1, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN')) - (extract(year from released_on) * 12 + extract(month from released_on))), 0, 0, 0, 'month') as "inMonths", 
        tsq_duration_round_of(trunc(released_on, 'MM'), trunc(to_date(:2, 'YYYY-MM-DD BC', 'NLS_DATE_LANGUAGE=AMERICAN'), 'MM'), 'year', 'year', 1, 'halfExpand', 1) as "inYears" 
    from project_release 
    order by "version"
    ```
===+ "PostgreSQL"
    ```postgresql
    select 
        version as version, 
        make_interval(months => (cast(extract(year from $1::date) as integer) * 12 + cast(extract(month from $1::date) as integer) - (cast(extract(year from released_on) as integer) * 12 + cast(extract(month from released_on) as integer)))) as "untilJune", 
        make_interval(months => (cast(extract(year from $2::date) as integer) * 12 + cast(extract(month from $2::date) as integer) - (cast(extract(year from released_on) as integer) * 12 + cast(extract(month from released_on) as integer)))) as "inMonths", 
        tsq_duration_round_of(date_trunc('month', released_on)::date, date_trunc('month', $3::date)::date, 'year', 'year', 1, 'halfExpand', 1) as "inYears" 
    from project_release 
    order by version
    ```
=== "SQLite"
    ```sqlite
    select 
        version as version, 
        tsq_duration_text(0, (cast(strftime('%Y', ?1) as integer) * 12 + cast(strftime('%m', ?1) as integer) - (cast(strftime('%Y', released_on) as integer) * 12 + cast(strftime('%m', released_on) as integer))), 0, 0, 0, 'year') as untilJune, 
        tsq_duration_text(0, (cast(strftime('%Y', ?2) as integer) * 12 + cast(strftime('%m', ?2) as integer) - (cast(strftime('%Y', released_on) as integer) * 12 + cast(strftime('%m', released_on) as integer))), 0, 0, 0, 'month') as inMonths, 
        tsq_duration_round_of(strftime('%Y-%m-01', released_on), strftime('%Y-%m-01', ?3), 'year', 'year', 1, 'halfExpand', 1) as inYears 
    from project_release 
    order by version
    ```
=== "SQL Server"
    ```sqlserver
    select 
        version as version, 
        dbo.tsq_duration_text(0, (datepart(year, @0) * 12 + datepart(month, @0) - (datepart(year, released_on) * 12 + datepart(month, released_on))), 0, 0, 0, 'year') as untilJune, 
        dbo.tsq_duration_text(0, (datepart(year, @1) * 12 + datepart(month, @1) - (datepart(year, released_on) * 12 + datepart(month, released_on))), 0, 0, 0, 'month') as inMonths, 
        dbo.tsq_duration_round_of(datefromparts(datepart(year, released_on), datepart(month, released_on), 1), datefromparts(datepart(year, @2), datepart(month, @2), 1), 'year', 'year', 1, 'halfExpand', 1) as inYears 
    from project_release 
    order by version
    ```

The parameters are: `[ PlainDate 2025-06-01, PlainDate 2025-06-01, PlainDate 2025-06-01 ]` (on MariaDB and MySQL: `[ PlainDate 2025-06-01, PlainDate 2025-06-01, PlainDate 2025-06-01, PlainDate 2025-06-01, PlainDate 2025-06-01 ]`; on SQLite: `[ '2025-06-01', '2025-06-01', '2025-06-01' ]`)

| version | untilJune | inMonths | inYears |
|---|---|---|---|
| `0.9.0` | `P1Y3M` | `P15M` | `P1Y` |
| `1.2.0` | `P1Y5M` | `P17M` | `P1Y` |
| `1.3.0-beta.1` | `P1Y4M` | `P16M` | `P1Y` |

The months between them are computed in the query. Temporal rounds to the year, and to an increment of months with years or in a mode half way (`'halfExpand'`, ...), by the days of the months from the start of the step to the value and to its end: from January 2000 to July 2003, 3 years and 6 months, is `P3Y` rounded half way, the 181 days from January to July being less than half of the 365 of 2003. That rounding needs the function of the library `tsq_duration_round` on every database, as `until` of dates in months does, and, where the database has no interval, `tsq_duration_text` writes the duration (see [The functions of the library it uses](plain-dates-and-times.md#the-functions-of-the-library-it-uses)). On PostgreSQL the interval gives the months as years and months: `P15M` is read as `P1Y3M`.

## The dates they are stored in

The connection says the day of the date a month of a year is stored in, `dayOfStoredYearMonths` (from 1 to 28, a day every month has; 1 by default), and the year of the date a day of a month is stored in, `yearOfStoredMonthDays` (a leap year; 1972 by default), the ones of Temporal by default. Another one is for a database whose dates were stored by another program on another day or year, so a value of the library compares with them:

```ts
import { PostgreSqlConnection } from 'ts-sql-query/postgresql'

class DBConnection extends PostgreSqlConnection<'DBConnection'> {
    protected override dayOfStoredYearMonths = 15
    protected override yearOfStoredMonthDays = 2000
}
```

The value read is given with the reference of Temporal whatever the date it is stored in. A day not every month has, or a year without February 29, is rejected with `INVALID_CONFIGURATION`.
