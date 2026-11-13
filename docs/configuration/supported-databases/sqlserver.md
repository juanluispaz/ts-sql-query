---
search:
  boost: 0.59
---
<!-- doc-code-template: sqlserver -->
# SQL Server

This page has what is particular to SQL Server: what it offers and what it doesn't, how to declare its version, how a boolean is stored, `.length()`, how `minValue` and `maxValue` treat `null`, `replaceAll`, and UUIDs. To define the connection and map your tables, the pages to read are [Connection](../connection.md) and [Mapping](../mapping.md).

## Defining the connection

```ts
import { SqlServerConnection } from "ts-sql-query/sqlserver";

class DBConnection extends SqlServerConnection<'DBConnection'> { }
```

Create a connection object for each request, and don't share it between concurrent requests: see [Instantiating the connection](../connection.md#instantiating-the-connection-with-the-database-connection).

!!! tip

    SQL Server has no boolean data type: `ts-sql-query` assumes that a boolean is stored in a bit where `0` is false, and `1` is true, and converts the values for you. If you need a different way to store a boolean, see [Custom booleans values](../../advanced/custom-booleans-values.md) for more information.

## What it offers and what it doesn't

What isn't offered doesn't compile on this connection. On a version older than the one shown, the database rejects the query. Each link goes to the page that explains the feature, with all the databases side by side.

