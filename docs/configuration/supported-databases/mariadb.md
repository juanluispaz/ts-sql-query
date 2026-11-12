---
search:
  boost: 0.59
---
<!-- doc-code-template: mariadb -->
# MariaDB

This page has what is particular to MariaDB: what it offers and what it doesn't, how to declare its version, sequences, the limit of `stringConcat`, what `snapshot` protects, the UUID strategies, and rounding. To define the connection and map your tables, the pages to read are [Connection](../connection.md) and [Mapping](../mapping.md).

## Defining the connection

```ts
import { MariaDBConnection } from "ts-sql-query/mariadb";

class DBConnection extends MariaDBConnection<'DBConnection'> { }
```

Create a connection object for each request, and don't share it between concurrent requests: see [Instantiating the connection](../connection.md#instantiating-the-connection-with-the-database-connection).

## What it offers and what it doesn't

What isn't offered doesn't compile on this connection. On a version older than the one shown, the database rejects the query. Each link goes to the page that explains the feature, with all the databases side by side.

| What | On this database |
|---|---|
| [`returning` in an insert](../../queries/insert.md#availability-per-database) | From MariaDB 10.5 |
| [`returning` in an update](../../queries/update.md#availability-in-each-database) | From MariaDB 13.0.1 |
| [`returning` in a delete](../../queries/delete.md#availability-in-each-database) | From MariaDB 10.0.5 |
| [`oldValues()` in an update](../../queries/update.md#availability-in-each-database) | From MariaDB 13.0.1 |
| [Insert on conflict](../../queries/insert-on-conflict.md#what-each-database-offers) | `onConflictDoNothing` and `onConflictDoUpdateSet`. `onConflictOn` and `onConflictOnConstraint` aren't offered |
| Other tables in an [update](../../queries/update.md#availability-in-each-database) or a [delete](../../queries/delete.md#availability-in-each-database) | `from`, `using`, and a join right after `update` or `deleteFrom` |
| [Compound queries](../../queries/compound-select.md#availability-in-each-database) | `union`, `unionAll`; `intersect`, `except`, `minus` from MariaDB 10.3; their `All` versions from MariaDB 10.5 |
| [Recursive queries](../../queries/recursive-select.md#availability-in-each-database) | `recursiveUnionAll`, `recursiveUnion`. `startWith` and `connectBy` aren't offered |
| [Arrays of objects from an aggregate](../../queries/aggregate-as-object-array.md#availability-in-each-database) | From MariaDB 10.5, also the `Distinct` versions |
| [`stringConcatDistinct`, `anyValue`](../../queries/aggregate-and-group-by.md#how-each-function-is-written-in-each-database) | `stringConcatDistinct` yes; `anyValue` isn't offered |
| [Sequences](../mapping.md#using-a-sequence) | From MariaDB 10.3 |
| [Stored procedures](../mapping.md#calling-a-stored-procedure) and [functions](../mapping.md#calling-a-function-of-the-database) | Yes |
| [Isolation levels](../../queries/transaction.md#what-each-database-offers) | `read uncommitted`, `read committed`, `snapshot` ([with a limitation](#snapshot-isolation-and-older-versions)), `serializable` |

## Compatibility version

The `compatibilityVersion` property says which MariaDB version the SQL must work on, encoded as the integer `major * 1_000_000 + minor * 1_000 + patch` — e.g. `10_005_000` for MariaDB 10.5.0, `10_003_003` for MariaDB 10.3.3. The numeric separator `_` is for readability only (`10_005_000 === 10005000`). The default is `Number.POSITIVE_INFINITY` (latest), so every supported feature is emitted.

You can set this to your real database version (whatever it is) regardless of whether ts-sql-query currently uses it — extra granularity is harmless and future-proof.

Recognised breakpoints (with the default `Number.POSITIVE_INFINITY` every breakpoint below is enabled — the list reads as the bar you need to clear to keep each feature):

- `>= 13_000_001`: target MariaDB 13.0.1+. Column references on a table-or-view returned by `.oldValues()` are emitted as `OLD_VALUE(col)` so that `UPDATE ... RETURNING` can return both pre- and post-update values in a single statement (added in MariaDB 13.0.1 via [MDEV-5092](https://jira.mariadb.org/browse/MDEV-5092)). Bare column references on the updated table continue to mean the post-update value inside `RETURNING`. Note: MariaDB only supports `RETURNING` on single-table `UPDATE` statements; old values of joined tables can't be returned. MariaDB also only returns the pre-update value when the old value is returned as a column of its own: used inside an expression (for example `tTable.name.equals(oldValues.name)` or `oldValues.name.concat('!')`), MariaDB 13.0.2 returns the post-update value or rejects the query with a syntax error ([MDEV-40126](https://jira.mariadb.org/browse/MDEV-40126)). Return the old value as its own column and compute the expression in your code instead.
- `>= 10_005_000`: target MariaDB 10.5+. The `RETURNING` clause (supported on `INSERT` and `DELETE` since MariaDB 10.5) is emitted on `INSERT` to retrieve the last inserted ID directly from the statement. Below this breakpoint the last inserted ID reported by the underlying connector after the query execution is used instead.
- `>= 10_004_000`: target MariaDB 10.4+. `DOUBLE` is used as a cast target (added in MariaDB 10.4.0) whenever a value must be turned into a floating point number — `.asDouble()`, both operands of `.divide(...)`. Below this breakpoint the value is multiplied by the approximate literal `1.0e0` instead, which promotes it to `DOUBLE` on any version.
- `>= 10_003_003`: target MariaDB 10.3.3+. The `VALUE(col)` function — added in MariaDB 10.3.3 ([MDEV-12172](https://jira.mariadb.org/browse/MDEV-12172)) as a rename of `VALUES(col)`, to avoid the name clash with the standard Table Value Constructors syntax introduced in the same release — is emitted inside `ON DUPLICATE KEY UPDATE` to reference the values being inserted. The 10.3 line went GA at 10.3.7, so every stable 10.3 release is past this breakpoint. Below it the legacy `VALUES(col)` name is emitted instead — it remains accepted by every modern MariaDB version, so generated SQL stays runnable.

```ts
import { MariaDBConnection } from "ts-sql-query/mariadb";

class DBConnection extends MariaDBConnection<'DBConnection'> {
    protected override compatibilityVersion = 10_004_000
}
```

## Sequences

MariaDB exposes server-side `SEQUENCE` objects (added in MariaDB 10.3.0 via [MDEV-10139](https://jira.mariadb.org/browse/MDEV-10139)), and `ts-sql-query` lets you reference them from a `MariaDBConnection`. The `sequence(...)` builder and `autogeneratedPrimaryKeyBySequence(...)` emit `NEXTVAL(seq)` / `LASTVAL(seq)`, matching the function form documented in the MariaDB knowledge base. `LASTVAL(seq)` is scoped to the current connection, so it returns the value most recently produced by `NEXTVAL(seq)` within the same session (or `NULL` if none).

```ts
class DBConnection extends MariaDBConnection<'DBConnection'> {
    customerSeq = this.sequence('customer_seq', 'int')
}

const tCustomer = new class TCustomer extends Table<DBConnection, 'TCustomer'> {
    id = this.autogeneratedPrimaryKeyBySequence('id', 'customer_seq', 'int')
    /* ... */
    
    constructor() {
        super('customer'); // table name in the database
    }
}()
```

Set `compatibilityVersion` to your MariaDB version (or leave the default) so the rest of the SQL is emitted accordingly. There is no fallback below 10.3 — the server simply does not recognise the `SEQUENCE` syntax, so don't expose sequences when targeting older versions.

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

## `snapshot` isolation and older versions

`connection.isolationLevel('snapshot')` runs the transaction at MariaDB's `REPEATABLE READ`. Since MariaDB 11.6.2 a write to a row another transaction changed after the snapshot is refused (error 1020, _Record has changed since last read_), as on the other databases. Before that version, or with the `innodb_snapshot_isolation` system variable turned off, the write is not refused and another transaction's update can be lost without any error — the same defect MySQL has. The scenario, and what to do instead, is in [Transaction isolation](../../queries/transaction.md#mysql-and-mariadb-snapshot-writes).

Further reading: [MDEV-35124](https://jira.mariadb.org/browse/MDEV-35124) (`innodb_snapshot_isolation` turned on by default), [Jepsen's note on MariaDB's fix](https://jepsen.io/blog/2024-11-07-mariadb-snapshot-isolation) and [Jepsen's analysis of MySQL 8.0.34](https://jepsen.io/analyses/mysql-8.0.34), whose anomalies MariaDB shared.

## Collations & case sensitivity

MariaDB's default collation (`utf8mb4_uca1400_ai_ci`) is case- **and accent-insensitive** — so `equals` / `contains` / `like` fold both case and accents out of the box, where PostgreSQL, Oracle and SQLite would not. The plain string operations follow that configured collation; the `*Insensitive` operations force case-insensitivity over it. To force the *case-sensitive* direction, use a binary collation (`utf8mb4_bin`) with `.collate('<name>')` per value or on the column — the `SET collation_connection` session variable does **not** retarget a column comparison. `REPLACE` ignores collation on MariaDB, so `replaceAll` is byte-wise case-sensitive with nothing to configure; for a case-insensitive replace use [`.replaceAllInsensitive(...)`](../collations.md#replaceallinsensitive-the-insensitive-twin). See the dedicated [Collations & case sensitivity](../collations.md) page and the [MySQL / MariaDB tab](../collations.md#per-database).

!!! warning "Validate the case sensitivity, then configure the connection"

    The case- and accent-insensitive (`_ai_ci`) default is common but **not guaranteed** — a database or column can be created with a binary (`utf8mb4_bin`) or case-sensitive collation, and a deployment you don't control may differ. Confirm it rather than assuming: `SELECT @@collation_database` for the database default, or `SHOW FULL COLUMNS FROM your_table` per column (the `Collation` column).

    If it **is** case-insensitive, tell ts-sql-query so it generates the leanest SQL: set **`insensitiveCollation = ''`** on the connection. The `*Insensitive` operations then trust the column's collation and drop the redundant `lower(a) = lower(b)` — which also defeats indexes — emitting the bare comparison the already-CI column folds correctly:

    ```ts
    class DBConnection extends MariaDBConnection<'DBConnection'> {
        override insensitiveCollation = '' // the database is already case-insensitive — trust it
    }
    ```

    Note too that the **plain** operations already fold case (and accents) here — `.equals(...)` behaves like `.equalsInsensitive(...)`. Where a query needs a case-sensitive comparison, force it with `.collate('utf8mb4_bin')`.

## UUID strategies

`ts-sql-query` provides different strategies to handle UUID values in MariaDB. These strategies control how UUID values are represented in JavaScript and stored in the database.

- `'uuid'` *(default strategy)*: UUIDs are treated as strings and stored using the native `UUID` column type. This requires MariaDB version 10.7 or higher.
- `'string'`: UUIDs are treated as strings and stored in character-based columns such as `CHAR(36)`, `VARCHAR(36)`, or `TEXT`. This option can be used with older MariaDB versions or when avoiding the `UUID` type.

You can configure the strategy by overriding the `uuidStrategy` field in your connection class:

```ts
import { MariaDBConnection } from "ts-sql-query/mariadb";

class DBConnection extends MariaDBConnection<'DBConnection'> {
    protected override uuidStrategy = 'string' as const
}
```

!!! tip "Generating UUIDs"

    Prefer **UUID v7** over UUID v4. MariaDB's native `UUID` type stores UUIDs with version ≥ 6 in canonical byte order ([MDEV-29959](https://jira.mariadb.org/browse/MDEV-29959), since MariaDB 10.10.6 / 10.11.5 — predates the RFC 9562 publication), so v7 keeps its chronological ordering on the primary-key index. MariaDB 11.7+ also exposes a server-side `UUID_v7()` function. As a general rule, generating the UUID in the database as a column `DEFAULT` is preferred over generating it in application code; the latter is the fallback when the value must be known before the `INSERT`. See the [column types](../column-types.md) page for more context.

## Rounding behavior

MariaDB's native `ROUND` function applies **different tie-breaking rules** depending on whether its argument is an exact-value or an approximate-value number. Per the [MariaDB knowledge base](https://mariadb.com/kb/en/round/):

> For exact-value numbers (`DECIMAL`), `ROUND()` uses the **"round half away from zero"** rule (so `round(0.5) → 1` and `round(2.5) → 3`).
>
> For approximate-value numbers (`DOUBLE`), the result depends on the C library, which rounds half to even on the usual platforms (so `round(0.5) → 0` and `round(2.5) → 2`).

ts-sql-query breaks ties away from zero on every dialect, matching JavaScript's `Math.round` for positive `.5` values. Expressions such as `.divide(...)` and `.asDouble()` produce a `DOUBLE`, so without care `.round()` would silently switch tie-breaking rules depending on what came before it in the chain. To keep `.round()` predictable and portable, **the MariaDB connection casts the operand back to an exact type before applying `round`**, so `value.round()` always rounds ties away from zero regardless of the operand's type.

For example, `tIssue.priority.divide(2).round()` (where `priority = 1`) yields `round(0.5) = 1` on every dialect, including MariaDB.

If you prefer MariaDB's native `round(<double>)` semantics — typically because your application is single-dialect and you want the IEEE 754 round-to-even tie-breaking common on modern systems, or because existing queries depend on that result — set `usePlatformDependentRound = true` on your connection:

```ts
import { MariaDBConnection } from "ts-sql-query/mariadb";

class DBConnection extends MariaDBConnection<'DBConnection'> {
    protected override usePlatformDependentRound = true
}
```

With the flag on, `value.round()` and `value.roundn(n)` emit `round(x)` directly: when `x` is an exact expression you still get away-from-zero, but when `x` is a `DOUBLE` expression (the type produced by `.divide(...)`, `.asDouble()`, and many other arithmetic chains) the tie-breaking follows the C library's rules.

The flag also sends and writes the scale of `roundn` as it is. MariaDB rounds a fractional scale (`roundn(1.6)` is 2 decimals), which is what the library does on every database without the flag.
