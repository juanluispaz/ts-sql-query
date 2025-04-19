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

`ts-sql-query` provides different strategies to handle UUID values in MariaDB. These strategies control how UUID values are represented in JavaScript and stored in the database.

- `'uuid'` *(default strategy)*: UUIDs are treated as strings and stored using the native `BINARY` column type. This requires MySQL version 8 or higher.
- `'string'`: UUIDs are treated as strings and stored in character-based columns such as `CHAR(36)`, `VARCHAR(36)`, or `TEXT`. This option can be used with older MySQL versions or when avoiding the `BINARY` type.

You can configure the strategy by overriding the `uuidStrategy` field in your connection class:

```ts
import { MySqlConnection } from "ts-sql-query/connections/MySqlConnection";

class DBConnection extends MySqlConnection<'DBConnection'> {
    protected uuidStrategy = 'string' as const
}
```

## Compatibility mode

The compatibility mode avoids using the `WITH` clause to increase the compatibility with MySql 5.

By default the compatibility mode is disabled. To enable the compatibility mode, you must set the `compatibilityMode` property of the connection to true.

```ts
import { MySqlConnection } from "ts-sql-query/connections/MySqlConnection";

class DBConnection extends MySqlConnection<'DBConnection'> {
    protected compatibilityMode = true
}
```

!!! warning

    When the compatibility mode is enabled recursive queries are not supported and you will get an error if you try to use them.
