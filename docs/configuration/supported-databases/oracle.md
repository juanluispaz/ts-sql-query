---
search:
  boost: 0.59
---
<!-- doc-code-template: oracle -->
# Oracle

This page has what is particular to Oracle: what it offers and what it doesn't, how to declare its version, [how a boolean is stored](#how-a-boolean-is-stored), [a date and time in a `DATE` column](#a-date-and-time-in-a-date-column), [dates before 1582](#dates-before-1582), how `concat` treats `null`, `replaceAll`, and the UUID strategies. To define the connection and map your tables, the pages to read are [Connection](../connection.md) and [Mapping](../mapping.md).

## Defining the connection

```ts
import { OracleConnection } from "ts-sql-query/connections/OracleConnection";

class DBConnection extends OracleConnection<'DBConnection'> { }
```

Create a connection object for each request, and don't share it between concurrent requests: see [Instantiating the connection](../connection.md#instantiating-the-connection-with-the-database-connection).

## What it offers and what it doesn't

What isn't offered doesn't compile on this connection. On a version older than the one shown, the database rejects the query. Each link goes to the page that explains the feature, with all the databases side by side.

| What | On this database |
|---|---|
| [`returning` in an insert](../../queries/insert.md#availability-per-database) | Yes, written as `returning into`; not from a select |
| [`returning` in an update](../../queries/update.md#availability-in-each-database) | Yes, written as `returning into` |
| [`returning` in a delete](../../queries/delete.md#availability-in-each-database) | Yes, written as `returning into` |
| [`oldValues()` in an update](../../queries/update.md#availability-in-each-database) | Not offered |
| [Insert on conflict](../../queries/insert-on-conflict.md#what-each-database-offers) | Not offered |
| Other tables in an [update](../../queries/update.md#availability-in-each-database) or a [delete](../../queries/delete.md#availability-in-each-database) | `from` and `using` from Oracle 23ai. A join right after `update` or `deleteFrom` isn't offered |
| [Compound queries](../../queries/compound-select.md#availability-in-each-database) | All of them, written with `minus` for `except` |
| [Recursive queries](../../queries/recursive-select.md#availability-in-each-database) | `recursiveUnionAll`, and `startWith` and `connectBy`. `recursiveUnion` isn't offered |
| [Arrays of objects from an aggregate](../../queries/aggregate-as-object-array.md#availability-in-each-database) | Yes. The `Distinct` versions aren't offered |
| [`stringConcatDistinct`, `anyValue`](../../queries/aggregate-and-group-by.md#how-each-function-is-written-in-each-database) | Yes; `stringConcatDistinct` needs Oracle 19c |
| [Sequences](../mapping.md#using-a-sequence) | Yes |
| [Stored procedures](../mapping.md#calling-a-stored-procedure) and [functions](../mapping.md#calling-a-function-of-the-database) | Yes |
| [Isolation levels](../../queries/transaction.md#what-each-database-offers) | `read committed`, `snapshot` |

## Compatibility version

The `compatibilityVersion` property says which Oracle Database version the SQL must work on, encoded as the integer `major * 1_000_000 + minor * 1_000 + patch` — e.g. `23_009_000` for Oracle Database 23.9. The default is `Number.POSITIVE_INFINITY` (latest).

Recognized breakpoints:

- `compatibilityVersion >= 23_004_000` (Oracle Database 23ai): the [`Values`](../mapping.md#mapping-constant-values-as-view) feature emits the SQL-standard `WITH name(cols) AS (VALUES (…), …)` table constructor introduced in 23ai. On earlier Oracle versions ts-sql-query emulates it as `WITH name(cols) AS (SELECT … FROM dual UNION ALL SELECT … FROM dual)` so the feature still works.

On older Oracle versions, set `compatibilityVersion` to your actual version so the right emulation is chosen automatically. It is recommended to keep this value in sync with your real database version so future ts-sql-query releases that gate additional features on it pick the right behavior automatically.

```ts
import { OracleConnection } from "ts-sql-query/connections/OracleConnection";

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
import { OracleConnection } from "ts-sql-query/connections/OracleConnection";

class DBConnection extends OracleConnection<'DBConnection'> {
    protected override booleanStorage: 'number' | 'boolean' = 'boolean'
}
```

A column stored the other way is declared with a [custom boolean](../../advanced/custom-booleans-values.md): with `'boolean'`, a `NUMBER(1)` column takes `new CustomBooleanTypeAdapter(1, 0)`; with `'number'`, a `CHAR(1)` column with `'Y'` and `'N'` takes `new CustomBooleanTypeAdapter('Y', 'N')`. The library then writes that column in the form you chose wherever it's used as a boolean, so it can be compared, combined and assigned with the other boolean columns: with `'boolean'`, a `NUMBER(1)` column `invoiced` is read as `(invoiced = 1)`, and `select billable ... union select (invoiced = 1) ...` works. Without the custom boolean, Oracle rejects a `NUMBER(1)` and a `BOOLEAN` in the two sides of a `union` (`ORA-01790`).

## A date and time in a `DATE` column

An Oracle `DATE` holds a date and a time to the second, with no fraction of a second and no time zone. Many schemas keep a `localDateTime`, or a `localTime`, in a `DATE` column. Reading it, comparing it and writing it work as with a `TIMESTAMP`, but the getters of the time fail, because Oracle's `extract` reads a `DATE` as a date without time, and `to_char` has no fraction of a second for it:

| Getter | SQL written for a `DATE` column `starts_at` | Oracle answers |
|---|---|---|
| `getFullYear`, `getMonth`, `getDate`, `getDay` | `extract(year from starts_at)`, … | The value |
| `getHours`, `getMinutes`, `getSeconds` | `extract(hour from starts_at)`, … | `ORA-30076: invalid extract field for extract source` |
| `getMilliseconds`, `getTime` | `to_char(starts_at, 'FF3')`, … | `ORA-01821: date format not recognized` |

Declare that column with an `OracleDateAsTimestampTypeAdapter`, as the third argument of the column, on a `localDateTime` or a `localTime`, required or optional:

```ts
import { OracleDateAsTimestampTypeAdapter } from "ts-sql-query/TypeAdapter";

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

And its parameters are: `[ 1970-01-01T08:45:00.000Z, 2 ]`

On a column of any other type, the adapter does nothing. A column stored in a `TIMESTAMP` doesn't need it.

## A date and time with its time zone

A `TIMESTAMP WITH TIME ZONE` keeps, with each value, the zone it was written with: an offset like `+09:00`, or a region like `Europe/Madrid`. A `localDateTime` column reads only its instant, because oracledb gives a `Date`, which has no zone (see [The zone stored with each value](../time-zones.md#4-the-zone-stored-with-each-value)). When the zone is part of the value, like the local time of departure of a flight, declare the column with a [type adapter](../column-types.md#type-adapters) that keeps the value as the text the database writes:

- `transformProjection` has the database give the value as text, with `to_char`, in the columns of the result (also those of a `returning`) and inside the JSON of an aggregated array (see [The SQL of a value read from the database](../column-types.md#the-sql-of-a-value-read-from-the-database)).
- `transformPlaceholder` converts the text sent with `to_timestamp_tz`, which reads an offset or a region.
- `projectionComparison` returns `'none'`: the text doesn't compare as the instant (the same instant written with two offsets is two texts), nor order as it, so the query compares and orders the values (see [How the converted SQL compares](../column-types.md#how-the-converted-sql-compares)).
- `transformValueFromDB` and `transformValueToDB` keep the text as the value.

The column is a `customComparable` of `string`: it can be compared and ordered, its values aren't converted by the library, and the text is sent as text.

<!-- doc-code-snippet-template: oracle -->
```ts
import type { DefaultTypeAdapter, ProjectionComparison, ProjectionOutput, TypeAdapter, TypeCategory } from "ts-sql-query" // or "ts-sql-query/TypeAdapter"

// A date and time with the zone it was written with, as text, like '2024-07-01T10:30:15.123456000+09:00'
type ZonedDateTime = string

class ZonedDateTimeTypeAdapter implements TypeAdapter {
    transformValueFromDB(value: unknown, type: string, typeCategory: TypeCategory, next: DefaultTypeAdapter): unknown {
        if (type === 'ZonedDateTime') {
            return value // the text, or null
        }
        return next.transformValueFromDB(value, type, typeCategory)
    }

    transformValueToDB(value: unknown, type: string, typeCategory: TypeCategory, next: DefaultTypeAdapter): unknown {
        if (type === 'ZonedDateTime') {
            return value
        }
        return next.transformValueToDB(value, type, typeCategory)
    }

    transformPlaceholder(placeholder: string, type: string, typeCategory: TypeCategory, valueSentToDB: unknown, next: DefaultTypeAdapter): string {
        if (type === 'ZonedDateTime') {
            return "to_timestamp_tz(" + placeholder + ", 'YYYY-MM-DD\"T\"HH24:MI:SS.FF TZR')"
        }
        return next.transformPlaceholder(placeholder, type, typeCategory, valueSentToDB)
    }

    transformProjection(sql: string, type: string, typeCategory: TypeCategory, output: ProjectionOutput, next: DefaultTypeAdapter): string {
        if (type === 'ZonedDateTime' && (output === 'resultColumn' || output === 'aggregatedArrayValue')) {
            return "to_char(" + sql + ", 'YYYY-MM-DD\"T\"HH24:MI:SS.FF9TZH:TZM')"
        }
        return next.transformProjection(sql, type, typeCategory, output)
    }

    projectionComparison(type: string, typeCategory: TypeCategory, output: ProjectionOutput, next: DefaultTypeAdapter): ProjectionComparison {
        if (type === 'ZonedDateTime') {
            // The same instant written with two zones is two texts, and the texts don't order as the instants
            return 'none'
        }
        return next.projectionComparison(type, typeCategory, output)
    }
}

const tFlight = new class TFlight extends Table<DBConnection, 'TFlight'> {
    id = this.primaryKey('id', 'int')
    departsAt = this.column<ZonedDateTime, 'ZonedDateTime'>('departs_at', 'customComparable', 'ZonedDateTime', new ZonedDateTimeTypeAdapter())
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

## Dates before 1582

Oracle counts the dates before 15 October 1582 in the Julian calendar, and a JavaScript `Date` in the Gregorian one for every year. The digits the library sends and reads are the same, but what Oracle computes from a date before that day doesn't agree with JavaScript: `getDay()` of `0999-01-14` is `6` (a Saturday, for Oracle) where the `Date` gives `1` (a Monday), and `getTime()` is five days later than the `Date`'s. The days from 5 to 14 October 1582 don't exist in Oracle: `to_date('1582-10-10', 'YYYY-MM-DD')` is 15 October 1582. Dates from 15 October 1582 on agree.

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

    Everything on this section is about `concat`, whose contract is to propagate NULL. When you *want* a NULL operand read as the empty string, use [`concatIgnoringNull`](../../api/value-expressions.md) instead of reconfiguring the connection: it is a separate operation with its own contract, it emits Oracle's bare `||` (no `CASE`, nothing to opt out of), and the same call means the same thing on every database. The settings below only change how `concat` — and the affix predicates — handle NULL.

### Keeping Oracle's native ignore-NULL behavior

If you prefer Oracle's own semantics — a NULL operand read as the empty string rather than propagated — set `ignoreNullInConcat = true`:

```typescriptreact
import { OracleConnection } from "ts-sql-query/connections/OracleConnection";

class DBConnection extends OracleConnection<'DBConnection'> {
    protected override ignoreNullInConcat = true
}
```

`concat` and the affix predicates then emit the bare native `||` again (`"body" || :0`, `title like ("body" || '%')`).

### Propagating NULL through a function instead of a `CASE`

The default `CASE` repeats each optional operand (once in the null check, once in `||`) — free for a column, but not for an expensive value-source receiver. Set `concatFunction` to the name of a null-propagating function you created and **every** concatenation the builder emits — `concat` and the affix patterns alike — goes through `func(a, b)` instead, each operand appearing once:

```typescriptreact
import { OracleConnection } from "ts-sql-query/connections/OracleConnection";

class DBConnection extends OracleConnection<'DBConnection'> {
    protected override concatFunction = 'string_util.concat_strict'
}
```

The name is yours; the one above is only what this page's example calls it.

!!! warning "It must be a package, not a standalone function"

    Oracle cannot overload standalone subprograms — a second `CREATE OR REPLACE FUNCTION` of the same name **replaces** the first. Overloads live in a package, and you want the overloads: without them a `CLOB` argument is implicitly converted to `VARCHAR2` and silently truncated at 32767 characters.

    Four overloads, not two. With only `(VARCHAR2, VARCHAR2)` and `(CLOB, CLOB)`, Oracle cannot resolve the commonest call of all — a `CLOB` column against a `VARCHAR2` literal — and raises `ORA-06553: PLS-307: too many declarations of ... match this call`. The two mixed overloads are what make it resolvable. `NVARCHAR2` and `NCLOB` arguments reach these through implicit conversion and need no overloads of their own.

```oracle
CREATE OR REPLACE PACKAGE string_util AS
    FUNCTION concat_strict(a IN VARCHAR2, b IN VARCHAR2) RETURN VARCHAR2;
    FUNCTION concat_strict(a IN CLOB, b IN CLOB) RETURN CLOB;
    FUNCTION concat_strict(a IN CLOB, b IN VARCHAR2) RETURN CLOB;
    FUNCTION concat_strict(a IN VARCHAR2, b IN CLOB) RETURN CLOB;
END string_util;

CREATE OR REPLACE PACKAGE BODY string_util AS
    FUNCTION concat_strict(a IN VARCHAR2, b IN VARCHAR2) RETURN VARCHAR2 IS
    BEGIN
        IF a IS NULL OR b IS NULL THEN RETURN NULL; END IF;
        RETURN a || b;
    END;
    FUNCTION concat_strict(a IN CLOB, b IN CLOB) RETURN CLOB IS
    BEGIN
        IF a IS NULL OR b IS NULL THEN RETURN NULL; END IF;
        RETURN a || b;
    END;
    FUNCTION concat_strict(a IN CLOB, b IN VARCHAR2) RETURN CLOB IS
    BEGIN
        IF a IS NULL OR b IS NULL THEN RETURN NULL; END IF;
        RETURN a || b;
    END;
    FUNCTION concat_strict(a IN VARCHAR2, b IN CLOB) RETURN CLOB IS
    BEGIN
        IF a IS NULL OR b IS NULL THEN RETURN NULL; END IF;
        RETURN a || b;
    END;
END string_util;
```

With the option set, the emitted SQL calls it on both halves, each operand appearing once:

```sql
select string_util.concat_strict("body", :0) as "tagged" from issue where id = :1
select id from issue where title like string_util.concat_strict(:0, '%') escape '\'
```

!!! tip "Which of the three to pick"

    Leave both options unset and the default `CASE` matches the declared type and the other databases — the right choice for a portable application, where a NULL reaching a `concat` or an affix filter would otherwise go unnoticed until the whole-table match above surfaces as a production bug. Reach for `concatFunction` when you want that same NULL propagation but the repeated operand is expensive enough to matter. Reach for `ignoreNullInConcat` only when you specifically want Oracle's native ignore-NULL semantics back.

## Collations & case sensitivity

Oracle's default collation is **`BINARY`** — case- and accent-**sensitive**, the JavaScript-sensible default, so no configuration is needed unless you want the insensitive direction. The plain string operations follow the session collation; the `*Insensitive` operations force case-insensitivity over it. Oracle has a **session collation that reaches everything** (`ALTER SESSION SET NLS_COMP = LINGUISTIC; NLS_SORT = <coll>`), which flips `equals` / `like` / `distinct` / `order` session-wide; you can also force a collation per value with `.collate('<name>')` or connection-wide with `insensitiveCollation`. See the dedicated [Collations & case sensitivity](../collations.md) page and the [Oracle tab](../collations.md#per-database) for the collation names (e.g. `binary_ci`, `binary_ai`).

### `replaceAll` and collation

`.replaceAll(search, replacement)` mirrors JavaScript's `String.replaceAll`, which is case-**sensitive**. Oracle's `REPLACE()` resolves its search argument under the **session collation**, so on a database configured case-insensitive (`NLS_COMP = LINGUISTIC` with a `_CI` / `_AI` sort) a bare `replace('ABCabc', 'abc', 'X')` returns `'XX'`, corrupting the value:

```sql
replace('ABCabc', 'abc', 'X')                                                      -- XX (under a CI session)
replace('ABCabc' collate BINARY, 'abc' collate BINARY, 'X') collate USING_NLS_COMP -- ABCX
```

To prevent that, ts-sql-query forces a binary / code-point collation on the match operands **by default** (`BINARY`) and resets the result to `USING_NLS_COMP` so the forced collation does not leak into a chained comparison. `replaceAll` is therefore code-point exact whatever the session collation. The collation is controlled by the **`replaceCollation`** property:

```typescriptreact
import { OracleConnection } from "ts-sql-query/connections/OracleConnection";

class DBConnection extends OracleConnection<'DBConnection'> {
    override replaceCollation = '' // opt out — follow the session collation
}
```

Set it to another collation name to force a different one, or to the empty string (`''`) to opt out and emit the bare native `replace(...)`.

For a deliberately **case-insensitive** replace, use [`.replaceAllInsensitive(...)`](../collations.md#replaceallinsensitive-the-insensitive-twin) instead. Because Oracle's default is case-sensitive, it forces a case-insensitive collation on the operands: `insensitiveCollation` when it names one, otherwise the **`replaceInsensitiveCollation`** property, which defaults to Oracle's neutral `BINARY_CI`:

```ts
import { OracleConnection } from "ts-sql-query/connections/OracleConnection";

class DBConnection extends OracleConnection<'DBConnection'> {
    protected override replaceInsensitiveCollation = 'BINARY_AI' // also fold accents; '' opts out
}
```

Set `replaceInsensitiveCollation` (or `insensitiveCollation`) to `''` to opt out to the bare native `replace(...)`. Full detail on the [Collations page](../collations.md#replacecollation-sql-server-and-oracle).

## UUID strategies

`ts-sql-query` provides different strategies to handle UUID values in Oracle. These strategies control how UUID values are represented in JavaScript and stored in the database. In every case, UUIDs are exchanged as `string` at the JavaScript layer.

- `'built-in'` *(default strategy)*: UUIDs are stored as `RAW(16)` and converted using Oracle's built-in `UUID_TO_RAW` / `RAW_TO_UUID` functions, available since **Oracle Database 23ai (23.9)**. The bytes are stored in canonical order. Note that these built-ins validate the value through Oracle's `IS_UUID` check, which **accepts only version-4 UUIDs**: a non-v4 value (v1, v7, …) is rejected at runtime with `ORA-62432: … is not a valid UUID value`. Use this strategy when your application uses **UUID v4**; for any other version (including v7) use `'custom-functions'`.
- `'custom-functions'`: same `RAW(16)` storage, but `ts-sql-query` calls user-provided functions named `uuid_to_raw` and `raw_to_uuid` instead. Use this option on Oracle versions older than 23.9 (where the built-ins don't exist), when you need a UUID version the built-ins reject (such as **v7** or v1), or when you want to inject your own conversion logic — for example, the v1-style byte reordering shown below. Because these functions do the conversion themselves, they accept any UUID version. Oracle resolves identifiers case-insensitively, so the names match the built-ins on 23.9+ and your functions take precedence over them if both exist.
- `'string'`: UUIDs are stored as text in character-based columns such as `CHAR(36)` or `VARCHAR2(36)`. No conversion functions are involved.

You can configure the strategy by overriding the `uuidStrategy` field in your connection class:

```typescriptreact
import { OracleConnection } from "ts-sql-query/connections/OracleConnection";

class DBConnection extends OracleConnection<'DBConnection'> {
    protected override uuidStrategy = 'string' as const
}
```

!!! tip "Generating UUIDs"

    For **chronologically sortable** primary keys, generate **UUID v7** and use the `'custom-functions'` strategy with the canonical implementation shown in [UUID utility functions for Oracle](#uuid-utility-functions-for-oracle): it stores the 16 bytes as-is, so v7's leading timestamp keeps inserts clustered at the end of the primary-key index. The default `'built-in'` strategy **cannot** store v7 (or v1) values — Oracle's `UUID_TO_RAW` only accepts v4 and rejects other versions with `ORA-62432`. If you use **UUID v4** (random, no clustering benefit), the `'built-in'` strategy works out of the box; Oracle 23ai (23.9)+ also provides a server-side `UUID()` function that returns v4 — useful if you want the database to generate the value as a column `DEFAULT`. There is no server-side v7 generator, so v7 must be generated in the application. See the [column types](../column-types.md) page for more context.

## UUID utility functions for Oracle

The `'custom-functions'` strategy requires the `uuid_to_raw` and `raw_to_uuid` functions to exist in the database. Two implementations are documented below — pick the one that matches the UUID version your application generates, since each preserves the time-ordering of a different version. The `'built-in'` strategy doesn't need either implementation, because Oracle 23ai (23.9)+ already ships built-ins that behave like the canonical (non-reordering) variant — but those built-ins accept **only version-4 UUIDs**, so reach for `'custom-functions'` (the canonical implementation below) whenever you store v7 or v1 values.

### For UUID v7 (or UUID v4) — preserve canonical byte order

UUID v7 already places the 48-bit timestamp at the start of the value, so storing the bytes as-is yields a chronologically sortable `RAW(16)`. UUID v4 is random, so byte ordering is irrelevant. **This is the recommended implementation for new applications:**

```oracle
CREATE FUNCTION uuid_to_raw(uuid IN char) RETURN raw AS
BEGIN 
    RETURN HEXTORAW(REPLACE(uuid, '-'));
END uuid_to_raw;

CREATE FUNCTION raw_to_uuid(raw_uuid IN raw) RETURN char IS
	hex_text char(32);
BEGIN 
	hex_text := RAWTOHEX(raw_uuid);
    -- If you want the lower-case version wrap the expression in lower( ... )
    RETURN SUBSTR (hex_text, 1, 8) || '-' || 
           SUBSTR (hex_text, 9, 4) || '-' || 
           SUBSTR (hex_text, 13, 4) || '-' || 
           SUBSTR (hex_text, 17, 4) || '-' || 
           SUBSTR (hex_text, 21);
END raw_to_uuid;
```

### For UUID v1 — reorder bytes so the timestamp segment sorts first

UUID v1 places the 60-bit timestamp split across the `time-low`, `time-mid` and `time-hi` fields, with `time-low` at the start of the string but the most-significant bits sitting in `time-hi`. To make a v1 UUID sortable inside `RAW(16)`, the fields are rearranged on store and put back on read. **Use this only if your application generates UUID v1; it will scramble v7's timestamp prefix.**

```oracle
CREATE FUNCTION uuid_to_raw(uuid IN char) RETURN raw IS
	hex_text nvarchar2(36);
BEGIN 
	hex_text := REPLACE(uuid, '-');
	RETURN HEXTORAW(SUBSTR (hex_text, 13, 4) || 
                    SUBSTR (hex_text, 9, 4) || 
                    SUBSTR (hex_text, 0, 8) || 
                    SUBSTR (hex_text, 17));
END uuid_to_raw;

CREATE FUNCTION raw_to_uuid(raw_uuid IN raw) RETURN char IS
	hex_text char(32);
BEGIN 
	hex_text := RAWTOHEX(raw_uuid);
    -- If you want the lower-case version wrap the expression in lower( ... )
    RETURN SUBSTR (hex_text, 9, 8) || '-' || 
           SUBSTR (hex_text, 5, 4) || '-' || 
           SUBSTR (hex_text, 0, 4) || '-' || 
           SUBSTR (hex_text, 17, 4) || '-' || 
           SUBSTR (hex_text, 21);
END raw_to_uuid;
```
