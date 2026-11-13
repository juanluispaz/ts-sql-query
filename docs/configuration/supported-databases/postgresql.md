---
search:
  boost: 0.59
---
<!-- doc-code-template: postgresql -->
# PostgreSQL

This page has what is particular to PostgreSQL: what it offers and what it doesn't, how to declare its version, the type of a parameter, what happens when a statement fails inside a transaction, rounding, and how `minValue` and `maxValue` treat `null`. To define the connection and map your tables, the pages to read are [Connection](../connection.md) and [Mapping](../mapping.md).

## Defining the connection

```ts
import { PostgreSqlConnection } from "ts-sql-query/postgresql";

class DBConnection extends PostgreSqlConnection<'DBConnection'> { }
```

Create a connection object for each request, and don't share it between concurrent requests: see [Instantiating the connection](../connection.md#instantiating-the-connection-with-the-database-connection).

## What it offers and what it doesn't

What isn't offered doesn't compile on this connection. On a version older than the one shown, the database rejects the query. Each link goes to the page that explains the feature, with all the databases side by side.

| What | On this database |
|---|---|
| [`returning` in an insert](../../queries/insert.md#availability-per-database) | Yes |
| [`returning` in an update](../../queries/update.md#availability-in-each-database) | Yes |
| [`returning` in a delete](../../queries/delete.md#availability-in-each-database) | Yes |
| [`oldValues()` in an update](../../queries/update.md#availability-in-each-database) | Yes; native from PostgreSQL 18, emulated in a single query below it |
| [Insert on conflict](../../queries/insert-on-conflict.md#what-each-database-offers) | `onConflictDoNothing`, `onConflictOn` and `onConflictOnConstraint`. `onConflictDoUpdateSet` isn't offered: an update must say which conflict it handles |
| Other tables in an [update](../../queries/update.md#availability-in-each-database) or a [delete](../../queries/delete.md#availability-in-each-database) | `from` and `using`. A join right after `update` or `deleteFrom` isn't offered |
| [Compound queries](../../queries/compound-select.md#availability-in-each-database) | All of them |
| [Recursive queries](../../queries/recursive-select.md#availability-in-each-database) | `recursiveUnionAll`, `recursiveUnion`. `startWith` and `connectBy` aren't offered |
| [Arrays of objects from an aggregate](../../queries/aggregate-as-object-array.md#availability-in-each-database) | Yes, also the `Distinct` versions |
| [`stringConcatDistinct`, `anyValue`](../../queries/aggregate-and-group-by.md#how-each-function-is-written-in-each-database) | Yes |
| [Sequences](../mapping.md#using-a-sequence) | Yes |
| [Stored procedures](../mapping.md#calling-a-stored-procedure) and [functions](../mapping.md#calling-a-function-of-the-database) | Yes |
| [Isolation levels](../../queries/transaction.md#what-each-database-offers) | `read committed`, `snapshot`, `serializable` |

## Compatibility version

The `compatibilityVersion` property says which PostgreSQL version the SQL must work on, encoded as the integer `major * 1_000_000 + minor * 1_000 + patch` — e.g. `18_000_000` for PostgreSQL 18, `17_000_000` for PostgreSQL 17. The numeric separator `_` is for readability only (`18_000_000 === 18000000`). The default is `Number.POSITIVE_INFINITY` (latest), so every supported feature is emitted.

You can set this to your real database version (whatever it is) regardless of whether ts-sql-query currently uses it — extra granularity is harmless and future-proof.

Recognised breakpoints (with the default `Number.POSITIVE_INFINITY` every breakpoint below is enabled — the list reads as the bar you need to clear to keep each feature):

- `>= 18_000_000`: target PostgreSQL 18+. Column references on a table-or-view returned by `.oldValues()` are emitted as `old.col` inside `UPDATE ... RETURNING`, taking advantage of the native `OLD`/`NEW` qualifiers added in PostgreSQL 18 for `RETURNING` in `INSERT`/`UPDATE`/`DELETE`/`MERGE`. The `UPDATE` statement no longer needs the `FROM (SELECT _old_.* FROM ... FOR NO KEY UPDATE OF _old_) AS _old_` subquery to capture pre-update values, nor the `_new_` alias of the target table.
- `< 18_000_000`: target PostgreSQL 17 or older. The `FROM (subquery FOR NO KEY UPDATE)` trick is emitted to capture pre-update values and join them back into the `UPDATE` via the primary key; the updated table is aliased as `_new_` and `.oldValues()` references emit as `_old_.col`.

```ts
import { PostgreSqlConnection } from "ts-sql-query/postgresql";

class DBConnection extends PostgreSqlConnection<'DBConnection'> {
    protected override compatibilityVersion = 17_000_000
}
```

## A statement that fails inside a transaction

On PostgreSQL, a statement that fails inside a transaction leaves the whole transaction failed, even if your code catches the error and goes on: the statements that follow are rejected, and at the commit the database rolls the transaction back. `ts-sql-query` reports the transaction as failed, with the `errorReason` `TRANSACTION_ERROR` (`transactionErrorType: 'transaction rolled back'`) and the error of the statement that failed in `error.cause.cause`, and with `connection.transaction(...)` the after-rollback functions run instead of the after-commit ones:

```ts
await connection.transaction(async () => {
    await connection.insertInto(tCompany).set({ name: 'Top Company' }).executeInsert();
    try {
        // Fails: there is no company with the id -1
        await connection.insertInto(tCustomer).set({ firstName: 'John', lastName: 'Smith', companyId: -1 }).executeInsert();
    } catch (e) {
        // The error is caught, but the transaction can't be committed anymore
    }
}); // Rejected: neither the company nor the customer is saved
```

!!! failure "The transaction is rejected"

    Neither the company nor the customer is saved. On MariaDB, MySQL, Oracle, SQLite and SQL Server, only the failed statement is undone, and the company is saved (some errors make those databases roll back the whole transaction too: see [when the database rolls back the transaction](../../queries/transaction.md#when-the-database-rolls-back-the-transaction)).

To go on after a statement that may fail, don't run it in the transaction, or find out beforehand whether it would fail (for example, whether the company exists).

## The type of a parameter

PostgreSQL can't work out the type of a parameter in some positions, like a constant selected on its own, a row of [`Values`](../mapping.md#mapping-constant-values-as-view), the argument of a function or a `null`. There the library gives the parameter its type, and the query runner decides how: `pg` and Bun SQL write a cast in the SQL, like `$1::int4`; postgres.js and PGlite send the parameter with its type, and the SQL has only `$1`. [How a value is sent to the database](../data-types.md#how-a-value-is-sent-to-the-database) has the type of each data type, and the `typesByName` option of the query runner sets it for a type of your own.

### A position the library doesn't detect

Inside a SQL fragment of your own, the library doesn't know what the position needs. For example, `to_char` has a version for each type, and with a parameter without a type PostgreSQL rejects the query: `function to_char(unknown, unknown) is not unique`. The type adapter `ForceTypeCast` gives that value its type:

```ts
import { ForceTypeCast } from "ts-sql-query"

const amount = connection.const(10, 'int', new ForceTypeCast())

const result = connection.selectFromNoTable()
    .select({
        formatted: connection.fragmentWithType('string', 'required').sql`to_char(${amount}, 'FM999')`
    })
    .executeSelectOne()
```

```postgresql
select to_char($1::int4, 'FM999') as formatted
```

The parameters are: `[ 10 ]`

The result type is:
```tsx
const result: Promise<{
    formatted: string;
}>
```

With postgres.js and PGlite the SQL is `select to_char($1, 'FM999') as formatted`, and the parameter is sent as an `int4`. In a column, `this.column('amount', 'int', new ForceTypeCast())` gives its type to every parameter of that column, wherever it is written.

## UUID handling

PostgreSQL has a native `uuid` data type (available since PostgreSQL 8.3, present in every supported version), and `ts-sql-query` maps the `uuid` column type to it directly — no extension or conversion function is required. The `uuid` type compares values byte-by-byte, so a UUID v7 stored there keeps its chronological ordering on the primary-key index.

!!! tip "Generating UUIDs"

    Prefer **UUID v7** over UUID v4. PostgreSQL 18 adds the server-side `uuidv7()` SQL function, alongside `gen_random_uuid()` for v4 available since PostgreSQL 13. As a general rule, generating the UUID in the database as a column `DEFAULT` is preferred over generating it in application code; the latter is the fallback when the value must be known before the `INSERT`. See the [column types](../data-types.md) page for more context.

## Collations & case sensitivity

PostgreSQL's default collation is case- and accent-**sensitive** (deterministic) — the JavaScript-sensible default, so no configuration is needed unless you want the insensitive direction. The plain string operations follow the configured collation; the `*Insensitive` operations force case-insensitivity over it. To go insensitive, PostgreSQL uses native `ILIKE` for `LIKE`, and — for equality / `DISTINCT` / `GROUP BY` — a **non-deterministic** ICU collation you create once and name in `insensitiveCollation` or `.collate('<name>')`. PostgreSQL has no session collation, so the column / database collation or a per-expression `COLLATE` (`.collate()`) is how you retarget a comparison. See the dedicated [Collations & case sensitivity](../collations.md) page and the [PostgreSQL tab](../collations.md#per-database) for the `CREATE COLLATION … (deterministic = false)` recipe.

The insensitive operations with a pattern, like `containsInsensitive`, are written with `ilike` by default. PostgreSQL rejects `ilike` with a nondeterministic collation, so to use one in those operations set `useLikeInsteadOfIlike` on the connection, which writes them with `like` (PostgreSQL accepts it from version 18):

```typescriptreact
import { PostgreSqlConnection } from "ts-sql-query/postgresql";

class DBConnection extends PostgreSqlConnection<'DBConnection'> {
    protected override insensitiveCollation = 'case_insensitive'
    protected override useLikeInsteadOfIlike = true
}
```

With the option and no `insensitiveCollation`, they are written with `lower(x) like lower(y)`, which also ignores case. [On PostgreSQL, one collation can't serve every operation](../collations.md#insensitivecollation-force-the-insensitive-direction-connection-wide) has what each combination does.

## Rounding behavior

PostgreSQL has two overloads of its native `round` function — `round(numeric)` and `round(double precision)` — with **different tie-breaking rules**. Per the [PostgreSQL manual](https://www.postgresql.org/docs/current/functions-math.html#FUNCTIONS-MATH-FUNC-TABLE):

> `round(numeric)` → rounds to nearest integer; ties are broken by rounding **away from zero** (so `round(0.5) → 1`).
>
> `round(double precision)` → rounds to nearest integer; the tie-breaking behavior is **platform dependent**, but *"round to nearest even"* is the most common rule (so `round(0.5) → 0` on most systems).

ts-sql-query breaks ties away from zero on every dialect, matching JavaScript's `Math.round` for positive `.5` values. To keep `.round()` predictable and portable, **the PostgreSQL connection casts the operand to `numeric` before applying `round`**, so `value.round()` always rounds ties away from zero regardless of the operand's type.

[MySQL](mysql.md#rounding-behavior) and [MariaDB](mariadb.md#rounding-behavior) draw the same distinction between exact and approximate operands and carry the same `usePlatformDependentRound` flag; Oracle, SQL Server and SQLite round away from zero natively and need no cast.

For example, `tIssue.priority.divide(2).round()` (where `priority = 1`) yields `round(0.5) = 1` on every dialect, including PostgreSQL.

If you prefer PostgreSQL's native `round(double precision)` semantics — typically because your application is single-dialect and you want the IEEE 754 round-to-even tie-breaking common on modern systems, or because existing queries depend on that result — set `usePlatformDependentRound = true` on your connection:

```ts
import { PostgreSqlConnection } from "ts-sql-query/postgresql";

class DBConnection extends PostgreSqlConnection<'DBConnection'> {
    protected override usePlatformDependentRound = true
}
```

With the flag on, `value.round()` emits `round(x)` directly: when `x` is a `numeric` expression you still get away-from-zero, but when `x` is a `double precision` expression (the type produced by `.divide(...)`, `.asDouble()`, and many other arithmetic chains) the tie-breaking follows PostgreSQL's `round(double precision)` rules.

The flag also sends and writes the scale of `roundn` as it is. PostgreSQL rounds a fractional scale (`roundn(1.6)` is 2 decimals), which is what the library does on every database without the flag.

## `minValue` / `maxValue` and NULL

`value.minValue(x)` (floor at `x` — the *greater* of the two) and `value.maxValue(x)` (cap at `x` — the *lesser*) are typed **optional whenever either operand is optional** — the same rule `add` / `subtract` / `concat` follow — so a NULL operand is expected to propagate to a NULL result. MySQL, MariaDB, Oracle and SQLite already do this. PostgreSQL's native `least` / `greatest` **ignore** a NULL operand and return the present value:

```sql
greatest(NULL::int, 5)  = 5      -- ignores NULL
least(NULL::int, 5)     = 5
```

So `tIssue.estimatedHours.minValue(5)` returns `5` for a NULL `estimated_hours` on native PostgreSQL, but `NULL` on the other databases — the same typed call, two values. **To match the declared type, ts-sql-query wraps `least` / `greatest` in a `CASE` that returns NULL when an operand is NULL:**

```sql
case when estimated_hours is null then null else greatest(estimated_hours, $1) end
```

Only the leanest check the build-time optionality needs is emitted: two **required** operands stay the bare `greatest(a, b)` / `least(a, b)`, one optional operand null-checks only that one.

### Keeping PostgreSQL's native ignore-NULL behavior

If you prefer PostgreSQL's native behavior — a NULL operand ignored rather than propagated — set `ignoreNullInMinAndMaxValue = true`:

```ts
import { PostgreSqlConnection } from "ts-sql-query/postgresql";

class DBConnection extends PostgreSqlConnection<'DBConnection'> {
    protected override ignoreNullInMinAndMaxValue = true
}
```

`value.minValue(x)` then emits the bare `greatest(value, x)` again.

### Propagating NULL through a function instead of a `CASE`

The default `CASE` repeats the operand (once in the null check, once in `least` / `greatest`) — free for a column, but not for an expensive value-source receiver. Name a null-propagating function you created and it is emitted as `func(a, b)` instead, each operand appearing once:

```ts
class DBConnection extends PostgreSqlConnection<'DBConnection'> {
    protected override minValueFunction = 'greatest_strict'  // minValue -> the LARGER of the two
    protected override maxValueFunction = 'least_strict'     // maxValue -> the SMALLER of the two
}
```

Mind the mapping: `minValue` (floor) returns the **larger** value, so it uses the `greatest`-like function; `maxValue` (cap) returns the **smaller**, so it uses the `least`-like one. The names are yours; the ones above are only what this page's example calls them.

Create the functions with `anycompatible` (PostgreSQL 14+) so they keep the operand's numeric type — `int` stays `int`, `double precision` stays `double precision`:

```sql
CREATE FUNCTION greatest_strict(a anycompatible, b anycompatible) RETURNS anycompatible
LANGUAGE sql IMMUTABLE AS $$ SELECT CASE WHEN a IS NULL OR b IS NULL THEN NULL ELSE greatest(a, b) END $$;

CREATE FUNCTION least_strict(a anycompatible, b anycompatible) RETURNS anycompatible
LANGUAGE sql IMMUTABLE AS $$ SELECT CASE WHEN a IS NULL OR b IS NULL THEN NULL ELSE least(a, b) END $$;
```

With the options set, the emitted SQL calls them once per operand:

```sql
select greatest_strict(estimated_hours, $1) as floored, least_strict(estimated_hours, $2) as capped from issue
```

!!! tip "Leave all three unset unless you need them"

    The default `CASE` matches the declared type on every database and only pays a repeated operand for a value-source receiver. Reach for `ignoreNullInMinAndMaxValue` when you specifically want PostgreSQL's ignore-NULL semantics, or for `minValueFunction` / `maxValueFunction` when the repeated operand is expensive enough to matter. The row aggregate `min(col)` / `max(col)` over rows is a different function — it ignores NULL on every database by standard SQL — and is unaffected by any of these.
