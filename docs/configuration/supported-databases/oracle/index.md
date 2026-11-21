---
search:
  boost: 0.59
---
<!-- doc-code-template: oracle -->
# Oracle

This page has what is particular to Oracle: what it offers and what it doesn't, how to declare its version, [how a boolean is stored](#how-a-boolean-is-stored), [a date and time in a `DATE` column](#a-date-and-time-in-a-date-column), [dates before 1582](#dates-before-1582), how `concat` treats `null`, `replaceAll`, and the UUID strategies. The functions to create in the database are in [Oracle functions](functions.md). To define the connection and map your tables, the pages to read are [Connection](../../connection.md) and [Mapping](../../mapping.md).

## Defining the connection

```ts
import { OracleConnection } from "ts-sql-query/oracle";

class DBConnection extends OracleConnection<'DBConnection'> { }
```

Create a connection object for each request, and don't share it between concurrent requests: see [Instantiating the connection](../../connection.md#instantiating-the-connection-with-the-database-connection).

## What it offers and what it doesn't

What isn't offered doesn't compile on this connection. On a version older than the one shown, the database rejects the query. Each link goes to the page that explains the feature, with all the databases side by side.

| What | On this database |
|---|---|
| [`returning` in an insert](../../../queries/insert.md#availability-per-database) | Yes, written as `returning into`; not from a select |
| [`returning` in an update](../../../queries/update.md#availability-in-each-database) | Yes, written as `returning into` |
| [`returning` in a delete](../../../queries/delete.md#availability-in-each-database) | Yes, written as `returning into` |
| [`oldValues()` in an update](../../../queries/update.md#availability-in-each-database) | Not offered |
| [Insert on conflict](../../../queries/insert-on-conflict.md#what-each-database-offers) | Not offered |
| Other tables in an [update](../../../queries/update.md#availability-in-each-database) or a [delete](../../../queries/delete.md#availability-in-each-database) | `from` and `using` from Oracle 23ai. A join right after `update` or `deleteFrom` isn't offered |
| [Compound queries](../../../queries/compound-select.md#availability-in-each-database) | All of them, written with `minus` for `except` |
| [Recursive queries](../../../queries/recursive-select.md#availability-in-each-database) | `recursiveUnionAll`, and `startWith` and `connectBy`. `recursiveUnion` isn't offered |
| [Arrays of objects from an aggregate](../../../queries/aggregate-as-object-array.md#availability-in-each-database) | Yes. The `Distinct` versions aren't offered |
| [`stringConcatDistinct`, `anyValue`](../../../queries/aggregate-and-group-by.md#how-each-function-is-written-in-each-database) | Yes; `stringConcatDistinct` needs Oracle 19c |
| [Sequences](../../mapping.md#using-a-sequence) | Yes |
| [Stored procedures](../../mapping.md#calling-a-stored-procedure) and [functions](../../mapping.md#calling-a-function-of-the-database) | Yes |
| [Isolation levels](../../../queries/transaction.md#what-each-database-offers) | `read committed`, `snapshot` |

## Compatibility version

The `compatibilityVersion` property says which Oracle Database version the SQL must work on, encoded as the integer `major * 1_000_000 + minor * 1_000 + patch` — e.g. `23_009_000` for Oracle Database 23.9. The default is `Number.POSITIVE_INFINITY` (latest).

Recognized breakpoints:

- `compatibilityVersion >= 23_004_000` (Oracle Database 23ai): the [`Values`](../../mapping.md#mapping-constant-values-as-view) feature emits the SQL-standard `WITH name(cols) AS (VALUES (…), …)` table constructor introduced in 23ai. On earlier Oracle versions ts-sql-query emulates it as `WITH name(cols) AS (SELECT … FROM dual UNION ALL SELECT … FROM dual)` so the feature still works.

On older Oracle versions, set `compatibilityVersion` to your actual version so the right emulation is chosen automatically. It is recommended to keep this value in sync with your real database version so future ts-sql-query releases that gate additional features on it pick the right behavior automatically.

```ts
import { OracleConnection } from "ts-sql-query/oracle";

class DBConnection extends OracleConnection<'DBConnection'> {
    protected override compatibilityVersion = 23_009_000
}
```

!!! info "Minimum Oracle version for `stringConcatDistinct`"

    Independent of `compatibilityVersion`, `stringConcatDistinct` emits `LISTAGG(DISTINCT …)`, which requires Oracle Database 19c or later (the `DISTINCT` keyword inside `LISTAGG` was added in 19c). Targeting an older Oracle release means avoiding this aggregate.

## How a boolean is stored

Oracle has a `BOOLEAN` type only from Oracle 23ai. The `booleanStorage` property of the connection says how your boolean columns are stored, and the SQL is written for it:

| `booleanStorage` | Column | Values | SQL written |
|---|---|---|---|
| `'number'` (the default) | `NUMBER(1)` | `1` true, `0` false | A condition used as a value becomes `case when … then 1 else 0 end`, and a boolean used as a condition is compared with `1`. Every version of Oracle |
| `'boolean'` | `BOOLEAN` | `true`, `false` | As in the SQL standard: a condition is a value, and a boolean column is a condition. Oracle 23.4 or later |

```ts
import { OracleConnection } from "ts-sql-query/oracle";

class DBConnection extends OracleConnection<'DBConnection'> {
    protected override booleanStorage: 'number' | 'boolean' = 'boolean'
}
```

A column stored the other way is declared with a [custom boolean](../../../advanced/data-types/custom-booleans-values.md): with `'boolean'`, a `NUMBER(1)` column takes `new CustomBooleanTypeAdapter(1, 0)`; with `'number'`, a `CHAR(1)` column with `'Y'` and `'N'` takes `new CustomBooleanTypeAdapter('Y', 'N')`. The library then writes that column in the form you chose wherever it's used as a boolean, so it can be compared, combined and assigned with the other boolean columns: with `'boolean'`, a `NUMBER(1)` column `invoiced` is read as `(invoiced = 1)`, and `select billable ... union select (invoiced = 1) ...` works. Without the custom boolean, Oracle rejects a `NUMBER(1)` and a `BOOLEAN` in the two sides of a `union` (`ORA-01790`).

## A time of the day

Oracle has no type of a time alone. A `localTime` or a `plainTime` is kept in a `TIMESTAMP` column (or a `DATE` one, see below) on one date, `dateOfStoredTimes` of the connection (`'1972-01-01'` by default): the library writes it on that date, compares a value with it on that date, and gives `currentTime()` on that date, so a comparison and an order are by the time of the day and use the index of the column. When it reads one, the date is dropped.

That date is a convention every program that writes in the column has to keep. A column whose times were written on another date, like the `'1970-01-01'` of version 1 of the library, declares it:

```ts
import { OracleConnection } from 'ts-sql-query/oracle'

class DBConnection extends OracleConnection<'DBConnection'> {
    protected override dateOfStoredTimes = '1970-01-01'
}
```

A row written with another date, like `2024-05-07 10:30:00`, is read as `10:30`, but it doesn't match a comparison with `10:30`, and it orders by its date first. To compare only the time of the day of such a column, write it in a fragment, `t - trunc(t)`, with an index on that expression in your schema. A `dateOfStoredTimes` that isn't a date `'YYYY-MM-DD'` is rejected with `INVALID_CONFIGURATION`.

## A date and time in a `DATE` column

An Oracle `DATE` holds a date and a time to the second, with no fraction of a second and no time zone. Many schemas keep a `localDateTime`, or a `localTime`, in a `DATE` column. Reading it, comparing it and writing it work as with a `TIMESTAMP`, but the getters of the time fail, because Oracle's `extract` reads a `DATE` as a date without time, and `to_char` has no fraction of a second for it:

| Getter | SQL written for a `DATE` column `starts_at` | Oracle answers |
|---|---|---|
| `getFullYear`, `getMonth`, `getDate`, `getDay` | `extract(year from starts_at)`, … | The value |
| `getHours`, `getMinutes`, `getSeconds` | `extract(hour from starts_at)`, … | `ORA-30076: invalid extract field for extract source` |
| `getMilliseconds`, `getTime` | `to_char(starts_at, 'FF3')`, … | `ORA-01821: date format not recognized` |

Declare that column with an `OracleDateAsTimestampTypeAdapter`, as the third argument of the column, on a `localDateTime` or a `localTime`, required or optional:

```ts
import { OracleDateAsTimestampTypeAdapter } from "ts-sql-query/oracle";

const tMeeting = new class TMeeting extends Table<DBConnection, 'TMeeting'> {
    id = this.primaryKey('id', 'int')
    startsAt = this.column('starts_at', 'localDateTime', new OracleDateAsTimestampTypeAdapter())
    endsAt = this.optionalColumn('ends_at', 'localDateTime', new OracleDateAsTimestampTypeAdapter())
    reminderTime = this.column('reminder_time', 'localTime', new OracleDateAsTimestampTypeAdapter())
    constructor() {
        super('meeting'); // table name in the database
    }
}()
```

The getters of the time write the column as `cast(starts_at as timestamp)`, a `TIMESTAMP` with the same digits and the fraction at zero, and `getTime` counts the `DATE` itself. Everywhere else the column is written as it is: in the select list, in a comparison, in an `order by`, and as the column that receives a value. A value compared with the column, or given to it, is sent as a `DATE` when it has no fraction of a second, so an index of the column can be used; with a fraction it is sent as a `TIMESTAMP`, which keeps it in the comparison (`10:00:00` is before `10:00:00.500`). The values sent and received are the same as without the adapter. With a meeting that starts on 2024-03-15 at 09:05:07 and another on 2024-03-18 at 14:40:00:

```ts
const from = new Date('2024-03-15T00:00:00.000Z')

const meetings = connection.selectFrom(tMeeting)
    .where(tMeeting.startsAt.greaterOrEqual(from))
    .select({
        id: tMeeting.id,
        startsAt: tMeeting.startsAt,
        hour: tMeeting.startsAt.getHours(),
        minute: tMeeting.startsAt.getMinutes(),
        time: tMeeting.startsAt.getTime(),
    })
    .orderBy('startsAt')
    .executeSelectMany()
```

```oracle
select id as "id", starts_at as "startsAt", extract(hour from cast(starts_at as timestamp)) as "hour", extract(minute from cast(starts_at as timestamp)) as "minute", round((starts_at - date '1970-01-01') * 86400) * 1000 as "time"
from meeting
where starts_at >= :0
order by "startsAt"
```

And its parameters are: `[ 2024-03-15T00:00:00.000Z ]`

The result is `[ { id: 1, startsAt: 2024-03-15T09:05:07.000Z, hour: 9, minute: 5, time: 1710493507000 }, { id: 2, startsAt: 2024-03-18T14:40:00.000Z, hour: 14, minute: 40, time: 1710772800000 } ]`.

A column of a `with`, or of a subquery used as a table, made from that column is still a `DATE`, and keeps the adapter: its getters of the time cast it too. So do `max`, `min`, `nullIfValue` and an inline select of the column. Oracle's `nvl` has the type of its first operand: `valueWhenNull` of two such columns stays a `DATE` (`nvl(ends_at, starts_at)`) and keeps the adapter, and with a value of another type it writes `nvl(cast(ends_at as timestamp), :0)`, a `TIMESTAMP`, so the value given for the null keeps its fraction of a second. A value with a fraction of a second is stored without it: `10:00:15.723` is stored as `10:00:15`.

```ts
const updated = connection.update(tMeeting)
    .set({
        endsAt: tMeeting.startsAt,
        reminderTime: new Date('1970-01-01T08:45:00.000Z'),
    })
    .where(tMeeting.id.equals(2))
    .executeUpdate()
```

```oracle
update meeting set ends_at = starts_at, reminder_time = :0 where id = :1
```

And its parameters are: `[ 1972-01-01T08:45:00.000Z, 2 ]`

On a column of any other type, the adapter does nothing. A column stored in a `TIMESTAMP` doesn't need it.

## A date and time with its time zone

A `TIMESTAMP WITH TIME ZONE` keeps, with each value, the zone it was written with: an offset like `+09:00`, or a region like `Europe/Madrid`. A `localDateTime` column reads only its instant, because oracledb gives a `Date`, which has no zone (see [The zone stored with each value](../../time-zones.md#4-the-zone-stored-with-each-value)). When the zone is part of the value, like the local time of departure of a flight, declare the column with a [type adapter](../../../advanced/data-types/type-adapters.md) that keeps the value as the text the database writes:

- `transformProjection` has the database give the value as text, with `to_char`, in the columns of the result (also those of a `returning`) and inside the JSON of an aggregated array (see [The SQL of a value read from the database](../../../advanced/data-types/type-adapters.md#the-sql-of-a-value-read-from-the-database)).
- `transformPlaceholder` converts the text sent with `to_timestamp_tz`, which reads an offset or a region.
- `transformProjection` also says, in its context, that the converted SQL compares as `'none'`: the text doesn't compare as the instant (the same instant written with two offsets is two texts), nor order as it, so the query compares and orders the values (see [How the converted SQL compares](../../../advanced/data-types/type-adapters.md#how-the-converted-sql-compares)).
- `transformValueFromDB` and `transformValueToDB` keep the text as the value.

The column is a `ComparableType` of `string`: it can be compared and ordered, its values aren't converted by the library, and the text is sent as text.

<!-- doc-code-snippet-template: oracle -->
```ts
import type { DefaultTypeAdapter, TypeAdapter, TypeAdapterPlaceholderContext, TypeAdapterProjectionContext, TypeAdapterValueFromDBContext, TypeAdapterValueToDBContext } from "ts-sql-query"

// A date and time with the zone it was written with, as text, like '2024-07-01T10:30:15.123456000+09:00'
type ZonedDateTime = string

class ZonedDateTimeTypeAdapter implements TypeAdapter {
    transformValueFromDB(value: unknown, context: TypeAdapterValueFromDBContext, next: DefaultTypeAdapter): unknown {
        if (context.requestedType.type === 'ZonedDateTime') {
            return value // the text, or null
        }
        return next.transformValueFromDB(value, context)
    }

    transformValueToDB(value: unknown, context: TypeAdapterValueToDBContext, next: DefaultTypeAdapter): unknown {
        if (context.requestedType.type === 'ZonedDateTime') {
            return value
        }
        return next.transformValueToDB(value, context)
    }

    transformPlaceholder(placeholder: string, context: TypeAdapterPlaceholderContext, next: DefaultTypeAdapter): string {
        if (context.requestedType.type === 'ZonedDateTime') {
            return "to_timestamp_tz(" + placeholder + ", 'YYYY-MM-DD\"T\"HH24:MI:SS.FF TZR')"
        }
        return next.transformPlaceholder(placeholder, context)
    }

    transformProjection(sql: string, context: TypeAdapterProjectionContext, next: DefaultTypeAdapter): string {
        if (context.requestedType.type === 'ZonedDateTime') {
            context.comparison = 'none'
        }
        if (context.requestedType.type === 'ZonedDateTime' && (context.output === 'resultColumn' || context.output === 'aggregatedArrayValue')) {
            return "to_char(" + sql + ", 'YYYY-MM-DD\"T\"HH24:MI:SS.FF9TZH:TZM')"
        }
        return next.transformProjection(sql, context)
    }
}

abstract class ZonedDateTimeType extends ComparableType<ZonedDateTime, 'ZonedDateTime'> {
    static override readonly type = 'ZonedDateTime'
}

const tFlight = new class TFlight extends Table<DBConnection, 'TFlight'> {
    id = this.primaryKey('id', 'int')
    departsAt = this.column('departs_at', ZonedDateTimeType, new ZonedDateTimeTypeAdapter())
    constructor() {
        super('flight'); // table name in the database
    }
}()
```

With three flights: 1 departs on 2024-07-01 at 10:30:15.123456 `+09:00`, 2 at the same instant written with `+00:00` (01:30:15.123456), and 3 on 2024-06-30 at 22:00 `-05:00`, which is 03:00 UTC:

```ts
const flights = connection.selectFrom(tFlight)
    .select({
        id: tFlight.id,
        departsAt: tFlight.departsAt,
    })
    .orderBy('departsAt')
    .orderBy('id')
    .executeSelectMany()
```

```oracle
select id as "id", to_char(departs_at, 'YYYY-MM-DD"T"HH24:MI:SS.FF9TZH:TZM') as "departsAt"
from flight
order by flight.departs_at, "id"
```

And its parameters are: `[]`

The result is `[ { id: 1, departsAt: '2024-07-01T10:30:15.123456000+09:00' }, { id: 2, departsAt: '2024-07-01T01:30:15.123456000+00:00' }, { id: 3, departsAt: '2024-06-30T22:00:00.000000000-05:00' } ]`: each value with its offset, ordered by the instant. Ordered by the text, flight 3 would come first.

The text read has the nine digits of the fraction of a second (`FF9`). Outside the result, the column keeps its SQL: the `where`, the `order by` (which writes the column, not its alias) and the `group by` use the value, and Oracle compares two values by their instants. `tFlight.departsAt.equals('2024-07-01T01:30:15.123456+00:00')` finds flights 1 and 2, and so does the same instant written `'2024-07-01T03:30:15.123456 Europe/Madrid'`; `tFlight.departsAt.lessThan('2024-07-01T02:00:00+00:00')` doesn't find flight 3, although its text is the smallest.

A `union` or a `selectDistinct` of the column compares the instants too. Flights 1 and 2 depart at the same instant:

```ts
const departures = connection.selectDistinctFrom(tFlight)
    .where(tFlight.id.in([1, 2]))
    .selectOneColumn(tFlight.departsAt)
    .executeSelectMany()
```

```oracle
select to_char(o_1_."result", 'YYYY-MM-DD"T"HH24:MI:SS.FF9TZH:TZM') as "result"
from (select distinct departs_at as "result" from flight where id in (:0, :1)) o_1_
```

And its parameters are: `[ 1, 2 ]`

The result is one row, `[ '2024-07-01T10:30:15.123456000+09:00' ]` or `[ '2024-07-01T01:30:15.123456000+00:00' ]`: the distinct is applied to the values, and the select that wraps it converts them. Which of the two texts is kept is up to the database.

A value written keeps the zone of its text:

```ts
const inserted = connection.insertInto(tFlight)
    .set({
        id: 4,
        departsAt: '2024-07-01T10:30:15.123+09:00',
    })
    .executeInsert()
```

```oracle
insert into flight (id, departs_at) values (:0, to_timestamp_tz(:1, 'YYYY-MM-DD"T"HH24:MI:SS.FF TZR'))
```

And its parameters are: `[ 4, '2024-07-01T10:30:15.123+09:00' ]`

Read back, the value is `'2024-07-01T10:30:15.123000000+09:00'`. The format of `to_timestamp_tz` reads an offset written right after the time, like this one, and a region after a space, like `'2024-07-01T07:45:00.5 Europe/Madrid'`. A value assigned from another column of this type keeps the zone of that column, because it doesn't go through the text, and the `returning` of an insert or an update gives the text too.

To keep the name of a region, write `TZR` in the `to_char` instead of `TZH:TZM`, with a space before it (`'YYYY-MM-DD"T"HH24:MI:SS.FF9 TZR'`): a value written with a region is read as `'2024-07-01T07:45:00.000000000 EUROPE/MADRID'`, and one written with an offset as `'2024-06-30T22:00:00.000000000 -05:00'`.

## The comment of the binds

The query runner executes a statement with parameters with a comment at its end that says the type of each one, like `select :0 as "result" from dual /* binds: n */`: a letter for each parameter (`n` a number, `t` a text, `d` a date, `-` a null, …), followed by the times it repeats when it does three or more times (`/* binds: tn500 */`). You see it in what Oracle shows of the statements it runs, like `v$sql`; your logs, interceptors and mocks see the query without it.

oracledb keeps each statement in its statement cache by its text, with the types of its parameters and of the columns of its result the first time it runs. A column that takes the type of a parameter, like a constant selected (`select :0 as "result" from dual`), would be read the next time with that type: a text where a number was read fails with `ORA-01722`, and a number where a text was read comes as a text. With the comment, each combination of types is a statement of its own in the cache, and the cache keeps its size and its default (`stmtCacheSize`).

## Dates before 1582

Oracle counts the dates before 15 October 1582 in the Julian calendar, and a JavaScript `Date` in the Gregorian one for every year. The digits the library sends and reads are the same, but what Oracle computes from a date before that day doesn't agree with JavaScript: `getDay()` of `0999-01-14` is `6` (a Saturday, for Oracle) where the `Date` gives `1` (a Monday), and `getTime()` is five days later than the `Date`'s. The days from 5 to 14 October 1582 don't exist in Oracle: `to_date('1582-10-10', 'YYYY-MM-DD')` is 15 October 1582. The same goes for the durations Oracle computes from such a date, with `until`, `since` or `total`: they count the days of the Julian calendar, where Temporal counts the ones of the Gregorian calendar. Dates from 15 October 1582 on agree.

## The scale of `roundn`

The scale of `roundn` is a whole number of decimals. Oracle truncates a fractional one: its `round(2.345, 1.6)` is `2.3`, rounded to 1 decimal, while PostgreSQL, MySQL and MariaDB round the scale and give `2.35`. ts-sql-query rounds the scale on every database, ties away from zero, so `roundn(1.6)` is 2 decimals here too: a number is sent rounded (`round(:0, :1)` with the params `[2.345, 2]`), and an expression that isn't an integer, like `priority.divide(2)`, is written rounded (`round(<scale>)`). An integer scale is sent and written as it is.

To keep Oracle's native behavior, set `usePlatformDependentRound = true` on the connection: the scale is then sent and written as it is, and Oracle truncates it.

```ts
import { OracleConnection } from "ts-sql-query/oracle";

class DBConnection extends OracleConnection<'DBConnection'> {
    protected override usePlatformDependentRound = true
}
```

## Concatenation and NULL

Oracle reads NULL as the empty string when concatenating, so `'x' || null` is `'x'` and `null || null` is NULL. JavaScript's `null` does not survive the trip:

```sql
'[' || NULL || 'x' || ']'   -- [x]         and  (NULL || 'x') IS NULL  ->  false
```

Every other supported database returns NULL when a concatenation operand is NULL, and that is also what ts-sql-query's type declares: `tIssue.body.concat('!')` on an optional `body` is typed `string | undefined`. Left as Oracle's bare `||` this diverges in two places, and the second is the reason it matters:

- **`concat`** returns a present string where the declared type says the result is optional — `tIssue.body.concat('!')` on a NULL `body` would give `'!'` instead of NULL.
- **The affix predicates** — `startsWith`, `endsWith`, `contains` and their `Insensitive` variants — build their LIKE pattern by concatenation, so a NULL search term would make the pattern `'%'` and **the filter would match every row instead of none**:

```sql
-- rows 'Alpha', 'Beta';  .startsWith(<null term>)
s like (NULL || '%')   ->   s like '%'   ->   both rows
```

**To match the declared type and the other databases, ts-sql-query wraps concatenation in a `CASE` that returns NULL when an operand is NULL** (`concat` and the affix predicates alike — they always move together, since a `startsWith` that propagated NULL while `concat` did not would only relocate the inconsistency):

```sql
-- tIssue.body.concat('!')       (body optional)
case when "body" is null then null else "body" || :0 end
-- title.startsWith(body)        (body optional term) — the pattern is NULL when body is NULL
title like (case when "body" is null then null else "body" || '%' end) escape '\'
```

Only the leanest check the build-time optionality needs is emitted: a concatenation whose operands are all **required** stays the bare `||` (`title || :0`), and a chain null-checks only the operands that can be NULL, once, sharing a single `CASE` (`case when body is null then null else body || :0 || :1 end`).

!!! tip "Only for `concat` — `concatIgnoringNull` is untouched"

    Everything on this section is about `concat`, whose contract is to propagate NULL. When you *want* a NULL operand read as the empty string, use [`concatIgnoringNull`](../../../api/value-expressions.md) instead of reconfiguring the connection: it is a separate operation with its own contract, it emits Oracle's bare `||` (no `CASE`, nothing to opt out of), and the same call means the same thing on every database. The settings below only change how `concat` — and the affix predicates — handle NULL.

### Keeping Oracle's native ignore-NULL behavior

If you prefer Oracle's own semantics — a NULL operand read as the empty string rather than propagated — set `ignoreNullInConcat = true`:

```typescriptreact
import { OracleConnection } from "ts-sql-query/oracle";

class DBConnection extends OracleConnection<'DBConnection'> {
    protected override ignoreNullInConcat = true
}
```

`concat` and the affix predicates then emit the bare native `||` again (`"body" || :0`, `title like ("body" || '%')`).

### Propagating NULL through a function instead of a `CASE`

The default `CASE` repeats each optional operand (once in the null check, once in `||`) — free for a column, but not for an expensive value-source receiver. Set `concatFunction` to the name of a null-propagating function you created and **every** concatenation the builder emits — `concat` and the affix patterns alike — goes through `func(a, b)` instead, each operand appearing once:

```typescriptreact
import { OracleConnection } from "ts-sql-query/oracle";

class DBConnection extends OracleConnection<'DBConnection'> {
    protected override concatFunction = 'tsq_string_util.concat_strict'
}
```

The name is yours; the one above is only what this page's example calls it. Create it in the database, as a package: its code is in [Oracle functions](functions.md#the-function-of-concatfunction).

With the option set, the emitted SQL calls it on both halves, each operand appearing once:

```sql
select tsq_string_util.concat_strict("body", :0) as "tagged" from issue where id = :1
select id from issue where title like tsq_string_util.concat_strict(:0, '%') escape '\'
```

!!! tip "Which of the three to pick"

    Leave both options unset and the default `CASE` matches the declared type and the other databases — the right choice for a portable application, where a NULL reaching a `concat` or an affix filter would otherwise go unnoticed until the whole-table match above surfaces as a production bug. Reach for `concatFunction` when you want that same NULL propagation but the repeated operand is expensive enough to matter. Reach for `ignoreNullInConcat` only when you specifically want Oracle's native ignore-NULL semantics back.

## Collations & case sensitivity

Oracle's default collation is **`BINARY`** — case- and accent-**sensitive**, the JavaScript-sensible default, so no configuration is needed unless you want the insensitive direction. The plain string operations follow the session collation; the `*Insensitive` operations force case-insensitivity over it. Oracle has a **session collation that reaches everything** (`ALTER SESSION SET NLS_COMP = LINGUISTIC; NLS_SORT = <coll>`), which flips `equals` / `like` / `distinct` / `order` session-wide; you can also force a collation per value with `.collate('<name>')` or connection-wide with `insensitiveCollation`. See the dedicated [Collations & case sensitivity](../../collations.md) page and the [Oracle tab](../../collations.md#per-database) for the collation names (e.g. `binary_ci`, `binary_ai`).

### `replaceAll` and collation

`.replaceAll(search, replacement)` mirrors JavaScript's `String.replaceAll`, which is case-**sensitive**. Oracle's `REPLACE()` resolves its search argument under the **session collation**, so on a database configured case-insensitive (`NLS_COMP = LINGUISTIC` with a `_CI` / `_AI` sort) a bare `replace('ABCabc', 'abc', 'X')` returns `'XX'`, corrupting the value:

```sql
replace('ABCabc', 'abc', 'X')                                                      -- XX (under a CI session)
replace('ABCabc' collate BINARY, 'abc' collate BINARY, 'X') collate USING_NLS_COMP -- ABCX
```

To prevent that, ts-sql-query forces a binary / code-point collation on the match operands **by default** (`BINARY`) and resets the result to `USING_NLS_COMP` so the forced collation does not leak into a chained comparison. `replaceAll` is therefore code-point exact whatever the session collation. The collation is controlled by the **`replaceCollation`** property:

```typescriptreact
import { OracleConnection } from "ts-sql-query/oracle";

class DBConnection extends OracleConnection<'DBConnection'> {
    override replaceCollation = '' // opt out — follow the session collation
}
```

Set it to another collation name to force a different one, or to the empty string (`''`) to opt out and emit the bare native `replace(...)`.

For a deliberately **case-insensitive** replace, use [`.replaceAllInsensitive(...)`](../../collations.md#replaceallinsensitive-the-insensitive-twin) instead. Because Oracle's default is case-sensitive, it forces a case-insensitive collation on the operands: `insensitiveCollation` when it names one, otherwise the **`replaceInsensitiveCollation`** property, which defaults to Oracle's neutral `BINARY_CI`:

```ts
import { OracleConnection } from "ts-sql-query/oracle";

class DBConnection extends OracleConnection<'DBConnection'> {
    protected override replaceInsensitiveCollation = 'BINARY_AI' // also fold accents; '' opts out
}
```

Set `replaceInsensitiveCollation` (or `insensitiveCollation`) to `''` to opt out to the bare native `replace(...)`. Full detail on the [Collations page](../../collations.md#replacecollation-sql-server-and-oracle).

## UUID strategies

`ts-sql-query` provides different strategies to handle UUID values in Oracle. These strategies control how UUID values are represented in JavaScript and stored in the database. In every case, UUIDs are exchanged as `string` at the JavaScript layer.

- `'built-in'` *(default strategy)*: UUIDs are stored as `RAW(16)` and converted using Oracle's built-in `UUID_TO_RAW` / `RAW_TO_UUID` functions, available since **Oracle Database 23ai (23.9)**. The bytes are stored in canonical order. Note that these built-ins validate the value through Oracle's `IS_UUID` check, which **accepts only version-4 UUIDs**: a non-v4 value (v1, v7, …) is rejected at runtime with `ORA-62432: … is not a valid UUID value`. Use this strategy when your application uses **UUID v4**; for any other version (including v7) use `'custom-functions'`.
- `'custom-functions'`: the same `RAW(16)`, but `ts-sql-query` calls the functions of the library `tsq_uuid_to_raw` and `tsq_raw_to_uuid`, which keep the 16 bytes as they are for any version of uuid and on any version of Oracle (see [Oracle functions](functions.md#tsq_uuid_to_raw-and-tsq_raw_to_uuid)). Use it before Oracle 23.9, which has no built-in functions, or for a uuid that isn't version 4, like version 7.
- `'string'`: UUIDs are stored as text in character-based columns such as `CHAR(36)` or `VARCHAR2(36)`. No conversion functions are involved. The library sends and reads the text of a uuid in lower case, the case the other strategies and databases give it: a uuid sent in upper case is stored and read in lower case, and an equality with it finds the uuid stored by the library.
- `'string as sent'`: as `'string'`, but the text of a uuid is sent and read as it is, in the case it has. A uuid stored in upper case is read in upper case, and an equality compares the text as the column's collation does. Choose it for a column that other applications fill in upper case and compare as it is.

You can configure the strategy by overriding the `uuidStrategy` field in your connection class:

```typescriptreact
import { OracleConnection } from "ts-sql-query/oracle";

class DBConnection extends OracleConnection<'DBConnection'> {
    protected override uuidStrategy = 'string' as const
}
```

!!! tip "Generating UUIDs"

    For **chronologically sortable** primary keys, generate **UUID v7** in the application and use the `'custom-functions'` strategy: it keeps the 16 bytes as they are, so v7's leading timestamp keeps the inserts at the end of the index of the primary key. The default `'built-in'` strategy can't store a v7 (or v1) uuid: Oracle's `UUID_TO_RAW` accepts version 4 only and rejects the others with `ORA-62432`. With **UUID v4** (random, no clustering benefit) `'built-in'` works as it is; Oracle 23.9 also has a `UUID()` function that gives a v4, useful as the `DEFAULT` of a column. There is no server-side v7 generator. See the [column types](../../data-types.md) page for more context.
