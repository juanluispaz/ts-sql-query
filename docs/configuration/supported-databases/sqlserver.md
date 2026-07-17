---
search:
  boost: 0.59
---
<!-- doc-code-template: sqlserver -->
# SQL Server

This page describes how `ts-sql-query` integrates with **[SQL Server](https://www.microsoft.com/en/sql-server)**, including dialect-specific behavior, configuration options, and available features. It covers the proper setup of a SQL Server connection, guidelines for connection management, and advanced behaviors such as UUID handling.

!!! info

    To configure the database dialect, extend the appropriate database connection class when defining your connection. You must choose the correct database type to ensure that the generated SQL queries follow the dialect expected by that database.

!!! warning "Do not share connections between requests"

    A `ts-sql-query` connection object — along with the query runner instances passed to its constructor — represents a **dedicated connection** to the database.

    Therefore, **you must not share the same connection object between concurrent HTTP requests**. Instead, create a new connection object for each request, along with its own query runners.

    Even if the query runner internally uses a connection pool, the `ts-sql-query` connection still represents a single active connection, acquired from the pool. It must be treated as such and never reused across requests.

## Usage Example

```ts
import { SqlServerConnection } from "ts-sql-query/connections/SqlServerConnection";

class DBConnection extends SqlServerConnection<'DBConnection'> { }
```

!!! warning

    An empty string will be treated as a null value; if you need to allow empty string set the `allowEmptyString` property to true in the connection object.

!!! tip

    SQL Server does not have a native boolean data type; `ts-sql-query` assumes that the boolean is represented by a bit where `0` is false, and `1` is true. All conversions are made automatically by `ts-sql-query`. In case you need a different way to represent a boolean, see [Custom booleans values](../../advanced/custom-booleans-values.md) for more information.

## Compatibility version

The `compatibilityVersion` property declares the minimum SQL Server version the generated SQL must support, encoded as the integer `major * 1_000_000 + minor * 1_000 + patch` — e.g. `16_000_000` for SQL Server 2022 (whose internal version is 16.0). The default is `Number.POSITIVE_INFINITY` (latest).

Recognized breakpoints:

- `compatibilityVersion >= 16_000_000` (SQL Server 2022): `minValue(...)` / `maxValue(...)` emit the native `LEAST(a, b)` / `GREATEST(a, b)` functions added in SQL Server 2022, instead of a `IIF(a < b, a, b)` emulation that evaluates each argument twice.
- `compatibilityVersion >= 17_000_000` (SQL Server 2025):
    - [`aggregateAsArray`](../../queries/aggregate-as-object-array.md) and `aggregateAsArrayOfOneColumn` emit the native `JSON_ARRAYAGG` / `JSON_OBJECT` aggregates instead of a `string_agg`/`string_escape`-based emulation. The `aggregateAsArrayDistinct` / `aggregateAsArrayOfOneColumnDistinct` variants always use the emulation regardless of `compatibilityVersion`, because `JSON_ARRAYAGG` does not accept `DISTINCT`.
    - `substringToEnd(...)` / `substrToEnd(...)` emit `substring(x, start + 1)` (relying on the now-optional `length` argument) instead of `substring(x, start + 1, 2147483647)`, which is how earlier versions spell "to the end of the string". Both forms return the same value.
    - `currentDate()` emits the native `CURRENT_DATE` keyword introduced in SQL Server 2025, which returns a `date` value. On earlier versions it emits `cast(getdate() as date)` — also a proper `date`, matching the [`currentDate()`](../../api/connection.md) public API contract (the previous implementation emitted `getdate()`, which returns a `datetime` with the time portion).

On older SQL Server versions, set `compatibilityVersion` to your actual version so the right emulation is chosen automatically. It is recommended to keep this value in sync with your real database version so future ts-sql-query releases that gate additional features on it pick the right behavior automatically.

```ts
import { SqlServerConnection } from "ts-sql-query/connections/SqlServerConnection";

class DBConnection extends SqlServerConnection<'DBConnection'> {
    protected override compatibilityVersion = 16_000_000
}
```

## `.length()` and trailing blanks

`.length()` mirrors JavaScript's `String.length`, which counts trailing blanks; T-SQL's native `LEN()` excludes them (`LEN('Draft  ')` is 5, not 7). To match JavaScript, ts-sql-query appends a sentinel and subtracts it back — `len(<x> + '.') - 1` — which is character-correct for every string **except one exact extreme**: a value whose length already equals its column's declared maximum. T-SQL string `+` on two non-`max` character types caps the concatenation at the type's maximum and silently drops the appended sentinel, so `.length()` under-reports that one value by one.

If your SQL Server columns hold max-length values and your data does not depend on trailing blanks, set `excludeTrailingBlanksInLength = true` to emit the bare native `len(<x>)` instead:

```ts
import { SqlServerConnection } from "ts-sql-query/connections/SqlServerConnection";

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

## `replaceAll` depends on your collation

`.replaceAll(search, replacement)` mirrors JavaScript's `String.replaceAll`, which is case-**sensitive**: `'ABCabc'.replaceAll('abc', 'X')` is `'ABCX'`.

SQL Server's `REPLACE()` instead resolves its search argument under the **collation** of the value being searched, and the common defaults (including `SQL_Latin1_General_CP1_CI_AS`) are case-insensitive:

```sql
replace('ABCabc', 'abc', 'X')                               -- XX     <- both occurrences
replace('ABCabc' collate Latin1_General_CS_AS, 'abc', 'X')  -- ABCX
```

So `.replaceAll('abc', 'X')` returns `XX` here, where JavaScript returns `'ABCX'`. The library does not force a collation on the operand: that would tax every query and silently override a deliberate database-level choice. If you need JavaScript's case-sensitive semantics, apply a case-sensitive collation to the column or the expression yourself.

## UUID management

In SQL Server, UUIDs are stored in columns of type `uniqueidentifier`, which preserve values in uppercase. If you prefer to convert them to lowercase during projection, you can override the `transformValueFromDB` method as shown below:

```ts
import { SqlServerConnection } from "ts-sql-query/connections/SqlServerConnection";

class DBConnection extends SqlServerConnection<'DBConnection'> { 
    protected override transformValueFromDB(value: unknown, type: string): unknown {
        const result = super.transformValueFromDB(value, type);
        if (result && type === 'uuid') {
            return (result as string).toLowerCase();
        }
        return result;
    }
}
```

!!! tip

    If you use Prisma, this is done automatically.

!!! tip "Generating UUIDs"

    Prefer **UUID v7** over UUID v4 — v7 keeps the rest of the supported databases time-ordered on the primary-key index. SQL Server's `uniqueidentifier` is the exception: it uses a non-byte-order comparison that ignores the leading bytes, so the chronological ordering of v7 is not preserved inside the index. Uniqueness and cross-database identifier portability are still preserved. SQL Server has no server-side v7 generator, but provides `NEWID()` (random) and `NEWSEQUENTIALID()` (which produces GUIDs that match `uniqueidentifier`'s sort order — useful as a column `DEFAULT` if you accept a SQL Server-specific format instead of RFC 9562 v7). See the [column types](../column-types.md) page for more context.
