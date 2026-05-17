---
search:
  boost: 0.59
---
# PostgreSQL

This page describes how `ts-sql-query` integrates with **[PostgreSQL](https://www.postgresql.org)**, including dialect-specific behavior, configuration options, and available features. It covers the proper setup of a PostgreSQL connection, guidelines for connection management, and advanced behaviors such as explicit typing.

!!! info

    To configure the database dialect, extend the appropriate database connection class when defining your connection. You must choose the correct database type to ensure that the generated SQL queries follow the dialect expected by that database.

!!! warning "Do not share connections between requests"

    A `ts-sql-query` connection object — along with the query runner instances passed to its constructor — represents a **dedicated connection** to the database.

    Therefore, **you must not share the same connection object between concurrent HTTP requests**. Instead, create a new connection object for each request, along with its own query runners.

    Even if the query runner internally uses a connection pool, the `ts-sql-query` connection still represents a single active connection, acquired from the pool. It must be treated as such and never reused across requests.

## Usage Example

```ts
import { PostgreSqlConnection } from "ts-sql-query/connections/PostgreSqlConnection";

class DBConnection extends PostgreSqlConnection<'DBConnection'> { }
```

## Compatibility version

The `compatibilityVersion` property declares the minimum PostgreSQL version the generated SQL must support, encoded as the integer `major * 1_000_000 + minor * 1_000 + patch` — e.g. `18_000_000` for PostgreSQL 18, `17_000_000` for PostgreSQL 17. The numeric separator `_` is for readability only (`18_000_000 === 18000000`). The default is `Number.POSITIVE_INFINITY` (latest), so every supported feature is emitted.

You can set this to your real database version (whatever it is) regardless of whether ts-sql-query currently uses it — extra granularity is harmless and future-proof.

Recognised breakpoints (with the default `Number.POSITIVE_INFINITY` every breakpoint below is enabled — the list reads as the bar you need to clear to keep each feature):

- `>= 18_000_000`: target PostgreSQL 18+. Column references on a table-or-view returned by `.oldValues()` are emitted as `old.col` inside `UPDATE ... RETURNING`, taking advantage of the native `OLD`/`NEW` qualifiers added in PostgreSQL 18 for `RETURNING` in `INSERT`/`UPDATE`/`DELETE`/`MERGE`. The `UPDATE` statement no longer needs the `FROM (SELECT _old_.* FROM ... FOR NO KEY UPDATE OF _old_) AS _old_` subquery to capture pre-update values, nor the `_new_` alias of the target table.
- `< 18_000_000`: target PostgreSQL 17 or older. The `FROM (subquery FOR NO KEY UPDATE)` trick is emitted to capture pre-update values and join them back into the `UPDATE` via the primary key; the updated table is aliased as `_new_` and `.oldValues()` references emit as `_old_.col`.

```ts
import { PostgreSqlConnection } from "ts-sql-query/connections/PostgreSqlConnection";

class DBConnection extends PostgreSqlConnection<'DBConnection'> {
    protected override compatibilityVersion = 17_000_000
}
```

## Rounding behavior

PostgreSQL has two overloads of its native `round` function — `round(numeric)` and `round(double precision)` — with **different tie-breaking rules**. Per the [PostgreSQL manual](https://www.postgresql.org/docs/current/functions-math.html#FUNCTIONS-MATH-FUNC-TABLE):

> `round(numeric)` → rounds to nearest integer; ties are broken by rounding **away from zero** (so `round(0.5) → 1`).
>
> `round(double precision)` → rounds to nearest integer; the tie-breaking behavior is **platform dependent**, but *"round to nearest even"* is the most common rule (so `round(0.5) → 0` on most systems).

Every other dialect ts-sql-query supports (MariaDB, MySQL, Oracle, SQL Server, SQLite) breaks ties away from zero, matching JavaScript's `Math.round` for positive `.5` values. To keep `.round()` predictable and portable, **the PostgreSQL connection casts the operand to `numeric` before applying `round`**, so `value.round()` always rounds ties away from zero regardless of the operand's type.

For example, `tIssue.priority.divide(2).round()` (where `priority = 1`) yields `round(0.5) = 1` on every dialect, including PostgreSQL.

If you prefer PostgreSQL's native `round(double precision)` semantics — typically because your application is single-dialect and you want the IEEE 754 round-to-even tie-breaking common on modern systems, or because existing queries depend on that result — set `usePlatformDependentRound = true` on your connection:

```ts
import { PostgreSqlConnection } from "ts-sql-query/connections/PostgreSqlConnection";

class DBConnection extends PostgreSqlConnection<'DBConnection'> {
    protected override usePlatformDependentRound = true
}
```

With the flag on, `value.round()` emits `round(x)` directly: when `x` is a `numeric` expression you still get away-from-zero, but when `x` is a `double precision` expression (the type produced by `.divide(...)`, `.asDouble()`, and many other arithmetic chains) the tie-breaking follows PostgreSQL's `round(double precision)` rules.

## Explicit typing

In some situations, PostgreSQL may be unable to infer the correct type of a parameter in a query. This often happens with untyped `NULL` values or when using generic placeholders. To ensure type safety and proper execution, you can explicitly cast the parameter type in the generated SQL.

You can enforce explicit casting by overriding the `transformPlaceholder` method in your connection class. This method allows you to append a type annotation to the placeholder at the time of SQL generation.

You may define your own cast rules or override the default behavior. For reference, see the default implementation in [`PostgreSqlConnection`](https://github.com/juanluispaz/ts-sql-query/blob/master/src/connections/PostgreSqlConnection.ts), or use the example below:

```ts
import { PostgreSqlConnection } from "ts-sql-query/connections/PostgreSqlConnection";

class DBConnection extends PostgreSqlConnection<'DBConnection'> {
    protected override transformPlaceholder(
        placeholder: string,
        type: string,
        _forceTypeCast: boolean,
        valueSentToDB: unknown
    ): string {
        return super.transformPlaceholder(placeholder, type, true, valueSentToDB)
    }
}
```

!!! tip

    You can also enforce type casting using the `ForceTypeCast` adapter provided in `ts-sql-query/TypeAdapter`. For more advanced usage, see the section on [Global type adapter](../column-types.md#global-type-adapter).

## UUID handling

PostgreSQL has a native `uuid` data type (available since PostgreSQL 8.3, present in every supported version), and `ts-sql-query` maps the `uuid` column type to it directly — no extension or conversion function is required. The `uuid` type compares values byte-by-byte, so a UUID v7 stored there keeps its chronological ordering on the primary-key index.

!!! tip "Generating UUIDs"

    Prefer **UUID v7** over UUID v4. PostgreSQL 18 adds the server-side `uuidv7()` SQL function, alongside `gen_random_uuid()` for v4 available since PostgreSQL 13. As a general rule, generating the UUID in the database as a column `DEFAULT` is preferred over generating it in application code; the latter is the fallback when the value must be known before the `INSERT`. See the [column types](../column-types.md) page for more context.
