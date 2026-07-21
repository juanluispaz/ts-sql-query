---
search:
  boost: 0.59
---
<!-- doc-code-template: mysql -->
# MySQL

This page describes how `ts-sql-query` integrates with **[MySQL](https://www.mysql.com)**, including dialect-specific behavior, configuration options, and available features. It covers the proper setup of a MySQL connection, guidelines for connection management, and advanced behaviors such as UUID handling.

!!! info

    To configure the database dialect, extend the appropriate database connection class when defining your connection. You must choose the correct database type to ensure that the generated SQL queries follow the dialect expected by that database.

!!! warning "Do not share connections between requests"

    A `ts-sql-query` connection object — along with the query runner instances passed to its constructor — represents a **dedicated connection** to the database.

    Therefore, **you must not share the same connection object between concurrent HTTP requests**. Instead, create a new connection object for each request, along with its own query runners.

    Even if the query runner internally uses a connection pool, the `ts-sql-query` connection still represents a single active connection, acquired from the pool. It must be treated as such and never reused across requests.

## Usage Example

```ts
import { MySqlConnection } from "ts-sql-query/connections/MySqlConnection";

class DBConnection extends MySqlConnection<'DBConnection'> { }
```

## UUID strategies

`ts-sql-query` provides different strategies to handle UUID values in MySQL. These strategies control how UUID values are represented in JavaScript and stored in the database.

- `'binary'` *(default strategy)*: UUIDs are treated as strings and stored using the native `BINARY(16)` column type via the `UUID_TO_BIN` / `BIN_TO_UUID` functions. These are built in from MySQL 8; on MySQL 5.7 either use the `'string'` strategy below or define them yourself (see [UUID utility functions for MySQL](#uuid-utility-functions-for-mysql)).
- `'string'`: UUIDs are treated as strings and stored in character-based columns such as `CHAR(36)`, `VARCHAR(36)`, or `TEXT`. This option can be used with older MySQL versions or when avoiding the `BINARY` type.

You can configure the strategy by overriding the `uuidStrategy` field in your connection class:

```ts
import { MySqlConnection } from "ts-sql-query/connections/MySqlConnection";

class DBConnection extends MySqlConnection<'DBConnection'> {
    protected override uuidStrategy = 'string' as const
}
```

!!! tip "Generating UUIDs"

    Prefer **UUID v7** over UUID v4. With the `'binary'` strategy on MySQL 8+, the bytes are stored in canonical order, so a UUID v7 keeps its chronological ordering on the primary-key index. MySQL has no server-side v7 generator (its built-in `UUID()` returns v1, which does not preserve sortability under the canonical byte order of the `'binary'` strategy), so v7 must be generated in the application — the only exception to the general rule of preferring database-side generation that is laid out in the [column types](../column-types.md) page.

## UUID utility functions for MySQL

The `'binary'` strategy relies on the `UUID_TO_BIN` / `BIN_TO_UUID` functions, which MySQL provides as built-ins from **version 8.0**. On **MySQL 5.7** they don't exist, so either use the `'string'` strategy above, or create the two functions yourself — MySQL resolves the names case-insensitively, so `ts-sql-query`'s emitted `uuid_to_bin(...)` / `bin_to_uuid(...)` resolve to them. The implementation below matches the 8.0 built-ins with the default swap flag (`0`, natural byte order), so values stored on 5.7 read back identically on 8.0+:

```sql
CREATE FUNCTION UUID_TO_BIN(uuid CHAR(36)) RETURNS BINARY(16) DETERMINISTIC
    RETURN UNHEX(REPLACE(uuid, '-', ''));

CREATE FUNCTION BIN_TO_UUID(b BINARY(16)) RETURNS CHAR(36) DETERMINISTIC
    RETURN IF(b IS NULL, NULL,
        LOWER(CONCAT_WS('-',
            SUBSTR(HEX(b), 1, 8), SUBSTR(HEX(b), 9, 4), SUBSTR(HEX(b), 13, 4),
            SUBSTR(HEX(b), 17, 4), SUBSTR(HEX(b), 21, 12))));
```

They store the 16 bytes as-is (no version-specific reordering), so they accept any UUID version — unlike MySQL's built-in swap form `UUID_TO_BIN(uuid, 1)`, which reorders the time fields of a v1 UUID. The `NULL` guard in `BIN_TO_UUID` returns `NULL` for a `NULL` input, matching the built-in (an unguarded `CONCAT_WS` would return a stray `----` string). `CHAR` results from a stored function take the database's default collation, so keep the connection collation aligned with it (on 5.7 that is `utf8mb4_general_ci`) to avoid an `Illegal mix of collations` error when a UUID string is compared against a literal.

## Compatibility version

The `compatibilityVersion` property declares the minimum MySQL version the generated SQL must support, encoded as the integer `major * 1_000_000 + minor * 1_000 + patch` — e.g. `8_000_019` for MySQL 8.0.19, `5_007_000` for MySQL 5.7. The numeric separator `_` is for readability only (`8_000_019 === 8000019`). The default is `Number.POSITIVE_INFINITY` (latest), so every supported feature is emitted.

Patch precision matters here because MySQL 8.0 has a continuous-delivery history: from 8.0.0 (April 2018) through 8.0.34 (July 2023), patch releases added new dialect features (CTE, `LATERAL`, the row alias for `ON DUPLICATE KEY UPDATE`, `INTERSECT`/`EXCEPT`, etc.). The Innovation Release model that started with 8.1.0 is cumulative with these features.

You can set this to your real database version (whatever it is) regardless of whether ts-sql-query currently uses it — extra granularity is harmless and future-proof.

Recognised breakpoints (with the default `Number.POSITIVE_INFINITY` every breakpoint below is enabled — the list reads as the bar you need to clear to keep each feature):

- `>= 8_000_019`: target MySQL 8.0.19+. The row alias syntax `INSERT ... AS _new_ ON DUPLICATE KEY UPDATE col = _new_.col` is emitted to reference values being inserted (added in 8.0.19; the legacy `VALUES(col)` function reference was deprecated in 8.0.20).
- `>= 8_000_017`: target MySQL 8.0.17+. `DOUBLE` is used as a cast target (added in 8.0.17) whenever a value must be turned into a floating point number — `.asDouble()`, both operands of `.divide(...)`. Below this breakpoint the value is multiplied by the approximate literal `1.0e0` instead, which promotes it to `DOUBLE` on any version.
- `>= 8_000_000`: target MySQL 8.0+. The `WITH` clause is used and recursive queries are supported.
- `< 8_000_000`: target MySQL 5. The `WITH` clause is not emitted — the inner query is inlined in the `FROM` instead — recursive queries throw at query-build time, and the legacy `VALUES(col)` reference is used inside `ON DUPLICATE KEY UPDATE`.

```ts
import { MySqlConnection } from "ts-sql-query/connections/MySqlConnection";

class DBConnection extends MySqlConnection<'DBConnection'> {
    protected override compatibilityVersion = 5_007_000
}
```

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

## Collations & case sensitivity

MySQL's default collation (`utf8mb4_0900_ai_ci`) is case- **and accent-insensitive** — so `equals` / `contains` / `like` fold both case and accents out of the box, where PostgreSQL, Oracle and SQLite would not. The plain string operations follow that configured collation; the `*Insensitive` operations force case-insensitivity over it. To force the *case-sensitive* direction, use a binary collation (`utf8mb4_bin`) with `.collate('<name>')` per value or on the column — the `SET collation_connection` session variable does **not** retarget a column comparison. `REPLACE` ignores collation on MySQL, so `replaceAll` is byte-wise case-sensitive with nothing to configure; for a case-insensitive replace use [`.replaceAllInsensitive(...)`](../collations.md#replaceallinsensitive-the-insensitive-twin). See the dedicated [Collations & case sensitivity](../collations.md) page and the [MySQL / MariaDB tab](../collations.md#per-database).

!!! warning "Validate the case sensitivity, then configure the connection"

    The case- and accent-insensitive (`_ai_ci`) default is common but **not guaranteed** — a database or column can be created with a binary (`utf8mb4_bin`) or case-sensitive collation, and a deployment you don't control may differ. Confirm it rather than assuming: `SELECT @@collation_database` for the database default, or `SHOW FULL COLUMNS FROM your_table` per column (the `Collation` column).

    If it **is** case-insensitive, tell ts-sql-query so it generates the leanest SQL: set **`insensitiveCollation = ''`** on the connection. The `*Insensitive` operations then trust the column's collation and drop the redundant `lower(a) = lower(b)` — which also defeats indexes — emitting the bare comparison the already-CI column folds correctly:

    ```ts
    class DBConnection extends MySqlConnection<'DBConnection'> {
        override insensitiveCollation = '' // the database is already case-insensitive — trust it
    }
    ```

    Note too that the **plain** operations already fold case (and accents) here — `.equals(...)` behaves like `.equalsInsensitive(...)`. Where a query needs a case-sensitive comparison, force it with `.collate('utf8mb4_bin')`.

## Rounding behavior

MySQL's native `ROUND` function applies **different tie-breaking rules** depending on whether its argument is an exact-value or an approximate-value number. Per the [MySQL manual](https://dev.mysql.com/doc/refman/en/mathematical-functions.html#function_round):

> For exact-value numbers (`DECIMAL`), `ROUND()` uses the **"round half away from zero"** rule (so `round(0.5) → 1` and `round(2.5) → 3`).
>
> For approximate-value numbers (`DOUBLE`), the result *"depends on the C library; on many systems this means that `ROUND()` uses the 'round half to even' rule"* (so `round(0.5) → 0` and `round(2.5) → 2`).

ts-sql-query breaks ties away from zero on every dialect, matching JavaScript's `Math.round` for positive `.5` values. Expressions such as `.divide(...)` and `.asDouble()` produce a `DOUBLE`, so without care `.round()` would silently switch tie-breaking rules depending on what came before it in the chain. To keep `.round()` predictable and portable, **the MySQL connection casts the operand back to an exact type before applying `round`**, so `value.round()` always rounds ties away from zero regardless of the operand's type.

For example, `tIssue.priority.divide(2).round()` (where `priority = 1`) yields `round(0.5) = 1` on every dialect, including MySQL.

If you prefer MySQL's native `round(<double>)` semantics — typically because your application is single-dialect and you want the IEEE 754 round-to-even tie-breaking common on modern systems, or because existing queries depend on that result — set `usePlatformDependentRound = true` on your connection:

```ts
import { MySqlConnection } from "ts-sql-query/connections/MySqlConnection";

class DBConnection extends MySqlConnection<'DBConnection'> {
    protected override usePlatformDependentRound = true
}
```

With the flag on, `value.round()` and `value.roundn(n)` emit `round(x)` directly: when `x` is an exact expression you still get away-from-zero, but when `x` is a `DOUBLE` expression (the type produced by `.divide(...)`, `.asDouble()`, and many other arithmetic chains) the tie-breaking follows the C library's rules.
