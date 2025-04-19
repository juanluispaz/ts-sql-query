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

    SQL Server does not have a native boolean data type; ts-sql-query assumes that the boolean is represented by a bit where `0` is false, and `1` is true. All conversions are made automatically by ts-sql-query. In case you need a different way to represent a boolean, see [Custom booleans values](../../advanced/custom-booleans-values.md) for more information.

## UUID management

In SQL Server, UUIDs are stored in columns of type `uniqueidentifier`, which preserve values in uppercase. If you prefer to convert them to lowercase during projection, you can override the `transformValueFromDB` method as shown below:

```ts
import { SqlServerConnection } from "ts-sql-query/connections/SqlServerConnection";

class DBConnection extends SqlServerConnection<'DBConnection'> { 
    protected transformValueFromDB(value: unknown, type: string): unknown {
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
