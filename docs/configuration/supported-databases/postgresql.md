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

## Explicit typing

In some situations, PostgreSQL may be unable to infer the correct type of a parameter in a query. This often happens with untyped `NULL` values or when using generic placeholders. To ensure type safety and proper execution, you can explicitly cast the parameter type in the generated SQL.

You can enforce explicit casting by overriding the `transformPlaceholder` method in your connection class. This method allows you to append a type annotation to the placeholder at the time of SQL generation.

You may define your own cast rules or override the default behavior. For reference, see the default implementation in [`PostgreSqlConnection`](https://github.com/juanluispaz/ts-sql-query/blob/master/src/connections/PostgreSqlConnection.ts), or use the example below:

```ts
import { PostgreSqlConnection } from "ts-sql-query/connections/PostgreSqlConnection";

class DBConnection extends PostgreSqlConnection<'DBConnection'> {
    protected transformPlaceholder(
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
