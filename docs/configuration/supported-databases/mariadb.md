---
search:
  boost: 0.59
---
# MariaDB

This page describes how `ts-sql-query` integrates with **[MariaDB](https://mariadb.org)**, including dialect-specific behavior, configuration options, and available features. It covers the proper setup of a MariaDB connection, guidelines for connection management, and advanced behaviors such as UUID handling.

!!! info

    To configure the database dialect, extend the appropriate database connection class when defining your connection. You must choose the correct database type to ensure that the generated SQL queries follow the dialect expected by that database.

!!! warning "Do not share connections between requests"

    A `ts-sql-query` connection object — along with the query runner instances passed to its constructor — represents a **dedicated connection** to the database.

    Therefore, **you must not share the same connection object between concurrent HTTP requests**. Instead, create a new connection object for each request, along with its own query runners.

    Even if the query runner internally uses a connection pool, the `ts-sql-query` connection still represents a single active connection, acquired from the pool. It must be treated as such and never reused across requests.

## Usage Example

```ts
import { MariaDBConnection } from "ts-sql-query/connections/MariaDBConnection";

class DBConnection extends MariaDBConnection<'DBConnection'> { }
```

## Compatibility version

The `compatibilityVersion` property declares the minimum MariaDB version the generated SQL must support, encoded as the integer `major * 1000 + minor` — e.g. `10_005` for MariaDB 10.5, `10_004` for MariaDB 10.4. The numeric separator `_` is for readability only (`10_005 === 10005`). The default is `Number.POSITIVE_INFINITY` (latest), so every supported feature is emitted.

You can set this to your real database version (whatever it is) regardless of whether ts-sql-query currently uses it — extra granularity is harmless and future-proof.

Recognised breakpoints (with the default `Number.POSITIVE_INFINITY` every breakpoint below is enabled — the list reads as the bar you need to clear to keep each feature):

- `>= 10_005`: target MariaDB 10.5+. The `RETURNING` clause (supported on `INSERT` and `DELETE` since MariaDB 10.5) is emitted on `INSERT` to retrieve the last inserted ID directly from the statement. Below this breakpoint the last inserted ID reported by the underlying connector after the query execution is used instead.
- `>= 10_003`: target MariaDB 10.3+. The `VALUE(col)` function — added in MariaDB 10.3 ([MDEV-12172](https://jira.mariadb.org/browse/MDEV-12172)) as a rename of `VALUES(col)`, to avoid the name clash with the standard Table Value Constructors syntax introduced in the same release — is emitted inside `ON DUPLICATE KEY UPDATE` to reference the values being inserted. Below this breakpoint the legacy `VALUES(col)` name is emitted instead — it remains accepted by every modern MariaDB version, so generated SQL stays runnable.

```ts
import { MariaDBConnection } from "ts-sql-query/connections/MariaDBConnection";

class DBConnection extends MariaDBConnection<'DBConnection'> {
    protected override compatibilityVersion = 10_004
}
```

## UUID strategies

`ts-sql-query` provides different strategies to handle UUID values in MariaDB. These strategies control how UUID values are represented in JavaScript and stored in the database.

- `'uuid'` *(default strategy)*: UUIDs are treated as strings and stored using the native `UUID` column type. This requires MariaDB version 10.7 or higher.
- `'string'`: UUIDs are treated as strings and stored in character-based columns such as `CHAR(36)`, `VARCHAR(36)`, or `TEXT`. This option can be used with older MariaDB versions or when avoiding the `UUID` type.

You can configure the strategy by overriding the `uuidStrategy` field in your connection class:

```ts
import { MariaDBConnection } from "ts-sql-query/connections/MariaDBConnection";

class DBConnection extends MariaDBConnection<'DBConnection'> {
    protected override uuidStrategy = 'string' as const
}
```

!!! tip "Generating UUIDs"

    Prefer **UUID v7** over UUID v4. MariaDB's native `UUID` type stores UUIDs with version ≥ 6 in canonical byte order ([MDEV-29959](https://jira.mariadb.org/browse/MDEV-29959), since MariaDB 10.10.6 / 10.11.5 — predates the RFC 9562 publication), so v7 keeps its chronological ordering on the primary-key index. MariaDB 11.7+ also exposes a server-side `UUID_v7()` function. As a general rule, generating the UUID in the database as a column `DEFAULT` is preferred over generating it in application code; the latter is the fallback when the value must be known before the `INSERT`. See the [column types](../column-types.md) page for more context.
