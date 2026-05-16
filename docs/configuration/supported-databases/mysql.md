---
search:
  boost: 0.59
---
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

- `'binary'` *(default strategy)*: UUIDs are treated as strings and stored using the native `BINARY(16)` column type via the `UUID_TO_BIN` / `BIN_TO_UUID` functions. This requires MySQL version 8 or higher.
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

## Compatibility version

The `compatibilityVersion` property declares the minimum MySQL version the generated SQL must support, encoded as the integer `major * 1000 + minor` — e.g. `8_000` for MySQL 8.0, `5_007` for MySQL 5.7. The numeric separator `_` is for readability only (`8_000 === 8000`). The default is `Number.POSITIVE_INFINITY` (latest), so every supported feature is emitted.

You can set this to your real database version (whatever it is) regardless of whether ts-sql-query currently uses it — extra granularity is harmless and future-proof.

Recognised breakpoints:

- `>= 8_000` *(default)*: target MySQL 8+. Uses the `WITH` clause; recursive queries are supported.
- `< 8_000`: target MySQL 5. The `WITH` clause is not emitted — the inner query is inlined in the `FROM` instead — and recursive queries throw at query-build time.

```ts
import { MySqlConnection } from "ts-sql-query/connections/MySqlConnection";

class DBConnection extends MySqlConnection<'DBConnection'> {
    protected override compatibilityVersion = 5_007
}
```
