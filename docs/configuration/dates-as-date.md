---
search:
  boost: 0.55
---
# Dates as Date

The `local…` types (`localDate`, `localTime`, `localDateTime`) give a value as a JavaScript `Date`. This page says how to read it.

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

## Read the values with the UTC getters

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

!!! warning "A suite that never leaves UTC can't see a mistake of zones"

    With the test process and the database both in UTC, local and UTC getters coincide, so code that reads a value with `getHours()` instead of `getUTCHours()`, or builds one with `new Date(2024, 0, 14)`, passes. If your application will run where the zone is another, at least one test should run in that zone, in a process started with it: the zone of a running process can't be changed reliably.

## The date functions of a query give the parts in UTC

`getFullYear()`, `getMonth()`, `getDate()`, `getDay()`, `getHours()`, `getMinutes()`, `getSeconds()` and `getMilliseconds()` of a value in a query are computed by the database, and give the parts in UTC: the same as the `getUTCFullYear()`, `getUTCMonth()`, … of the `Date` you read, not its local getters. `getTime()` gives the same as the `getTime()` of that `Date` (see [What `getTime()` does and does not promise](#what-gettime-does-and-does-not-promise)). In a column without zone the parts are its digits; in a column with zone, the parts of the instant in UTC. On SQLite, `sqliteRunsInApplicationTimeZone` makes them work in the zone of the application instead (see [SQLite](../databases/sqlite/index.md#the-date-functions-and-the-time-zone)).

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

On a column with zone it counts the instant, the same as the `getTime()` of the `Date` read, whatever offset the value was stored with. On a column of kind 2 the database counts from the wall clock of the session, so `getTime()` is right only with the session in UTC, as the value itself. On SQLite, the `localdate` strategies are read as the zone of the process and `getTime()` reads them as UTC, unless you set [`sqliteRunsInApplicationTimeZone`](../databases/sqlite/index.md#the-date-functions-and-the-time-zone).

## A value outside the calendar

A date or a time whose digits a `Date` of that day can't keep is rejected with `INVALID_VALUE_RECEIVED_FROM_DATABASE`, instead of becoming another day: a day the month doesn't have, like `2024-02-30`, that MySQL and MariaDB keep with the SQL mode `ALLOW_INVALID_DATES`, a zero date like `0000-00-00`, that they keep without `NO_ZERO_DATE`, and the end of the day `24:00:00`, that PostgreSQL's `time` and MySQL's and MariaDB's `TIME` accept. To keep such a value, read it with a type of your own.
