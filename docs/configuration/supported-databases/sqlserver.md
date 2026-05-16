---
search:
  boost: 0.59
---
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

When `compatibilityVersion >= 17_000_000` (SQL Server 2025), ts-sql-query emits the native `json_arrayagg` / `json_object` aggregates introduced in that version for [`aggregateAsArray`](../../queries/aggregate-as-object-array.md) and `aggregateAsArrayOfOneColumn`. On older SQL Server versions, set `compatibilityVersion` to your actual version (e.g. `16_000_000` for SQL Server 2022); the same queries are then emitted using `string_agg`/`string_escape` to build the JSON output. The `aggregateAsArrayDistinct` / `aggregateAsArrayOfOneColumnDistinct` variants always use the `string_agg` form regardless of `compatibilityVersion`, because `json_arrayagg` does not accept `DISTINCT`.

It is recommended to set this value to your real database version so future ts-sql-query releases that gate additional features on it pick the right behavior automatically.

```ts
import { SqlServerConnection } from "ts-sql-query/connections/SqlServerConnection";

class DBConnection extends SqlServerConnection<'DBConnection'> {
    protected override compatibilityVersion = 16_000_000
}
```

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
