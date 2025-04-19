---
search:
  boost: 0.59
---
# MariaDB

This page describes how `ts-sql-query` integrates with **[MariaDB](https://mariadb.org)**, including dialect-specific behavior, configuration options, and available features. It covers the proper setup of a MariaDB connection, guidelines for connection management, and advanced behaviors such as ID retrieval and UUID handling.

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

## Insert ID Retrieval Strategies

Starting from MariaDB 10.5, the `RETURNING` clause is supported for `INSERT` and `DELETE` statements. If you set this flag to `true`, `ts-sql-query` will use the `RETURNING` clause to retrieve the last inserted ID, instead of relying on the ID returned by the underlying connector after the query execution.

```ts
import { MariaDBConnection } from "ts-sql-query/connections/MariaDBConnection";

class DBConnection extends MariaDBConnection<'DBConnection'> { 
    protected alwaysUseReturningClauseWhenInsert = true
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
    protected uuidStrategy = 'string' as const
}
```