| What | On this database |
|---|---|
| [`returning` in an insert](../../queries/insert.md#availability-per-database) | Yes, written as `output` |
| [`returning` in an update](../../queries/update.md#availability-in-each-database) | Yes, written as `output` |
| [`returning` in a delete](../../queries/delete.md#availability-in-each-database) | Yes, written as `output` |
| [`oldValues()` in an update](../../queries/update.md#availability-in-each-database) | Yes |
| [Insert on conflict](../../queries/insert-on-conflict.md#what-each-database-offers) | Not offered |
| Other tables in an [update](../../queries/update.md#availability-in-each-database) or a [delete](../../queries/delete.md#availability-in-each-database) | `from` and `using` (written as `from`). A join right after `update` or `deleteFrom` isn't offered |
| [Compound queries](../../queries/compound-select.md#availability-in-each-database) | `union`, `unionAll`, `intersect`, `except`, `minus`. Their `All` versions aren't offered |
| [Recursive queries](../../queries/recursive-select.md#availability-in-each-database) | `recursiveUnionAll`. `recursiveUnion`, `startWith` and `connectBy` aren't offered |
| [Arrays of objects from an aggregate](../../queries/aggregate-as-object-array.md#availability-in-each-database) | Yes. The `Distinct` versions aren't offered |
| [`stringConcatDistinct`, `anyValue`](../../queries/aggregate-and-group-by.md#how-each-function-is-written-in-each-database) | Not offered |
| [Sequences](../mapping.md#using-a-sequence) | Yes |
| [Stored procedures](../mapping.md#calling-a-stored-procedure) and [functions](../mapping.md#calling-a-function-of-the-database) | Yes |
| [Isolation levels](../../queries/transaction.md#what-each-database-offers) | `read uncommitted`, `read committed`, `repeatable read`, `snapshot` (needs a database option), `serializable` |

## Compatibility version

The `compatibilityVersion` property says which SQL Server version the SQL must work on, encoded as the integer `major * 1_000_000 + minor * 1_000 + patch` — e.g. `16_000_000` for SQL Server 2022 (whose internal version is 16.0). The default is `Number.POSITIVE_INFINITY` (latest).

Recognized breakpoints:

- `compatibilityVersion >= 16_000_000` (SQL Server 2022): `minValue(...)` / `maxValue(...)` emit the native `LEAST(a, b)` / `GREATEST(a, b)` functions added in SQL Server 2022, instead of a `IIF(a < b, a, b)` emulation that evaluates each argument twice.
- `compatibilityVersion >= 17_000_000` (SQL Server 2025):
    - [`aggregateAsArray`](../../queries/aggregate-as-object-array.md) and `aggregateAsArrayOfOneColumn` emit the native `JSON_ARRAYAGG` / `JSON_OBJECT` aggregates instead of a `string_agg`/`string_escape`-based emulation. The `aggregateAsArrayDistinct` / `aggregateAsArrayOfOneColumnDistinct` variants always use the emulation regardless of `compatibilityVersion`, because `JSON_ARRAYAGG` does not accept `DISTINCT`.
    - `substringToEnd(...)` / `substrToEnd(...)` emit `substring(x, start + 1)` (relying on the now-optional `length` argument) instead of `substring(x, start + 1, 2147483647)`, which is how earlier versions spell "to the end of the string". Both forms return the same value.
    - `currentDate()` emits the native `CURRENT_DATE` keyword introduced in SQL Server 2025, which returns a `date` value. On earlier versions it emits `cast(getdate() as date)` — also a proper `date`, matching what [`currentDate()`](../../api/connection.md) promises.

On older SQL Server versions, set `compatibilityVersion` to your actual version so the right emulation is chosen automatically. It is recommended to keep this value in sync with your real database version so future ts-sql-query releases that gate additional features on it pick the right behavior automatically.

```ts
import { SqlServerConnection } from "ts-sql-query/sqlserver";

class DBConnection extends SqlServerConnection<'DBConnection'> {
    protected override compatibilityVersion = 16_000_000
}
```

## Collations & case sensitivity

SQL Server's default collation (`SQL_Latin1_General_CP1_CI_AS`) is **case-insensitive**, accent-sensitive — so `equals` / `contains` / `like` fold case out of the box, where PostgreSQL, Oracle and SQLite would not. The plain string operations follow that configured collation; the `*Insensitive` operations force case-insensitivity over it. SQL Server has **no session collation**, so to force a different collation you use `.collate('<name>')` per value, `insensitiveCollation` connection-wide, or the column / database collation. See the dedicated [Collations & case sensitivity](../collations.md) page and the [SQL Server tab](../collations.md#per-database) for the collation names to use.

!!! warning "Validate the case sensitivity, then configure the connection"

    The case-insensitive (`_CI_`) default is common but **not guaranteed** — a database or column can be created with a case-sensitive (`_CS_`) or binary collation, and a deployment you don't control may differ. Confirm it rather than assuming: `SELECT DATABASEPROPERTYEX(DB_NAME(), 'Collation')` for the database default, or `sys.columns` / `COLLATIONPROPERTY` per column.

    If it **is** case-insensitive, tell ts-sql-query so it generates the leanest SQL: set **`insensitiveCollation = ''`** on the connection. The `*Insensitive` operations then trust the column's collation and drop the redundant `lower(a) = lower(b)` — which also defeats indexes — emitting the bare comparison the already-CI column folds correctly:

    ```ts
    class DBConnection extends SqlServerConnection<'DBConnection'> {
        override insensitiveCollation = '' // the database is already case-insensitive — trust it
    }
    ```

    Note too that the **plain** operations already fold case here — `.equals(...)` behaves like `.equalsInsensitive(...)`. Where a query needs a case-sensitive comparison, force it with `.collate('Latin1_General_BIN2')`.

### `replaceAll` and collation

`.replaceAll(search, replacement)` mirrors JavaScript's `String.replaceAll`, which is case-**sensitive**: `'ABCabc'.replaceAll('abc', 'X')` is `'ABCX'`. SQL Server's `REPLACE()`, however, resolves its search argument under the **collation** of the value being searched, and the default collation is case-insensitive — so a bare `replace('ABCabc', 'abc', 'X')` returns `'XX'`, corrupting the value:

```sql
replace('ABCabc', 'abc', 'X')                                                                                   -- XX    <- both cases matched
replace('ABCabc' collate Latin1_General_BIN2, 'abc' collate Latin1_General_BIN2, 'X') collate DATABASE_DEFAULT  -- ABCX
```

To prevent that, ts-sql-query forces a binary / code-point collation on the match operands **by default** (`Latin1_General_BIN2`) and resets the result to `DATABASE_DEFAULT` so the forced collation does not leak into a chained comparison. `replaceAll` is therefore case-sensitive whatever the database collation. The collation is controlled by the **`replaceCollation`** property:

```typescriptreact
import { SqlServerConnection } from "ts-sql-query/sqlserver";

class DBConnection extends SqlServerConnection<'DBConnection'> {
    override replaceCollation = '' // opt out — follow the database collation (case-insensitive by default)
}
```

Set it to another collation name to force a different one, or to the empty string (`''`) to opt out and emit the bare native `replace(...)`. For a deliberately **case-insensitive** replace, use [`.replaceAllInsensitive(...)`](../collations.md#replaceallinsensitive-the-insensitive-twin) instead. Full detail on the [Collations page](../collations.md#replacecollation-sql-server-and-oracle).

## UUID management

In SQL Server, UUIDs are stored in columns of type `uniqueidentifier`, which SQL Server gives in upper case. `ts-sql-query` gives a uuid in lower case, as the other databases do: a uuid read is lowered, the text of a uuid (`asString()`) read as a column of the result is lowered too, and where that text is transformed in the query (concatenated, cut, trimmed, aggregated with `stringConcat`, replaced, collated, in `valueWhenNull`, in a column of a `union` whose other select has another text, or as a value of a fragment) the query writes `lower(convert(nvarchar(36), ...))`. Where the text is only compared (an equality, `like`, `length`) it is written `convert(nvarchar(36), ...)`, because the case doesn't change the result.

```ts
const code = await connection.selectFrom(tRecord)
    .where(tRecord.title.equals('First'))
    .selectOneColumn(tRecord.id.asString().concat('-x'))
    .executeSelectOne()
```

```sqlserver
select lower(convert(nvarchar(36), id)) + @0 as result from record where title = @1
```

The parameters are: `[ '-x', 'First' ]`

The result type is:
```tsx
const code: Promise<string>
```

To keep the upper case of SQL Server, set `useUpperCaseUuid` in your connection: a uuid and its text are then given as SQL Server gives them, and the query has no `lower(...)`.

```ts
import { SqlServerConnection } from "ts-sql-query/sqlserver";

class DBConnection extends SqlServerConnection<'DBConnection'> {
    protected override useUpperCaseUuid = true
}
```

!!! tip "Generating UUIDs"

    Prefer **UUID v7** over UUID v4 — v7 keeps the rest of the supported databases time-ordered on the primary-key index. SQL Server's `uniqueidentifier` is the exception: it uses a non-byte-order comparison that ignores the leading bytes, so the chronological ordering of v7 is not preserved inside the index. Uniqueness and cross-database identifier portability are still preserved. SQL Server has no server-side v7 generator, but provides `NEWID()` (random) and `NEWSEQUENTIALID()` (which produces GUIDs that match `uniqueidentifier`'s sort order — useful as a column `DEFAULT` if you accept a SQL Server-specific format instead of RFC 9562 v7). See the [column types](../column-types.md) page for more context.

## A date and time with its offset

A `datetimeoffset` keeps, with each value, the offset it was written with, like `+09:00`. A `localDateTime` column reads only its instant, because tedious, the driver of mssql, gives a `Date`, which has no zone (see [The zone stored with each value](../time-zones.md#4-the-zone-stored-with-each-value)). When the offset is part of the value, like the local time of departure of a flight, declare the column with a [type adapter](../column-types.md#type-adapters) that keeps the value as the text the database writes:

- `transformProjection` has the database give the value as text, with `convert(nvarchar(40), …, 126)`, in the columns of the result (also those of an `output`) and inside the JSON of an aggregated array (see [The SQL of a value read from the database](../column-types.md#the-sql-of-a-value-read-from-the-database)).
- `transformPlaceholder` converts the text sent with a `cast` to `datetimeoffset`.
- `transformProjection` also says, in its context, that the converted SQL compares as `'none'`: the text doesn't compare as the instant (the same instant written with two offsets is two texts), nor order as it, so the query compares and orders the values (see [How the converted SQL compares](../column-types.md#how-the-converted-sql-compares)).
- `transformValueFromDB` and `transformValueToDB` keep the text as the value.

The column is a `customComparable` of `string`: it can be compared and ordered, its values aren't converted by the library, and the text is sent as an `nvarchar`. A `customLocalDateTime` doesn't serve for it: its parameters are sent as a `datetime2`, which the driver makes from a `Date`, so `'2024-07-01T10:30:15.1234567+09:00'` is stored as `2024-07-01T01:30:15.1230000+00:00`.

<!-- doc-code-snippet-template: sqlserver -->
```ts
import type { DefaultTypeAdapter, ProjectionOutput, TypeAdapter, TypeAdapterPlaceholderContext, TypeAdapterProjectionContext, TypeAdapterValueFromDBContext, TypeAdapterValueToDBContext, TypeCategory } from "ts-sql-query"

// A date and time with the offset it was written with, as text, like '2024-07-01T10:30:15.1234567+09:00'
type ZonedDateTime = string

class ZonedDateTimeTypeAdapter implements TypeAdapter {
    transformValueFromDB(value: unknown, type: string, typeCategory: TypeCategory, context: TypeAdapterValueFromDBContext, next: DefaultTypeAdapter): unknown {
        if (type === 'ZonedDateTime') {
            return value // the text, or null
        }
        return next.transformValueFromDB(value, type, typeCategory, context)
    }

    transformValueToDB(value: unknown, type: string, typeCategory: TypeCategory, context: TypeAdapterValueToDBContext, next: DefaultTypeAdapter): unknown {
        if (type === 'ZonedDateTime') {
            return value
        }
        return next.transformValueToDB(value, type, typeCategory, context)
    }

    transformPlaceholder(placeholder: string, type: string, typeCategory: TypeCategory, valueSentToDB: unknown, context: TypeAdapterPlaceholderContext, next: DefaultTypeAdapter): string {
        if (type === 'ZonedDateTime') {
            return 'cast(' + placeholder + ' as datetimeoffset)'
        }
        return next.transformPlaceholder(placeholder, type, typeCategory, valueSentToDB, context)
    }

    transformProjection(sql: string, type: string, typeCategory: TypeCategory, output: ProjectionOutput, context: TypeAdapterProjectionContext, next: DefaultTypeAdapter): string {
        if (type === 'ZonedDateTime') {
            context.comparison = 'none'
        }
        if (type === 'ZonedDateTime' && (output === 'resultColumn' || output === 'aggregatedArrayValue')) {
            return 'convert(nvarchar(40), ' + sql + ', 126)'
        }
        return next.transformProjection(sql, type, typeCategory, output, context)
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

With three flights: 1 departs on 2024-07-01 at 10:30:15.1234567 `+09:00`, 2 at the same instant written with `+00:00` (01:30:15.1234567), and 3 on 2024-06-30 at 22:00 `-05:00`, which is 03:00 UTC:

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

```sqlserver
select id as id, convert(nvarchar(40), departs_at, 126) as departsAt
from flight
order by flight.departs_at, id
```

And its parameters are: `[]`

The result is `[ { id: 1, departsAt: '2024-07-01T10:30:15.1234567+09:00' }, { id: 2, departsAt: '2024-07-01T01:30:15.1234567+00:00' }, { id: 3, departsAt: '2024-06-30T22:00:00-05:00' } ]`: each value with its offset, ordered by the instant. Ordered by the text, flight 3 would come first.

The style 126 writes the seven digits of the fraction of a second, and no fraction when it is zero, like in flight 3. Outside the result, the column keeps its SQL: the `where`, the `order by` (which writes the column, not its alias) and the `group by` use the value, and SQL Server compares two values by their instants. `tFlight.departsAt.equals('2024-07-01T01:30:15.1234567+00:00')` finds flights 1 and 2, and so does the same instant written `'2024-07-01T10:30:15.1234567+09:00'`; `tFlight.departsAt.lessThan('2024-07-01T02:00:00+00:00')` doesn't find flight 3, although its text is the smallest.

A `union` or a `selectDistinct` of the column compares the instants too. Flights 1 and 2 depart at the same instant:

```ts
const departures = connection.selectDistinctFrom(tFlight)
    .where(tFlight.id.in([1, 2]))
    .selectOneColumn(tFlight.departsAt)
    .executeSelectMany()
```

```sqlserver
select convert(nvarchar(40), o_1_.result, 126) as result
from (select distinct departs_at as result from flight where id in (@0, @1)) as o_1_
```

And its parameters are: `[ 1, 2 ]`

The result is one row, `[ '2024-07-01T10:30:15.1234567+09:00' ]` or `[ '2024-07-01T01:30:15.1234567+00:00' ]`: the distinct is applied to the values, and the select that wraps it converts them. Which of the two texts is kept is up to the database.

A value written keeps the offset of its text:

```ts
const inserted = connection.insertInto(tFlight)
    .set({
        id: 4,
        departsAt: '2024-07-01T10:30:15.123+09:00',
    })
    .executeInsert()
```

```sqlserver
insert into flight (id, departs_at) values (@0, cast(@1 as datetimeoffset))
```

And its parameters are: `[ 4, '2024-07-01T10:30:15.123+09:00' ]`

Read back, the value is `'2024-07-01T10:30:15.1230000+09:00'`. A value assigned from another column of this type keeps the offset of that column, because it doesn't go through the text, and the `output` of an insert or an update gives the text too. `datetimeoffset` has no regions: to show a value in the zone it belongs to, like `Europe/Madrid`, keep the name of the zone in a column of its own.

## The scale of `roundn`

The scale of `roundn` is a whole number of decimals. SQL Server truncates a fractional one: its `round(2.345, 1.6)` is `2.3`, rounded to 1 decimal, while PostgreSQL, MySQL and MariaDB round the scale and give `2.35`. ts-sql-query rounds the scale on every database, ties away from zero, so `roundn(1.6)` is 2 decimals here too: a number is sent rounded (`round(@0, @1)` with the params `[2.345, 2]`), and an expression that isn't an integer, like `priority.divide(2)`, is written rounded (`round(<scale>, 0)`). An integer scale is sent and written as it is.

To keep SQL Server's native behavior, set `usePlatformDependentRound = true` on the connection: the scale is then sent and written as it is, and SQL Server truncates it.

```ts
import { SqlServerConnection } from "ts-sql-query/sqlserver";

class DBConnection extends SqlServerConnection<'DBConnection'> {
    protected override usePlatformDependentRound = true
}
```

## `.length()` and trailing blanks

`.length()` mirrors JavaScript's `String.length`, which counts trailing blanks; T-SQL's native `LEN()` excludes them (`LEN('Draft  ')` is 5, not 7). To match JavaScript, ts-sql-query appends a sentinel and subtracts it back — `len(<x> + '.') - 1` — which is character-correct for every string **except one exact extreme**: a value whose length already equals its column's declared maximum. T-SQL string `+` on two non-`max` character types caps the concatenation at the type's maximum and silently drops the appended sentinel, so `.length()` under-reports that one value by one.

If your SQL Server columns hold max-length values and your data does not depend on trailing blanks, set `excludeTrailingBlanksInLength = true` to emit the bare native `len(<x>)` instead:

```ts
import { SqlServerConnection } from "ts-sql-query/sqlserver";

class DBConnection extends SqlServerConnection<'DBConnection'> {
    protected override excludeTrailingBlanksInLength = true
}
```

The max-length edge then disappears (`len(REPLICATE('a', 8000))` is 8000) and the query is lighter, at the cost of **excluding trailing blanks again** (`len('Draft  ')` is 5) — T-SQL's native semantics, diverging from JavaScript. It is a genuine trade, not a strict improvement.

## `minValue` / `maxValue` and NULL

`value.minValue(x)` (floor at `x` — the *greater* of the two) and `value.maxValue(x)` (cap at `x` — the *lesser*) are typed **optional whenever either operand is optional** — the same rule `add` / `subtract` / `concat` follow — so a NULL operand is expected to propagate to a NULL result. MySQL, MariaDB, Oracle and SQLite already do this. SQL Server's native `least` / `greatest` (2022+) and the `iif` emulation below it **ignore** a NULL operand and return the present value, so `tIssue.estimatedHours.minValue(5)` returns `5` for a NULL `estimated_hours` on native SQL Server, but `NULL` on the other databases — the same typed call, two values. **To match the declared type, ts-sql-query wraps the version-appropriate inner form in a `CASE` that returns NULL when an operand is NULL:**

```sql
case when estimated_hours is null then null else greatest(estimated_hours, @0) end
```

Only the leanest check the build-time optionality needs is emitted: two **required** operands stay the bare `greatest(a, b)` / `least(a, b)`, one optional operand null-checks only that one. The `CASE` also unifies the NULL behavior across the `compatibilityVersion` split — native `least` / `greatest` at 2022+, the `iif` emulation below it.

### Keeping SQL Server's native ignore-NULL behavior

If you prefer SQL Server's native behavior — a NULL operand ignored rather than propagated — set `ignoreNullInMinAndMaxValue = true`:

```ts
class DBConnection extends SqlServerConnection<'DBConnection'> {
    protected override ignoreNullInMinAndMaxValue = true
}
```

`value.minValue(x)` then emits the bare `greatest(value, x)` again (or the `iif` form below compatibility version 2022).

### Propagating NULL through a function instead of a `CASE`

The default `CASE` repeats the operand (once in the null check, once in `least` / `greatest`) — free for a column, but not for an expensive value-source receiver. Name a null-propagating function you created and it is emitted as `func(a, b)` instead, each operand appearing once:

```ts
class DBConnection extends SqlServerConnection<'DBConnection'> {
    protected override minValueFunction = 'dbo.greatest_strict'  // minValue -> the LARGER of the two
    protected override maxValueFunction = 'dbo.least_strict'     // maxValue -> the SMALLER of the two
}
```

Mind the mapping: `minValue` (floor) returns the **larger** value, so it uses the `greatest`-like function; `maxValue` (cap) returns the **smaller**, so it uses the `least`-like one. Scalar functions must be called two-part-named on SQL Server, hence the `dbo.` prefix; the names are yours.

A scalar function is not polymorphic on SQL Server, so `float` covers the numeric operands (`int` / `bigint` widen to it), and the `CASE` comparison works on every version (no dependency on the 2022+ `least` / `greatest`):

```sql
CREATE FUNCTION dbo.greatest_strict(@a FLOAT, @b FLOAT) RETURNS FLOAT AS
BEGIN
    RETURN CASE WHEN @a IS NULL OR @b IS NULL THEN NULL WHEN @a >= @b THEN @a ELSE @b END
END;
GO
CREATE FUNCTION dbo.least_strict(@a FLOAT, @b FLOAT) RETURNS FLOAT AS
BEGIN
    RETURN CASE WHEN @a IS NULL OR @b IS NULL THEN NULL WHEN @a <= @b THEN @a ELSE @b END
END;
```

With the options set, the emitted SQL calls them once per operand:

```sql
select dbo.greatest_strict(estimated_hours, @0) as floored, dbo.least_strict(estimated_hours, @1) as capped from issue
```

!!! tip "Leave all three unset unless you need them"

    The default `CASE` matches the declared type on every database and only pays a repeated operand for a value-source receiver. Reach for `ignoreNullInMinAndMaxValue` when you specifically want SQL Server's ignore-NULL semantics, or for `minValueFunction` / `maxValueFunction` when the repeated operand is expensive enough to matter. The row aggregate `min(col)` / `max(col)` over rows is a different function — it ignores NULL on every database by standard SQL — and is unaffected by any of these.
