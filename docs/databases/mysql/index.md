---
search:
  boost: 0.59
---
<!-- doc-code-template: mysql -->
# MySQL

This page has what is particular to MySQL: what it offers and what it doesn't, how to declare its version, the UUID strategies, the limit of `stringConcat`, what `snapshot` doesn't protect, and rounding. The functions to create in the database are in [MySQL functions](functions.md). To define the connection and map your tables, the pages to read are [Connection](../../configuration/connection.md) and [Mapping](../../configuration/mapping.md).

## Defining the connection

```ts
import { MySqlConnection } from "ts-sql-query/mysql";

class DBConnection extends MySqlConnection<'DBConnection'> { }
```

Create a connection object for each request, and don't share it between concurrent requests: see [Instantiating the connection](../../configuration/connection.md#instantiating-the-connection-with-the-database-connection).

## What it offers and what it doesn't

What isn't offered doesn't compile on this connection. On a version older than the one shown, the database rejects the query. Each link goes to the page that explains the feature, with all the databases side by side.

| What | On this database |
|---|---|
| [`returning` in an insert](../../queries/insert.md#availability-per-database) | Not offered. `returningLastInsertedId()` is, for one row |
| [`returning` in an update](../../queries/update.md#availability-in-each-database) | Not offered |
| [`returning` in a delete](../../queries/delete.md#availability-in-each-database) | Not offered |
| [`oldValues()` in an update](../../queries/update.md#availability-in-each-database) | Not offered |
| [Insert on conflict](../../queries/insert-on-conflict.md#what-each-database-offers) | `onConflictDoNothing` and `onConflictDoUpdateSet`. `onConflictOn` and `onConflictOnConstraint` aren't offered |
| Other tables in an [update](../../queries/update.md#availability-in-each-database) or a [delete](../../queries/delete.md#availability-in-each-database) | `from`, `using`, and a join right after `update` or `deleteFrom` |
| [Compound queries](../../queries/compound-select.md#availability-in-each-database) | `union`, `unionAll`; the others from MySQL 8.0.31 |
| [Recursive queries](../../queries/recursive-select.md#availability-in-each-database) | From MySQL 8.0.1; `startWith` and `connectBy` aren't offered |
| [Arrays of objects from an aggregate](../../queries/aggregate-as-object-array.md#availability-in-each-database) | From MySQL 8.0.14. The `Distinct` versions aren't offered |
| [`stringConcatDistinct`, `anyValue`](../../queries/aggregate-and-group-by.md#how-each-function-is-written-in-each-database) | Yes |
| [Sequences](../../configuration/mapping.md#using-a-sequence) | Not offered: MySQL doesn't have them |
| [Stored procedures](../../configuration/mapping.md#calling-a-stored-procedure) and [functions](../../configuration/mapping.md#calling-a-function-of-the-database) | Yes |
| [Isolation levels](../../queries/transaction.md#what-each-database-offers) | `read uncommitted`, `read committed`, `snapshot` ([with a limitation](#snapshot-isolation-doesnt-protect-writes)), `serializable` |
| [Zoned dates and times](../../configuration/zoned-dates-and-times.md#zoned-dates-and-times) | Kept as their text, with their parts and compared by their instant. What computes with the rules of the zones isn't offered: [Computing with the zones on the other databases](../../configuration/zoned-dates-and-times.md#computing-with-the-zones-on-the-other-databases) |
| Known limits of the dates and times | With Bun SQL, a `datetime` is [read to the millisecond](query-runners/bun_sql_mysql.md#fractions-of-a-second-below-the-millisecond), and on MySQL 8 a `plainTime` given as a value and rounded is [another time](query-runners/bun_sql_mysql.md#a-time-of-the-day-sent-to-mysql-8) |

## Compatibility version

The `compatibilityVersion` property says which MySQL version the SQL must work on, encoded as the integer `major * 1_000_000 + minor * 1_000 + patch` — e.g. `8_000_019` for MySQL 8.0.19, `5_007_000` for MySQL 5.7. The numeric separator `_` is for readability only (`8_000_019 === 8000019`). The default is `Number.POSITIVE_INFINITY` (latest), so every supported feature is emitted.

Patch precision matters here because MySQL 8.0 has a continuous-delivery history: from 8.0.0 (April 2018) through 8.0.34 (July 2023), patch releases added new dialect features (CTE, `LATERAL`, the row alias for `ON DUPLICATE KEY UPDATE`, `INTERSECT`/`EXCEPT`, etc.). The Innovation Release model that started with 8.1.0 is cumulative with these features.

You can set this to your real database version (whatever it is) regardless of whether ts-sql-query currently uses it — extra granularity is harmless and future-proof.

Recognised breakpoints (with the default `Number.POSITIVE_INFINITY` every breakpoint below is enabled — the list reads as the bar you need to clear to keep each feature):

- `>= 8_000_019`: target MySQL 8.0.19+. The row alias syntax `INSERT ... AS _new_ ON DUPLICATE KEY UPDATE col = _new_.col` is emitted to reference values being inserted (added in 8.0.19; the legacy `VALUES(col)` function reference was deprecated in 8.0.20).
- `>= 8_000_017`: target MySQL 8.0.17+. `DOUBLE` is used as a cast target (added in 8.0.17) whenever a value must be turned into a floating point number — `.asDouble()`, both operands of `.divide(...)`. Below this breakpoint the value is multiplied by the approximate literal `1.0e0` instead, which promotes it to `DOUBLE` on any version.
- `>= 8_000_000`: target MySQL 8.0+. The `WITH` clause is used and recursive queries are supported.
- `< 8_000_000`: target MySQL 5. The `WITH` clause is not emitted — the inner query is inlined in the `FROM` instead — and the legacy `VALUES(col)` reference is used inside `ON DUPLICATE KEY UPDATE`. A recursive query, or one with a [`Values`](../../configuration/mapping.md#mapping-constant-values-as-view) source, can't be written for that version: its promise is rejected with the error `UNSUPPORTED_QUERY`, and nothing is sent to the database.

```ts
import { MySqlConnection } from "ts-sql-query/mysql";

class DBConnection extends MySqlConnection<'DBConnection'> {
    protected override compatibilityVersion = 5_007_000
}
```

## `snapshot` isolation doesn't protect writes

`connection.isolationLevel('snapshot')` runs the transaction at MySQL's `REPEATABLE READ`. Its reads all see the database as of one moment, but an `UPDATE` or a `DELETE` works on the latest committed version of the row and is never refused, so a transaction can write on the strength of something that is no longer true and another transaction's update is lost without any error. Every other database `ts-sql-query` supports refuses that write; `ts-sql-query` treats it as a MySQL defect. The scenario, and what to do instead, is in [Transaction isolation](../../queries/transaction.md#mysql-and-mariadb-snapshot-writes).

Further reading: [MySQL bug #117797](https://bugs.mysql.com/bug.php?id=117797), [Jepsen's analysis of MySQL 8.0.34](https://jepsen.io/analyses/mysql-8.0.34) (lost update, among other anomalies, under `REPEATABLE READ`) and [Jepsen's note on MariaDB's fix](https://jepsen.io/blog/2024-11-07-mariadb-snapshot-isolation).

## `stringConcat` truncates long results

`stringConcat` is emitted as `GROUP_CONCAT()`, which **silently truncates** its result at the session's `group_concat_max_len` — **1024 bytes by default**. It raises a warning, never an error, so the value arrives as a clean but incomplete string:

```
LENGTH(GROUP_CONCAT(6 x 200 chars)) = 1024      -- expected 1205
SHOW WARNINGS -> Warning 1260 "Row 6 was cut by GROUP_CONCAT()"
```

There is no alternative function on this engine (`STRING_AGG` does not exist), so the limit is inherent to the aggregate and the library cannot work around it. It is session configuration your application owns — raise it on the connection if you aggregate long strings:

```js
pool.on('connection', c => c.query('SET SESSION group_concat_max_len = 1000000'))
```

## The set of an update reads the row before the update

MySQL computes the assignments of the set of an update from left to right, and each one reads the value an earlier one already wrote; the other databases read the row as it was before the update. ts-sql-query writes the set so that MySQL gives the same rows:

- When a value reads a column that another assignment writes before it, and the update has one table, the assignments are reordered: `set({ name: tProject.name.concat('!'), slug: tProject.name })` is written `update project set slug = name, name = concat(name, ?) where id = ?`, and `slug` gets the name before the update.
- When the assignments read each other (`set({ name: tProject.slug, slug: tProject.name })`, which swaps the two columns), or the update has more than one table, the columns involved are read with their value before the update, by the primary key: `update project set name = (select _old_.slug from (select id, slug from project) as _old_ where _old_.id = project.id), slug = (select _old_.name from (select id, name from project) as _old_ where _old_.id = project.id) where id = ?`.
- A table without primary key can't be read that way, and such an update is refused with `UNSUPPORTED_QUERY` before anything is sent.

An update whose values don't read the columns it writes is written as it is.

The `on duplicate key update` of an insert (`onConflictDoUpdateSet`) is written the same way: its assignments are reordered when that is enough. When they read each other, MySQL can't read there the value the row had (it refuses a subquery over the table, 1093, and 5.7 the outer reference, 1054); where it can't, the insert is refused with `UNSUPPORTED_QUERY` before anything is sent.

## Collations & case sensitivity

MySQL's default collation (`utf8mb4_0900_ai_ci`) is case- **and accent-insensitive** — so `equals` / `contains` / `like` fold both case and accents out of the box, where PostgreSQL, Oracle and SQLite would not. The plain string operations follow that configured collation; the `*Insensitive` operations force case-insensitivity over it. To force the *case-sensitive* direction, use a binary collation (`utf8mb4_bin`) with `.collate('<name>')` per value or on the column — the `SET collation_connection` session variable does **not** retarget a column comparison. `REPLACE` ignores collation on MySQL, so `replaceAll` is byte-wise case-sensitive with nothing to configure; for a case-insensitive replace use [`.replaceAllInsensitive(...)`](../../configuration/collations.md#replaceallinsensitive-the-insensitive-twin). See the dedicated [Collations & case sensitivity](../../configuration/collations.md) page and the [MySQL / MariaDB tab](../../configuration/collations.md#per-database).

!!! warning "Validate the case sensitivity, then configure the connection"

    The case- and accent-insensitive (`_ai_ci`) default is common but **not guaranteed** — a database or column can be created with a binary (`utf8mb4_bin`) or case-sensitive collation, and a deployment you don't control may differ. Confirm it rather than assuming: `SELECT @@collation_database` for the database default, or `SHOW FULL COLUMNS FROM your_table` per column (the `Collation` column).

    If it **is** case-insensitive, tell ts-sql-query so it generates the leanest SQL: set **`insensitiveCollation = ''`** on the connection. The `*Insensitive` operations then trust the column's collation and drop the redundant `lower(a) = lower(b)` — which also defeats indexes — emitting the bare comparison the already-CI column folds correctly:

    ```ts
    class DBConnection extends MySqlConnection<'DBConnection'> {
        override insensitiveCollation = '' // the database is already case-insensitive — trust it
    }
    ```

    Note too that the **plain** operations already fold case (and accents) here — `.equals(...)` behaves like `.equalsInsensitive(...)`. Where a query needs a case-sensitive comparison, force it with `.collate('utf8mb4_bin')`.

## UUID strategies

`ts-sql-query` provides different strategies to handle UUID values in MySQL. These strategies control how UUID values are represented in JavaScript and stored in the database.

- `'binary'` *(default strategy)*: UUIDs are treated as strings and stored using the native `BINARY(16)` column type via the `UUID_TO_BIN` / `BIN_TO_UUID` functions. These are built in from MySQL 8; on MySQL 5.7 either use the `'string'` strategy below or define them yourself (see [MySQL functions](functions.md#uuid_to_bin-and-bin_to_uuid-for-mysql-57)).
- `'string'`: UUIDs are treated as strings and stored in character-based columns such as `CHAR(36)`, `VARCHAR(36)`, or `TEXT`. This option can be used with older MySQL versions or when avoiding the `BINARY` type. The library sends and reads the text of a uuid in lower case, the case the other strategies and databases give it: a uuid sent in upper case is stored and read in lower case, and an equality with it finds the uuid stored by the library.
- `'string as sent'`: as `'string'`, but the text of a uuid is sent and read as it is, in the case it has. A uuid stored in upper case is read in upper case, and an equality compares the text as the column's collation does. Choose it for a column that other applications fill in upper case and compare as it is.

You can configure the strategy by overriding the `uuidStrategy` field in your connection class:

```ts
import { MySqlConnection } from "ts-sql-query/mysql";

class DBConnection extends MySqlConnection<'DBConnection'> {
    protected override uuidStrategy = 'string' as const
}
```

!!! tip "Generating UUIDs"

    Prefer **UUID v7** over UUID v4. With the `'binary'` strategy on MySQL 8+, the bytes are stored in canonical order, so a UUID v7 keeps its chronological ordering on the primary-key index. MySQL has no server-side v7 generator (its built-in `UUID()` returns v1, which does not preserve sortability under the canonical byte order of the `'binary'` strategy), so v7 must be generated in the application — the only exception to the general rule of preferring database-side generation that is laid out in the [column types](../../configuration/data-types.md) page.

## Rounding behavior

MySQL's native `ROUND` function applies **different tie-breaking rules** depending on whether its argument is an exact-value or an approximate-value number. Per the [MySQL manual](https://dev.mysql.com/doc/refman/en/mathematical-functions.html#function_round):

> For exact-value numbers (`DECIMAL`), `ROUND()` uses the **"round half away from zero"** rule (so `round(0.5) → 1` and `round(2.5) → 3`).
>
> For approximate-value numbers (`DOUBLE`), the result *"depends on the C library; on many systems this means that `ROUND()` uses the 'round half to even' rule"* (so `round(0.5) → 0` and `round(2.5) → 2`).

ts-sql-query breaks ties away from zero on every dialect, matching JavaScript's `Math.round` for positive `.5` values. Expressions such as `.divide(...)` and `.asDouble()` produce a `DOUBLE`, so without care `.round()` would silently switch tie-breaking rules depending on what came before it in the chain. To keep `.round()` predictable and portable, **the MySQL connection casts the operand back to an exact type before applying `round`**, so `value.round()` always rounds ties away from zero regardless of the operand's type.

For example, `tIssue.priority.divide(2).round()` (where `priority = 1`) yields `round(0.5) = 1` on every dialect, including MySQL.

If you prefer MySQL's native `round(<double>)` semantics — typically because your application is single-dialect and you want the IEEE 754 round-to-even tie-breaking common on modern systems, or because existing queries depend on that result — set `usePlatformDependentRound = true` on your connection:

```ts
import { MySqlConnection } from "ts-sql-query/mysql";

class DBConnection extends MySqlConnection<'DBConnection'> {
    protected override usePlatformDependentRound = true
}
```

With the flag on, `value.round()` and `value.roundn(n)` emit `round(x)` directly: when `x` is an exact expression you still get away-from-zero, but when `x` is a `DOUBLE` expression (the type produced by `.divide(...)`, `.asDouble()`, and many other arithmetic chains) the tie-breaking follows the C library's rules.

The flag also sends and writes the scale of `roundn` as it is. MySQL rounds a fractional scale (`roundn(1.6)` is 2 decimals), which is what the library does on every database without the flag.

## Time zones

Which column types fall in which [kind of temporal column](../../advanced/dates-and-times/column-kinds-and-session.md#the-four-kinds-of-temporal-column), and what the zone of the database and the session do (see [Time zones](../../configuration/time-zones.md)):

| kind | types |
|---|---|
| 1 — no handling | `DATE`, `TIME`, `DATETIME` |
| 2 — pinned, delivered without the zone | `TIMESTAMP` (stored as UTC, converted with the session zone) |
| 3 — pinned, delivered with the zone | *none* |
| 4 — zone stored per value | *none* |

The zone of the database is the server's `time_zone`: `SYSTEM` by default, the zone of the operating system of the machine it runs on, or the one set in the server. It must be UTC. The session takes it unless something sets another: leave it so, since a `TIMESTAMP` column and `now()` follow the session. Bun SQL sets the session to `+00:00`, which is right only with the server in UTC. The query runner can't read either without a query of its own, so it doesn't check them. With both in UTC, `now()` and `utc_timestamp()` give the same time:

```sql
SELECT @@global.time_zone, @@session.time_zone, now(), utc_timestamp();
```

!!! warning "`TIMESTAMP` is not this engine's `timestamptz`"

    "Stored as UTC" reads like "safe", but it is kind 2, not kind 3: the conversion uses the **session's** zone and what reaches the driver is a bare wall clock. With the session in UTC it holds the UTC digits, as a `DATETIME` does.
